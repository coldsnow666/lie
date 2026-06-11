/**
 * 房间业务服务：管理创建、加入、准备、开局、出牌和质疑。
 */
import crypto from "node:crypto";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  createInitialGameState,
  playCards,
  challengeLastPlay,
  finalizePendingWinner,
  findPendingWinner,
  type RoomLifecycleEvent,
  type DeclaredRank,
  type Player,
} from "@lie/shared";
import { prisma } from "../db/prisma";
import type { AuthUser } from "../auth/token";
import { errorContext, logger } from "../utils/logger";
import { deleteRoom, getRoomByCode, getRoomById, listRooms, saveRoom, type RoomState } from "./room.store";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WAITING_ROOM_WITHOUT_SOCKET_GRACE_MS = 60_000;

function generateRoomCode() {
  return Array.from({ length: 6 }, () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]).join("");
}

function createPlayer(user: AuthUser, seatIndex: number, socketId?: string, ready = false): Player {
  return {
    playerId: crypto.randomUUID(),
    userId: user.id,
    nickname: user.nickname,
    seatIndex,
    socketId,
    connected: true,
    ready,
    pendingWin: false,
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
      ready: userId === room.ownerUserId ? true : ready,
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

function pushRoomEvent(room: RoomState, event: RoomLifecycleEvent) {
  room.events = [...room.events, event].slice(-50);
}

function shouldDeleteAbandonedRoom(room: RoomState, now = Date.now()) {
  if (room.players.length === 0) {
    return true;
  }

  if (room.players.every((player) => !player.connected)) {
    return true;
  }

  // 房间热状态可能来自其他实例，当前进程不能仅凭 socketId 判断对方连接是否仍然有效，
  // 因此这里只清理“从未建立过 Socket 同步”的等待房，避免误删其他实例上的活房间。
  return (
    room.status === "waiting" &&
    room.players.every((player) => !player.socketId) &&
    now - room.updatedAt > WAITING_ROOM_WITHOUT_SOCKET_GRACE_MS
  );
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
  } catch (error) {
    logger.warn("room metadata persistence failed", {
      scope: "room.persistence.metadata",
      roomId: room.id,
      roomCode: room.code,
      ...errorContext(error),
    });
  }
}

export function serializeRoom(room: RoomState) {
  return publicRoom(room);
}

export async function listPublicRooms() {
  const rooms = await listRooms();
  const publicRooms = [];
  const now = Date.now();

  for (const room of rooms) {
    if (shouldDeleteAbandonedRoom(room, now)) {
      await deleteRoom(room);
      continue;
    }

    publicRooms.push(publicRoom(room));
  }

  return publicRooms;
}

export async function createRoom(
  user: AuthUser,
  options: {
    roomCode?: string;
    maxPlayers: 2 | 3;
  },
  socketId?: string,
) {
  const code = options.roomCode ?? generateRoomCode();

  if (await getRoomByCode(code)) {
    throw new Error("ROOM_CODE_EXISTS");
  }

  const now = Date.now();
  const room: RoomState = {
    id: crypto.randomUUID(),
    code,
    status: "waiting",
    ownerUserId: user.id,
    maxPlayers: options.maxPlayers,
    players: [createPlayer(user, 0, socketId, true)],
    gameState: null,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
  pushRoomEvent(room, {
    type: "room_joined",
    playerId: room.players[0].playerId,
    nickname: user.nickname,
  });

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
    if (room.ownerUserId === user.id) {
      existing.ready = true;
    }
    room.updatedAt = Date.now();
    return saveRoom(room);
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error("ROOM_FULL");
  }

  const player = createPlayer(user, nextSeatIndex(room.players), socketId);
  room.players.push(player);
  pushRoomEvent(room, {
    type: "room_joined",
    playerId: player.playerId,
    nickname: player.nickname,
  });
  room.updatedAt = Date.now();

  return saveRoom(room);
}

export async function leaveRoom(roomId: string, user: AuthUser) {
  const room = await getRoomById(roomId);

  if (!room) {
    return null;
  }

  if (room.status === "playing" || room.gameState?.status === "playing") {
    throw new Error("ROOM_IN_GAME");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    return room;
  }

  pushRoomEvent(room, {
    type: "room_left",
    playerId: player.playerId,
    nickname: player.nickname,
  });
  room.players = room.players.filter((candidate) => candidate.userId !== user.id);

  if (room.players.length === 0) {
    await deleteRoom(room);
    return null;
  }

  if (room.ownerUserId === user.id) {
    room.ownerUserId = room.players[0].userId;
    room.players[0].ready = true;
    pushRoomEvent(room, {
      type: "room_owner_changed",
      playerId: room.players[0].playerId,
      nickname: room.players[0].nickname,
    });
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

  player.ready = room.ownerUserId === user.id ? true : ready;
  room.updatedAt = Date.now();

  return saveRoom(room);
}

export async function syncRoomPlayer(roomId: string, user: AuthUser, socketId?: string) {
  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  player.connected = true;
  player.socketId = socketId;
  if (room.ownerUserId === user.id) {
    player.ready = true;
  }

  if (room.gameState) {
    room.gameState.players = room.gameState.players.map((statePlayer) =>
      statePlayer.playerId === player.playerId
        ? {
            ...statePlayer,
            connected: true,
            ready: room.ownerUserId === user.id ? true : statePlayer.ready,
            socketId,
          }
        : statePlayer,
    );
  }

  room.updatedAt = Date.now();
  return saveRoom(room);
}

export async function handleSocketDisconnect(socketId: string) {
  const rooms = await listRooms();
  const affectedRooms: RoomState[] = [];

  for (const room of rooms) {
    const player = room.players.find((candidate) => candidate.socketId === socketId);
    if (!player) {
      continue;
    }

    player.connected = false;
    player.socketId = null;

    if (room.gameState) {
      room.gameState.players = room.gameState.players.map((statePlayer) =>
        statePlayer.playerId === player.playerId
          ? {
              ...statePlayer,
              connected: false,
              socketId: null,
            }
          : statePlayer,
      );
    }

    room.updatedAt = Date.now();

    if (room.players.every((candidate) => !candidate.connected)) {
      await deleteRoom(room);
      continue;
    }

    affectedRooms.push(await saveRoom(room));
  }

  return affectedRooms;
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

  if (room.players.length !== room.maxPlayers || room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
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
          name: "cheat-classic",
          minPlayers: MIN_PLAYERS,
          maxPlayers: room.maxPlayers,
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
  } catch (error) {
    logger.warn("match persistence failed after game start", {
      scope: "room.persistence.matchStart",
      roomId: room.id,
      matchId,
      ...errorContext(error),
    });
  }

  return saveRoom(room);
}

export async function playRoomCards(roomId: string, user: AuthUser, cardIds: string[], declaredRank?: DeclaredRank) {
  const room = await getRoomById(roomId);

  if (!room?.gameState) {
    throw new Error("GAME_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  const pendingWinner = findPendingWinner(room.gameState);
  const concedingPendingWin =
    pendingWinner &&
    room.gameState.lastPlay &&
    room.gameState.lastPlay.playerId === pendingWinner.playerId &&
    pendingWinner.playerId !== player.playerId &&
    cardIds.length === 0;

  if (concedingPendingWin) {
    room.gameState = finalizePendingWinner(room.gameState);
    room.status = "finished";
    room.updatedAt = Date.now();

    await saveRoom(room);

    return { room, event: null };
  }

  if (!declaredRank) {
    throw new Error("DECLARED_RANK_REQUIRED");
  }

  const result = playCards(room.gameState, player.playerId, cardIds, declaredRank);
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
