/**
 * Next 根布局：设置中文页面元信息、字体变量和全局样式入口。
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GlobalBackground from "@/components/backgrounds/GlobalBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "lie",
  description: "实时多人唬牌 Web 游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full overflow-x-hidden bg-[#0b1812] text-[#f7f0dc]">
        <GlobalBackground />
        <div className="relative z-10 min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
