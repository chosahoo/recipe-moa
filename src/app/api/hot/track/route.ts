import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "") || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s/g, "") || "";

// 비회원 추출도 핫 레시피에 반영하기 위한 익명 유저 ID
const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";

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

    await supabase.from("recipes").upsert(
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
