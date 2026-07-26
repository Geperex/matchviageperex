# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## Project overview

**#MatchViaGeperex** is a single-page React app for AI-assisted CV/résumé screening, built for **Geperex Limitada** (Chilean recruitment/HR consulting). A recruiter uploads a job-profile document and up to 3 candidate CVs; the app extracts a structured job profile and scores/ranks candidates against it using Claude (Anthropic), called through a serverless proxy.

All UI copy and prompts are in **Spanish**, targeting Chilean public/private-sector recruitment ("Metodología #MatchViaGeperex"). Keep new copy in Spanish to match.

There is no backend database (no Supabase, no persistence layer) — all app state lives in React `useState`, reset on reload. There is no authentication.

## Tech stack

- **React 18** + **Vite 5** (`@vitejs/plugin-react`), plain JSX, no TypeScript.
- No CSS framework. Styling is inline `style={{...}}` objects driven by a shared color/design-token object `C` defined near the top of `src/App.jsx`, plus one injected `<style>{CSS}</style>` template-literal block for animations/utility classes.
- No component library, no router, no state-management library (no Redux/Zustand/Context) — everything is local `useState`/`useRef` in `App`.
- No lockfile is committed — package manager is effectively npm (matches `netlify.toml`'s `npm run build`), but don't assume a specific manager without checking with the user if it matters.

## Directory structure

```
matchviageperex/
├── index.html              # Vite entry; mounts #root, loads /src/main.jsx, Google Fonts
├── vite.config.js          # Vite + React plugin; excludes pdfjs-dist from optimizeDeps
├── netlify.toml             # Build (dist/) + /api/* → /.netlify/functions/* redirect
├── public/favicon.svg
├── src/
│   ├── main.jsx              # React root render (StrictMode + App)
│   ├── App.jsx                # ~1160 lines — THE app: design tokens, prompts, every UI
│   │                          #   component, and all business logic (uploads, API calls,
│   │                          #   JSON repair, CSV export)
│   ├── extractor.js           # Client-side text extraction: PDF.js + Tesseract OCR fallback,
│   │                          #   .docx via JSZip, .txt via FileReader
│   └── index.css              # Global base styles (dark-theme vars — largely unused/stale
│                              #   next to the light navy/gold palette actually used in App.jsx)
└── netlify/functions/
    └── analyze.js              # Single serverless function: proxies POST /api/analyze →
                                 #   Anthropic Messages API, injects ANTHROPIC_API_KEY server-side
```

There is no `pages/`, `app/` (App Router), separate `components/` folder, `supabase/`, `docs/`, or test directory. Almost the entire app is `src/App.jsx`.

## Working in `src/App.jsx`

This one file contains everything: design tokens (`C`), CSS, and every component (`DropZone`, `FileItem`, `ScoreRing`, `RecoBadge`, `BarRow`, `ProfileFieldRow`, `ProfileCard`, `MatchDetailTable`, `CompetencyContrastTable`, `CandidateCard`, `ComparativePanel`, `StepHeader`) as local function declarations, plus the default-exported `App`. There's no existing convention for splitting components into files — if the user wants that refactor, confirm scope first rather than doing a silent large rewrite.

Two client→server call sites talk to `/api/analyze`:
- `callExtractAPI` — extracts a structured job profile from the uploaded profile doc (model `claude-haiku-4-5-20251001`, `max_tokens: 1500`).
- `callAnalyze` — scores/ranks candidate CVs against the profile (same model, `max_tokens: 3000`).

Both do manual cleanup of the LLM's text response: strip markdown code fences, regex-extract the `{...}` JSON, and fall back to a hand-rolled `repairJSON` that trims to the last complete `"recommendation"` object and balances braces/brackets if the response was truncated. If you change the prompts or response shape, keep this repair logic in sync — it's load-bearing, not decorative.

The scoring methodology is embedded directly in the Spanish prompt strings (`PROMPT_EXTRACT_PROFILE`, `PROMPTS.profile`) with fixed weights: Formación 30%, Exp. General 25%, Exp. Específica 25%, Formación Complementaria 10%, Condiciones 10%. Treat these prompts as the actual business logic — changing wording changes scoring behavior, so be deliberate.

There's visually confusing structure around `callAnalyze` / `ready`/`analyze()`/`exportCSV()`/`reset()` (roughly lines 799–880) where function boundaries are easy to misread. The app builds and runs, so it's not a real syntax error, but read carefully (don't just pattern-match indentation) before editing that region.

"Créditos" (credits) is a fake client-only counter (`useState(50)`) with no backend enforcement and no real payment integration — don't assume it gates anything server-side.

## `src/extractor.js`

Handles file→text extraction for uploaded CVs/profiles:
1. PDF → PDF.js (loaded from a **CDN**, `cdnjs.cloudflare.com/.../pdf.js/3.11.174/...`), with Tesseract.js OCR (also CDN, `cdn.jsdelivr.net/npm/tesseract.js@5/...`) as a fallback for scanned/image-only PDFs.
2. `.docx` → JSZip (CDN-loaded, not a bundled dependency at all).
3. `.txt` → plain `FileReader`.

**Important inconsistency to know about:** `package.json` lists `pdfjs-dist@4.4.168` and `tesseract.js@5.1.0` as dependencies, but the actual runtime code loads different versions from CDNs instead of importing the npm packages (PDF.js 3.11.174, Tesseract 5.x via CDN; JSZip isn't in `package.json` at all). If you touch extraction logic, be aware you're editing the CDN-loaded code path, and the `package.json` entries may be vestigial — confirm with the user before "fixing" this mismatch, since it may be intentional (e.g. to avoid bundling these into the Vite build).

## `netlify/functions/analyze.js`

Plain `exports.handler` (not the typed `@netlify/functions` helpers, despite that package being a devDependency). Adds CORS headers (`Access-Control-Allow-Origin: *`), reads `ANTHROPIC_API_KEY` from the environment, forwards `{ model, max_tokens (capped at 4000), system, messages }` to `https://api.anthropic.com/v1/messages` (`anthropic-version: 2023-06-01`), and passes the response straight through. This is the only place the API key is used — never move Anthropic calls to client-side code.

Comment in the file notes the Netlify Personal-plan function timeout is 26 seconds — keep prompt/response sizes in mind if you change `max_tokens` or add more analysis steps.

## Build, run, deploy

```
npm run dev       # Vite dev server
npm run build     # vite build -> dist/
npm run preview   # preview the production build
```

No `lint` or `test` script exists. `/api/analyze` will not work under plain `vite dev` — the Netlify Function only runs through `netlify dev` (Netlify CLI), which is not configured or documented in this repo. If you need to test the analyze endpoint locally, use `netlify dev` and confirm it's installed first.

Deploy is via Netlify (`netlify.toml`): `command = "npm run build"`, `publish = "dist"`, and a redirect from `/api/*` to `/.netlify/functions/:splat`. No `.github/workflows/`, no Dockerfile, no `vercel.json` — no CI/CD is defined in-repo.

## Testing & linting

None exist — no Jest/Vitest/Playwright, no ESLint/Prettier/Biome config, no test or lint scripts. If asked to add these, ask the user for their preferred tooling rather than assuming.

## Environment variables

- `ANTHROPIC_API_KEY` — required by `netlify/functions/analyze.js`; returns HTTP 500 with a Spanish error message if missing. No `.env.example` exists; `.env`/`.env.local` are gitignored, so set this via Netlify's dashboard or a local `.env` for `netlify dev`.

## Git conventions

- Commit messages are mostly auto-generated style: `Update App.jsx`, `Create analyze.js`, `Delete netlify/functions/analyze.mjs` — filename-based, no Conventional Commits prefixes. Match this style unless the user asks for something more descriptive.
- No `.github/` directory — no PR template, no CODEOWNERS, no Actions workflows.
- `main` is the default branch.

## When making changes

- This is a single-page, no-router, no-backend-database app — don't introduce routing, a state library, or a database unless explicitly asked.
- Keep all user-facing copy and prompts in Spanish.
- Never call the Anthropic API directly from the client — always route through `netlify/functions/analyze.js` so `ANTHROPIC_API_KEY` stays server-side.
- If you change the LLM prompts or expected JSON shape, update the corresponding `repairJSON`/parsing logic in `App.jsx` in the same change.
- Don't "fix" the pdfjs-dist/tesseract.js CDN-vs-npm-package version mismatch without checking with the user first — it may be intentional.
