const ENGINE_VERSION = "1.1.0";

export { ENGINE_VERSION };

export function normalizeIngredient(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[’‘']/g, "")
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
  if (category === "flatbread") return "flatbread";
  return normalizeIngredient(meal.name || category);
}

const PROTEIN_TERMS = ["chicken", "egg", "chickpea", "lentil", "tahini", "cheese", "barley", "seed"];
const VEGETABLE_TERMS = ["pepper", "mushroom", "courgette", "kale", "squash", "cucumber", "beetroot", "radish", "onion"];
const FIBRE_TERMS = ["barley", "chickpea", "lentil", "kale", "seed", "beetroot", "squash"];

function countTerms(names, terms) {
  return names.reduce((total, name) => total + Number(terms.some((term) => name.includes(term))), 0);
}

export function deriveMealMetrics(meal) {
  const names = canonicalAdditionNames(meal.additions);
  const proteinItems = countTerms(names, PROTEIN_TERMS);
  const vegetableItems = countTerms(names, VEGETABLE_TERMS);
  const fibreItems = countTerms(names, FIBRE_TERMS);
  const naturalItems = (meal.additions || []).filter((item) => item.natural !== false).length;
  const processedItems = (meal.additions || []).filter((item) => item.natural === false).length;
  const heaviness = Number(meal.heaviness ?? 5);

  const nutrition = Math.max(0, Math.min(10,
    4.8 + proteinItems * 0.72 + vegetableItems * 0.58 + fibreItems * 0.36 + naturalItems * 0.16 - processedItems * 0.48
  ));
  const satiety = Math.max(0, Math.min(10,
    3.7 + heaviness * 0.47 + proteinItems * 0.5 + fibreItems * 0.32
  ));
  const protein = Math.max(0, Math.min(10, 3 + proteinItems * 2.05));
  const vegetables = Math.max(0, Math.min(10, 2.7 + vegetableItems * 2.15));

  return {
    nutrition: Number(nutrition.toFixed(2)),
    satiety: Number(satiety.toFixed(2)),
    protein: Number(protein.toFixed(2)),
    vegetables: Number(vegetables.toFixed(2)),
    processedItems,
    naturalItems
  };
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

function priorityAdjustment(meal, context) {
  const metrics = deriveMealMetrics(meal);
  const priority = context.priority || "balanced";
  if (priority === "nutrition") return (metrics.nutrition - 6) * 0.42;
  if (priority === "satiety") return (metrics.satiety - 6) * 0.42;
  if (priority === "protein") return (metrics.protein - 5) * 0.34;
  if (priority === "vegetables") return (metrics.vegetables - 5) * 0.34;
  if (priority === "novelty") return (Number(meal.novelty ?? 6) - 6) * 0.3;
  return ((metrics.nutrition + metrics.satiety) / 2 - 6) * 0.18;
}

function eatenToday(entry, now) {
  const date = new Date(entry.eatenAt || entry.createdAt || 0);
  return !Number.isNaN(date.getTime()) && date.toDateString() === now.toDateString();
}

export function scoreMeal(meal, context = {}, history = [], now = new Date()) {
  const signature = mealSignature(meal);
  const family = deriveRepetitionFamily(meal);
  const exactTries = history.filter((entry) => mealSignature(entry) === signature).length;
  const familyTries = history.filter((entry) => deriveRepetitionFamily(entry) === family).length;
  const exposures = ingredientExposure(history);
  const metrics = deriveMealMetrics(meal);
  const reasons = [];
  let score = Number(meal.baseScore ?? 7);

  if (exactTries === 0) {
    score += context.goal === "novelty" || context.priority === "novelty" ? 1.55 : 0.9;
    reasons.push("new exact combination");
  } else {
    score -= 2.2 + Math.min(exactTries - 1, 3) * 0.35;
    reasons.push("exact build already familiar");
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
    (addition) => Boolean(addition.containsEgg) || normalizeIngredient(addition.name ?? addition).includes("egg")
  );
  const recentEgg = history.some(
    (entry) =>
      (entry.additions || []).some((addition) => normalizeIngredient(addition.name ?? addition).includes("egg")) &&
      daysBetween(entry.eatenAt || entry.createdAt, now) <= 3
  );
  if (hasEgg && recentEgg) {
    score -= 1.85;
    reasons.push("egg is cooling down");
  }

  const heaviness = Number(meal.heaviness ?? 5);
  const weightGap = Math.abs(heaviness - targetHeaviness(context));
  score -= weightGap * 0.16;
  if (weightGap <= 1.4) reasons.push("good weight for this shift");

  if (context.serviceMoment === "before" && heaviness > 7) score -= 0.75;

  const lateHour = Number(context.localHour ?? now.getHours());
  if (context.serviceMoment === "after" && lateHour >= 20) {
    if (normalizeIngredient(meal.category) === "bowl") {
      score += 0.55;
      reasons.push("lighter late-service route");
    } else if (heaviness > 7) score -= 0.55;
  }

  if (context.naturalOnly) {
    score -= metrics.processedItems * 1.5;
  }

  score += priorityAdjustment(meal, context);

  return {
    meal: { ...meal, metrics, signature },
    score: Number(score.toFixed(3)),
    reasons: reasons.slice(0, 3),
    metrics,
    exactTries,
    familyTries,
    engineVersion: ENGINE_VERSION
  };
}

export function matchesMealQuery(meal, query = "") {
  const normalized = normalizeIngredient(query);
  if (!normalized) return true;
  const haystack = normalizeIngredient([
    meal.name,
    meal.category,
    meal.style,
    ...(meal.additions || []).map((item) => item.name ?? item)
  ].join(" "));
  return normalized.split(" ").every((token) => haystack.includes(token));
}

export function filterMeals(catalog, context = {}, history = [], options = {}) {
  const exactSignatures = new Set(history.map((entry) => mealSignature(entry)));
  const now = options.now || new Date();
  const flatbreadAlreadyToday = history.some(
    (entry) => eatenToday(entry, now) && normalizeIngredient(entry.category) === "flatbread"
  );

  return catalog
    .filter((meal) => !options.excludeIds?.includes?.(meal.id))
    .filter((meal) => !context.category || context.category === "all" || normalizeIngredient(meal.category) === normalizeIngredient(context.category))
    .filter((meal) => matchesMealQuery(meal, context.query || ""))
    .filter((meal) => {
      if (!context.triedStatus || context.triedStatus === "all") return true;
      const tried = exactSignatures.has(mealSignature(meal));
      return context.triedStatus === "tried" ? tried : !tried;
    })
    .filter((meal) => !context.naturalOnly || (meal.additions || []).every((addition) => addition.natural !== false))
    .filter((meal) => {
      if (!context.avoidSecondFlatbread || !flatbreadAlreadyToday) return true;
      return normalizeIngredient(meal.category) !== "flatbread";
    });
}

export function rankMeals(catalog, context = {}, history = [], options = {}) {
  return filterMeals(catalog, context, history, options)
    .map((meal) => scoreMeal(meal, context, history, options.now || new Date()))
    .sort((left, right) => right.score - left.score || left.meal.id.localeCompare(right.meal.id));
}

function isHeavyLoadedFlatbread(meal) {
  return normalizeIngredient(meal.category) === "flatbread" && Number(meal.heaviness) >= 7 && (meal.additions || []).length >= 3;
}

export function buildMealQueue(catalog, context = {}, history = [], size = 5, options = {}) {
  const ranked = rankMeals(catalog, context, history, options);
  const queue = [];
  const selectedIds = new Set();
  const familyCounts = new Map();
  let heavyLoadedCount = 0;
  const familyLimit = size >= 4 ? 2 : 1;

  function eligible(candidate, enforceFamilyLimit = true) {
    if (selectedIds.has(candidate.meal.id)) return false;
    if (Number(context.shiftHours) <= 6 && isHeavyLoadedFlatbread(candidate.meal) && heavyLoadedCount >= 1) return false;
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

export function weightedRoulettePick(catalog, context = {}, history = [], options = {}) {
  const ranked = rankMeals(catalog, context, history, options).slice(0, options.poolSize || 60);
  if (!ranked.length) return null;
  const floor = Math.min(...ranked.map((item) => item.score)) - 0.5;
  const weights = ranked.map((item, index) => Math.max(0.2, item.score - floor) * Math.max(0.35, 1 - index / (ranked.length * 1.4)));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let target = (options.random || Math.random)() * total;
  for (let index = 0; index < ranked.length; index += 1) {
    target -= weights[index];
    if (target <= 0) return ranked[index];
  }
  return ranked.at(-1);
}
