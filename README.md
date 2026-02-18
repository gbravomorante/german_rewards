# German Rewards Trainer (A1-B2)

Minimal local-first web app to study German with:
- English ↔ German vocabulary prompts (including articles/pronouns in prompts and notes)
- Verb conjugation reference tables
- Grammar notes
- Spaced repetition for wrong answers
- Local progress tracking per user (no password)
- Reward vault with random, non-repeated unlocks in tiers A1, A2, B1

## Run locally (Windows-friendly)

Because the app loads JSON files, run it from a local web server (not `file://`).

### Option 1: Python (recommended)
```powershell
cd german_rewards
py -m http.server 8080
```
Then open `http://localhost:8080`.

### Option 2: VS Code Live Server
Open this folder and run "Open with Live Server".

## Hosting on Windows
You can host these static files with IIS, Nginx, Apache, or any static host. Just keep file structure intact.

## Reward vault structure
- Configure reward metadata in `rewards/rewards.json`
- Put media in:
  - `rewards/A1/`
  - `rewards/A2/`
  - `rewards/B1/`

Each reward entry needs:
```json
{
  "id": "unique-id",
  "title": "Reward title",
  "type": "image|gif|video",
  "path": "rewards/A1/your-file.ext"
}
```

## Course content
Main learning content lives in `data/course.json`.

You can expand this with your own noun/verb/phrase database. If you provide data in a consistent format, it can be imported into this structure.

## PWA readiness
A base `manifest.webmanifest` is included so this can evolve into an Android PWA later.
