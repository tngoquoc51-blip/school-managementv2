'use client';
// Lịch dự giờ (/teacher/observations/lich) – danh sách + lịch tuần, mở chi tiết, phản hồi, đổi lịch, hủy
import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { ADMIN_ROLES, Btn, Empty, ErrorBox, Ico, Loading, Pager, Pill, STATUS, Seg, Session, SessionDrawer, SessionRow, SStatus, addDays, fmtS, ob, parseYmd, qs, todayStr, useDebounced, useLoad, useTa, weekday, ymd } from '../_ob';

type Res = { counts: Record<string, number>; meta: { total: number; page: number; per: number; pages: number }; data: Session[] };
const monday = (s: string) => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const SCOPES: [string, string][] = [['mine', 'Của tôi'], ['observe', 'Tôi dự giờ'], ['taught', 'Tôi được dự']];
const FILTERS: [string, string][] = [['', 'Tất cả'], ['open', 'Đang mở'], ['pending', 'Chờ xác nhận'], ['scheduled', 'Đã lên lịch'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy'], ['declined', 'Bị từ chối']];

function Inner() {
    const { staff } = useTa(); const isAdmin = ADMIN_ROLES.includes(staff.role); const sp = useSearchParams(); const router = useRouter();
    const [scope, setScope] = useState(sp.get('scope') || (isAdmin ? 'all' : 'mine')); const [status, setStatus] = useState(sp.get('status') || ''); const [q, setQ] = useState(''); const dq = useDebounced(q, 300);
    const [kind, setKind] = useState(''); const [view, setView] = useState<'list' | 'week'>('list'); const [page, setPage] = useState(1); const [wk, setWk] = useState(monday(todayStr()));
    const [open, setOpen] = useState<number | null>(sp.get('open') ? Number(sp.get('open')) : null);
    useEffect(() => { const o = sp.get('open'); if (o) setOpen(Number(o)); }, [sp]);
    const { data, err, loading, reload } = useLoad(() => ob<Res>('sessions' + (view === 'list'
        ? qs({ scope, status, q: dq, kind, page, per: 15 }) : qs({ scope, q: dq, kind, from: wk, to: addDays(wk, 6), per: 100 }))), [scope, status, dq, kind, page, view, wk]);
    const close = () => { setOpen(null); if (sp.get('open')) router.replace('/teacher/observations/lich'); };
    const days = Array.from({ length: 7 }, (_, i) => addDays(wk, i)); const hasSun = (data?.data || []).some((s) => s.lesson_date === days[6]); const cols = hasSun ? days : days.slice(0, 6);
    const scopes: [string, string][] = isAdmin ? [...SCOPES, ['all', 'Toàn trường']] : SCOPES; const c = data?.counts || {};
    return (
        <div className="ta-page">
            <div className="ob-bar">
                <Seg value={scope} onChange={(v) => { setScope(v); setPage(1); }} items={scopes} />
                <label className="ob-find grow"><Ico n="search" size={15} /><input value={q} placeholder="Tìm theo tên bài, giáo viên, môn, lớp…" onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
                <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} aria-label="Hình thức"><option value="">Mọi hình thức</option><option value="periodic">Dự giờ định kỳ</option><option value="demo">Thao giảng</option><option value="topic">Chuyên đề</option><option value="surprise">Đột xuất</option><option value="review">Kiểm tra chuyên môn</option></select>
                <Seg value={view} onChange={(v) => setView(v as 'list' | 'week')} items={[['list', 'Danh sách'], ['week', 'Lịch tuần']]} />
            </div>
            {view === 'list' && <div className="ob-fchips" style={{ marginBottom: 14 }}>{FILTERS.map(([k, l]) => <button key={k} type="button" className={status === k ? 'on' : ''} onClick={() => { setStatus(k); setPage(1); }}>{l}{c[k || 'all'] !== undefined ? ` (${c[k || 'all']})` : ''}</button>)}</div>}
            {view === 'week' && (
                <div className="ob-bar"><Btn onClick={() => setWk(addDays(wk, -7))}>‹ Tuần trước</Btn><b>{fmtS(wk)} – {fmtS(addDays(wk, 6))}</b><Btn onClick={() => setWk(addDays(wk, 7))}>Tuần sau ›</Btn><Btn onClick={() => setWk(monday(todayStr()))}>Tuần này</Btn></div>)}
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : view === 'list' ? (
                <div className="ta-card">{data.data.length === 0 ? <Empty icon="cal" title="Không có buổi dự giờ nào" text="Bấm “Lên lịch dự giờ” ở góc trên bên phải để tạo buổi mới." /> : data.data.map((s) => <SessionRow key={s.id} s={s} onOpen={() => setOpen(s.id)} />)}
                    {data.meta.pages > 1 && <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />}</div>
            ) : (
                <div className="ob-week" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>{cols.map((d) => {
                    const list = data.data.filter((s) => s.lesson_date === d).sort((a, b) => (a.period || 0) - (b.period || 0));
                    return (<div key={d} className={`ob-day${d === todayStr() ? ' today' : ''}`}><h5><span>{weekday(d) === 'CN' ? 'Chủ nhật' : `Thứ ${weekday(d).slice(1)}`}</span><span>{fmtS(d)}</span></h5>
                        {list.length === 0 && <p className="ta-mute" style={{ fontSize: 12 }}>—</p>}
                        {list.map((s) => <button key={s.id} type="button" className={`ob-ev t-${s.status === 'pending' ? 'amber' : s.status === 'completed' ? 'green' : s.status === 'cancelled' || s.status === 'declined' ? 'slate' : s.can_evaluate ? 'rose' : 'sky'}`} onClick={() => setOpen(s.id)}>
                            <b>{s.period ? `T${s.period} · ` : ''}{s.title}</b><small>{s.observed_name}{s.class_name ? ` · ${s.class_name}` : ''}</small><small><Pill tone={STATUS[s.status as SStatus].tone}>{STATUS[s.status as SStatus].label}</Pill></small></button>)}</div>);
                })}</div>
            )}
            {open !== null && <SessionDrawer id={open} onClose={close} onChange={reload} />}
        </div>
    );
}
export default function Page() { return <Suspense fallback={<div className="ta-page"><Loading /></div>}><Inner /></Suspense>; }