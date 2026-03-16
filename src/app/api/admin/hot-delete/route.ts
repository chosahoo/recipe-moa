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
    const { admin_email, video_id } = await req.json();

    if (admin_email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    if (!video_id) {
      return NextResponse.json({ error: "video_id가 필요합니다" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 해당 video_id의 모든 레시피 삭제 (모든 유저)
    const { error, count } = await supabase
      .from("recipes")
      .delete()
      .eq("video_id", video_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: `${video_id} 레시피 ${count ?? 0}개 삭제 완료`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
