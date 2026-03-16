"use client";

import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("@/components/HomePage"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          &#x1F468;&#x200D;&#x1F373; 레시피모아
        </h1>
        <p className="text-gray-600 mb-6">
          유튜브 요리 영상 링크만 넣으면 AI가 재료·조리순서를 깔끔하게 정리해줘요
        </p>
        <div className="space-y-4 text-left max-w-sm mx-auto">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">유튜브 레시피 자동 추출</h2>
            <p className="text-sm text-gray-500 mt-1">영상 링크만 붙여넣으면 재료, 조리순서, 팁을 자동으로 정리</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">나만의 레시피 저장</h2>
            <p className="text-sm text-gray-500 mt-1">카톡, 인스타에 흩어진 레시피를 한곳에서 관리</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-800">인분 계산 · 즐겨찾기 · 공유</h2>
            <p className="text-sm text-gray-500 mt-1">인원수에 맞게 재료를 자동 계산하고 친구에게 공유</p>
          </div>
        </div>
        <div className="mt-8">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    </main>
  ),
});

export default function Page() {
  return <HomePage />;
}
