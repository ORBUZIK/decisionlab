import type { Analysis, Dataset, ScenarioSummary } from './types';

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/' + url, {
      headers: { 'Content-Type': 'application/json' }, ...init,
    });
  } catch {
    throw new Error('Сервер недоступен. Проверьте, что backend запущен.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(error.error || 'Ошибка ' + response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const analyze = (payload: Dataset) => api<Analysis>('analyze/', {
  method: 'POST', body: JSON.stringify(payload),
});
export const listScenarios = () => api<ScenarioSummary[]>('scenarios/');
export const saveScenario = (name: string, payload: Dataset) =>
  api<{ id: string }>('scenarios/', {
    method: 'POST', body: JSON.stringify({ name, payload }),
  });
export const getScenario = (id: string) =>
  api<{ id: string; name: string; payload: Dataset; result: Analysis }>('scenarios/' + id + '/');
export const deleteScenario = (id: string) => api<void>('scenarios/' + id + '/', { method: 'DELETE' });
