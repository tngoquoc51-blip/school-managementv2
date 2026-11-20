'use client';
import { useCallback, useEffect, useState } from 'react';
import { fmtDate } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import type { Appeal, Paged, TabProps } from './types';
import { Avatar, Badge, Empty, Field, Modal, Pager, SkelRows, useUI } from './ui';

const TONE = { pending: 'warn', accepted: 'ok', rejected: 'mute' } as const;
const LABEL = { pending: 'Chờ phản hồi', accepted: 'Đã chấp nhận', rejected: 'Đã bác' } as const;

export default function AppealsTab({ meta, tick, refresh, openRecord }: TabProps) {
    const { toast } = useUI();
    const [status, setStatus] = useState('pending');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<Appeal> | null>(null);
    const [target, setTarget] = useState<Appeal | null>(null);
    const [decision, setDecision] = useState<'accept' | 'reject'>('accept');
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        setData(null);
        disciplineService.appeals({ status, page }).then(setData).catch((e) => toast('error', 'Không tải được khiếu nại', errMsg(e)));
    }, [status, page]);
    useEffect(() => { load(); }, [load, tick]);

    const send = async () => {
        if (!target) return;
        setBusy(true);
        try { const r = await disciplineService.respondAppeal(target.id, decision, text); toast('success', r.message); setTarget(null); setText(''); refresh(); }
        catch (e) { toast('error', 'Không gửi được phản hồi', errMsg(e)); } finally { setBusy(false); }
    };

    return (
        <section className="dc-card">
            <div className="dc-card-h"><h3>Khiếu nại & giải trình</h3>
                <div className="dc-tabs">{[['pending', 'Chờ xử lý'], ['accepted', 'Đã chấp nhận'], ['rejected', 'Đã bác'], ['', 'Tất cả']].map(([v, l]) =>
                    <button key={v} className={status === v ? 'on' : ''} onClick={() => { setStatus(v); setPage(1); }}>{l}</button>)}</div></div>
            {!data ? <SkelRows n={4} /> : !data.data.length ? <Empty icon="chat" text="Không có đơn khiếu nại nào" /> : (
                <div className="dc-list">
                    {data.data.map((a) => (
                        <div key={a.id} className="dc-item" style={{ alignItems: 'flex-start' }}>
                            <Avatar name={a.student_name ?? '?'} />
                            <div className="grow">
                                <b>{a.student_name}</b> · {a.class_name} <Badge tone={TONE[a.status]}>{LABEL[a.status]}</Badge>
                                <small>Biên bản <a style={{ color: 'var(--brand)', cursor: 'pointer', fontWeight: 600 }} onClick={() => openRecord(a.record_id)}>{a.record_code}</a> · {a.category_name} (-{a.points}) · gửi {fmtDate(a.created_at)}</small>
                                <p style={{ marginTop: 8 }}>“{a.reason}”</p>
                                {a.response && <p style={{ marginTop: 6, color: 'var(--muted)' }}>Phản hồi ({a.responded_by_name}): {a.response}</p>}
                            </div>
                            {meta.permissions.approve && a.status === 'pending' && <button className="dc-btn sm primary" onClick={() => { setTarget(a); setDecision('accept'); setText(''); }}>Phản hồi</button>}
                        </div>
                    ))}
                </div>
            )}
            {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} />}
            {target && (
                <Modal title={`Phản hồi khiếu nại – ${target.student_name}`} onClose={() => setTarget(null)} footer={<>
                    <button className="dc-btn" onClick={() => setTarget(null)}>Hủy</button>
                    <button className={`dc-btn ${decision === 'accept' ? 'ok' : 'danger'}`} disabled={text.trim().length < 3 || busy} onClick={send}>
                        {decision === 'accept' ? 'Chấp nhận & hủy biên bản' : 'Bác khiếu nại'}</button></>}>
                    <div className="dc-note info">{target.reason}</div>
                    <div className="dc-tabs" style={{ alignSelf: 'flex-start' }}>
                        <button className={decision === 'accept' ? 'on' : ''} onClick={() => setDecision('accept')}>Chấp nhận</button>
                        <button className={decision === 'reject' ? 'on' : ''} onClick={() => setDecision('reject')}>Bác bỏ</button></div>
                    {decision === 'accept' && <div className="dc-note">Biên bản sẽ bị hủy và điểm rèn luyện được hoàn lại cho học sinh.</div>}
                    <Field label="Nội dung phản hồi *"><textarea className="dc-textarea" value={text} onChange={(e) => setText(e.target.value)} /></Field>
                </Modal>
            )}
        </section>
    );
}