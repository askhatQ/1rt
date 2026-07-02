import type { StepperConfig } from '../types';

export const STEPPER_CONFIGS: StepperConfig[] = [
  {
    field: 'workSec',
    label: 'Работа',
    hint: 'секунды на подход',
    min: 5,
    max: 300,
    step: 5,
    default: 20,
  },
  {
    field: 'restSec',
    label: 'Отдых',
    hint: 'секунды между подходами',
    min: 0,
    max: 300,
    step: 5,
    default: 10,
  },
  {
    field: 'rounds',
    label: 'Подходы',
    hint: 'количество раундов в цикле',
    min: 1,
    max: 30,
    step: 1,
    default: 8,
  },
  {
    field: 'cycles',
    label: 'Циклы',
    hint: 'количество повторений всей серии',
    min: 1,
    max: 10,
    step: 1,
    default: 1,
  },
  {
    field: 'restBetweenCyclesSec',
    label: 'Отдых между циклами',
    hint: 'секунды перед новым циклом',
    min: 0,
    max: 600,
    step: 5,
    default: 60,
  },
];
