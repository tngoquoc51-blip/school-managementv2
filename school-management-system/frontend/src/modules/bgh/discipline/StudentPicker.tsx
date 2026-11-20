'use client';
import { useEffect, useRef, useState } from 'react';
import { disciplineService } from './disciplineService';
import type { Scope, StudentHit } from './types';
import { Avatar, Icon, RankBadge } from './ui';

/** Ô tìm học sinh theo tên / mã, có gợi ý kèm lớp và điểm rèn luyện hiện tại. */
export default function StudentPicker({ scope, value, onChange }: { scope: Scope; value: StudentHit | null; onChange: (s: StudentHit | null) => void }) {
    const [q, setQ] = useState('');
    const [hits, setHits] = useState<StudentHit[]>([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (q.trim().length < 2) { setHits([]); return; }
        setBusy(true);
        const t = setTimeout(() => {
            disciplineService.searchStudents(q.trim(), { year_id: scope.yearId }).then(setHits).catch(() => setHits([])).finally(() => setBusy(false));
        }, 250);
        return () => clearTimeout(t);
    }, [q, scope.yearId]);

    useEffect(() => {
        const h = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    if (value) {
        return (
            <div className="dc-item" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px' }}>
                <Avatar name={value.full_name} />
                <div className="grow"><b>{value.full_name}</b><small>{value.code} · Lớp {value.class_name}</small></div>
                <span className="dc-score">{value.score}</span><RankBadge r={value.rank} />
                <button className="dc-x" onClick={() => onChange(null)} aria-label="Chọn lại"><Icon n="x" /></button>
            </div>
        );
    }
    return (
        <div className="dc-picker" ref={box}>
            <input className="dc-input" placeholder="Gõ tên hoặc mã học sinh (tối thiểu 2 ký tự)…" value={q}
                   onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
            {open && q.trim().length >= 2 && (
                <div className="dc-pop">
                    {busy && <div className="dc-empty" style={{ padding: 14 }}>Đang tìm…</div>}
                    {!busy && !hits.length && <div className="dc-empty" style={{ padding: 14 }}>Không tìm thấy học sinh phù hợp</div>}
                    {hits.map((h) => (
                        <button key={h.id} onClick={() => { onChange(h); setOpen(false); setQ(''); }}>
                            <Avatar name={h.full_name} />
                            <span style={{ flex: 1 }}><b>{h.full_name}</b><br /><small style={{ color: 'var(--muted)' }}>{h.code} · Lớp {h.class_name}</small></span>
                            <span className="dc-score">{h.score}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}