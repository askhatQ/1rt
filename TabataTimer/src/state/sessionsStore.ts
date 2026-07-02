import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, accentColors } from '../theme/tokens';
import { generateId } from '../utils/id';
import type { TabataSession } from '../types';

export interface SessionDraft {
  name: string;
  workSec: number;
  restSec: number;
  rounds: number;
  cycles: number;
  restBetweenCyclesSec: number;
}

export const DEFAULT_DRAFT: SessionDraft = {
  name: '',
  workSec: 20,
  restSec: 10,
  rounds: 8,
  cycles: 1,
  restBetweenCyclesSec: 60,
};

interface SessionsStoreState {
  sessions: TabataSession[];
  selectedId: string | null;
  select: (id: string | null) => void;
  upsert: (id: string | undefined, draft: SessionDraft) => TabataSession;
  remove: (id: string) => void;
  getById: (id: string) => TabataSession | undefined;
}

function pickAccentColor(existing: TabataSession[]): string {
  return accentColors[existing.length % accentColors.length] ?? colors.orange;
}

export const useSessionsStore = create<SessionsStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      selectedId: null,
      select: (id) =>
        set((state) => ({ selectedId: state.selectedId === id ? state.selectedId : id })),
      upsert: (id, draft) => {
        const now = Date.now();
        const existing = id ? get().sessions.find((s) => s.id === id) : undefined;
        const session: TabataSession = existing
          ? { ...existing, ...draft, updatedAt: now }
          : {
              id: generateId(),
              ...draft,
              accentColor: pickAccentColor(get().sessions),
              createdAt: now,
              updatedAt: now,
            };
        set((state) => ({
          sessions: existing
            ? state.sessions.map((s) => (s.id === session.id ? session : s))
            : [...state.sessions, session],
          selectedId: session.id,
        }));
        return session;
      },
      remove: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
        })),
      getById: (id) => get().sessions.find((s) => s.id === id),
    }),
    {
      name: 'tabata-sessions-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ sessions: state.sessions, selectedId: state.selectedId }),
    }
  )
);
