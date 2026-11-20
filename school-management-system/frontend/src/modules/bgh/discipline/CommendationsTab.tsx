'use client';
import { useCallback, useEffect, useState } from 'react';
import { COMMEND_KINDS, commendLabel, fmtDate } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import StudentPicker from './StudentPicker';
import type { Commendation, Paged, StudentHit, TabProps } from './types';
import { Avatar, Badge, Empty, Field, Icon, Modal, Pager, SkelRows, useUI } from './ui';

const TONE = { pending: 'warn', approved: 'ok', rejected: 'mute' } as const;
const LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' } as const;

export default function CommendationsTab({ meta, scope, tick, refresh, openStudent }: TabProps) {
    const { toast } = useUI();
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<Commendation> | null>(null);
    const [form, setForm] = useState(false);
    const can = meta.permissions.approve;

    const load = useCallback(() => {
        setData(null);
        disciplineService.commendations({ year_id: scope.yearId, semester: scope.semester, status, q, page }).then(setData)
            .catch((e) => toast('error', 'Không tải được khen thưởng', errMsg(e)));
    }, [scope, status, q, page]);
    useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, tick]);

    const review = async (c: Commendation, d: 'approve' | 'reject') => {
        try { const r = await disciplineService.reviewCommendation(c.id, d); toast('success', r.message); refresh(); }
        catch (e) { toast('error', 'Thao tác thất bại', errMsg(e)); }
    };

    return (
        <section className="dc-card">
            <div className="dc-card-h"><h3>Khen thưởng & biểu dương</h3><button className="dc-btn sm primary" onClick={() => setForm(true)}><Icon n="plus" />Đề xuất khen thưởng</button></div>
            <div className="dc-filters">
                <input className="dc-input" placeholder="Tìm học sinh…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
                <select className="dc-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                    <option value="">Mọi trạng thái</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            {!data ? <SkelRows /> : !data.data.length ? <Empty icon="star" text="Chưa có khen thưởng nào" /> : (
                <div className="dc-list">
                    {data.data.map((c) => (
                        <div key={c.id} className="dc-item">
                            <Avatar name={c.student_name ?? '?'} />
                            <div className="grow"><b style={{ cursor: 'pointer' }} onClick={() => openStudent(c.student_id)}>{c.student_name}</b> · {c.class_name}
                                <small>{c.title} · {commendLabel(c.kind)} · {fmtDate(c.awarded_date)} · bởi {c.created_by_name}</small></div>
                            <span className="dc-score" style={{ color: 'var(--ok)' }}>+{c.points}</span>
                            <Badge tone={TONE[c.status]}>{LABEL[c.status]}</Badge>
                            {can && c.status === 'pending' && <>
                                <button className="dc-btn sm ok" onClick={() => review(c, 'approve')}>Duyệt</button>
                                <button className="dc-btn sm" onClick={() => review(c, 'reject')}>Từ chối</button></>}
                        </div>
                    ))}
                </div>
            )}
            {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} />}
            {form && <CommendForm scope={scope} approve={can} onClose={() => setForm(false)} onSaved={refresh} />}
        </section>
    );
}

function CommendForm({ scope, approve, onClose, onSaved }: { scope: TabProps['scope']; approve: boolean; onClose: () => void; onSaved: () => void }) {
    const { toast } = useUI();
    const [st, setSt] = useState<StudentHit | null>(null);
    const [f, setF] = useState({ kind: 'giay_khen', title: '', description: '', points: '3', awarded_date: new Date().toISOString().slice(0, 10) });
    const [busy, setBusy] = useState(false);
    const save = async () => {
        if (!st) return;
        setBusy(true);
        try { const r = await disciplineService.createCommendation({ ...f, points: Number(f.points), student_id: st.id }); toast('success', r.message); onSaved(); onClose(); }
        catch (e) { toast('error', 'Không lưu được', errMsg(e)); } finally { setBusy(false); }
    };
    return (
        <Modal title="Đề xuất khen thưởng" onClose={onClose} footer={<>
            <button className="dc-btn" onClick={onClose}>Hủy</button>
            <button className="dc-btn primary" disabled={!st || f.title.trim().length < 3 || busy} onClick={save}>{approve ? 'Lưu và duyệt' : 'Gửi đề xuất'}</button></>}>
            <Field label="Học sinh *"><StudentPicker scope={scope} value={st} onChange={setSt} /></Field>
            <div className="dc-grid2">
                <Field label="Hình thức"><select className="dc-select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{COMMEND_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select></Field>
                <Field label="Điểm cộng rèn luyện"><input type="number" min={0} max={30} className="dc-input" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} /></Field>
            </div>
            <Field label="Nội dung khen thưởng *"><input className="dc-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="VD: Đạt giải Nhì cuộc thi Olympic Toán cấp trường" /></Field>
            <Field label="Ngày trao"><input type="date" className="dc-input" value={f.awarded_date} onChange={(e) => setF({ ...f, awarded_date: e.target.value })} /></Field>
            <Field label="Ghi chú"><textarea className="dc-textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        </Modal>
    );
}