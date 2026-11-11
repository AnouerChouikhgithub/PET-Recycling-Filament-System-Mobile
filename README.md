# 3awedlou · React Native mobile app

Native mobile application for the 3awedlou smart PET recycling machine.

Built with **React Native 0.86.3 + Expo SDK 57.0.25 + TypeScript 6.0.3** and
React Navigation v7 (bottom tabs + native stack). Device auth uses
`expo-secure-store` (hardware-backed, never plain AsyncStorage). Machine data —
telemetry, sessions, production, recycling — comes from the Symfony API. Alerts
are derived in the app from that real backend state; the backend has no alert
resource.

This app shares the **same backend and contract as the web app** (the backend
README is the contract).

## Backend setup (first run)

1. Start the Symfony backend (`../PET-Recycling-Filament-System-Backend/README.md`)
   — by default on `http://127.0.0.1:8000`.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`:
   - **Physical device (Expo Go):** your PC's **LAN IP**, e.g.
     `http://192.168.1.109:8000/api` — `localhost` on the phone is the phone.
   - **Android emulator:** `http://10.0.2.2:8000/api` maps to the host.
3. Restart Metro after changing `.env` (`npm start -- -c`); values are embedded
   at start.

Exact physical-phone sequence (same Wi-Fi, replace the IP with `ipconfig`'s
IPv4 address of this PC):

```bash
# terminal 1 — backend reachable from the LAN, not only loopback
php -S 0.0.0.0:8000 -t public

# terminal 2 — mobile, from the repository root
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.109:8000/api npm start -- -c
```

Then scan the QR code. On Windows, allow Node/PHP through the firewall for the
private network if the phone times out. `127.0.0.1`/`localhost` in the phone's
browser is the phone itself, never this PC.

Dev accounts come from backend fixtures (dev only):
`anouer@3awedlou.app` / `3awedlou-dev`.

## Run it

```bash
npm install
npm start          # Expo dev server + QR code
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Phone and PC
must be on the same Wi-Fi, or use the Android emulator.

| Command | What it does |
|---|---|
| `npm start` | Expo dev server (Metro) with QR code |
| `npm start -- -c` | Same, clearing the Metro cache (required after `.env` changes) |
| `npm run android` | Start + launch on a connected Android device/emulator |
| `npm run ios` | Start + launch in the iOS simulator (macOS only) |
| `npm run typecheck` | Strict `tsc --noEmit` |
| `npm test` | Compiles pure modules, runs 51 Node tests, then 5 Jest suites |
| `npx expo export --platform android --output-dir dist` | Metro production bundle smoke test |

## Screens and backend calls

Tabs: **Home, Machine, Recycling, Impact, Profile**. Stack: **History,
Filament, AgentChat**.

| Screen | Backend calls |
|---|---|
| Login / register (auth gate) | `POST /auth/login`, `POST /auth/register`, `GET /me` on restore |
| Home | `GET /machines`, `GET /machines/{id}/dashboard`, sessions; 10 s dashboard refresh |
| Machine | dashboard from context; `POST /machines/{id}/commands` (start/pause/resume/stop) |
| Recycling | recycling totals, sessions (context) |
| Impact | `GET /machines/{id}/recycling` |
| Filament | `GET /machines/{id}/production`; CSV spec sheet via `expo-sharing` |
| History | sessions + telemetry detail from context |
| Profile | `GET /me`, theme/preferences, sign out |
| AI assistant | `POST /agent/chat`, conversation deletes |

## Honesty rules in the UI

* **Unreported is not zero.** `lib/machineView.ts` keeps a channel `null` unless
  the sample is fresh; the UI shows “Not reported”, never a fabricated `0`/`off`.
  Fan history does not turn `null` into zero; the spooler is `unknown` because no
  spooler channel exists.
* **Units are not invented.** Motor speed has no confirmed firmware unit and is
  labelled “unit unverified”; charts do not uppercase it into a fake symbol.
* **Totals are measured only.** PET/filament kilograms come from reported
  recycling/production masses; missing values are labelled, not counted as zero.
  Bottle/CO₂e figures are estimates with the factors stated in the UI.
* **Broker acceptance ≠ execution.** Commands show the backend's `delivery`
  state and never claim the machine ran them; session rows say “session open” or
  “output pending/not reported” instead of “running now”.
* **Polling is labelled polling.** No WebSocket exists; every screen refreshes
  every 10 s and says so.

## Architecture

```text
.
├── App.tsx                     # providers (Auth → Machine) + tab/stack navigation
├── api/
│   ├── client.ts               # fetch + SecureStore token + envelope + 401
│   ├── agent.ts                # assistant endpoints
│   └── index.ts                # auth/machine endpoint wrappers
├── realtime/realtimeService.ts # 10 s polling + AppState pause/resume
├── contexts/                   # Auth, Machine, Theme, Toast
├── data/                       # backend contract types + UI types
├── pages/                      # Home, Machine, Recycling, Impact, Profile, History, Filament, Login, AgentChat
├── components/                 # Shell, SessionCard, charts, ui kit, icons, agent components
├── lib/                        # pure helpers: agentContract, machineView, alerts, commandDelivery, telemetryFreshness, useAgentChat
├── __tests__/                  # Node tests for pure modules + Jest render tests
├── theme/                      # design tokens + modes
├── scripts/generate-assets.py  # icon/splash generation helper
├── assets/                     # app icons and splash
└── README.md
```

Key rules:

* **One API contract** — `data/api.ts` mirrors the backend README; never invent
  field names locally.
* **Machine actions are guarded commands** through
  `POST /machines/{id}/commands`; the backend validates state and safe ranges.
* **No fabricated data** — sensors show what the machine last reported; totals
  come from measured records; estimates are labelled.
* **Honest realtime** — polling only; `EXPO_PUBLIC_REALTIME_URL` is a future
  target and does not change the transport.

## Polling / realtime

`realtime/realtimeService.ts` polls `GET /machines/{id}/dashboard` every
`REFRESH_MS = 10_000` and reports `transport: 'polling'`. `AppState` stops the
timer in the background and refreshes immediately on return, so a resumed app is
not frozen on stale data. There is no WebSocket/SSE client; setting
`EXPO_PUBLIC_REALTIME_URL` neither starts a stream nor disables polling.

## Status

`Implemented` = code plus a passing test or verified local run.
`Prepared` = code exists but is exercised only by mocks/fakes.
`Future` = not implemented.

| Area | State |
|---|---|
| Auth, session restore, secure token storage | Implemented (access + refresh in `expo-secure-store`) |
| Refresh rotation on 401 (single-flight) | Prepared — mocked fetch/SecureStore tests; no device or live-backend run |
| Home/Machine/Recycling/Impact/Filament/History/Profile screens | Implemented |
| Null/stale telemetry, unit and delivery honesty | Implemented (Node + render tests) |
| Guarded command UI with delivery copy | Implemented (backend guard verified; no physical device) |
| Alerts + read state | Implemented (derived client-side) |
| CSV spec-sheet export | Implemented (depends on device sharing availability) |
| AI assistant screen | Prepared — mocked API tests; no live provider |
| Realtime transport | Future — polling implemented |
| Device/emulator verification | Future — no device run recorded |

## Testing and quality

```bash
npm run typecheck    # tsc --noEmit
npm run test:unit    # node --test: 47 tests
npm run test:render  # jest: 4 suites / 23 tests
npm test             # tsconfig.tests.json + both suites
```

Latest results (2026-11-11): typecheck passes; **47 Node tests pass** and
**4 Jest suites / 23 render tests pass**. Linting is not configured. Jest prints
non-fatal `ThemeProvider` `act(...)` warnings.

The pure modules (`lib/agentContract.ts`, `telemetryFreshness.ts`,
`machineView.ts`, `commandDelivery.ts`, `alerts.ts`) have no React Native
imports, so `node --test` exercises them directly. Jest (`jest-expo` + Testing
Library) covers render behaviour in `*.render.test.tsx`.

## AI assistant (mobile)

Read-only chat at the stack route **AgentChat**, reachable from the Machine tab
and Profile → App → AI assistant. It uses the normal user JWT; no provider key
is on the device. It can read machines, telemetry, events, fault codes and the
activity log — there is no write tool, and the assistant code never imports the
machine-command API.

Backend requirements:

1. `AGENT_ENABLED=true` in the backend `.env.local` (a shell variable is not
   enough under `php -S`/`symfony serve`).
2. Agent migrations applied.
3. `ANTHROPIC_API_KEY` in the backend `.env.local` for real answers (otherwise
   `503 AGENT_LLM_UNAVAILABLE`).

Behaviour: one in-flight turn, no automatic retry, explicit Retry, typed notices
for validation/rate limit/daily cap/provider/disabled, and 404 disables the
surface only for `AGENT_DISABLED`. Messages are capped at 4000 characters;
answers are non-streaming. No live provider call has ever been made, so real
answer quality is unverified.

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 24 (`.nvmrc`; CI reads the same file) |
| npm | ≥ 10 |

`package.json` declares `engines.node >= 24`. Expo SDK 57.0.25 and React Native
0.86.3 are pinned by the lockfile.

## Configuration

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | yes | `http://YOUR_LAN_IP:8000/api` | Symfony API base |
| `EXPO_PUBLIC_REALTIME_URL` | no | empty | Future socket target; polling continues regardless |
| `EXPO_PUBLIC_ENVIRONMENT` | no | `development` | Footer label / log verbosity |

`EXPO_PUBLIC_*` values are embedded in the bundle at start: never put
credentials here. Local overrides go in `.env` (git-ignored); `.env.example`
holds placeholders.

## Screenshots

| Dark | Light |
|---|---|
| ![Home dark](docs/screenshots/home-dark.png) | ![Home light](docs/screenshots/home-light.png) |
| ![Machine dark](docs/screenshots/machine-dark.png) | ![Machine light](docs/screenshots/machine-light.png) |
| ![Recycling dark](docs/screenshots/recycling-dark.png) | ![Recycling light](docs/screenshots/recycling-light.png) |
| ![Impact dark](docs/screenshots/impact-dark.png) | ![Impact light](docs/screenshots/impact-light.png) |

The committed PNGs are the current captures; `scripts/generate-assets.py`
regenerates app icons, not screenshots.

## Security notes

* **Both tokens** are stored in `expo-secure-store` (never AsyncStorage). On a
  401 the client performs ONE single-flight `POST /auth/token/refresh`, persists
  the rotated pair before retrying, and retries the original request once. If
  refresh fails it clears both tokens and logs out. Refresh tokens are
  single-use server-side, so concurrent 401s share one rotation.
* Logout asks the backend to revoke the stored refresh token (best effort) and
  **always** clears both local tokens, even offline.
* Auth surface is rate-limited by the backend (login 5/5 min, register 3/10 min
  per IP).
* `EXPO_PUBLIC_*` values are never secrets. No tokens, passwords, broker
  credentials or JWT keys live in this repository.
* Backend secrets (`.env.local`, JWT keys, broker passwords) are git-ignored.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Phone cannot reach the API | Wrong host / backend bound to localhost | Use the PC LAN IP in `EXPO_PUBLIC_API_BASE_URL`; run the backend on `0.0.0.0` |
| `localhost` works on phone | localhost is the phone | Use the LAN IP |
| Android emulator cannot reach backend | Wrong host | Use `http://10.0.2.2:8000/api` |
| `.env` change ignored | Metro cache | Stop Metro and run `npm start -- -c` |
| Login returns `429` | Rate limit | Wait `Retry-After`, or relax the limiter in local backend config |
| Image gallery broken | Wrong relative path | Paths are relative to the repository root |
| `deviceAcknowledged` always `false` | No matched device ack | Expected without a real gateway publishing `command_ack`; broker acceptance alone never sets it |

## Roadmap

1. Core API + guarded commands — implemented and locally verified.
2. MQTT broker integration — prepared (fake-broker tests); live broker, ACL
   isolation and device run still pending.
3. ESP32 + Arduino Mega gateway — future; bench wiring exists, protocol pending.
4. Refresh-token rotation and logout revocation — implemented in code with
   mocked tests; a real-device/live-backend run is still pending.
5. Realtime transport — future (WebSocket/SSE hub).
6. Push notifications, admin back-office, deployment — future.

## Related repositories

* Backend (API/MQTT/agent contract): https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Backend/blob/main/README.md
* Web: https://github.com/AnouerChouikhgithub/PET-Recycling-Filament-System-Web/blob/main/README.md
* Hardware: https://github.com/AnouerChouikhgithub/pet-recycling-filament-system

## License

TODO(anouer): no LICENSE file exists in this repository — add one.
