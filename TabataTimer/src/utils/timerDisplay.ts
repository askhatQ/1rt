import type { TabataSession, TimerPhase } from '../types';
import type { TabataTimerApi } from '../state/useTabataTimer';

export function phaseLabel(phase: TimerPhase): string {
  switch (phase) {
    case 'work':
      return 'Работа';
    case 'rest':
    case 'restBetweenCycles':
      return 'Отдых';
    case 'finished':
      return 'Финиш';
  }
}

export function isWorkPhase(phase: TimerPhase): boolean {
  return phase === 'work';
}

/**
 * Continuous round-progress-bar fraction: (completedRounds + currentRoundProgress) / totalRounds.
 * A round's own duration excludes the trailing rest for the last round of a cycle,
 * since no rest phase follows it (matches the total-duration formula in utils/session.ts).
 */
export function roundProgressFraction(session: TabataSession, engine: TabataTimerApi): number {
  const { rounds } = session;
  const isLastRoundOfCycle = engine.currentRound >= rounds;
  const roundTotalSec = session.workSec + (isLastRoundOfCycle ? 0 : session.restSec);
  const completedRounds = engine.currentRound - 1;

  let inRoundProgress = 0;
  if (engine.phase === 'work') {
    const elapsed = session.workSec - engine.remainingSec;
    inRoundProgress = roundTotalSec > 0 ? elapsed / roundTotalSec : 0;
  } else if (engine.phase === 'rest') {
    const elapsed = session.workSec + (session.restSec - engine.remainingSec);
    inRoundProgress = roundTotalSec > 0 ? elapsed / roundTotalSec : 0;
  } else {
    // restBetweenCycles or finished: the current round's work is fully done
    inRoundProgress = 1;
  }

  return Math.min(1, (completedRounds + inRoundProgress) / rounds);
}
