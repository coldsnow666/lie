/**
 * 应用壳组件：只提供统一页面内容宽度和横向裁剪。
 */
import { PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren;

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <main className="mx-auto w-full max-w-6xl overflow-x-clip px-4 py-6">
        {children}
      </main>
    </div>
  );
}
