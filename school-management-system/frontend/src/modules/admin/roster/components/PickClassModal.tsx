'use client';

import { useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import Icon from '@/modules/admin/categories/components/Icon';
import { Modal } from '@/modules/admin/categories/components/ui';
import { SIZE_LABEL } from '../constants';
import type { ClassRow } from '../types';

interface Props {
    open: boolean;
    title: string;
    hint?: string;
    classes: ClassRow[];
    currentClassId?: number | null;
    confirmLabel?: string;
    onClose: () => void;
    onSubmit: (classId: number) => Promise<void>;
}

export default function PickClassModal({ open, title, hint, classes, currentClassId, confirmLabel = 'Xác nhận', onClose, onSubmit }: Props) {
    const [grade, setGrade] = useState<number | ''>('');
    const [classId, setClassId] = useState<number | ''>('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (open) { setGrade(''); setClassId(''); setBusy(false); } }, [open]);

    const list = classes.filter((c) => (grade === '' || c.grade === grade) && c.id !== currentClassId);
    const grades = Array.from(new Set(classes.map((c) => c.grade))).sort();
    const chosen = classes.find((c) => c.id === classId);

    const submit = async () => {
        if (classId === '') return;
        setBusy(true);
        try { await onSubmit(classId); } finally { setBusy(false); }
    };

    return (
        <Modal open={open} title={title} onClose={onClose}>
            {hint && <p className={cat.muted}>{hint}</p>}
            <div className={cat.chips} style={{ margin: '12px 0' }}>
                <button type="button" className={`${cat.chip} ${grade === '' ? cat.chipOn : ''}`} onClick={() => setGrade('')}>Tất cả khối</button>
                {grades.map((g) => <button key={g} type="button" className={`${cat.chip} ${grade === g ? cat.chipOn : ''}`} onClick={() => setGrade(g)}>Khối {g}</button>)}
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {list.length === 0 && <p className={cat.muted}>Không có lớp phù hợp.</p>}
                {list.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: `1px solid ${classId === c.id ? 'var(--primary)' : 'var(--border)'}`, background: classId === c.id ? 'var(--primary-50)' : 'var(--surface)', borderRadius: 12, marginBottom: 8, fontWeight: 800, cursor: 'pointer' }}>
                        <input type="radio" name="pick-class" checked={classId === c.id} onChange={() => setClassId(c.id)} />
                        <span style={{ fontSize: 18, minWidth: 56 }}>{c.name}</span>
                        <span className={cat.muted} style={{ flex: 1 }}>{c.homeroom_name ? `GVCN: ${c.homeroom_name}` : 'Chưa có GVCN'}</span>
                        <span>{c.students}/{c.capacity}</span>
                        <span className={`${cat.badge} ${cat['badge_' + SIZE_LABEL[c.size_state].tone]}`}>{SIZE_LABEL[c.size_state].label}</span>
                    </label>
                ))}
            </div>
            {chosen && chosen.students >= chosen.capacity && (
                <p className={cat.inlineWarn}>Lớp {chosen.name} đã đủ {chosen.capacity} học sinh — vẫn có thể xếp nhưng sẽ vượt sĩ số.</p>
            )}
            <div className={cat.dialogActions}>
                <button className={cat.btnGhost} onClick={onClose}>Hủy</button>
                <button className={cat.btnPrimary} disabled={classId === '' || busy} onClick={submit}>
                    {busy ? <span className={cat.spinner} /> : <Icon name="check" size={16} />} {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}