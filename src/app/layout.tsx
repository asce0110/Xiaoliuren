import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "小六壬在线排盘 · 时辰吉凶推演",
  description:
    "新国风小六壬在线排盘工具，依据农历干支自动推演大安、留连、速喜、赤口、小吉、空亡六宫吉凶。",
  keywords: ["小六壬", "排盘", "时辰吉凶", "占卜", "农历", "国风"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
