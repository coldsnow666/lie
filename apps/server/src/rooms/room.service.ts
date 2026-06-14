/**
 * @Description: 房间业务服务：管理创建、加入、准备、开局、出牌和质疑。
 *
 * @Date 2026-06-12 14:47
 */
import crypto from "node:crypto";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  createTurnDeadline,
  createInitialGameState,
  playCards,
  skipTurn,
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
const TURN_DEADLINE_INITIAL_DEAL_DELAY_MS = 4_300;
const TURN_DEADLINE_CHALLENGE_DELAY_MS = 4_900;

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

/**
 * @Description: 判断等待房是否可清理，兼顾空房、全员离线和无 Socket 同步的陈旧房间。
 *
 * @param room Redis 中读取到的房间热状态。
 * @param now 当前时间戳，测试可注入。
 * @return 可以删除时返回 true。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 持久化房间元数据；失败只记日志，房间热状态仍以 Redis 保存结果为准。
 *
 * @param room 刚创建或更新后的房间状态。
 * @return 异步写入完成。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 列出大厅可见等待房，并顺手清理已废弃的热状态。
 *
 * @return 仅包含等待中房间的公开房间列表。
 *
 * @Date 2026-06-12 14:47
 */
export async function listPublicRooms() {
  const rooms = await listRooms();
  const publicRooms = [];
  const now = Date.now();

  for (const room of rooms) {
    if (shouldDeleteAbandonedRoom(room, now)) {
      await deleteRoom(room);
      continue;
    }

    if (room.status !== "waiting") {
      continue;
    }

    publicRooms.push(publicRoom(room));
  }

  return publicRooms;
}

/**
 * @Description: 创建等待房并写入 Redis 热状态，房主默认准备且占据首个座位。
 *
 * @param user 当前登录用户，服务端从 token 解析而来。
 * @param options 房间码和人数上限配置。
 * @param socketId 当前 Socket 连接 ID，可为空以兼容 HTTP 创建。
 * @return 创建后的房间状态。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 加入等待房；重复加入会刷新连接状态，不重新分配座位。
 *
 * @param roomCode 用户输入或系统生成的房间码。
 * @param user 当前登录用户。
 * @param socketId 当前 Socket 连接 ID。
 * @return 更新后的房间状态。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 离开等待房；房主离开时把房主身份交给下一位玩家。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @return 更新后的房间状态；房间被删除时返回 null。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 同步玩家准备状态，房主始终视为已准备。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @param ready 非房主玩家提交的准备状态。
 * @return 更新后的房间状态。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 页面进入或 Socket 重连时校准玩家在线状态，并同步到进行中的私有游戏状态。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @param socketId 当前 Socket 连接 ID。
 * @return 更新后的房间状态。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: Socket 断开后的延迟清理，把对应玩家标为离线并广播受影响房间。
 *
 * @param socketId 已断开的 Socket 连接 ID。
 * @return 需要重新广播的房间列表。
 *
 * @Date 2026-06-12 14:47
 */
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

/**
 * @Description: 校验房主和人数后开局，创建服务端私有状态并尝试写入持久化比赛记录。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @return 开局后的房间状态。
 *
 * @Date 2026-06-12 14:47
 */
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

  if (!room.players.every((player) => player.ready)) {
    throw new Error("PLAYERS_NOT_READY");
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
  room.gameState.turnDeadlineAt = createTurnDeadline(Date.now(), TURN_DEADLINE_INITIAL_DEAL_DELAY_MS);
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

/**
 * @Description: 执行房间内出牌；空牌列表只用于放弃质疑并确认待定赢家。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @param cardIds 玩家选择的手牌 ID 列表。
 * @param declaredRank 首次出牌声明的牌点。
 * @return 更新后的房间和可广播事件；确认胜利时事件为 null。
 *
 * @Date 2026-06-12 14:47
 */
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

  if (!room.gameState.lastPlay && !declaredRank) {
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

/**
 * @Description: 跳过当前玩家回合，服务端权威推进行动权并清空本轮待质疑状态。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @return 更新后的房间和跳过事件。
 *
 * @Date 2026-06-14 00:00
 */
export async function skipRoomTurn(roomId: string, user: AuthUser) {
  const room = await getRoomById(roomId);

  if (!room?.gameState) {
    throw new Error("GAME_NOT_FOUND");
  }

  const player = findPlayerByUser(room, user.id);
  if (!player) {
    throw new Error("PLAYER_NOT_IN_ROOM");
  }

  const result = skipTurn(room.gameState, player.playerId);
  room.gameState = result.state;
  room.events.push(result.event);
  room.updatedAt = Date.now();

  await saveRoom(room);

  return { room, event: result.event };
}

/**
 * @Description: 结算当前房间上一手质疑，并把结算事件写入房间事件流。
 *
 * @param roomId 房间 ID。
 * @param user 当前登录用户。
 * @return 更新后的房间和质疑结算事件。
 *
 * @Date 2026-06-12 14:47
 */
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
  if (room.gameState.status === "playing") {
    room.gameState.turnDeadlineAt = createTurnDeadline(Date.now(), TURN_DEADLINE_CHALLENGE_DELAY_MS);
  }
  room.events.push(result.event);
  room.updatedAt = Date.now();

  await saveRoom(room);

  return { room, event: result.event };
}
