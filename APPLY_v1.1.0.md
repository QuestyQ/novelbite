# Apply NovelBite v1.1.0 to the existing repository

1. Extract this ZIP directly into the repository root and allow the listed files to overwrite their v1.0 versions.
2. Remove the legacy redirect file if it still exists:

```powershell
if (Test-Path public\_redirects) { git rm public\_redirects }
```

3. Verify the update:

```powershell
npm ci
npm run release:check
```

4. Review what changed:

```powershell
git status
git diff --stat
git diff
```

5. Commit and push:

```powershell
git add .
git commit -m "feat: make NovelBite product-first and restore advanced discovery"
git push
```

6. Cloudflare settings remain:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
```

7. `supabase/migrations/003_meal_feedback.sql` is optional. Apply it to retain fullness, repeat intent and next-time notes in cloud mode. Local and guest modes support those fields immediately.

8. After CI and Cloudflare pass:

```powershell
git tag -a v1.1.0 -m "NovelBite v1.1.0"
git push origin v1.1.0
gh release create v1.1.0 --repo QuestyQ/novelbite --title "NovelBite v1.1.0" --generate-notes
```
