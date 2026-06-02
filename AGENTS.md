# AGENTS.md — Cyberpunk RPG: Omega Protocol

## What this is
AI-powered text RPG with a Flutter client, Node.js/Express backend, and an alternative Cloudflare Workers deployment. The AI ("Chip") narrates a cyberpunk story, tracks stats, and generates location images.

## Workspace structure
```
C:\Projects\ai-rpg-cyberpunk/
├── cyberpunk-backend/          ← Active Node.js Express backend (localhost:3000)
│   ├── src/index.js            ←   Single-file server (259 lines)
│   ├── .env                    ←   Secrets (NEVER commit)
│   └── package.json
│
├── ai_rpg_cyberpunk/           ← Flutter client (Web + Android)
│   ├── lib/main.dart           ←   Single-file app (390 lines)
│   └── pubspec.yaml
│
├── ai-rpg-cyberpunk/           ← Cloudflare Workers alternative backend
│   ├── src/worker.js           ←   Serverless handler with Replicate image gen
│   ├── wrangler.jsonc          ←   Config with env vars embedded
│   └── package.json
│
├── ai-rpg-cyberpunk_backend/   ← Stale Wrangler project (no src/)
└── ai-rpg-cyberpunk-backend_0/ ← Stale Wrangler project (incomplete config)
```

## Commands

### Backend (Express)
```bash
cd cyberpunk-backend
npm install
node src/index.js              # Dev server on localhost:3000
```

### Backend (Cloudflare Workers)
```bash
cd ai-rpg-cyberpunk
npm install
npx wrangler dev               # Local dev
npx wrangler deploy            # Deploy to workers.dev
```

### Flutter client
```bash
cd ai_rpg_cyberpunk
flutter run -d chrome          # Web (connects to localhost:3000)
flutter run -d android         # Android emulator (needs 10.0.2.2 URL)
flutter clean                  # Clear build cache if needed
```

- No test, lint, or typecheck scripts exist for the backend.
- Flutter has `flutter_lints` and `flutter_test` but no custom tests written.

## Architecture

```
Flutter App (Web/Android)
    │ HTTP
    ▼
Node.js Express  OR  Cloudflare Worker
    │ REST API              │ REST API
    ▼                       ▼
Supabase (PostgreSQL) ←→ OpenCode LLM (DeepSeek)
    │
    └→ Replicate (SDXL image gen — Workers only)
```

### Key difference: Express vs Workers backend

| Feature | Express (`cyberpunk-backend`) | Workers (`ai-rpg-cyberpunk`) |
|---------|-------------------------------|------------------------------|
| Image gen | Unsplash placeholders | Replicate SDXL (real AI images) |
| Response | `narrative` + `thought` + `branches` | `text` only (no branches) |
| LLM prompt | Asks for branches in JSON | Asks for state changes + location |
| Env loading | `.env` via dotenv | `wrangler.jsonc` vars |
| CORS | `*` all origins/methods | `*` POST only |

**The Flutter client currently connects to Express (`localhost:3000`).** The Workers URL is commented out in `main.dart:134`.

## Database (Supabase)

### `game_state` table
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK | Player identifier |
| `hp` | INT | 0-100 |
| `max_hp` | INT | Default 100 |
| `chip_sync` | INT | 0-100%, AI sync level |
| `sabotage_score` | INT | Affects ending |
| `current_location_id` | UUID | Links to `location_images` |
| `story_flags` | TEXT[] | e.g. `['glk_freed', 'met_voss']` |
| `inventory` | JSONB | Items |
| `currency_chip_available` | BOOL | One-use flag |
| `act` | INT | Story act (default 1) |
| `updated_at` | TIMESTAMPTZ | |

### `location_images` table
| Column | Type | Notes |
|--------|------|-------|
| `location_id` | UUID PK | Cache key |
| `image_url` | TEXT | Unsplash or Replicate URL |
| `prompt_used` | TEXT | Original prompt |
| `generated_at` | TIMESTAMPTZ | |

### `locations` table (optional, may not exist)
Pre-defined location seeds with connections and image prompts.

## API contract

### `POST /api/action` (Express)
**Request:** `{ userId, userAction }`
**Response:** `{ narrative, text, thought, branches: [{label, narrative, hp_change, image_prompt, image_url}], state_updated, image_url, debug_time_ms }`

### `POST /api/action` (Workers)
**Request:** `{ userId, userAction }`
**Response:** `{ text, state_updated, image_url }` — no branches, narrative-only

## LLM prompt contracts

### Express backend (src/index.js:76-94)
Expects JSON with `narrative`, `thought`, `branches[]`. Parser uses regex `/\{[\s\S]*\}\s*$/`.
AI responds in Russian.

### Workers backend (src/worker.js:49-70)
Expects `> THOUGHT:` prefix optional, then narrative text, then raw JSON with `hp_change`, `new_flags`, `sync_change`, `inventory_add`, `currency_chip_used`, `sabotage_change`, `current_location_id`, `image_prompt`.
AI responds in Russian.

## Env vars

### Express (`.env`)
`PORT`, `OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, `LLM_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Workers (`wrangler.jsonc` vars)
Same as Express plus `REPLICATE_API_KEY`, `SUPABASE_ANON_KEY`, `LLM_IMAGE_MODEL`

## Flutter client details

### Connection URLs (`lib/main.dart:134-140`)
- **Web (active):** `http://localhost:3000/api/action`
- **Android emulator:** `http://10.0.2.2:3000/api/action`
- **Workers (commented):** `https://ai-rpg-cyberpunk.mohovand.workers.dev`

### Hardcoded user ID
`39e87dba-f4e9-4a8d-80fb-c6e1759adce8` — single-player only.

### Message roles
`user`, `thought` (italic, purple), `chip` (typewriter effect), `system` (cyan, monospace)

### Color scheme
- Primary: `#00F5FF` (cyan neon)
- Secondary: `#FFFF00FF` (magenta)
- Background: `#0A0A12` (dark blue)
- Surface: `#1A1A2E`

## Known issues
- **No input validation** on backend beyond presence check
- **No error handling** for LLM API failures (no retry logic)
- **Duplicate messages** possible on rapid clicks (no debounce in Flutter)
- **No chat pagination** — all messages held in memory
- **Image cache keyed by `branch_{label}`** — changing labels invalidates cache
- **Stale directories**: `ai-rpg-cyberpunk_backend/` and `ai-rpg-cyberpunk-backend_0/` are incomplete/unused

## Security notes
- `.env` and `wrangler.jsonc` contain live API keys — never commit
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — full DB access
- CORS is `*` — intentional for dev, tighten for prod
- For production: use `anon key` + RLS, add rate limiting
