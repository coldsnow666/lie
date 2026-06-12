/**
 * @Description: 像素风消息组件：统一表单校验和页面提示的顶部弹出
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useEffect, useRef, useSyncExternalStore, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PixelMessageTone = "error" | "info" | "success";
type PixelMessagePlacement = "top" | "inline";
type PixelMessagePhase = "shown" | "leaving";
type PixelMessageEntry = {
  id: number;
  children: ReactNode;
  className: string;
  phase: PixelMessagePhase;
  tone: PixelMessageTone;
};

const PIXEL_MESSAGE_ROOT_ID = "lie-pixel-message-root";
const PIXEL_MESSAGE_LIMIT = 3;
const PIXEL_MESSAGE_HOLD_MS = 1000;
const PIXEL_MESSAGE_EXIT_MS = 180;
const EMPTY_MESSAGES: PixelMessageEntry[] = [];
const messageStoreListeners = new Set<() => void>();
const messageTimers = new Map<number, { leaveTimer: number; removeTimer: number }>();
let nextMessageId = 1;
let pixelMessages: PixelMessageEntry[] = EMPTY_MESSAGES;

const toneClassMap: Record<PixelMessageTone, string> = {
  error:
    "border-[#ce7a77] bg-[#4a1f1d]/92 text-[#ffe6e3] shadow-[inset_0_1px_0_rgba(255,220,216,0.14),0_0_0_2px_rgba(24,8,8,0.45),0_6px_0_rgba(28,10,10,0.28)]",
  info:
    "border-[#718f92] bg-[#1a2c30]/92 text-[#eef8f4] shadow-[inset_0_1px_0_rgba(214,232,232,0.12),0_0_0_2px_rgba(7,13,13,0.45),0_6px_0_rgba(8,14,15,0.28)]",
  success:
    "border-[#7db68b] bg-[#1e3324]/92 text-[#ecf8ee] shadow-[inset_0_1px_0_rgba(220,242,224,0.12),0_0_0_2px_rgba(7,13,8,0.45),0_6px_0_rgba(8,14,9,0.28)]",
};

function getPixelMessageRoot() {
  let root = document.getElementById(PIXEL_MESSAGE_ROOT_ID);

  if (!root) {
    root = document.createElement("div");
    root.id = PIXEL_MESSAGE_ROOT_ID;
    document.body.appendChild(root);
  }

  root.className =
    "pointer-events-none fixed inset-x-0 top-4 z-[120] flex flex-col items-center gap-3 px-4 sm:top-6";

  return root;
}

function emitMessageStoreChange() {
  messageStoreListeners.forEach((listener) => listener());
}

function subscribeMessageStore(listener: () => void) {
  messageStoreListeners.add(listener);

  return () => {
    messageStoreListeners.delete(listener);
  };
}

function getMessageStoreSnapshot() {
  return pixelMessages;
}

function getServerMessageStoreSnapshot() {
  return EMPTY_MESSAGES;
}

function updatePixelMessagePhase(messageId: number, phase: PixelMessagePhase) {
  pixelMessages = pixelMessages.map((message) => (message.id === messageId ? { ...message, phase } : message));
  emitMessageStoreChange();
}

function removePixelMessage(messageId: number) {
  const timers = messageTimers.get(messageId);

  if (timers) {
    window.clearTimeout(timers.leaveTimer);
    window.clearTimeout(timers.removeTimer);
    messageTimers.delete(messageId);
  }

  pixelMessages = pixelMessages.filter((message) => message.id !== messageId);
  emitMessageStoreChange();
}

/**
 * @Description: 把顶部消息加入全局队列，并为进入离场阶段和最终移除分别设置计时器。
 *
 * @param message 不含 ID 和阶段的消息内容。
 * @return 无。
 *
 * @Date 2026-06-12 14:47
 */
function enqueuePixelMessage(message: Omit<PixelMessageEntry, "id" | "phase">) {
  const messageId = nextMessageId;
  nextMessageId += 1;

  const nextMessages = [...pixelMessages, { ...message, id: messageId, phase: "shown" as const }];
  const removedMessages = nextMessages.slice(0, Math.max(0, nextMessages.length - PIXEL_MESSAGE_LIMIT));
  pixelMessages = nextMessages.slice(-PIXEL_MESSAGE_LIMIT);

  removedMessages.forEach((removedMessage) => {
    const timers = messageTimers.get(removedMessage.id);

    if (timers) {
      window.clearTimeout(timers.leaveTimer);
      window.clearTimeout(timers.removeTimer);
      messageTimers.delete(removedMessage.id);
    }
  });

  emitMessageStoreChange();

  const leaveTimer = window.setTimeout(() => updatePixelMessagePhase(messageId, "leaving"), PIXEL_MESSAGE_HOLD_MS);
  const removeTimer = window.setTimeout(() => removePixelMessage(messageId), PIXEL_MESSAGE_HOLD_MS + PIXEL_MESSAGE_EXIT_MS);

  messageTimers.set(messageId, { leaveTimer, removeTimer });
}

/**
 * @Description: 显示一条顶部像素提示；服务端渲染阶段会自动跳过。
 *
 * @param children 提示内容。
 * @param options 样式类名和提示语气。
 * @return 无。
 *
 * @Date 2026-06-12 14:47
 */
export function showPixelMessage(
  children: ReactNode,
  options: {
    className?: string;
    tone?: PixelMessageTone;
  } = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  enqueuePixelMessage({
    children,
    className: options.className ?? "",
    tone: options.tone ?? "error",
  });
}

function subscribeMounted(listener: () => void) {
  const timer = window.setTimeout(listener, 0);

  return () => window.clearTimeout(timer);
}

function getMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

type PixelMessageProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: PixelMessageTone;
  placement?: PixelMessagePlacement;
};

type PixelMessageFrameProps = {
  children: ReactNode;
  className?: string;
  htmlProps?: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;
  phase: PixelMessagePhase;
  placement: PixelMessagePlacement;
  tone: PixelMessageTone;
};

function PixelMessageFrame({
  children,
  className = "",
  htmlProps = {},
  phase,
  placement,
  tone,
}: PixelMessageFrameProps) {
  return (
    <div
      className={[
        placement === "top" ? "lie-pixel-message" : "",
        "rounded-[0.7rem] border-2 px-4 py-3 text-sm leading-6 tracking-[0.04em] backdrop-blur-[2px]",
        placement === "top" ? "w-fit max-w-[min(34rem,calc(100vw-2rem))] break-words" : "w-full",
        toneClassMap[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-message-state={phase}
      aria-live={tone === "error" ? "assertive" : "polite"}
      role={tone === "error" ? "alert" : "status"}
      {...htmlProps}
    >
      {children}
    </div>
  );
}

/**
 * @Description: 订阅全局消息队列并用 Portal 挂到 body 顶部，避免被页面局部布局裁切。
 *
 * @return 顶部消息 Portal。
 *
 * @Date 2026-06-12 14:47
 */
export function PixelMessageHost() {
  const mounted = useSyncExternalStore(subscribeMounted, getMountedSnapshot, getServerMountedSnapshot);
  const messages = useSyncExternalStore(subscribeMessageStore, getMessageStoreSnapshot, getServerMessageStoreSnapshot);

  if (!mounted || messages.length === 0) {
    return null;
  }

  return createPortal(
    <>
      {messages.map((message) => (
        <PixelMessageFrame
          key={message.id}
          className={message.className}
          phase={message.phase}
          placement="top"
          tone={message.tone}
        >
          {message.children}
        </PixelMessageFrame>
      ))}
    </>,
    getPixelMessageRoot(),
  );
}

export default function PixelMessage({
  children,
  className = "",
  tone = "error",
  placement = "top",
  ...props
}: PixelMessageProps) {
  const messageKeyRef = useRef("");

  useEffect(() => {
    if (placement !== "top") {
      return;
    }

    const messageKey = `${tone}|${className}|${typeof children === "string" ? children : ""}`;

    if (messageKeyRef.current === messageKey) {
      return;
    }

    messageKeyRef.current = messageKey;

    showPixelMessage(children, { className, tone });
  }, [children, className, placement, tone]);

  if (placement === "inline") {
    return (
      <PixelMessageFrame
        className={className}
        htmlProps={props}
        phase="shown"
        placement="inline"
        tone={tone}
      >
        {children}
      </PixelMessageFrame>
    );
  }

  return null;
}
