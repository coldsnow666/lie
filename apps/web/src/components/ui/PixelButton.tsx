/**
 * 像素风按钮：统一游戏内长条按钮的街机风格、底部压边阴影和按压反馈。
 */
"use client";

import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

type PixelButtonVariant = "primary" | "secondary" | "danger" | "accent" | "ghost";
type PixelButtonSize = "sm" | "md" | "lg";

const variantClassMap: Record<PixelButtonVariant, string> = {
  primary:
    "[--px-button-bg-color:#f39b14] [--px-button-hover-bg-color:#ffab27] [--px-button-border-color:#ffe7a8] [--px-button-shadow-color:#8f5200] text-[#fff9e8]",
  secondary:
    "[--px-button-bg-color:#299f8d] [--px-button-hover-bg-color:#31b09d] [--px-button-border-color:#b8fff3] [--px-button-shadow-color:#12594f] text-[#f2fffb]",
  danger:
    "[--px-button-bg-color:#d95f4d] [--px-button-hover-bg-color:#ea705d] [--px-button-border-color:#ffc2bc] [--px-button-shadow-color:#7e2f22] text-[#fff6f3]",
  accent:
    "[--px-button-bg-color:#d48516] [--px-button-hover-bg-color:#e39424] [--px-button-border-color:#d9efff] [--px-button-shadow-color:#8b4d00] text-[#fffaf0]",
  ghost:
    "[--px-button-bg-color:#243d3d] [--px-button-hover-bg-color:#2b4848] [--px-button-border-color:#f5f1df] [--px-button-shadow-color:#101a1d] text-[#fff8e6]",
};

const sizeClassMap: Record<PixelButtonSize, string> = {
  sm: "h-10 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-sm sm:text-base",
};

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: PixelButtonVariant;
  size?: PixelButtonSize;
  fullWidth?: boolean;
  asChild?: boolean;
};

export default function PixelButton({
  asChild = false,
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  ...props
}: PixelButtonProps) {
  const pixelButtonClassName = [
        "lie-pixel-button relative isolate inline-flex cursor-pointer items-center justify-center gap-2 overflow-visible border-0 bg-transparent font-black tracking-[0.08em] transition-all duration-150",
        "outline-none focus-visible:-translate-y-px focus-visible:ring-2 focus-visible:ring-[#fff6cf]/70",
        "active:translate-y-[3px] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        sizeClassMap[size],
        variantClassMap[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ");

  if (asChild && isValidElement<{ children?: ReactNode; className?: string }>(children)) {
    const child = children as ReactElement<{ children?: ReactNode; className?: string }>;

    return cloneElement(child, {
      className: [pixelButtonClassName, child.props.className].filter(Boolean).join(" "),
      children: <span className="lie-pixel-button-content">{child.props.children}</span>,
    } as { children: ReactNode; className: string });
  }

  return (
    <button
      type={type}
      className={pixelButtonClassName}
      {...props}
    >
      <span className="lie-pixel-button-content">{children}</span>
    </button>
  );
}
