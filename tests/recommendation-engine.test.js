import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMealQueue,
  deriveRepetitionFamily,
  mealSignature,
  rankMeals,
  scoreMeal
} from "../src/recommendations/engine.js";
import { shouldLeadWithDessert } from "../src/schedule/shifts.js";

const addition = (name, extra = {}) => ({ name, natural: true, ...extra });
const meal = (id, additions, extra = {}) => ({
  id,
  name: "Test Dish",
  category: "Bowl",
  style: "Garden",
  repetitionFamily: "test-dish",
  additions,
  baseScore: 8,
  heaviness: 5.5,
  ...extra
});
const context = { shiftHours: 6, goal: "balanced", serviceMoment: "after" };

test("Classic and Romana pizza styles share a repetition family", () => {
  assert.equal(deriveRepetitionFamily({ category: "Pizza", style: "Classic" }), "pizza");
  assert.equal(deriveRepetitionFamily({ category: "Pizza", style: "Romana" }), "pizza");
});

test("an exact tried build ranks below an unseen build", () => {
  const tried = meal("tried", [addition("Mushroom")]);
  const unseen = meal("unseen", [addition("Courgette")]);
  const history = [{ ...tried, rating: 4, eatenAt: "2026-07-20T12:00:00Z" }];
  const ranked = rankMeals([tried, unseen], context, history, {
    now: new Date("2026-07-23T12:00:00Z")
  });
  assert.equal(ranked[0].meal.id, "unseen");
});

test("a new topping combination counts as a new taste", () => {
  const oldBuild = meal("old", [addition("Mushroom"), addition("Pepper")]);
  const newBuild = meal("new", [addition("Mushroom"), addition("Courgette")]);
  const history = [{ ...oldBuild, rating: 4, eatenAt: "2026-07-20T12:00:00Z" }];
  assert.notEqual(mealSignature(oldBuild), mealSignature(newBuild));
  assert.ok(scoreMeal(newBuild, context, history).score > scoreMeal(oldBuild, context, history).score);
});

test("egg cooldown changes the addition rather than excluding the dish", () => {
  const eggBuild = meal("egg", [addition("Soft egg", { containsEgg: true })]);
  const mushroomBuild = meal("mushroom", [addition("Wild mushroom")]);
  const history = [
    {
      ...meal("recent-egg", [addition("Jammy egg")]),
      rating: 4,
      eatenAt: "2026-07-22T12:00:00Z"
    }
  ];
  const ranked = rankMeals([eggBuild, mushroomBuild], context, history, {
    now: new Date("2026-07-23T12:00:00Z")
  });
  assert.equal(ranked[0].meal.name, eggBuild.name);
  assert.equal(ranked[0].meal.id, "mushroom");
});

test("Pesto chicken exposure lowers its ranking", () => {
  const pesto = meal("pesto", [addition("Pesto chicken")]);
  const withoutExposure = scoreMeal(pesto, context, []).score;
  const history = Array.from({ length: 3 }, (_, index) => ({
    ...meal(`history-${index}`, [addition("Pesto chicken"), addition(`Green ${index}`)]),
    rating: 3,
    eatenAt: `2026-07-${20 - index}T12:00:00Z`
  }));
  const withExposure = scoreMeal(pesto, context, history).score;
  assert.ok(withExposure < withoutExposure);
});

test("a six-hour shift prevents two heavy three-addition flatbreads", () => {
  const heavy = (id, baseScore) =>
    meal(id, [addition("A"), addition("B"), addition("C")], {
      name: `Flatbread ${id}`,
      category: "Flatbread",
      repetitionFamily: id,
      baseScore,
      heaviness: 8
    });
  const light = meal("light", [addition("Greens")], { baseScore: 7.5, heaviness: 3 });
  const queue = buildMealQueue([heavy("heavy-1", 10), heavy("heavy-2", 9.8), light], context, [], 2);
  assert.equal(queue.length, 2);
  assert.equal(queue.filter((item) => item.meal.category === "Flatbread").length, 1);
});

test("dessert-first activates only for the intended short-shift break", () => {
  const intended = {
    shiftHours: 4,
    serviceMoment: "break",
    minutesAvailable: 15,
    hasDessert: true
  };
  assert.equal(shouldLeadWithDessert(intended), true);
  assert.equal(shouldLeadWithDessert({ ...intended, shiftHours: 6 }), false);
  assert.equal(shouldLeadWithDessert({ ...intended, serviceMoment: "after" }), false);
  assert.equal(shouldLeadWithDessert({ ...intended, hasDessert: false }), false);
});

test("a five-item queue limits any one repetition family to two entries when alternatives exist", () => {
  const candidates = [
    ...[1, 2, 3].map((index) => meal(`a-${index}`, [addition(`A${index}`)], { repetitionFamily: "family-a", baseScore: 10 - index / 10 })),
    ...[1, 2, 3].map((index) => meal(`b-${index}`, [addition(`B${index}`)], { repetitionFamily: "family-b", baseScore: 9 - index / 10 })),
    ...[1, 2].map((index) => meal(`c-${index}`, [addition(`C${index}`)], { repetitionFamily: "family-c", baseScore: 8 - index / 10 }))
  ];
  const queue = buildMealQueue(candidates, { shiftHours: 9, goal: "novelty", serviceMoment: "break" }, [], 5);
  const counts = new Map();
  for (const item of queue) {
    const family = deriveRepetitionFamily(item.meal);
    counts.set(family, (counts.get(family) || 0) + 1);
  }
  assert.ok([...counts.values()].every((count) => count <= 2));
});
