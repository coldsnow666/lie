/**
 * 接口响应协议：统一维护前后端共用的响应码和基础响应类型。
 */
export const API_RESPONSE_CODE = {
  OK: 20000,
  VALIDATION_ERROR: 40000,
  ROOM_PARAMS_INVALID: 40010,
  ROOM_CODE_INVALID: 40011,
  UNAUTHORIZED: 40100,
  INVALID_EMAIL_OR_PASSWORD: 40101,
  AUTH_EXPIRED: 40102,
  ROOM_NOT_FOUND: 40411,
  EMAIL_ALREADY_REGISTERED: 40901,
  ROOM_CODE_EXISTS: 40911,
  ROOM_NOT_WAITING: 40912,
  ROOM_FULL: 40913,
  UNKNOWN_ERROR: 50000,
  DATABASE_UNAVAILABLE: 50301,
  DATABASE_AUTH_FAILED: 50302,
  DATABASE_NOT_FOUND: 50303,
  DATABASE_SCHEMA_MISSING: 50304,
} as const;

export type ApiResponseCode = (typeof API_RESPONSE_CODE)[keyof typeof API_RESPONSE_CODE];

export type ApiErrorData = {
  message: string;
};

export type ApiEnvelope<T> = {
  code: ApiResponseCode;
  data: T;
};

export function isErrorResponseCode(code: number) {
  return code >= API_RESPONSE_CODE.VALIDATION_ERROR;
}
