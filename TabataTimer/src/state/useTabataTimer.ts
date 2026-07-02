import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { TabataSession, TimerPhase } from '../types';

const TICK_MS = 200;
const KEEP_AWAKE_TAG = 'tabata-timer';

function durationFor(phase: TimerPhase, session: TabataSession): number {
  switch (phase) {
    case 'work':
      return session.workSec;
    case 'rest':
      return session.restSec;
    case 'restBetweenCycles':
      return session.restBetweenCyclesSec;
    case 'finished':
      return 0;
  }
}

interface Step {
  phase: TimerPhase;
  round: number;
  cycle: number;
}

function nextStep(current: Step, session: TabataSession): Step {
  const { phase, round, cycle } = current;

  if (phase === 'work') {
    if (round < session.rounds) {
      return { phase: 'rest', round, cycle };
    }
    if (cycle < session.cycles) {
      return { phase: 'restBetweenCycles', round, cycle };
    }
    return { phase: 'finished', round, cycle };
  }

  if (phase === 'rest') {
    return { phase: 'work', round: round + 1, cycle };
  }

  if (phase === 'restBetweenCycles') {
    return { phase: 'work', round: 1, cycle: cycle + 1 };
  }

  return { phase: 'finished', round, cycle };
}

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

  const advance = useCallback((baseTimestamp?: number) => {
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
          return cur;
        }
      }
      return cur;
    });
  }, [session]);

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
        // pause: freeze remaining time
        const endAt = phaseEndAtRef.current;
        pausedRemainingMsRef.current = endAt != null ? Math.max(0, endAt - Date.now()) : pausedRemainingMsRef.current;
        phaseEndAtRef.current = null;
        return false;
      }
      // resume: recompute end timestamp from frozen remaining time
      if (stepRef.current.phase !== 'finished') {
        phaseEndAtRef.current = Date.now() + pausedRemainingMsRef.current;
      }
      return true;
    });
  }, []);

  const skip = useCallback(() => {
    if (stepRef.current.phase === 'finished') return;
    advance(Date.now());
  }, [advance]);

  const reset = useCallback(() => {
    setIsRunning(false);
    beginPhase({ phase: 'work', round: 1, cycle: 1 }, false);
  }, [beginPhase]);

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
