'use client';

import { useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { getErrorMessage } from '@/modules/admin/categories/catalogApi';
import { useFeedback } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { Modal } from '@/modules/admin/categories/components/ui';
import s from '../roster.module.css';
import { GRADES } from '../constants';
import { rosterApi } from '../rosterApi';
import type { AutoAssignResult } from '../types';

export default function AutoAssignModal({ open, yearId, unplaced, onClose, onDone }: { open: boolean; yearId: number; unplaced: number; onClose: () => void; onDone: () => void }) {
    const fb = useFeedback();
    const [grade, setGrade] = useState(10);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<AutoAssignResult | null>(null);

    useEffect(() => { if (open) { setResult(null); setBusy(false); } }, [open]);

    const run = async () => {
        const ok = await fb.confirm({ title: `Xếp lớp tự động khối ${grade}?`, message: `${unplaced} học sinh chưa có lớp sẽ được chia đều vào các lớp khối ${grade}, ưu tiên lớp đang ít học sinh nhất. Bạn có thể chuyển lớp lại sau.`, confirmLabel: 'Bắt đầu xếp lớp' });
        if (!ok) return;
        setBusy(true);
        try { const r = await rosterApi.autoAssign(yearId, grade); setResult(r); fb.success('Đã xếp lớp tự động', `${r.assigned} học sinh`); onDone(); }
        catch (e) { fb.error('Không xếp được', getErrorMessage(e)); } finally { setBusy(false); }
    };

    return (
        <Modal open={open} title="Xếp lớp tự động" onClose={onClose}>
            {!result ? (
                <>
                    <p>Hiện có <b>{unplaced.toLocaleString('vi-VN')}</b> học sinh chưa được xếp lớp trong năm học này. Hệ thống chia đều và cân bằng sĩ số giữa các lớp của khối được chọn.</p>
                    <div className={cat.chips} style={{ margin: '14px 0' }}>
                        {GRADES.map((g) => <button key={g} type="button" className={`${cat.chip} ${grade === g ? cat.chipOn : ''}`} onClick={() => setGrade(g)}>Khối {g}</button>)}
                    </div>
                    <div className={cat.dialogActions}>
                        <button className={cat.btnGhost} onClick={onClose}>Hủy</button>
                        <button className={cat.btnPrimary} onClick={run} disabled={busy || unplaced === 0}>{busy ? <span className={cat.spinner} /> : <Icon name="sparkle" size={16} />} Xếp lớp tự động</button>
                    </div>
                </>
            ) : (
                <>
                    <p>Đã xếp <b>{result.assigned}</b> học sinh. Sĩ số sau khi xếp:</p>
                    <ul className={s.resultList}>{result.classes.map((c) => <li key={c.id}><span>Lớp {c.name}</span><span>{c.n} học sinh (+{c.added})</span></li>)}</ul>
                    <div className={cat.dialogActions}><button className={cat.btnPrimary} onClick={onClose}>Xong</button></div>
                </>
            )}
        </Modal>
    );
}