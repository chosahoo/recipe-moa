export interface Recipe {
  food_name: string;
  category: string;
  servings: number;
  ingredients: string[];
  steps: string[];
  tips: string;
}

export interface RecipeResponse {
  video_id: string;
  title: string;
  thumbnail: string;
  recipe: Recipe;
}

export interface SavedRecipe extends RecipeResponse {
  saved_at: string;
  checked_steps: boolean[];
  is_favorite: boolean;
  db_id?: string;
}

export interface UserProfile {
  user_id: string;
  referral_code: string;
  daily_limit: number;
  created_at: string;
}
