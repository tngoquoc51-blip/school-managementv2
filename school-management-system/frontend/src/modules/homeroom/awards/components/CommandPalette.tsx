'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudentRow } from '../types';
import { removeAccents } from '../utils';
import Icon, { IconName } from './icons';
import { Avatar } from './ui';

export interface PaletteAction { id: string; label: string; icon: IconName; run: () => void }

export default function CommandPalette({ open, onClose, actions, students, onStudent }: {
    open: boolean; onClose: () => void; actions: PaletteAction[]; students: StudentRow[]; onStudent: (id: number) => void;
}) {
    const [q, setQ] = useState('');
    const [idx, setIdx] = useState(0);
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => ref.current?.focus(), 30); } }, [open]);

    const items = useMemo(() => {
        const k = removeAccents(q.trim());
        const a = actions.filter((x) => !k || removeAccents(x.label).includes(k)).map((x) => ({ kind: 'action' as const, key: x.id, label: x.label, icon: x.icon, run: x.run }));
        const s = k ? students.filter((x) => removeAccents(x.full_name).includes(k) || x.code.toLowerCase().includes(k)).slice(0, 8)
            .map((x) => ({ kind: 'student' as const, key: `s${x.id}`, label: x.full_name, sub: `${x.code} · ${x.score} điểm · hạng #${x.rank}`, run: () => onStudent(x.id) })) : [];
        return [...a, ...s];
    }, [q, actions, students, onStudent]);

    useEffect(() => { setIdx(0); }, [q]);
    if (!open) return null;

    const pick = (i: number) => { const it = items[i]; if (it) { onClose(); it.run(); } };
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') pick(idx);
        else if (e.key === 'Escape') onClose();
    };

    return (
        <div className="emu-scrim top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="emu-pal" role="dialog" aria-label="Tìm nhanh">
                <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Gõ tên học sinh hoặc lệnh… (↑ ↓ Enter)" />
                <div className="emu-pal-list">
                    {items.length === 0 && <div className="emu-empty">Không có kết quả</div>}
                    {items.map((it, i) => (
                        <button key={it.key} className={`emu-pal-it${i === idx ? ' on' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => pick(i)}>
                            {it.kind === 'action' ? <Icon name={it.icon} /> : <Avatar name={it.label} size="sm" />}
                            <span style={{ flex: 1 }}><b>{it.label}</b>{it.kind === 'student' && <span className="emu-muted" style={{ display: 'block', fontSize: 11.5 }}>{it.sub}</span>}</span>
                            <Icon name="right" size={14} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}