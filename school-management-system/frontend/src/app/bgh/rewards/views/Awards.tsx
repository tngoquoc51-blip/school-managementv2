'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Award, AwardType, Meta, Mode, Paged, StudentHit, ViewProps } from '@/modules/bgh/rewards/types';
import { Empty, fdt, fmt, Icon, KIND, Modal, Skeleton, STATUS, useUI } from '../ui';

type Counts = { pending: number; approved: number; rejected: number };

/* ================= Danh sách đề xuất ================= */
export default function Awards({ meta, yearId, rev, openAward, changed, kinds, mode }: ViewProps) {
    const D = mode === 'discipline';
    const { toast, confirm } = useUI();
    const [status, setStatus] = useState('pending');
    const [kind, setKind] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState<{ counts: Counts; page: Paged<Award> } | null>(null);
    const [err, setErr] = useState('');
    const [rv, setRv] = useState<{ a: Award; decision: 'approve' | 'reject' } | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setErr('');
        rewardsApi.awards({ year_id: yearId, status, kind: kind || kinds, page }).then(setData).catch((e) => setErr(errMsg(e)));
    }, [yearId, status, kind, page, rev, kinds]);

    const submitReview = async () => {
        if (!rv || busy) return;
        setBusy(true);
        try {
            const r = await rewardsApi.reviewAward(rv.a.id, rv.decision, note || undefined);
            toast(rv.decision === 'approve' ? 'success' : 'warn', r.message, rv.a.title);
            setRv(null); setNote(''); changed();
        } catch (e) { toast('error', 'Không thể xử lý đề xuất', errMsg(e)); }
        setBusy(false);
    };

    const withdraw = async (a: Award) => {
        if (!(await confirm({ title: 'Rút đề xuất?', danger: true, ok: 'Rút đề xuất', msg: `"${a.title}" sẽ bị xóa khỏi danh sách chờ duyệt.` }))) return;
        try { const r = await rewardsApi.delAward(a.id); toast('success', r.message, a.title); changed(); }
        catch (e) { toast('error', 'Không thể rút đề xuất', errMsg(e)); }
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;

    const tabs: [string, string, number | undefined][] = [
        ['pending', 'Chờ duyệt', data?.counts.pending], ['approved', 'Đã duyệt', data?.counts.approved], ['rejected', 'Từ chối', data?.counts.rejected],
    ];

    return (
        <div className="rw-stack">
            <div className="row">
                <div className="seg">
                    {tabs.map(([k, l, n]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1); }}>{l}{n !== undefined ? ` (${n})` : ''}</button>)}
                </div>
                {D && (
                    <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} aria-label="Hình thức">
                        <option value="">Nhắc nhở & kỷ luật</option><option value="nhac_nho">Nhắc nhở</option><option value="ky_luat">Kỷ luật</option>
                    </select>
                )}
                <span className="spacer" />
                <button className="btn brass" onClick={() => openAward()}><Icon n="plus" s={16} />{D ? 'Lập đề xuất' : 'Đề xuất khen thưởng'}</button>
            </div>

            {!data ? <Skeleton h={240} /> : !data.page.data.length ? (
                <div className="panel"><Empty icon="award" text={D ? 'Không có đề xuất nào ở trạng thái này.' : 'Không có đề xuất khen thưởng nào ở trạng thái này.'} /></div>
            ) : (
                <div className="cards">
                    {data.page.data.map((a) => (
                        <article key={a.id} className={`award k-${a.kind}`}>
                            <div className="row">
                                <span className={`badge ${KIND[a.kind].tone}`}>{KIND[a.kind].label}</span>
                                <span className={`badge ${STATUS[a.status].tone}`}>{STATUS[a.status].label}</span>
                                {a.level && <span className="badge info">Cấp {a.level.toLowerCase()}</span>}
                                {Number(a.bonus_points) > 0 && <span className="badge good">+{fmt(a.bonus_points, 0)} điểm thi đua{a.bonus_applied ? ' · đã cộng' : ''}</span>}
                            </div>
                            <h4>{a.title}</h4>
                            {a.type_name && <div className="hint" style={{ marginTop: -2 }}>Danh hiệu: {a.type_name}</div>}
                            <p>{a.reason}</p>
                            <div className="meta">
                                <span><Icon n={a.target_type === 'class' ? 'users' : 'user'} s={13} /> {a.target_type === 'class' ? `Lớp ${a.class_name || '—'}` : `${a.student_name} (${a.student_code})${a.class_name ? ' · ' + a.class_name : ''}`}</span>
                                {a.period_label && <span>{a.period_label}</span>}
                                <span>Đề xuất: {a.proposed_by_name || '—'} · {fdt(a.created_at)}</span>
                            </div>
                            {a.status !== 'pending' && (
                                <div className="note"><b>{a.reviewed_by_name}</b> · {fdt(a.reviewed_at)}{a.review_note && <><br />{a.review_note}</>}</div>
                            )}
                            {a.status === 'pending' && (
                                <div className="act">
                                    {meta.can.review && <>
                                        <button className="btn primary sm" onClick={() => { setRv({ a, decision: 'approve' }); setNote(''); }}><Icon n="check" s={15} />Phê duyệt</button>
                                        <button className="btn ghost sm" onClick={() => { setRv({ a, decision: 'reject' }); setNote(''); }}><Icon n="x" s={15} />Từ chối</button>
                                    </>}
                                    <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => withdraw(a)}><Icon n="trash" s={15} />Rút lại</button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}

            {data && data.page.last_page > 1 && (
                <div className="pager">
                    <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                    <span>Trang {data.page.current_page}/{data.page.last_page}</span>
                    <button className="btn ghost sm" disabled={page >= data.page.last_page} onClick={() => setPage(page + 1)}>Sau</button>
                </div>
            )}

            {rv && (
                <Modal title={rv.decision === 'approve' ? 'Phê duyệt đề xuất' : 'Từ chối đề xuất'} small onClose={() => setRv(null)}
                       footer={<><button className="btn ghost" onClick={() => setRv(null)}>Hủy</button>
                           <button className={`btn ${rv.decision === 'approve' ? 'primary' : 'danger'}`} disabled={busy || (rv.decision === 'reject' && !note.trim())} onClick={submitReview}>
                               {rv.decision === 'approve' ? 'Phê duyệt' : 'Từ chối'}</button></>}>
                    <p><b>{rv.a.title}</b></p>
                    {rv.decision === 'approve' && Number(rv.a.bonus_points) > 0 && rv.a.target_type === 'class' && (
                        <p className="hint">Khi phê duyệt, hệ thống tự cộng <b>+{fmt(rv.a.bonus_points, 0)} điểm thi đua</b> cho lớp {rv.a.class_name} vào bảng xếp hạng.</p>
                    )}
                    <label className="fld">{rv.decision === 'approve' ? 'Ý kiến của Ban Giám hiệu (không bắt buộc)' : 'Lý do từ chối (bắt buộc)'}
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
                    <p className="hint">Kết quả được gửi vào mục Thông báo của nhà trường và lưu vào nhật ký.</p>
                </Modal>
            )}
        </div>
    );
}

/* ================= Hộp thoại tạo đề xuất ================= */
export function AwardModal({ meta, yearId, classId, mode, onClose, onDone }: {
    meta: Meta; yearId: number; classId?: number; mode: Mode; onClose: () => void; onDone: () => void;
}) {
    const D = mode === 'discipline';
    const { toast } = useUI();
    const [target, setTarget] = useState<'class' | 'student'>('class');
    const [cls, setCls] = useState<string>(classId ? String(classId) : '');
    const [kind, setKind] = useState(D ? 'nhac_nho' : 'khen_thuong');
    const [types, setTypes] = useState<AwardType[]>([]);
    const [typeId, setTypeId] = useState('');
    const [bonus, setBonus] = useState('0');
    const [title, setTitle] = useState('');
    const [reason, setReason] = useState('');
    const [level, setLevel] = useState('Trường');
    const [period, setPeriod] = useState('');
    const [q, setQ] = useState('');
    const [hits, setHits] = useState<StudentHit[]>([]);
    const [stu, setStu] = useState<StudentHit | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (D) return; rewardsApi.awardTypes().then((l) => setTypes(l.filter((t) => t.is_active))).catch(() => setTypes([])); }, []);

    const pickType = (id: string) => {
        setTypeId(id);
        const t = types.find((x) => String(x.id) === id);
        if (t) { setTitle(t.name); setLevel(t.level); setBonus(String(Number(t.bonus_points))); if (t.target_type !== 'both') setTarget(t.target_type); }
    };
    const shownTypes = types.filter((t) => t.target_type === 'both' || t.target_type === target);

    useEffect(() => {
        if (target !== 'student' || stu || q.trim().length < 2) { setHits([]); return; }
        const t = setTimeout(() => rewardsApi.students(q.trim(), yearId).then(setHits).catch(() => setHits([])), 250);
        return () => clearTimeout(t);
    }, [q, target, stu, yearId]);

    const ready = title.trim() && reason.trim() && (target === 'class' ? cls : stu);

    const submit = async () => {
        if (!ready || busy) return;
        setBusy(true);
        try {
            const r = await rewardsApi.addAward({
                year_id: yearId, target_type: target, class_id: target === 'class' ? Number(cls) : undefined,
                student_id: target === 'student' ? stu!.id : undefined, kind, title, reason, level, period_label: period || undefined,
                type_id: !D && typeId ? Number(typeId) : undefined, bonus_points: !D && target === 'class' ? Number(bonus) || 0 : undefined,
            });
            toast('success', 'Đã gửi đề xuất', r.message);
            onDone(); onClose();
        } catch (e) { toast('error', 'Không thể gửi đề xuất', errMsg(e)); setBusy(false); }
    };

    return (
        <Modal title={D ? 'Đề xuất nhắc nhở / kỷ luật' : 'Đề xuất khen thưởng'} onClose={onClose}
               footer={<><button className="btn ghost" onClick={onClose}>Hủy</button><button className="btn primary" disabled={!ready || busy} onClick={submit}>{busy ? 'Đang gửi…' : 'Gửi Ban Giám hiệu'}</button></>}>
            <div className="row">
                <div className="seg">
                    <button className={target === 'class' ? 'on' : ''} onClick={() => setTarget('class')}>Tập thể lớp</button>
                    <button className={target === 'student' ? 'on' : ''} onClick={() => setTarget('student')}>Học sinh</button>
                </div>
                {D && (
                    <div className="seg">
                        <button className={kind === 'nhac_nho' ? 'on' : ''} onClick={() => setKind('nhac_nho')}>Nhắc nhở</button>
                        <button className={kind === 'ky_luat' ? 'on' : ''} onClick={() => setKind('ky_luat')}>Kỷ luật</button>
                    </div>
                )}
            </div>

            {target === 'class' ? (
                <label className="fld">Lớp<select value={cls} onChange={(e) => setCls(e.target.value)}>
                    <option value="">— Chọn lớp —</option>{meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}</select></label>
            ) : (
                <div className="fld">Học sinh
                    {stu ? (
                        <div className="summary row"><b>{stu.full_name}</b> · {stu.code}{stu.class_name && ` · Lớp ${stu.class_name}`}<span className="spacer" /><button className="btn ghost sm" onClick={() => { setStu(null); setQ(''); }}>Đổi</button></div>
                    ) : (
                        <>
                            <input placeholder="Nhập tên hoặc mã học sinh (từ 2 ký tự)…" value={q} onChange={(e) => setQ(e.target.value)} />
                            {!!hits.length && (
                                <div className="sugg">
                                    {hits.map((h) => <button key={h.id} className="li" onClick={() => setStu(h)}><span className="nm">{h.full_name}</span><span className="sb">{h.code}{h.class_name && ` · ${h.class_name}`}</span></button>)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {!D && <label className="fld">Danh hiệu (mẫu có sẵn)
                <select value={typeId} onChange={(e) => pickType(e.target.value)}>
                    <option value="">— Tự nhập —</option>
                    {shownTypes.map((t) => <option key={t.id} value={t.id}>{t.name}{Number(t.bonus_points) > 0 ? ` (+${Number(t.bonus_points)} điểm)` : ''}</option>)}
                </select></label>}
            <label className="fld">Tiêu đề đề xuất<input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder={D ? 'Ví dụ: Nhắc nhở vi phạm nề nếp tuần 12' : 'Ví dụ: Lớp tiên tiến xuất sắc tháng 11'} /></label>
            <div className="grid2">
                <label className="fld">Cấp<select value={level} onChange={(e) => setLevel(e.target.value)}>{['Lớp', 'Khối', 'Trường', 'Cấp trên'].map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="fld">Thời gian áp dụng<input value={period} maxLength={60} onChange={(e) => setPeriod(e.target.value)} placeholder="Tháng 11/2025, HK1…" /></label>
            </div>
            {!D && target === 'class' && (
                <label className="fld">Điểm thưởng thi đua cộng cho lớp khi được duyệt
                    <input type="number" min="0" max="50" step="0.5" value={bonus} onChange={(e) => setBonus(e.target.value)} />
                    <span className="hint">Đặt 0 nếu chỉ ghi nhận, không cộng điểm vào bảng xếp hạng.</span></label>
            )}
            <label className="fld">Lý do / căn cứ<textarea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} placeholder={D ? 'Nêu vi phạm, thời gian, biên bản hoặc số liệu liên quan…' : 'Nêu thành tích, số liệu điểm thi đua liên quan…'} /></label>
        </Modal>
    );
}