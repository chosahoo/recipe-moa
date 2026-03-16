import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "레시피모아 - 유튜브 레시피 자동 정리";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 100, marginBottom: 20 }}>🍳</div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#EA580C",
            marginBottom: 16,
          }}
        >
          레시피모아
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#78350F",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          유튜브 요리 영상 링크만 넣으면
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#78350F",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          AI가 레시피를 깔끔하게 정리해줘요
        </div>
        <div
          style={{
            marginTop: 40,
            display: "flex",
            gap: 24,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: "16px 24px",
              fontSize: 24,
              color: "#EA580C",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🥘 재료 자동 정리
          </div>
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: "16px 24px",
              fontSize: 24,
              color: "#EA580C",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            📋 조리 순서 정리
          </div>
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: "16px 24px",
              fontSize: 24,
              color: "#EA580C",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🔗 카톡 공유
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
