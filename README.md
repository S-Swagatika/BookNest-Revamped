# BookNest

BookNest - Buy, Rent, and Discover.

A responsive bookstore built with Expo (React Native) for iOS, Android and web. Phase 1 is frontend only and uses mock data. See [`booknest-mobile-app-plan.md`](booknest-mobile-app-plan.md) for the full implementation plan.

## Prerequisites

- Node.js 22 (the project is pinned to Expo SDK 57, which supports Node 22.12 and newer; a newer Node 22.x or 24.x is preferred)
- npm 10 or newer
- For native targets: Xcode and iOS Simulator (macOS only) and/or Android Studio with an emulator
- For web: any modern browser

## Setup

```bash
npm install
```

## Run

```bash
npm start        # Expo dev server, then choose a platform
npm run ios      # iOS simulator (macOS only)
npm run android  # Android emulator
npm run web      # Web in a browser
```

## Quality checks

```bash
npm run lint           # ESLint (expo lint)
npm run typecheck      # TypeScript strict
npm run format:check   # Prettier check (npm run format to fix)
npm test               # Jest + React Native Testing Library
npm run audit:prod     # Production dependency vulnerability audit (high and above)
```

CI runs the same checks on every push to `main` and on every pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Conventions

- TypeScript `strict` is on. Use the `@/` alias for imports from `src/`.
- Tests live in `__tests__/` or beside the code as `*.test.ts(x)`.
- Never commit secrets. `.env*` files are git-ignored. Use `EXPO_PUBLIC_*` variables only for non-secret values.
- Add Expo-compatible packages with `npx expo install <package>` so versions match the SDK.

## Known issues

- `npm audit` reports vulnerabilities in transitive dependencies of Expo SDK 57 (`expo-router` via `query-string` and `decode-uri-component`; `expo` via `@expo/fingerprint` and `minimatch`). Fixes are only offered in a newer SDK, so they are tracked for the planned SDK 58 upgrade. See the plan for details.
- Expo SDK 58 requires Node 22.13 or newer. Upgrade Node first, then run the SDK upgrade.
