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
  upcoming phase change from "now" through `finished` is computed and
  scheduled as absolute-timestamp local notifications (`type: DATE`) — not a
  background JS timer, so delivery doesn't depend on the JS thread being
  alive. SKIP/RESET/PAUSE cancel the outstanding schedule; SKIP and RESUME
  recompute and reschedule from the new state.

  **This has a real, user-facing gap, not just a documented scope cut: each
  scheduling batch is capped at `MAX_SCHEDULED_NOTIFICATIONS = 48`
  (`src/state/phaseNotifications.ts`).** A session's total phase-change count
  is `cycles × (rounds × 2 − 1) + (cycles − 1)`
  (`totalPhaseChangeEvents` in `tabataStateMachine.ts`) — with the spec's own
  stepper bounds (rounds up to 30, cycles up to 10) that reaches **599**, and
  even modest configs like 20 rounds × 3 cycles reach **119**, both well past
  48. Without any mitigation, a long session run start-to-finish without ever
  pausing would go silent after the 48th phase change and stay silent for
  the rest of the session — that's a real bug, confirmed by brute-force
  simulating the actual `nextStep` transition function (copied verbatim)
  against the closed-form formula for several rounds/cycles pairs, including
  the 30×10 boundary; all matched exactly.

  Mitigation implemented: `useTabataTimer`'s `maybeTopUpNotifications`
  counts phase transitions that elapse while the timer is *running*, and
  once ~32 have gone by since the last (re)schedule, it schedules a fresh
  batch of up to 48 more from the current position — see the `advance()` /
  `maybeTopUpNotifications` wiring in `useTabataTimer.ts`. **This only helps
  one specific scenario, and conflating it with a general "the gap closes
  itself" claim would be wrong. Two scenarios, and they behave very
  differently:**

  - **(a) App stays in the foreground the whole session** (user is looking
    at the timer screen, phone isn't locked/backgrounded). The `setInterval`
    tick keeps firing, `maybeTopUpNotifications` keeps running, the gap
    genuinely closes. `expo-keep-awake`'s own README describes it as
    preventing "the screen sleeping when rendered" — nothing more; it's a
    wake lock against idle *screen* sleep, not a background-execution grant,
    so it correctly has no bearing on this scenario either way.
  - **(b) User manually backgrounds the app mid-session** (presses home,
    switches apps) and leaves it backgrounded for longer than it takes to
    exhaust the current notification batch. `expo-keep-awake` does **not**
    prevent this — it only stops idle screen-sleep while the app is
    foregrounded; it has no effect once the user deliberately leaves the
    app, and does not extend background execution time. Once backgrounded,
    React Native's JS runtime is expected to be suspended by the OS (both
    iOS and Android, without a declared background execution mode, which
    this app doesn't have) — so `setInterval` stops firing and
    `maybeTopUpNotifications` cannot run. **I have not observed this
    directly — there's no real device in this sandbox to background an app
    on.** This is inferred from `expo-keep-awake`'s documented scope and the
    general, well-established iOS/Android background-execution model, not
    from watching it happen. Treat it as a reasoned expectation, not a
    tested fact, until checked on a real device.

  So the accurate claim is: **the gap closes in scenario (a); scenario (b)
  is expected, by design and by how backgrounding works on both platforms,
  to NOT close it once a batch runs out — and that expectation itself is
  unverified.** This needs a real-device test that specifically backgrounds
  the app (not just locks the screen, and not just a brief `AppState`
  blip) for longer than a topped-up batch's runway.

  `SettingsScreen` shows an explicit warning banner (with a ⚠ marker) when
  the configured `rounds`/`cycles` produce more phase-change events than
  `MAX_SCHEDULED_NOTIFICATIONS`, explaining the (a)/(b) split above in plain
  language. **This is deliberately informational, not blocking — the
  "НАЧАТЬ" button stays enabled regardless.** Reasoning, engaging directly
  with the obvious objection ("the user can just ignore the banner and walk
  into the gap blind"):

  - The gap only degrades a secondary convenience feature (background
    phase-change alerts). The timer itself — on-screen countdown, ring,
    round progress, haptics while foregrounded, and correct phase tracking
    including catch-up when reopened — works fully regardless of the
    notification cap. Ignoring the warning does not break the workout; it
    only risks missing some alerts if the phone is put away for a very long
    stretch.
  - The spec's own stepper bounds explicitly permit configs that exceed the
    cap (30 rounds × 10 cycles is a legitimate, spec-sanctioned session).
    Blocking session creation over a secondary feature's platform ceiling
    would stop users from building sessions the spec says are valid, which
    is a worse trade-off than an occasionally-missed background alert.
  - This is a judgment call, not a settled fact: the banner can genuinely be
    scrolled past, and "informational text is enough" is exactly the kind
    of decision that benefits from a second opinion. If real-device testing
    shows people miss it in practice, the next reasonable step up (without
    going all the way to blocking) would be a one-time confirm dialog on
    "НАЧАТЬ" specifically when the cap is exceeded — not implemented here
    since it wasn't clear that added friction is actually warranted yet.
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
  the permission prompt, and delivery while backgrounded/killed are all
  **unverified**. This also needs `expo-notifications`' Android channel setup
  to be exercised on a real device.
- **The "64 pending notifications" iOS figure is *not* independently
  confirmed.** I checked the current, live Apple documentation for
  `UNUserNotificationCenter`, `add(_:withCompletionHandler:)`,
  `UNNotificationRequest`, and `getPendingNotificationRequests` (fetched
  their JSON content directly, since the rendered HTML pages are JS shells)
  and found no explicit numeric limit stated on any of them. The "64" figure
  is widely repeated in community sources and is historically associated
  with the older, pre-`UserNotifications`-framework `UILocalNotification`
  API, but I could not verify it applies identically, or at all, to the
  modern API on current iOS versions. `MAX_SCHEDULED_NOTIFICATIONS = 48` in
  `phaseNotifications.ts` is therefore "comfortably under a plausible but
  unconfirmed number," not a verified-safe margin — **this needs checking
  against a real device or current first-party Apple documentation**, not
  taken on faith from this README.
- **The 48-notification-cap / top-up gap (previous section) is unverified
  end-to-end, and its two scenarios have different confidence levels.**
  Scenario (a) — app stays foregrounded — the top-up logic was verified
  structurally (code review + the event-count formula matching brute-force
  simulation of the real transition code) but not by actually watching
  notifications arrive during a long real session. Scenario (b) — app
  manually backgrounded mid-session — is not just unverified but is a
  reasoned *expectation* based on `expo-keep-awake`'s documented scope and
  general iOS/Android background-execution behavior, not something derived
  from this app's own tested behavior at all. Don't treat "the gap closes"
  as true for both; see the (a)/(b) split above.
- **Hook dependency correctness has no tooling backing it at all.** This
  project has no ESLint configured — no `.eslintrc*`, no `eslint.config.*`,
  no `eslint` package in `package.json` (checked directly). So statements
  like "the `useCallback` dependencies look right" reflect a manual read,
  never a lint pass, in this project's history. Specifically checked in
  this round: `maybeTopUpNotifications` in `useTabataTimer.ts` lists only
  `[session]` as a dependency but also calls
  `scheduleUpcomingPhaseNotifications`. That function is a top-level
  `export async function` in `phaseNotifications.ts` — not defined inside a
  component or hook, so its identity is stable across renders and isn't a
  reactive value that needs to be in the deps array; everything else the
  callback touches (`isRunningRef`, `transitionsSinceScheduleRef`,
  `phaseEndAtRef`) is a ref, exempt by design since `.current` is always
  read live. No stale-closure bug found there on this pass — but "no
  ESLint" means nothing elsewhere in the codebase has been mechanically
  checked for this class of bug either.
- **True backgrounding behavior** — the timestamp-based catch-up logic (in
  `useTabataTimer.ts` → `advance`) is logically verified by code review and
  by simulating "skip" (which exercises the same code path as a phase
  boundary being crossed), but the actual "put the app in the background for
  N minutes, come back, does it show the right phase" scenario needs a real
  OS to suspend/resume the JS runtime.
- **`Alert.alert`-gated flows are unverified, not "found in code and
  therefore working."** RESET confirm, delete-session confirm, and
  close-while-running confirm all gate their action behind
  `Alert.alert(...)`. `react-native-web`'s `Alert.alert` is a hard no-op stub
  (confirmed by reading `node_modules/react-native-web/src/exports/Alert`
  directly — it's a one-line `class Alert { static alert() {} }`), so **none
  of these dialogs have ever actually rendered or been clicked through in
  this project, in any session.** What was checked is narrower than that:
  the underlying store mutations (`remove`, `reset`) work when called
  directly, and the code that wires the `Alert.alert(...)` call to the
  right button/callback was read and looks correct — but "the dialog appears
  and its buttons do what they say" has not been observed once. Treat this
  as fully open, not "implemented, just not screenshotted."

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
5. **Long-session notification coverage — test scenario (a) and (b)
   separately, they are not interchangeable:**
   - **(a) Foreground the whole time:** create a session with rounds/cycles
     that trip the new Settings warning (e.g. 20 rounds × 3 cycles), run it
     with the app open and on-screen for the whole session, and confirm
     notifications keep arriving past the 48th phase change (i.e. the
     top-up actually fires instead of going silent).
   - **(b) Manually backgrounded mid-session:** start the same kind of
     long session, then press home / switch to another app and leave it
     backgrounded (not just screen-locked) for longer than a batch's
     runway. Check whether notifications stop arriving at that point — this
     is the scenario I could not test at all and only reasoned about from
     `expo-keep-awake`'s documented scope, so this result is the one most
     likely to surprise.
   - Separately, confirm the warning banner itself shows/hides correctly as
     you adjust the steppers, and that "НАЧАТЬ" stays pressable even when
     it's showing (it's intentionally non-blocking — see the rationale in
     the Decisions section above; flag it if that judgment call feels
     wrong in practice).
6. **RESET / delete-session / close-while-running confirm dialogs — this is
   genuinely untested, not just "not screenshotted."** Confirm each dialog
   actually appears, and that both its Cancel and its confirm button do the
   right thing (Cancel leaves state untouched; confirm resets/deletes/exits).

## Known gaps (explicitly out of scope, see spec §7)

- No landscape support.
- No save/network error states (storage is local-only and synchronous-ish
  via AsyncStorage, so failures are not expected in normal use).
- No light theme.
- No sound on phase change (see "Sound — why it's not here" above).
