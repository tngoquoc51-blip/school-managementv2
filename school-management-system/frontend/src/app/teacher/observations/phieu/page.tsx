'use client';
// Phiếu đánh giá tiết dạy (/teacher/observations/phieu) – danh sách tiết cần điền + trình soạn phiếu theo tiêu chí
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Btn, Confirm, Crit, Empty, ErrorBox, Ico, Loading, RATING, Rating, RatingPill, SCORE, Session, SessionDrawer, SessionRow, Tabs, calcPercent, dt, longDate, ob, ratingOf, slotText, useLoad, useTa, Ring } from '../_ob';

type Res = { counts: Record<string, number>; data: Session[] };
type Form = {
    session: Session; template: { id: number; name: string }; criteria: Crit[]; locked: boolean;
    eval: { id: number; status: 'draft' | 'submitted'; strengths: string | null; weaknesses: string | null; suggestions: string | null; percent: number | null; rating: Rating | null; submitted_at: string | null; ack_at: string | null } | null;
};
type Sc = Record<number, { score: number | null; note: string }>;

function Editor({ sid }: { sid: number }) {
    const { toast, refresh } = useTa(); const router = useRouter(); const { data, err, loading, reload } = useLoad(() => ob<Form>(`sessions/${sid}/form`), [sid]);
    const [sc, setSc] = useState<Sc>({}); const [str, setStr] = useState(''); const [weak, setWeak] = useState(''); const [sug, setSug] = useState(''); const [dirty, setDirty] = useState(false);
    const [saved, setSaved] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [ask, setAsk] = useState(false); const [openNote, setOpenNote] = useState<Record<number, boolean>>({});
    useEffect(() => {
        if (!data) return; const m: Sc = {}; data.criteria.forEach((c) => { m[c.id] = { score: c.score, note: c.note || '' }; });
        setSc(m); setStr(data.eval?.strengths || ''); setWeak(data.eval?.weaknesses || ''); setSug(data.eval?.suggestions || ''); setDirty(false);
        setOpenNote(Object.fromEntries(data.criteria.filter((c) => c.note).map((c) => [c.id, true]))); setSaved(data.eval ? dt(data.eval.submitted_at) : null);
    }, [data]);
    const crit = data?.criteria || []; const locked = !!data?.locked;
    const percent = useMemo(() => calcPercent(crit.map((c) => ({ score: sc[c.id]?.score ?? null, weight: c.weight }))), [crit, sc]);
    const scored = crit.filter((c) => sc[c.id]?.score != null).length; const need = Math.max(1, Math.ceil(crit.length * 0.7)); const rating = ratingOf(percent);
    const payload = useCallback((submit: boolean) => ({ scores: crit.map((c) => ({ criterion_id: c.id, score: sc[c.id]?.score ?? null, note: sc[c.id]?.note || '' })), strengths: str, weaknesses: weak, suggestions: sug, submit }), [crit, sc, str, weak, sug]);
    const save = useCallback(async (submit: boolean, silent = false) => {
        setBusy(true); setError('');
        try { const r = await ob<{ message: string }>(`sessions/${sid}/eval`, { method: 'PUT', body: payload(submit) }); setDirty(false); setSaved(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })); if (!silent) toast(r.message); refresh(); if (submit) router.push('/teacher/observations/phieu'); }
        catch (e) { if (!silent) setError((e as Error).message); }
        setBusy(false);
    }, [payload, sid, toast, refresh, router]);
    const ref = useRef(save); ref.current = save;
    useEffect(() => { if (!dirty || locked) return; const t = setInterval(() => { ref.current(false, true); }, 30000); return () => clearInterval(t); }, [dirty, locked]);
    useEffect(() => { if (!dirty) return; const f = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f); }, [dirty]);

    if (loading && !data) return <Loading />;
    if (err || !data) return <><div style={{ marginBottom: 12 }}><Link href="/teacher/observations/phieu" className="ta-link">← Danh sách phiếu</Link></div><ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /></>;
    const s = data.session; const groups: { g: string; items: Crit[] }[] = []; crit.forEach((c) => { const last = groups[groups.length - 1]; if (last && last.g === c.group) last.items.push(c); else groups.push({ g: c.group, items: [c] }); });
    const set = (id: number, v: Partial<{ score: number | null; note: string }>) => { setSc({ ...sc, [id]: { score: sc[id]?.score ?? null, note: sc[id]?.note ?? '', ...v } }); setDirty(true); };
    return (
        <>
            <div className="ob-row2" style={{ marginBottom: 12 }}><Link href="/teacher/observations/phieu" className="ta-link">← Danh sách phiếu</Link></div>
            <div className="ta-card" style={{ padding: 16, marginBottom: 16 }}>
                <div className="ob-row2"><h2 style={{ fontSize: 18, fontWeight: 800 }}>{s.title}</h2>{s.status === 'completed' && <RatingPill rating={data.eval?.rating || null} percent={data.eval?.percent} />}</div>
                <p className="ta-mute" style={{ marginTop: 4 }}>Giáo viên {s.observed_name}{s.subject ? ` · ${s.subject}` : ''}{s.class_name ? ` · lớp ${s.class_name}` : ''} · {slotText(s)} · {longDate(s.lesson_date)} · {data.template.name}</p>
                {s.objective && <div className="ob-note sky" style={{ marginTop: 10 }}><Ico n="eye" size={16} /><span>Cần quan sát: {s.objective}</span></div>}
                {locked && <div className="ob-note amber" style={{ marginTop: 10 }}><Ico n="lock" size={16} /><span>Giáo viên được dự đã xem và tiếp thu phiếu này ({dt(data.eval?.ack_at)}) nên không sửa được nữa.</span></div>}
            </div>
            <div className="ob-ed">
                <div>
                    {groups.map((g) => (
                        <div key={g.g} className="ob-grp"><h4><span>{g.g}</span><small className="ta-mute">{g.items.filter((c) => sc[c.id]?.score != null).length}/{g.items.length} đã chấm</small></h4>
                            {g.items.map((c) => { const cur = sc[c.id]?.score ?? null; return (
                                <div key={c.id} className="ob-cr"><div className="ob-cr-h"><div style={{ flex: 1, minWidth: 220 }}><b>{c.name}</b>{c.hint && <small>{c.hint}</small>}{c.weight !== 1 && <small> · trọng số ×{c.weight}</small>}</div>
                                    <div className="ob-sc" role="radiogroup" aria-label={c.name}>{SCORE.map((o) => <button key={o.v} type="button" disabled={locked} className={cur === o.v ? 'on' : ''} style={{ ['--c' as string]: o.c }} aria-checked={cur === o.v} onClick={() => set(c.id, { score: cur === o.v ? null : o.v })}>{o.v}<small>{o.label}</small></button>)}</div></div>
                                    {openNote[c.id] ? <textarea rows={2} maxLength={500} disabled={locked} placeholder="Ghi chú minh chứng cho tiêu chí này (không bắt buộc)" value={sc[c.id]?.note || ''} onChange={(e) => set(c.id, { note: e.target.value })} /> : !locked && <button type="button" className="ob-link" onClick={() => setOpenNote({ ...openNote, [c.id]: true })}>+ Ghi chú</button>}
                                </div>); })}
                        </div>))}
                    <div className="ta-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
                        <label className="ta-field"><span>Ưu điểm nổi bật *</span><textarea rows={3} disabled={locked} maxLength={4000} value={str} onChange={(e) => { setStr(e.target.value); setDirty(true); }} placeholder="Những điểm làm tốt của tiết dạy…" /></label>
                        <label className="ta-field"><span>Hạn chế cần khắc phục</span><textarea rows={3} disabled={locked} maxLength={4000} value={weak} onChange={(e) => { setWeak(e.target.value); setDirty(true); }} placeholder="Những điểm cần cải thiện…" /></label>
                        <label className="ta-field"><span>Góp ý / đề xuất cải tiến *</span><textarea rows={3} disabled={locked} maxLength={4000} value={sug} onChange={(e) => { setSug(e.target.value); setDirty(true); }} placeholder="Gợi ý cụ thể để đồng nghiệp áp dụng ở các tiết sau…" /></label>
                    </div>
                </div>
                <aside className="ob-ed-side">
                    <div className="ta-card ob-live" style={{ padding: 18 }}>
                        <Ring value={percent ?? 0} size={120} tone={rating ? RATING[rating].tone : 'gray'} label="điểm" />
                        <div style={{ marginTop: 10 }}>{rating ? <RatingPill rating={rating} percent={percent} /> : <span className="ta-mute">Chưa chấm tiêu chí nào</span>}</div>
                        <p className="ta-mute" style={{ margin: '10px 0 6px' }}>Đã chấm {scored}/{crit.length} tiêu chí (tối thiểu {need} để nộp)</p><Bar value={(scored / Math.max(1, crit.length)) * 100} tone={scored >= need ? 'green' : 'amber'} slim />
                    </div>
                    <div className="ta-card" style={{ padding: 16 }}>
                        <p style={{ fontSize: 12.5, color: 'var(--mute)', marginBottom: 8 }}>Thang điểm mỗi tiêu chí: 1 Chưa đạt · 2 Đạt · 3 Khá · 4 Tốt. Xếp loại chung: ≥85% Tốt · ≥70% Khá · ≥50% Đạt · còn lại Chưa đạt.</p>
                        {error && <p className="ta-ferr" style={{ marginBottom: 8 }}>{error}</p>}
                        <div style={{ display: 'grid', gap: 8 }}><Btn busy={busy} disabled={locked || !dirty} onClick={() => save(false)}><Ico n="save" size={15} />Lưu nháp</Btn><Btn tone="primary" busy={busy} disabled={locked} onClick={() => setAsk(true)}><Ico n="send" size={15} />{data.eval?.status === 'submitted' ? 'Nộp lại phiếu' : 'Nộp phiếu'}</Btn></div>
                        <p className="ob-save" style={{ marginTop: 8 }}>{dirty ? 'Có thay đổi chưa lưu · tự lưu nháp mỗi 30 giây' : saved ? `Đã lưu ${saved}` : 'Chưa lưu'}</p>
                    </div>
                </aside>
            </div>
            {ask && <Confirm title="Nộp phiếu nhận xét?" tone="primary" okText="Nộp phiếu" text={<>Điểm tổng hợp: <b>{percent ?? 0}%</b>{rating ? ` – ${rating}` : ''}. Giáo viên {s.observed_name} sẽ nhận thông báo. Bạn vẫn sửa được cho đến khi họ xem phiếu.</>} onClose={() => setAsk(false)} onOk={async () => { setAsk(false); await save(true); }} />}
        </>
    );
}

function List() {
    const router = useRouter(); const [tab, setTab] = useState<'todo' | 'soon' | 'submitted'>('todo'); const [open, setOpen] = useState<number | null>(null);
    const q = tab === 'todo' ? 'eval=todo' : tab === 'submitted' ? 'eval=submitted' : 'status=open';
    const { data, err, loading, reload } = useLoad(() => ob<Res>(`sessions?scope=observe&per=50&${q}`), [tab]);
    const todo = useLoad(() => ob<Res>('sessions?scope=observe&per=5&eval=todo'), []);
    const list = (data?.data || []).filter((s) => (tab === 'soon' ? !s.can_evaluate && s.me.observer && s.phase !== 'past' : true));
    return (
        <div className="ta-page">
            <Tabs value={tab} onChange={setTab} items={[{ key: 'todo', label: 'Cần điền phiếu', count: todo.data?.data.length, tone: 'rose' }, { key: 'soon', label: 'Sắp dự giờ' }, { key: 'submitted', label: 'Đã nộp' }]} />
            <div className="ta-card">
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : list.length === 0 ? <Empty icon="pen" title={tab === 'todo' ? 'Không có phiếu nào cần điền' : tab === 'soon' ? 'Chưa có buổi dự giờ sắp tới' : 'Bạn chưa nộp phiếu nào'} text={tab === 'todo' ? 'Phiếu xuất hiện ở đây từ ngày dự giờ.' : undefined} /> : list.map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}><div style={{ flex: 1, minWidth: 0 }}><SessionRow s={s} onOpen={() => (s.can_evaluate ? router.push(`/teacher/observations/phieu?session=${s.id}`) : setOpen(s.id))} /></div>
                        {s.can_evaluate && <div style={{ padding: '0 16px' }}><Link href={`/teacher/observations/phieu?session=${s.id}`} className="ta-btn primary">{s.me.eval_status === 'submitted' ? 'Xem / sửa' : s.me.eval_status === 'draft' ? 'Tiếp tục' : 'Điền phiếu'}</Link></div>}</div>))}
            </div>
            <p className="ta-mute">Mỗi người dự giờ có phiếu riêng. Giáo viên được dự chỉ xem phiếu sau khi bạn nộp.</p>
            {open !== null && <SessionDrawer id={open} onClose={() => setOpen(null)} onChange={reload} />}
        </div>
    );
}
function Inner() { const sp = useSearchParams(); const sid = Number(sp.get('session') || 0); return sid > 0 ? <div className="ta-page"><Editor sid={sid} /></div> : <List />; }
export default function Page() { return <Suspense fallback={<div className="ta-page"><Loading /></div>}><Inner /></Suspense>; }