'use client';

import { useCallback, useEffect, useState } from 'react';
import s from './approvals.module.css';
import { approvals, errMsg, type Action, type Detail, type Me } from '@/services/bghApproval';
import { ACTION_LABEL, Icon, KIND_LABEL, LEVEL_LABEL, PRIORITY_LABEL, STATUS_LABEL, Seal, TYPE_ICON, fmtD, fmtDT, fmtMoney, initials, slaText, useToast } from './ui';

interface Props { id: number | null; me: Me | null; onChanged: () => void; onClose: () => void }
type Kind = 'approve' | 'reject' | 'return';
const KINDS: { key: Kind; label: string }[] = [{ key: 'approve', label: 'Đồng ý' }, { key: 'return', label: 'Trả lại' }, { key: 'reject', label: 'Từ chối' }];
const DONE: Record<Action, [string, string]> = {
    approve: ['Đã phê duyệt', 'Yêu cầu đã được duyệt và đóng dấu.'],
    reject: ['Đã từ chối', 'Người đề nghị sẽ thấy lý do bạn ghi.'],
    return: ['Đã trả lại', 'Người đề nghị cần bổ sung rồi trình lại.'],
    forward: ['Đã chuyển Hiệu trưởng', 'Yêu cầu chờ Hiệu trưởng quyết định.'],
};

export default function DetailPane({ id, me, onChanged, onClose }: Props) {
    const toast = useToast();
    const [d, setD] = useState<Detail | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [tpl, setTpl] = useState<Record<string, string[]>>({});
    const [kind, setKind] = useState<Kind>('approve');
    const [note, setNote] = useState('');
    const [cmt, setCmt] = useState('');
    const [busy, setBusy] = useState<Action | null>(null);

    const load = useCallback(async () => {
        if (id === null) return;
        try { const r = await approvals.show(id); setD(r.data as Detail); setErr(null); } catch (e) { setErr(errMsg(e)); }
    }, [id]);

    useEffect(() => { setD(null); setNote(''); setCmt(''); setKind('approve'); load(); }, [load]);
    useEffect(() => { approvals.templates().then((r: any) => setTpl(r?.data ?? {})).catch(() => {}); }, []);

    const act = async (a: Action) => {
        if (!d) return;
        if ((a === 'reject' || a === 'return') && note.trim().length < 5) {
            toast.push('error', 'Chưa có lý do', 'Hãy ghi rõ lý do (ít nhất 5 ký tự) trước khi từ chối hoặc trả lại.');
            return;
        }
        if (a === 'approve' && d.amount && d.amount >= 50000000 && !window.confirm(`Yêu cầu có giá trị ${fmtMoney(d.amount)}. Xác nhận phê duyệt?`)) return;
        setBusy(a);
        try {
            await approvals.decide(d.id, { action: a, note: note.trim() || undefined });
            toast.push('success', DONE[a][0], `${d.code}. ${DONE[a][1]}`);
            setNote('');
            await load(); onChanged();
        } catch (e) { toast.push('error', 'Chưa xử lý được', errMsg(e)); }
        finally { setBusy(null); }
    };

    const sendComment = async () => {
        if (!d || cmt.trim().length < 2) return;
        try { await approvals.comment(d.id, cmt.trim()); setCmt(''); await load(); toast.push('success', 'Đã thêm ghi chú'); }
        catch (e) { toast.push('error', 'Chưa gửi được ghi chú', errMsg(e)); }
    };

    if (id === null) {
        return <div className={s.emptyDetail}><Icon name="inbox" size={40} /><h2>Chọn một yêu cầu</h2><p>Nội dung, hồ sơ đính kèm và lịch sử xử lý sẽ hiện ở đây.</p></div>;
    }
    if (err) return <div className={s.emptyDetail} role="alert"><h2>Không mở được yêu cầu</h2><p>{err}</p><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={load}>Thử lại</button></div>;
    if (!d) return <div className={s.skelDoc} aria-busy="true" />;

    const sla = slaText(d);
    const decidedOn = d.decided_at ? fmtD(d.decided_at) : '';

    return (
        <div className={s.detailPane}>
            <button type="button" className={s.backBtn} onClick={onClose}>← Quay lại danh sách</button>
            <article className={s.doc}>
                <header className={s.docHead}>
                    <div className={s.docHeadMain}>
                        <div className={s.docTop}>
                            <span className={s.docCode}>{d.code}</span>
                            <span className={s.chipType}><Icon name={TYPE_ICON[d.icon] ?? 'doc'} size={14} />{d.type_name}</span>
                        </div>
                        <h2 className={s.docTitle}>{d.title}</h2>
                        <div className={s.docMeta}>
                            <span className={`${s.badge} ${s['badge_' + d.status]}`}>{STATUS_LABEL[d.status]}</span>
                            <span className={`${s.pri} ${s['pri_' + d.priority]}`}>{PRIORITY_LABEL[d.priority]}</span>
                            {d.status === 'pending' && <span className={s.level}>{LEVEL_LABEL[d.current_level]}</span>}
                            {sla.tone !== 'none' && <span className={`${s.sla} ${s['sla_' + sla.tone]}`}><Icon name="clock" size={13} />{sla.text}</span>}
                        </div>
                    </div>
                    {(d.status === 'approved' || d.status === 'rejected' || d.status === 'returned') && <Seal status={d.status} date={decidedOn} />}
                </header>

                <section className={s.people}>
                    <span className={s.avatar}>{initials(d.requester_name)}</span>
                    <div>
                        <b className={s.pName}>{d.requester_name}</b>
                        <div className={s.pInfo}>{KIND_LABEL[d.requester_kind] ?? 'Người đề nghị'}{d.requester_info ? `, ${d.requester_info}` : ''}</div>
                    </div>
                    <div className={s.pDate}>Gửi lúc {fmtDT(d.created_at)}</div>
                </section>

                {d.amount !== null && <div className={s.amountBox}><span>Giá trị đề nghị</span><b>{fmtMoney(d.amount)}</b></div>}

                {d.payload.length > 0 && (
                    <dl className={s.fields}>
                        {d.payload.map((f, i) => <div key={i} className={s.fieldItem}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}
                    </dl>
                )}

                {d.description && <section><h3 className={s.secTitle}>Nội dung đề nghị</h3><p className={s.desc}>{d.description}</p></section>}

                {d.attachments.length > 0 && (
                    <section><h3 className={s.secTitle}>Hồ sơ đính kèm</h3>
                        <ul className={s.files}>{d.attachments.map((a) => <li key={a.id}><Icon name="doc" size={15} /><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.size_kb ? <span className={s.muted}>{a.size_kb} KB</span> : null}</li>)}</ul>
                    </section>
                )}

                {d.decision_note && d.status !== 'pending' && (
                    <blockquote className={s.opinion}>
                        <span className={s.opinionLabel}>Ý kiến chỉ đạo{d.decided_by_name ? `, ${d.decided_by_name}` : ''}</span>
                        {d.decision_note}
                    </blockquote>
                )}

                <section>
                    <h3 className={s.secTitle}>Lịch sử xử lý</h3>
                    <ol className={s.timeline}>
                        {d.events.map((e) => (
                            <li key={e.id} className={`${s.tlItem} ${s['tl_' + e.action]}`}>
                                <span className={s.tlDot} />
                                <div>
                                    <b>{ACTION_LABEL[e.action] ?? e.action}</b> <span className={s.muted}>{e.actor_name}, {fmtDT(e.created_at)}</span>
                                    {e.note && <p className={s.tlNote}>{e.note}</p>}
                                </div>
                            </li>
                        ))}
                    </ol>
                    <div className={s.commentRow}>
                        <input value={cmt} maxLength={1000} placeholder="Thêm ghi chú trao đổi nội bộ" onChange={(e) => setCmt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }} aria-label="Ghi chú" />
                        <button type="button" className={s.btn} onClick={sendComment} disabled={cmt.trim().length < 2}><Icon name="chat" size={15} />Gửi</button>
                    </div>
                </section>
            </article>

            {d.status === 'pending' && (
                d.can_decide ? (
                    <div className={s.decision}>
                        <div className={s.decisionTop}>
                            <b>Ý kiến chỉ đạo</b>
                            <div className={s.tplTabs} role="tablist" aria-label="Mẫu ý kiến">
                                {KINDS.map((k) => <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} className={`${s.tplTab} ${kind === k.key ? s.tplTabOn : ''}`} onClick={() => setKind(k.key)}>{k.label}</button>)}
                            </div>
                        </div>
                        <div className={s.tplChips}>
                            {(tpl[kind] ?? []).map((t) => <button key={t} type="button" className={s.tplChip} onClick={() => setNote(t)}>{t}</button>)}
                        </div>
                        <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi ý kiến (bắt buộc khi từ chối hoặc trả lại)" aria-label="Ý kiến chỉ đạo" />
                        <div className={s.decisionActs}>
                            <button type="button" className={`${s.btn} ${s.btnDanger}`} disabled={!!busy} onClick={() => act('reject')}><Icon name="x" size={16} />Từ chối</button>
                            <button type="button" className={`${s.btn} ${s.btnWarn}`} disabled={!!busy} onClick={() => act('return')}><Icon name="undo" size={16} />Trả lại</button>
                            {d.actions.includes('forward') && <button type="button" className={s.btn} disabled={!!busy} onClick={() => act('forward')}><Icon name="forward" size={16} />Chuyển Hiệu trưởng</button>}
                            <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnGrow}`} disabled={!!busy} onClick={() => act('approve')}><Icon name="check" size={16} />{busy === 'approve' ? 'Đang xử lý…' : 'Phê duyệt'}</button>
                        </div>
                    </div>
                ) : (
                    <div className={s.banner}><Icon name="shield" size={18} />Yêu cầu này thuộc cấp Hiệu trưởng{me?.role === 'vice_principal' ? '. Bạn chưa được ủy quyền, hãy ghi ý kiến cho Hiệu trưởng.' : '.'}</div>
                )
            )}
        </div>
    );
}