/**
 * LifeLens — Action Engine.
 * Turns a structured understanding of an image into concrete, checkable tasks.
 * This is the "Act" in  See → Understand → Extract → Prioritize → Act.
 */
import type { AnalysisResult, Subtask, Task } from '@lifelens/shared';
import { computePriority } from './priorityEngine.js';

let seq = 0;
export function uid(prefix = 'id'): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export interface BuildTaskInput {
  result: AnalysisResult;
  captureId?: string | null;
  userId: string;
  /** user-corrected priority from the confirmation card */
  userPriority?: Task['priority'] | null;
}

export function buildTaskFromResult(input: BuildTaskInput): Task {
  const { result, captureId = null, userId, userPriority = null } = input;

  // Re-run the engine with the user's own importance vote folded in.
  const recomputed = computePriority({
    date: result.date,
    time: result.time,
    category: result.category,
    aiPriority: result.priority,
    userPriority,
    text: `${result.title} ${result.description ?? ''} ${result.sourceText ?? ''}`,
  });

  const subtasks: Subtask[] = (result.tasks ?? [])
    .filter((t) => t && t.trim().length > 1)
    .map((t) => ({ id: uid('st'), title: t.trim().slice(0, 140), done: false }));

  // Always guarantee at least one actionable step.
  if (subtasks.length === 0 && result.action) {
    subtasks.push({ id: uid('st'), title: result.action, done: false });
  }

  return {
    id: uid('task'),
    userId,
    captureId,
    title: result.title,
    category: result.category,
    subject: result.subject,
    priority: userPriority ?? recomputed.priority,
    priorityReason: recomputed.reason,
    dueDate: result.date,
    dueTime: result.time,
    location: result.location,
    reminder: result.reminder,
    action: result.action,
    description: result.description,
    done: false,
    createdAt: new Date().toISOString(),
    subtasks,
  };
}

/** Suggest a realistic time-block for a task inside "Today's Plan". */
export function suggestTimeSlot(hourCursor: { h: number }, hasFixedTime: boolean, fixed?: string | null): string {
  if (hasFixedTime && fixed) return fixed;
  const h = hourCursor.h;
  hourCursor.h = h + 1 > 21 ? 21 : h + 1;
  const label = (n: number) => {
    const suffix = n >= 12 ? 'PM' : 'AM';
    const hh = n % 12 === 0 ? 12 : n % 12;
    return `${hh}:00 ${suffix}`;
  };
  return `${label(h)} – ${label(Math.min(22, h + 1))}`;
}
