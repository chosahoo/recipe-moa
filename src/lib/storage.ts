import { SavedRecipe, RecipeResponse } from "@/types/recipe";

const STORAGE_KEY = "saved_recipes";

export function getSavedRecipes(): SavedRecipe[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveRecipe(recipe: RecipeResponse): SavedRecipe {
  const recipes = getSavedRecipes();
  const saved: SavedRecipe = {
    ...recipe,
    saved_at: new Date().toISOString(),
    checked_steps: new Array(recipe.recipe.steps.length).fill(false),
    is_favorite: false,
  };
  // 중복 방지 (같은 video_id)
  const filtered = recipes.filter((r) => r.video_id !== recipe.video_id);
  filtered.unshift(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return saved;
}

export function updateCheckedSteps(
  videoId: string,
  checkedSteps: boolean[]
): void {
  const recipes = getSavedRecipes();
  const idx = recipes.findIndex((r) => r.video_id === videoId);
  if (idx !== -1) {
    recipes[idx].checked_steps = checkedSteps;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }
}

export function deleteRecipe(videoId: string): void {
  const recipes = getSavedRecipes().filter((r) => r.video_id !== videoId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}
