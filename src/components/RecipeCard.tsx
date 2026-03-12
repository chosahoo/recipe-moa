"use client";

import { SavedRecipe } from "@/types/recipe";
import { updateCheckedSteps, toggleFavorite } from "@/lib/recipes-db";
import Image from "next/image";
import { useState } from "react";

interface Props {
  recipe: SavedRecipe;
  onDelete?: (dbId: string) => void;
  onFavoriteChange?: () => void;
  onBack?: () => void;
}

export default function RecipeCard({ recipe, onDelete, onFavoriteChange, onBack }: Props) {
  const [checkedSteps, setCheckedSteps] = useState<boolean[]>(
    recipe.checked_steps
  );
  const [favorite, setFavorite] = useState(recipe.is_favorite);

  const toggleStep = (index: number) => {
    const next = [...checkedSteps];
    next[index] = !next[index];
    setCheckedSteps(next);
    if (recipe.db_id) {
      updateCheckedSteps(recipe.db_id, next);
    }
  };

  const handleFavorite = async () => {
    if (!recipe.db_id) return;
    const next = !favorite;
    setFavorite(next);
    await toggleFavorite(recipe.db_id, next);
    onFavoriteChange?.();
  };

  const handleShare = () => {
    const text = `${recipe.recipe.food_name} 레시피\n\n재료: ${recipe.recipe.ingredients.join(", ")}\n\n조리 순서:\n${recipe.recipe.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${recipe.recipe.tips ? `\n\n팁: ${recipe.recipe.tips}` : ""}`;
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
        <Image
          src={recipe.thumbnail}
          alt={recipe.title}
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

      <div className="p-5 sm:p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {recipe.recipe.food_name}
        </h2>
        <p className="text-sm text-gray-500 mb-4 truncate">{recipe.title}</p>

        <div className="mb-5">
          <h3 className="text-lg font-semibold text-orange-600 mb-2">재료</h3>
          <div className="flex flex-wrap gap-2">
            {recipe.recipe.ingredients.map((ing, i) => (
              <span
                key={i}
                className="bg-orange-50 text-orange-800 px-3 py-1 rounded-full text-sm"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <h3 className="text-lg font-semibold text-orange-600 mb-2">
            조리 순서
          </h3>
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
        </div>

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
