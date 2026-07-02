import type { TabataSession, TimerPhase } from '../types';

export interface Step {
  phase: TimerPhase;
  round: number; // 1-indexed
  cycle: number; // 1-indexed
}

export function durationFor(phase: TimerPhase, session: TabataSession): number {
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

/**
 * Pure transition: work -> rest -> work -> ... (rounds times) -> restBetweenCycles
 * -> work (next cycle) -> ... -> finished. Shared by the ticking engine
 * (useTabataTimer) and the notification scheduler so both agree on the same
 * sequence of phase changes.
 */
export function nextStep(current: Step, session: TabataSession): Step {
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
