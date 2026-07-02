export interface TabataSession {
  id: string;
  name: string;
  workSec: number;
  restSec: number;
  rounds: number; // подходов в цикле
  cycles: number;
  restBetweenCyclesSec: number;
  accentColor: string;
  createdAt: number;
  updatedAt: number;
}

export type TimerPhase = 'work' | 'rest' | 'restBetweenCycles' | 'finished';

export interface TimerState {
  phase: TimerPhase;
  currentRound: number; // 1-indexed
  currentCycle: number; // 1-indexed
  remainingSec: number;
  isRunning: boolean;
}

export type StepperField =
  | 'workSec'
  | 'restSec'
  | 'rounds'
  | 'cycles'
  | 'restBetweenCyclesSec';

export interface StepperConfig {
  field: StepperField;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}
