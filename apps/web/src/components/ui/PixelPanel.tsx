/**
 * @Description: 像素风面板：统一信息卡、侧栏和表单容器的像素圆角单边框质感。
 *
 * @Date 2026-06-12 14:47
 */
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

type PixelPanelTone = "forest" | "dark" | "highlight" | "danger";

const PANEL_BORDER_COLOR = "#c4c2d7";
const PANEL_BORDER_WIDTH = "2";
const PANEL_BACKGROUND_COLOR = "#3d474c";

const toneStyleMap: Record<PixelPanelTone, CSSProperties> = {
  forest: {
    boxShadow: "-4px 10px 0 #1b252b, -8px 18px 18px rgba(0, 0, 0, 0.32)",
    "--px-bg-color": PANEL_BACKGROUND_COLOR,
    "--px-bg-shadow-color": "#1b252b",
    "--px-border-color": PANEL_BORDER_COLOR,
    "--px-border": PANEL_BORDER_WIDTH,
    "--px-border-radius": "12",
    "--px-border-radius-lt": "12",
    "--px-border-radius-rt": "12",
    "--px-border-radius-lb": "12",
    "--px-border-radius-rb": "12",
    "--panel-text": "#f7f0dc",
  } as CSSProperties,
  dark: {
    boxShadow: "-4px 10px 0 #182126, -8px 18px 18px rgba(0, 0, 0, 0.34)",
    "--px-bg-color": PANEL_BACKGROUND_COLOR,
    "--px-bg-shadow-color": "#182126",
    "--px-border-color": PANEL_BORDER_COLOR,
    "--px-border": PANEL_BORDER_WIDTH,
    "--px-border-radius": "12",
    "--px-border-radius-lt": "12",
    "--px-border-radius-rt": "12",
    "--px-border-radius-lb": "12",
    "--px-border-radius-rb": "12",
    "--panel-text": "#f7f0dc",
  } as CSSProperties,
  highlight: {
    boxShadow: "-4px 10px 0 #1d272d, -8px 18px 18px rgba(0, 0, 0, 0.36)",
    "--px-bg-color": PANEL_BACKGROUND_COLOR,
    "--px-bg-shadow-color": "#1d272d",
    "--px-border-color": PANEL_BORDER_COLOR,
    "--px-border": PANEL_BORDER_WIDTH,
    "--px-border-radius": "12",
    "--px-border-radius-lt": "12",
    "--px-border-radius-rt": "12",
    "--px-border-radius-lb": "12",
    "--px-border-radius-rb": "12",
    "--panel-text": "#fff6cf",
  } as CSSProperties,
  danger: {
    boxShadow: "-4px 10px 0 #2a1717, -8px 18px 18px rgba(0, 0, 0, 0.36)",
    "--px-bg-color": PANEL_BACKGROUND_COLOR,
    "--px-bg-shadow-color": "#2a1717",
    "--px-border-color": PANEL_BORDER_COLOR,
    "--px-border": PANEL_BORDER_WIDTH,
    "--px-border-radius": "12",
    "--px-border-radius-lt": "12",
    "--px-border-radius-rt": "12",
    "--px-border-radius-lb": "12",
    "--px-border-radius-rb": "12",
    "--panel-text": "#ffe8e6",
  } as CSSProperties,
};

type PixelPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: PixelPanelTone;
  padding?: "sm" | "md" | "lg";
};

const paddingClassMap = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const PixelPanel = forwardRef<HTMLDivElement, PixelPanelProps>(function PixelPanel(
  {
    children,
    className = "",
    tone = "forest",
    padding = "md",
    style,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        ...toneStyleMap[tone],
        ...style,
      }}
      className={[
        "lie-pixel-panel relative isolate overflow-hidden text-[color:var(--panel-text)]",
        paddingClassMap[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span aria-hidden className="lie-pixel-panel-border" />
      {children}
    </div>
  );
});

export default PixelPanel;
