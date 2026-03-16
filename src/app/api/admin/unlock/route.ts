import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\s/g, "") || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s/g, "") || "";
const ADMIN_EMAIL = "sahoo860420@gmail.com";

export async function POST(req: NextRequest) {
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { admin_email, target_email, daily_limit } = await req.json();

    if (admin_email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    if (!target_email || !daily_limit) {
      return NextResponse.json({ error: "이메일과 횟수를 입력하세요" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 이메일로 유저 찾기
    const { data: users } = await supabase.auth.admin.listUsers();
    const targetUser = users?.users?.find(
      (u) => u.email === target_email
    );

    if (!targetUser) {
      return NextResponse.json({ error: `${target_email} 유저를 찾을 수 없습니다` }, { status: 404 });
    }

    // daily_limit 업데이트
    const { error } = await supabase
      .from("user_profiles")
      .update({ daily_limit })
      .eq("user_id", targetUser.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `${target_email}의 일일 추출 횟수를 ${daily_limit}회로 변경했습니다`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
