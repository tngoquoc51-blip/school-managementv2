import type { Status } from './api';

export const pad = (n: number) => String(n).padStart(2, '0');
export const parseDate = (s: string) => new Date(s.replace(' ', 'T'));
export const fmtDate = (s: string) => { const d = parseDate(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const fmtTime = (s: string) => { const d = parseDate(s); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtDateTime = (s: string) => `${fmtTime(s)} ngày ${fmtDate(s)}`;
export const fmtScore = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
export const fmtSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} MB` : `${kb} KB`);

export function dueLabel(s: string, now = Date.now()): { text: string; tone: 'late' | 'soon' | 'ok' } {
    const diff = parseDate(s).getTime() - now;
    const abs = Math.abs(diff);
    const m = Math.max(1, Math.round(abs / 60000)), h = Math.round(abs / 3600000), d = Math.round(abs / 86400000);
    const span = m < 60 ? `${m} phút` : h < 24 ? `${h} giờ` : `${d} ngày`;
    if (diff < 0) return { text: `Quá hạn ${span}`, tone: 'late' };
    return { text: `Còn ${span}`, tone: diff < 48 * 3600000 ? 'soon' : 'ok' };
}

export const STATUS_LABEL: Record<Status, string> = {
    todo: 'Cần làm', overdue: 'Quá hạn', submitted: 'Chờ chấm', graded: 'Đã chấm', returned: 'Làm lại',
};
export const TYPE_LABEL: Record<string, string> = { exercise: 'Bài tập', essay: 'Tự luận', quiz: 'Ôn tập', project: 'Dự án' };