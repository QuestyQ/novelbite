# ADR 001: Deterministic heuristics before machine learning

## Status

Accepted for v1.0.0.

## Context

NovelBite has a small fictional catalogue and, for a new user, almost no behavioural data. A machine-learning model would therefore add operational complexity without a credible training signal. It would also make ranking explanations and regression testing harder.

## Decision

Use an inspectable deterministic scoring pipeline:

- dataset-derived base score;
- exact-build novelty;
- family and ingredient exposure;
- personal feedback;
- shift/heaviness fit;
- queue diversity constraints;
- stable ID tie-breaking.

## Consequences

Positive:

- reproducible recommendations;
- straightforward unit tests;
- clear user-facing explanations;
- no model hosting or training pipeline;
- privacy-preserving local mode.

Trade-offs:

- weights are manually selected;
- interactions are less expressive than a mature learned model;
- long-term personalization is bounded by the defined signals.

## Revisit condition

Consider a learned ranking layer only after there is consented, sufficiently large, well-labelled feedback data and a baseline experiment shows a measurable improvement over the deterministic engine.
