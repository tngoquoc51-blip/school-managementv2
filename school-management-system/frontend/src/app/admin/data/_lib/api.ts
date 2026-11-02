import { adm } from './http';
import type { Batch, Dataset, ExportLog, Limits, Mode, Overview, RowIssue, SavedMapping } from './types';

const P = 'data-hub';

export interface RowPayload {
    n: number;
    d: Record<string, string | null>;
}

export const hub = {
    datasets: async () => {
        const r = await adm<Dataset[]>(`${P}/datasets`);
        return { datasets: r.data ?? [], limits: (r.meta?.limits as Limits) ?? { chunk: 500, total: 20000, undo_days: 14 } };
    },
    overview: () => adm<Overview>(`${P}/overview`).then((r) => r.data),

    validate: (dataset: string, mode: Mode, rows: RowPayload[]) =>
        adm<{ results: RowIssue[]; counts: { insert: number; update: number; error: number } }>(`${P}/import/validate`, {
            method: 'POST', body: { dataset, mode, rows },
        }).then((r) => r.data),
    start: (body: { dataset: string; mode: Mode; filename: string; total: number; options: Record<string, unknown> }) =>
        adm<{ batch_id: number }>(`${P}/import/start`, { method: 'POST', body }).then((r) => r.data.batch_id),
    chunk: (batch: number, rows: RowPayload[]) =>
        adm<{ inserted: number; updated: number; unchanged: number; failed: number; errors: { row: number; message: string }[] }>(
            `${P}/import/${batch}/chunk`, { method: 'POST', body: { rows } },
        ).then((r) => r.data),
    finish: (batch: number, cancelled = false) =>
        adm<Batch>(`${P}/import/${batch}/finish`, { method: 'POST', body: { cancelled } }).then((r) => r.data),

    batches: async (page: number) => {
        const r = await adm<Batch[]>(`${P}/import/batches`, { query: { page, per_page: 10 } });
        return { items: r.data ?? [], meta: r.meta as { current_page: number; last_page: number; total: number } };
    },
    batch: (id: number) => adm<Batch>(`${P}/import/batches/${id}`).then((r) => r.data),
    undo: (id: number) => adm<{ removed: number; restored: number; blocked: number }>(`${P}/import/batches/${id}/undo`, { method: 'POST' }).then((r) => r.data),

    exportRows: async (dataset: string, columns: string[], filters: { q?: string; active?: string }, page: number, perPage: number, mask: boolean) => {
        const r = await adm<Record<string, unknown>[]>(`${P}/export/rows`, {
            query: { dataset, columns: columns.join(','), q: filters.q, active: filters.active, page, per_page: perPage, mask: mask ? 1 : 0 },
        });
        return { rows: r.data ?? [], meta: r.meta as { total: number; last_page: number } };
    },
    exportLog: (body: { dataset: string; format: string; rows: number; columns: string[]; filters: Record<string, unknown>; masked: boolean }) =>
        adm(`${P}/export/log`, { method: 'POST', body }),
    exportLogs: async (page: number) => {
        const r = await adm<ExportLog[]>(`${P}/export/logs`, { query: { page, per_page: 10 } });
        return { items: r.data ?? [], meta: r.meta as { current_page: number; last_page: number; total: number } };
    },

    mappings: (dataset: string) => adm<SavedMapping[]>(`${P}/mappings`, { query: { dataset } }).then((r) => r.data ?? []),
    saveMapping: (dataset: string, name: string, mapping: Record<string, string>) =>
        adm(`${P}/mappings`, { method: 'POST', body: { dataset, name, mapping } }),
    deleteMapping: (id: number) => adm(`${P}/mappings/${id}`, { method: 'DELETE' }),
};