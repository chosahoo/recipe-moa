"use client";

import { createClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  onAuthChange: () => void;
}

export default function AuthButton({ user, onAuthChange }: Props) {
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    onAuthChange();
  };

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden sm:inline">
          {user.user_metadata?.name || user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer px-3 py-2 min-w-[60px]"
        >
          로그아웃
        </button>
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const redirectTo = typeof window !== "undefined" ? window.location.origin : "https://www.xn--om2b21rhzo.site";
  const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;

  // ref 파라미터가 있으면 localStorage에 저장 (OAuth 리다이렉트 후에도 유지)
  if (typeof window !== "undefined") {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("pending_referral", ref);
  }

  // 인앱 브라우저 감지 (카카오톡, 인스타그램, 네이버, 라인 등)
  const isInAppBrowser = typeof navigator !== "undefined" &&
    /KAKAOTALK|Instagram|NAVER|Line|FBAN|FBAV|SamsungBrowser\/.*CrossApp/i.test(navigator.userAgent);

  const handleLogin = (e: React.MouseEvent) => {
    if (isInAppBrowser) {
      e.preventDefault();
      // 외부 브라우저로 열기
      const currentUrl = window.location.href;
      // Android intent 방식
      if (/android/i.test(navigator.userAgent)) {
        window.location.href = `intent://${currentUrl.replace(/https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
        return;
      }
      // iOS/기타: 안내 메시지
      if (confirm("인앱 브라우저에서는 Google 로그인이 제한됩니다.\n\nSafari/Chrome에서 열어주세요.\n\n주소를 복사할까요?")) {
        navigator.clipboard?.writeText(currentUrl);
        alert("주소가 복사되었습니다!\nSafari 또는 Chrome에서 붙여넣기 해주세요.");
      }
      return;
    }
  };

  return (
    <a
      href={authUrl}
      onClick={handleLogin}
      className="inline-block bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-center"
    >
      Google 로그인
    </a>
  );
}
