import type { MealDbIngredient, MealDbMeal } from "@/lib/ingest/themealdb";

function meal(id: string, title: string, pairs: [string, string][], extra: Partial<MealDbMeal> = {}): MealDbMeal {
  const m: MealDbMeal = {
    idMeal: id,
    strMeal: title,
    strMealAlternate: null,
    strCategory: "Chicken",
    strArea: "Italian",
    strCountry: "Italy",
    strInstructions: "step 1\r\nChop the onion.\r\n\r\nstep 2\r\nFry it in oil.",
    strMealThumb: `https://www.themealdb.com/images/media/meals/${id}.jpg`,
    strTags: "Pasta,Quick",
    strYoutube: "https://www.youtube.com/watch?v=abcdefghijk",
    strSource: "https://example.org/recipe",
    dateModified: null,
    ...extra,
  } as MealDbMeal;
  for (let i = 1; i <= 20; i++) {
    m[`strIngredient${i}`] = pairs[i - 1]?.[0] ?? "";
    m[`strMeasure${i}`] = pairs[i - 1]?.[1] ?? "";
  }
  return m;
}

export const fixtureMeals: MealDbMeal[] = [
  meal("1", "Garlic Chicken", [
    ["Chicken Thighs", "500g"],
    ["Garlic Clove", "3 cloves"],
    ["Onions", "1 chopped"],
    ["Salt", "to taste"],
    ["Parsley", "to garnish"],
  ]),
  meal("2", "Egg Fried Rice", [
    ["Rice", "2 cups"],
    ["Eggs", "2"],
    ["Spring Onions", "3"],
    ["Soy Sauce", "1 tbs"],
    ["Vegetable Oil", "1 tbsp"],
  ], { strCategory: "Vegetarian", strYoutube: "" }),
  // Same id as above: must be deduplicated.
  meal("2", "Egg Fried Rice", [["Rice", "2 cups"]]),
  meal("3", "Vegetarian Stir Fry", [
    ["Cilantro", "handful"],
    ["Chicken Stock", "200ml"],
    ["Scallions", "2"],
    ["Chicken", "1 whole"],
  ], { strCategory: "Vegetarian", strCountry: "", strMealThumb: "" }),
  { idMeal: "", strMeal: "" } as MealDbMeal,
];

export const fixtureIngredients: MealDbIngredient[] = [
  { idIngredient: "1", strIngredient: "Chicken", strDescription: null, strThumb: "https://www.themealdb.com/images/ingredients/chicken.png", strType: "Meat" },
  { idIngredient: "2", strIngredient: "Chicken Thighs", strDescription: null, strType: "Meat" },
  { idIngredient: "3", strIngredient: "Garlic", strDescription: null, strType: null },
  { idIngredient: "4", strIngredient: "Onion", strDescription: null, strType: null },
  { idIngredient: "5", strIngredient: "Egg", strDescription: null, strType: null },
  { idIngredient: "6", strIngredient: "Coriander", strDescription: null, strType: null },
];
