/**
 * 房间业务服务：管理创建、加入、准备、开局、出牌和质疑。
 */
import crypto from "node:crypto";
import { MAX_PLAYERS, MIN_PLAYERS, createInitialGameState, playCards, challengeLastPlay, type Player } from "@lie/shared";
import { prisma } from "../db/prisma";
import type { AuthUser } from "../auth/token";
import { deleteRoom, getRoomByCode, getRoomById, saveRoom, type RoomState } from "./room.store";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join("");
}

function createPlayer(user: AuthUser, seatIndex: number, socketId?: string): Player {
  return {
    playerId: crypto.randomUUID(),
    userId: user.id,
    nickname: user.nickname,
    seatIndex,
    socketId,
    connected: true,
    ready: false,
  };
}

function publicRoom(room: RoomState) {
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    ownerUserId: room.ownerUserId,
    maxPlayers: room.maxPlayers,
    players: room.players.map(({ playerId, userId, nickname, seatIndex, connected, ready }) => ({
      playerId,
      userId,
      nickname,
      seatIndex,
      connected,
      ready,
    })),
    events: room.events.slice(-30),
    gameStarted: Boolean(room.gameState),
    updatedAt: room.updatedAt,
  };
}

function nextSeatIndex(players: Player[]) {
  for (let seat = 0; seat < MAX_PLAYERS; seat += 1) {
    if (!players.some((player) => player.seatIndex === seat)) {
      return seat;
    }
  }
  return players.length;
}

function findPlayerByUser(room: RoomState, userId: string) {
  return room.players.find((player) => player.userId === userId) ?? null;
}

async function createRoomRecord(room: RoomState) {
  try {
    await prisma.room.upsert({
      where: { id: room.id },
      create: {
        id: room.id,
        code: room.code,
        status: room.status,
        ownerUserId: room.ownerUserId,
        maxPlayers: room.maxPlayers,
      },
      update: {
        status: room.status,
        ownerUserId: room.ownerUserId,
        maxPlayers: room.maxPlayers,
      },
    });
  } catch {
    // PostgreSQL 未启动时仍允许本地调试 Socket 房间流程，正式环境应记录告警。
  }
}

export function serializeRoom(room: RoomState) {
  return publicRoom(room);
}

export async function createRoom(user: AuthUser, roomCode?: string, socketId?: string) {
  const code = roomCode ?? generateRoomCode();

  if (await getRoomByCode(code)) {
    throw new Error("ROOM_CODE_EXISTS");
  }

  const now = Date.now();
  const room: RoomState = {
    id: crypto.randomUUID(),
    code,
    status: "waiting",
    ownerUserId: user.id,
    maxPlayers: MAX_PLAYERS,
    players: [createPlayer(user, 0, socketId)],
    gameState: null,
    events: [],
    createdAt: now,
    updatedAt: now,
  };

  await saveRoom(room);
  await createRoomRecord(room);

  return room;
}

export async function joinRoom(roomCode: string, user: AuthUser, socketId?: string) {
  const room = await getRoomByCode(roomCode);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  if (room.status !== "waiting") {
    throw new Error("ROOM_NOT_WAITING");
  }

  const existing = findPlayerByUser(room, user.id);
  if (existing) {
    existing.connected = true;
    existing.socketId = socketId;
    room.updatedAt = Date.now();
    return saveRoom(room);
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error("ROOM_FULL");
  }

  room.players.push(createPlayer(user, nextSeatIndex(room.players), socketId));
  room.updatedAt = Date.now();

  return saveRoom(room);
}

export async function leaveRoom(roomId: string, user: AuthUser) {
  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  room.players = room.players.filter((candidate) => candidate.userId !== user.id);

  if (room.players.length === 0) {
    await deleteRoom(room);
    return null;
  }

  if (room.ownerUserId === user.id) {
    room.ownerUserId = room.players[0].userId;
  }

  room.updatedAt = Date.now();
  return saveRoom(room);
}

export async function setReady(roomId: string, user: AuthUser, ready: boolean) {
  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  player.ready = ready;
  room.updatedAt = Date.now();

  return saveRoom(room);
}

export async function startGame(roomId: string, user: AuthUser) {
  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  if (room.ownerUserId !== user.id) {
    throw new Error("ONLY_OWNER_CAN_START");
  }

  if (room.status !== "waiting") {
    throw new Error("ROOM_NOT_WAITING");
  }

  if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
    throw new Error("INVALID_PLAYER_COUNT");
  }

  const matchId = crypto.randomUUID();
  const deckSeed = crypto.randomUUID();
  // 开局时以当前座位快照创建私有游戏状态，后续发牌和真实牌面只保存在服务端。
  room.players = room.players.map((player) => ({ ...player, ready: true }));
  room.gameState = createInitialGameState({
    matchId,
    roomId: room.id,
    players: room.players,
    seed: deckSeed,
  });
  room.status = "playing";
  room.updatedAt = Date.now();

  try {
    await prisma.match.create({
      data: {
        id: matchId,
        roomId: room.id,
        status: "playing",
        ruleSet: {
          name: "mvp",
          minPlayers: MIN_PLAYERS,
          maxPlayers: MAX_PLAYERS,
        },
        deckSeed,
        startedAt: new Date(),
        players: {
          create: room.players.map((player) => ({
            userId: player.userId,
            playerId: player.playerId,
            nickname: player.nickname,
            seatIndex: player.seatIndex,
          })),
        },
      },
    });
  } catch {
    // 持久化失败不应改变已生成的服务端权威游戏状态；后续稳定性阶段再补偿写入。
  }

  return saveRoom(room);
}

export async function playRoomCards(roomId: string, user: AuthUser, cardIds: string[]) {
  const room = await getRoomById(roomId);

  if (!room?.gameState) {
    throw new Error("GAME_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  const result = playCards(room.gameState, player.playerId, cardIds);
  room.gameState = result.state;
  room.status = result.state.status === "finished" ? "finished" : "playing";
  room.events.push(result.event);
  room.updatedAt = Date.now();

  await saveRoom(room);

  return { room, event: result.event };
}

export async function challengeRoomLastPlay(roomId: string, user: AuthUser) {
  const room = await getRoomById(roomId);

  if (!room?.gameState) {
    throw new Error("GAME_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  const result = challengeLastPlay(room.gameState, player.playerId);
  room.gameState = result.state;
  room.events.push(result.event);
  room.updatedAt = Date.now();

  await saveRoom(room);

  return { room, event: result.event };
}
