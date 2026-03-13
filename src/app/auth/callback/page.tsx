"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [debug, setDebug] = useState("로딩 중...");

  useEffect(() => {
    const supabase = createClient();
    const hash = window.location.hash;
    const search = window.location.search;

    setDebug(`hash: ${hash}\nsearch: ${search}\nhref: ${window.location.href}`);

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setDebug((prev) => prev + `\ngetSession error: ${error.message}`);
      } else if (session) {
        setDebug((prev) => prev + `\nsession found: ${session.user.email}`);
        setTimeout(() => router.replace("/"), 1000);
      } else {
        setDebug((prev) => prev + `\nno session`);
      }
    });

    supabase.auth.onAuthStateChange((event, session) => {
      setDebug((prev) => prev + `\nevent: ${event}`);
      if (event === "SIGNED_IN" && session) {
        setDebug((prev) => prev + `\nSIGNED_IN: ${session.user.email}`);
        setTimeout(() => router.replace("/"), 1000);
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center max-w-lg">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600 mb-4">로그인 중...</p>
        <pre className="text-left text-xs text-gray-500 bg-white p-4 rounded-lg break-all whitespace-pre-wrap">{debug}</pre>
      </div>
    </div>
  );
}
