/**
 * @Description: 验证房间服务在对局中的关键一致性约束。
 *
 * @Date 2026-06-12 14:47
 */
import { afterAll, describe, expect, it } from "vitest";
import type { AuthUser } from "../auth/token";
import { prisma } from "../db/prisma";
import { createRoom, joinRoom, leaveRoom, listPublicRooms, startGame } from "./room.service";

const owner: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "owner@example.com",
  nickname: "房主",
  avatarUrl: null,
};

const guest: AuthUser = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "guest@example.com",
  nickname: "玩家",
  avatarUrl: null,
};

describe("room service", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blocks leaving while a game is in progress", async () => {
    const roomCode = `T${Date.now().toString().slice(-5)}`;
    const room = await createRoom(owner, {
      roomCode,
      maxPlayers: 2,
    });

    await joinRoom(room.code, guest);
    await startGame(room.id, owner);

    await expect(leaveRoom(room.id, guest)).rejects.toThrow("ROOM_IN_GAME");
  });

  it("does not expose in-progress rooms in the lobby room list", async () => {
    const roomCode = `P${Date.now().toString().slice(-5)}`;
    const room = await createRoom(owner, {
      roomCode,
      maxPlayers: 2,
    });

    await joinRoom(room.code, guest);
    await startGame(room.id, owner);

    const rooms = await listPublicRooms();

    expect(rooms.some((publicRoom) => publicRoom.id === room.id)).toBe(false);
  });
});
