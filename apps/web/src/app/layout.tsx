/**
 * Next 根布局：设置中文页面元信息、字体变量和全局样式入口。
 */
import type { Metadata } from "next";
import GlobalBackground from "@/components/backgrounds/GlobalBackground";
import { RouteLoadingProvider } from "@/components/loading/RouteLoadingProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "liar",
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
        <RouteLoadingProvider>
          <div className="relative z-10 min-h-dvh">{children}</div>
        </RouteLoadingProvider>
      </body>
    </html>
  );
}
