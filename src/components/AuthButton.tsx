"use client";

import { createClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  onAuthChange: () => void;
}

function getIsInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";

  // 1. 알려진 인앱 브라우저 키워드
  if (/KAKAOTALK|Instagram|Barcelona|Threads|NAVER|Line\/|FBAN|FBAV|FB_IAB|Twitter|Snapchat|Daum|everytimeApp/i.test(ua)) {
    return true;
  }

  // 2. Android WebView 감지 (wv) 또는 Version/X.X 없는 Chrome
  if (/android/i.test(ua) && (/wv\)|\.wv\b/i.test(ua) || (/Chrome/i.test(ua) && !/SamsungBrowser/i.test(ua) && !/Version\//i.test(ua) && /\bwv\b/i.test(ua)))) {
    return true;
  }

  // 3. iOS: Safari가 아닌 웹킷 브라우저 = 인앱 브라우저
  if (/iPhone|iPad/i.test(ua) && /WebKit/i.test(ua) && !/Safari\//i.test(ua)) {
    return true;
  }

  return false;
}

function openInExternalBrowser(url: string): boolean {
  const ua = navigator.userAgent || "";

  // 카카오톡 전용 (iOS/Android 모두)
  if (/KAKAOTALK/i.test(ua)) {
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return true;
  }

  // Android: intent로 Chrome 열기
  if (/android/i.test(ua)) {
    window.location.href = `intent://${url.replace(/https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  }

  // iOS/기타: 외부 브라우저 강제 열기 불가 → false 반환하여 복사 안내
  return false;
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

  const isInApp = getIsInAppBrowser();

  const handleLogin = (e: React.MouseEvent) => {
    if (isInApp) {
      e.preventDefault();
      const currentUrl = window.location.href;
      // 외부 브라우저로 열기 시도
      const opened = openInExternalBrowser(currentUrl);
      if (!opened) {
        // iOS 등: 복사 후 안내
        navigator.clipboard?.writeText(currentUrl).then(() => {
          alert("인앱 브라우저에서는 Google 로그인이 제한됩니다 😢\n\n주소가 복사되었습니다!\nSafari 또는 Chrome에서 붙여넣기 해주세요.");
        }).catch(() => {
          alert(`인앱 브라우저에서는 Google 로그인이 제한됩니다 😢\n\n아래 주소를 Safari 또는 Chrome에서 열어주세요:\n${currentUrl}`);
        });
      }
    }
  };

  return (
    <a
      href={authUrl}
      onClick={handleLogin}
      className="inline-block bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer text-center whitespace-nowrap"
    >
      로그인
    </a>
  );
}
