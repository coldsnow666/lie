/**
 * @Description: 房间热状态以 Redis 为权威来源，进程内存只作为本地缓存加速读写。
 *
 * @Date 2026-06-12 14:47
 */
import type { PrivateGameState, PublicGameEvent, Player } from "@lie/shared";
import { tryRedis } from "../redis/client";

const WAITING_ROOM_TTL_SECONDS = 60 * 60 * 2;
const PLAYING_ROOM_TTL_SECONDS = 60 * 60 * 6;
const FINISHED_ROOM_TTL_SECONDS = 60 * 60;
const ROOM_INDEX_KEY = "rooms:index";

export type RoomStatus = "waiting" | "playing" | "finished";

export type RoomState = {
  id: string;
  code: string;
  status: RoomStatus;
  ownerUserId: string | null;
  maxPlayers: number;
  players: Player[];
  gameState: PrivateGameState | null;
  events: PublicGameEvent[];
  createdAt: number;
  updatedAt: number;
};

const roomsById = new Map<string, RoomState>();
const roomIdByCode = new Map<string, string>();

function roomStateKey(roomId: string) {
  return `room:${roomId}:state`;
}

function roomCodeKey(roomCode: string) {
  return `room:${roomCode}:id`;
}

function cacheRoom(room: RoomState) {
  roomsById.set(room.id, room);
  roomIdByCode.set(room.code, room.id);
}

function evictCachedRoom(room: Pick<RoomState, "id" | "code">) {
  roomsById.delete(room.id);
  roomIdByCode.delete(room.code);
}

function reconcileRoomCache(rooms: RoomState[]) {
  const nextRoomIds = new Set(rooms.map((room) => room.id));

  for (const room of roomsById.values()) {
    if (!nextRoomIds.has(room.id)) {
      evictCachedRoom(room);
    }
  }

  for (const room of rooms) {
    cacheRoom(room);
  }
}

function ttlFor(room: RoomState) {
  if (room.status === "playing") {
    return PLAYING_ROOM_TTL_SECONDS;
  }
  if (room.status === "finished") {
    return FINISHED_ROOM_TTL_SECONDS;
  }
  return WAITING_ROOM_TTL_SECONDS;
}

export async function saveRoom(room: RoomState) {
  await tryRedis(async (client) => {
    const ttl = ttlFor(room);
    await client.set(roomStateKey(room.id), JSON.stringify(room), "EX", ttl);
    await client.set(roomCodeKey(room.code), room.id, "EX", ttl);
    await client.sadd(ROOM_INDEX_KEY, room.id);
  }, "room.save");

  cacheRoom(room);

  return room;
}

export async function getRoomById(roomId: string) {
  const redisRoom = await tryRedis(async (client) => {
    const raw = await client.get(roomStateKey(roomId));
    return raw ? (JSON.parse(raw) as RoomState) : null;
  }, "room.getById");

  if (!redisRoom) {
    const cachedRoom = roomsById.get(roomId);
    if (cachedRoom) {
      evictCachedRoom(cachedRoom);
    }
    return null;
  }

  cacheRoom(redisRoom);
  return redisRoom;
}

export async function getRoomByCode(roomCode: string) {
  const redisId = await tryRedis((client) => client.get(roomCodeKey(roomCode)), "room.getByCode");

  if (!redisId) {
    roomIdByCode.delete(roomCode);
    return null;
  }

  const room = await getRoomById(redisId);
  if (!room) {
    roomIdByCode.delete(roomCode);
  }

  return room;
}

export async function listRooms() {
  const redisRooms = await tryRedis(async (client) => {
    const roomIds = await client.smembers(ROOM_INDEX_KEY);

    if (roomIds.length === 0) {
      return [];
    }

    const rawRooms = await client.mget(roomIds.map((roomId) => roomStateKey(roomId)));
    const staleRoomIds = roomIds.filter((_roomId, index) => !rawRooms[index]);

    if (staleRoomIds.length > 0) {
      await client.srem(ROOM_INDEX_KEY, ...staleRoomIds);
    }

    return rawRooms
      .filter((rawRoom): rawRoom is string => Boolean(rawRoom))
      .map((rawRoom) => JSON.parse(rawRoom) as RoomState)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, "room.list");

  reconcileRoomCache(redisRooms);
  return redisRooms;
}

export async function deleteRoom(room: RoomState) {
  await tryRedis(async (client) => {
    await client.del(roomStateKey(room.id), roomCodeKey(room.code));
    await client.srem(ROOM_INDEX_KEY, room.id);
  }, "room.delete");

  evictCachedRoom(room);
}
