/**
 * @Description: 像素风按钮：统一游戏内无边框长条按钮的街机风格和按压反馈。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

type PixelButtonVariant = "primary" | "secondary" | "danger" | "accent" | "ghost";
type PixelButtonSize = "sm" | "md" | "lg";

const variantClassMap: Record<PixelButtonVariant, string> = {
  primary:
    "[--px-button-bg-color:#f59a0b] [--px-button-hover-bg-color:#ffac1d] [--px-button-top-color:#ffc044] [--px-button-bottom-color:#c96500] [--px-button-shadow-color:#182536] text-[#fff9e8]",
  secondary:
    "[--px-button-bg-color:#279886] [--px-button-hover-bg-color:#32aa96] [--px-button-top-color:#61d7c4] [--px-button-bottom-color:#166458] [--px-button-shadow-color:#182536] text-[#f2fffb]",
  danger:
    "[--px-button-bg-color:#d95f4d] [--px-button-hover-bg-color:#ec725f] [--px-button-top-color:#ff9a8b] [--px-button-bottom-color:#943426] [--px-button-shadow-color:#182536] text-[#fff6f3]",
  accent:
    "[--px-button-bg-color:#d98413] [--px-button-hover-bg-color:#ec9624] [--px-button-top-color:#ffbd43] [--px-button-bottom-color:#9b5500] [--px-button-shadow-color:#182536] text-[#fffaf0]",
  ghost:
    "[--px-button-bg-color:#2b4644] [--px-button-hover-bg-color:#365452] [--px-button-top-color:#54736f] [--px-button-bottom-color:#172b2a] [--px-button-shadow-color:#182536] text-[#fff8e6]",
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
  square?: boolean;
};

function hasTextContent(node: ReactNode): boolean {
  if (typeof node === "string") {
    return node.trim().length > 0;
  }

  if (typeof node === "number") {
    return true;
  }

  if (Array.isArray(node)) {
    return node.some(hasTextContent);
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return hasTextContent(node.props.children);
  }

  return false;
}

function stripIconOnlyNodes(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map(stripIconOnlyNodes).filter(Boolean);
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (!hasTextContent(node.props.children)) {
      return null;
    }

    return cloneElement(node, {
      children: stripIconOnlyNodes(node.props.children),
    } as { children: ReactNode });
  }

  return node;
}

export default function PixelButton({
  asChild = false,
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  square = false,
  type = "button",
  ...props
}: PixelButtonProps) {
  const visibleChildren = hasTextContent(children) ? stripIconOnlyNodes(children) : children;
  const pixelButtonClassName = [
        "lie-pixel-button relative isolate inline-flex cursor-pointer items-center justify-center gap-2 overflow-visible border-0 bg-transparent font-black tracking-[0.04em] transition-all duration-150",
        "outline-none focus-visible:-translate-y-px focus-visible:ring-2 focus-visible:ring-[#fff6cf]/70",
        "disabled:cursor-not-allowed disabled:opacity-50",
        sizeClassMap[size],
        variantClassMap[variant],
        square ? "lie-pixel-button-square aspect-square min-w-0 px-0" : "",
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ");

  if (asChild && isValidElement<{ children?: ReactNode; className?: string }>(children)) {
    const child = children as ReactElement<{ children?: ReactNode; className?: string }>;

    return cloneElement(child, {
      className: [pixelButtonClassName, child.props.className].filter(Boolean).join(" "),
      children: <span className="lie-pixel-button-content">{visibleChildren}</span>,
    } as { children: ReactNode; className: string });
  }

  return (
    <button
      type={type}
      className={pixelButtonClassName}
      {...props}
    >
      <span className="lie-pixel-button-content">{visibleChildren}</span>
    </button>
  );
}
