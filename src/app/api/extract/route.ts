import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY?.replace(/\s/g, "") });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY?.replace(/\s/g, "") || "";

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
  // 5초 타임아웃으로 자막 시도 (ko만 시도 — 요리 영상은 대부분 한국어)
  try {
    const result = await Promise.race([
      YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    if (result.length > 0) return result.map((t) => t.text).join(" ");
  } catch {
    // ko 실패 시 auto 한번 더 시도
    try {
      const result = await Promise.race([
        YoutubeTranscript.fetchTranscript(videoId),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
      ]);
      if (result.length > 0) return result.map((t) => t.text).join(" ");
    } catch {
      // 자막 없음
    }
  }
  return "";
}

async function getDescriptionAndChannel(videoId: string): Promise<{ description: string; channelId: string; error?: string }> {
  if (!YOUTUBE_API_KEY) return { description: "", channelId: "", error: "YOUTUBE_API_KEY not set" };

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) {
      const text = await res.text();
      return { description: "", channelId: "", error: `videos API ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    const snippet = data.items?.[0]?.snippet;
    return {
      description: snippet?.description || "",
      channelId: snippet?.channelId || "",
    };
  } catch (e) {
    return { description: "", channelId: "", error: `videos API error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function getPinnedComment(videoId: string, channelId: string): Promise<{ comment: string; error?: string }> {
  if (!YOUTUBE_API_KEY) return { comment: "", error: "YOUTUBE_API_KEY not set" };

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=5&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) {
      const text = await res.text();
      return { comment: "", error: `comments API ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      return { comment: "", error: "no comments found" };
    }

    // 채널 주인(업로더)의 댓글만 확인 (고정핀 댓글)
    for (const item of data.items) {
      const snippet = item.snippet?.topLevelComment?.snippet;
      if (!snippet) continue;
      const authorChannelId = snippet.authorChannelId?.value || "";
      // 업로더 댓글만 사용
      if (channelId && authorChannelId !== channelId) continue;
      const comment = snippet.textDisplay || "";
      if (comment.length > 30) {
        return { comment: comment.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ") };
      }
    }
    return { comment: "", error: `checked ${data.items.length} comments, no channel owner comment found (channelId: ${channelId})` };
  } catch (e) {
    return { comment: "", error: `comments API error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function summarizeRecipe(text: string, title: string, source: string) {
  const sourceLabel = source === "subtitle" ? "자막" : source === "description" ? "설명란" : "댓글";

  const prompt = `당신은 요리 레시피 정리 전문가입니다.
아래는 "${title}"이라는 유튜브 요리 영상의 ${sourceLabel} 텍스트입니다.
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

만약 텍스트에 요리 레시피 정보가 없다면, 빈 JSON을 반환하세요: {"food_name":"","ingredients":[],"steps":[],"tips":"","category":"기타","servings":1}

JSON만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.

텍스트:
${text.slice(0, 8000)}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = response.choices[0].message.content?.trim() || "";
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 응답을 파싱할 수 없습니다.");

  const data = JSON.parse(jsonMatch[0]);

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

    const debug: string[] = [];

    // 영상 정보 + 설명란/채널ID를 먼저 가져옴 (빠름)
    const [videoInfo, descResult] = await Promise.all([
      getVideoInfo(videoId),
      getDescriptionAndChannel(videoId),
    ]);
    const { description, channelId } = descResult;
    if (descResult.error) debug.push(`desc: ${descResult.error}`);
    else debug.push(`desc: ${description.length}자, channelId: ${channelId}`);

    // 채널 주인의 고정핀 댓글 확인
    const commentResult = await getPinnedComment(videoId, channelId);
    const comment = commentResult.comment;
    if (commentResult.error) debug.push(`comment: ${commentResult.error}`);
    else debug.push(`comment: ${comment.length}자`);

    // 레시피 품질 검증: 재료 2개 이상 + 조리 단계 1개 이상
    const isValidRecipe = (r: { ingredients?: string[]; steps?: string[] }) =>
      r.ingredients && r.ingredients.length >= 2 && r.steps && r.steps.length >= 1;

    // 1. 설명란 + 댓글 먼저 시도 (빠름)
    const combined = [description, comment].filter(Boolean).join("\n\n");
    debug.push(`combined: ${combined.length}자`);
    if (combined.length > 30) {
      try {
        const source = comment ? "comment" : "description";
        const recipe = await summarizeRecipe(combined, videoInfo.title, source);
        debug.push(`recipe from ${source}: food=${recipe.food_name}, ing=${recipe.ingredients?.length}, steps=${recipe.steps?.length}`);
        if (recipe.food_name && isValidRecipe(recipe)) {
          return NextResponse.json({
            video_id: videoId,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            recipe,
            method: source,
            debug,
          });
        }
        debug.push("recipe validation failed, trying transcript");
      } catch (e) {
        debug.push(`summarize error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. 자막 시도 (느릴 수 있음)
    const transcript = await getTranscript(videoId);
    debug.push(`transcript: ${transcript.length}자`);
    if (transcript) {
      const recipe = await summarizeRecipe(transcript, videoInfo.title, "subtitle");
      return NextResponse.json({
        video_id: videoId,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        recipe,
        method: "subtitle",
        debug,
      });
    }

    // 3. 모두 실패
    debug.push("all methods failed");
    return NextResponse.json({
      video_id: videoId,
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail,
      method: "no_recipe",
      debug,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
