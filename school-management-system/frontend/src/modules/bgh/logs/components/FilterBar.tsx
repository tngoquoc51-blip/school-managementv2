'use client';

import { useEffect, useState } from 'react';
import s from '../logs.module.css';
import { MODULES, SEVERITY, STATUS, moduleLabel, roleLabel } from '../format';
import type { Facets, Filters } from '../types';
import { Icon } from './Icons';

const LABELS: Record<string, string> = {
    q: 'Từ khoá', module: 'Phân hệ', severity: 'Mức độ', status: 'Trạng thái', action: 'Hành động', actor_id: 'Người thực hiện (ID)',
    actor_type: 'Loại người dùng', actor_role: 'Vai trò', ip: 'IP', entity_type: 'Loại đối tượng', entity_id: 'ID đối tượng', from: 'Từ ngày', to: 'Đến ngày',
};

function valueLabel(k: string, v: string) {
    if (k === 'module') return v.split(',').map(moduleLabel).join(', ');
    if (k === 'severity') return v.split(',').map((x) => (SEVERITY as any)[x]?.label || x).join(', ');
    if (k === 'status') return v.split(',').map((x) => (STATUS as any)[x] || x).join(', ');
    if (k === 'actor_role') return roleLabel(v);
    return v;
}

const QUICK = [
    { label: 'Chỉ cảnh báo & nghiêm trọng', set: { severity: 'warning,critical' } },
    { label: 'Thất bại / bị từ chối', set: { status: 'failed,denied' } },
    { label: 'Đăng nhập', set: { module: 'auth' } },
    { label: 'Tài chính', set: { module: 'finance' } },
    { label: 'Sửa điểm', set: { action: 'grade.' } },
    { label: 'Xuất dữ liệu', set: { action: 'export' } },
];

export default function FilterBar({ value, onChange, facets, onExport, exporting }: {
    value: Filters; onChange: (f: Filters) => void; facets: Facets | null; onExport: () => void; exporting: boolean;
}) {
    const [q, setQ] = useState(value.q || '');
    useEffect(() => setQ(value.q || ''), [value.q]);
    useEffect(() => {
        const t = setTimeout(() => { if ((value.q || '') !== q) onChange({ ...value, q: q || undefined }); }, 350);
        return () => clearTimeout(t);
    }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

    const set = (k: keyof Filters, v?: string) => onChange({ ...value, [k]: v || undefined });
    const active = Object.entries(value).filter(([k, v]) => v && !['sort', 'dir'].includes(k));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={s.filters}>
                <div className={s.search}>
                    <Icon name="search" size={16} />
                    <input className={s.field} placeholder="Tìm theo mô tả, người dùng, IP, đối tượng, hành động…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm nhật ký" />
                </div>
                <select className={s.field} value={value.module?.includes(',') ? '' : value.module || ''} onChange={(e) => set('module', e.target.value)} aria-label="Phân hệ">
                    <option value="">Tất cả phân hệ</option>
                    {(facets?.modules || Object.keys(MODULES).map((m) => ({ module: m, c: 0 }))).map((m) => <option key={m.module} value={m.module}>{moduleLabel(m.module)}{m.c ? ` (${m.c})` : ''}</option>)}
                </select>
                <select className={s.field} value={value.severity?.includes(',') ? '' : value.severity || ''} onChange={(e) => set('severity', e.target.value)} aria-label="Mức độ">
                    <option value="">Mọi mức độ</option>
                    {Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className={s.field} value={value.status?.includes(',') ? '' : value.status || ''} onChange={(e) => set('status', e.target.value)} aria-label="Trạng thái">
                    <option value="">Mọi trạng thái</option>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className={s.field} value={value.actor_role || ''} onChange={(e) => set('actor_role', e.target.value)} aria-label="Vai trò">
                    <option value="">Mọi vai trò</option>
                    {(facets?.roles || []).map((r) => <option key={r.actor_role} value={r.actor_role}>{roleLabel(r.actor_role)}</option>)}
                </select>
                <input className={s.field} type="date" value={value.from || ''} onChange={(e) => set('from', e.target.value)} aria-label="Từ ngày" />
                <input className={s.field} type="date" value={value.to || ''} onChange={(e) => set('to', e.target.value)} aria-label="Đến ngày" />
                <button className={`${s.btn} ${s.primary}`} onClick={onExport} disabled={exporting}><Icon name="download" size={15} /> {exporting ? 'Đang xuất…' : 'Xuất CSV'}</button>
            </div>

            <div className={s.pills}>
                {QUICK.map((p) => {
                    const on = Object.entries(p.set).every(([k, v]) => (value as any)[k] === v);
                    return <button key={p.label} className={`${s.pill} ${on ? s.on : ''}`} onClick={() => onChange(on ? Object.fromEntries(Object.entries(value).filter(([k]) => !(k in p.set))) as Filters : { ...value, ...p.set })}>{p.label}</button>;
                })}
            </div>

            {active.length > 0 && (
                <div className={s.activeFilters}>
                    <span className={`${s.small} ${s.muted}`}>Đang lọc:</span>
                    {active.map(([k, v]) => (
                        <span key={k} className={s.tag}>{LABELS[k] || k}: {valueLabel(k, String(v))}
                            <button onClick={() => set(k as keyof Filters, undefined)} aria-label="Bỏ lọc"><Icon name="x" size={12} /></button></span>
                    ))}
                    <button className={`${s.btn} ${s.sm} ${s.ghost}`} onClick={() => onChange({})}>Xoá tất cả</button>
                </div>
            )}
        </div>
    );
}