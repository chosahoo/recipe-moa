"use client";

import { SavedRecipe } from "@/types/recipe";
import { updateCheckedSteps, toggleFavorite } from "@/lib/recipes-db";
import Image from "next/image";
import { useState, useEffect } from "react";

function Thumbnail({ src, alt, width, height, className }: { src: string; alt: string; width: number; height: number; className: string }) {
  const [imgSrc, setImgSrc] = useState(src);
  useEffect(() => { setImgSrc(src); }, [src]);

  const videoId = src.match(/\/vi\/([^/]+)\//)?.[1];

  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={imgSrc} alt={alt} width={width} height={height} className={className} onError={() => {
    if (!videoId) return;
    if (imgSrc.includes("hqdefault")) setImgSrc(`https://img.youtube.com/vi/${videoId}/default.jpg`);
    else if (imgSrc.includes("/default.jpg")) setImgSrc(`https://img.youtube.com/vi/${videoId}/0.jpg`);
  }} />;
}

interface Props {
  recipe: SavedRecipe;
  onDelete?: (dbId: string) => void;
  onFavoriteChange?: () => void;
  onBack?: () => void;
  onGuestFavorite?: () => void;
}

// "돼지고기 목살 500g" → 숫자 부분만 비율 계산
function formatNumber(n: number): string {
  if (n % 1 === 0) return n.toString();
  // 깔끔한 분수로 표현 가능한지 확인
  const fractions: [number, string][] = [
    [1/4, "1/4"], [1/3, "1/3"], [1/2, "1/2"],
    [2/3, "2/3"], [3/4, "3/4"],
  ];
  for (const [val, str] of fractions) {
    if (Math.abs(n - val) < 0.001) return str;
    if (n > 1) {
      const whole = Math.floor(n);
      const frac = n - whole;
      for (const [fVal, fStr] of fractions) {
        if (Math.abs(frac - fVal) < 0.001) return `${whole}과${fStr}`;
      }
    }
  }
  return n % 1 === 0 ? n.toString() : n.toFixed(1).replace(/\.0$/, "");
}

function adjustIngredient(ingredient: string, ratio: number): string {
  if (ratio === 1) return ingredient;
  const units = "개|큰술|작은술|컵|대|줄|봉|통|근|장|조각|쪽|알|톨|마리|포기|숟갈|스푼|티스푼";
  return ingredient
    // 한글 "반" 수량 처리 (양파 반개, 반 큰술 등)
    .replace(new RegExp(`반\\s*(${units})`, "g"), (_, unit) => {
      const adjusted = 0.5 * ratio;
      return adjusted === 0.5 ? `반${unit}` : `${formatNumber(adjusted)}${unit}`;
    })
    // 분수(1/4, 1/2 등)를 먼저 처리
    .replace(/(\d+)\/(\d+)/g, (_, num, den) => {
      const adjusted = (parseInt(num) / parseInt(den)) * ratio;
      return formatNumber(adjusted);
    }).replace(/(?<!\/)(\d+\.?\d*)(?!\/|\d)/g, (match) => {
      const num = parseFloat(match);
      const adjusted = num * ratio;
      return formatNumber(adjusted);
    });
}

export default function RecipeCard({ recipe, onDelete, onFavoriteChange, onBack, onGuestFavorite }: Props) {
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>(
    recipe.checked_steps
  );
  const [favorite, setFavorite] = useState(recipe.is_favorite);
  const baseServings = recipe.recipe.servings || 1;
  const [servings, setServings] = useState(baseServings);
  const ratio = servings / baseServings;

  const toggleStep = (index: number) => {
    const next = [...checkedSteps];
    next[index] = !next[index];
    setCheckedSteps(next);
    if (recipe.db_id) {
      updateCheckedSteps(recipe.db_id, next);
    }
  };

  const [guestToast, setGuestToast] = useState(false);

  const handleFavorite = async () => {
    if (!recipe.db_id) {
      if (onGuestFavorite) {
        onGuestFavorite();
      } else {
        setGuestToast(true);
        setTimeout(() => setGuestToast(false), 2500);
      }
      return;
    }
    const next = !favorite;
    setFavorite(next);
    await toggleFavorite(recipe.db_id, next);
    onFavoriteChange?.();
  };

  const handleShare = () => {
    const text = `${recipe.recipe.food_name} 레시피 (${servings}인분)\n\n재료: ${recipe.recipe.ingredients.map((ing) => adjustIngredient(ing, ratio)).join(", ")}\n\n조리 순서:\n${recipe.recipe.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${recipe.recipe.tips ? `\n\n팁: ${recipe.recipe.tips}` : ""}`;
    const url = `https://www.youtube.com/watch?v=${recipe.video_id}`;

    if (navigator.share) {
      navigator.share({ title: recipe.recipe.food_name, text, url });
    } else {
      navigator.clipboard.writeText(`${text}\n\n영상: ${url}`);
      alert("레시피가 클립보드에 복사되었습니다!");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden max-w-2xl w-full">
      <div className="relative">
        <Thumbnail
          src={recipe.thumbnail}
          alt={recipe.recipe.food_name}
          width={640}
          height={360}
          className="w-full h-48 sm:h-56 object-cover"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="bg-white/90 hover:bg-white text-gray-700 w-9 h-9 rounded-full shadow-lg flex items-center justify-center transition-colors cursor-pointer"
            >
              &#8592;
            </button>
          )}
        </div>
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={handleFavorite}
            className="bg-white/90 hover:bg-white w-9 h-9 rounded-full shadow-lg flex items-center justify-center transition-colors cursor-pointer text-lg"
          >
            {favorite ? "\u2605" : "\u2606"}
          </button>
          <button
            onClick={handleShare}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg transition-colors cursor-pointer"
          >
            공유하기
          </button>
        </div>
      </div>

      {guestToast && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2.5 text-center text-sm text-orange-700 font-medium">
          로그인하면 즐겨찾기를 저장할 수 있어요!
        </div>
      )}
      <div className="p-5 sm:p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {recipe.recipe.food_name}
        </h2>
        <a
          href={`https://www.youtube.com/watch?v=${recipe.video_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-1.5 rounded-full text-xs font-medium transition-colors mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          &#x1F449; 원본 영상 보기
        </a>

        {/* 인분 조절 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-orange-600">재료</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setServings(Math.max(1, servings - 1))}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center cursor-pointer transition-colors"
              >
                -
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[4rem] text-center">
                {servings}인분
              </span>
              <button
                onClick={() => setServings(servings + 1)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center cursor-pointer transition-colors"
              >
                +
              </button>
            </div>
          </div>
          {servings !== baseServings && (
            <p className="text-xs text-gray-400 mb-2">
              기준: {baseServings}인분
            </p>
          )}
          {recipe.recipe.ingredients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recipe.recipe.ingredients.map((ing, i) => (
                <span
                  key={i}
                  className="bg-orange-50 text-orange-800 px-3 py-1 rounded-full text-sm"
                >
                  {adjustIngredient(ing, ratio)}
                </span>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl shrink-0">&#x1F916;</span>
              <p className="text-sm text-gray-500">
                유튜브 설명이나 댓글에 재료 정보가 없어서 AI가 담지 못했어요. 영상을 참고해주세요.
              </p>
            </div>
          )}
        </div>

        <div className="mb-5">
          <h3 className="text-lg font-semibold text-orange-600 mb-2">
            조리 순서
          </h3>
          {recipe.recipe.steps.length > 0 ? (
            <ol className="space-y-2">
              {recipe.recipe.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checkedSteps[i] || false}
                    onChange={() => toggleStep(i)}
                    className="mt-1 w-5 h-5 rounded accent-orange-500 shrink-0 cursor-pointer"
                  />
                  <span
                    className={`text-sm leading-relaxed ${checkedSteps[i] ? "line-through text-gray-400" : "text-gray-700"}`}
                  >
                    <span className="font-semibold text-gray-900">
                      {i + 1}.
                    </span>{" "}
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-xl shrink-0">&#x1F916;</span>
              <p className="text-sm text-gray-500">
                유튜브 설명이나 댓글에 조리 순서가 없어서 AI가 담지 못했어요. 영상을 참고해주세요.
              </p>
            </div>
          )}
        </div>

        {recipe.recipe.ingredients.length === 0 && recipe.recipe.steps.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-2">
            <span className="text-xl shrink-0">&#x1F916;</span>
            <p className="text-sm text-amber-700">
              이 영상은 설명란·댓글에 레시피 정보가 없어서 AI가 재료와 조리 순서를 담지 못했어요. 원본 영상을 직접 확인해주세요.
            </p>
          </div>
        )}

        {recipe.recipe.tips && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Tip:</span> {recipe.recipe.tips}
            </p>
          </div>
        )}

        {onDelete && recipe.db_id && (
          <button
            onClick={() => onDelete(recipe.db_id!)}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
