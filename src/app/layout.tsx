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
  keywords: ["레시피", "유튜브 레시피", "요리", "레시피 정리", "레시피모아", "요리 레시피 추출", "유튜브 요리"],
  openGraph: {
    title: "레시피모아 - 유튜브 레시피 자동 정리",
    description: "유튜브 요리 영상 링크만 넣으면 AI가 재료·조리순서를 깔끔하게 정리해줘요!",
    siteName: "레시피모아",
    url: "https://xn--om2b21rhzo.site",
    locale: "ko_KR",
    type: "website",
  },
  alternates: {
    canonical: "https://xn--om2b21rhzo.site",
  },
  verification: {
    google: "gPGMXrRNYxEYJWFUzupbu3DCVesA2x5ixHYuGU-fY4M",
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
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-W8VGJW1C3T"></script>
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-W8VGJW1C3T');` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
