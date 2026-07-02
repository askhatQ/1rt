import type { TabataSession } from '../types';

export function totalDurationSec(session: {
  workSec: number;
  restSec: number;
  rounds: number;
  cycles: number;
  restBetweenCyclesSec: number;
}): number {
  const { workSec, restSec, rounds, cycles, restBetweenCyclesSec } = session;
  const perCycle = rounds * (workSec + restSec) - restSec;
  return cycles * perCycle + (cycles - 1) * restBetweenCyclesSec;
}

export function formatDuration(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return `${min} мин ${sec} сек`;
}

export function summaryLine(session: TabataSession): string {
  return `${session.workSec}с работа · ${session.restSec}с отдых · ${session.rounds} подходов`;
}
