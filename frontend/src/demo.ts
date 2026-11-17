import type { Dataset } from './types';

export const DEMO: Dataset = {
  criteria: [
    { key: 'salary', label: 'Зарплата, тыс. ₽', direction: 'max', weight: 35 },
    { key: 'remote', label: 'Удалённость, баллы', direction: 'max', weight: 20 },
    { key: 'career', label: 'Карьерный рост, баллы', direction: 'max', weight: 30 },
    { key: 'workload', label: 'Нагрузка, ч/нед.', direction: 'min', weight: 15 },
  ],
  alternatives: [
    { name: 'NovaTech', values: { salary: 120, remote: 9, career: 8, workload: 40 } },
    { name: 'Quantum Labs', values: { salary: 145, remote: 5, career: 9, workload: 48 } },
    { name: 'CloudWorks', values: { salary: 110, remote: 10, career: 7, workload: 36 } },
    { name: 'DataSphere', values: { salary: 135, remote: 7, career: 8, workload: 45 } },
    { name: 'BrightCode', values: { salary: 100, remote: 8, career: 10, workload: 42 } },
  ],
  pairwise: null,
};

export function cloneDemo(): Dataset {
  return JSON.parse(JSON.stringify(DEMO)) as Dataset;
}
