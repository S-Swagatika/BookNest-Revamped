# BookNest — Responsive Bookstore (iOS, Android, Web) Implementation Plan

> Status: APPROVED by user (v2). Library model and wishlist handling confirmed. No application code has been written yet.
> Supersedes the earlier mobile-only draft. Tagline from [`README.md`](README.md:2): "BookNest - Buy, Rent, and Discover".

---

## 1. Top-Level Overview

**Goal:** Build BookNest, a responsive e-commerce bookstore from **one Expo (React Native) codebase** that runs on **iOS, Android and web**. Customers can:

1. Purchase physical books.
2. Rent physical books for **7 or 30 days**.
3. Receive **personalised recommendations** based on **profession and interests**.
4. Maintain a **personal reading library** (shelves).
5. **Track active rentals and due dates**.

**Phase 1 approach (confirmed with user):**

- Frontend only. Data comes from local mock JSON through a **repository layer**, so a real backend can replace it later without UI changes.
- Auth and payment are **mocked**.
- Stack: Expo (managed) + TypeScript strict, Expo Router, Zustand + persistence, Jest + React Native Testing Library, Maestro (native E2E). Web target added, so a web E2E option is needed (see open questions).

**Decisions confirmed with user:**

| Topic                    | Decision                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Platforms                | One codebase: iOS, Android, web (Expo Router + responsive layouts)                                                    |
| Profession and interests | Captured at onboarding, editable in profile. Profession from a fixed list, interests from a fixed tag list            |
| Recommendations          | Rule-based, explainable scorer: profession-to-category/tag map, interest-tag overlap, reading-library signals         |
| Rentals                  | Physical books, fixed **7 or 30 day** terms, **one paid renewal** if nobody is waiting, flat late fee **shown only**  |
| Library                  | Shelves: Want to read, Reading, Finished, Owned, Rented. Auto-added on purchase or rental, plus manual status changes |
| Backend, payment, auth   | Deferred / mocked                                                                                                     |

**Non-goals for Phase 1:** real backend, real payment gateway, real auth, push or email reminders (in-app reminders are built), admin or seller tooling, e-book reading or DRM, ML-based recommendations, i18n beyond English, a real waitlist or reservation service (a mock list drives the renewal block), actually charging late fees.

---

## 2. Requirements Analysis

| #     | Requirement                        | Interpretation                                                                      | Implication                                                                                 |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1     | Purchase physical books            | Cart, checkout with address, mock payment, order history                            | Stock tracking, shipping address, price snapshot on order                                   |
| 2     | Rent for 7 or 30 days              | Physical rental, fixed terms. Rental price per term. Return is physical             | Address required at checkout. Due date = start + term. One renewal, subject to availability |
| 3     | Personalised recommendations       | Profession + interests drive a scorer                                               | Fixed taxonomies, a profession-to-category map, explainable "why recommended" text          |
| 4     | Personal reading library           | Five shelves, automatic and manual entries                                          | One library entry per user per book, with a status and ownership flags (see 4.3)            |
| 5     | Track active rentals and due dates | Rentals list with derived status, due-soon and overdue indicators, late fee display | Pure date logic with injectable clock                                                       |
| Cross | Responsive                         | Same screens adapt from phone to desktop                                            | Breakpoint system, adaptive navigation and grids                                            |

**Ambiguities flagged (see Open Questions):** "Rent for a month" is interpreted as a fixed 30 day term. The wishlist concept from the earlier draft is folded into the "Want to read" shelf.

---

## 3. Current Architecture

The repository is **greenfield**: only [`README.md`](README.md) (2 lines) and git metadata. There are no existing services, modules, APIs, database tables, dependencies or conventions.

**Consequences:**

- No backward-compatibility constraints for existing users or data.
- Conventions are defined by this plan and must be enforced from the first commit (strict TypeScript, lint, format, folder structure).
- "Services, APIs and database tables" are modelled as **repository interfaces and entity schemas** that mirror a future backend. This is the main Phase 2 compatibility surface.

---

## 4. Proposed Design

### 4.1 Application architecture

```
UI: Expo Router screens + shared components   (iOS / Android / Web, responsive)
        |
Feature hooks and selectors
        |
Zustand stores: auth, profile, cart, library, rentals, orders, settings
        |
Domain layer (pure functions): pricing, rental rules, recommendations, library rules
        |
Repository interfaces: Book, Category, Auth, Profile, Order, Rental, Library
        |
Mock implementations (JSON + persisted storage)   <-- replaced by HTTP implementations in Phase 2
```

**Rules:**

- Screens never import mock JSON directly. They use hooks, then stores or repositories.
- Repositories are async and can simulate latency and failures, which forces loading and error states to be built now.
- Business logic lives in **pure, injectable-clock functions** under `domain/` so it is unit-testable without React and is shared by all platforms.
- **Cross-store workflows** (for example "place order, then create rentals, then add to library") live in a single `orders` workflow function, not scattered across screens.
- Platform differences are isolated: `*.web.tsx` / `*.native.tsx` files or `Platform.select` only in the storage adapter and a few layout components.

### 4.2 Folder structure

```
/app                          Expo Router routes (see section 4.5)
/src
  /components                 shared UI primitives and composites
  /features                   per-feature hooks and components
    /catalogue /cart /checkout /rentals /library /recommendations /profile /auth
  /domain                     pure logic and schemas
  /data
    /repositories             interfaces + mock implementations + factory
    /mock                     seed JSON: books, categories, professions, interests, profession map
  /store                      Zustand stores + persistence adapters + migrations
  /theme                      tokens, breakpoints, light/dark
  /utils                      formatters, ids, clock
/__tests__                    unit and component tests (or co-located)
/e2e                          Maestro flows (native) and web E2E specs
```

### 4.3 Data models (mirror future DB tables)

All money is **integer minor units**. All timestamps are **ISO-8601 UTC**.

| Entity                      | Key fields                                                                                                                                                           | Notes                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Book`                      | id, title, authors[], isbn, description, coverUrl, categoryIds[], tags[], buyPrice, rentPrice7, rentPrice30, stockBuy, stockRent, rentable, rating, publishedAt      | Separate buy and rent stock because rentals are physical copies. `rentable` false hides Rent          |
| `Category`                  | id, name, parentId?, iconKey                                                                                                                                         | Supports browse and the profession map                                                                |
| `Profession`                | id, label                                                                                                                                                            | Fixed list, for example Software Engineer, Teacher, Student, Doctor, Designer, Manager, Writer, Other |
| `InterestTag`               | id, label                                                                                                                                                            | Fixed list, for example Fiction, Science, History, Business, Self-help, Technology, Art, Health       |
| `ProfessionMapEntry`        | professionId, categoryIds[], tagWeights{tag: weight}                                                                                                                 | Seed data that powers the scorer. Easily editable and testable                                        |
| `User`                      | id, name, email, createdAt, professionId?, interestTagIds[], onboardingCompleted                                                                                     | No password stored                                                                                    |
| `Address`                   | line1, line2?, city, region, postalCode, country, phone?                                                                                                             | Required for any physical delivery                                                                    |
| `CartItem`                  | bookId, mode (`buy` or `rent`), quantity, rentalTermDays? (7 or 30)                                                                                                  | Rent lines are quantity 1. Same book may appear as separate buy and rent lines                        |
| `Order`                     | id, userId, lines[], totals, status, address, createdAt, idempotencyKey                                                                                              | Price snapshot per line. Immutable after creation                                                     |
| `Rental`                    | id, orderId, userId, bookId, termDays (7 or 30), startAt, dueAt, returnedAt?, lateFeeRule snapshot                                                                   | **Status is derived** (see below), never stored as source of truth                                    |
| `LibraryEntry`              | id, userId, bookId, shelf (`wantToRead`, `reading`, `finished`), owned (bool), rentedActive (derived), addedAt, source (`manual`, `purchase`, `rental`), finishedAt? | One entry per (user, book). See library rules below                                                   |
| `Recommendation` (computed) | bookId, score, reasons[]                                                                                                                                             | Not persisted. Reasons drive the "Because you are a Teacher interested in History" text               |

**Rental status (derived):** `active` (before due), `dueSoon` (within a configurable window, for example 2 days), `overdue` (after `dueAt`, not returned), `returned`. Late fee display = flat amount per the confirmed rule, shown but never charged.

**Library rules (pending confirmation, see open questions):** The five shelves are modelled as one **reading status** (`wantToRead`, `reading`, `finished`) plus two **derived views** (`Owned` = purchased, `Rented` = has an active rental). This avoids a book sitting in conflicting shelves. Purchase sets `owned = true` and, if the book has no status, sets `wantToRead`. Rental sets the book as visible in the Rented view while active.

### 4.4 Recommendation design (rule-based, explainable)

Score per candidate book (higher is better). The user supplies four preferences: profession, professional interests, personal interests and reading goals. Each rule adds a fixed number of points, and the points are shown to the reader.

1. **Profession match:** +3 for a category linked to the profession, +1.5 per shared tag.
2. **Professional interests:** +2 per matching work topic (topic tags are matched to book tags).
3. **Personal interests:** +2.5 for a book in a chosen category.
4. **Reading goals:** +2 per goal the book supports. A length goal (for example "Read something short") matches by page count.
5. **Library signals:** +1 for categories already read or owned. Books already owned, rented or finished are excluded.
6. **Popularity tie-breaker:** rating, then title.
7. **Fallback:** with no preferences, or too few matches, pad with bestsellers labelled "Popular with readers".

Each result carries `reasons[]` so the UI can explain why it appears. The scorer is a pure function with weights in one config object, so it is easy to tune and test deterministically.

### 4.5 Routing strategy (Expo Router, file-based, shared for native and web)

```
app/
  _layout.tsx                      root: providers (theme, stores hydration), auth/onboarding gate
  index.tsx                        redirect to /(tabs)/home
  (auth)/sign-in.tsx
  (auth)/sign-up.tsx
  onboarding/profession.tsx        step 1
  onboarding/interests.tsx         step 2
  (tabs)/_layout.tsx               adaptive nav: bottom tabs (compact) / side rail or top nav (wide)
  (tabs)/home.tsx                  Discover + recommended for you
  (tabs)/browse.tsx                catalogue, search, filters
  (tabs)/library.tsx               shelves (query param ?shelf=reading)
  (tabs)/rentals.tsx               active rentals and due dates
  (tabs)/cart.tsx
  (tabs)/profile.tsx               profile, profession/interests edit, orders, settings
  book/[id].tsx                    detail with Buy / Rent 7d / Rent 30d
  category/[id].tsx
  checkout/address.tsx
  checkout/payment.tsx             mock, demo only
  checkout/review.tsx
  checkout/confirmation.tsx
  orders/index.tsx
  orders/[id].tsx
  rentals/[id].tsx
  +not-found.tsx
```

**Routing rules:**

- **Gates** in the root layout: unauthenticated users can browse but are redirected to sign-in for checkout, library and rentals. Authenticated users with `onboardingCompleted = false` are redirected to onboarding (skippable, with a reminder in profile).
- **Deep links and web URLs** work for books, categories, orders and rentals. Unknown ids render a not-found state.
- **Filter, search and shelf state live in URL params** so web refresh, sharing and back navigation work.
- **Web SEO:** book and category pages need proper titles and meta, and static or server rendering is a decision (see risks). The Phase 1 default is client-side single-page output.

### 4.6 State management

| Store                                | Holds                                          | Persisted                                             | Notes                                                                                      |
| ------------------------------------ | ---------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `auth`                               | current user, session flag                     | user only. Token (if any) in secure storage on native | Mock sign-in. Web has no equivalent of secure storage, so no real tokens on web in Phase 1 |
| `profile`                            | professionId, interestTagIds, onboarding state | yes                                                   | Triggers recommendation recompute                                                          |
| `cart`                               | CartItem[]                                     | yes                                                   | Revalidated against catalogue on focus                                                     |
| `library`                            | LibraryEntry[]                                 | yes                                                   | Mutated by order workflow and manual actions                                               |
| `rentals`                            | Rental[]                                       | yes                                                   | Status derived by selector with injected clock                                             |
| `orders`                             | Order[]                                        | yes                                                   | Written by the place-order workflow                                                        |
| `settings`                           | theme, dismissed hints                         | yes                                                   |                                                                                            |
| Server-like data (books, categories) | fetched through repositories                   | no (cache in memory)                                  | Phase 1 uses simple hooks. React Query is a Phase 2 candidate                              |

**Persistence:** Zustand `persist` with a **platform adapter** (AsyncStorage on native, localStorage via the same async interface on web), a **schema version and migrate function**, hydration gating, and corrupt-state recovery. Persisted data is **namespaced by user id** so user-scoped state (cart, library, rentals, orders) does not leak between accounts on shared devices or browsers.

**Derived data** (rental status, recommendations, shelf views) is computed by selectors from stored facts, not stored.

### 4.7 Component hierarchy

```
RootLayout
 ├─ ThemeProvider / StoreHydrationGate / ErrorBoundary
 ├─ AuthGate / OnboardingGate
 └─ ResponsiveShell
     ├─ NavBar (compact: BottomTabs | medium: NavRail | expanded: TopNav + optional Sidebar)
     └─ Screen content
         ├─ HomeScreen
         │   ├─ HeroBanner
         │   ├─ RecommendedSection ── BookCarousel ── BookCard ── RecommendationReason
         │   ├─ NewArrivalsSection / BestsellersSection ── BookCarousel
         │   └─ CategoryGrid ── CategoryTile
         ├─ BrowseScreen
         │   ├─ SearchBar
         │   ├─ FilterPanel (sheet on compact, sidebar on wide)
         │   └─ BookGrid (columns by breakpoint) ── BookCard
         ├─ BookDetailScreen
         │   ├─ BookHero (cover, title, authors, rating)
         │   ├─ PurchaseOptions ── BuyOption / RentOption (7d, 30d) / StockBadge
         │   ├─ LibraryShelfPicker
         │   ├─ BookDescription
         │   └─ RelatedBooks ── BookCarousel
         ├─ LibraryScreen
         │   ├─ ShelfTabs (Want to read | Reading | Finished | Owned | Rented)
         │   └─ LibraryList ── LibraryItem ── ShelfPicker / RentalBadge
         ├─ RentalsScreen
         │   ├─ RentalSummary (active count, next due)
         │   └─ RentalList ── RentalCard ── DueDateBadge / LateFeeNotice
         ├─ CartScreen
         │   ├─ CartLineList ── CartLine ── QuantityStepper | RentalTermPicker
         │   └─ OrderSummary
         ├─ Checkout screens ── AddressForm / DemoPaymentNotice / ReviewSummary / Confirmation
         ├─ Onboarding ── ProfessionPicker / InterestTagPicker
         └─ ProfileScreen ── ProfileSummary / PreferencesEditor / OrderList / SettingsPanel
Shared primitives: Button, Input, Badge, Chip, Rating, PriceTag, Skeleton, EmptyState, ErrorState, Sheet, Toast
```

### 4.8 Responsive design approach

- **Breakpoints (tokens):** compact (<600), medium (600–1023), expanded (>=1024). A single `useBreakpoint` hook, backed by `useWindowDimensions`, drives layout. Values are defined in the theme and not duplicated.
- **Adaptive navigation:** bottom tabs on compact, navigation rail on medium, top navigation (plus optional sidebar) on expanded.
- **Adaptive layouts:** book grid columns scale by breakpoint (for example 2, 3-4, 5-6). Book detail is a single column on compact and two columns (cover and purchase panel beside content) on expanded. Filters are a bottom sheet on compact and a persistent sidebar on expanded. Checkout is a single column with an order summary beside it on expanded.
- **Content width cap** on large screens for readable text lines.
- **Fluid sizing:** flex layouts, relative spacing tokens, and image aspect ratios fixed to avoid layout shift. Use scalable typography that respects system font size.
- **Input modalities:** touch targets of at least 44px on native, plus hover, focus rings and full keyboard navigation on web.
- **Web specifics:** responsive images with sizing, route-level code splitting through Expo Router, reduced-motion support, and semantic roles for accessibility.
- **Verification:** component tests at multiple mocked window sizes, plus web E2E at mobile and desktop viewports.

### 4.9 Key business rules

- **Rental:** 7 or 30 day terms only. `dueAt = startAt + termDays`. Rental price is a percentage of the buy price per term. Return is a mock action that records `returnedAt`. After `dueAt` and before return, status is `overdue` (shown to the reader as "Expired") and a flat late fee notice is shown with text making clear it is not charged in this phase.
- **Renewal:** allowed once (`MAX_RENEWALS`), for 7 or 30 more days, priced like a new rental of that term. The new due date is the current due date plus the term, so no paid days are lost. Blocked when the rental is returned or expired, the renewal limit is reached, the title is no longer rentable, or other readers are on the title's waitlist. Each renewal is recorded on the rental (`renewals[]`) and kept in history.
- **Reminders:** a rental due within 2 days, or expired, produces an in-app reminder (home, profile, rentals). Nothing is sent by email or push.
- **Rental stock:** each rental decrements `stockRent`, and return increments it.
- **Cart:** rent lines are quantity 1, a user cannot rent a book they already actively rent, and buy quantities are capped by `stockBuy`.
- **Order:** price snapshot per line. Placement is atomic (order, rentals, library entries or none), with an idempotency key to prevent duplicates.
- **Money:** integer minor units, one currency in Phase 1.

### 4.10 Security and compliance (per project security rules)

- No secrets or credentials in code. Config through environment variables, `EXPO_PUBLIC_*` for non-secret values only. `.gitignore` must exclude `.env*`, `node_modules` and build output.
- **Payment is a mock.** The UI never collects, stores or logs card data. A clearly labelled demo step is used.
- Mock auth stores no password. Auth is behind `AuthRepository` so OIDC or SAML replaces it in Phase 2.
- **Web storage caveat:** localStorage is readable by any script on the page, so no tokens or sensitive data are stored there. Phase 2 web auth should use secure, httpOnly, sameSite cookies. Set a restrictive Content Security Policy on web hosting.
- Validate all inputs (address, search, term days, quantities, profile selections) with schemas and **allowlists** (profession and interest ids must come from the fixed lists).
- Generic user-facing errors, structured logs without PII or tokens, log levels.
- Latest stable, actively maintained, non-EOL dependencies. Commit the lock file. Run dependency and secret scanning in CI. Exact versions are verified at scaffold time, not assumed here.
- Web hosting and any dev server must bind to localhost or a specific internal address, not `0.0.0.0`. Any future network call uses HTTPS (TLS 1.2+) with timeouts.
- Profession and interests are **personal data**. Keep them local in Phase 1 and treat them as PII in logs (never log them). Phase 2 needs consent and privacy review.

---

## 5. Components Impacted

All new, since the repo is empty.

| Area                 | New modules                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Tooling              | Expo app (iOS, Android, web), TypeScript strict, ESLint, Prettier, Jest, RNTL, Maestro, web E2E tool, `.gitignore`, CI workflow |
| Routing              | Expo Router tree in 4.5, gates and not-found                                                                                    |
| Theme and responsive | tokens, breakpoints, `useBreakpoint`, adaptive shell and navigation                                                             |
| Shared UI            | primitives and composites listed in 4.7                                                                                         |
| Domain               | pricing, rental rules, library rules, recommendation scorer, schemas                                                            |
| Data                 | repository interfaces, mock implementations, seed data (books, categories, professions, interests, profession map)              |
| State                | seven stores, persistence adapters, migrations, order workflow                                                                  |
| Features             | catalogue, cart, checkout, rentals, library, recommendations, onboarding and profile, auth                                      |
| Docs                 | README, architecture and conventions, repository contract for Phase 2                                                           |

---

## 6. Dependencies

- **Runtime and tooling:** Node LTS, npm or pnpm, Expo CLI, iOS Simulator (macOS), Android emulator, a modern browser for web.
- **Libraries (versions verified at scaffold time):** Expo and Expo Router, React Native and React Native Web (web target), `react-dom`, Zustand, `@react-native-async-storage/async-storage`, `expo-secure-store` (native only), a schema library such as Zod, `expo-image`, Jest (`jest-expo`), React Native Testing Library, Maestro CLI, and a web E2E tool such as Playwright.
- **Date handling:** a small, maintained date library or native `Date` with UTC-only utilities. Decide at Sub-Task 4.
- **Assets:** synthetic or licensed cover images. Do not hotlink untrusted sources.
- **Inputs from the business (blockers for domain tasks):** profession list, interest tag list, profession-to-category map, rental prices, late-fee amount, shipping and tax rules.
- **CI system and dependency scanner** to be confirmed.

---

## 7. Implementation Sub-Tasks

Each sub-task is independent, reviewable and processed one at a time. Update **Status** after completion and record any context needed by the next task under "Notes for next task".

---

### Sub-Task 1 — Project scaffold and tooling (native + web)

**Intent:** Establish a consistent, secure, testable foundation that runs on iOS, Android and web.

**Expected Outcomes:**

- App boots on iOS, Android and in a browser showing a placeholder screen.
- `lint`, `typecheck`, `test` pass on a clean checkout. CI runs them plus a dependency scan.

**Todo List:**

1. Verify the latest stable Expo SDK and Node LTS, then scaffold a TypeScript Expo app with Expo Router and the web target enabled.
2. Enable TypeScript `strict` and path aliases.
3. Configure ESLint and Prettier.
4. Configure Jest (`jest-expo`) and React Native Testing Library, plus a smoke test.
5. Add `.gitignore` (including `.env*`) and commit the lock file.
6. Add CI for lint, typecheck, tests and dependency scanning.
7. Update [`README.md`](README.md) with setup and run instructions for all three platforms.

**Relevant Context:** [`README.md`](README.md) is the only existing file. Security rules require latest stable, maintained, non-EOL dependencies.

**Status:** `[x] done` (one follow-up open: dependency audit, see notes)

**Notes for next task:**

- **Expo SDK 57** is used, not 58. SDK 58 (`expo@58.1.0`) requires Node `^22.13.0`, and this machine has Node 22.12.0. User agreed: stay on SDK 57 and upgrade to SDK 58 later after upgrading Node. Planned follow-up.
- **Layout differs from section 4.2.** The template puts routes in `src/app/` (not root `/app`), and the `@/*` alias maps to `./src/*`. New code should go under `src/` (for example `src/domain`, `src/data`, `src/store`). Routes go in `src/app/`. The plan's routing tree in 4.5 applies relative to `src/app/`.
- **Template content still present:** `src/app/index.tsx`, `src/app/explore.tsx`, `src/components/app-tabs*.tsx`, `animated-icon*`, `hint-row`, `web-badge`, `external-link`, `ui/collapsible`, `themed-*`, `constants/theme.ts`, `hooks/use-*`. Sub-Task 2 replaces the shell, so remove or rework these there. `AGENTS.md` came from the template and says to read the versioned Expo docs before using Expo APIs.
- **Static web output** is enabled (`app.json` `web.output: "static"`, `typedRoutes` and `reactCompiler` on). Static rendering matters for storage and hydration code: anything reading `localStorage` or `window` must be client-only.
- **React Compiler lint rules are on.** The template's `use-color-scheme.web.ts` was rewritten with `useSyncExternalStore` to pass `react-hooks/set-state-in-effect`. Avoid `setState` directly in effects.
- **TypeScript 6:** `@types/*` are no longer auto-included. `tsconfig.json` sets `"types": ["jest"]`. Add other type packages there if needed. `src/expo-types.d.ts` references `expo/types` so CSS imports typecheck.
- **Jest:** `jest-expo` preset with `jest@~29.7.0`. `moduleNameMapper` maps `.css` to `__mocks__/styleMock.js` and `@/` to `src/`. `react-test-renderer` is pinned to `19.2.3` to match React 19.2.3 (the latest renderer, 19.3.1, needs React 19.3.1 and breaks install). Use `npx expo install` for Expo packages.
- **Scripts:** `lint`, `typecheck`, `format`, `format:check`, `test`, `test:ci`, `audit:prod`. CI is in `.github/workflows/ci.yml` (Node 22, `npm ci`).
- **`.gitignore`** now ignores `.env`, `.env.*` (except `.env.example`) and `coverage/`.
- **Not done / open:**
  - `npm run audit:prod` currently **fails** (exit 1): 3 high, 3 moderate. All are transitive dependencies of SDK 57 (`expo-router` -> `query-string@7.1.3` -> `decode-uri-component@0.2.2`; `expo` -> `@expo/fingerprint` -> `minimatch`). npm's only offered fixes are `expo-router@58.0.33` or downgrading `expo` to 52, so they are not safe fixes in SDK 57. Security rules require high findings to be patched or have a documented mitigation within 30 days, and the SDK 58 upgrade is the planned remedy. Until then the CI `dependency-audit` job will be red. Decision needed: allow that job to continue-on-error until the upgrade, or accept a red job. Not changed yet.
  - Maestro and the web E2E tool are not installed. They belong to Sub-Task 16.
  - Native iOS and Android launch was not verified (no emulator in this environment). Web static export, `expo-doctor` (18/18), lint, typecheck, Prettier and the Jest smoke test all pass.

---

### Sub-Task 2 — Theme, breakpoints and responsive shell

**Intent:** Build the responsive foundation first so every later screen is responsive by default.

**Expected Outcomes:**

- Theme tokens (light and dark), breakpoint tokens and `useBreakpoint`.
- Adaptive navigation (bottom tabs, rail, top nav) with placeholder screens for all tabs.
- Content width cap and layout primitives (Container, Grid, Stack).

**Todo List:**

1. Define tokens for color, spacing, typography and breakpoints.
2. Implement `useBreakpoint` and layout primitives.
3. Implement the root layout and the tabs layout with adaptive navigation.
4. Add keyboard focus styles and reduced-motion handling for web.
5. Component tests at compact, medium and expanded sizes.

**Relevant Context:** Section 4.5 routing tree and 4.8 responsive approach.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 3 — Shared UI kit

**Intent:** Provide reusable, accessible building blocks.

**Expected Outcomes:** Primitives and composites from 4.7 (Button, Input, Chip, Badge, Rating, PriceTag, Skeleton, EmptyState, ErrorState, Sheet, Toast, BookCard, QuantityStepper, RentalTermPicker, DueDateBadge) with component tests and accessibility roles and labels.

**Todo List:**

1. Build primitives with variants and states (loading, disabled, error).
2. Build BookCard (adapts to grid and carousel), RentalTermPicker (7 or 30 only), DueDateBadge.
3. Add accessibility props and minimum touch targets. Add hover and focus states for web.
4. Component tests, including keyboard interaction on web.

**Relevant Context:** Theme and breakpoint tokens from Sub-Task 2.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 4 — Domain model, schemas and business logic

**Intent:** Encode the entities and all business rules as pure, heavily tested code.

**Expected Outcomes:**

- Types and validation schemas for all entities in 4.3.
- Pure functions for cart totals, rental price and dates, derived rental status, late-fee notice, library rules, search and filter.

**Todo List:**

1. Define entity types and schemas (money in minor units, UTC timestamps, allowlisted ids).
2. Implement cart totals, rental price (7 or 30), `dueAt`, derived status with injectable clock.
3. Implement library rules: shelf transitions, auto-add on purchase and rental, derived Owned and Rented views.
4. Implement search, filter and sort helpers.
5. Unit tests for boundaries: due date exactly at `dueAt`, due-soon window edge, DST and timezone shifts, rent-and-buy of the same book, rent while already renting, zero or excess quantity, finishing a rented book that is then returned.

**Relevant Context:** Rules in 4.9. Confirm library modelling (open question 2) before starting.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 5 — Recommendation engine

**Intent:** Deliver explainable, profession and interest based recommendations.

**Expected Outcomes:**

- Pure scorer returning ranked books with `reasons[]`.
- Weights in a single config. Fallback for guests and users without onboarding.

**Todo List:**

1. Define the profession and interest taxonomies and the profession-to-category/tag map as seed data.
2. Implement the scorer per 4.4 (profession, interests, library signals, popularity, exclusions).
3. Generate human-readable reasons.
4. Unit tests: deterministic ordering and tie-breaks, already-owned or rented or finished exclusion, no-profile fallback, profession "Other", users with many interests, empty catalogue, unknown ids rejected.

**Relevant Context:** Section 4.4. Depends on Sub-Task 4 types.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 6 — Mock data and repository layer

**Intent:** Provide the data contract Phase 2 must honour, with realistic seed data.

**Expected Outcomes:**

- Repository interfaces plus mock implementations and a single factory.
- Seed data: about 40–60 books, around 8 categories (including parent and child), tagged books, rentable and non-rentable, low or zero stock for buy and rent, long titles, missing covers, multiple authors.
- Latency and failure simulation switches.

**Todo List:**

1. Define interfaces: Book, Category, Auth, Profile, Order, Rental, Library.
2. Create seed JSON including professions, interests and the profession map.
3. Implement mock repositories with latency, pagination and forced failures.
4. Implement the repository factory.
5. Unit tests including failure injection and pagination edges.

**Relevant Context:** No screen may import seed JSON directly.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 7 — Stores, persistence and order workflow

**Intent:** Provide safe state with cross-platform persistence and the atomic place-order workflow.

**Expected Outcomes:**

- Seven stores with typed actions and selectors.
- Platform storage adapter, versioned migrations, hydration gating, user-namespaced persistence, corrupt-state recovery.
- `placeOrder` workflow that creates the order, rentals and library entries atomically.

**Todo List:**

1. Create stores per 4.6.
2. Implement the storage adapter (native and web) with versioning and migration.
3. Namespace user-scoped state by user id and clear or switch on sign-out and sign-in.
4. Implement `placeOrder` with stock and price revalidation, idempotency key and rollback on partial failure.
5. Implement mock `returnRental`.
6. Tests: migration from older fixtures, corrupt storage, account switching, atomic failure, duplicate submit.

**Relevant Context:** Sections 4.6 and 4.9.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 8 — Auth (mock) and onboarding

**Intent:** Let users sign in and set profession and interests.

**Expected Outcomes:**

- Sign-up, sign-in, sign-out, guest browsing, route gates.
- Two-step onboarding (profession, interests), skippable, editable later in profile.

**Todo List:**

1. Implement the mock `AuthRepository` and store integration, with no password stored.
2. Build sign-in and sign-up screens with schema validation.
3. Build the profession picker (single select) and interest picker (multi select, with min and max rule to be confirmed).
4. Implement gates and redirects, including a return-to destination after sign-in.
5. Tests: validation, gates, skip behaviour, edit from profile triggers recommendation refresh, sign-out clears user-scoped state.

**Relevant Context:** Section 4.5 gates. Treat profession and interests as personal data.

**Status:** `[ ] pending` (not built: no sign-in, sign-up or onboarding screens. Profession and interests are edited on the Profile page instead, see section 13)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 9 — Catalogue: browse, search, category, book detail

**Intent:** Let users find and inspect books on any screen size.

**Expected Outcomes:**

- Browse with debounced search, filters (category, price, rentable, availability) and sort, with state in URL params.
- Category screen and book detail with Buy, Rent 7 days and Rent 30 days.
- Responsive grid and responsive detail layout.

**Todo List:**

1. Build Browse with search, filter panel (sheet on compact, sidebar on expanded) and virtualized grid.
2. Build Category screen.
3. Build Book Detail with purchase options, stock badges and library shelf picker.
4. Handle loading, empty, error, not-found and no-results states.
5. Integration tests and responsive tests at three sizes.

**Relevant Context:** Search and filter helpers from Sub-Task 4.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 10 — Cart and checkout (mock payment)

**Intent:** Complete purchase and rental ordering end to end.

**Expected Outcomes:**

- Mixed cart (buy and rent) with accurate totals and revalidation.
- Address, demo payment, review and confirmation screens. Orders and rentals created via `placeOrder`.

**Todo List:**

1. Build Cart with quantity stepper and rental term picker. Enforce rules in 4.9.
2. Revalidate cart on focus and flag price or stock changes.
3. Build address form with validation, a labelled demo payment step, review and confirmation.
4. Handle payment failure (cart preserved), stock-out during checkout, double submit.
5. Build order list and order detail screens.
6. Tests for success, each failure path and a responsive two-column checkout.

**Relevant Context:** Failure scenarios in section 9. No card data is ever collected.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 11 — Reading library

**Intent:** Give users a personal library with shelves.

**Expected Outcomes:**

- Library screen with five shelf views, manual status changes, and automatic additions after purchase or rental.

**Todo List:**

1. Build ShelfTabs and LibraryList with shelf in the URL.
2. Add the shelf picker to book cards and detail.
3. Show Owned and Rented as derived views, including rental due badge.
4. Handle removal rules (cannot remove a book with an active rental, an owned book stays Owned).
5. Tests: auto-add on purchase and rental, manual transitions, returned rental leaves the Rented view but keeps history, empty states per shelf.

**Relevant Context:** Library rules in 4.3 and Sub-Task 4.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 12 — Rentals tracking

**Intent:** Let users track active rentals and due dates.

**Expected Outcomes:**

- Rentals screen with active, overdue and returned groups, due dates, days remaining, and a late-fee notice stating it is shown only and not charged.
- Mock return action. A renewal action was added later (see section 13).

**Todo List:**

1. Build RentalSummary and RentalList with DueDateBadge and LateFeeNotice.
2. Build rental detail with return action and confirmation.
3. Add due-soon and overdue indicators in the tab badge and on the home screen.
4. Tests with injected clock for every status transition, return flow, and timezone and DST edges.

**Relevant Context:** Rules in 4.9. In-app reminders and renewal were added after this task (see section 13).

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 13 — Discover home and recommendations UI

**Intent:** Surface recommendations and discovery content.

**Expected Outcomes:**

- Home with Recommended for you (with reasons), new arrivals, bestsellers and category grid.
- Per-section loading and error isolation.

**Todo List:**

1. Add repository methods for new arrivals and bestsellers.
2. Build carousels and the recommendation reason display.
3. Prompt users without a profile to complete onboarding.
4. Tests: new user fallback, exclusions, one failing section does not break the page, profile edit refreshes results.

**Relevant Context:** Scorer from Sub-Task 5.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 14 — Profile and settings

**Intent:** Let users manage preferences and view history.

**Expected Outcomes:** Profile screen with editable profession and interests, order history, theme setting and sign-out.

**Todo List:**

1. Build the profile summary and preferences editor.
2. Link to orders and rentals.
3. Add theme setting.
4. Tests for edit and persistence.

**Relevant Context:** Sub-Task 8 pickers are reused.

**Status:** `[x] done` (see section 13 for what was built and the gaps)

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 15 — Hardening: accessibility, performance, web, security

**Intent:** Raise quality across all three platforms.

**Expected Outcomes:** Accessibility verified, smooth lists, web behaviours correct, errors and logs safe.

**Todo List:**

1. Accessibility pass: screen reader labels, focus order, keyboard-only web navigation, contrast in both themes, reduced motion.
2. Performance: virtualized lists, image sizing and caching, route-level code splitting on web, memoize hot components.
3. Web: page titles and meta per route, 404 handling, CSP guidance for hosting, check browser support.
4. Global error boundary with generic messages and a structured logger that never logs PII.
5. Dependency and secret scan, resolve findings per severity thresholds.

**Relevant Context:** Project security rules, section 4.10.

**Status:** `[ ] pending`

**Notes for next task:** _(fill after completion)_

---

### Sub-Task 16 — E2E flows and documentation

**Intent:** Lock in critical journeys and document the Phase 2 handoff.

**Expected Outcomes:** Maestro flows (native) and web E2E flows at mobile and desktop viewports. Documentation of architecture and the repository contract.

**Todo List:**

1. Flows: sign up and onboarding, then recommendations; browse, buy, checkout; rent 7 days and rent 30 days, then rentals and due dates; library auto-add and manual shelf change; guest redirected at checkout.
2. Document repository interfaces and entity schemas as the backend contract.
3. Update [`README.md`](README.md) with architecture, scripts and test instructions.

**Relevant Context:** Section 8.

**Status:** `[ ] pending`

**Notes for next task:** _(fill after completion)_

---

## 8. Testing Strategy

| Level       | Tooling                               | What is covered                                                                                                                  |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Jest                                  | Pricing, rental dates and derived status, library rules, recommendation scorer, schemas, store actions and selectors, migrations |
| Component   | Jest + RNTL                           | Shared UI, forms, list states, accessibility roles, **layout at compact, medium and expanded sizes**                             |
| Integration | Jest + RNTL with mock repositories    | Add to cart, checkout success and failure, onboarding to recommendations, auto library add, gates                                |
| E2E native  | Maestro                               | Journeys listed in Sub-Task 16                                                                                                   |
| E2E web     | Playwright or equivalent (to confirm) | Same journeys at mobile and desktop viewports, keyboard navigation, refresh and deep links                                       |
| Regression  | Same suites in CI                     | Persisted state migration fixtures, cart revalidation, order snapshot immutability, recommendation determinism, money rounding   |
| Static      | ESLint, `tsc --noEmit`                | Every PR                                                                                                                         |
| Security    | Dependency scan, secret scan, SAST    | Vulnerable packages, secrets, no PII or tokens in logs                                                                           |

**Determinism:** inject clock, id generator and seeded mock data. Failure switches come from the mock layer.

**Coverage focus:** the domain layer (rental rules, library rules, recommendations) has the highest coverage requirement.

---

## 9. Edge Cases, Compatibility and Failure Scenarios

**Edge cases**

- Same book bought and rented. Renting a book already actively rented by the user. Renting a book already owned (allowed or blocked, see open questions).
- Rentable false, `stockRent` zero, `stockBuy` zero, book removed after being in cart or library.
- Due date at the exact boundary, DST changes, device timezone or clock changes, rentals spanning month ends.
- Overdue rental with returned action. Return of a book the user marked as Reading or Finished.
- User with no profession or interests, profession "Other", user who skips onboarding, user who changes preferences mid-session.
- Catalogue too small to fill recommendation sections.
- Long titles, many authors, missing covers or descriptions.
- Price changes between cart and checkout.
- Window resized across breakpoints, orientation change, very wide screens, browser zoom and back/forward navigation on web.
- Two accounts on one device or browser.

**Failure scenarios**

- Simulated network latency and failure on any repository call, with retry.
- Payment failure leaves the cart intact and creates no order.
- Partial failure while creating order, rentals and library entries: must be atomic with rollback.
- Double submit or refresh on the confirmation page must not duplicate orders.
- App closed or tab closed mid-checkout leaves no half-created order.
- Corrupt or outdated persisted data: migrate or reset without a crash.
- Storage unavailable or full on web (private browsing): degrade with a message.
- Image load failure: show a placeholder.

**Backward compatibility (Phase 2 readiness)**

- No existing users, but persisted data will exist on test devices and browsers, so versioned migrations are needed from the start.
- Repository interfaces and schemas are the backend contract, so review them carefully in Sub-Tasks 4 and 6.
- Integer money and UTC timestamps avoid later format migrations.
- Rental status derived from facts avoids stale status data when a backend arrives.

---

## 10. Risks, Trade-offs and Alternatives

| Risk / Decision                                                                                            | Impact                               | Mitigation / Alternative                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One codebase for native and web can produce a web experience that feels like a mobile app, with weaker SEO | Reduced web quality, discoverability | Adaptive layouts and web hardening in Sub-Task 15. SEO needs a rendering decision (static or server output) if important. Alternative: a separate Next.js web app sharing the domain layer |
| React Native Web library gaps and platform differences (storage, hover, secure storage)                    | Rework                               | Platform adapters, early web checks in each sub-task, only web-compatible libraries                                                                                                        |
| Local storage on web is not secure                                                                         | Data exposure                        | Store no tokens or sensitive data. Cookies in Phase 2                                                                                                                                      |
| Maestro does not cover web                                                                                 | Gap in web E2E                       | Add a web E2E tool (Playwright)                                                                                                                                                            |
| Mock data hides real backend behaviour                                                                     | Phase 2 rework                       | Async interfaces, pagination, failure simulation, documented contract                                                                                                                      |
| Rule-based recommendations are crude and the profession map is subjective                                  | Poor relevance                       | Explainable reasons, weights in one config, content review of the map. ML deferred                                                                                                         |
| Library shelf semantics (exclusive vs overlapping) are ambiguous                                           | Wrong model, rework                  | Confirm before Sub-Task 4 (open question 2)                                                                                                                                                |
| Physical rentals imply logistics (shipping, return process, damage, deposits) that Phase 1 does not model  | Business gaps                        | Treat as out of scope, list in open questions                                                                                                                                              |
| Late fee shown but not charged may confuse users                                                           | Support issues                       | Clear copy stating it is informational in this phase                                                                                                                                       |
| Profession and interests are personal data                                                                 | Privacy                              | Local only in Phase 1, never logged, consent and review in Phase 2                                                                                                                         |
| Large scope                                                                                                | Delivery risk                        | Independent sub-tasks. Sub-Tasks 1–10 give a working buy and rent flow. 11–14 add library, rentals tracking, discovery and profile                                                         |
| Dependency drift and vulnerabilities                                                                       | Security                             | Latest stable versions, lock file, CI scanning                                                                                                                                             |

**Alternatives considered**

- **Redux Toolkit or React Query** instead of Zustand: more structure and caching. React Query is a good fit in Phase 2 on top of the repository layer.
- **Separate Next.js site** for the web: better SEO and server rendering, but two codebases. Rejected for Phase 1 by the user's choice of one codebase.
- **Library as five independent lists**: simpler to explain but allows contradictory states. A single reading status plus derived views is proposed instead, pending confirmation.

---

## 11. Open Questions

1. ~~**Wishlist**~~ **Resolved:** The "Want to read" shelf replaces the wishlist. No separate wishlist.
2. ~~**Library semantics**~~ **Resolved:** One reading status plus derived Owned and Rented views.
3. **Rental prices:** How are 7 and 30 day prices set (fixed per book, or a percentage of purchase price)? What is the flat late fee amount and is it per day or one-off?
4. **Rental restrictions:** Maximum concurrent rentals per user? Can a user rent a book they already own? Is a deposit needed?
5. **Physical logistics:** Is shipping cost modelled for buy and rent? Return process and damaged or lost books?
6. **Taxonomies:** Final list of professions and interest tags, minimum and maximum interests, and who owns the profession-to-category map?
7. **Web SEO:** Do book and category pages need to be search-engine indexable? That influences the rendering approach.
8. **Web E2E tool:** Is Playwright acceptable for web E2E alongside Maestro for native?
9. **Currency, tax and shipping rules.**
10. **Design:** Brand guide or mockups, or should a default design system be created?
11. **Catalogue data:** Existing book data and covers, or synthetic seed data?
12. **CI and scanning:** Which CI system and dependency scanner (security rules mention Mend)?
13. **Browser and OS support:** Minimum browsers and iOS and Android versions.
14. **Reminders:** Confirm that due-date reminders (notifications or email) are deferred to Phase 2.

---

## 11a. Placeholder Assumptions (agreed with user, to be replaced by business input)

Used so implementation can proceed while open questions 3, 4, 5, 6, 9 and 14 remain unanswered. All values live in seed or config files, never in logic.

| Topic                  | Placeholder                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| Rental price (7 day)   | 15% of `buyPrice`, rounded to nearest minor unit                              |
| Rental price (30 day)  | 30% of `buyPrice`, rounded to nearest minor unit                              |
| Late fee               | Flat 5.00 one-off, shown only, never charged                                  |
| Due-soon window        | 2 days before `dueAt`                                                         |
| Max concurrent rentals | 5 per user                                                                    |
| Renting an owned book  | Allowed                                                                       |
| Deposit                | None                                                                          |
| Shipping               | Flat 4.00, free over 40.00                                                    |
| Tax                    | None                                                                          |
| Currency               | USD                                                                           |
| Professions            | Software Engineer, Teacher, Student, Doctor, Designer, Manager, Writer, Other |
| Interest tags          | Fiction, Science, History, Business, Self-help, Technology, Art, Health       |
| Interests selection    | Min 1, max 5                                                                  |
| Reminders              | In-app only (due within 2 days, or expired). No email or push                 |
| Renewals               | Once, 7 or 30 days, same price as a new rental, blocked by a waitlist         |
| Waitlist               | Mock list in `src/data/seed.ts` (`WAITLIST`), read through `getWaitlistCount` |

---

## 12. Progress Tracker

| #   | Sub-Task                                             | Status        |
| --- | ---------------------------------------------------- | ------------- |
| 1   | Project scaffold and tooling (native + web)          | `[x] done`    |
| 2   | Theme, breakpoints and responsive shell              | `[x] done`    |
| 3   | Shared UI kit                                        | `[x] done`    |
| 4   | Domain model, schemas and business logic             | `[x] done`    |
| 5   | Recommendation engine                                | `[x] done`    |
| 6   | Mock data and repository layer                       | `[x] done`    |
| 7   | Stores, persistence and order workflow               | `[x] done`    |
| 8   | Auth (mock) and onboarding                           | `[ ] pending` |
| 9   | Catalogue: browse, search, category, detail          | `[x] done`    |
| 10  | Cart and checkout (mock payment)                     | `[x] done`    |
| 11  | Reading library                                      | `[x] done`    |
| 12  | Rentals tracking                                     | `[x] done`    |
| 13  | Discover home and recommendations UI                 | `[x] done`    |
| 14  | Profile and settings                                 | `[x] done`    |
| 15  | Hardening: accessibility, performance, web, security | `[ ] pending` |
| 16  | E2E flows and documentation                          | `[ ] pending` |

---

## 13. Build Notes and Known Gaps (Sub-Tasks 2–14)

Sub-Tasks 2–14 were built together in one pass, so the per-task "Notes for next task" are summarised here instead. Sub-Task 8 is the exception: it was not built.

### What exists

| Area                  | Location                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes                | `src/app/`: `_layout`, `index` (home), `browse`, `recommendations`, `book/[id]`, `cart`, `library`, `profile`, `+not-found`                                                             |
| Theme and breakpoints | `src/theme/tokens.ts`, `src/theme/breakpoints.ts`. Compact below 600, medium 600–1023, expanded 1024 and up. Grid is 2, 3 or 4 columns (3 with a sidebar)                               |
| Domain (pure)         | `src/domain/`: `types`, `pricing`, `search`, `recommendations`, `library`, `orders`                                                                                                     |
| Data access           | `src/data/seed.ts` (24 fictional books, 8 categories, 8 professions). `src/data/catalogue.ts` is the **only** place screens read the catalogue, so it becomes the API client in Phase 2 |
| Stores                | `src/store/`: `cart`, `profile`, `shelf` (library, rentals, orders, atomic `placeOrder` and `returnRental`). Zustand with AsyncStorage, validated on load, corrupt state resets         |
| UI kit                | `src/components/ui/` (`AppText`, `Button`, `Chip`, `Layout`, `QuantityStepper`), `src/components/book/`, `src/components/rentals/`, `src/components/nav/`                               |
| Tests                 | `__tests__/`: 13 suites, 259 tests                                                                                                                                                      |

### Recommendation feature (profession, interests, goals)

- **Four preference inputs:** profession, professional interests (`PROFESSIONAL_TOPICS`, 9), personal interests (categories) and reading goals (`READING_GOALS`, 7). Caps: 5, 5 and 3. All ids are allowlist-validated in `src/store/profile.ts`.
- **Engine:** `src/domain/recommendations.ts`. Weights live in `WEIGHTS`: profession category 3, profession tag 1.5 each, professional interest 2, personal interest 2.5, goal 2, library category 1. Each result has a `breakdown` (kind, points, text) and `reasons` is the same text, strongest first. Score is the sum of the points. Owned, finished or rented books are excluded. Ties break by rating, then title. Too few matches pad with bestsellers labelled "Popular with readers".
- **Persisted profile is version 2.** A v1 profile loads with the new fields empty. Tampered or wrongly typed values are dropped.
- **UI:** `/recommendations` route (picks with a "why" box per book, the preference editor, and a table of the scoring rules built from `WEIGHTS`). Shared pieces are `PreferencesEditor`, `RecommendationGrid` and the `useRecommendations` hook. Home and Profile reuse them. The nav has a "For you" item.
- **Layout note:** in the detailed grid the book card keeps its natural height and the "why" box fills the rest of the cell. Making the card fill the cell leaves large empty areas.

### Rental feature (terms, pricing, due dates, renewal, history, reminders)

- **Terms and pricing:** 7 or 30 days only. Price is 15% or 30% of the buy price (`RENTAL_RATES`). The term picker shows both prices, and the cart and checkout validate the term.
- **Due dates:** `computeDueAt(start, term)` in `src/domain/pricing.ts`. Status is `active`, `dueSoon` (within 2 days), `overdue` (shown as "Expired") or `returned`.
- **Renewal rules:** `src/domain/rentals.ts` (`checkRenewal`, `applyRenewal`). One renewal (`MAX_RENEWALS`), 7 or 30 days at the same price as a new rental, added to the current due date. Blocked for returned or expired rentals, at the limit, for non-rentable titles, or when `getWaitlistCount` is above zero. The mock waitlist is `WAITLIST` in `src/data/seed.ts` (`b05` has 2 waiting, `b07` has 1). The store action is `renewRental` in `src/store/shelf.ts`, and it returns the reason when refused.
- **Stored data:** `Rental.renewals?: Renewal[]` is optional, so rentals saved earlier still load. Tampered renewal data drops that rental on load. The persist version stays 1.
- **Expired rentals:** shown in their own section with the late-fee notice (shown only, never charged). They cannot be renewed and must be returned before the same book can be rented again.
- **History:** returned rentals are listed newest first on `/rentals`, with a "Renewed once (+7 days)" line and the total spent on renewals.
- **Reminders:** `buildReminders` and the `RentalReminders` banner on Home, Profile and `/rentals`. Expired first, then due soon, soonest first. In-app only.
- **Duplicates:** the same book twice in one order is rejected with one message (errors are de-duplicated). A book with an active or expired unreturned rental cannot be rented again.
- **UI:** `/rentals` route, `RentalCard` (renew buttons, reason when blocked, confirmation), `RentalReminders`. Library's Rented shelf and Profile also offer renewal.
- **Not done:** the rental stock rule in 4.9 (a rental lowers `stockRent` and a return restores it) is still not applied, because stock is static seed data. A rental detail page was not built.

### Gotchas for whoever continues

- **Do not pass function or array `style` to a child of `<Link asChild>`.** Expo Router's `Link asChild` goes through a Radix Slot. On web, an array style throws (`Failed to set an indexed property [0] on 'CSSStyleDeclaration'`) and a function style is silently dropped. That crash blanks the whole page after hydration. Pass `StyleSheet.flatten([...])` and track hover and pressed state with `useState` and `onHoverIn`, `onHoverOut`, `onPressIn`, `onPressOut`. `Button`, `BookCard` and `TopLink` in `ResponsiveNav` show the pattern. `Chip` is not inside a `Link`, so its function style is fine.
- **`Button` has an `onDark` variant** for buttons on the dark hero. `secondary` is dark green and is unreadable there.
- **Hydration:** wall-clock and locale output must wait for `useHydrated()` (`src/hooks/use-time.ts`). Web is statically exported, so `window` is missing at render time. `src/store/storage.ts` falls back to in-memory storage.
- **Known warning:** the web build logs React error #418 (hydration mismatch) in the console on `/`, `/browse`, `/profile`, `/recommendations` and `/book/[id]`. It does not appear on `/library`, `/cart` or `/rentals` (checked with no seeded data, so those pages show no icon-bearing cards). The page still renders. **Partly traced, not fixed.** Bisecting with throwaway routes (since deleted) found:
  - A page whose only content is `<Ionicons name="star" />` reproduces it. So do `cart-outline` and `book`. A bare `<Ionicons>` inside a `View` with an accessibility label does too.
  - `AppText`, `Button` (with a link and no icon), `Chip`, `Grid` and `BookCover` on their own do not.
  - Making `useBreakpoint` hydration-aware did not remove it, so the original breakpoint hypothesis was wrong. That change was reverted.
  - **Open inconsistency:** the layout's nav also renders icons on every page, including the clean ones, so "icons cause it" is not the whole story. The `@expo/vector-icons` component renders `<Text />` until its font is loaded, which may differ between the static HTML and the first client render, but this was not confirmed. Next step: compare the server HTML and the client DOM for one affected page.
- **Dependency audit** is still red (see Sub-Task 1 notes). Decision pending.

### Verification done

- `npm run typecheck`, `npm run lint` (0 warnings), `npm run format:check` and `npm test` (259 of 259, 13 suites) all pass.
- `npx expo export --platform web` produces 34 static routes, including `/recommendations` and `/rentals`.
- The rentals page was checked at 390 and 1440 px with seeded rentals: active, due soon, expired, a waitlisted title, an already-renewed rental and a returned one. Reminders were checked on Home.
- Visual check with headless Chrome at 390, 820 and 1440 px for home, browse, recommendations, book detail, cart, library and profile. This found and fixed the `Link asChild` crash, the unreadable hero button and the unstyled nav and cards. On `/recommendations` it found and fixed uneven card heights in the detailed grid. Phone width was rendered in a 390 px iframe because headless Chrome will not go below about 500 px.
- The recommendations page was checked with seeded preferences (software engineer, AI and software interests, science and fiction, two goals). Each card showed its "WHY THIS BOOK" box with per-rule points.
- **Not verified:** native iOS and Android launch. There was no emulator or device.

### Known gaps against the plan

1. **Sub-Task 8:** no sign-in, sign-up or onboarding. Preferences are edited on the Profile page and on `/recommendations`.
2. **Checkout:** one-step "Place demo order" on the cart page. No separate address or payment screens.
3. **Missing routes:** category pages, order detail and rental detail.
4. **Dark theme** is not implemented.
5. **Sub-Task 15:** accessibility audit, performance work and a security review are not done.
6. **Sub-Task 16:** no Maestro or web E2E tests, and no Phase 2 contract documents.
7. **Hydration warning #418** is partly traced (see Gotchas) but not fixed.
8. **Deferred review items** are listed in "Review findings and fixes" below.

### Review findings and fixes

A full review of component reuse, responsive design, accessibility, performance, state, rental dates, search, recommendations and error handling. Each fix has a test in `__tests__/review-domain.test.ts`, `review-ui.test.tsx` or `workflows.test.tsx`.

| Area            | Finding                                                                                                                                                                                         | Fix                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rental dates    | A rental overdue by under 24 hours gave `-0` days, so the card said "Due today" next to a red "Expired" badge. A rental due in 2 hours said "due in 1 day".                                     | `daysOverdue` (at least 1) and `isDueWithinDay` in `pricing.ts`. One `dueLabel` in `rentals.ts` is used by the card and reminders. Wording is now "N days overdue" and "Due within 24 hours".                                                           |
| Recommendations | A book that can be neither bought nor rented (`b21`) could be recommended, including through the "popular" fallback.                                                                            | `recommendBooks` excludes books with no buy stock and no rent stock.                                                                                                                                                                                    |
| Search          | Search ignored the category name and did not fold accents ("tomas" missed "Tomás Reyes"). The `q` param was read only on first render.                                                          | `filterBooks` folds accents and takes an optional category-name lookup (the browse page passes one). Browse follows `q` changes from the URL by adjusting state during render.                                                                          |
| Error handling  | No route error boundary. A cart line for a removed book was hidden but still failed checkout. A failed storage write (quota, private mode) was unhandled. Order confirmation linked to Profile. | Root `ErrorBoundary` with a generic message and retry (never shows error text). Cart shows "no longer available" with a remove button. `safeStorage` swallows read, write and delete failures. Link now goes to `/rentals`.                             |
| State           | Five components each ran their own minute timer. The "needs attention" count was copied in the layout and Profile. Hard-coded `$5.00`, `$40` and `formatMoney(500)`.                            | One shared clock behind `useNow` (one interval, stops when unused). `countNeedingAttention` in `rentals.ts`. Copy now reads `LATE_FEE` and `FREE_SHIPPING_OVER`.                                                                                        |
| Accessibility   | The top links used `role="menu"`. Badges said "N items" for rentals too. Text could grow without limit. Notches were ignored.                                                                   | `role="navigation"`. Badges have specific labels ("2 rentals need attention", "1 item in cart") and are part of the link name. `maxFontSizeMultiplier` 1.6 on `AppText`. Safe-area insets on both bars via a null-safe hook (`src/theme/safe-area.ts`). |
| Reusability     | The self-clearing message was duplicated. Param allowlisting was duplicated. `BookGrid` had dead exports.                                                                                       | `useTransientMessage` hook, `parseAllowed` and `firstParam` in `src/utils/params.ts`. Dead exports removed.                                                                                                                                             |

**Deferred, with reasons**

- **Stock is static.** A rental does not lower `stockRent` and a return does not restore it (plan 4.9). A derived approach (`stockRent - active rentals for the book`) would touch `buildOrder`, `PurchaseOptions`, `addRent` and the availability filter. It needs a product decision on buy stock too, so it was not done.
- **`BreakpointProvider`.** `AppText` calls `useWindowDimensions` per text node. Fine at 24 books; revisit with real lists.
- **Lists.** Screens use `ScrollView`. Move to `FlatList` when the catalogue is paged (Phase 2).
- **`RentalReminders` uses `role="alert"`** on three pages. Consider `status` if screen-reader testing finds it noisy.
- **Relevance ranking** for search results, and "returned late" marking, were not added.
- **Unused template dependencies** (`expo-glass-effect`, `expo-symbols`, `@expo/ui`, `expo-device`, `expo-image`, `expo-web-browser`) were left alone because some are Expo Router peers. Check before removing.
- **Not verified:** native safe-area behaviour on a device, large-font rendering on a device, and 320 px width.
