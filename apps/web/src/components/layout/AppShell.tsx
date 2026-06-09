/**
 * 应用壳组件：只提供统一页面内容宽度和横向裁剪。
 */
import { PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren<{
  fullBleed?: boolean;
}>;

export default function AppShell({ children, fullBleed = false }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <main
        className={
          fullBleed
            ? "w-full overflow-x-clip px-[clamp(0.25rem,0.8vw,0.5rem)] py-[clamp(0.25rem,1vh,0.5rem)]"
            : "mx-auto w-full max-w-6xl overflow-x-clip px-4 py-6"
        }
      >
        {children}
      </main>
    </div>
  );
}
