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

    const { data, error } = await supabase
      .from("recipes")
      .select("video_id, title, thumbnail, food_name, category, servings, ingredients, steps, tips");

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

    // 카운트 순 정렬, 상위 100개
    const sorted = [...countMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // 명확히 요리가 아닌 영상 제외
    const notFood = /뉴스|정치|주식|코딩|운동|코어|미사일|액션|몰아보기|확전|창업|청정구역|오토쇼|전략.*농락|발사/i;
    const filtered = sorted.filter((item) => !notFood.test(item.recipe.food_name) && !notFood.test(item.recipe.title));

    const recipes = filtered.map((item) => ({
      video_id: item.recipe.video_id,
      title: item.recipe.title,
      thumbnail: item.recipe.thumbnail,
      food_name: item.recipe.food_name,
      category: item.recipe.category || "기타",
      servings: item.recipe.servings ?? 1,
      ingredients: item.recipe.ingredients || [],
      steps: item.recipe.steps || [],
      tips: item.recipe.tips || "",
      save_count: item.count,
    }));

    return NextResponse.json({ recipes });
  } catch {
    return NextResponse.json({ recipes: [] });
  }
}
