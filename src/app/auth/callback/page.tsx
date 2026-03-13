"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (code) {
      // PKCE flow: exchange code for session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError(`로그인 실패: ${error.message}`);
        } else {
          router.replace("/");
        }
      });
    } else {
      // Fallback: check if session already exists (e.g. from hash detection)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace("/");
        } else {
          setError("인증 코드가 없습니다. 다시 로그인해주세요.");
        }
      });
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="text-orange-600 hover:underline"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">로그인 중...</p>
      </div>
    </div>
  );
}
