import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "") || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s/g, "") || "";
const ADMIN_EMAIL = "sahoo860420@gmail.com";

// GPT-4o-mini 예상 비용 (1회 추출당)
const COST_PER_EXTRACTION = 0.0003; // ~$0.0003 (input ~1k tokens + output ~1k tokens)

export async function GET(req: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  // 어드민 확인 (쿼리 파라미터로 이메일 전달)
  const email = req.nextUrl.searchParams.get("email");
  if (email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. 전체 추출 횟수
    const { count: totalCount } = await supabase
      .from("extraction_log")
      .select("*", { count: "exact", head: true });

    // 2. 오늘 추출 횟수
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("extraction_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString());

    // 3. 전체 유저 수
    const { count: userCount } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    // 4. 전체 저장된 레시피 수
    const { count: recipeCount } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true });

    // 5. 상위 10명 유저 (추출 많이 한 순)
    const { data: logs } = await supabase
      .from("extraction_log")
      .select("user_id");

    const userCounts = new Map<string, number>();
    for (const log of logs || []) {
      userCounts.set(log.user_id, (userCounts.get(log.user_id) || 0) + 1);
    }

    const topUserIds = [...userCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 유저 이메일 조회
    const topUsers = [];
    for (const [userId, count] of topUserIds) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("daily_limit")
        .eq("user_id", userId)
        .single();
      topUsers.push({
        user_id: userId,
        email: userData?.user?.email || "알 수 없음",
        name: userData?.user?.user_metadata?.name || "",
        extraction_count: count,
        daily_limit: profileData?.daily_limit || 3,
      });
    }

    return NextResponse.json({
      total_extractions: totalCount || 0,
      today_extractions: todayCount || 0,
      total_users: userCount || 0,
      total_recipes: recipeCount || 0,
      estimated_cost_usd: ((totalCount || 0) * COST_PER_EXTRACTION).toFixed(4),
      estimated_cost_krw: Math.round((totalCount || 0) * COST_PER_EXTRACTION * 1400),
      top_users: topUsers,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
