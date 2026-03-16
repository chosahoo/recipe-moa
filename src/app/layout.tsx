import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "레시피모아 - 유튜브 레시피 자동 정리",
  description: "유튜브 요리 영상 링크만 넣으면 AI가 재료·조리순서를 깔끔하게 정리해줘요. 카톡에 흩어진 레시피 링크, 이제 한곳에서 관리하세요!",
  openGraph: {
    title: "레시피모아 - 유튜브 레시피 자동 정리",
    description: "유튜브 요리 영상 링크만 넣으면 AI가 재료·조리순서를 깔끔하게 정리해줘요!",
    siteName: "레시피모아",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>👨‍🍳</text></svg>" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
