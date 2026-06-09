/**
 * 像素风消息组件：统一表单校验和页面提示的顶部弹出与内嵌反馈样式。
 */
"use client";

import { useSyncExternalStore, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PixelMessageTone = "error" | "info" | "success";
type PixelMessagePlacement = "top" | "inline";

const toneClassMap: Record<PixelMessageTone, string> = {
  error:
    "border-[#ce7a77] bg-[#4a1f1d]/92 text-[#ffe6e3] shadow-[inset_0_1px_0_rgba(255,220,216,0.14),0_0_0_2px_rgba(24,8,8,0.45),0_6px_0_rgba(28,10,10,0.28)]",
  info:
    "border-[#718f92] bg-[#1a2c30]/92 text-[#eef8f4] shadow-[inset_0_1px_0_rgba(214,232,232,0.12),0_0_0_2px_rgba(7,13,13,0.45),0_6px_0_rgba(8,14,15,0.28)]",
  success:
    "border-[#7db68b] bg-[#1e3324]/92 text-[#ecf8ee] shadow-[inset_0_1px_0_rgba(220,242,224,0.12),0_0_0_2px_rgba(7,13,8,0.45),0_6px_0_rgba(8,14,9,0.28)]",
};

type PixelMessageProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: PixelMessageTone;
  placement?: PixelMessagePlacement;
};

export default function PixelMessage({
  children,
  className = "",
  tone = "error",
  placement = "top",
  ...props
}: PixelMessageProps) {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const content = (
    <div
      className={[
        "rounded-[0.7rem] border-2 px-4 py-3 text-sm leading-6 tracking-[0.04em] backdrop-blur-[2px]",
        placement === "top"
          ? "w-full max-w-[min(34rem,calc(100vw-2rem))] [animation:lie-pixel-message-drop_180ms_steps(6,end)]"
          : "w-full",
        toneClassMap[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live={tone === "error" ? "assertive" : "polite"}
      role={tone === "error" ? "alert" : "status"}
      {...props}
    >
      {children}
    </div>
  );

  if (placement === "inline") {
    return content;
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4 sm:top-6">
      {content}
    </div>,
    document.body,
  );
}
