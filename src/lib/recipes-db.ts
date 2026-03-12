import { createClient } from "./supabase";
import { RecipeResponse, SavedRecipe } from "@/types/recipe";

function getSupabase() {
  return createClient();
}

export async function getSavedRecipes(): Promise<SavedRecipe[]> {
  const { data, error } = await getSupabase()
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    video_id: row.video_id,
    title: row.title,
    thumbnail: row.thumbnail,
    recipe: {
      food_name: row.food_name,
      category: row.category ?? "기타",
      ingredients: row.ingredients,
      steps: row.steps,
      tips: row.tips,
    },
    saved_at: row.created_at,
    checked_steps: row.checked_steps,
    is_favorite: row.is_favorite ?? false,
    db_id: row.id,
  }));
}

export async function saveRecipe(
  recipe: RecipeResponse,
  userId: string
): Promise<SavedRecipe> {
  const row = {
    user_id: userId,
    video_id: recipe.video_id,
    title: recipe.title,
    thumbnail: recipe.thumbnail,
    food_name: recipe.recipe.food_name,
    category: recipe.recipe.category ?? "기타",
    ingredients: recipe.recipe.ingredients,
    steps: recipe.recipe.steps,
    tips: recipe.recipe.tips,
    checked_steps: new Array(recipe.recipe.steps.length).fill(false),
    is_favorite: false,
  };

  const { data, error } = await getSupabase()
    .from("recipes")
    .upsert(row, { onConflict: "user_id,video_id" })
    .select()
    .single();

  if (error) throw error;

  return {
    video_id: data.video_id,
    title: data.title,
    thumbnail: data.thumbnail,
    recipe: {
      food_name: data.food_name,
      category: data.category ?? "기타",
      ingredients: data.ingredients,
      steps: data.steps,
      tips: data.tips,
    },
    saved_at: data.created_at,
    checked_steps: data.checked_steps,
    is_favorite: data.is_favorite ?? false,
    db_id: data.id,
  };
}

export async function updateCheckedSteps(
  recipeId: string,
  checkedSteps: boolean[]
): Promise<void> {
  const { error } = await getSupabase()
    .from("recipes")
    .update({ checked_steps: checkedSteps })
    .eq("id", recipeId);

  if (error) throw error;
}

export async function toggleFavorite(
  recipeId: string,
  isFavorite: boolean
): Promise<void> {
  const { error } = await getSupabase()
    .from("recipes")
    .update({ is_favorite: isFavorite })
    .eq("id", recipeId);

  if (error) throw error;
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("recipes")
    .delete()
    .eq("id", recipeId);

  if (error) throw error;
}
