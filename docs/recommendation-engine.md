# Recommendation engine

The engine is a set of pure functions in `src/recommendations/engine.js`. It accepts a catalogue, a context object and ledger history, then returns stable ranked candidates used by Discover, grouped Search and weighted Roulette.

## Identity and novelty

An exact taste signature combines the repetition family with alphabetically normalised addition names. Sorting makes `mushroom + pepper` identical to `pepper + mushroom`.

Repetition families group styles that should share exposure. The public dataset groups its two fictional flatbread styles while retaining exact-build identity for individual additions.

## Runtime signals

- unseen exact signatures receive a novelty bonus;
- tried exact signatures receive the strongest repetition penalty;
- recent family exposure receives a smaller capped penalty;
- each recently used ingredient contributes a capped exposure penalty;
- average family rating contributes a small positive or negative adjustment;
- recent egg use applies a cooldown only to egg-bearing builds;
- shift length and goal determine a target heaviness;
- before-shift context reduces very heavy choices;
- late after-shift context slightly favours bowls;
- whole-food preference penalises explicitly non-natural additions;
- an optional daily guard removes flatbreads after one has already been logged that day.

## Comparative food-balance metrics

`deriveMealMetrics()` calculates relative nutrition, satiety, protein and vegetable scores from the fictional ingredient names, natural/processed flag and heaviness value.

These values are ranking aids, not nutrient labels. They do not represent calories, grams of protein or medical guidance.

The user may prioritise:

- overall balance;
- relative nutrition;
- satiety;
- protein balance;
- vegetable variety;
- novelty.

## Queue diversity

Ranking individual meals is not enough because a queue can still be monotonous. `buildMealQueue()` walks ranked candidates while limiting repeated families. For shifts of six hours or less, it permits at most one heavy three-addition flatbread.

## Roulette

`weightedRoulettePick()` samples from a ranked candidate pool. Higher-scoring meals receive more weight, but eligible lower-ranked meals retain a chance of selection. The application excludes recent roulette draws to avoid immediate repetition.

## Determinism

The ranking model is deterministic. Weights are fixed, scores are rounded to three decimal places and ties resolve by catalogue ID. Roulette is intentionally stochastic, but its eligible pool and weights come from the same deterministic ranking functions and can be tested with an injected random function.
