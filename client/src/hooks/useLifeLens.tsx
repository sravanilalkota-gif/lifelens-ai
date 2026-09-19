/**
 * LifeLens global state.
 * One context, one place where the API is called, one place where errors are
 * turned into friendly copy. Pages stay dumb and fast to build.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AnalysisResult, AssistantResponse, Capture, HealthResponse, PlanResponse, Task } from '@lifelens/shared';
import { daysUntil, priorityRank } from '@lifelens/shared';
import { api, ApiError, type MemoryResponse } from '../lib/api';

interface LifeLensState {
  health: HealthResponse | null;
  user: { name: string; course: string };
  captures: Capture[];
  tasks: Task[];
  plan: PlanResponse | null;
  loading: boolean;
  serverOnline: boolean;
  error: string | null;
  aiMode: 'gemini' | 'demo';

  refresh: () => Promise<void>;
  analyze: (payload: { image?: string; demoKey?: string; text?: string; fileName?: string }) => Promise<{
    result: AnalysisResult;
    fallback?: string;
  }>;
  saveCapture: (payload: {
    result: AnalysisResult;
    imageData?: string | null;
    imageName?: string | null;
    edited?: boolean;
  }) => Promise<{ capture: Capture; task?: Task }>;
  deleteCapture: (id: string) => Promise<void>;
  toggleTask: (id: string, done?: boolean) => Promise<void>;
  patchTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completePlanItem: (id: string) => Promise<void>;
  ask: (question: string) => Promise<AssistantResponse>;
  searchMemory: (q: string) => Promise<MemoryResponse>;
  resetDemo: () => Promise<string>;
  clearAll: () => Promise<string>;
  dismissError: () => void;
}

const Ctx = createContext<LifeLensState | null>(null);

export function LifeLensProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const [h, c, t, p] = await Promise.all([api.health(), api.listCaptures(), api.listTasks(), api.plan()]);
      setHealth(h);
      setCaptures(c.captures);
      setTasks(t.tasks);
      setPlan(p);
      setServerOnline(true);
      setError(null);
    } catch (e) {
      setServerOnline(false);
      setError(
        e instanceof ApiError
          ? e.message
          : 'LifeLens can’t reach its server right now. Start the API with `npm run dev:server` and refresh.',
      );
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const analyze: LifeLensState['analyze'] = useCallback(async (payload) => {
    const res = await api.analyze(payload);
    if (!res.ok || !res.result) {
      throw new ApiError(res.error ?? 'LifeLens couldn’t understand that image. Try a clearer photo.');
    }
    return { result: res.result, fallback: res.fallback };
  }, []);

  const saveCapture: LifeLensState['saveCapture'] = useCallback(async (payload) => {
    const res = await api.saveCapture(payload);
    await refresh();
    return res;
  }, [refresh]);

  const deleteCapture = useCallback(
    async (id: string) => {
      await api.deleteCapture(id);
      await refresh();
    },
    [refresh],
  );

  const patchTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      await api.patchTask(id, patch);
      await refresh();
    },
    [refresh],
  );

  const toggleTask = useCallback(
    async (id: string, done?: boolean) => {
      const current = tasks.find((t) => t.id === id);
      await api.patchTask(id, { done: done ?? !(current?.done ?? false) });
      await refresh();
    },
    [refresh, tasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await api.deleteTask(id);
      await refresh();
    },
    [refresh],
  );

  const completePlanItem = useCallback(
    async (id: string) => {
      const res = await api.completePlanItem(id);
      setPlan(res.plan);
      await refresh();
    },
    [refresh],
  );

  const ask = useCallback(async (question: string) => {
    const res = await api.ask(question);
    return res;
  }, []);

  const searchMemory = useCallback(async (q: string) => api.memory(q), []);

  const resetDemo = useCallback(async () => {
    const res = await api.reset();
    await refresh();
    return res.message;
  }, [refresh]);

  const clearAll = useCallback(async () => {
    const res = await api.clear();
    await refresh();
    return res.message;
  }, [refresh]);

  const value = useMemo<LifeLensState>(
    () => ({
      health,
      user: health?.user ?? { name: 'Student', course: 'LifeLens Demo' },
      captures,
      tasks,
      plan,
      loading,
      serverOnline,
      error,
      aiMode: health?.aiMode ?? 'demo',
      refresh,
      analyze,
      saveCapture,
      deleteCapture,
      toggleTask,
      patchTask,
      deleteTask,
      completePlanItem,
      ask,
      searchMemory,
      resetDemo,
      clearAll,
      dismissError: () => setError(null),
    }),
    [
      health,
      captures,
      tasks,
      plan,
      loading,
      serverOnline,
      error,
      refresh,
      analyze,
      saveCapture,
      deleteCapture,
      toggleTask,
      patchTask,
      deleteTask,
      completePlanItem,
      ask,
      searchMemory,
      resetDemo,
      clearAll,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLifeLens(): LifeLensState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLifeLens must be used inside <LifeLensProvider>');
  return ctx;
}

/* ------------------------------- selectors ------------------------------- */

export function usePriorities() {
  const { tasks } = useLifeLens();
  return useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    return {
      open,
      high: open.filter((t) => t.priority === 'HIGH'),
      today: open.filter((t) => (daysUntil(t.dueDate ?? null) ?? 99) <= 0),
      upcoming: open
        .filter((t) => daysUntil(t.dueDate ?? null) !== null)
        .sort((a, b) => {
          const da = daysUntil(a.dueDate ?? null)!;
          const db = daysUntil(b.dueDate ?? null)!;
          return da !== db ? da - db : priorityRank(b.priority) - priorityRank(a.priority);
        }),
      done: tasks.filter((t) => t.done),
    };
  }, [tasks]);
}
