import { createClient } from "./supabase";
import { RecipeResponse, SavedRecipe, UserProfile } from "@/types/recipe";

function getSupabase() {
  return createClient();
}

export async function getSavedRecipes(): Promise<SavedRecipe[]> {
  const { data, error } = await getSupabase()
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((row: any) => ({
    video_id: row.video_id,
    title: row.title,
    thumbnail: row.thumbnail,
    recipe: {
      food_name: row.food_name,
      category: row.category ?? "기타",
      servings: row.servings ?? 1,
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
    servings: recipe.recipe.servings ?? 1,
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
      servings: data.servings ?? 1,
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

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getOrCreateProfile(userId: string): Promise<UserProfile> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (data) return data as UserProfile;

  // Profile doesn't exist, create one
  if (error && error.code === "PGRST116") {
    const { data: newProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert({ user_id: userId, referral_code: generateReferralCode(), daily_limit: 1 })
      .select()
      .single();

    if (insertError) throw insertError;
    return newProfile as UserProfile;
  }

  throw error;
}

export async function getTodayExtractionCount(userId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await getSupabase()
    .from("extraction_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function logExtraction(userId: string, videoId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("extraction_log")
    .insert({ user_id: userId, video_id: videoId });

  if (error) throw error;
}

export async function applyReferral(referralCode: string, newUserId: string): Promise<boolean> {
  const supabase = getSupabase();

  // Find the referrer by code
  const { data: referrer, error: findError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("referral_code", referralCode)
    .single();

  if (findError || !referrer) return false;

  // Don't allow self-referral
  if (referrer.user_id === newUserId) return false;

  // Increase referrer's daily limit to 5 (idempotent)
  if (referrer.daily_limit < 5) {
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ daily_limit: 5 })
      .eq("user_id", referrer.user_id);

    if (updateError) throw updateError;
  }

  return true;
}
