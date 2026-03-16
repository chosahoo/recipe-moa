import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "") || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s/g, "") || "";

export async function GET() {
  if (!serviceRoleKey) {
    return NextResponse.json({ recipes: [] });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 최근 레시피 중 여러 유저가 저장한 인기 레시피
    const { data, error } = await supabase
      .from("recipes")
      .select("video_id, title, thumbnail, food_name, category, ingredients, steps");

    if (error || !data) {
      return NextResponse.json({ recipes: [] });
    }

    // video_id 기준으로 그룹핑 & 카운트
    const countMap = new Map<string, { count: number; recipe: typeof data[0] }>();
    for (const row of data) {
      const existing = countMap.get(row.video_id);
      if (existing) {
        existing.count++;
      } else {
        countMap.set(row.video_id, { count: 1, recipe: row });
      }
    }

    // 카운트 순 정렬, 상위 10개
    const sorted = [...countMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recipes = sorted.map((item) => ({
      video_id: item.recipe.video_id,
      title: item.recipe.title,
      thumbnail: item.recipe.thumbnail,
      food_name: item.recipe.food_name,
      category: item.recipe.category || "기타",
      ingredient_count: item.recipe.ingredients?.length || 0,
      step_count: item.recipe.steps?.length || 0,
      save_count: item.count,
    }));

    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json({ recipes: [] });
  }
}
