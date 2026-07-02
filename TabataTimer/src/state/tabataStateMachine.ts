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

/**
 * Total number of phase-change events (every nextStep() call, including the
 * final "finished" one) from the very start of a session to its end. Closed
 * form: each cycle contributes (rounds - 1) rest events + (rounds - 1) work
 * events to get through rounds 1..rounds-1, plus one event for the phase
 * after the last round (restBetweenCycles, or finished on the last cycle) =
 * 2*rounds - 1 events per cycle, plus one work-start event to kick off each
 * subsequent cycle after its restBetweenCycles = (cycles - 1) more events.
 * Verified against brute-force simulation via nextStep() for both example
 * and boundary configs (see scratch simulation used during code review).
 */
export function totalPhaseChangeEvents(session: Pick<TabataSession, 'rounds' | 'cycles'>): number {
  return session.cycles * (session.rounds * 2 - 1) + (session.cycles - 1);
}
