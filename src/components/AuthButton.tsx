"use client";

import { createClient } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  onAuthChange: () => void;
}

export default function AuthButton({ user, onAuthChange }: Props) {
  const supabase = createClient();

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://xn--om2b21rhzo.site",
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        alert(`로그인 에러: ${error.message}`);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
      } else {
        alert("로그인 URL 생성 실패");
      }
    } catch (e) {
      alert(`오류: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

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
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
    >
      Google 로그인
    </button>
  );
}
