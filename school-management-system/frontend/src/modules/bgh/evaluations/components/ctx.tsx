'use client';

import { createContext, useContext } from 'react';
import type { Lookups, Me, Settings } from '../types';

export interface EvCtx {
    me: Me; settings: Settings; lk: Lookups;
    year: number; semester: number; tick: number;
    reload: () => void;
    openObs: (id: number) => void;
    openTeacher: (id: number) => void;
    newPlan: (prefill?: Partial<{ teacher_id: number; plan_date: string; kind: string }>) => void;
    newAction: (prefill?: { teacher_id?: number; observation_id?: number | null; title?: string; priority?: string }) => void;
    newObs: (prefill?: { teacher_id?: number }) => void;
    goTab: (t: string) => void;
}
export const Ctx = createContext<EvCtx>(null as unknown as EvCtx);
export const useEv = () => useContext(Ctx);