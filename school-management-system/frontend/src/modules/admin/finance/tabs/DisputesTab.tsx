'use client';

import { useState } from 'react';
import { apiError, finApi } from '@/services/adminFinanceService';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBox, Field, Icon, Modal, Skeleton, Spin, fmtDateTime, fp, useFetch, vnd } from '../ui';
import type { DisputeRow, Filters } from '../types';
import s from '../finance.module.css';

export default function DisputesTab({ f, onChanged }: { f: Filters; onChanged: () => void }) {
    const toast = useToast();
    const [status, setStatus] = useState('');
    const key = JSON.stringify(f);
    const { data, loading, error, reload } = useFetch(() => finApi.disputes(fp(f, { status })), [key, status]);
    const [row, setRow] = useState<DisputeRow | null>(null); const [text, setText] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const open = data?.filter((d) => d.status === 'open').length ?? 0;

    async function send() {
        if (!row) return; setBusy(true); setErr('');
        try { await finApi.replyDispute(row.id, text); toast.success('Đã gửi phản hồi', `Hóa đơn ${row.invoice_code}`); setRow(null); setText(''); await reload(); onChanged(); }
        catch (e) { const r = apiError(e); setErr(r.fields.reply || r.message); } finally { setBusy(false); }
    }

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="chat" /> Khiếu nại hóa đơn</h3><div className={s.cardSub}>Phụ huynh gửi thắc mắc về khoản thu – cần phản hồi sớm</div></div></div>
                <div className={s.filters} style={{ marginBottom: 14 }}>
                    {[['', 'Tất cả'], ['open', 'Chưa trả lời'], ['answered', 'Đã trả lời']].map(([k, l]) => <button key={k} className={`${s.pill} ${status === k ? s.pillOn : ''}`} onClick={() => setStatus(k)}>{l}{k === 'open' && !status ? ` (${open})` : ''}</button>)}
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={90} n={3} /> : data.length === 0 ? <Empty icon="🙌" text="Không có khiếu nại nào." /> : (
                    <div className={s.stack} style={{ opacity: loading ? 0.6 : 1 }}>{data.map((d) => (
                        <div key={d.id} className={s.item} style={{ flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', width: '100%' }}>
                                <div><b>{d.student_name}</b> <span className={s.cardSub}>{d.student_code} · Lớp {d.class_name || '—'}</span>
                                    <div className={s.cardSub}>Hóa đơn {d.invoice_code} · {d.title} · {vnd(d.total)}</div></div>
                                <span className={`${s.badge} ${d.status === 'open' ? s.bWarn : s.bOk}`}>{d.status === 'open' ? 'Chưa trả lời' : 'Đã trả lời'}</span>
                            </div>
                            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', width: '100%' }}>“{d.message}”<div className={s.cardSub}>{fmtDateTime(d.created_at)}</div></div>
                            {d.reply ? <div style={{ width: '100%', paddingLeft: 12, borderLeft: '3px solid var(--brand)' }}>{d.reply}<div className={s.cardSub}>{d.replied_by} · {fmtDateTime(d.replied_at)}</div></div> : null}
                            <div><button className={`${s.btn} ${s.btnS} ${d.status === 'open' ? s.btnP : ''}`} onClick={() => { setRow(d); setText(d.reply || ''); setErr(''); }}>{d.status === 'open' ? 'Trả lời' : 'Sửa phản hồi'}</button></div>
                        </div>))}</div>)}
            </section>
            {row && (
                <Modal title={`Phản hồi khiếu nại – ${row.invoice_code}`} onClose={() => setRow(null)}>
                    <div className={s.noteItem}>“{row.message}”<div className={s.cardSub}>{row.student_name} · {fmtDateTime(row.created_at)}</div></div>
                    <Field label="Nội dung phản hồi" required error={err}><textarea className={`${s.textarea} ${err ? s.invalid : ''}`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Giải thích rõ khoản thu, cách tính và hướng xử lý…" autoFocus /></Field>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setRow(null)}>Hủy</button><button className={`${s.btn} ${s.btnP}`} disabled={busy || text.trim().length < 3} onClick={send}>{busy ? <Spin /> : <Icon n="send" size={16} />} Gửi phản hồi</button></div>
                </Modal>)}
        </div>
    );
}