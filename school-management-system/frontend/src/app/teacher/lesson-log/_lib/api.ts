import { adm } from './http';
import type { Detail, ListFilters, Log, Meta, Stats, Student, WeekData } from './types';

const P = 'lesson-log';
type Q = Record<string, string | number | boolean | null | undefined>;
type Body = Record<string, unknown>;

export const ll = {
    meta: () => adm<Meta>(`${P}/meta`).then((r) => r.data),
    students: (class_id: number) => adm<Student[]>(`${P}/students`, { query: { class_id } }).then((r) => r.data),
    week: (class_id: number, date: string) => adm<WeekData>(`${P}/week`, { query: { class_id, date } }).then((r) => r.data),
    stats: (q: Q) => adm<Stats>(`${P}/stats`, { query: q }).then((r) => r.data),
    list: async (f: Partial<ListFilters> & { mine?: boolean; all?: boolean; per_page?: number }) => {
        const r = await adm<Log[]>(P, { query: f as Q });
        return { rows: r.data ?? [], meta: r.meta as { current_page: number; last_page: number; total: number } };
    },
    show: (id: number) => adm<Detail>(`${P}/${id}`).then((r) => r.data),
    create: (b: Body) => adm<{ id: number }>(P, { method: 'POST', body: b }).then((r) => r.data.id),
    update: (id: number, b: Body) => adm(`${P}/${id}`, { method: 'PUT', body: b }),
    remove: (id: number) => adm(`${P}/${id}`, { method: 'DELETE' }),
    sign: (id: number) => adm(`${P}/${id}/sign`, { method: 'POST' }),
    unsign: (id: number) => adm(`${P}/${id}/unsign`, { method: 'POST' }),
    reopen: (id: number, reason: string) => adm(`${P}/${id}/reopen`, { method: 'POST', body: { reason } }),
    comment: (id: number, body: string) => adm(`${P}/${id}/comment`, { method: 'POST', body: { body } }),
    homeroomNote: (id: number, note: string) => adm(`${P}/${id}/homeroom-note`, { method: 'PUT', body: { note } }),
    confirmWeek: (class_id: number, date: string, note?: string, force?: boolean) => adm<{ confirmed: number; drafts: number }>(`${P}/week/confirm`, { method: 'POST', body: { class_id, date, note, force } }).then((r) => r.data),
    reopenWeek: (class_id: number, date: string) => adm(`${P}/week/reopen`, { method: 'POST', body: { class_id, date } }),
};