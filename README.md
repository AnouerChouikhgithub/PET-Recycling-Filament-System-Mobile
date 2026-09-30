# 3awedlou · React Native mobile app

Native mobile application for the 3awedlou smart PET recycling machine.
Built with **React Native + Expo (SDK 57) + TypeScript (v6)** and React Navigation v7.

The app talks to the **same Symfony backend as the web app** — one API, one JWT
scheme, one contract (see [`../backend/docs/api-contract.md`](../backend/docs/api-contract.md)).
Authentication uses JWT stored in **expo-secure-store** (hardware-backed, never
plain AsyncStorage). Machine data — telemetry, sessions, production, recycling —
is fetched from the API; alerts are derived from real machine state.

## Backend setup (first run)

1. Start the Symfony backend (see `../backend/README.md`) — by default on
   `http://127.0.0.1:8000`.
2. Copy `.env.example` to `.env` and point `EXPO_PUBLIC_API_BASE_URL` at your
   machine:
   - **Physical device (Expo Go):** use your PC's **LAN IP**, e.g.
     `http://192.168.1.109:8000/api` — on the phone, `localhost` is the phone
     itself. Find your IP with `ipconfig` (Windows) / `ip addr` (macOS/Linux).
   - **Android emulator:** `http://10.0.2.2:8000/api` maps to the host.
3. Restart the dev server after changing `.env` (values are embedded at start).

## Run on your phone with Expo Go

1. Install **Expo Go**: Android ([Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)) or iOS ([App Store](https://apps.apple.com/app/expo-go/id982107779)).
2. Phone and PC on the **same Wi-Fi network**.
3. Start the dev server (from this folder):
   ```
   npm start
   ```
4. Scan the QR code with the Expo Go app (Android) or the Camera app (iOS).

Dev accounts (loaded by backend fixtures, dev only): `anouer@3awedlou.app` /
`3awedlou-dev`.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server (Metro) with QR code |
| `npm run android` | Start + launch on a connected Android device/emulator |
| `npm run ios` | Start + launch in the iOS simulator (macOS only) |
| `npm run typecheck` | Strict TypeScript check |
| `npx expo export` | Production JS bundle for app-store deploys |

## Architecture

```
mobile-app/
├── App.tsx                  # Providers (Auth → Machine) + tab/stack navigation
├── api/
│   ├── client.ts            # fetch + Bearer token (secure store) + envelope + 401 flow
│   └── index.ts             # Endpoint wrappers (auth, machines, telemetry, commands)
├── realtime/
│   └── realtimeService.ts   # connect/subscribe/onTelemetry — polling today, WS later
├── contexts/
│   ├── AuthContext.tsx      # login / register / session restore / single logout path
│   ├── MachineContext.tsx   # API-backed machine state (sensors, sessions, alerts)
│   └── ThemeContext.tsx     # light/dark/system theme
├── data/
│   ├── api.ts               # API contract types (mirror of web-app/src/types/api.ts)
│   └── types.ts             # UI-only types + re-exports of the contract
├── pages/                   # Home, Machine, Recycling, Impact, Profile (+ History, Filament)
└── components/              # Shell, SessionCard, ui kit, charts, icons
```

Key rules:

* **One API contract** — `data/api.ts` mirrors the backend exactly; never invent
  field names locally.
* **Machine actions are guarded commands** — start/pause/resume/stop go through
  `POST /machines/{id}/commands`; the backend validates state and safe ranges
  before anything reaches hardware.
* **No fabricated data** — sensors show what the machine last reported; totals
  come from measured recycling records; estimates are labelled.
* **Honest realtime** — without a realtime URL the app polls every 10 s and says
  so in the UI; the `RealtimeService` interface is already the WebSocket contract.
