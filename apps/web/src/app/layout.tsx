/**
 * @Description: Next 根布局：设置中文页面元信息、字体变量和全局样式入口。
 *
 * @Date 2026-06-12 14:47
 */
import type { Metadata } from "next";
import AppProviders from "@/components/providers/AppProviders";
import GlobalBackground from "@/components/backgrounds/GlobalBackground";
import "./globals.css";
import "./styles/theme.css";
import "./styles/pixel-ui.css";
import "./styles/game.css";
import "./styles/motion.css";

export const metadata: Metadata = {
  title: "LIAR",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full overflow-x-hidden bg-[#0b1812] text-[#f7f0dc]">
        <GlobalBackground />
        <AppProviders>
          <div className="relative z-10 min-h-dvh">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}
