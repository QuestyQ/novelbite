# Scoring methodology

NovelBite uses two scoring stages.

## Catalogue-time score

The Excel converter calculates descriptive values for every combination:

```text
novelty = mean(addition novelty)
heaviness = dish base heaviness + 0.72 * sum(addition heaviness)
base score =
  dish base score
  + 0.13 * novelty
  + 0.06 * balance around a medium target
  + 0.18 * whole-food ratio
```

Scores and heaviness are capped at 10. These formulas are deliberately simple, visible,
and executable in `scripts/excel-to-json.mjs`.

## Recommendation-time score

The engine starts with the base score, then applies:

| Signal | Effect |
| --- | --- |
| Unseen exact build | `+0.90` (`+1.55` for novelty goal) |
| Tried exact build | `-2.20`, plus capped repeat penalty |
| Repetition-family exposure | `-0.18` per recent entry, capped |
| Ingredient exposure | `-0.12` per exposure, capped per ingredient |
| Family feedback | `(average rating - 3) * 0.22` |
| Recent egg | `-1.85` to egg-bearing builds |
| Heaviness mismatch | `-0.16 * absolute target gap` |
| Heavy before-shift meal | `-0.75` |
| Non-natural preferred away | `-1.50` per marked addition |

These weights are product heuristics, not nutritional claims. Their purpose is to make
the trade-offs inspectable and testable.

## Evaluation

The repository tests invariants and directional behavior rather than asserting every
floating-point score. A future evaluation should use consented, anonymised preference
outcomes and compare ranking quality against simple baselines.
