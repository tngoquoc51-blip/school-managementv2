import type { ClassStatus } from '../../types/classes';

export const STATUS_LABEL: Record<ClassStatus, string> = { active: 'Đang hoạt động', paused: 'Tạm ngưng', closed: 'Đã đóng' };
const STATUS_CLS: Record<ClassStatus, string> = { active: 'ok', paused: 'warn', closed: 'mut' };

export function StatusBadge({ status }: { status: ClassStatus }) {
  return <span className={`a-badge ${STATUS_CLS[status]}`}><i className="dot" />{STATUS_LABEL[status]}</span>;
}

export function fillColor(p: number) {
  return p >= 100 ? 'var(--danger)' : p >= 85 ? 'var(--warn)' : 'var(--accent)';
}

export function FillBar({ percent }: { percent: number }) {
  return <div className="a-bar"><i style={{ width: `${percent}%`, background: fillColor(percent) }} /></div>;
}

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—');
export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('vi-VN') : '—');
