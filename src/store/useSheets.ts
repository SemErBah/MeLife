import { create } from 'zustand';
import type { Task, TrackerMode } from '../types';

/* Uygulamanın her yerinden açılabilen alt sayfalar (bottom sheet) */

export type TaskDraft = Partial<Omit<Task, 'id'>>;

interface SheetState {
  tracker: { id: string; date: string } | null;          // bir rutinin o günkü kaydı
  routine: { id: string | null; mode?: TrackerMode } | null; // rutin düzenle (null = yeni)
  urge: string | null;                                     // "İstek geldi" ekranı (trackerId)
  task: { id: string | null; draft?: TaskDraft } | null;  // görev düzenle (null = yeni)
  review: { kind: 'day'; date: string } | { kind: 'week'; weekOf: string } | null;
  start: string | null;                                  // Başlayamıyorum (taskId)
  quick: boolean;
  openTracker: (id: string, date: string) => void;
  openRoutine: (id: string | null, mode?: TrackerMode) => void;
  openUrge: (trackerId: string | null) => void;
  openTask: (id: string | null, draft?: TaskDraft) => void;
  openReview: (r: SheetState['review']) => void;
  openStart: (taskId: string | null) => void;
  setQuick: (open: boolean) => void;
  close: () => void;
}

export const useSheets = create<SheetState>((set) => ({
  tracker: null,
  routine: null,
  urge: null,
  task: null,
  review: null,
  start: null,
  quick: false,
  openTracker: (id, date) => set({ tracker: { id, date }, routine: null, task: null, quick: false }),
  openRoutine: (id, mode) => set({ routine: { id, mode }, tracker: null, task: null, quick: false }),
  openUrge: (urge) => set({ urge, tracker: null, quick: false }),
  openTask: (id, draft) => set({ task: { id, draft }, tracker: null, routine: null, quick: false }),
  openReview: (review) => set({ review, tracker: null, routine: null, task: null, quick: false }),
  openStart: (start) => set({ start, task: null, tracker: null, quick: false }),
  setQuick: (quick) => set({ quick }),
  close: () => set({ tracker: null, routine: null, task: null, review: null, quick: false }),
}));
