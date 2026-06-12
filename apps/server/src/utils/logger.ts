/**
 * @Description: 提供服务端统一结构化日志，方便路由、Socket 和基础设施模块共享。
 *
 * @Date 2026-06-12 14:47
 */
type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

function writeLog(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    time: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(message: string, context?: LogContext) {
    writeLog("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    writeLog("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    writeLog("error", message, context);
  },
};

export function errorContext(error: unknown) {
  return {
    error: serializeError(error),
  };
}
