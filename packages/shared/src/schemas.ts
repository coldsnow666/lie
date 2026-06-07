/**
 * 共享 Zod schema：统一前后端 REST 与 Socket payload 的运行时校验。
 */
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email();
export const nicknameSchema = z.string().trim().min(2).max(16);
export const passwordSchema = z.string().min(8);
export const roomCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/);
export const cardIdSchema = z.string().min(2).max(3);

export const registerSchema = z.object({
  email: emailSchema,
  nickname: nicknameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const roomCreateSchema = z.object({
  roomCode: roomCodeSchema.optional(),
});

export const roomJoinSchema = z.object({
  roomCode: roomCodeSchema,
});

export const roomIdSchema = z.object({
  roomId: z.string().uuid(),
});

export const roomReadySchema = roomIdSchema.extend({
  ready: z.boolean(),
});

export const playCardsSchema = roomIdSchema.extend({
  cardIds: z.array(cardIdSchema).min(1).max(4),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomJoinInput = z.infer<typeof roomJoinSchema>;
export type RoomReadyInput = z.infer<typeof roomReadySchema>;
export type PlayCardsInput = z.infer<typeof playCardsSchema>;
