'use client';
// Yêu cầu đổi tiết / dạy bù / nghỉ / đổi phòng (/teacher/schedule/yeu-cau)
import React, { useState } from 'react';
import { Btn, Card, Confirm, Empty, ErrorBox, Ico, Loading, Pill, Tabs, dt, fmtD, useLoad, useTa } from '../../attendance/_ta';
import { PickSlot, REQ, REQ_ST, ReqKind, RequestModal, Slot, tk } from '../_tk';

type Req = { id: number; kind: ReqKind; cs: number; class_name: string; subject: string; teacher: string | null; date: string; period: number; to_date: string | null; to_period: number | null; to_room: string | null; reason: string; status: string; review_note: string | null; reviewed_at: string | null; created_at: string };
type Res = { counts: Record<string, number>; data: Req[] };

export default function RequestsPage() {
    const { toast, refresh } = useTa();
    const [st, setSt] = useState('pending');
    const [step, setStep] = useState<'' | 'pick'>('');
    const [slot, setSlot] = useState<Slot | null>(null);
    const [cancel, setCancel] = useState<Req | null>(null);
    const { data, err, loading, reload } = useLoad(() => tk<Res>(`requests?status=${st === 'all' ? '' : st}`), [st]);
    const c = data?.counts || {};
    const n = (k: string) => Number(c[k] || 0);
    const done = () => { setSlot(null); setStep(''); reload(); refresh(); };

    return (
        <div className="ta-page">
            <div className="ta-range">
                <Tabs value={st} onChange={setSt} items={[{ key: 'pending', label: 'Chờ duyệt', count: n('pending'), tone: 'amber' }, { key: 'approved', label: 'Đã duyệt', count: n('approved'), tone: 'green' }, { key: 'rejected', label: 'Từ chối', count: n('rejected'), tone: 'rose' }, { key: 'all', label: 'Tất cả' }]} />
                <span style={{ flex: 1 }} />
                <Btn tone="primary" onClick={() => setStep('pick')}><Ico n="plus" size={16} />Tạo yêu cầu mới</Btn>
            </div>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0
                ? <Card><Empty icon="send" title="Chưa có yêu cầu nào" text="Khi cần đổi tiết, dạy bù, xin nghỉ hoặc đổi phòng, hãy tạo yêu cầu để nhà trường duyệt." action={<Btn tone="primary" onClick={() => setStep('pick')}>Tạo yêu cầu</Btn>} /></Card>
                : <div className="ts-reqs">{data.data.map((r) => {
                    const k = REQ[r.kind]; const s = REQ_ST[r.status] || { label: r.status, tone: 'gray' };
                    return (
                        <div className={`ts-req t-${k.tone}`} key={r.id}>
                            <span className="ic"><Ico n={k.icon} size={20} /></span>
                            <div>
                                <h4>{k.label} · {r.subject} – {r.class_name}</h4>
                                <p>Tiết {r.period} ngày {fmtD(r.date)}{r.to_date ? ` → tiết ${r.to_period} ngày ${fmtD(r.to_date)}` : ''}{r.to_room ? ` → phòng ${r.to_room}` : ''}</p>
                                <p>“{r.reason}”</p>
                                <div className="meta"><Pill tone={s.tone} dot>{s.label}</Pill><span className="ta-mute">Gửi {dt(r.created_at)}</span>{r.reviewed_at && <span className="ta-mute">· Xử lý {dt(r.reviewed_at)}</span>}</div>
                                {r.review_note && <div className="note"><b>Nhà trường:</b> {r.review_note}</div>}
                            </div>
                            {r.status === 'pending' && <Btn size="sm" tone="danger" onClick={() => setCancel(r)}>Hủy yêu cầu</Btn>}
                        </div>);
                })}</div>}
            {step === 'pick' && <PickSlot title="Chọn tiết cần thay đổi" onClose={() => setStep('')} onPick={(s) => { setStep(''); setSlot(s); }} />}
            {slot && <RequestModal slot={slot} onClose={() => setSlot(null)} onDone={done} />}
            {cancel && <Confirm title="Hủy yêu cầu này?" tone="danger" okText="Hủy yêu cầu" text={<>Yêu cầu “{REQ[cancel.kind].label}” tiết {cancel.period} ngày {fmtD(cancel.date)} sẽ bị hủy.</>}
                                onClose={() => setCancel(null)} onOk={async () => { await tk(`requests/${cancel.id}/cancel`, { method: 'POST' }); toast('Đã hủy yêu cầu.'); setCancel(null); reload(); refresh(); }} />}
        </div>
    );
}