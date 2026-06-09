/**
 * HTTP 响应工具：统一返回 code/data 结构，前三位对齐 HTTP，后两位做业务细分。
 */
import type { FastifyReply } from "fastify";

export type ApiErrorPayload = {
  code: number;
  message: string;
};

function toHttpStatus(code: number) {
  return code >= 1000 ? Math.trunc(code / 100) : code;
}

export function sendOk<T>(reply: FastifyReply, data: T, code = 20000) {
  return reply.code(toHttpStatus(code)).send({
    code,
    data,
  });
}

export function sendError(reply: FastifyReply, error: ApiErrorPayload) {
  return reply.code(toHttpStatus(error.code)).send({
    code: error.code,
    data: {
      message: error.message,
    },
  });
}
