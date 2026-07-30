# NovelBite data

NovelBite publishes the complete pipeline for a small, fictional dataset while keeping
the original private menu out of the repository.

## Directories

- `sample/menu-blueprint.json` is the readable source used to create the demonstration workbook.
- `sample/novelbite-demo.xlsx` is the portfolio-safe Excel source of truth.
- `generated/catalog.json` is the readable application catalogue.
- `generated/catalog.packed.json` demonstrates the compact column-and-row representation.
- `generated/catalog-meta.json` records the workbook checksum and version metadata.

## Rebuild

```bash
npm ci
npm run data:refresh
```

The build expands four fictional dishes into 296 eligible combinations, removes
duplicate signatures, calculates novelty/heaviness/base scores, writes both readable
and packed JSON, and validates the result.

No restaurant-owned menu, production data, personal comments, or real schedules are
included.
