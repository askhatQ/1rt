import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import type { TabataSession, TimerPhase } from '../types';
import { type Step, durationFor, nextStep } from './tabataStateMachine';

const ANDROID_CHANNEL_ID = 'tabata-phase-changes';

// iOS caps pending local notifications app-wide at 64. We stay well under
// that so a single long Tabata session doesn't starve any other scheduled
// notification the app might have.
const MAX_SCHEDULED_NOTIFICATIONS = 48;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let androidChannelReady = false;
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Смена фазы тренировки',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 200, 100, 200],
  });
  androidChannelReady = true;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    // Platform doesn't support local notifications at all (e.g. web) — treat
    // as "not granted" rather than throwing, callers just skip scheduling.
    return false;
  }
}

// Tracks the notification IDs scheduled by the *current* call so a later
// cancel/schedule can't accidentally clear IDs belonging to a newer call
// that raced ahead of it (e.g. rapid skip taps).
let scheduledIds: string[] = [];
let generation = 0;

export async function cancelScheduledPhaseNotifications(): Promise<void> {
  generation += 1;
  const ids = scheduledIds;
  scheduledIds = [];
  if (ids.length === 0) return;
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

function contentForPhase(phase: TimerPhase): { title: string; body: string } | null {
  switch (phase) {
    case 'work':
      return { title: 'Работа!', body: 'Начался рабочий подход' };
    case 'rest':
      return { title: 'Отдых', body: 'Можно перевести дух' };
    case 'restBetweenCycles':
      return { title: 'Отдых между циклами', body: 'Перерыв перед следующим циклом' };
    case 'finished':
      return { title: 'Тренировка завершена', body: 'Отличная работа! 🎉' };
  }
}

/**
 * Computes every upcoming phase change from `fromStep` (whose *current* phase
 * still has `remainingMsInCurrentPhase` left) through `finished`, and schedules
 * one local notification per change, up front, at their absolute timestamps.
 * Intentionally not driven by a background JS timer — the OS delivers these
 * even if our JS thread is suspended.
 *
 * Assumes at most one Tabata session is actively running at a time (matches
 * the app's single-Timer-screen navigation model): scheduling state is
 * module-level, not per-session.
 */
export async function scheduleUpcomingPhaseNotifications(
  fromStep: Step,
  remainingMsInCurrentPhase: number,
  session: TabataSession
): Promise<void> {
  const myGeneration = ++generation;
  const previousIds = scheduledIds;
  scheduledIds = [];

  if (previousIds.length > 0) {
    await Promise.all(
      previousIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
    );
  }

  const granted = await ensureNotificationPermission();
  if (!granted || myGeneration !== generation) return;
  await ensureAndroidChannel();
  if (myGeneration !== generation) return;

  const ids: string[] = [];
  let cur = fromStep;
  let offsetMs = Math.max(0, remainingMsInCurrentPhase);

  for (let i = 0; i < MAX_SCHEDULED_NOTIFICATIONS; i++) {
    const next = nextStep(cur, session);
    const content = contentForPhase(next.phase);
    const fireAt = Date.now() + offsetMs;

    if (content) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: content.title, body: content.body, sound: true },
          trigger: {
            type: SchedulableTriggerInputTypes.DATE,
            date: fireAt,
            channelId: ANDROID_CHANNEL_ID,
          },
        });
        ids.push(id);
      } catch {
        // Scheduling failed for this one notification (e.g. OS-level cap) — skip it,
        // keep going for the rest rather than aborting the whole schedule.
      }
    }

    if (myGeneration !== generation) {
      // A newer schedule/cancel call superseded us mid-loop; abandon ours so we
      // don't leave IDs untracked (and therefore uncancellable later).
      await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
      return;
    }

    if (next.phase === 'finished') break;
    offsetMs += durationFor(next.phase, session) * 1000;
    cur = next;
  }

  scheduledIds = ids;
}
