'use client';

import { useCallback, useEffect, useState } from 'react';
import { homeroomPortal as API } from '@/services/homeroomPortal';
import '../../admin/profile/profile.css';
import '../../student/attendance/attendance.css';
import '../../teacher/attendance/ta.css';
import './hd.css';

const ST: Record<string, [string, string]> = { present: ['Có mặt', '#12805c'], late: ['Đi muộn', '#d39a12'], excused: ['Vắng có phép', '#0e6ba8'], unexcused: ['Vắng không phép', '#c0392b'] };
const TYPE: Record<string, string> = { sick: 'Nghỉ ốm', family: 'Việc gia đình', other: 'Lý do khác' };
const RATE: Record<string, string> = { 'Tốt': '#12805c', 'Khá': '#0e6ba8', 'Đạt': '#d39a12', 'Chưa đạt': '#c0392b' };
const gTone = (n: number | null) => (n === null ? '#9db2c6' : n >= 8 ? '#12805c' : n >= 6.5 ? '#0e6ba8' : n >= 5 ? '#d39a12' : '#c0392b');
const pTone = (n: number | null) => (n === null ? '#9db2c6' : n >= 95 ? '#12805c' : n >= 85 ? '#d39a12' : '#c0392b');
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const dvn = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('vi-VN');
const hm = (t?: string) => (t ? String(t).slice(0, 5) : '');
const wd = (s: string) => ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][new Date(s + 'T00:00:00').getDay()];
const errMsg = (e: any) => {
    if (!e?.response && e?.request) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc báo quản trị viên.';
    const er = e?.response?.data?.errors;
    return (er && (Object.values(er)[0] as string[])[0]) || e?.response?.data?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
};
const ini = (n: string) => n.split(' ').slice(-1)[0]?.[0] || '?';

export default function HomeroomDashboardPage() {
    const [d, setD] = useState<any>(null);
    const [err, setErr] = useState('');
    const [open, setOpen] = useState<any>(null);
    const [det, setDet] = useState<any>(null);
    const [toasts, setToasts] = useState<{ id: number; type: string; text: string }[]>([]);

    const toast = useCallback((type: string, text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
    }, []);
    const load = useCallback(() => {
        setErr('');
        API.dashboard()
            .then((r: any) => {
                // Chấp nhận cả dạng { kpi, ... } lẫn dạng bọc { data: { kpi, ... } }
                const x: any = r?.kpi ? r : (r?.data ?? r);
                if (!x || !x.kpi || !x.dist || !x.class) {
                    if (typeof x === 'string') {
                        setErr(`[200] Máy chủ trả về văn bản thay vì dữ liệu: "${x.slice(0, 300)}"`);
                        return;
                    }
                    const keys = x && typeof x === 'object' ? Object.keys(x).join(', ') : typeof x;
                    setErr(`[200] Dữ liệu không đúng định dạng. Các trường nhận được: ${keys || '(trống)'}${x?.message ? ` · ${x.message}` : ''}`);
                    return;
                }
                const today = new Date().toISOString().slice(0, 10);
                setD({
                    ...x,
                    trend: x.trend ?? [], absent: x.absent ?? [], attention: x.attention ?? [], leaves: x.leaves ?? [],
                    conduct: x.conduct ?? [], subjects: x.subjects ?? [], top: x.top ?? [], bottom: x.bottom ?? [],
                    timetable: x.timetable ?? { date: today, rows: [] },
                });
            })
            .catch((e) => setErr(`${e?.response?.status ? `[${e.response.status}] ` : ''}${errMsg(e)}`));
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);

    const openStu = (s: any) => { setOpen(s); setDet(null); API.student(s.id).then(setDet).catch((e) => { toast('error', errMsg(e)); setOpen(null); }); };
    const review = async (l: any, decision: 'approve' | 'reject') => {
        let note: string | undefined;
        if (decision === 'reject') { const n = prompt('Nhập lý do từ chối (bắt buộc):'); if (!n) return; note = n; }
        else if (!confirm(`Duyệt đơn xin nghỉ của ${l.full_name}? Các buổi vắng không phép trong khoảng ngày sẽ chuyển thành vắng có phép.`)) return;
        try { const r = await API.review(l.id, { decision, note }); toast('success', r.message); load(); } catch (e) { toast('error', errMsg(e)); }
    };

    if (err) return (
        <div className="pf at"><div className="pf-card pf-err"><h2>Không có dữ liệu lớp chủ nhiệm</h2><code>{err}</code>
            <p className="pf-mut">{err.startsWith('[200]') ? 'Máy chủ trả về dữ liệu thiếu hoặc sai dạng. Tài khoản này có thể chưa được phân công chủ nhiệm lớp nào.' : err.startsWith('[404]') ?'Tài khoản này chưa được phân công chủ nhiệm lớp nào, hoặc chưa thêm route /v1/teacher/homeroom/dashboard.' : err.startsWith('[401]') ? 'Hãy đăng xuất rồi đăng nhập lại.' : err.startsWith('[403]') ? 'Tài khoản này chưa liên kết với giáo viên (chạy file tai_khoan_dang_nhap_tat_ca.sql).' : 'Kiểm tra backend đang chạy và đã dán route.'}</p>
            <button className="pf-btn" onClick={load}>Thử lại</button></div></div>
    );
    if (!d) return <div className="pf at"><p className="pf-card">Đang tải dữ liệu lớp chủ nhiệm…</p></div>;
    const k = d.kpi, dist = d.dist, nd = Object.values(dist).reduce((a: number, b: any) => a + Number(b), 0) as number || 1;

    return (
        <div className="pf at">
            <div className="pf-toasts" aria-live="polite">
                {toasts.map((x) => <div key={x.id} className={`pf-toast ${x.type}`}><p>{x.text}</p><button onClick={() => setToasts((l) => l.filter((i) => i.id !== x.id))}>✕</button></div>)}
            </div>

            <section className="pf-card at-hero" style={{ gridTemplateColumns: '1fr' }}>
                <div className="at-top"><div><h1>Lớp {d.class.name} · Khối {d.class.grade}</h1><p>Giáo viên chủ nhiệm: {d.teacher} · Năm học {d.year}</p></div></div>
                <div className="at-kpis" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
                    {([['Sĩ số', k.students, '#0e6ba8'], ['Chuyên cần cả năm', k.attendance === null ? '—' : `${k.attendance}%`, pTone(k.attendance)],
                        [`Vắng ${k.last_date ? dm(k.last_date) : 'gần nhất'}`, k.absent_last, k.absent_last ? '#c0392b' : '#12805c'], ['Đơn chờ duyệt', k.pending_leaves, '#d39a12'],
                        ['ĐTB lớp', k.avg_grade ?? '—', gTone(k.avg_grade)], ['Học sinh cần chú ý', k.attention, k.attention ? '#c0392b' : '#12805c']] as const).map(([l, v, c]) => (
                        <div key={l} className="at-kpi" style={{ ['--c' as any]: c }}><b>{v}</b><span>{l}</span></div>))}
                </div>
            </section>

            <div className="hd-main">
                <div className="hd-col2">
                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Chuyên cần {d.trend.length} ngày học gần nhất</h2>
                        {!d.trend.length ? <p className="pf-mut">Chưa có dữ liệu điểm danh.</p> : <>
                            <div className="hd-trend">{d.trend.map((t: any) => {
                                const tot = Number(t.total) || 1, r = Math.round((1000 * (Number(t.present) + Number(t.late))) / tot) / 10;
                                return (<div key={t.att_date} className="hd-col" title={`${dvn(t.att_date)}: ${t.present} có mặt, ${t.late} muộn, ${t.excused} có phép, ${t.unexcused} không phép`}>
                                    <b style={{ color: pTone(r) }}>{Math.round(r)}%</b>
                                    <div className="hd-stack">{(['present', 'late', 'excused', 'unexcused'] as const).map((s) => <i key={s} style={{ height: `${(100 * Number(t[s])) / tot}%`, background: ST[s][1] }} />)}</div>
                                    <small>{dm(t.att_date)}</small></div>);
                            })}</div>
                            <div className="at-leg">{Object.values(ST).map(([l, c]) => <span key={l} style={{ ['--c' as any]: c }}><i />{l}</span>)}</div></>}
                    </section>

                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Học sinh vắng, muộn ngày {d.kpi.last_date ? dvn(d.kpi.last_date) : '—'}</h2>
                        {!d.absent.length && <p style={{ color: 'var(--ok)', fontWeight: 600, margin: 0 }}>✓ Cả lớp có mặt đầy đủ.</p>}
                        {d.absent.map((a: any) => (<div key={a.id} className="hd-row" onClick={() => openStu(a)}><span className="hd-av" style={{ ['--c' as any]: ST[a.status][1] }}>{ini(a.full_name)}</span>
                            <span className="t"><b>{a.full_name}</b><span>{a.code}</span></span><span className="at-badge" style={{ ['--c' as any]: ST[a.status][1] }}>{ST[a.status][0]}</span></div>))}
                    </section>

                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Học sinh cần chú ý</h2>
                        {!d.attention.length && <p style={{ color: 'var(--ok)', fontWeight: 600, margin: 0 }}>✓ Không có học sinh nào cần chú ý đặc biệt.</p>}
                        {d.attention.map((s: any) => (<div key={s.id} className="hd-row" onClick={() => openStu(s)}><span className="hd-av" style={{ ['--c' as any]: '#c0392b' }}>{ini(s.full_name)}</span>
                            <span className="t"><b>{s.full_name}</b><span>{s.reasons.join(' · ')}</span></span>
                            <span style={{ textAlign: 'right' }}><b style={{ color: pTone(s.rate) }}>{s.rate === null ? '—' : `${s.rate}%`}</b><br /><span className="pf-mut" style={{ fontSize: 12 }}>chuyên cần</span></span></div>))}
                    </section>
                </div>

                <div className="hd-col2">
                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 12px', fontSize: 16 }}>Đơn xin nghỉ chờ duyệt ({k.pending_leaves})</h2>
                        {!d.leaves.length && <p className="pf-mut" style={{ margin: 0 }}>Không có đơn nào chờ duyệt.</p>}
                        {d.leaves.map((l: any) => (<div key={l.id} className="hd-lv"><b>{l.full_name}</b> <span className="pf-mut">({l.code})</span>
                            <p>{TYPE[l.leave_type]} · {dvn(l.from_date) === dvn(l.to_date) ? dvn(l.from_date) : `${dvn(l.from_date)} → ${dvn(l.to_date)}`}</p><p className="pf-mut">{l.reason}</p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="pf-btn" style={{ padding: '7px 14px' }} onClick={() => review(l, 'approve')}>Duyệt</button>
                                <button className="ta-btn" style={{ color: '#c0392b' }} onClick={() => review(l, 'reject')}>Từ chối</button></div></div>))}
                    </section>

                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Thời khoá biểu {wd(d.timetable.date)}, {dm(d.timetable.date)}</h2>
                        {!d.timetable.rows.length && <p className="pf-mut" style={{ margin: 0 }}>Không có tiết học.</p>}
                        {d.timetable.rows.map((t: any) => (<div key={t.period} className="hd-tt"><span className="p">Tiết {t.period}</span>
                            <span><b>{t.subject}</b><br /><small>{t.teacher || 'Chưa phân công'} · {hm(t.start_time)}–{hm(t.end_time)}</small></span>
                            {Number(t.marked) > 0 ? <span className="at-badge" style={{ ['--c' as any]: '#12805c' }}>Đã điểm danh</span> : <span className="pf-mut" style={{ fontSize: 12 }}>Chưa điểm danh</span>}</div>))}
                    </section>

                    <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 4px', fontSize: 16 }}>Học lực và hạnh kiểm</h2>
                        <div className="hd-dist" title="Giỏi · Khá · Trung bình · Yếu">{[['gioi', '#12805c'], ['kha', '#0e6ba8'], ['tb', '#d39a12'], ['yeu', '#c0392b']].map(([key, c]) => <i key={key} style={{ width: `${(100 * Number(dist[key])) / nd}%`, background: c }} />)}</div>
                        <div className="hd-chips">{[['Giỏi', 'gioi', '#12805c'], ['Khá', 'kha', '#0e6ba8'], ['Trung bình', 'tb', '#d39a12'], ['Yếu', 'yeu', '#c0392b']].map(([l, key, c]) => <span key={key} className="at-badge" style={{ ['--c' as any]: c }}>{l}: {dist[key]}</span>)}</div>
                        <p className="pf-mut" style={{ margin: '14px 0 6px', fontSize: 13 }}>Hạnh kiểm (kỳ gần nhất)</p>
                        <div className="hd-chips">{d.conduct.length ? d.conduct.map((c: any) => <span key={c.rating} className="at-badge" style={{ ['--c' as any]: RATE[c.rating] || '#6b7c8d' }}>{c.rating || 'Chưa xếp'}: {c.n}</span>) : <span className="pf-mut">Chưa có dữ liệu.</span>}</div>
                    </section>
                </div>
            </div>

            <div className="at-grid" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(320px,1fr)' }}>
                <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Điểm trung bình lớp theo môn</h2>
                    {!d.subjects.length && <p className="pf-mut">Chưa có dữ liệu điểm.</p>}
                    {d.subjects.map((s: any) => <div key={s.name} className="hd-bar"><b>{s.name}</b><div className="hd-track"><i style={{ width: `${(Number(s.avg) / 10) * 100}%`, background: gTone(Number(s.avg)) }} /></div><b style={{ color: gTone(Number(s.avg)) }}>{s.avg}</b></div>)}</section>
                <section className="pf-card"><h2 className="dc-sec" style={{ margin: '0 0 8px', fontSize: 16 }}>Top 5 và 5 học sinh cần hỗ trợ</h2>
                    {d.top.map((s: any) => <div key={s.id} className="hd-row" onClick={() => openStu(s)}><span className="hd-av" style={{ ['--c' as any]: '#12805c' }}>{ini(s.full_name)}</span><span className="t"><b>{s.full_name}</b></span><b style={{ color: gTone(s.avg) }}>{s.avg}</b></div>)}
                    <p className="pf-mut" style={{ margin: '10px 0 0', fontSize: 12 }}>Cần hỗ trợ thêm</p>
                    {d.bottom.map((s: any) => <div key={s.id} className="hd-row" onClick={() => openStu(s)}><span className="hd-av" style={{ ['--c' as any]: '#c0392b' }}>{ini(s.full_name)}</span><span className="t"><b>{s.full_name}</b></span><b style={{ color: gTone(s.avg) }}>{s.avg}</b></div>)}</section>
            </div>

            {open && <>
                <div className="at-ov" onClick={() => setOpen(null)} />
                <aside className="at-dr" role="dialog">
                    <header><div><h2>{open.full_name}</h2><span className="pf-mut">{open.code} · Lớp {d.class.name}</span></div><button className="at-x" onClick={() => setOpen(null)} aria-label="Đóng">✕</button></header>
                    <div className="bd">
                        {!det && <p className="pf-mut">Đang tải hồ sơ…</p>}
                        {det && <>
                            <div className="at-kpis" style={{ marginTop: 0 }}>{(['present', 'late', 'excused', 'unexcused'] as const).map((s) => <div key={s} className="at-kpi" style={{ ['--c' as any]: ST[s][1] }}><b>{det.attendance[s]}</b><span>{ST[s][0]}</span></div>)}</div>
                            <h3 className="at-mh">Liên hệ phụ huynh</h3>
                            {!det.contacts.length && <p className="pf-mut">Chưa có thông tin liên hệ.</p>}
                            {det.contacts.map((c: any, i: number) => <p key={i} style={{ margin: '4px 0' }}><b>{c.label}:</b> {c.name || '—'} {c.phone ? <a href={`tel:${c.phone}`} style={{ color: 'var(--blue2)' }}>· {c.phone}</a> : <span className="pf-mut">· chưa có số điện thoại</span>}</p>)}
                            <h3 className="at-mh">Điểm trung bình môn</h3>
                            <div className="pf-card" style={{ padding: 0, overflow: 'hidden' }}><table className="at-tbl"><thead><tr><th>Môn</th><th>HK1</th><th>HK2</th></tr></thead>
                                <tbody>{det.grades.map((g: any) => <tr key={g.name}><td>{g.name}</td><td style={{ color: gTone(g.hk1 === null ? null : Number(g.hk1)), fontWeight: 700 }}>{g.hk1 ?? '—'}</td><td style={{ color: gTone(g.hk2 === null ? null : Number(g.hk2)), fontWeight: 700 }}>{g.hk2 ?? '—'}</td></tr>)}</tbody></table></div>
                            {det.conduct && <p style={{ marginTop: 12 }}><b>Hạnh kiểm:</b> HK1 {det.conduct.hk1 || '—'} · HK2 {det.conduct.hk2 || '—'} · Cả năm {det.conduct.year_result || '—'}</p>}
                            {!!det.absences.length && <><h3 className="at-mh">Các buổi nghỉ, đi muộn gần đây</h3>{det.absences.map((a: any) => <p key={a.att_date} style={{ margin: '4px 0' }}>{dvn(a.att_date)} · <span className="at-badge" style={{ ['--c' as any]: ST[a.status][1] }}>{ST[a.status][0]}</span></p>)}</>}
                        </>}
                    </div>
                </aside>
            </>}
        </div>
    );
}