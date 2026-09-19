/**
 * Typed API client. Every call funnels through `request()` so a network failure
 * becomes a friendly `ApiError` instead of an unhandled rejection in the UI.
 */
import type {
  AnalyzeRequest,
  AnalyzeResponse,
  AssistantResponse,
  Capture,
  HealthResponse,
  PlanResponse,
  Task,
} from '@lifelens/shared';

export class ApiError extends Error {
  constructor(message: string, public readonly status = 0) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('LifeLens can’t reach its server. Check that the API is running, then try again.');
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    throw new ApiError(body?.error ?? `LifeLens hit a problem (${res.status}). Please try again.`, res.status);
  }
  return body as T;
}

export interface MemoryResponse {
  ok: boolean;
  query: string;
  answer: string;
  captures: Capture[];
  tasks: Task[];
  grouped: Array<{ subject: string; count: number; titles: string[] }>;
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  analyze: (payload: AnalyzeRequest) =>
    request<AnalyzeResponse>('/analyze', { method: 'POST', body: JSON.stringify(payload) }),

  listCaptures: (q?: string) =>
    request<{ ok: boolean; captures: Capture[] }>(`/captures${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  saveCapture: (payload: {
    result: unknown;
    imageData?: string | null;
    imageName?: string | null;
    edited?: boolean;
    createTask?: boolean;
  }) => request<{ ok: boolean; capture: Capture; task?: Task }>('/captures', { method: 'POST', body: JSON.stringify(payload) }),

  deleteCapture: (id: string) => request<{ ok: boolean }>(`/captures/${id}`, { method: 'DELETE' }),

  listTasks: (opts?: { status?: 'all' | 'open' | 'done'; q?: string }) => {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.q) params.set('q', opts.q);
    const qs = params.toString();
    return request<{ ok: boolean; tasks: Task[] }>(`/tasks${qs ? `?${qs}` : ''}`);
  },

  createTask: (payload: Partial<Task>) =>
    request<{ ok: boolean; task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),

  patchTask: (id: string, patch: Partial<Task> & { subtasks?: Task['subtasks'] }) =>
    request<{ ok: boolean; task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteTask: (id: string) => request<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  plan: () => request<{ ok: boolean } & PlanResponse>('/plan'),

  completePlanItem: (id: string) =>
    request<{ ok: boolean; plan: PlanResponse }>(`/plan/${id}/complete`, { method: 'POST' }),

  ask: (question: string) =>
    request<{ ok: boolean } & AssistantResponse>('/assistant', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  memory: (q: string) => request<MemoryResponse>(`/memory?q=${encodeURIComponent(q)}`),

  reset: () => request<{ ok: boolean; message: string }>('/admin/reset', { method: 'POST' }),
  clear: () => request<{ ok: boolean; message: string }>('/admin/clear', { method: 'POST' }),
};
