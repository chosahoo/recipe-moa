"use client";

import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { RecipeResponse, SavedRecipe, UserProfile } from "@/types/recipe";
import {
  getSavedRecipes,
  saveRecipe,
  deleteRecipe as deleteRecipeDB,
  getOrCreateProfile,
  getTodayExtractionCount,
  logExtraction,
  applyReferral,
} from "@/lib/recipes-db";
import { createClient } from "@/lib/supabase";
import RecipeCard from "@/components/RecipeCard";
import AuthButton from "@/components/AuthButton";
import Image from "next/image";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

type View = "home" | "extract" | "detail" | "hot" | "admin";
const ADMIN_EMAIL = "sahoo860420@gmail.com";
type Tab = "all" | "favorites";

interface HotRecipe {
  video_id: string;
  title: string;
  thumbnail: string;
  food_name: string;
  category: string;
  servings: number;
  ingredients: string[];
  steps: string[];
  tips: string;
  save_count: number;
}

const GUEST_TRIED_KEY = "guest_tried";
const CATEGORIES = ["전체", "밥/면", "국/찌개", "반찬", "볶음/구이", "디저트/간식", "양식", "중식", "일식", "기타"];

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<Tab>("all");
  // 비로그인 체험용
  const [guestRecipe, setGuestRecipe] = useState<RecipeResponse | null>(null);
  const [guestTried, setGuestTried] = useState(false);
  // 추출 제한 & 리퍼럴
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  // 핫 레시피
  const [hotRecipes, setHotRecipes] = useState<HotRecipe[]>([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [hotCategory, setHotCategory] = useState("전체");
  // 어드민
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockLimit, setUnlockLimit] = useState("999");
  const [unlockMsg, setUnlockMsg] = useState("");

  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const authInitialized = useRef(false);
  const loadingRef = useRef(false);
  const prevView = useRef<View>("home");

  const loadRecipes = useCallback(async () => {
    try {
      const recipes = await getSavedRecipes();
      setSavedRecipes(recipes);
    } catch {
      setSavedRecipes([]);
    }
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    // 이미 로딩 중이면 중복 호출 방지
    if (loadingRef.current) return;
    loadingRef.current = true;
    setDataLoading(true);
    try {
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
        Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

      const [recipes, profile, count] = await Promise.all([
        withTimeout(getSavedRecipes(), 5000),
        withTimeout(getOrCreateProfile(userId), 5000),
        withTimeout(getTodayExtractionCount(userId), 5000),
      ]);

      if (recipes) setSavedRecipes(recipes);
      if (profile) {
        setProfile(profile);
        const c = count ?? 0;
        setTodayCount(c);
        setLimitReached(c >= profile.daily_limit);
      }
    } catch { /* ignore */ }
    setDataLoading(false);
    loadingRef.current = false;
  }, []);

  const safeGetSession = useCallback(async () => {
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>((r) => setTimeout(() => r(null), 5000)),
      ]);
      return result?.data?.session ?? null;
    } catch {
      return null;
    }
  }, [supabase.auth]);

  const refreshAuth = useCallback(async () => {
    const session = await safeGetSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      authInitialized.current = true;
      await loadUserData(session.user.id);
    } else {
      authInitialized.current = false;
      setSavedRecipes([]);
      setProfile(null);
      setTodayCount(0);
      setLimitReached(false);
    }
  }, [safeGetSession, loadUserData]);

  useEffect(() => {
    // ref 파라미터 localStorage에 저장 (OAuth 리다이렉트 전에)
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem("pending_referral", ref);

    let initialLoaded = false;

    // 1. 즉시 세션 확인 → 데이터 로드 (가장 빠른 경로)
    safeGetSession().then(async (session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        authInitialized.current = true;
        initialLoaded = true;
        await loadUserData(session.user.id);
      }
    });

    // 2. 이후 변경 감지 (OAuth 리다이렉트, 로그아웃 등)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);

      if (session?.user && !authInitialized.current) {
        authInitialized.current = true;
        await loadUserData(session.user.id);
        // 리퍼럴 코드 적용 (URL 또는 localStorage에서)
        const searchParams = new URLSearchParams(window.location.search);
        const refCode = searchParams.get("ref") || localStorage.getItem("pending_referral");
        if (refCode) {
          try { await applyReferral(refCode, session.user.id); } catch { /* 무시 */ }
          localStorage.removeItem("pending_referral");
          searchParams.delete("ref");
          const newSearch = searchParams.toString();
          window.history.replaceState(null, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
        }
        // OAuth hash 정리
        if (window.location.hash?.includes("access_token")) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      } else if (session?.user && initialLoaded) {
        // getSession에서 이미 로드했으면 중복 호출 방지
        return;
      } else if (!session?.user) {
        authInitialized.current = false;
        setSavedRecipes([]);
        setProfile(null);
        setTodayCount(0);
        setLimitReached(false);
      }
    });

    // 게스트 체험 여부 확인
    if (localStorage.getItem(GUEST_TRIED_KEY)) {
      setGuestTried(true);
    }

    return () => subscription.unsubscribe();
  }, [supabase.auth, loadUserData]);

  // 비로그인 체험 추출
  const handleGuestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setLoadingMsg("AI가 레시피를 추출중이에요...");
    setError("");
    setGuestRecipe(null);

    const msgTimer = setTimeout(() => setLoadingMsg("자막에서 레시피를 분석중이에요. 조금만 기다려주세요!"), 10000);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      clearTimeout(msgTimer);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "레시피 추출에 실패했습니다.");
      }

      const data = await res.json();

      if (data.method === "no_recipe") {
        // 기본 정보로 결과 표시
        const guestData = {
          video_id: data.video_id,
          title: data.title,
          thumbnail: data.thumbnail,
          recipe: {
            food_name: data.title,
            category: "기타",
            servings: 1,
            ingredients: [],
            steps: ["설명란·고정댓글에 레시피 정보가 없어 추출이 어려웠어요. 영상을 직접 확인해주세요."],
            tips: "",
          },
        };
        setGuestRecipe(guestData);
        // 핫 레시피용 기록
        fetch("/api/hot/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(guestData) }).catch(() => {});
        setGuestTried(true);
        localStorage.setItem(GUEST_TRIED_KEY, "true");
        setUrl("");
        setLoading(false);
        setLoadingMsg("");
        return;
      }

      setGuestRecipe(data);
      // 핫 레시피용 기록
      fetch("/api/hot/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => {});
      setGuestTried(true);
      localStorage.setItem(GUEST_TRIED_KEY, "true");
      setUrl("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // 로그인 유저 추출
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;

    setLoading(true);
    setLoadingMsg("AI가 레시피를 추출중이에요...");
    setError("");
    setLimitReached(false);

    const msgTimer2 = setTimeout(() => setLoadingMsg("자막에서 레시피를 분석중이에요. 조금만 기다려주세요!"), 10000);

    try {
      // 추출 제한 확인
      if (profile) {
        const count = await getTodayExtractionCount(user.id);
        setTodayCount(count);
        if (count >= profile.daily_limit) {
          setLimitReached(true);
          setLoading(false);
          setLoadingMsg("");
          clearTimeout(msgTimer2);
          return;
        }
      }

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      clearTimeout(msgTimer2);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "레시피 추출에 실패했습니다.");
      }

      const data = await res.json();

      if (data.method === "no_recipe") {
        // 영상 기본 정보만 리스트에 저장
        const basicRecipe = {
          video_id: data.video_id,
          title: data.title,
          thumbnail: data.thumbnail,
          recipe: {
            food_name: data.title,
            category: "기타" as const,
            servings: 1,
            ingredients: [],
            steps: ["설명란·고정댓글에 레시피 정보가 없어 추출이 어려웠어요. 영상을 직접 확인해주세요."],
            tips: "",
          },
        };
        await saveRecipe(basicRecipe, user.id);
        await loadRecipes();
        setUrl("");
        setLoading(false);
        setLoadingMsg("");
        setError("이 영상은 설명란·고정댓글에 레시피 정보가 없어 추출이 어려웠어요. 설명란이나 고정댓글에 재료·레시피가 적힌 영상을 넣어보세요!");
        setView("home");
        setTimeout(() => setError(""), 4000);
        return;
      }

      await logExtraction(user.id, data.video_id);
      const newCount = todayCount + 1;
      setTodayCount(newCount);
      if (profile && newCount >= profile.daily_limit) setLimitReached(true);

      const saved = await saveRecipe(data, user.id);
      await loadRecipes();
      setSelectedRecipe(saved);
      setView("detail");
      setUrl("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMsg("");
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
    setLoading(false);
    setLoadingMsg("");
    if (profile) {
      setLimitReached(todayCount >= profile.daily_limit);
    } else {
      setLimitReached(false);
    }
  };

  const copyReferralLink = () => {
    if (!profile) return;
    const link = `https://xn--om2b21rhzo.site/?ref=${profile.referral_code}`;
    navigator.clipboard.writeText(link);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2000);
  };

  const loadHotRecipes = useCallback(async () => {
    setHotLoading(true);
    try {
      const res = await fetch("/api/hot");
      const data = await res.json();
      setHotRecipes(data.recipes || []);
    } catch {
      setHotRecipes([]);
    } finally {
      setHotLoading(false);
    }
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const loadAdminStats = useCallback(async () => {
    if (!user?.email) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      setAdminStats(data);
    } catch {
      setAdminStats(null);
    } finally {
      setAdminLoading(false);
    }
  }, [user?.email]);

  const handleUnlock = async () => {
    if (!user?.email || !unlockEmail) return;
    setUnlockMsg("");
    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_email: user.email,
          target_email: unlockEmail,
          daily_limit: parseInt(unlockLimit) || 999,
        }),
      });
      const data = await res.json();
      setUnlockMsg(data.message || data.error || "완료");
      if (data.ok) {
        setUnlockEmail("");
        loadAdminStats();
      }
    } catch {
      setUnlockMsg("요청 실패");
    }
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
            <button onClick={() => { setView("home"); setSelectedRecipe(null); setGuestRecipe(null); setGuestTried(false); setError(""); setUrl(""); localStorage.removeItem(GUEST_TRIED_KEY); }} className="text-xl font-bold text-orange-600 cursor-pointer hover:text-orange-700 transition-colors flex items-center gap-1.5">&#x1F468;&#x200D;&#x1F373; 레시피모아<span className="inline-flex items-center gap-0.5 bg-[#10a37f] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>GPT</span></button>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setView("hot"); loadHotRecipes(); }}
                className="animate-bounce-gentle relative bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-1 rounded-full text-[10px] font-bold transition-all hover:scale-105 cursor-pointer shadow-md shadow-orange-200 flex items-center gap-0.5 whitespace-nowrap"
              >
                &#x1F525;핫레시피
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-[7px] text-gray-900 font-bold px-1 rounded-full">N</span>
              </button>
              <AuthButton user={null} onAuthChange={refreshAuth} />
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 mt-8">
          {/* 비회원 핫 레시피 */}
          {view === "hot" ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setView("home")} className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg">&#8592;</button>
                <h2 className="text-xl font-bold text-gray-800">&#x1F525; 핫 레시피</h2>
              </div>
              {hotLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-sm text-gray-500">인기 레시피를 불러오는 중...</p>
                </div>
              ) : hotRecipes.length === 0 ? (
                <p className="text-center text-gray-400 py-12">아직 등록된 레시피가 없어요</p>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
                    {["전체", ...new Set(hotRecipes.map((r) => r.category))].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setHotCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${hotCategory === cat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  {!user && (
                    <div className="mb-4 overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5">
                      <p className="text-white text-sm font-medium whitespace-nowrap animate-marquee">
                        &#x1F512; 로그인하면 핫레시피를 내 목록에 저장할 수 있어요! &nbsp;&nbsp;&nbsp; &#x1F512; 로그인하면 핫레시피를 내 목록에 저장할 수 있어요!
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {hotRecipes
                      .filter((r) => hotCategory === "전체" || r.category === hotCategory)
                      .map((hr, idx) => (
                        <div key={hr.video_id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 flex gap-3 items-center">
                          <span className={`text-lg font-bold shrink-0 w-7 text-center ${idx < 3 ? "text-orange-500" : "text-gray-300"}`}>{idx + 1}</span>
                          <button
                            onClick={() => {
                              const asSaved: SavedRecipe = {
                                ...hr,
                                title: hr.title,
                                thumbnail: hr.thumbnail,
                                recipe: { food_name: hr.food_name, category: hr.category, servings: hr.servings, ingredients: hr.ingredients, steps: hr.steps, tips: hr.tips },
                                saved_at: "",
                                checked_steps: new Array(hr.steps.length).fill(false),
                                is_favorite: false,
                              };
                              setSelectedRecipe(asSaved);
                              prevView.current = "hot";
                              setView("detail");
                            }}
                            className="flex gap-3 items-center flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <Image src={hr.thumbnail} alt={hr.food_name} width={120} height={68} className="rounded-lg object-cover w-24 h-16 sm:w-28 sm:h-18 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 truncate">{hr.food_name}</h3>
                              <p className="text-xs text-gray-400 truncate mt-0.5">{hr.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{hr.category}</span>
                                <span className="text-xs text-gray-400">{hr.save_count}명 저장</span>
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                  </div>
                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500 mb-3">로그인하면 레시피를 내 목록에 담을 수 있어요!</p>
                    <AuthButton user={null} onAuthChange={refreshAuth} />
                  </div>
                </>
              )}
            </>
          ) : view === "detail" && selectedRecipe ? (
            <div className="flex flex-col items-center">
              <RecipeCard
                recipe={selectedRecipe}
                onBack={() => { setView(prevView.current === "hot" ? "hot" : "home"); setSelectedRecipe(null); }}
              />
              <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-6 text-center max-w-2xl w-full">
                <p className="text-gray-800 font-semibold mb-2">
                  로그인하시면 나만의 레시피들을 이렇게 정리할 수 있어요
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  인분 계산, 즐겨찾기, 카톡 공유까지 한번에!
                </p>
                <AuthButton user={null} onAuthChange={refreshAuth} />
              </div>
            </div>
          ) : (
          <>
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-gray-900 placeholder-gray-400 mb-2"
                />
                <p className="text-xs text-gray-400 mb-3">설명란 또는 고정댓글에 레시피가 적힌 영상에서 추출이 가능해요</p>
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
                <div className="max-w-2xl w-full mx-auto">
                  <div className="text-center mb-4">
                    <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-3" />
                    <p className="text-sm text-gray-600">{loadingMsg}</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse">
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
                </div>
              )}
            </>
          ) : !guestRecipe ? (
            /* 체험 끝 or 추출 실패 */
            <div className="text-center py-8">
              {error && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl mb-6 text-sm max-w-lg mx-auto">
                  {error}
                </div>
              )}
              <p className="text-lg font-semibold text-gray-700 mb-2">
                {error ? "다른 영상으로 시도해보세요!" : "무료 체험이 끝났어요!"}
              </p>
              <p className="text-gray-500 mb-1">
                로그인하면 추출한 레시피를 리스트로 저장하고 관리할 수 있어요.
              </p>
              <p className="text-gray-500 mb-6">
                인분 계산, 즐겨찾기, 카톡 공유까지 한번에!
              </p>
              <AuthButton user={null} onAuthChange={refreshAuth} />
            </div>
          ) : null}

          {/* 체험 결과 - 리스트 형태 */}
          {guestRecipe && (
            <div className="max-w-2xl mx-auto">
              {/* 리스트 아이템 - 클릭하면 상세보기 */}
              <button
                onClick={() => {
                  setSelectedRecipe({
                    ...guestRecipe,
                    saved_at: "",
                    checked_steps: new Array(guestRecipe.recipe.steps.length).fill(false),
                    is_favorite: false,
                  });
                  setView("detail");
                }}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 flex gap-4 items-center overflow-hidden mb-4 w-full text-left cursor-pointer"
              >
                <Image
                  src={guestRecipe.thumbnail}
                  alt={guestRecipe.recipe.food_name}
                  width={120}
                  height={68}
                  className="rounded-lg object-cover w-24 h-16 sm:w-28 sm:h-18 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {guestRecipe.recipe.food_name}
                  </h3>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {guestRecipe.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      {guestRecipe.recipe.category || "기타"}
                    </span>
                    <span className="text-xs text-gray-400">
                      재료 {guestRecipe.recipe.ingredients.length}개 &middot; {guestRecipe.recipe.steps.length}단계
                    </span>
                  </div>
                </div>
              </button>

              {/* 로그인 유도 */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
                <p className="text-gray-800 font-semibold mb-2">
                  로그인하시면 나만의 레시피들을 이렇게 정리할 수 있어요
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  인분 계산, 즐겨찾기, 카톡 공유까지 한번에!
                </p>
                <AuthButton user={null} onAuthChange={refreshAuth} />
              </div>
            </div>
          )}
          </>
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
            <span className="flex items-center gap-1.5">&#x1F468;&#x200D;&#x1F373; 레시피모아<span className="inline-flex items-center gap-0.5 bg-[#10a37f] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>GPT</span></span>
          </button>
          <div className="flex items-center gap-3">
            {view === "home" && (
              <>
                <button
                  onClick={() => { setView("hot"); loadHotRecipes(); }}
                  className="text-gray-500 hover:text-orange-500 text-sm font-medium transition-colors cursor-pointer"
                >
                  핫 레시피
                </button>
                <button
                  onClick={() => { setView("extract"); if (profile) setLimitReached(todayCount >= profile.daily_limit); }}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  + 새 레시피
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 mt-6 overflow-hidden">
        {view === "admin" && isAdmin ? (
          <>
            <button
              onClick={goHome}
              className="text-sm text-gray-500 hover:text-gray-700 mb-6 cursor-pointer"
            >
              &#8592; 목록으로
            </button>

            <h2 className="text-xl font-bold text-gray-800 mb-6">관리자 대시보드</h2>

            {adminLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
              </div>
            ) : adminStats ? (
              <div className="space-y-6">
                {/* 전체 통계 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-orange-600">{adminStats.total_extractions}</p>
                    <p className="text-xs text-gray-500 mt-1">전체 추출</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{adminStats.today_extractions}</p>
                    <p className="text-xs text-gray-500 mt-1">오늘 추출</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{adminStats.total_users}</p>
                    <p className="text-xs text-gray-500 mt-1">전체 유저</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{adminStats.total_recipes}</p>
                    <p className="text-xs text-gray-500 mt-1">저장된 레시피</p>
                  </div>
                </div>

                {/* 비용 */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">예상 API 비용</h3>
                  <p className="text-sm text-gray-600">
                    ${adminStats.estimated_cost_usd} USD (약 {adminStats.estimated_cost_krw}원)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">GPT-4o-mini 기준, 추출 1회당 약 $0.0003</p>
                </div>

                {/* 상위 유저 */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">추출 상위 유저</h3>
                  <div className="space-y-2">
                    {adminStats.top_users?.map((u: { user_id: string; email: string; name: string; extraction_count: number; daily_limit: number }, i: number) => (
                      <div key={u.user_id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-orange-500 font-bold w-5">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate text-gray-800">{u.name || u.email}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="font-semibold text-gray-800">{u.extraction_count}회</p>
                          <p className="text-xs text-gray-400">제한: {u.daily_limit}/일</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 제한 해제 */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">유저 추출 제한 변경</h3>
                  <div className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={unlockEmail}
                      onChange={(e) => setUnlockEmail(e.target.value)}
                      placeholder="구글 이메일 입력"
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400"
                    />
                    <div className="flex gap-2">
                      <select
                        value={unlockLimit}
                        onChange={(e) => setUnlockLimit(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 flex-1"
                      >
                        <option value="3">3회/일 (기본)</option>
                        <option value="10">10회/일</option>
                        <option value="50">50회/일</option>
                        <option value="999">무제한</option>
                      </select>
                      <button
                        onClick={handleUnlock}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                      >
                        변경
                      </button>
                    </div>
                    {unlockMsg && (
                      <p className="text-sm text-green-600">{unlockMsg}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">데이터를 불러올 수 없습니다</p>
            )}
          </>
        ) : view === "hot" ? (
          <>
            <button
              onClick={goHome}
              className="text-sm text-gray-500 hover:text-gray-700 mb-6 cursor-pointer"
            >
              &#8592; 목록으로
            </button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-1">핫 레시피</h2>
              <p className="text-gray-500 text-sm">사람들이 많이 저장한 인기 레시피</p>
              <p className="text-xs text-orange-500 mt-1">레시피 담기는 횟수 제한 없이 자유롭게!</p>
            </div>

            {hotLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
                <p className="text-sm text-gray-500">인기 레시피를 불러오는 중...</p>
              </div>
            ) : hotRecipes.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-5xl mb-4">&#127859;</p>
                <p className="text-lg">아직 인기 레시피가 없어요</p>
              </div>
            ) : (
              <>
                {/* 카테고리 필터 */}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
                  {["전체", ...new Set(hotRecipes.map((r) => r.category))].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setHotCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors cursor-pointer ${
                        hotCategory === cat
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3">
                  {hotRecipes
                    .filter((hr) => hotCategory === "전체" || hr.category === hotCategory)
                    .map((hr, idx) => (
                    <div
                      key={hr.video_id}
                      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 flex gap-3 items-center overflow-hidden"
                    >
                      <span className={`text-lg font-bold shrink-0 w-7 text-center ${idx < 3 ? "text-orange-500" : "text-gray-300"}`}>{idx + 1}</span>
                      <button
                        onClick={() => {
                          const asSaved: SavedRecipe = {
                            video_id: hr.video_id,
                            title: hr.title,
                            thumbnail: hr.thumbnail,
                            recipe: {
                              food_name: hr.food_name,
                              category: hr.category,
                              servings: hr.servings,
                              ingredients: hr.ingredients,
                              steps: hr.steps,
                              tips: hr.tips,
                            },
                            saved_at: "",
                            checked_steps: new Array(hr.steps.length).fill(false),
                            is_favorite: false,
                          };
                          setSelectedRecipe(asSaved);
                          prevView.current = "hot";
                          setView("detail");
                        }}
                        className="flex gap-3 items-center flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <Image
                          src={hr.thumbnail}
                          alt={hr.food_name}
                          width={120}
                          height={68}
                          className="rounded-lg object-cover w-24 h-16 sm:w-28 sm:h-18 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {hr.food_name}
                          </h3>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {hr.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              {hr.category}
                            </span>
                            <span className="text-xs text-gray-400">
                              {hr.save_count}명 저장
                            </span>
                          </div>
                        </div>
                      </button>
                      <div className="flex flex-col gap-1 shrink-0">
                        {savedRecipes.some((r) => r.video_id === hr.video_id) ? (
                          <span className="text-gray-400 px-3 py-1.5 rounded-full text-xs font-medium">
                            담김
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              if (!user) return;
                              const recipeData = {
                                video_id: hr.video_id,
                                title: hr.title,
                                thumbnail: hr.thumbnail,
                                recipe: {
                                  food_name: hr.food_name,
                                  category: hr.category,
                                  servings: hr.servings,
                                  ingredients: hr.ingredients,
                                  steps: hr.steps,
                                  tips: hr.tips,
                                },
                              };
                              await saveRecipe(recipeData, user.id);
                              await loadRecipes();
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                          >
                            담기
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`"${hr.food_name}" 핫 레시피를 삭제할까요?`)) return;
                              const res = await fetch("/api/admin/hot-delete", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ admin_email: user?.email, video_id: hr.video_id }),
                              });
                              const data = await res.json();
                              if (data.ok) {
                                setHotRecipes((prev) => prev.filter((r) => r.video_id !== hr.video_id));
                              } else {
                                alert(data.error || "삭제 실패");
                              }
                            }}
                            className="text-red-400 hover:text-red-600 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : view === "detail" && selectedRecipe ? (
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

            {/* 남은 추출 횟수 */}
            {profile && (
              <div className="mb-4 text-sm text-gray-500 text-right">
                오늘 남은 추출: {Math.max(0, profile.daily_limit - todayCount)}/{profile.daily_limit}회
              </div>
            )}

            {/* 추출 제한 도달 → 친구 초대 안내 */}
            {limitReached && profile && (
              <div className="space-y-4 max-w-md mx-auto mb-6">
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-center">
                  <p className="text-gray-800 font-semibold mb-2">
                    오늘의 추출 횟수를 모두 사용했어요!
                  </p>
                  <p className="text-sm text-gray-500">
                    친구초대를 통해 추출 횟수를 늘려보세요
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-5">
                  <h3 className="font-semibold text-gray-800 mb-3">친구 초대하고 횟수 늘리기</h3>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <span className="bg-orange-100 text-orange-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">1</span>
                      <p className="text-sm text-gray-600">아래 초대 링크를 친구에게 공유하세요</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-orange-100 text-orange-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">2</span>
                      <p className="text-sm text-gray-600">친구가 링크를 통해 Google 로그인하면 완료!</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-orange-100 text-orange-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0">3</span>
                      <p className="text-sm text-gray-600">나의 하루 추출 횟수가 <span className="font-bold text-orange-600">10회</span>로 늘어나요</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg px-4 py-3 mb-3 text-sm text-gray-700 break-all border border-gray-100">
                    {profile ? `https://xn--om2b21rhzo.site/?ref=${profile.referral_code}` : "로딩 중..."}
                  </div>
                  <button
                    onClick={copyReferralLink}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer mb-2"
                  >
                    {referralCopied ? "복사 완료!" : "초대 링크 복사하기"}
                  </button>
                  {typeof navigator !== "undefined" && navigator.share && (
                    <button
                      onClick={() => {
                        if (!profile) return;
                        navigator.share({
                          title: "레시피모아 - 유튜브 레시피 자동 정리",
                          text: `유튜브 요리 영상 링크만 넣으면 재료·조리순서를 AI가 깔끔하게 정리해줘!\n레시피모아에서 바로 확인해봐`,
                          url: `https://xn--om2b21rhzo.site/?ref=${profile.referral_code}`,
                        });
                      }}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                    >
                      카톡 / SNS로 공유하기
                    </button>
                  )}
                </div>
              </div>
            )}

            {!limitReached && <form onSubmit={handleSubmit} className="mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="유튜브 요리 영상 URL을 붙여넣으세요"
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
              <p className="text-xs text-gray-400 mt-2">설명란 또는 고정댓글에 레시피가 적힌 영상에서 추출이 가능해요</p>
            </form>}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            {loading && (
              <div className="max-w-2xl w-full mx-auto">
                <div className="text-center mb-4">
                  <div className="animate-spin h-8 w-8 border-4 border-orange-400 border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-sm text-gray-600">{loadingMsg}</p>
                </div>
                <div className="bg-white rounded-2xl shadow-md overflow-hidden animate-pulse">
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
              </div>
            )}
          </>
        ) : dataLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mb-3" />
            <p className="text-sm text-gray-500">레시피를 불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* 에러 메시지 (추출 실패 후 리스트로 돌아왔을 때) */}
            {error && (
              <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

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
                    onClick={() => { setView("extract"); if (profile) setLimitReached(todayCount >= profile.daily_limit); }}
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
                    className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 flex gap-4 items-center overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setSelectedRecipe(r);
                        prevView.current = "home";
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
                    <div className="shrink-0 flex flex-col gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const parts = [
                            `[${r.recipe.food_name}] 레시피`,
                            `재료: ${r.recipe.ingredients.join(", ")}`,
                            `조리 순서:\n${r.recipe.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
                          ];
                          if (r.recipe.tips) parts.push(`팁: ${r.recipe.tips}`);
                          const text = parts.join("\n\n");
                          const videoUrl = `https://www.youtube.com/watch?v=${r.video_id}`;
                          if (navigator.share) {
                            navigator.share({ title: `${r.recipe.food_name} 레시피`, text, url: videoUrl });
                          } else {
                            navigator.clipboard.writeText(`${text}\n\n영상: ${videoUrl}`);
                            alert("레시피가 클립보드에 복사되었습니다!");
                          }
                        }}
                        className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                      >
                        공유
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (r.db_id && confirm("이 레시피를 삭제할까요?")) handleDelete(r.db_id);
                        }}
                        className="text-gray-300 hover:text-red-500 px-3 py-1.5 rounded-full text-xs transition-colors cursor-pointer"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 하단 로그아웃 + 관리 */}
      <div className="max-w-3xl mx-auto px-4 mt-12 pb-8 text-center">
        <p className="text-xs text-gray-400 mb-2">
          {user.user_metadata?.name || user.email}
        </p>
        <div className="flex items-center justify-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setView("admin"); loadAdminStats(); }}
              className="text-xs text-gray-400 hover:text-orange-500 transition-colors cursor-pointer px-3 py-2"
            >
              관리
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              refreshAuth();
            }}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer px-3 py-2"
          >
            로그아웃
          </button>
        </div>
      </div>
    </main>
  );
}
