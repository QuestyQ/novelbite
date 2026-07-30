# Recommendation engine

The engine is a set of pure functions in `src/recommendations/engine.js`. It accepts a
catalogue, a context object, and ledger history, then returns a stable ranked list.

## Identity and novelty

An exact taste signature combines the repetition family with alphabetically normalised
addition names. Sorting makes `mushroom + pepper` identical to `pepper + mushroom`.

Repetition families group styles that should share exposure. The tests explicitly group
Classic and Romana pizza fixtures, while the public dataset groups its two fictional
flatbread styles.

## Runtime signals

- unseen exact signatures receive a novelty bonus;
- tried exact signatures receive the strongest repetition penalty;
- recent family exposure receives a smaller capped penalty;
- each recently used ingredient contributes a capped exposure penalty;
- average family rating contributes a small positive or negative adjustment;
- recent egg use applies a cooldown only to egg-bearing builds;
- shift length and goal determine a target heaviness;
- before-shift context reduces very heavy choices;
- whole-food preference penalises explicitly non-natural additions.

## Queue diversity

Ranking individual meals is not enough: a queue can be monotonous even when every member
scores well. `buildMealQueue()` walks the ranked candidates while enforcing a context
constraint. For shifts of six hours or less, it permits at most one heavy,
three-addition flatbread.

## Determinism

Weights are fixed and scores are rounded to three decimal places. Ties resolve by
catalogue ID, so the same input produces the same output and test failures remain
reproducible.
