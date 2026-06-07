/**
 * 应用壳组件：提供统一顶部栏和页面内容宽度。
 */
import Link from "next/link";
import { PropsWithChildren } from "react";
import { Club, Spade } from "lucide-react";

type AppShellProps = PropsWithChildren<{
  title?: string;
  actions?: React.ReactNode;
}>;

export default function AppShell({ title = "唬牌", actions, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#23513a_0,#10271d_40%,#0a1511_100%)]">
      <header className="border-b border-white/10 bg-black/20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded border border-[#d7bc72]/60 bg-[#15281f] text-[#f2df9e]">
              <Spade size={20} />
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-normal text-[#fff6cf]">{title}</span>
              <span className="flex items-center gap-1 text-xs text-[#c6b889]">
                <Club size={12} /> Cheat / Liar
              </span>
            </span>
          </Link>
          {actions}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
