import { adm } from './http';
import type { Activity, Detail, Filters, Options, Plan, Stats, Summary } from './types';

const P = 'plans';
type Q = Record<string, string | number | boolean | null | undefined>;

export const pl = {
    options: () => adm<Options>(`${P}/options`).then((r) => r.data),
    stats: (school_year?: string) => adm<Stats>(`${P}/stats`, { query: { school_year } }).then((r) => r.data),
    list: async (f: Partial<Filters> & { all?: boolean; per_page?: number; root?: boolean; parent_id?: number }) => {
        const r = await adm<Plan[]>(P, { query: f as Q });
        return { rows: r.data ?? [], meta: r.meta as { current_page: number; last_page: number; total: number; summary: Summary } };
    },
    show: (id: number) => adm<Detail>(`${P}/${id}`).then((r) => r.data),
    create: (body: Partial<Plan>) => adm<{ id: number }>(P, { method: 'POST', body }).then((r) => r.data.id),
    update: (id: number, body: Partial<Plan>) => adm(`${P}/${id}`, { method: 'PUT', body }),
    remove: (id: number) => adm(`${P}/${id}`, { method: 'DELETE' }),
    transition: (id: number, to: string, note?: string, force?: boolean) => adm(`${P}/${id}/transition`, { method: 'POST', body: { to, note, force } }),
    duplicate: (id: number, start_date: string, title?: string) => adm<{ id: number }>(`${P}/${id}/duplicate`, { method: 'POST', body: { start_date, title } }).then((r) => r.data.id),
    fromTemplate: (body: { template: string; start_date: string; title?: string; owner_name?: string; school_year?: string }) =>
        adm<{ id: number }>(`${P}/from-template`, { method: 'POST', body }).then((r) => r.data.id),
    addTask: (id: number, body: Record<string, unknown>) => adm(`${P}/${id}/tasks`, { method: 'POST', body }),
    updateTask: (taskId: number, body: Record<string, unknown>) => adm<{ progress: number }>(`${P}/tasks/${taskId}`, { method: 'PUT', body }),
    deleteTask: (taskId: number) => adm(`${P}/tasks/${taskId}`, { method: 'DELETE' }),
    comment: (id: number, body: string) => adm(`${P}/${id}/comments`, { method: 'POST', body: { body } }),
    addLink: (id: number, body: { kind?: string; label: string; url?: string }) => adm(`${P}/${id}/links`, { method: 'POST', body }),
    deleteLink: (linkId: number) => adm(`${P}/links/${linkId}`, { method: 'DELETE' }),
};
export type { Activity };