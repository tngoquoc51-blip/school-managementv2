'use client';
import { useCallback, useEffect, useState } from 'react';
import { ACTIONS, actionLabel, fmtDate, fmtDateTime, SEVERITY, toInputDT } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import type { Appeal, DiscRecord, LogItem, Meta, ScoreInfo } from './types';
import { Badge, Drawer, Field, Icon, RankBadge, SkelRows, StatusBadge, Sev, useUI } from './ui';

type Mode = null | 'reject' | 'approve' | 'resolve' | 'cancel' | 'appeal';

export default function RecordDrawer({ id, meta, onClose, onChanged, openStudent }: {
    id: number; meta: Meta; onClose: () => void; onChanged: () => void; openStudent: (id: number) => void;
}) {
    const { toast, confirm } = useUI();
    const [d, setD] = useState<{ record: DiscRecord; logs: LogItem[]; appeals: Appeal[]; student_score: ScoreInfo; prior_count: number } | null>(null);
    const [mode, setMode] = useState<Mode>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [act, setAct] = useState({ action_type: 'nhac_nho', action_date: toInputDT().slice(0, 10), action_note: '', parent_notified: false });
    const canApprove = meta.permissions.approve;

    const load = useCallback(() => disciplineService.record(id).then((x) => {
        setD(x); setAct((a) => ({ ...a, action_type: x.record.suggested_action || a.action_type }));
    }).catch((e) => { toast('error', 'Không tải được biên bản', errMsg(e)); onClose(); }), [id]);
    useEffect(() => { load(); }, [load]);

    const run = async (fn: () => Promise<any>, okTitle?: string) => {
        setBusy(true);
        try { const r = await fn(); toast('success', okTitle ?? r?.message ?? 'Thành công', okTitle ? r?.message : undefined); setMode(null); setNote(''); await load(); onChanged(); return true; }
        catch (e) { toast('error', 'Thao tác không thành công', errMsg(e)); return false; } finally { setBusy(false); }
    };

    if (!d) return <Drawer title="Biên bản vi phạm" onClose={onClose}><SkelRows n={8} /></Drawer>;
    const r = d.record;
    const pendingAppeal = d.appeals.some((a) => a.status === 'pending');
    const counted = r.status === 'approved' || r.status === 'resolved';

    const del = async () => {
        if (await confirm({ title: 'Xóa biên bản?', text: `Biên bản ${r.code} sẽ bị xóa vĩnh viễn.`, okLabel: 'Xóa', tone: 'danger' }))
            if (await run(() => disciplineService.deleteRecord(r.id))) onClose();
    };

    const footer = (
        <>
            {canApprove && r.status === 'pending' && <>
                <button className="dc-btn ok" onClick={() => setMode('approve')}><Icon n="check" />Duyệt</button>
                <button className="dc-btn danger" onClick={() => setMode('reject')}><Icon n="x" />Từ chối</button>
                <button className="dc-btn ghost" onClick={del}><Icon n="trash" />Xóa</button>
            </>}
            {canApprove && r.status === 'approved' && <button className="dc-btn primary" onClick={() => setMode('resolve')}><Icon n="shield" />Ghi nhận xử lý</button>}
            {canApprove && counted && <button className="dc-btn" onClick={() => setMode('cancel')}>Hủy biên bản</button>}
            {counted && !pendingAppeal && <button className="dc-btn" onClick={() => setMode('appeal')}><Icon n="chat" />Ghi nhận khiếu nại</button>}
            {canApprove && r.status === 'rejected' && <button className="dc-btn ghost" onClick={del}><Icon n="trash" />Xóa</button>}
        </>
    );

    return (
        <Drawer title={r.code} sub={<div style={{ marginTop: 4 }}><StatusBadge s={r.status} /></div>} onClose={onClose} footer={footer}>
            <section className="dc-card"><div className="dc-card-b">
                <div className="dc-item" style={{ padding: 0, border: 0 }}>
                    <div className="grow"><b style={{ fontSize: 16 }}>{r.student_name}</b><small>{r.student_code} · Lớp {r.class_name}</small></div>
                    <button className="dc-btn sm" onClick={() => { openStudent(r.student_id); onClose(); }}>Xem hồ sơ rèn luyện</button>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>Điểm rèn luyện hiện tại: <b>{d.student_score.score}</b></span><RankBadge r={d.student_score.rank} />
                    {d.prior_count > 0 && <Badge tone="warn">Đã vi phạm {d.prior_count} lần trước đó</Badge>}
                </div>
            </div></section>

            {d.prior_count >= meta.settings.repeat_count - 1 && counted &&
                <div className="dc-note bad">Học sinh có dấu hiệu tái phạm. Nên mời phụ huynh làm việc và lập kế hoạch giáo dục riêng.</div>}

            <dl className="dc-kv">
                <dt>Lỗi vi phạm</dt><dd>{r.category_name} <small style={{ color: 'var(--muted)' }}>({r.group_name})</small></dd>
                <dt>Mức độ</dt><dd><Sev n={r.severity} /> {SEVERITY[r.severity]}</dd>
                <dt>Điểm trừ</dt><dd style={{ color: 'var(--bad)' }}>-{r.points}{!counted && ' (chưa tính)'}</dd>
                <dt>Thời gian</dt><dd>{fmtDateTime(r.occurred_at)} · HK{r.semester}</dd>
                <dt>Địa điểm</dt><dd>{r.location || '—'}</dd>
                <dt>Diễn biến</dt><dd style={{ fontWeight: 400 }}>{r.description}</dd>
                <dt>Minh chứng</dt><dd>{r.evidence_note || '—'}</dd>
                <dt>Người ghi nhận</dt><dd>{r.reported_by_name}</dd>
                <dt>Người duyệt</dt><dd>{r.reviewed_by_name ? `${r.reviewed_by_name} · ${fmtDateTime(r.reviewed_at)}` : '—'}</dd>
                {r.review_note && <><dt>Ghi chú duyệt</dt><dd>{r.review_note}</dd></>}
                {r.status === 'resolved' && <>
                    <dt>Hình thức xử lý</dt><dd>{actionLabel(r.action_type)} · {fmtDate(r.action_date)}</dd>
                    <dt>Ghi chú xử lý</dt><dd>{r.action_note || '—'}</dd>
                    <dt>Báo phụ huynh</dt><dd>{r.parent_notified ? 'Đã thông báo' : 'Chưa'}</dd>
                </>}
            </dl>

            {r.status === 'approved' && r.suggested_action && (
                <div className="dc-note info">Hình thức xử lý đề xuất theo quy chế: <b>{actionLabel(r.suggested_action)}</b></div>
            )}

            {mode === 'approve' && <Panel title="Duyệt biên bản" busy={busy} okLabel="Xác nhận duyệt" tone="ok" onCancel={() => setMode(null)}
                                          onOk={() => run(() => disciplineService.review(r.id, 'approve', note))}>
                <Field label="Ghi chú (không bắt buộc)"><input className="dc-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sau khi duyệt, điểm rèn luyện của học sinh bị trừ {r.points} điểm.</p>
            </Panel>}
            {mode === 'reject' && <Panel title="Từ chối biên bản" busy={busy} okLabel="Từ chối" tone="danger" disabled={!note.trim()} onCancel={() => setMode(null)}
                                         onOk={() => run(() => disciplineService.review(r.id, 'reject', note))}>
                <Field label="Lý do từ chối *"><input className="dc-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </Panel>}
            {mode === 'cancel' && <Panel title="Hủy biên bản (hoàn điểm)" busy={busy} okLabel="Hủy biên bản" tone="danger" disabled={note.trim().length < 3} onCancel={() => setMode(null)}
                                         onOk={() => run(() => disciplineService.cancel(r.id, note))}>
                <Field label="Lý do hủy *"><input className="dc-input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </Panel>}
            {mode === 'appeal' && <Panel title="Ghi nhận đơn khiếu nại" busy={busy} okLabel="Tiếp nhận" disabled={note.trim().length < 10} onCancel={() => setMode(null)}
                                         onOk={() => run(() => disciplineService.createAppeal({ record_id: r.id, reason: note }))}>
                <Field label="Nội dung khiếu nại * (tối thiểu 10 ký tự)" hint={`Hạn khiếu nại: ${meta.settings.appeal_days} ngày kể từ ngày duyệt.`}>
                    <textarea className="dc-textarea" value={note} onChange={(e) => setNote(e.target.value)} />
                </Field>
            </Panel>}
            {mode === 'resolve' && <Panel title="Ghi nhận hình thức xử lý" busy={busy} okLabel="Hoàn tất xử lý" onCancel={() => setMode(null)}
                                          onOk={() => run(() => disciplineService.resolve(r.id, act))}>
                <div className="dc-grid2">
                    <Field label="Hình thức *"><select className="dc-select" value={act.action_type} onChange={(e) => setAct({ ...act, action_type: e.target.value })}>
                        {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
                    <Field label="Ngày xử lý *"><input type="date" className="dc-input" value={act.action_date} onChange={(e) => setAct({ ...act, action_date: e.target.value })} /></Field>
                </div>
                <Field label="Ghi chú"><textarea className="dc-textarea" value={act.action_note} onChange={(e) => setAct({ ...act, action_note: e.target.value })} /></Field>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={act.parent_notified} onChange={(e) => setAct({ ...act, parent_notified: e.target.checked })} /> Đã thông báo cho phụ huynh
                </label>
            </Panel>}

            {d.appeals.length > 0 && <section>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>Khiếu nại</h3>
                {d.appeals.map((a) => (
                    <div key={a.id} className="dc-note" style={{ marginBottom: 8, background: a.status === 'pending' ? 'var(--warn-l)' : 'var(--mute-l)', color: 'var(--text)' }}>
                        <b>{a.status === 'pending' ? 'Chờ phản hồi' : a.status === 'accepted' ? 'Đã chấp nhận' : 'Đã bác'}</b> · {fmtDate(a.created_at)}<br />{a.reason}
                        {a.response && <><br /><i>Phản hồi ({a.responded_by_name}): {a.response}</i></>}
                    </div>
                ))}
            </section>}

            <section>
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>Lịch sử xử lý</h3>
                <ul className="dc-timeline" style={{ margin: 0, padding: '0 0 0 18px' }}>
                    {d.logs.map((l) => <li key={l.id}>{l.summary}<small>{l.actor_name} · {fmtDateTime(l.created_at)}</small></li>)}
                </ul>
            </section>
        </Drawer>
    );
}

function Panel({ title, children, onOk, onCancel, okLabel, tone = 'primary', disabled, busy }: {
    title: string; children: React.ReactNode; onOk: () => void; onCancel: () => void; okLabel: string; tone?: string; disabled?: boolean; busy?: boolean;
}) {
    return (
        <section className="dc-card" style={{ borderColor: 'var(--brand)' }}>
            <div className="dc-card-h"><h3>{title}</h3></div>
            <div className="dc-card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {children}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="dc-btn" onClick={onCancel}>Đóng</button>
                    <button className={`dc-btn ${tone}`} disabled={disabled || busy} onClick={onOk}>{busy ? 'Đang xử lý…' : okLabel}</button>
                </div>
            </div>
        </section>
    );
}