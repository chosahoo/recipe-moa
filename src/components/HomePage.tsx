"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { RecipeResponse, SavedRecipe } from "@/types/recipe";
import {
  getSavedRecipes,
  saveRecipe,
  deleteRecipe as deleteRecipeDB,
} from "@/lib/recipes-db";
import { createClient } from "@/lib/supabase";
import RecipeCard from "@/components/RecipeCard";
import AuthButton from "@/components/AuthButton";
import Image from "next/image";
import { User } from "@supabase/supabase-js";

type View = "home" | "extract" | "detail";
type Tab = "all" | "favorites";

const GUEST_TRIED_KEY = "guest_tried";
const CATEGORIES = ["전체", "밥/면", "국/찌개", "반찬", "볶음/구이", "디저트/간식", "양식", "중식", "일식", "기타"];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<Tab>("all");
  // 비로그인 체험용
  const [guestRecipe, setGuestRecipe] = useState<RecipeResponse | null>(null);
  const [guestTried, setGuestTried] = useState(false);

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const loadRecipes = useCallback(async () => {
    try {
      const recipes = await getSavedRecipes();
      setSavedRecipes(recipes);
    } catch {
      setSavedRecipes([]);
    }
  }, []);

  const checkUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    setAuthLoading(false);
    if (session?.user) {
      loadRecipes();
    }
  }, [supabase.auth, loadRecipes]);

  useEffect(() => {
    checkUser();

    // URL hash에 access_token이 있으면 정리
    if (window.location.hash && window.location.hash.includes("access_token")) {
      // Supabase 클라이언트가 자동 감지할 시간을 줌
      setTimeout(() => {
        window.history.replaceState(null, "", window.location.pathname);
      }, 2000);
    }

    // 게스트 체험 여부 확인
    if (localStorage.getItem(GUEST_TRIED_KEY)) {
      setGuestTried(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadRecipes();
      } else {
        setSavedRecipes([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, checkUser, loadRecipes]);

  // 비로그인 체험 추출
  const handleGuestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setGuestRecipe(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "레시피 추출에 실패했습니다.");
      }

      const data: RecipeResponse = await res.json();
      setGuestRecipe(data);
      setGuestTried(true);
      localStorage.setItem(GUEST_TRIED_KEY, "true");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  // 로그인 유저 추출
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "레시피 추출에 실패했습니다.");
      }

      const data: RecipeResponse = await res.json();
      const saved = await saveRecipe(data, user.id);
      await loadRecipes();
      setSelectedRecipe(saved);
      setView("detail");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (dbId: string) => {
    await deleteRecipeDB(dbId);
    await loadRecipes();
    if (selectedRecipe?.db_id === dbId) {
      setView("home");
      setSelectedRecipe(null);
    }
  };

  const goHome = () => {
    setView("home");
    setSelectedRecipe(null);
    setError("");
  };

  const filteredRecipes = savedRecipes
    .filter((r) => tab === "favorites" ? r.is_favorite : true)
    .filter((r) => selectedCategory === "전체" ? true : r.recipe.category === selectedCategory);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  // ── 비로그인 화면 ──
  if (!user) {
    return (
      <main className="min-h-screen pb-20">
        <header className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => { setGuestRecipe(null); setError(""); setUrl(""); }} className="text-xl font-bold text-orange-600 cursor-pointer hover:text-orange-700 transition-colors">레시피모아</button>
            <AuthButton user={null} onAuthChange={checkUser} />
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 mt-8">
          {/* 히어로 */}
          <div className="text-center mb-10">
            <p className="text-5xl mb-4">&#127859;</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              유튜브 영상 → 레시피 자동 정리
            </h2>
            <p className="text-gray-500 mb-6">
              요리 영상 URL을 넣어보세요. 바로 체험할 수 있어요!
            </p>
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-center mb-2">
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <p className="text-2xl mb-1">&#129368;</p>
                <p className="text-xs text-gray-600 font-medium">자동 레시피 추출</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <p className="text-2xl mb-1">&#128203;</p>
                <p className="text-xs text-gray-600 font-medium">재료 &middot; 순서 정리</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm">
                <p className="text-2xl mb-1">&#128279;</p>
                <p className="text-xs text-gray-600 font-medium">카톡 공유 &middot; 저장</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">카톡, 인스타에 흩어진 레시피 링크를 AI가 깔끔하게 정리해드려요</p>
          </div>

          {/* 체험 입력란 */}
          {!guestTried ? (
            <>
              <form onSubmit={handleGuestSubmit} className="mb-8 max-w-lg mx-auto">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="유튜브 요리 영상 URL 붙여넣기"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-gray-900 placeholder-gray-400 mb-3"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-8 py-3 rounded-xl font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      추출 중...
                    </span>
                  ) : (
                    "레시피 추출"
                  )}
                </button>
              </form>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
                  {error}
                </div>
              )}

              {loading && (
                <div className="bg-white rounded-2xl shadow-md overflow-hidden max-w-2xl w-full mx-auto animate-pulse">
                  <div className="bg-gray-200 h-48 sm:h-56" />
                  <div className="p-6 space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded" />
                      <div className="h-4 bg-gray-200 rounded w-5/6" />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : !guestRecipe ? (
            /* 이미 1회 체험했고, 결과가 없는 상태 (새로고침 후) */
            <div className="text-center py-8">
              <p className="text-gray-500 mb-6">
                레시피를 저장하고 다시 보려면 로그인하세요
              </p>
              <AuthButton user={null} onAuthChange={checkUser} />
            </div>
          ) : null}

          {/* 체험 결과 */}
          {guestRecipe && (
            <div className="flex flex-col items-center">
              {/* 레시피 카드 (저장 불가 버전) */}
              <div className="bg-white rounded-2xl shadow-md overflow-hidden max-w-2xl w-full">
                <div className="relative">
                  <Image
                    src={guestRecipe.thumbnail}
                    alt={guestRecipe.title}
                    width={640}
                    height={360}
                    className="w-full h-48 sm:h-56 object-cover"
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">
                    {guestRecipe.recipe.food_name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-4 truncate">{guestRecipe.title}</p>

                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-orange-600 mb-2">재료</h3>
                    <div className="flex flex-wrap gap-2">
                      {guestRecipe.recipe.ingredients.map((ing, i) => (
                        <span key={i} className="bg-orange-50 text-orange-800 px-3 py-1 rounded-full text-sm">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <h3 className="text-lg font-semibold text-orange-600 mb-2">조리 순서</h3>
                    <ol className="space-y-2">
                      {guestRecipe.recipe.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="text-sm leading-relaxed text-gray-700">
                            <span className="font-semibold text-gray-900">{i + 1}.</span> {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {guestRecipe.recipe.tips && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                      <p className="text-sm text-amber-800">
                        <span className="font-semibold">Tip:</span> {guestRecipe.recipe.tips}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 로그인 유도 */}
              <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-6 text-center max-w-2xl w-full">
                <p className="text-gray-800 font-semibold mb-2">
                  이 레시피를 저장하고 싶으신가요?
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  로그인하면 레시피 저장, 즐겨찾기, 공유 기능을 모두 사용할 수 있어요
                </p>
                <AuthButton user={null} onAuthChange={checkUser} />
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── 로그인 유저 화면 ──
  return (
    <main className="min-h-screen pb-20">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={goHome}
            className="text-xl font-bold text-orange-600 cursor-pointer hover:text-orange-700 transition-colors"
          >
            레시피모아
          </button>
          <div className="flex items-center gap-3">
            {view === "home" && (
              <button
                onClick={() => setView("extract")}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                + 새 레시피
              </button>
            )}
            <AuthButton user={user} onAuthChange={checkUser} />
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 mt-6">
        {view === "detail" && selectedRecipe ? (
          <div className="flex justify-center">
            <RecipeCard
              recipe={selectedRecipe}
              onDelete={handleDelete}
              onFavoriteChange={loadRecipes}
              onBack={goHome}
            />
          </div>
        ) : view === "extract" ? (
          <>
            <button
              onClick={goHome}
              className="text-sm text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
            >
              &#8592; 목록으로
            </button>
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="유튜브 요리 영상 URL을 붙여넣으세요 (숏츠도 가능)"
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-6 py-3 rounded-xl font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      추출 중...
                    </span>
                  ) : (
                    "레시피 추출"
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            {loading && (
              <div className="bg-white rounded-2xl shadow-md overflow-hidden max-w-2xl w-full mx-auto animate-pulse">
                <div className="bg-gray-200 h-48 sm:h-56" />
                <div className="p-6 space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded w-5/6" />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 탭 */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
              <button
                onClick={() => setTab("all")}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  tab === "all"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                전체 ({savedRecipes.length})
              </button>
              <button
                onClick={() => setTab("favorites")}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  tab === "favorites"
                    ? "bg-white text-orange-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                &#9733; 즐겨찾기 ({savedRecipes.filter((r) => r.is_favorite).length})
              </button>
            </div>

            {/* 카테고리 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {CATEGORIES.filter((cat) => {
                if (cat === "전체") return true;
                return savedRecipes.some((r) => r.recipe.category === cat);
              }).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredRecipes.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-5xl mb-4">&#127859;</p>
                <p className="text-lg">
                  {tab === "favorites"
                    ? "즐겨찾기한 레시피가 없어요"
                    : "아직 추출한 레시피가 없어요"}
                </p>
                {tab === "all" && (
                  <button
                    onClick={() => setView("extract")}
                    className="mt-4 text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
                  >
                    + 첫 레시피 추출하기
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredRecipes.map((r) => (
                  <div
                    key={r.db_id || r.video_id}
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 flex gap-4 items-center"
                  >
                    <button
                      onClick={() => {
                        setSelectedRecipe(r);
                        setView("detail");
                      }}
                      className="flex gap-4 items-center text-left cursor-pointer flex-1 min-w-0"
                    >
                      <Image
                        src={r.thumbnail}
                        alt={r.recipe.food_name}
                        width={120}
                        height={68}
                        className="rounded-lg object-cover w-24 h-16 sm:w-28 sm:h-18 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {r.recipe.food_name}
                          </h3>
                          {r.is_favorite && (
                            <span className="text-orange-400 shrink-0">&#9733;</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {r.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            {r.recipe.category || "기타"}
                          </span>
                          <span className="text-xs text-gray-400">
                            재료 {r.recipe.ingredients.length}개 &middot; {r.recipe.steps.length}단계
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = `${r.recipe.food_name} 레시피\n\n재료: ${r.recipe.ingredients.join(", ")}\n\n조리 순서:\n${r.recipe.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${r.recipe.tips ? `\n\n팁: ${r.recipe.tips}` : ""}`;
                        const videoUrl = `https://www.youtube.com/watch?v=${r.video_id}`;
                        if (navigator.share) {
                          navigator.share({ title: r.recipe.food_name, text, url: videoUrl });
                        } else {
                          navigator.clipboard.writeText(`${text}\n\n영상: ${videoUrl}`);
                          alert("레시피가 클립보드에 복사되었습니다!");
                        }
                      }}
                      className="shrink-0 bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                    >
                      공유
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
