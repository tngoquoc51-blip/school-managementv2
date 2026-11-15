'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { emuApi, errMsg } from '../awardsService';
import type { Ctx, Proposal, ProposalStatus, SuggestionItem } from '../types';
import { cx, fmtDateTime, levelLabel, semLabel } from '../utils';
import Icon from './icons';
import { Modal, useConfirm } from './Overlay';
import { useToast } from './Toast';
import { Avatar, Empty, Field } from './ui';

const COLS: { key: string; label: string; statuses: ProposalStatus[]; color: string }[] = [
    { key: 'draft', label: 'Nháp', statuses: ['draft'], color: 'var(--ink-3)' },
    { key: 'submitted', label: 'Chờ BGH duyệt', statuses: ['submitted'], color: 'var(--info)' },
    { key: 'approved', label: 'Đã được duyệt', statuses: ['approved'], color: 'var(--ok)' },
    { key: 'rejected', label: 'Bị từ chối / Đã hủy', statuses: ['rejected', 'cancelled'], color: 'var(--danger)' },
];

export default function ProposalsTab({ ctx, proposeFor, clearPropose }: { ctx: Ctx; proposeFor: number | null; clearPropose: () => void }) {
    const { meta, scope, students, refresh, tick } = ctx;
    const toast = useToast();
    const confirm = useConfirm();
    const [sub, setSub] = useState<'suggest' | 'flow'>('suggest');
    const [sug, setSug] = useState<SuggestionItem[] | null>(null);
    const [props, setProps] = useState<Proposal[] | null>(null);
    const [picked, setPicked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [manual, setManual] = useState<{ student_id: number; award_id: number; reason: string } | null>(null);
    const [editing, setEditing] = useState<Proposal | null>(null);
    const [reason, setReason] = useState('');
    const [reviewing, setReviewing] = useState<Proposal | null>(null);
    const [rv, setRv] = useState({ decision: 'approved' as 'approved' | 'rejected', note: '', no: '' });

    const load = useCallback(async () => {
        try {
            const [s, p] = await Promise.all([emuApi.suggestions(scope), emuApi.proposals(scope)]);
            setSug(s); setProps(p);
        } catch (e) { toast.error('Không tải được dữ liệu khen thưởng', errMsg(e)); }
    }, [scope, toast]);
    useEffect(() => { load(); }, [load, tick]);
    useEffect(() => { setPicked([]); }, [scope.semester]);

    useEffect(() => {
        if (proposeFor) {
            setManual({ student_id: proposeFor, award_id: meta.awards[0]?.id ?? 0, reason: '' });
            setSub('flow'); clearPropose();
        }
    }, [proposeFor, meta.awards, clearPropose]);

    const groups = useMemo(() => {
        const g = new Map<number, { name: string; level: string; items: SuggestionItem[] }>();
        sug?.forEach((s) => { if (!g.has(s.award_id)) g.set(s.award_id, { name: s.award_name, level: s.award_level, items: [] }); g.get(s.award_id)!.items.push(s); });
        return Array.from(g.entries());
    }, [sug]);

    const key = (s: SuggestionItem) => `${s.student.id}:${s.award_id}`;
    const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
    const drafts = props?.filter((p) => p.status === 'draft') ?? [];

    const create = async (items: { student_id: number; award_id: number; reason?: string }[]) => {
        if (!items.length) return;
        setBusy(true);
        try {
            const r = await emuApi.addProposals(scope, items);
            toast.success(`Đã lập ${r.created} đề xuất`, r.skipped ? `${r.skipped} trường hợp đã có từ trước nên được bỏ qua.` : 'Kiểm tra lý do rồi gửi Ban giám hiệu duyệt.');
            setPicked([]); setManual(null); setSub('flow'); refresh();
        } catch (e) { toast.error('Không lập được đề xuất', errMsg(e)); }
        finally { setBusy(false); }
    };

    const submit = async (ids: number[]) => {
        if (!ids.length) return;
        setBusy(true);
        try {
            const r = await emuApi.submitProposals(scope, ids);
            toast.success(`Đã gửi ${r.submitted} đề xuất`, 'Ban giám hiệu sẽ xem xét và phản hồi.'); refresh();
        } catch (e) { toast.error('Không gửi được', errMsg(e)); }
        finally { setBusy(false); }
    };

    const run = async (fn: () => Promise<unknown>, ok: string) => {
        try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error('Thao tác thất bại', errMsg(e)); }
    };

    const stepOf = (s: ProposalStatus) => (s === 'draft' ? 1 : s === 'submitted' ? 2 : s === 'approved' || s === 'rejected' ? 3 : 0);

    return (
        <div className="emu-page">
            <div className="emu-row emu-wrap">
                <div className="emu-seg">
                    <button className={cx(sub === 'suggest' && 'on')} onClick={() => setSub('suggest')}><Icon name="sparkles" size={13} /> Gợi ý tự động {sug ? `(${sug.filter((s) => !s.already).length})` : ''}</button>
                    <button className={cx(sub === 'flow' && 'on')} onClick={() => setSub('flow')}><Icon name="list" size={13} /> Quy trình đề xuất {props ? `(${props.length})` : ''}</button>
                </div>
                <span className="emu-badge brand">{semLabel(scope.semester)}</span>
                <span className="emu-spacer" />
                <button className="emu-btn" onClick={() => setManual({ student_id: students[0]?.id ?? 0, award_id: meta.awards[0]?.id ?? 0, reason: '' })}><Icon name="plus" /> Đề xuất thủ công</button>
                {sub === 'flow' && <button className="emu-btn primary" disabled={!drafts.length || busy} onClick={async () => { if (await confirm({ title: `Gửi ${drafts.length} đề xuất cho Ban giám hiệu?`, message: 'Sau khi gửi, bạn không thể sửa nội dung cho đến khi BGH phản hồi.', confirmText: 'Gửi duyệt' })) submit(drafts.map((d) => d.id)); }}><Icon name="send" /> Gửi tất cả bản nháp ({drafts.length})</button>}
            </div>

            {sub === 'suggest' && (
                <>
                    {!sug && <div className="emu-card"><div className="emu-card-b"><div className="emu-skel" style={{ height: 120 }} /></div></div>}
                    {sug && groups.length === 0 && <div className="emu-card"><Empty icon="trophy" title="Chưa có học sinh đạt điều kiện" text="Hãy chấm điểm thi đua, cập nhật điểm số hoặc đổi sang học kỳ khác. Bạn vẫn có thể đề xuất thủ công." /></div>}
                    {picked.length > 0 && (
                        <div className="emu-card" style={{ position: 'sticky', top: -8, zIndex: 5, borderColor: 'var(--brand)' }}>
                            <div className="emu-row" style={{ padding: '10px 16px' }}><b>{picked.length} đề xuất được chọn</b><span className="emu-spacer" /><button className="emu-btn ghost sm" onClick={() => setPicked([])}>Bỏ chọn</button>
                                <button className="emu-btn primary sm" disabled={busy} onClick={() => create(picked.map((k) => { const [s, a] = k.split(':').map(Number); return { student_id: s, award_id: a }; }))}><Icon name="check" size={14} /> Lập đề xuất</button></div>
                        </div>
                    )}
                    {groups.map(([awardId, g]) => {
                        const open = g.items.filter((i) => !i.already);
                        return (
                            <div key={awardId} className="emu-card">
                                <div className="emu-award-head">
                                    <div className="emu-award-ic"><Icon name="trophy" size={20} /></div>
                                    <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{g.name}</b><div className="emu-muted" style={{ fontSize: 12 }}>{levelLabel(g.level)} · {g.items.length} học sinh đạt điều kiện</div></div>
                                    <button className="emu-btn sm" disabled={!open.length || busy} onClick={() => create(open.map((i) => ({ student_id: i.student.id, award_id: i.award_id })))}>Lập cho tất cả ({open.length})</button>
                                </div>
                                {g.items.map((it) => (
                                    <div key={key(it)} className="emu-sug" style={{ opacity: it.already ? .55 : 1 }}>
                                        <input type="checkbox" className="emu-check" style={{ marginTop: 10 }} disabled={it.already} checked={picked.includes(key(it))} onChange={() => toggle(key(it))} />
                                        <Avatar name={it.student.full_name} size="sm" />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="emu-row"><b>{it.student.full_name}</b><span className="emu-muted" style={{ fontSize: 12 }}>{it.student.code} · hạng #{it.student.rank}</span>{it.already && <span className="emu-badge ok"><Icon name="check" size={11} /> Đã lập</span>}</div>
                                            <div className="emu-checks">{it.checks.map((c) => <span key={c.label} className="emu-check-pill"><Icon name="check" size={11} />{c.label} · <b>{c.value ?? '—'}</b></span>)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </>
            )}

            {sub === 'flow' && (
                <div className="emu-kanban">
                    {COLS.map((col) => {
                        const list = props?.filter((p) => col.statuses.includes(p.status)) ?? [];
                        return (
                            <div key={col.key} className="emu-kcol">
                                <header><i className="emu-dot" style={{ background: col.color }} />{col.label}<span className="emu-badge" style={{ marginLeft: 'auto' }}>{list.length}</span></header>
                                {list.length === 0 && <div className="emu-muted" style={{ textAlign: 'center', padding: '18px 0', fontSize: 12.5 }}>Trống</div>}
                                {list.map((p) => (
                                    <div key={p.id} className="emu-kcard">
                                        <div className="emu-row"><Avatar name={p.student_name} size="sm" /><div style={{ flex: 1, minWidth: 0 }}><b className="emu-clip" style={{ display: 'block' }}>{p.student_name}</b><span className="emu-muted" style={{ fontSize: 11.5 }}>{p.student_code}</span></div></div>
                                        <div className="emu-row"><span className="emu-badge gold"><Icon name="trophy" size={11} /> {p.award_name}</span>{p.status === 'cancelled' && <span className="emu-badge">Đã hủy</span>}</div>
                                        <p>{p.reason}</p>
                                        <div className="emu-steps">{[1, 2, 3].map((n) => <i key={n} className={cx(stepOf(p.status) >= n && 'on')} />)}</div>
                                        <div className="emu-muted" style={{ fontSize: 11 }}>
                                            {p.status === 'draft' && `Tạo ${fmtDateTime(p.created_at)}`}
                                            {p.status === 'submitted' && `Gửi ${fmtDateTime(p.submitted_at)}`}
                                            {p.status === 'approved' && <>BGH {p.reviewed_by_name} duyệt {fmtDateTime(p.reviewed_at)}{p.decision_no ? ` · QĐ ${p.decision_no}` : ''}</>}
                                            {p.status === 'rejected' && <span className="emu-neg">Lý do: {p.review_note}</span>}
                                        </div>
                                        <div className="emu-row emu-wrap" style={{ gap: 6 }}>
                                            {(p.status === 'draft' || p.status === 'rejected') && <>
                                                <button className="emu-btn sm" onClick={() => { setEditing(p); setReason(p.reason ?? ''); }}><Icon name="edit" size={13} /> Sửa</button>
                                                <button className="emu-btn primary sm" disabled={busy} onClick={() => submit([p.id])}><Icon name="send" size={13} /> Gửi</button>
                                            </>}
                                            {p.status === 'submitted' && meta.actor.can_review && <button className="emu-btn gold sm" onClick={() => { setReviewing(p); setRv({ decision: 'approved', note: '', no: '' }); }}><Icon name="shield" size={13} /> Duyệt</button>}
                                            {(p.status === 'draft' || p.status === 'submitted') && <button className="emu-btn danger sm" onClick={async () => { if (await confirm({ title: 'Hủy đề xuất này?', message: `${p.student_name} · ${p.award_name}`, confirmText: 'Hủy đề xuất', tone: 'danger' })) run(() => emuApi.cancelProposal(scope, p.id), 'Đã hủy đề xuất'); }}>Hủy</button>}
                                            {(p.status === 'draft' || p.status === 'cancelled') && <button className="emu-btn ghost danger sm icon" title="Xóa" onClick={async () => { if (await confirm({ title: 'Xóa vĩnh viễn?', message: 'Không thể khôi phục đề xuất đã xóa.', confirmText: 'Xóa', tone: 'danger' })) run(() => emuApi.deleteProposal(scope, p.id), 'Đã xóa đề xuất'); }}><Icon name="trash" size={13} /></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal open={!!manual} onClose={() => setManual(null)} title="Đề xuất khen thưởng thủ công" subtitle={`${semLabel(scope.semester)} · lớp ${meta.class.name}`}
                   footer={<><button className="emu-btn" onClick={() => setManual(null)}>Hủy</button><button className="emu-btn primary" disabled={busy || !manual?.student_id || !manual?.award_id} onClick={() => manual && create([{ student_id: manual.student_id, award_id: manual.award_id, reason: manual.reason }])}>Lập đề xuất</button></>}>
                <Field label="Học sinh"><select className="emu-select" value={manual?.student_id ?? 0} onChange={(e) => manual && setManual({ ...manual, student_id: Number(e.target.value) })}>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.code})</option>)}</select></Field>
                <Field label="Danh hiệu"><select className="emu-select" value={manual?.award_id ?? 0} onChange={(e) => manual && setManual({ ...manual, award_id: Number(e.target.value) })}>{meta.awards.map((a) => <option key={a.id} value={a.id}>{a.name} — {levelLabel(a.level)}</option>)}</select></Field>
                <Field label="Lý do / thành tích nổi bật" hint="Để trống, hệ thống tự điền theo điểm thi đua, ĐTB và hạnh kiểm."><textarea className="emu-textarea" maxLength={500} value={manual?.reason ?? ''} onChange={(e) => manual && setManual({ ...manual, reason: e.target.value })} /></Field>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title="Sửa lý do đề xuất" subtitle={editing ? `${editing.student_name} · ${editing.award_name}` : ''}
                   footer={<><button className="emu-btn" onClick={() => setEditing(null)}>Hủy</button><button className="emu-btn primary" disabled={!reason.trim()} onClick={() => editing && run(() => emuApi.editProposal(scope, editing.id, reason.trim()), 'Đã cập nhật đề xuất').then(() => setEditing(null))}>Lưu</button></>}>
                <textarea className="emu-textarea" style={{ minHeight: 120 }} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Modal>

            <Modal open={!!reviewing} onClose={() => setReviewing(null)} title="Ban giám hiệu xét duyệt" subtitle={reviewing ? `${reviewing.student_name} · ${reviewing.award_name}` : ''}
                   footer={<><button className="emu-btn" onClick={() => setReviewing(null)}>Đóng</button><button className={cx('emu-btn', rv.decision === 'approved' ? 'gold' : 'danger solid')} onClick={() => reviewing && run(() => emuApi.review(scope, reviewing.id, { decision: rv.decision, note: rv.note, decision_no: rv.no }), rv.decision === 'approved' ? 'Đã duyệt khen thưởng' : 'Đã từ chối đề xuất').then(() => setReviewing(null))}>{rv.decision === 'approved' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</button></>}>
                <p style={{ margin: 0, color: 'var(--ink-2)' }}>{reviewing?.reason}</p>
                <div className="emu-seg"><button className={cx(rv.decision === 'approved' && 'on')} onClick={() => setRv({ ...rv, decision: 'approved' })}>Duyệt</button><button className={cx(rv.decision === 'rejected' && 'on')} onClick={() => setRv({ ...rv, decision: 'rejected' })}>Từ chối</button></div>
                {rv.decision === 'approved' ? <Field label="Số quyết định (nếu có)"><input className="emu-input" maxLength={40} value={rv.no} onChange={(e) => setRv({ ...rv, no: e.target.value })} placeholder="VD: 123/QĐ-THPT" /></Field>
                    : <Field label="Lý do từ chối (bắt buộc)"><textarea className="emu-textarea" maxLength={255} value={rv.note} onChange={(e) => setRv({ ...rv, note: e.target.value })} /></Field>}
            </Modal>
        </div>
    );
}