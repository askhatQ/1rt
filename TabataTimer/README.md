# Tabata Timer

React Native (Expo + TypeScript) implementation of the Tabata Timer spec
(`НАСТРОЙКА СЕССИИ` / `TABATA` screens).

## Stack

- Expo SDK 57, TypeScript
- `@react-navigation/native-stack` — Home → Settings → Timer
- Zustand + `@react-native-async-storage/async-storage` (persisted sessions store)
- `react-native-svg` for the ring timer
- `expo-haptics`, `expo-keep-awake`, `@expo-google-fonts/inter`

`react-native-mmkv` was in the original spec as the preferred store, but v4
requires `react-native-nitro-modules` (new-architecture native build) that
can't be exercised outside a real device/simulator build. AsyncStorage is the
spec's explicitly allowed fallback and works in Expo Go too.

## Running

```
npm install
npm run web      # quickest to preview (react-native-web)
npm run ios       # requires macOS + Xcode
npm run android   # requires Android SDK
```

## Decisions on points the design left open

The source spec (`ТЗ`) flags several `[РЕШЕНИЕ РАЗРАБОТЧИКА]` points since a
static Figma mock can't encode behavior. Decisions made here:

- **Card long-press** → `Alert` action sheet with Редактировать / Удалить.
- **Session name limit**: 30 characters.
- **Empty name handling**: the "НАЧАТЬ" CTA on Settings is disabled while the
  trimmed name is empty (rather than silently falling back to a default).
- **Stepper bounds/step**: exactly the table in the spec (work 5–300/5,
  rest 0–300/5, rounds 1–30/1, cycles 1–10/1, rest-between-cycles 0–600/5).
- **Total duration formula**: `cycles*(rounds*(work+rest)-rest) + (cycles-1)*restBetweenCycles`,
  i.e. the last round of every cycle has no trailing rest (matches the
  work→rest→…→restBetweenCycles state machine, not the mockup's static "4:00").
- **Ring direction**: the arc drains as time elapses (starts full, shrinks to
  empty), not the reverse.
- **Exercise name field**: dropped. `TabataSession` has no `exercises` field
  (per §4 of the spec), so there's nothing to display; adding a fake/static
  exercise label would be decorative-only and was explicitly called out as
  optional in the spec.
- **Timer header title**: shows the session name instead of the static
  "TABATA" placeholder text.
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
  multiple phases if the app was backgrounded for a long time. Phase-change
  haptics only fire while the app is foregrounded; no local push
  notifications are scheduled for background phase changes. This is a
  deliberate scope cut (per spec §5.2) rather than an oversight.
- **Sound on phase change**: not implemented (haptics only) — no audio
  assets were provided and it wasn't central to the ask.
- **Orientation**: portrait-only (`app.json` → `orientation: "portrait"`).
- **Accessibility**: stepper +/− buttons and icon buttons carry
  `accessibilityLabel`s.

## Known gaps (explicitly out of scope, see spec §7)

- No landscape support.
- No save/network error states (storage is local-only and synchronous-ish
  via AsyncStorage, so failures are not expected in normal use).
- No light theme.
