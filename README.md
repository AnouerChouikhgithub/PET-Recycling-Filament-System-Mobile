# 3awedlou · React Native mobile app

Native mobile application for the 3awedlou smart PET recycling machine.

Built with **React Native 0.86.3 + Expo SDK 57.0.25 + TypeScript 6.0.3** and
React Navigation v7 (bottom tabs + native stack). Device auth uses
`expo-secure-store` (hardware-backed, never plain AsyncStorage). Machine data
— telemetry, sessions, production, recycling — is fetched from the API. Alerts
are derived in the app from that real backend state; the backend has no alert
resource.

The app talks to the **same Symfony backend as the web app** — one API, one JWT
scheme, one contract (see [`../backend/docs/api-contract.md`](../backend/docs/api-contract.md)).

## Backend setup (first run)

1. Start the Symfony backend (see `../backend/README.md`) — by default on
   `http://127.0.0.1:8000`.
2. Copy `.env.example` to `.env` and point
   `EXPO_PUBLIC_API_BASE_URL` at your machine:
   - **Physical device (Expo Go):** use your PC's **LAN IP**, e.g.
     `http://192.168.1.109:8000/api` — on the phone, `localhost` is the phone
     itself. Find your IP with `ipconfig` (Windows) / `ip addr` (macOS/Linux).
   - **Android emulator:** `http://10.0.2.2:8000/api` maps to the host.
3. Restart the dev server after changing `.env` (values are embedded at start).

Dev accounts (loaded by backend fixtures, dev only): `anouer@3awedlou.app` /
`3awedlou-dev`.

## Run on your phone with Expo Go

1. Install **Expo Go**: Android (Play Store) or iOS (App Store).
2. Phone and PC on the **same Wi-Fi network** (or use the Android emulator).
3. Start the dev server (from this folder):

   ```bash
   npm start        # Expo dev server + QR code
   ```

4. Scan the QR code with the Expo Go app (Android) or the Camera app (iOS).

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server (Metro) with the QR code |
| `npm start -- -c` | Same as above, **after any `.env` change** (clears the Metro cache) |
| `npm run android` | Start + launch on a connected Android device/emulator |
| `npm run ios` | Start + launch in the iOS simulator (macOS only) |
| `npm run typecheck` | Strict TypeScript check (`tsc --noEmit`) |
| `npm test` | Compiles the pure modules and runs the Node tests, then the Jest render tests |
| `npx expo export --platform android --output-dir dist` | Real Metro production bundle (a build smoke test without a device) |

> `npm start -- -c` is mandatory after editing `.env` — Expo embeds the env
> values into the bundle at start; a stale cache silently keeps the old values.

## Architecture

```text
mobile-app/                     (this repository)
├── App.tsx                     # Providers (Auth → Machine) + tab/stack navigation
├── api/
│   ├── client.ts               # fetch + Bearer token (secure store) + envelope + 401 flow
│   ├── agent.ts                # AI assistant endpoints (chat, delete conversation(s))
│   └── index.ts                # endpoint wrappers (auth, machines, telemetry, commands)
├── realtime/
│   └── realtimeService.ts      # connect/subscribe/onTelemetry — polling today, WS later
├── contexts/
│   ├── AuthContext.tsx         # login / register / session restore / single logout path
│   ├── MachineContext.tsx      # API-backed machine state (sensors, sessions, alerts)
│   └── ThemeContext.tsx        # light/dark/system theme
├── data/
│   ├── api.ts                  # API contract types (mirror of web-app/src/types/api.ts)
│   └── types.ts                # UI-only types + re-exports of the contract
├── pages/                      # Home, Machine, Recycling, Impact, Profile
│   └── AgentChatPage.tsx       # AI assistant screen (stack route `AgentChat`)
├── components/
│   ├── Shell.tsx               # header, connection ribbon, tab bar, notifications
│   ├── ui.tsx / charts.tsx / icons.tsx / SessionCard.tsx
│   └── agent/                  # MessageBubble, ToolCallList, Composer, SuggestedPrompts, AgentNotices
├── lib/
│   ├── format.ts, storage.ts, navigation.ts
│   ├── alerts.ts               # PURE: alert read/unread bookkeeping
│   ├── agentContract.ts        # PURE: limits, error mapping, payload parsers, validation
│   ├── commandDelivery.ts      # PURE: broker/queued/acknowledged command wording
│   ├── machineView.ts          # PURE: null- and freshness-aware sensor/subsystem models
│   ├── telemetryFreshness.ts   # PURE: fresh/stale/very-stale + "Not reported" rules
│   └── useAgentChat.ts         # assistant state machine (explicit retry, no auto-POST)
├── __tests__/                  # unit tests for the two pure modules above
├── theme/                      # design tokens + theme modes
├── tsconfig.tests.json         # compiles the pure modules for `npm test`
└── scripts/                    # generate-assets.py
```

Key rules:

* **One API contract** — `data/api.ts` mirrors the backend exactly; never invent
  field names locally.
* **Machine actions are guarded commands** — start/pause/resume/stop go through
  `POST /machines/{id}/commands`; the backend validates state and safe ranges
  before anything reaches hardware.
* **No fabricated data** — sensors show what the machine last reported; totals
  come from measured recycling records; estimates are labelled.
* **Honest realtime** — the app polls every 10 s and labels the transport
  `polling`; a configured URL does not switch it to a stream, because no
  WebSocket client exists yet. The `RealtimeService` interface is the contract
  that transport will implement.

## Polling / realtime (honest status)

`realtime/realtimeService.ts` runs an honest `REFRESH_MS = 10_000` (10 s) poll
of `GET /machines/{id}/dashboard` and labels the transport `polling` in the UI
(Shell, Machine, Profile and about sheets all say `10 s refresh`). There is **no
WebSocket/SSE client**, so `EXPO_PUBLIC_REALTIME_URL` is only a placeholder for
the future endpoint: setting it does **not** enable a stream or disable polling.
The `RealtimeService` interface is the contract that transport will implement.

Background behaviour is implemented, not a known freeze: the service listens to
`AppState`, stops the 10 s timer when the app leaves the foreground, and polls
immediately when it returns. A backgrounded app therefore shows fresh data on
resume instead of a stale frozen dashboard.

## Screenshots

```mermaid
flowchart LR
  A[Home dark] --> B[Machine dark]
  A --> C[Recycling dark]
  A --> D[Impact dark]
  D --> E[Home light]
  B --> F[Machine light]
  C --> G[Recycling light]
  E --> H[Impact light]
```

| Dark | Light |
|---|---|
| ![Home dark](docs/screenshots/home-dark.png) | ![Home light](docs/screenshots/home-light.png) |
| ![Machine dark](docs/screenshots/machine-dark.png) | ![Machine light](docs/screenshots/machine-light.png) |
| ![Recycling dark](docs/screenshots/recycling-dark.png) | ![Recycling light](docs/screenshots/recycling-light.png) |
| ![Impact dark](docs/screenshots/impact-dark.png) | ![Impact light](docs/screenshots/impact-light.png) |

Screenshots live in `docs/screenshots/` (see the "from assets/Screens-Photos"
note below). Export fresh ones with the repo's `scripts/generate-assets.py` and
place them here; the gallery displays the committed files.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 24 (pinned in `.nvmrc`; CI reads the same file) |
| npm | ≥ 10 |

`package.json` declares `engines.node >= 24` and `.nvmrc` pins the major, so the
local shell and CI use one version. Expo SDK 57.0.25 and React Native 0.86.3 are
pinned by the lockfile.

## Configuration

| Variable | Required | Default | Meaning | Example placeholder |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | yes | `http://YOUR_LAN_IP:8000/api` | Symfony API base; the same backend the web app uses | `http://YOUR_LAN_IP:8000/api` |
| `EXPO_PUBLIC_REALTIME_URL` | no | *(empty)* | Placeholder for the future WebSocket/SSE endpoint; the app polls every 10 s regardless | `ws://127.0.0.1:8080/ws` |
| `EXPO_PUBLIC_ENVIRONMENT` | no | `development` | Shown in the UI footer, log verbosity | `production` |

No secrets are used by the client. `EXPO_PUBLIC_*` values are embedded in the
app bundle at start, so **never** put credentials here — nothing here is a
secret. Local overrides go in `.env` (git-ignored); committed files hold only
placeholders.

## Project structure

```text
.
├── assets/                     # app icons, splash, adaptive icon, favicon
├── components/                 # Shell (header + tab bar), SessionCard, charts, ui kit, icons
├── contexts/                   # Auth / Machine / Theme / Toast providers
├── data/                       # API contract types + UI-only types
├── lib/                        # date/format helpers, csv, async storage wrapper
├── pages/                      # Home, Machine, Recycling, Impact, Profile, History, Filament, Login
├── realtime/                   # RealtimeService (polling today, WS contract later)
├── scripts/                    # generate-assets.py
├── theme/                      # design tokens, theme modes
├── App.tsx                     # providers + navigation
├── index.ts
├── app.json
├── package.json
├── tsconfig.json
└── README.md
```

## AI assistant (mobile)

A read-only chat assistant lives at the stack route **`AgentChat`**, reachable
from the **Machine** tab (“Ask the AI assistant” card) and **Profile → App →
AI assistant**. It talks to the backend's agent API with the normal user JWT —
no provider key is ever on the device — and it can only read machines,
telemetry, events, fault codes and the activity log (there is no write tool, and
the assistant code never imports the machine-command API).

Step-by-step setup and a scripted test walkthrough (including how to test the
model, the failure paths and the honesty rules):
[`docs/ai-agent-mobile-step-by-step.md`](docs/ai-agent-mobile-step-by-step.md).
Design notes (partly historical): [`docs/ai-agent-ui.md`](docs/ai-agent-ui.md).

Backend requirements, in order:

1. `AGENT_ENABLED=true` in the backend `.env.local` — a shell variable is **not**
   enough under `php -S`/`symfony serve` (the built-in server hides process env
   from Symfony, so `.env.local` wins).
2. The agent migrations applied (`php bin/console doctrine:migrations:migrate -n`).
3. `ANTHROPIC_API_KEY` in the backend `.env.local` for real answers (without it:
   `503 AGENT_LLM_UNAVAILABLE`).

## Testing and quality

| Command | What it does |
|---|---|
| `npm run typecheck` | Strict `tsc --noEmit` over the whole app |
| `npm test` | Compiles the pure modules with `tsc -p tsconfig.tests.json` into `.test-build/`, runs 47 Node tests (`npm run test:unit`), then the Jest render tests (`npm run test:render`) |
| `npx expo export --platform android --output-dir dist` | Bundles the app with Metro (proves the whole tree compiles, not just types) |

The pure modules (`lib/agentContract.ts`, `lib/telemetryFreshness.ts`,
`lib/machineView.ts`, `lib/commandDelivery.ts`, `lib/alerts.ts`) have no React
Native imports, so `node --test` exercises them directly: contract rules,
freshness thresholds, null-vs-zero telemetry, delivery wording and alert
read-state. Jest (`jest-expo` + Testing Library) covers the render behaviour in
`*.render.test.tsx`. Linting is not configured.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Phone cannot reach the API | Backend not reachable / wrong host | Set `EXPO_PUBLIC_API_BASE_URL` to the PC **LAN IP** (e.g. `http://192.168.1.109:8000/api`); phone and PC on the same Wi-Fi; backend must listen on all interfaces (`symfony serve --no-tls --allow-all-ip` or `php -S 0.0.0.0:8000`) |
| `localhost` works on phone | Wrong host | `localhost` on the phone resolves to the phone, not the PC — always use the LAN IP |
| Android emulator cannot reach backend | Wrong host | Use `http://10.0.2.2:8000/api` in `EXPO_PUBLIC_API_BASE_URL` |
| `npm start -- -c` does nothing | Dev server not restarted | Stop Metro and run `npm start -- -c` again after any `.env` change |
| Expo Go shows "Bundler not installed" | Stale bundle cache | Run `npm start -- -c` (clears cache); on physical devices also `expo start --dev-client` if using a dev client |
| Login rate limiter returns `429` | Too many failed logins | Wait `Retry-After` seconds, or disable the limiter in backend `config/packages/rate_limiter.yaml` for local debugging |
| `.env` with special characters breaks the app | Dotenv parses unquoted values | Quote passwords/URLs in `.env` |
| Image gallery shows broken images | Paths wrong relative to repo root | Paths in the README are relative to the repo root (`docs/screenshots/...`); clone the repo, not a subfolder |

## Security notes

* Device tokens are hashed at rest; API auth is JWT (RS256, 1 h TTL). The app
  stores only the **access token** in `expo-secure-store`; refresh-token storage
  and logout revocation are not implemented on mobile yet (tracked as M04).
* Auth surface is rate-limited (login 5/5 min, register 3/10 min per IP).
* `EXPO_PUBLIC_*` values are **never** secrets — they are embedded in the
  bundle. No tokens, passwords, broker credentials or JWT keys are stored in
  this repo.
* Backend secrets (`.env.local`, JWT keys, broker passwords) are git-ignored.

## Roadmap

1. **Core API** — auth, machines, telemetry, sessions, production, recycling
   *(done, verified locally)*
2. **Guarded commands + audit** — backend-safe command dispatch
   *(done, verified locally)*
3. **MQTT broker integration** *(done and verified locally: telemetry in,
   commands out, ACL isolation, 503 when the broker is down)*
4. **ESP32 + Arduino Mega serial gateway** — planned; bench wiring exists,
   bench test pending, protocol not yet defined
5. **Device authentication** — device tokens
6. **Realtime transport** — WebSocket/SSE hub
7. **Push notifications**
8. **Admin back-office**
9. **Deployment** — automated builds, CI/CD, TLS
10. **Helpdesk / operation tooling**

**Current position:** phases 1–3 are done. Phases 4–10 are pending and
documented as TODO(anouer) markers in this README.

## Ecosystem

| Repo | Role | Stack | Link | Status |
|---|---|---|---|---|
| [`PET-Recycling-Filament-System-Backend`](https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Backend) | Shared Symfony API + MQTT backbone | PHP 8.3 + Symfony 7.4 + PostgreSQL 17 | https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Backend | Implemented (MQTT phase 3 verified locally) |
| [`PET-Recycling-Filament-System-Web`](https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Web) | Web dashboard (React 18 + Vite) | React 18 + Vite 5 + TS | https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Web | Implemented, polling transport |
| [`PET-Recycling-Filament-System-Mobile`](https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Mobile) | React Native mobile (Expo) | Expo SDK 57 + RN 0.86 | https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Mobile | Implemented, polling transport |
| `pet-recycling-filament-system` | Arduino + ESP32 hardware | C++ (Arduino) + TXS0108E + ESP32 | https://github.com/AnouerChouikhgithub/pet-recycling-filament-system | Hardware 3rd iteration; gateway planned |

## Related docs

* API contract: https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Backend/blob/main/docs/api-contract.md
* MQTT contract: https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Backend/blob/main/docs/mqtt-contract.md
* Web: https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Web/blob/main/README.md
* Backend: https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Backend/blob/main/README.md
* Hardware: https://github.com/AnouerChouikhgithub/pet-recycling-filament-system/blob/main/README.md

## License

TODO(anouer): no LICENSE file found in this repo — add one.
