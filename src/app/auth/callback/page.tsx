"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // implicit flow: tokens are in the URL hash
    // detectSessionInUrl: true will auto-parse them
    // We just listen for the auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          router.replace("/");
        }
      }
    );

    // Fallback: check if session already established
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace("/");
        } else {
          // No session after 3 seconds, redirect home
          router.replace("/");
        }
      });
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600">로그인 중...</p>
      </div>
    </div>
  );
}
