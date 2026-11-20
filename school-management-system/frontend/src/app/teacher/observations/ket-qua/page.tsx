'use client';
// Kết quả dự giờ của tôi + Kế hoạch cải tiến (/teacher/observations/ket-qua)
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useState } from 'react';
import { Btn, Card, Confirm, Crit, Donut2, Drawer, Empty, ErrorBox, Field, Ico, Loading, Modal, Pill, RATING, Rating, RatingPill, Session, Tabs, dt, fmtD, longDate, ob, slotText, todayStr, useLoad, useTa } from '../_ob';

type Res = {
    summary: { count: number; avg_percent: number | null; avg_rating: Rating | null; unack: number; given: number; distribution: Record<string, number> };
    groups: { name: string; percent: number; n: number }[]; weakest: { name: string; group: string; percent: number }[]; strongest: { name: string; group: string; percent: number }[];
    years: { id: number; name: string }[];
    data: { id: number; session_id: number; title: string; date: string; subject: string | null; class_name: string | null; kind_label: string; observer: string | null; percent: number; rating: Rating; ack: boolean; actions: number; actions_open: number }[];
};
type Act = { id: number; content: string; due_date: string | null; status: 'open' | 'done'; done_at: string | null; overdue: boolean; session_id: number | null; eval_id: number | null; session_title: string | null };
type ActRes = { counts: { open: number; done: number }; data: Act[] };
type Detail = {
    session: Session; template: { id: number; name: string }; observer: string; criteria: Crit[]; can_ack: boolean;
    eval: { id: number; status: string; strengths: string | null; weaknesses: string | null; suggestions: string | null; percent: number | null; rating: Rating | null; submitted_at: string | null; ack_at: string | null; reply: string | null };
    actions: { id: number; content: string; due_date: string | null; status: string; done_at: string | null }[];
};
const tone = (p: number) => (p >= 85 ? '#059669' : p >= 70 ? '#0284c7' : p >= 50 ? '#d97706' : '#e11d48');

function Trend({ pts }: { pts: { d: string; p: number }[] }) {
    if (pts.length < 2) return <p className="ta-mute" style={{ padding: '30px 0', textAlign: 'center' }}>Cần ít nhất 2 phiếu để vẽ xu hướng.</p>;
    const W = 600, H = 170, px = 28, py = 16; const x = (i: number) => px + (i * (W - px * 2)) / (pts.length - 1); const y = (p: number) => H - py - (p / 100) * (H - py * 2);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.p)}`).join(' ');
    return (
        <svg className="ob-trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Xu hướng điểm dự giờ">
            {[0, 50, 70, 85, 100].map((g) => <g key={g}><line x1={px} x2={W - px} y1={y(g)} y2={y(g)} stroke="#dbe7f1" strokeDasharray="3 4" /><text x={4} y={y(g) + 3} fontSize="9" fill="#5b7388">{g}</text></g>)}
            <path d={path} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.p)} r="4.5" fill="#fff" stroke={tone(p.p)} strokeWidth="2.5"><title>{`${fmtD(p.d)}: ${p.p}%`}</title></circle>)}
        </svg>
    );
}

function ActForm({ init, evalId, onClose, onDone }: { init?: Act; evalId?: number; onClose: () => void; onDone: () => void }) {
    const { toast } = useTa(); const [c, setC] = useState(init?.content || ''); const [d, setD] = useState(init?.due_date || ''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => {
        setBusy(true); setErr('');
        try { const r = await ob<{ message: string }>(init ? `actions/${init.id}` : 'actions', { method: init ? 'PUT' : 'POST', body: { content: c, due_date: d || null, eval_id: evalId } }); toast(r.message); onDone(); onClose(); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title={init ? 'Sửa việc cải tiến' : 'Thêm việc cải tiến'} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}>Lưu</Btn></>}>
            <Field label="Việc cần làm *" hint="Ví dụ: Áp dụng kỹ thuật khăn trải bàn trong 3 tiết tới"><textarea rows={3} maxLength={400} value={c} onChange={(e) => setC(e.target.value)} autoFocus /></Field>
            <Field label="Hạn hoàn thành"><input type="date" min={todayStr()} value={d} onChange={(e) => setD(e.target.value)} /></Field>
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}

function EvalDrawer({ id, onClose, onChange }: { id: number; onClose: () => void; onChange: () => void }) {
    const { toast, refresh } = useTa(); const { data, err, loading, reload } = useLoad(() => ob<Detail>(`evals/${id}/show`), [id]);
    const [reply, setReply] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [add, setAdd] = useState(false);
    const rep = reply ?? data?.eval.reply ?? '';
    const ack = async () => { setBusy(true); try { const r = await ob<{ message: string }>(`evals/${id}/ack`, { method: 'POST', body: { reply: rep } }); toast(r.message); refresh(); onChange(); reload(); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false); };
    const groups: { g: string; items: Crit[] }[] = []; (data?.criteria || []).forEach((c) => { const l = groups[groups.length - 1]; if (l && l.g === c.group) l.items.push(c); else groups.push({ g: c.group, items: [c] }); });
    return (
        <Drawer title={data ? data.session.title : 'Nhận xét dự giờ'} sub={data ? `${data.observer} · ${longDate(data.session.lesson_date)} · ${slotText(data.session)}` : undefined} onClose={onClose}>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Lỗi'} retry={reload} /> : (
                <div className="ob-dr">
                    <div className="ob-sec" style={{ textAlign: 'center' }}><RatingPill rating={data.eval.rating} percent={data.eval.percent} /><p className="ta-mute" style={{ marginTop: 6 }}>{data.template.name} · nộp {dt(data.eval.submitted_at)}</p></div>
                    {groups.map((g) => (
                        <div key={g.g} className="ob-sec"><h4>{g.g}</h4>
                            {g.items.map((c) => <div key={c.id} className="ob-top"><div style={{ flex: 1 }}>{c.name}{c.note && <small className="ta-mute" style={{ display: 'block' }}>“{c.note}”</small>}</div><b className="pc" style={{ color: c.score ? tone(((c.score as number) / 4) * 100) : '#94a3b8' }}>{c.score ?? '—'}/4</b></div>)}
                        </div>))}
                    {data.eval.strengths && <div className="ob-sec"><h4>Ưu điểm</h4><p>{data.eval.strengths}</p></div>}
                    {data.eval.weaknesses && <div className="ob-sec"><h4>Hạn chế</h4><p>{data.eval.weaknesses}</p></div>}
                    {data.eval.suggestions && <div className="ob-sec"><h4>Góp ý cải tiến</h4><p>{data.eval.suggestions}</p></div>}
                    {data.can_ack ? (
                        <div className="ob-sec"><h4>Phản hồi của bạn</h4>
                            <textarea rows={3} maxLength={2000} placeholder="Cảm ơn đồng nghiệp, ý kiến trao đổi thêm… (không bắt buộc)" value={rep} onChange={(e) => setReply(e.target.value)} style={{ width: '100%' }} />
                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}><Btn tone="primary" busy={busy} onClick={ack}><Ico n="check" size={15} />{data.eval.ack_at ? 'Cập nhật phản hồi' : 'Xác nhận đã xem'}</Btn><Btn onClick={() => setAdd(true)}><Ico n="plus" size={15} />Thêm việc cải tiến</Btn></div>
                            {data.eval.ack_at && <p className="ta-mute" style={{ marginTop: 6 }}>Đã xác nhận {dt(data.eval.ack_at)}</p>}
                        </div>
                    ) : data.eval.reply ? <div className="ob-sec"><h4>Phản hồi của giáo viên</h4><p>{data.eval.reply}</p></div> : null}
                    {data.actions.length > 0 && <div className="ob-sec"><h4>Việc cải tiến từ phiếu này</h4>{data.actions.map((a) => <div key={a.id} className="ob-top"><Ico n={a.status === 'done' ? 'checks' : 'clock'} size={15} /><span style={{ flex: 1 }}>{a.content}</span><small className="ta-mute">{a.due_date ? fmtD(a.due_date) : ''}</small></div>)}</div>}
                </div>)}
            {add && <ActForm evalId={id} onClose={() => setAdd(false)} onDone={() => { reload(); onChange(); }} />}
        </Drawer>
    );
}

function Results({ open, setOpen }: { open: number | null; setOpen: (n: number | null) => void }) {
    const [year, setYear] = useState('current'); const { data, err, loading, reload } = useLoad(() => ob<Res>(`results?year=${year}`), [year]);
    if (loading && !data) return <Loading />; if (err || !data) return <ErrorBox msg={err || 'Lỗi'} retry={reload} />;
    const s = data.summary; const dist = s.distribution;
    const pts = [...data.data].reverse().map((x) => ({ d: x.date, p: x.percent }));
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><select className="ta-sel" value={year} onChange={(e) => setYear(e.target.value)}><option value="current">Năm học hiện tại</option><option value="all">Tất cả năm học</option>{data.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div>
            {s.count === 0 ? <Card><Empty icon="stats" title="Chưa có nhận xét nào" text="Khi đồng nghiệp nộp phiếu dự giờ tiết dạy của bạn, kết quả sẽ hiện ở đây." /></Card> : (
                <>
                    <div className="ob-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
                        <div className="ob-kpi" style={{ ['--c' as string]: '#0284c7', ['--cs' as string]: '#e0f2fe' }}><div className="top"><small>Số phiếu nhận được</small><span className="ic"><Ico n="doc" size={17} /></span></div><b>{s.count}</b><em>đã nộp</em></div>
                        <div className="ob-kpi" style={{ ['--c' as string]: s.avg_rating ? RATING[s.avg_rating].c : '#64748b', ['--cs' as string]: s.avg_rating ? RATING[s.avg_rating].cs : '#e2e8f0' }}><div className="top"><small>Điểm trung bình</small><span className="ic"><Ico n="stats" size={17} /></span></div><b>{s.avg_percent ?? 0}%</b><em>{s.avg_rating}</em></div>
                        <div className="ob-kpi" style={{ ['--c' as string]: '#d97706', ['--cs' as string]: '#fef3c7' }}><div className="top"><small>Chưa xác nhận</small><span className="ic"><Ico n="eye" size={17} /></span></div><b>{s.unack}</b><em>cần xem &amp; phản hồi</em></div>
                        <div className="ob-kpi" style={{ ['--c' as string]: '#7c3aed', ['--cs' as string]: '#ede9fe' }}><div className="top"><small>Phiếu tôi đã viết</small><span className="ic"><Ico n="pen" size={17} /></span></div><b>{s.given}</b><em>cho đồng nghiệp</em></div>
                    </div>
                    <div className="ob-grid2" style={{ marginBottom: 16 }}>
                        <Card title="Phân bố xếp loại"><Donut2 items={(Object.keys(RATING) as Rating[]).map((k) => ({ label: k, n: dist[k] || 0, c: RATING[k].c }))} /></Card>
                        <Card title="Xu hướng điểm theo thời gian"><Trend pts={pts} /></Card>
                    </div>
                    <div className="ob-grid2" style={{ marginBottom: 16 }}>
                        <Card title="Điểm theo nhóm tiêu chí">{data.groups.map((g) => <div key={g.name} className="ob-hbar"><span>{g.name}</span><div className="trk"><i style={{ width: `${g.percent}%`, background: tone(g.percent) }} /></div><b>{g.percent}%</b></div>)}</Card>
                        <Card title="Điểm mạnh &amp; cần cải thiện">
                            <h4 style={{ fontSize: 12.5, color: '#059669', marginBottom: 4 }}>Mạnh nhất</h4>{data.strongest.map((x) => <div key={x.name} className="ob-top"><span>{x.name}</span><b className="pc" style={{ color: '#059669' }}>{x.percent}%</b></div>)}
                            <h4 style={{ fontSize: 12.5, color: '#e11d48', margin: '12px 0 4px' }}>Cần cải thiện</h4>{data.weakest.map((x) => <div key={x.name} className="ob-top"><span>{x.name}</span><b className="pc" style={{ color: '#e11d48' }}>{x.percent}%</b></div>)}
                        </Card>
                    </div>
                    <Card title="Các phiếu nhận xét" pad={false}>
                        {data.data.map((x) => (
                            <button key={x.id} type="button" className="ob-srow" onClick={() => setOpen(x.id)} style={{ width: '100%', textAlign: 'left' }}>
                                <div className="ob-sb"><b>{x.title}</b><small>{fmtD(x.date)} · {x.kind_label}{x.subject ? ` · ${x.subject}` : ''}{x.class_name ? ` · ${x.class_name}` : ''} · {x.observer}</small></div>
                                <div className="ob-sr">{!x.ack && <Pill tone="amber">Chưa xem</Pill>}{x.actions > 0 && <Pill tone="violet">{x.actions_open}/{x.actions} việc</Pill>}<RatingPill rating={x.rating} percent={x.percent} /></div>
                            </button>))}
                    </Card>
                </>)}
        </>
    );
}

function Plan() {
    const { toast, refresh } = useTa(); const [f, setF] = useState<'open' | 'done' | 'all'>('open'); const { data, err, loading, reload } = useLoad(() => ob<ActRes>(`actions?status=${f}`), [f]);
    const [form, setForm] = useState<Act | 'new' | null>(null); const [del, setDel] = useState<Act | null>(null);
    const toggle = async (a: Act) => { try { await ob(`actions/${a.id}`, { method: 'PUT', body: { content: a.content, due_date: a.due_date, status: a.status === 'done' ? 'open' : 'done' } }); refresh(); reload(); } catch (e) { toast((e as Error).message, 'err'); } };
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <Tabs value={f} onChange={setF} items={[{ key: 'open', label: 'Đang làm', count: data?.counts.open, tone: 'amber' }, { key: 'done', label: 'Hoàn thành', count: data?.counts.done }, { key: 'all', label: 'Tất cả' }]} />
                <Btn tone="primary" onClick={() => setForm('new')}><Ico n="plus" size={15} />Thêm việc</Btn>
            </div>
            <Card pad={false}>
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Lỗi'} retry={reload} /> : data.data.length === 0 ? <Empty icon="check" title="Chưa có việc cải tiến" text="Thêm việc từ góp ý của đồng nghiệp để theo dõi tiến độ tự hoàn thiện." /> : data.data.map((a) => (
                    <div key={a.id} className={`ob-act ${a.status === 'done' ? 'done' : ''}`}>
                        <button type="button" className={`ck ${a.status === 'done' ? 'on' : ''}`} aria-label="Đánh dấu hoàn thành" style={a.status === 'done' ? { background: '#059669', borderColor: '#059669' } : undefined} onClick={() => toggle(a)}>{a.status === 'done' && <Ico n="check" size={13} />}</button>
                        <div className="x"><b>{a.content}</b><p>{a.due_date && <span>Hạn {fmtD(a.due_date)}</span>}{a.overdue && <Pill tone="rose">Quá hạn</Pill>}{a.session_title && <span>Từ bài “{a.session_title}”</span>}{a.done_at && <span>Xong {dt(a.done_at)}</span>}</p></div>
                        <Btn size="sm" tone="ghost" onClick={() => setForm(a)} aria-label="Sửa"><Ico n="edit" size={14} /></Btn><Btn size="sm" tone="ghost" onClick={() => setDel(a)} aria-label="Xóa"><Ico n="trash" size={14} /></Btn>
                    </div>))}
            </Card>
            {form && <ActForm init={form === 'new' ? undefined : form} onClose={() => setForm(null)} onDone={() => { refresh(); reload(); }} />}
            {del && <Confirm title="Xóa việc cải tiến?" tone="danger" okText="Xóa" text={<>“{del.content}”</>} onClose={() => setDel(null)} onOk={async () => { try { await ob(`actions/${del.id}`, { method: 'DELETE' }); toast('Đã xóa.'); setDel(null); refresh(); reload(); } catch (e) { toast((e as Error).message, 'err'); } }} />}
        </>
    );
}

function Inner() {
    const sp = useSearchParams(); const router = useRouter(); const tab = sp.get('tab') === 'cai-tien' ? 'plan' : 'res'; const ev = Number(sp.get('eval') || 0) || null; const [, bump] = useState(0);
    const setTab = (k: 'res' | 'plan') => router.replace(k === 'plan' ? '/teacher/observations/ket-qua?tab=cai-tien' : '/teacher/observations/ket-qua');
    const close = () => router.replace('/teacher/observations/ket-qua');
    return (
        <div className="ta-page">
            <Tabs value={tab as 'res' | 'plan'} onChange={setTab} items={[{ key: 'res', label: 'Nhận xét nhận được' }, { key: 'plan', label: 'Kế hoạch cải tiến' }]} />
            <div style={{ height: 14 }} />
            {tab === 'plan' ? <Plan /> : <Results open={ev} setOpen={(n) => router.replace(n ? `/teacher/observations/ket-qua?eval=${n}` : '/teacher/observations/ket-qua')} />}
            {ev && <EvalDrawer id={ev} onClose={close} onChange={() => bump((n) => n + 1)} />}
        </div>
    );
}
export default function Page() { return <Suspense fallback={<div className="ta-page"><Loading /></div>}><Inner /></Suspense>; }