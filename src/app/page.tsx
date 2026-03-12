"use client";

import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("@/components/HomePage"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </main>
  ),
});

export default function Page() {
  return <HomePage />;
}
