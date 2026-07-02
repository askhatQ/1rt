# Tabata Timer

React Native (Expo + TypeScript) implementation of the Tabata Timer spec
(`НАСТРОЙКА СЕССИИ` / `TABATA` screens).

## Stack

- Expo SDK 57, TypeScript
- `@react-navigation/native-stack` — Home → Settings → Timer
- Zustand + `@react-native-async-storage/async-storage` (persisted sessions store)
- `react-native-svg` for the ring timer
- `expo-haptics`, `expo-keep-awake`, `expo-notifications`, `@expo-google-fonts/inter`

`react-native-mmkv` was in the original spec as the preferred store, but v4
requires `react-native-nitro-modules` (new-architecture native build) that
can't be exercised outside a real device/simulator build. AsyncStorage is the
spec's explicitly allowed fallback and works in Expo Go too.

## Running

```
npm install
npm run web      # quickest to preview (react-native-web) — see limitations below
npm run ios       # requires macOS + Xcode, or Expo Go on a real iPhone
npm run android   # requires Android SDK, or Expo Go on a real Android device
```

## Decisions on points the design left open

The source spec (`ТЗ`) flags several `[РЕШЕНИЕ РАЗРАБОТЧИКА]` points since a
static Figma mock can't encode behavior. Decisions made here:

- **Card long-press** (Home) → `Alert` action sheet with Редактировать /
  Удалить, the latter behind its own confirm `Alert`. See
  `src/screens/HomeScreen.tsx` → `onLongPressCard`.
- **Empty session list** → dedicated empty state (icon, title, copy, and a
  "СОЗДАТЬ ПЕРВУЮ СЕССИЮ" CTA) via `FlatList`'s `ListEmptyComponent`; the
  footer's dashed "+ Новая сессия" card is hidden while the list is empty so
  there's only one create-session affordance on screen.
- **Session name limit**: 30 characters.
- **Empty name handling**: the "НАЧАТЬ" CTA on Settings is disabled while the
  trimmed name is empty (rather than silently falling back to a default).
- **Stepper bounds/step**: exactly the table in the spec (work 5–300/5,
  rest 0–300/5, rounds 1–30/1, cycles 1–10/1, rest-between-cycles 0–600/5).
- **Total duration formula**: `cycles*(rounds*(work+rest)-rest) + (cycles-1)*restBetweenCycles`,
  i.e. the last round of every cycle has no trailing rest (matches the
  work→rest→…→restBetweenCycles state machine, not the mockup's static "4:00").
- **Ring direction**: the arc drains as time elapses (starts full, shrinks to
  empty), not the reverse. `progress` passed into `RingTimer` is
  `remainingSec / phaseDurationSec` (1 → 0), and `dashOffset = CIRCUMFERENCE *
  (1 - progress)`.
- **Exercise name field**: dropped. `TabataSession` has no `exercises` field
  (per §4 of the spec), so there's nothing to display; adding a fake/static
  exercise label would be decorative-only and was explicitly called out as
  optional in the spec.
- **Timer header title**: shows the session name instead of the static
  "TABATA" placeholder text.
- **Round progress vs. old "Раунд N из M" text**: only the top progress bar
  (`RoundProgressBar`) is rendered. The redundant bottom text called out in
  the spec as design tech-debt was never added.
- **RESET confirmation**: an `Alert` confirms before resetting once the
  timer has been started (skips the prompt if it's still at the untouched
  initial state).
- **Finished state**: since the model has a `finished` phase but the mockup
  has no cooldown screen, a minimal "ТРЕНИРОВКА ЗАВЕРШЕНА" screen with a
  single "НА ГЛАВНУЮ" button is shown — no additional cooldown flow.
- **Timer → Home navigation**: added an explicit "✕" close button in the
  Timer header (confirms first if the timer is running), since the mockup
  has no way to leave an in-progress session.
- **Background behavior**: the timer is driven by absolute timestamps
  (`phaseEndAt`), not `setInterval` decrements, so it never drifts and
  catches up correctly on foreground return — including skipping through
  multiple phases if the app was backgrounded for a long time.
- **Background notifications**: implemented via `expo-notifications`
  (`src/state/phaseNotifications.ts`). When the timer starts or resumes, every
  upcoming phase change from "now" through `finished` is computed once and
  scheduled up front as absolute-timestamp local notifications (`type: DATE`)
  — not a background JS timer, so delivery doesn't depend on the JS thread
  being alive. SKIP/RESET/PAUSE cancel the outstanding schedule; SKIP and
  RESUME recompute and reschedule from the new state. Capped at 48 scheduled
  notifications (iOS hard-limits an app to 64 pending local notifications
  app-wide; long high-round-count sessions will only get notifications for
  their next ~48 phase changes, not the entire session — a real OS
  constraint, not an oversight).
- **Sound on phase change**: **not implemented**, deliberately. See
  "Sound — why it's not here" below.
- **Orientation**: portrait-only (`app.json` → `orientation: "portrait"`).
- **Accessibility**: stepper +/− buttons and icon buttons carry
  `accessibilityLabel`s.

## Sound — why it's not here

The ask was to pick 2–3 short CC0/clearly-licensed sounds, name the source
and license explicitly, and wire them up with `expo-av`. This session's
sandbox runs behind an egress proxy that only allow-lists npm, GitHub, PyPI,
crates.io, the Go module proxy, and Anthropic's own domains — every other
host is rejected at the proxy with a `403` before any request reaches it
(verified directly: `curl -I https://kenney.nl/...` → `403 Forbidden`,
`policy denial`). There is no reachable host in this environment that serves
downloadable audio (Kenney, Freesound, Mixkit, etc. are all blocked), so
there is no way for me to fetch a real file *and* verify its license page
myself. Naming a source/license for a file I never actually opened would be
exactly the kind of fabrication that was explicitly ruled out, so I left it
undone rather than guess.

This is fully separable from everything else in this PR — swapping in real
audio later just means dropping 2–3 files into `assets/sounds/` and wiring
`expo-av` in `phaseNotifications`/`useTabataTimer`'s haptic callsite. If a
placeholder is preferred over silence in the meantime, a tiny procedurally
generated tone (a few lines of code synthesizing a WAV, no external asset)
is an option — not added here since it wasn't what was asked for, but happy
to add it on request.

## What's verified, and how

This sandbox has no iOS/Android simulator, so everything was exercised via
`npm run web` (Expo's `react-native-web` target) driven by a headless
Chromium (Playwright), plus `tsc --noEmit`. That covers UI, navigation,
session CRUD/persistence (AsyncStorage has a web `localStorage` backend),
and the timer state machine's phase transitions (create → run → pause →
skip → run to `finished` → back to Home, verified round-by-round).

**Not verifiable in this environment — needs a real iOS and a real Android
device (via Expo Go or a dev build), separately:**

- **Haptics** (`expo-haptics`) — no-ops on web; there's no way to observe
  whether `notificationAsync` actually fires the right feedback pattern.
- **Keep-awake** (`expo-keep-awake`) — the web `deactivateKeepAwake` code
  path was exercised (and a crash there was caught and fixed — see below),
  but whether the screen actually stays on during a real run is untestable
  here.
- **Local notifications** (`expo-notifications`) — `scheduleNotificationAsync`
  and `getPermissionsAsync`/`requestPermissionsAsync` throw
  `UnavailabilityError` on web by design (caught and treated as "not
  granted" so it fails silently rather than crashing — see
  `ensureNotificationPermission`). This means the entire scheduling flow,
  the permission prompt, delivery while backgrounded/killed, and the
  iOS-64-pending-notification interaction with other apps are all
  **unverified**. This also needs `expo-notifications`' Android channel setup
  to be exercised on a real device.
- **True backgrounding behavior** — the timestamp-based catch-up logic (in
  `useTabataTimer.ts` → `advance`) is logically verified by code review and
  by simulating "skip" (which exercises the same code path as a phase
  boundary being crossed), but the actual "put the app in the background for
  N minutes, come back, does it show the right phase" scenario needs a real
  OS to suspend/resume the JS runtime.
- **`Alert.alert`-gated flows** (RESET confirm, delete confirm, close-while-
  running confirm) — `react-native-web`'s `Alert.alert` is a hard no-op stub
  (confirmed by reading `node_modules/react-native-web/src/exports/Alert`),
  so none of these dialogs render on web at all. The store mutations they
  gate (`remove`, `reset`) were verified directly by calling the underlying
  store functions / non-Alert-gated paths, but the actual on-device prompt
  and button wiring have not been visually confirmed.

Two real bugs were found and fixed via the web smoke test before this
wasn't possible for the above: a `deactivateKeepAwake` crash on unmount
when the wake lock had never been activated, and a SKIP bug where the next
phase inherited leftover time from the skipped phase (showed the wrong
remaining seconds).

## What I need from you to close this out

Run the app via Expo Go on a real iOS device and a real Android device
(separately — their local-notification and haptics stacks differ) and
check, on each:

1. Haptics fire on every phase change (work start, rest start, finish).
2. The screen doesn't sleep while a session is running, and normal sleep
   behavior resumes once it's not.
3. Background a running session for longer than one phase's duration, then
   reopen the app — the on-screen phase/timer should reflect where it should
   logically be, and you should have received local notifications for the
   phase changes that happened while backgrounded.
4. The permission prompt for notifications appears once, on first timer
   start, and the app still works (just silently, no notifications) if you
   deny it.
5. RESET / delete-session / close-while-running all show their confirm
   dialogs and honor Cancel/confirm correctly.

## Known gaps (explicitly out of scope, see spec §7)

- No landscape support.
- No save/network error states (storage is local-only and synchronous-ish
  via AsyncStorage, so failures are not expected in normal use).
- No light theme.
- No sound on phase change (see "Sound — why it's not here" above).
