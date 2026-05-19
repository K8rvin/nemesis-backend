# AGENTS.md — cyberpunk-backend

## What this is
Single-file Express.js backend for a cyberpunk text RPG. The server acts as a proxy between a frontend client, a Supabase game-state database, and an LLM API (OpenCode).

## Commands
- **Start dev server:** `node src/index.js`
- **Install deps:** `npm install`
- No test, lint, or typecheck scripts are configured.

## Architecture
- **Entry point:** `src/index.js` (only source file, CommonJS)
- **No build step** — run directly with Node
- **Env loading:** `dotenv` reads `.env` at startup

## Endpoints
| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/` | — | Health check, returns status + Supabase/LLM config state |
| POST | `/api/action` | `{ userId, userAction }` | Main game loop: loads state from Supabase → prompts LLM → parses JSON response → generates branch images → saves updated state → returns narrative + branches |

## Integrations
- **Supabase REST API** — `game_state` table (keyed by `user_id`), `location_images` table (image cache). Uses service role key from env.
- **OpenCode LLM API** — `OPENCODE_BASE_URL` + `OPENCODE_API_KEY`, model from `LLM_MODEL` (default: `deepseek-v4-flash`). Expects OpenAI-compatible `/chat/completions` endpoint.
- **Unsplash** — hardcoded placeholder URLs for branch images (no real image generation yet).

## Env vars (required)
- `PORT` — server port (default 3000)
- `OPENCODE_API_KEY`, `OPENCODE_BASE_URL`, `LLM_MODEL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Game state schema (Supabase `game_state` table)
Fields used by the backend: `user_id`, `hp`, `chip_sync`, `sabotage_score`, `story_flags` (array), `inventory` (object), `currency_chip_available`, `current_location_id`, `updated_at`.

## LLM prompt contract
The LLM must return **strict JSON** (no markdown, no surrounding text) with shape:
```json
{
  "narrative": "string",
  "thought": "string",
  "branches": [{ "label", "narrative", "hp_change", "image_prompt" }],
  "hp_change": "number (optional)",
  "sync_change": "number (optional)",
  "sabotage_change": "number (optional)",
  "new_flags": ["string"] (optional),
  "inventory_add": { "key": "value" } (optional)
}
```
The parser uses a regex fallback (`/\{[\s\S]*\}\s*$/`) to extract JSON from trailing text.

## Gotchas
- CORS allows all origins (`*`) — intentional for dev, tighten for prod
- No input validation beyond presence check on `userId`/`userAction`
- Image generation is a placeholder (Unsplash URLs), not real AI image generation
- All Russian-language narrative; LLM system prompt instructs the AI to respond in Russian
