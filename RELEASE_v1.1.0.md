# NovelBite v1.1.0 release

## Before committing

```powershell
npm ci
npm run release:check
git status
```

Confirm `dist/`, `node_modules/`, `public/config.js`, `.env` and ZIP files are not staged.

## Commit

```powershell
git add .
git commit -m "feat: make NovelBite product-first and restore advanced discovery"
git push
```

## Verify Cloudflare

The repository now includes `wrangler.jsonc` and no longer includes the conflicting `public/_redirects` file.

Cloudflare settings:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

## Tag after CI and deployment pass

```powershell
git tag -a v1.1.0 -m "NovelBite v1.1.0"
git push origin v1.1.0
gh release create v1.1.0 --repo QuestyQ/novelbite --title "NovelBite v1.1.0" --generate-notes
```
