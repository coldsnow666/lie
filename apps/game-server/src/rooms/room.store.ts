/**
 * 房间热状态存储：优先使用内存 Map，同时尝试同步 Redis 以支持活跃房间 TTL。
 */
import type { PrivateGameState, PublicGameEvent, Player } from "@lie/shared";
import { tryRedis } from "../redis/client";

const WAITING_ROOM_TTL_SECONDS = 60 * 60 * 2;
const PLAYING_ROOM_TTL_SECONDS = 60 * 60 * 6;
const FINISHED_ROOM_TTL_SECONDS = 60 * 60;

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
  roomsById.set(room.id, room);
  roomIdByCode.set(room.code, room.id);

  // Redis 写入失败不会阻塞本地开发；内存 Map 仍是当前进程内的权威热状态。
  await tryRedis(async (client) => {
    const ttl = ttlFor(room);
    await client.set(`room:${room.id}:state`, JSON.stringify(room), "EX", ttl);
    await client.set(`room:${room.code}:id`, room.id, "EX", ttl);
  });

  return room;
}

export async function getRoomById(roomId: string) {
  const memoryRoom = roomsById.get(roomId);
  if (memoryRoom) {
    return memoryRoom;
  }

  const redisRoom = await tryRedis(async (client) => {
    const raw = await client.get(`room:${roomId}:state`);
    return raw ? (JSON.parse(raw) as RoomState) : null;
  });

  if (redisRoom) {
    roomsById.set(redisRoom.id, redisRoom);
    roomIdByCode.set(redisRoom.code, redisRoom.id);
  }

  return redisRoom;
}

export async function getRoomByCode(roomCode: string) {
  const memoryId = roomIdByCode.get(roomCode);
  if (memoryId) {
    return getRoomById(memoryId);
  }

  const redisId = await tryRedis((client) => client.get(`room:${roomCode}:id`));

  return redisId ? getRoomById(redisId) : null;
}

export async function deleteRoom(room: RoomState) {
  roomsById.delete(room.id);
  roomIdByCode.delete(room.code);

  await tryRedis(async (client) => {
    await client.del(`room:${room.id}:state`, `room:${room.code}:id`);
  });
}
