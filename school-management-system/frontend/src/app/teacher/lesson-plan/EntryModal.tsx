'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { EntryTarget, Rating, SlotDetail } from '@/modules/teacher/lessonlog/types';
import { ATT, RATING, dmy } from '@/modules/teacher/lessonlog/util';
import { Icon, Modal, useUI } from '@/app/bgh/rewards/ui';

const WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** Ghi / ký sổ đầu bài cho một tiết. Điểm danh lấy tự động từ điểm danh từng tiết. */
export default function EntryModal({ classId, target, onClose, onSaved }: { classId: number; target: EntryTarget; onClose: () => void; onSaved: () => void }) {
    const { toast, confirm } = useUI();
    const e = target.entry;
    const ro = !target.can_write;
    const [busy, setBusy] = useState(false);
    const [detail, setDetail] = useState<SlotDetail | null>(null);
    const [f, setF] = useState({
        lesson_no: e?.lesson_no ? String(e.lesson_no) : '', lesson_title: e?.lesson_title || '', content: e?.content || '', homework: e?.homework || '',
        equipment: e?.equipment || '', rating: (e?.rating || '') as Rating | '', discipline_note: e?.discipline_note || '',
    });
    const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

    useEffect(() => {
        logApi.slot(classId, target.date, target.period).then(setDetail).catch(() => setDetail(null));
    }, [classId, target.date, target.period]);

    const save = async (status: 'draft' | 'submitted') => {
        if (busy) return;
        if (status === 'submitted') {
            if (!f.lesson_title.trim()) { toast('warn', 'Thiếu tên bài dạy', 'Nhập tên bài dạy trước khi ký sổ.'); return; }
            if (!f.rating) { toast('warn', 'Thiếu xếp loại', 'Chọn xếp loại tiết học trước khi ký sổ.'); return; }
        }
        setBusy(true);
        try {
            await logApi.saveEntry({
                class_id: classId, entry_date: target.date, period: target.period, status, lesson_no: f.lesson_no ? Number(f.lesson_no) : null,
                lesson_title: f.lesson_title.trim() || null, content: f.content || null, homework: f.homework || null, equipment: f.equipment || null,
                rating: f.rating || null, discipline_note: f.discipline_note || null,
            });
            toast('success', status === 'submitted' ? 'Đã ký sổ đầu bài' : 'Đã lưu nháp', `Tiết ${target.period} · ${target.subject_name}`);
            onSaved();
        } catch (x) { toast('error', 'Không thể lưu sổ', errMsg(x)); setBusy(false); }
    };

    const remove = async () => {
        if (!e || !(await confirm({ title: 'Xóa bản ghi?', danger: true, ok: 'Xóa', msg: 'Bản ghi sổ đầu bài của tiết này sẽ bị xóa.' }))) return;
        try { await logApi.deleteEntry(e.id); toast('success', 'Đã xóa bản ghi'); onSaved(); } catch (x) { toast('error', 'Không thể xóa', errMsg(x)); }
    };

    const s = detail?.summary;
    const Field = ({ label, k, area, ph }: { label: string; k: keyof typeof f; area?: boolean; ph?: string }) => (
        <label className="fld">{label}
            {ro ? <div className="ll-ro">{f[k] || '—'}</div> : area
                ? <textarea className="ll-ta" value={f[k]} onChange={(ev) => set(k, ev.target.value)} placeholder={ph} />
                : <input value={f[k]} onChange={(ev) => set(k, ev.target.value)} placeholder={ph} />}
        </label>
    );

    return (
        <Modal title={ro ? 'Chi tiết tiết học' : e ? 'Sổ đầu bài – chỉnh sửa' : 'Sổ đầu bài – ghi tiết học'} onClose={onClose} drawer
               footer={ro ? <button className="btn ghost" onClick={onClose}>Đóng</button> : (
                   <>
                       {e && <button className="btn ghost" onClick={remove} style={{ color: 'var(--bad)' }}><Icon n="trash" s={16} />Xóa</button>}
                       <span className="spacer" />
                       <button className="btn ghost" onClick={onClose}>Hủy</button>
                       <button className="btn ghost" disabled={busy} onClick={() => save('draft')}>Lưu nháp</button>
                       <button className="btn primary" disabled={busy} onClick={() => save('submitted')}><Icon n="check" s={16} />{busy ? 'Đang lưu…' : 'Ký sổ'}</button>
                   </>
               )}>
            <div className="rw-stack">
                <div className="ll-head">
                    <span className="no">{target.period}</span>
                    <div><b>{target.subject_name}</b><small>{WD[new Date(target.date + 'T00:00:00').getDay()]}, {dmy(target.date)} · Giáo viên: {target.teacher_name || '—'}</small></div>
                    {e && <span className={`ll-st ${e.status === 'submitted' ? 'good' : 'warn'}`} style={{ marginLeft: 'auto' }}>{e.status === 'submitted' ? 'Đã ký sổ' : 'Bản nháp'}</span>}
                </div>

                <div className="ll-att">
                    <div className="sum">
                        <b>Điểm danh tiết học</b>
                        {s ? (<>
                            <span className="ll-st good">Có mặt {s.present}/{s.total}</span>
                            {s.unexcused > 0 && <span className="ll-st bad">Vắng không phép {s.unexcused}</span>}
                            {s.excused > 0 && <span className="ll-st info">Vắng có phép {s.excused}</span>}
                            {s.late > 0 && <span className="ll-st warn">Đi muộn {s.late}</span>}
                        </>) : <span className="muted">Chưa có dữ liệu điểm danh cho tiết này.</span>}
                    </div>
                    {detail && detail.absent.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {detail.absent.map((a) => <span key={a.id} className={`ll-st ${ATT[a.status]?.tone || ''}`} title={ATT[a.status]?.l}>{a.full_name}</span>)}
                        </div>
                    )}
                </div>

                <div className="grid2">
                    <label className="fld" style={{ maxWidth: 160 }}>Tiết PPCT số
                        {ro ? <div className="ll-ro">{f.lesson_no || '—'}</div> : <input type="number" min="1" value={f.lesson_no} onChange={(ev) => set('lesson_no', ev.target.value)} />}
                    </label>
                    <div />
                </div>
                <Field label="Tên bài dạy *" k="lesson_title" ph="Ví dụ: Bài 5 – Hàm số bậc hai" />
                <Field label="Nội dung tiết học" k="content" area ph="Nội dung đã dạy, hoạt động của học sinh…" />
                <div className="grid2">
                    <Field label="Bài tập về nhà" k="homework" ph="Dặn dò, bài tập giao" />
                    <Field label="Đồ dùng dạy học" k="equipment" ph="Thiết bị, học liệu sử dụng" />
                </div>
                <div className="fld">Xếp loại tiết học *
                    {ro ? <div className="ll-ro">{f.rating ? RATING[f.rating].l : '—'}</div> : (
                        <div className="ll-rts">
                            {(Object.keys(RATING) as Rating[]).map((k) => (
                                <button key={k} type="button" className={`${k}${f.rating === k ? ' on' : ''}`} onClick={() => set('rating', k)}><span className={`ll-dot ${RATING[k].tone}`} />{RATING[k].l}</button>
                            ))}
                        </div>
                    )}
                </div>
                <Field label="Nhận xét, vi phạm trong tiết học" k="discipline_note" area ph="Học sinh vi phạm, tình hình lớp, kiến nghị…" />
                {e && <div className="hint">Ghi bởi {e.created_by_name || '—'} · cập nhật {e.updated_at ? dmy(e.updated_at.slice(0, 10)) : '—'}</div>}
            </div>
        </Modal>
    );
}