# First public commit and v1.0.0 release

This package is prepared as a clean public repository. It intentionally excludes `node_modules`, `dist`, runtime configuration, private menu data and personal records.

## 1. Extract and verify

Open PowerShell in the extracted `novelbite` directory:

```powershell
node --version
npm ci
npm run release:check
```

Expected outcome:

- 296 valid fictional combinations;
- 26 tests passing;
- ranking benchmark below the release budget;
- successful production build;
- release audit passed.

## 2. Inspect the commit boundary

```powershell
git init
git branch -M main
git add .
git status
```

Confirm these are **not** staged:

```text
node_modules/
dist/
public/config.js
.env
*.zip
private menu data
personal meal exports
private branding or artwork
```

Inspect staged files:

```powershell
git diff --cached --stat
git diff --cached
```

## 3. Make the first commit

```powershell
git commit -m "feat: publish NovelBite v1.0.0"
```

Recommended commit scope:

- fictional Excel-to-JSON pipeline;
- deterministic recommendation engine;
- responsive priority-queue PWA;
- local and optional cloud ledger;
- Supabase RLS migrations;
- tests, coverage, benchmark and release audit;
- public documentation and an original product overview graphic.

## 4. Create the GitHub repository

Create an empty public GitHub repository named `novelbite` with no generated README or licence, because both already exist here.

Then paste its HTTPS remote when prompted:

```powershell
$remote = Read-Host "Paste the GitHub repository HTTPS URL"
git remote add origin $remote
git push -u origin main
```

Wait for the **CI** workflow to pass before continuing.

## 5. Add repository settings

Recommended topics:

```text
recommendation-system
javascript
vite
supabase
cloudflare-pages
pwa
data-pipeline
row-level-security
privacy-by-design
```

Enable:

- Issues;
- Dependabot alerts;
- private vulnerability reporting;
- branch protection requiring the CI check for future pull requests.

Do not require a pull request for the initial commit unless that is already part of your GitHub workflow.

## 6. Create a separate Supabase demo project

Skip this section when launching guest/local mode first.

Use a project created only for NovelBite. Apply, in order:

```text
supabase/migrations/001_personal_data_schema.sql
supabase/migrations/002_delete_own_account.sql
```

Before enabling public sign-in:

1. create two temporary users;
2. save a meal as user A;
3. confirm user B cannot read, modify or delete user A’s rows;
4. test JSON export, ledger deletion and account deletion;
5. remove the temporary accounts.

Configure the exact Cloudflare production URL as the Supabase Site URL. Add local and preview URLs separately as redirect URLs.

## 7. Create the Cloudflare Pages project

Choose **Workers & Pages → Create → Pages → Connect to Git**.

Use:

| Setting | Value |
| --- | --- |
| Repository | `novelbite` |
| Branch | `main` |
| Framework | None |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22.16.0` |

For guest/local mode, deploy without variables.

For signed-in demo mode, add:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPPORT_URL   optional
```

Never add a secret key, `service_role` key, database password, SMTP credential or Cloudflare API token to browser configuration.

## 8. Verify the production deployment

Test in desktop and mobile widths:

- guest demo loads;
- five recommendations render;
- rejecting one exact build promotes the next choice;
- Undo restores it;
- schedule accepts `0930` and overnight shifts;
- ledger opens on past meals and the composer is collapsed;
- a ledger rating changes subsequent ranking;
- export and deletion controls work;
- install prompt/PWA icons appear;
- offline reload works after the first successful visit;
- keyboard Escape and visible Close buttons exit dialogs.

When cloud mode is enabled, repeat ledger and schedule checks in two browsers.

## 9. Tag and publish v1.0.0

After production verification:

```powershell
git tag -a v1.0.0 -m "NovelBite v1.0.0"
git push origin v1.0.0
```

With GitHub CLI:

```powershell
gh release create v1.0.0 --title "NovelBite v1.0.0" --generate-notes
```

Attach a source ZIP only when needed. GitHub already provides source archives automatically; do not attach `node_modules`, local configuration or a private dataset.


## 10. Add real deployment screenshots

After the public URL is live, capture desktop and mobile screenshots from that deployment and add them in a second commit. Do not hold the initial release hostage to fake or browser-blocked screenshots. The repository already includes an original overview graphic.

Suggested commit:

```powershell
git add docs/screenshots README.md
git commit -m "docs: add live NovelBite screenshots"
git push
```

## 11. Suggested release description

> NovelBite v1.0.0 is a privacy-first recommendation PWA built around a fictional 296-combination dataset. The release includes a deterministic novelty-aware ranking engine, exact-build dismissal and replacement, weekly shift context, a personal feedback ledger, guest/local/cloud storage modes, Supabase RLS, an Excel-to-JSON pipeline, PWA support and automated release checks.
