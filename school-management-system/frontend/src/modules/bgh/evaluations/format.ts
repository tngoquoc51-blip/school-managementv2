import type { ActStatus, Kind, ObsStatus, Rating } from './types';

export const RATING: Record<Rating, { label: string; tone: string; color: string }> = {
    excellent: { label: 'Tốt', tone: 'ok', color: '#059669' },
    good: { label: 'Khá', tone: 'info', color: '#2563eb' },
    pass: { label: 'Đạt', tone: 'warn', color: '#d97706' },
    fail: { label: 'Chưa đạt', tone: 'crit', color: '#dc2650' },
};
export const KIND: Record<Kind, string> = { planned: 'Theo kế hoạch', surprise: 'Đột xuất', thematic: 'Chuyên đề', followup: 'Dự lại' };
export const OBS_STATUS: Record<ObsStatus, { label: string; tone: string }> = {
    draft: { label: 'Bản nháp', tone: 'muted' }, submitted: { label: 'Chờ GV xác nhận', tone: 'warn' },
    acknowledged: { label: 'GV đã xác nhận', tone: 'ok' }, disputed: { label: 'GV có phản hồi', tone: 'crit' }, closed: { label: 'Đã chốt', tone: 'info' },
};
export const PLAN_STATUS: Record<string, { label: string; tone: string }> = {
    scheduled: { label: 'Chờ thực hiện', tone: 'info' }, done: { label: 'Đã thực hiện', tone: 'ok' },
    cancelled: { label: 'Đã huỷ', tone: 'muted' }, overdue: { label: 'Quá hạn', tone: 'crit' },
};
export const ACT_STATUS: Record<ActStatus | 'overdue', { label: string; tone: string }> = {
    open: { label: 'Chưa làm', tone: 'info' }, in_progress: { label: 'Đang thực hiện', tone: 'warn' },
    done: { label: 'Hoàn thành', tone: 'ok' }, cancelled: { label: 'Đã huỷ', tone: 'muted' }, overdue: { label: 'Quá hạn', tone: 'crit' },
};
export const PRIORITY: Record<string, { label: string; tone: string }> = { low: { label: 'Thấp', tone: 'muted' }, normal: { label: 'Bình thường', tone: 'info' }, high: { label: 'Cao', tone: 'crit' } };
export const PERIODIC_STATUS: Record<string, { label: string; tone: string }> = {
    none: { label: 'Chưa lập', tone: 'muted' }, draft: { label: 'Đang soạn', tone: 'warn' }, submitted: { label: 'Chờ duyệt', tone: 'info' }, approved: { label: 'Đã duyệt', tone: 'ok' },
};

export const score = (v: string | number | null | undefined, d = 1) => (v === null || v === undefined || v === '' ? '—' : Number(v).toFixed(d).replace(/\.0+$/, ''));
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const weekdayOf = (s: string) => WEEKDAY[new Date(s + 'T00:00:00').getDay()];
export const monthLabel = (m: string) => { const [y, mo] = m.split('-'); return `T${Number(mo)}/${y.slice(2)}`; };
export const periodTime = (periods: { id: number; start_time: string; end_time: string }[], p: number | null) => {
    const x = periods.find((q) => q.id === p); return x ? `${x.start_time.slice(0, 5)}–${x.end_time.slice(0, 5)}` : '';
};

/** Điểm phiếu: Σ(w × điểm/max) / Σ w × 100 — giống hệt công thức ở máy chủ, để xem trước tức thì khi chấm. */
export function calcScore(criteria: { id: number; weight: string; max_score: number }[], scores: Record<number, number | null | undefined>, requireAll = false) {
    let num = 0, den = 0, all = 0;
    for (const c of criteria) {
        const w = Number(c.weight); all += w;
        const v = scores[c.id];
        if (v === null || v === undefined) continue;
        num += (w * Math.max(0, Math.min(c.max_score, v))) / Math.max(1, c.max_score); den += w;
    }
    const d = requireAll ? all : den;
    return d > 0 && den > 0 ? Math.round((num / d) * 10000) / 100 : null;
}
export function rate(v: number | null, st: { rating_excellent: string; rating_good: string; rating_pass: string }): Rating | null {
    if (v === null) return null;
    if (v >= Number(st.rating_excellent)) return 'excellent';
    if (v >= Number(st.rating_good)) return 'good';
    if (v >= Number(st.rating_pass)) return 'pass';
    return 'fail';
}