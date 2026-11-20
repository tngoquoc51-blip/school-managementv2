'use client';
import type { LoadStatus } from '../types';

export const initialsOf = (name: string) => name.split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();

export function Avatar({ name, gender, lg }: { name: string; gender?: string | null; lg?: boolean }) {
    return <span className={`tc-ava ${gender === 'Nữ' ? 'f' : ''} ${lg ? 'lg' : ''}`}>{initialsOf(name)}</span>;
}

export function LoadBar({ periods, quota, status }: { periods: number; quota: number; status: LoadStatus }) {
    const pct = Math.min(100, quota ? Math.round((periods * 100) / (quota * 1.25)) : 0);
    return (
        <div className="tc-load">
            <div className="tc-load-t"><b>{periods}/{quota} tiết</b><span>{status === 'over' ? 'Quá tải' : status === 'under' ? 'Thiếu tải' : 'Hợp lý'}</span></div>
            <div className={`tc-load-bar ${status}`}><i style={{ width: `${pct}%` }} /></div>
        </div>
    );
}

export const STATUS_TONE: Record<string, string> = { active: 'ok', leave: 'warn', inactive: 'warn', retired: '' };
export const WEEKDAYS: Record<number, string> = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7' };
export const LEAVE_TYPES: Record<string, string> = { sick: 'Ốm đau', personal: 'Việc riêng', maternity: 'Thai sản', training: 'Đi tập huấn', other: 'Khác' };
export const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Chờ duyệt', cls: 'warn' }, approved: { label: 'Đã duyệt', cls: 'ok' }, rejected: { label: 'Từ chối', cls: 'bad' }, cancelled: { label: 'Đã hủy', cls: '' },
};
export const fmtD = (s?: string | null) => { if (!s) return '—'; const d = new Date(s.slice(0, 10) + 'T00:00:00'); return isNaN(+d) ? s : d.toLocaleDateString('vi-VN'); };