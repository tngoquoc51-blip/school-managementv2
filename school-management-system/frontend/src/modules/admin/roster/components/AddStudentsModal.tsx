'use client';

import { useCallback, useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { getErrorMessage } from '@/modules/admin/categories/catalogApi';
import { useFeedback } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { EmptyState, Modal } from '@/modules/admin/categories/components/ui';
import { useDebounce } from '@/modules/admin/categories/hooks/useDebounce';
import s from '../roster.module.css';
import { fmtDate, initials } from '../constants';
import { rosterApi } from '../rosterApi';
import type { StudentRow } from '../types';

/** Chọn nhiều học sinh chưa có lớp để thêm vào một lớp. */
export default function AddStudentsModal({ open, yearId, classId, className, onClose, onDone }: { open: boolean; yearId: number; classId: number; className: string; onClose: () => void; onDone: () => void }) {
    const fb = useFeedback();
    const [q, setQ] = useState('');
    const search = useDebounce(q);
    const [rows, setRows] = useState<StudentRow[]>([]);
    const [total, setTotal] = useState(0);
    const [picked, setPicked] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { const r = await rosterApi.students({ year_id: yearId, placement: 'unplaced', search, per_page: 50 }); setRows(r.items); setTotal(r.meta.total); }
        catch (e) { fb.error('Không tải được danh sách', getErrorMessage(e)); } finally { setLoading(false); }
    }, [yearId, search, fb]);

    useEffect(() => { if (open) { setPicked(new Set()); setQ(''); } }, [open]);
    useEffect(() => { if (open) void load(); }, [open, load]);

    const toggle = (id: number) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const submit = async () => {
        setBusy(true);
        try {
            const r = await rosterApi.bulkEnroll(Array.from(picked), classId, yearId);
            if (r.over_capacity) fb.warning('Lớp vượt sĩ số', `Lớp ${className} hiện có ${r.class_size} học sinh.`);
            else fb.success(`Đã thêm ${r.processed} học sinh vào lớp ${className}`);
            onDone();
        } catch (e) { fb.error('Không thêm được', getErrorMessage(e)); } finally { setBusy(false); }
    };

    return (
        <Modal open={open} wide title={`Thêm học sinh vào lớp ${className}`} onClose={onClose}>
            <label className={cat.search} style={{ marginBottom: 12 }}>
                <Icon name="search" size={16} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm học sinh chưa có lớp theo tên hoặc mã…" aria-label="Tìm học sinh" />
            </label>
            <p className={cat.muted}>{total.toLocaleString('vi-VN')} học sinh chưa có lớp{total > rows.length ? ` — đang hiện ${rows.length} đầu tiên, hãy tìm kiếm để thu hẹp` : ''}.</p>
            <div className={s.pickList}>
                {!loading && rows.length === 0 && <EmptyState icon="users" title="Không có học sinh chưa xếp lớp" hint="Mọi học sinh phù hợp đều đã có lớp." />}
                {rows.map((r) => (
                    <label key={r.id} className={s.pickRow}>
                        <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                        <span className={`${s.avatar} ${r.gender === 'Nữ' ? s.avatarF : ''}`} style={{ width: 34, height: 34, fontSize: 13 }}>{initials(r.full_name)}</span>
                        <span style={{ flex: 1 }}>{r.full_name}</span>
                        <span className={cat.muted}>{r.code} · {fmtDate(r.birth_date)}</span>
                    </label>
                ))}
            </div>
            <div className={cat.dialogActions}>
                <button className={cat.btnGhost} onClick={onClose}>Đóng</button>
                <button className={cat.btnPrimary} onClick={submit} disabled={busy || picked.size === 0}>{busy ? <span className={cat.spinner} /> : <Icon name="plus" size={16} />} Thêm {picked.size || ''} học sinh</button>
            </div>
        </Modal>
    );
}