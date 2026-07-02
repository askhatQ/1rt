import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { TabataSession, TimerPhase } from '../types';
import { type Step, durationFor, nextStep } from './tabataStateMachine';
import { cancelScheduledPhaseNotifications, scheduleUpcomingPhaseNotifications } from './phaseNotifications';

const TICK_MS = 200;
const KEEP_AWAKE_TAG = 'tabata-timer';

function hapticForPhase(phase: TimerPhase) {
  if (phase === 'work') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else if (phase === 'rest' || phase === 'restBetweenCycles') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } else if (phase === 'finished') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

export interface TabataTimerApi {
  phase: TimerPhase;
  currentRound: number;
  currentCycle: number;
  remainingSec: number;
  isRunning: boolean;
  phaseDurationSec: number;
  nextPhase: TimerPhase;
  nextPhaseDurationSec: number;
  toggleRunning: () => void;
  skip: () => void;
  reset: () => void;
}

export function useTabataTimer(session: TabataSession): TabataTimerApi {
  const [step, setStep] = useState<Step>({ phase: 'work', round: 1, cycle: 1 });
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSec, setRemainingSec] = useState(session.workSec);

  const phaseEndAtRef = useRef<number | null>(null);
  const pausedRemainingMsRef = useRef<number>(session.workSec * 1000);
  const stepRef = useRef(step);
  stepRef.current = step;
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const beginPhase = useCallback(
    (next: Step, running: boolean) => {
      const durMs = durationFor(next.phase, session) * 1000;
      setStep(next);
      setRemainingSec(durMs / 1000);
      if (running && next.phase !== 'finished') {
        phaseEndAtRef.current = Date.now() + durMs;
      } else {
        phaseEndAtRef.current = null;
        pausedRemainingMsRef.current = durMs;
      }
      hapticForPhase(next.phase);
    },
    [session]
  );

  const advance = useCallback(
    (baseTimestamp?: number) => {
      let result: Step | null = null;
      setStep((prevStep) => {
        let cur = prevStep;
        // Natural expiry (tick/foreground) chains from the scheduled end-time so
        // multiple phases elapsed while backgrounded are caught up without drift.
        // A manual skip passes Date.now() so the cut-short phase doesn't donate
        // its unused time to the next phase.
        let endAt = baseTimestamp ?? phaseEndAtRef.current ?? Date.now();
        // Catch up through any phases fully elapsed (e.g. while backgrounded).
        // Cap iterations as a safety net against pathological configs.
        for (let i = 0; i < 10000; i++) {
          const next = nextStep(cur, session);
          const durMs = durationFor(next.phase, session) * 1000;
          cur = next;
          hapticForPhase(next.phase);
          if (next.phase === 'finished') {
            phaseEndAtRef.current = null;
            setIsRunning(false);
            setRemainingSec(0);
            result = cur;
            return cur;
          }
          endAt = endAt + durMs;
          if (endAt > Date.now()) {
            if (isRunningRef.current) {
              phaseEndAtRef.current = endAt;
            } else {
              phaseEndAtRef.current = null;
              pausedRemainingMsRef.current = endAt - Date.now();
            }
            setRemainingSec((endAt - Date.now()) / 1000);
            result = cur;
            return cur;
          }
        }
        result = cur;
        return cur;
      });
      return result!;
    },
    [session]
  );

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const endAt = phaseEndAtRef.current;
      if (endAt == null) return;
      const remainingMs = endAt - Date.now();
      if (remainingMs <= 0) {
        advance();
      } else {
        setRemainingSec(remainingMs / 1000);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isRunning, advance]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isRunning && phaseEndAtRef.current != null) {
        const remainingMs = phaseEndAtRef.current - Date.now();
        if (remainingMs <= 0) advance();
        else setRemainingSec(remainingMs / 1000);
      }
    });
    return () => sub.remove();
  }, [isRunning, advance]);

  useEffect(() => {
    if (!isRunning) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // no-op: wake lock was never activated (e.g. web without a prior activation)
      }
    };
  }, [isRunning]);

  const toggleRunning = useCallback(() => {
    setIsRunning((running) => {
      if (running) {
        // pause: freeze remaining time, and stop any notifications scheduled
        // for while we're away — they'd fire against a paused clock.
        const endAt = phaseEndAtRef.current;
        pausedRemainingMsRef.current = endAt != null ? Math.max(0, endAt - Date.now()) : pausedRemainingMsRef.current;
        phaseEndAtRef.current = null;
        cancelScheduledPhaseNotifications();
        return false;
      }
      // resume: recompute end timestamp from frozen remaining time, and
      // (re)schedule the full upcoming notification queue from here.
      if (stepRef.current.phase !== 'finished') {
        phaseEndAtRef.current = Date.now() + pausedRemainingMsRef.current;
        scheduleUpcomingPhaseNotifications(stepRef.current, pausedRemainingMsRef.current, session);
      }
      return true;
    });
  }, [session]);

  const skip = useCallback(() => {
    if (stepRef.current.phase === 'finished') return;
    const result = advance(Date.now());
    if (!isRunningRef.current) return;
    if (result.phase === 'finished') {
      cancelScheduledPhaseNotifications();
    } else {
      const remainingMs = phaseEndAtRef.current != null ? phaseEndAtRef.current - Date.now() : 0;
      scheduleUpcomingPhaseNotifications(result, remainingMs, session);
    }
  }, [advance, session]);

  const reset = useCallback(() => {
    setIsRunning(false);
    beginPhase({ phase: 'work', round: 1, cycle: 1 }, false);
    cancelScheduledPhaseNotifications();
  }, [beginPhase]);

  useEffect(() => {
    return () => {
      cancelScheduledPhaseNotifications();
    };
  }, []);

  const nextPhase = nextStep(step, session).phase;

  return {
    phase: step.phase,
    currentRound: step.round,
    currentCycle: step.cycle,
    remainingSec,
    isRunning,
    phaseDurationSec: durationFor(step.phase, session),
    nextPhase,
    nextPhaseDurationSec: durationFor(nextPhase, session),
    toggleRunning,
    skip,
    reset,
  };
}
