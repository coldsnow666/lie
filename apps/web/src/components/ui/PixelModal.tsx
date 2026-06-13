/**
 * @Description: 像素风弹窗：提供卡片质感的遮罩弹层、标题区、关闭按钮和入场动画。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import PixelButton from "@/components/ui/PixelButton";
import PixelPanel from "@/components/ui/PixelPanel";

const MODAL_EXIT_DURATION = 220;

type PixelModalProps = {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  className?: string;
  closeDisabled?: boolean;
};

export default function PixelModal({ children, title, onClose, className = "", closeDisabled = false }: PixelModalProps) {
  const titleId = useId();
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    if (closing || closeDisabled) {
      return;
    }

    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, MODAL_EXIT_DURATION);
  }, [closeDisabled, closing, onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [requestClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className="lie-pixel-modal-overlay fixed inset-0 z-[200] flex items-center justify-center bg-black/62 px-4 py-6 backdrop-blur-sm"
      data-modal-state={closing ? "closing" : "open"}
      onClick={requestClose}
    >
      <PixelPanel
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tone="highlight"
        padding="lg"
        bordered
        roomy={false}
        className={["lie-pixel-modal-panel w-full max-w-[min(28rem,100%)] shadow-2xl shadow-black/60", className]
          .filter(Boolean)
          .join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid grid-cols-[2.375rem_minmax(0,1fr)_2.375rem] items-start gap-3">
          <div aria-hidden="true" />
          <div className="min-w-0 text-center text-[#fff6cf]">
            <h2 id={titleId} className="truncate text-xl font-black">
              {title}
            </h2>
          </div>
          <PixelButton
            onClick={requestClose}
            disabled={closeDisabled}
            variant="ghost"
            size="sm"
            square
            className="h-9 w-9.5 shrink-0"
            aria-label="关闭弹窗"
          >
            <X size={16} />
          </PixelButton>
        </div>
        {children}
      </PixelPanel>
    </div>
  );
}
