'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { studentAttendance as API } from '@/services/studentAttendance';
import '../../admin/profile/profile.css';
import './attendance.css';

const ST: Record<string, [string, string]> = {
    present: ['Có mặt', '#12805c'], late: ['Đi muộn', '#d39a12'], excused: ['Vắng có phép', '#0e6ba8'], unexcused: ['Vắng không phép', '#c0392b'],
};
const LV: Record<string, [string, string]> = {
    pending: ['Chờ duyệt', '#d39a12'], approved: ['Đã duyệt', '#12805c'], rejected: ['Từ chối', '#c0392b'], cancelled: ['Đã huỷ', '#6b7c8d'],
};
const TYPE: Record<string, string> = { sick: 'Nghỉ ốm', family: 'Việc gia đình', other: 'Lý do khác' };
const errMsg = (e: any) => {
    if (!e?.response && (e?.code === 'ERR_NETWORK' || e?.code === 'ECONNABORTED' || e?.request)) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc báo quản trị viên.'; const er = e?.response?.data?.errors; return (er && (Object.values(er)[0] as string[])[0]) || e?.response?.data?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.'; };
const vd = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const ymd = (s: string) => s.slice(0, 10);
const tone = (n: number) => (n >= 90 ? '#12805c' : n >= 80 ? '#d39a12' : '#c0392b');
const thisMonth = () => new Date().toISOString().slice(0, 7);
const shiftMonth = (m: string, d: number) => { const [y, mo] = m.split('-').map(Number); const x = new Date(y, mo - 1 + d, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const EMPTY = { leave_type: 'sick', from_date: '', to_date: '', reason: '' };

export default function StudentAttendancePage() {
    const [tab, setTab] = useState<'overview' | 'subjects' | 'calendar' | 'history' | 'leaves'>('overview');
    const [ov, setOv] = useState<any>(null);
    const [err, setErr] = useState('');
    const [month, setMonth] = useState(thisMonth());
    const [days, setDays] = useState<Record<string, any>>({});
    const [sel, setSel] = useState('');
    const [issues, setIssues] = useState<any[] | null>(null);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [yearId, setYearId] = useState<number | null>(null);
    const [sem, setSem] = useState(0);
    const [subs, setSubs] = useState<any[] | null>(null);
    const [subOpen, setSubOpen] = useState<any>(null);
    const [subData, setSubData] = useState<any>(null);
    const [form, setForm] = useState<any>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [toasts, setToasts] = useState<{ id: number; type: string; text: string }[]>([]);

    const toast = useCallback((type: string, text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);

    const loadAll = useCallback(() => {
        const tryOverview = (n = 0): Promise<any> => API.overview({ year: yearId, semester: sem }).catch((e) =>
            !e?.response && n < 2 ? new Promise((r) => setTimeout(r, 1500 * (n + 1))).then(() => tryOverview(n + 1)) : Promise.reject(e));
        tryOverview().then(setOv).catch((e) => setErr(`${e?.response?.status ? `[${e.response.status}] ` : ''}${errMsg(e)}`));
        API.leaves().then((r) => setLeaves(r.data)).catch(() => {});
    }, [yearId, sem]);
    useEffect(() => { loadAll(); }, [loadAll]);
    useEffect(() => { setIssues(null); setSubs(null); }, [yearId, sem]);
    useEffect(() => {
        if (tab !== 'calendar') return;
        API.month(month).then((r) => { const m: Record<string, any> = {}; r.data.forEach((x: any) => (m[ymd(x.att_date)] = x)); setDays(m); setSel(''); }).catch((e) => toast('error', errMsg(e)));
    }, [tab, month, toast]);
    useEffect(() => { if (tab === 'history' && !issues) API.issues({ year: yearId, semester: sem }).then((r) => setIssues(r.data)).catch((e) => toast('error', errMsg(e))); }, [tab, issues, toast, yearId, sem]);
    useEffect(() => {
        if (tab === 'subjects' && !subs) API.subjects({ year: yearId, semester: sem }).then((r) => setSubs(r.data)).catch((e) => toast('error', errMsg(e)));
    }, [tab, subs, toast, yearId, sem]);
    const openSub = (x: any) => {
        setSubOpen(x); setSubData(null);
        API.subject(x.id, { year: yearId, semester: sem }).then(setSubData).catch((e) => toast('error', errMsg(e)));
    };
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && setSubOpen(null);
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);
    const pickYear = (id: number) => {
        const y = ov.years.find((x: any) => x.id === id);
        setYearId(id); setSem(0);
        if (y && !y.is_current && ov.year.start) setMonth(((y.id === ov.year.id ? ov.year.start : '') || `${y.label.slice(0, 4)}-09`).slice(0, 7));
        else setMonth(thisMonth());
    };

    const send = async (e: React.FormEvent) => {
        e.preventDefault(); setBusy(true);
        try { const r = await API.sendLeave(form); toast('success', r.message); setForm(EMPTY); loadAll(); }
        catch (x) { toast('error', errMsg(x)); }
        setBusy(false);
    };
    const cancel = async (id: number) => {
        if (!confirm('Huỷ đơn xin nghỉ này?')) return;
        try { const r = await API.cancelLeave(id); toast('success', r.message); loadAll(); } catch (x) { toast('error', errMsg(x)); }
    };

    const cells = useMemo(() => {
        const [y, mo] = month.split('-').map(Number);
        const lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7, dim = new Date(y, mo, 0).getDate();
        return [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
    }, [month]);

    if (err) return (
        <div className="pf at"><div className="pf-card pf-err"><h2>Không tải được dữ liệu chuyên cần</h2><code>{err}</code>
            <p className="pf-mut">{err.startsWith('[401]') ? 'Hãy đăng xuất rồi đăng nhập lại cổng học sinh.' : err.includes('kết nối') ? 'Máy chủ không phản hồi. Nếu bạn là quản trị viên: kiểm tra backend đang chạy và địa chỉ API (NEXT_PUBLIC_API_URL) đúng.' : 'Kiểm tra: đã chạy file SQL, đã thêm route và controller, backend đang chạy.'}</p>
            <button className="pf-btn" onClick={() => location.reload()}>Thử lại</button></div></div>
    );
    if (!ov) return <div className="pf at"><p className="pf-card">Đang tải…</p></div>;

    const t = ov.totals, rate = ov.rate, C = 2 * Math.PI * 62, pend = ov.pending_leaves;
    const months = Object.keys(ov.monthly), selRec = sel ? days[sel] : null;
    const alert = rate === null ? null : rate >= 95 ? ['ok', `Chuyên cần rất tốt! Bạn đang có ${ov.streak} ngày đi học liên tiếp.`] : rate >= 85 ? ['warn', 'Tỷ lệ đi học ở mức khá. Hãy cố gắng hạn chế nghỉ và đi muộn.'] : ['bad', 'Tỷ lệ chuyên cần thấp. Bạn có nguy cơ không đủ điều kiện xét lên lớp, hãy trao đổi với giáo viên chủ nhiệm.'];

    return (
        <div className="pf at">
            <div className="pf-toasts" aria-live="polite">
                {toasts.map((x) => <div key={x.id} className={`pf-toast ${x.type}`}><p>{x.text}</p><button onClick={() => setToasts((l) => l.filter((i) => i.id !== x.id))}>✕</button></div>)}
            </div>

            <section className="pf-card at-hero">
                <div className="at-ring">
                    <svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" fill="none" stroke="#dbe9f6" strokeWidth="14" />
                        <circle cx="75" cy="75" r="62" fill="none" stroke={rate === null ? '#dbe9f6' : tone(rate)} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - (rate || 0) / 100)} style={{ transition: 'stroke-dashoffset .7s' }} /></svg>
                    <b style={{ color: rate === null ? '#9db2c6' : tone(rate) }}>{rate === null ? '—' : `${rate}%`}<small>đi học</small></b>
                </div>
                <div>
                    <div className="at-top">
                        <div><h1>Chuyên cần của tôi</h1>
                            <p>{ov.student?.full_name} · {ov.student?.code}{ov.class ? ` · Lớp ${ov.class.name}` : ''} · Năm học {ov.year.label}{ov.semester ? ` · Học kỳ ${ov.semester}` : ''} · {t.days} buổi đã điểm danh</p></div>
                        <div className="at-sel">
                            <select className="pf-in" value={yearId ?? ov.year.id} onChange={(e) => pickYear(Number(e.target.value))} aria-label="Năm học">
                                {ov.years.map((y: any) => <option key={y.id} value={y.id}>Năm học {y.label} · Lớp {y.class_name}</option>)}
                            </select>
                            <select className="pf-in" value={sem} onChange={(e) => setSem(Number(e.target.value))} aria-label="Học kỳ">
                                <option value={0}>Cả năm học</option><option value={1}>Học kỳ 1 (T9 – T1)</option><option value={2}>Học kỳ 2 (T2 – T5)</option>
                            </select>
                            <button className="pf-btn" onClick={() => setTab('leaves')}>＋ Xin nghỉ phép</button>
                        </div>
                    </div>
                    <div className="at-kpis">
                        {(['present', 'late', 'excused', 'unexcused'] as const).map((k) => <div key={k} className="at-kpi" style={{ ['--c' as any]: ST[k][1] }}><b>{t[k]}</b><span>{ST[k][0]}</span></div>)}
                    </div>
                </div>
            </section>

            {alert && <div className={`at-alert ${alert[0]}`}><span>{alert[0] === 'ok' ? '✓' : '⚠'}</span>{alert[1]}</div>}

            <nav className="at-nav" role="tablist">
                {([['overview', 'Tổng quan'], ['subjects', 'Theo môn học'], ['calendar', 'Lịch điểm danh'], ['history', 'Buổi nghỉ & đi muộn'], ['leaves', 'Đơn xin nghỉ']] as const).map(([k, l]) => (
                    <button key={k} role="tab" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'leaves' && pend > 0 && <em>{pend}</em>}</button>
                ))}
            </nav>

            {tab === 'overview' && (
                <div className="at-grid">
                    <section className="pf-card">
                        <h2 className="dc-sec" style={{ margin: '0 0 12px', fontSize: 16 }}>Thống kê theo tháng</h2>
                        {!months.length ? <p className="pf-mut">Chưa có dữ liệu điểm danh.</p> : <>
                            <div className="at-chart">
                                {months.map((m) => { const x = ov.monthly[m], tot = (x.present || 0) + (x.late || 0) + (x.excused || 0) + (x.unexcused || 0), r = Math.round(100 * ((x.present || 0) + (x.late || 0)) / tot);
                                    return (<div key={m} className="at-col"><b style={{ color: tone(r) }}>{r}%</b>
                                        <div className="at-stack" style={{ height: '78%' }} title={`${m}: ${tot} buổi`}>
                                            {(['present', 'late', 'excused', 'unexcused'] as const).map((k) => <i key={k} style={{ height: `${(100 * (x[k] || 0)) / tot}%`, background: ST[k][1] }} />)}</div>
                                        <small>T{m.slice(5)}</small></div>);
                                })}
                            </div>
                            <div className="at-leg">{Object.values(ST).map(([l, c]) => <span key={l} style={{ ['--c' as any]: c }}><i />{l}</span>)}</div>
                        </>}
                    </section>
                    <div style={{ display: 'grid', gap: 20 }}>
                        <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Chuỗi đi học liên tiếp</h2>
                            <b style={{ fontSize: 34, color: 'var(--ok)' }}>{ov.streak}</b> <span className="pf-mut">ngày có mặt đúng giờ</span></section>
                        <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Quy định chuyên cần</h2>
                            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: '#3c566e' }}>
                                <li>Đi học từ 95% trở lên: Rất tốt</li><li>Từ 85% đến dưới 95%: Khá</li><li>Dưới 85%: Cần trao đổi với GVCN</li><li>Xin nghỉ phép trước hoặc trong 7 ngày sau khi nghỉ</li></ul></section>
                    </div>
                </div>
            )}

            {tab === 'calendar' && (
                <section className="pf-card">
                    <div className="at-month">
                        <button className="pf-btn" style={{ padding: '8px 14px' }} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
                        <h2>Tháng {month.slice(5)}/{month.slice(0, 4)}</h2>
                        <div style={{ display: 'flex', gap: 8 }}><button className="pf-btn" style={{ padding: '8px 14px' }} onClick={() => setMonth(thisMonth())}>Hôm nay</button>
                            <button className="pf-btn" style={{ padding: '8px 14px' }} onClick={() => setMonth(shiftMonth(month, 1))}>›</button></div>
                    </div>
                    <div className="at-cal">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((h) => <div key={h} className="h">{h}</div>)}
                        {cells.map((d, i) => {
                            if (!d) return <div key={i} className="at-day blank" />;
                            const rec = days[d], we = [0, 6].includes(new Date(d + 'T00:00:00').getDay());
                            return (<button key={d} className={`at-day ${rec ? 's' : ''} ${we && !rec ? 'we' : ''} ${sel === d ? 'sel' : ''}`} style={rec ? { ['--c' as any]: ST[rec.status][1] } : undefined} onClick={() => rec && setSel(d)}>
                                <b>{Number(d.slice(8))}</b>{rec && <span>{ST[rec.status][0]}</span>}</button>);
                        })}
                    </div>
                    <div className="at-leg">{Object.values(ST).map(([l, c]) => <span key={l} style={{ ['--c' as any]: c }}><i />{l}</span>)}</div>
                    {selRec && <div className="at-detail"><b>{vd(sel)}</b><p style={{ margin: '4px 0 0' }}>
                        <span className="at-badge" style={{ ['--c' as any]: ST[selRec.status][1] }}>{ST[selRec.status][0]}</span>{selRec.note ? ` — ${selRec.note}` : ''}</p></div>}
                </section>
            )}

            {tab === 'subjects' && (
                <section>
                    {!subs && <p className="pf-card pf-mut">Đang tải…</p>}
                    <div className="at-subs">
                        {(subs || []).map((x) => {
                            const tot = Number(x.total), good = Number(x.present) + Number(x.late), r = tot ? Math.round((1000 * good) / tot) / 10 : null;
                            return (
                                <button key={x.id} className="at-sub" onClick={() => openSub(x)}>
                                    <div className="at-sub-h"><b>{x.subject}</b><strong style={{ color: r === null ? '#9db2c6' : tone(r) }}>{r === null ? '—' : `${r}%`}</strong></div>
                                    <small className="pf-mut">GV: {x.teacher || 'Chưa phân công'}</small>
                                    <div className="at-track"><i style={{ width: `${r || 0}%`, background: r === null ? '#dbe9f6' : tone(r) }} /></div>
                                    <div className="at-mini">
                                        {(['present', 'late', 'excused', 'unexcused'] as const).map((k) => <span key={k} style={{ ['--c' as any]: ST[k][1] }}><i />{x[k]} {ST[k][0].toLowerCase()}</span>)}
                                    </div>
                                    <small className="pf-mut">{tot ? `${tot} tiết đã điểm danh` : 'Chưa có dữ liệu điểm danh'} · Bấm để xem từng buổi →</small>
                                </button>
                            );
                        })}
                    </div>
                    {subs && !subs.length && <p className="pf-card pf-mut">Không có môn học nào trong năm học này.</p>}
                </section>
            )}

            {tab === 'history' && (
                <section className="pf-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table className="at-tbl"><thead><tr><th>Ngày</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
                        <tbody>{(issues || []).map((x) => <tr key={x.att_date}><td>{vd(x.att_date)}</td>
                            <td><span className="at-badge" style={{ ['--c' as any]: ST[x.status][1] }}>{ST[x.status][0]}</span></td><td className="pf-mut">{x.note || '—'}</td></tr>)}</tbody></table>
                    {issues && !issues.length && <p className="pf-mut" style={{ padding: 24, textAlign: 'center' }}>Tuyệt vời! Bạn chưa nghỉ buổi nào hoặc đi muộn trong năm học này.</p>}
                    {!issues && <p className="pf-mut" style={{ padding: 24 }}>Đang tải…</p>}
                </section>
            )}

            {tab === 'leaves' && (
                <div className="at-grid" style={{ gridTemplateColumns: 'minmax(320px,1fr) minmax(0,1.4fr)' }}>
                    <form className="pf-card at-form" onSubmit={send}>
                        <h2 className="dc-sec" style={{ margin: 0, fontSize: 16 }}>Gửi đơn xin nghỉ</h2>
                        <label className="pf-field"><span>Loại nghỉ</span>
                            <select className="pf-in" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <div className="at-2">
                            <label className="pf-field"><span>Từ ngày</span><input type="date" className="pf-in" required value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value, to_date: form.to_date || e.target.value })} /></label>
                            <label className="pf-field"><span>Đến ngày</span><input type="date" className="pf-in" required min={form.from_date} value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} /></label>
                        </div>
                        <label className="pf-field"><span>Lý do</span><textarea className="pf-in" rows={4} required minLength={10} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ví dụ: Em bị sốt, có giấy khám của bệnh viện…" /><small>{form.reason.length}/500 ký tự</small></label>
                        <button className="pf-btn" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đơn'}</button>
                    </form>
                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 12px', fontSize: 16 }}>Đơn của tôi</h2>
                        <div className="at-list">
                            {leaves.map((l) => (
                                <div key={l.id} className="at-lv" style={{ ['--c' as any]: LV[l.status][1] }}>
                                    <div><b>{TYPE[l.leave_type]}</b> <span className="at-badge" style={{ ['--c' as any]: LV[l.status][1] }}>{LV[l.status][0]}</span>
                                        <p>{ymd(l.from_date) === ymd(l.to_date) ? new Date(ymd(l.from_date)).toLocaleDateString('vi-VN') : `${new Date(ymd(l.from_date)).toLocaleDateString('vi-VN')} → ${new Date(ymd(l.to_date)).toLocaleDateString('vi-VN')}`}</p>
                                        <p className="pf-mut">{l.reason}</p>{l.reviewer_note && <p><b>Phản hồi:</b> {l.reviewer_note}</p>}</div>
                                    {l.status === 'pending' && <button className="pf-link" style={{ color: 'var(--bad)' }} onClick={() => cancel(l.id)}>Huỷ đơn</button>}
                                </div>
                            ))}
                            {!leaves.length && <p className="pf-mut">Bạn chưa gửi đơn xin nghỉ nào.</p>}
                        </div>
                    </section>
                </div>
            )}

            {subOpen && <>
                <div className="at-ov" onClick={() => setSubOpen(null)} />
                <aside className="at-dr" role="dialog" aria-label={subOpen.subject}>
                    <header><div><h2>{subOpen.subject}</h2><span className="pf-mut">GV: {subOpen.teacher || 'Chưa phân công'} · {ov.year.label}{sem ? ` · Học kỳ ${sem}` : ''}</span></div>
                        <button className="at-x" onClick={() => setSubOpen(null)} aria-label="Đóng">✕</button></header>
                    <div className="bd">
                        {!subData && <p className="pf-mut">Đang tải…</p>}
                        {subData && (() => {
                            const L: any[] = subData.lessons, cnt = (k: string) => L.filter((x) => x.status === k).length;
                            const byM: Record<string, any[]> = {}; L.forEach((x) => (byM[ymd(x.att_date).slice(0, 7)] ||= []).push(x));
                            const abs = L.filter((x) => x.status !== 'present').reverse();
                            return (<>
                                <div className="at-kpis" style={{ marginTop: 0 }}>{(['present', 'late', 'excused', 'unexcused'] as const).map((k) => <div key={k} className="at-kpi" style={{ ['--c' as any]: ST[k][1] }}><b>{cnt(k)}</b><span>{ST[k][0]}</span></div>)}</div>
                                {!L.length && <p className="pf-mut">Giáo viên chưa điểm danh môn này trong khoảng thời gian đã chọn.</p>}
                                {Object.keys(byM).sort().map((m) => (
                                    <div key={m}><h3 className="at-mh">Tháng {m.slice(5)}/{m.slice(0, 4)}</h3>
                                        <div className="at-chips">{byM[m].map((x, i) => (
                                            <span key={i} className="at-chip" style={{ ['--c' as any]: ST[x.status][1] }} title={`${vd(x.att_date)} · Tiết ${x.period}${x.start_time ? ` (${String(x.start_time).slice(0, 5)}–${String(x.end_time).slice(0, 5)})` : ''} · ${ST[x.status][0]}${x.note ? ` · ${x.note}` : ''}`}>
                        {ymd(x.att_date).slice(8)}/{ymd(x.att_date).slice(5, 7)}<small>T{x.period}</small></span>))}</div></div>
                                ))}
                                {!!abs.length && <><h3 className="at-mh">Các buổi nghỉ / đi muộn ({abs.length})</h3>
                                    <div className="pf-card" style={{ padding: 0, overflow: 'hidden' }}><table className="at-tbl"><thead><tr><th>Ngày</th><th>Tiết</th><th>Trạng thái</th></tr></thead>
                                        <tbody>{abs.map((x, i) => <tr key={i}><td>{vd(x.att_date)}</td><td>Tiết {x.period}{x.start_time ? ` · ${String(x.start_time).slice(0, 5)}` : ''}</td>
                                            <td><span className="at-badge" style={{ ['--c' as any]: ST[x.status][1] }}>{ST[x.status][0]}</span></td></tr>)}</tbody></table></div></>}
                                <div className="at-leg" style={{ marginTop: 16 }}>{Object.values(ST).map(([l, c]) => <span key={l} style={{ ['--c' as any]: c }}><i />{l}</span>)}</div>
                            </>);
                        })()}
                    </div>
                </aside>
            </>}
        </div>
    );
}