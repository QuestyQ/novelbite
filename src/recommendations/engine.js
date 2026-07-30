const ENGINE_VERSION = "1.0.0";

export { ENGINE_VERSION };

export function normalizeIngredient(value = "") {
  return String(value)
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function canonicalAdditionNames(additions = []) {
  return additions.map((item) => normalizeIngredient(item.name ?? item)).sort();
}

export function mealSignature(meal) {
  const family = normalizeIngredient(meal.repetitionFamily || meal.name);
  return `${family}::${canonicalAdditionNames(meal.additions).join("|")}`;
}

export function deriveRepetitionFamily(meal) {
  if (meal.repetitionFamily) return normalizeIngredient(meal.repetitionFamily);
  const style = normalizeIngredient(meal.style);
  const category = normalizeIngredient(meal.category);
  if (category === "pizza" && ["classic", "romana"].includes(style)) return "pizza";
  return normalizeIngredient(meal.name || category);
}

function daysBetween(isoDate, now) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(now.getTime() - date.getTime()) / 86_400_000;
}

function ingredientExposure(history) {
  const counts = new Map();
  for (const entry of history) {
    for (const ingredient of entry.additions || []) {
      const key = normalizeIngredient(ingredient.name ?? ingredient);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function familyFeedback(history, family) {
  const ratings = history
    .filter((entry) => deriveRepetitionFamily(entry) === family)
    .map((entry) => Number(entry.rating))
    .filter(Number.isFinite);
  if (!ratings.length) return 0;
  const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
  return (average - 3) * 0.22;
}

function targetHeaviness(context) {
  if (context.goal === "light") return 3.5;
  if (context.goal === "comfort") return 8;
  if (Number(context.shiftHours) >= 8) return 7;
  if (Number(context.shiftHours) <= 4 && Number(context.shiftHours) > 0) return 4.5;
  return 5.8;
}

export function scoreMeal(meal, context = {}, history = [], now = new Date()) {
  const signature = mealSignature(meal);
  const family = deriveRepetitionFamily(meal);
  const exactTries = history.filter((entry) => mealSignature(entry) === signature).length;
  const familyTries = history.filter((entry) => deriveRepetitionFamily(entry) === family).length;
  const exposures = ingredientExposure(history);
  const reasons = [];
  let score = Number(meal.baseScore ?? 7);

  if (exactTries === 0) {
    score += context.goal === "novelty" ? 1.55 : 0.9;
    reasons.push("an unseen combination");
  } else {
    score -= 2.2 + Math.min(exactTries - 1, 3) * 0.35;
    reasons.push("lowered because this exact build is already familiar");
  }

  score -= Math.min(familyTries, 5) * 0.18;
  score += familyFeedback(history, family);

  const additionNames = canonicalAdditionNames(meal.additions);
  const exposurePenalty = additionNames.reduce(
    (total, ingredient) => total + Math.min(exposures.get(ingredient) || 0, 4) * 0.12,
    0
  );
  score -= exposurePenalty;
  if (exposurePenalty < 0.25) reasons.push("low recent ingredient exposure");

  const hasEgg = (meal.additions || []).some(
    (addition) =>
      Boolean(addition.containsEgg) || normalizeIngredient(addition.name ?? addition).includes("egg")
  );
  const recentEgg = history.some(
    (entry) =>
      (entry.additions || []).some((addition) =>
        normalizeIngredient(addition.name ?? addition).includes("egg")
      ) && daysBetween(entry.eatenAt || entry.createdAt, now) <= 3
  );
  if (hasEgg && recentEgg) {
    score -= 1.85;
    reasons.push("egg is cooling down after a recent meal");
  }

  const heaviness = Number(meal.heaviness ?? 5);
  const weightGap = Math.abs(heaviness - targetHeaviness(context));
  score -= weightGap * 0.16;
  if (weightGap <= 1.4) reasons.push("a good weight for today’s shift");

  if (context.serviceMoment === "before" && heaviness > 7) {
    score -= 0.75;
  }

  if (context.naturalOnly) {
    const processedCount = (meal.additions || []).filter(
      (addition) => addition.natural === false
    ).length;
    score -= processedCount * 1.5;
  }

  return {
    meal,
    score: Number(score.toFixed(3)),
    reasons: reasons.slice(0, 3),
    engineVersion: ENGINE_VERSION
  };
}

export function rankMeals(catalog, context = {}, history = [], options = {}) {
  const excluded = new Set(options.excludeIds || []);
  return catalog
    .filter((meal) => !excluded.has(meal.id))
    .filter(
      (meal) =>
        !context.naturalOnly ||
        (meal.additions || []).every((addition) => addition.natural !== false)
    )
    .map((meal) => scoreMeal(meal, context, history, options.now || new Date()))
    .sort((left, right) => right.score - left.score || left.meal.id.localeCompare(right.meal.id));
}

function isHeavyLoadedFlatbread(meal) {
  return (
    normalizeIngredient(meal.category) === "flatbread" &&
    Number(meal.heaviness) >= 7 &&
    (meal.additions || []).length >= 3
  );
}

export function buildMealQueue(catalog, context = {}, history = [], size = 3) {
  const ranked = rankMeals(catalog, context, history);
  const queue = [];
  const selectedIds = new Set();
  const familyCounts = new Map();
  let heavyLoadedCount = 0;
  const familyLimit = size >= 4 ? 2 : 1;

  function eligible(candidate, enforceFamilyLimit = true) {
    if (selectedIds.has(candidate.meal.id)) return false;
    if (
      Number(context.shiftHours) <= 6 &&
      isHeavyLoadedFlatbread(candidate.meal) &&
      heavyLoadedCount >= 1
    ) return false;
    const family = deriveRepetitionFamily(candidate.meal);
    if (enforceFamilyLimit && (familyCounts.get(family) || 0) >= familyLimit) return false;
    return true;
  }

  function add(candidate) {
    const family = deriveRepetitionFamily(candidate.meal);
    queue.push(candidate);
    selectedIds.add(candidate.meal.id);
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    if (isHeavyLoadedFlatbread(candidate.meal)) heavyLoadedCount += 1;
  }

  for (const candidate of ranked) {
    if (eligible(candidate, true)) add(candidate);
    if (queue.length === size) return queue;
  }
  for (const candidate of ranked) {
    if (eligible(candidate, false)) add(candidate);
    if (queue.length === size) break;
  }
  return queue;
}
