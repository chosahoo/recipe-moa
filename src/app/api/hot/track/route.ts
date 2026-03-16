import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "") || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s/g, "") || "";

const ANONYMOUS_USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
let anonymousUserEnsured = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAnonymousUser(supabase: any) {
  if (anonymousUserEnsured) return;
  try {
    // 익명 유저가 없으면 생성
    const { data } = await supabase.auth.admin.getUserById(ANONYMOUS_USER_ID);
    if (!data?.user) {
      await supabase.auth.admin.createUser({
        id: ANONYMOUS_USER_ID,
        email: "anonymous@recipemoa.internal",
        email_confirm: true,
      });
    }
    // user_profiles에도 익명 유저 프로필 보장
    await supabase.from("user_profiles").upsert(
      { user_id: ANONYMOUS_USER_ID, daily_limit: 9999 },
      { onConflict: "user_id" }
    );
    anonymousUserEnsured = true;
  } catch {
    // 이미 존재하면 무시
    anonymousUserEnsured = true;
  }
}

export async function POST(req: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json({ ok: false });
  }

  try {
    const body = await req.json();
    const { video_id, title, thumbnail, recipe } = body;

    if (!video_id || !recipe) {
      return NextResponse.json({ ok: false });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    await ensureAnonymousUser(supabase);

    const { error } = await supabase.from("recipes").upsert(
      {
        user_id: ANONYMOUS_USER_ID,
        video_id,
        title,
        thumbnail,
        food_name: recipe.food_name,
        category: recipe.category ?? "기타",
        servings: recipe.servings ?? 1,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tips: recipe.tips,
        checked_steps: new Array(recipe.steps?.length || 0).fill(false),
        is_favorite: false,
      },
      { onConflict: "user_id,video_id" }
    );

    // 비회원 추출도 extraction_log에 기록 (비용 통계에 포함)
    await supabase.from("extraction_log").insert({
      user_id: ANONYMOUS_USER_ID,
      video_id,
    });

    return NextResponse.json({ ok: !error, error: error?.message });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
