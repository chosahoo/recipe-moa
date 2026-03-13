import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

async function getVideoInfo(videoId: string) {
  const encodedUrl = encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  );
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodedUrl}&format=json`
  );
  if (!res.ok) throw new Error("영상을 찾을 수 없습니다.");
  const data = await res.json();
  return {
    title: data.title || "",
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

async function getTranscript(videoId: string): Promise<string> {
  // 한국어 → 영어 → 언어 미지정(자동 생성 자막) 순으로 시도
  const attempts = [
    { lang: "ko" },
    { lang: "en" },
    {},
  ];

  for (const config of attempts) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, config);
      return transcript.map((t) => t.text).join(" ");
    } catch {
      continue;
    }
  }

  throw new Error("자막을 가져올 수 없습니다. 자막이 없는 영상일 수 있어요.");
}

async function summarizeRecipe(transcript: string, title: string) {
  const prompt = `당신은 요리 레시피 정리 전문가입니다.
아래는 "${title}"이라는 유튜브 요리 영상의 자막 텍스트입니다.
이 텍스트를 분석해서 정확히 아래 JSON 형식으로 변환해주세요.

반드시 아래 예시와 동일한 구조로 출력하세요:
{
  "food_name": "김치찌개",
  "category": "국/찌개",
  "servings": 2,
  "ingredients": ["돼지고기 목살 500g", "김치 1포기", "두부 1모"],
  "steps": ["돼지고기를 한입 크기로 썬다.", "냄비에 기름을 두르고 고기를 볶는다.", "김치를 넣고 함께 볶는다.", "물을 넣고 끓인다.", "두부를 넣고 5분 더 끓인다."],
  "tips": "김치는 잘 익은 묵은지를 쓰면 더 맛있다."
}

중요 규칙:
- food_name: 문자열. 음식 이름 (한국어)
- category: 문자열. 반드시 다음 중 하나만 선택: "밥/면", "국/찌개", "반찬", "볶음/구이", "디저트/간식", "양식", "중식", "일식", "기타"
- servings: 숫자. 이 레시피의 기준 인분 수 (영상에서 언급된 인분, 없으면 재료 양으로 추정)
- ingredients: 문자열 배열. 재료와 분량 (예: "돼지고기 목살 500g")
- steps: 문자열 배열. 각 조리 단계를 하나씩 배열 원소로. 절대 하나의 문자열로 합치지 마세요.
- tips: 문자열. 요리 꿀팁 (없으면 빈 문자열 "")

JSON만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.

자막 텍스트:
${transcript.slice(0, 8000)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content?.trim() || "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 응답을 파싱할 수 없습니다.");

  const data = JSON.parse(jsonMatch[0]);

  // steps나 ingredients가 문자열로 온 경우 보정
  if (typeof data.steps === "string") {
    data.steps = data.steps
      .split(/\d+\.\s*/)
      .filter((s: string) => s.trim());
  }
  if (typeof data.ingredients === "string") {
    data.ingredients = data.ingredients
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json(
        { detail: "URL이 필요합니다." },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { detail: "유효한 YouTube URL이 아닙니다." },
        { status: 400 }
      );
    }

    const videoInfo = await getVideoInfo(videoId);
    const transcript = await getTranscript(videoId);
    const recipe = await summarizeRecipe(transcript, videoInfo.title);

    return NextResponse.json({
      video_id: videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      recipe,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
