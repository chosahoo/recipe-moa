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
          onClick={signOut}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
        >
          로그아웃
        </button>
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const redirectTo = typeof window !== "undefined" ? window.location.origin : "https://www.xn--om2b21rhzo.site";
  const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;

  return (
    <a
      href={authUrl}
      className="inline-block bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-center"
    >
      Google 로그인
    </a>
  );
}
