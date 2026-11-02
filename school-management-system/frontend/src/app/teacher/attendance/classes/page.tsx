'use client';

import { useCallback, useEffect, useState } from 'react';
import { teacherPortal as API } from '@/services/teacherPortal';
import '../../admin/profile/profile.css';
import '../../student/attendance/attendance.css';
import '../attendance/ta.css';

const LV: Record<string, [string, string]> = { pending: ['Chờ duyệt', '#d39a12'], approved: ['Đã duyệt', '#12805c'], rejected: ['Từ chối', '#c0392b'], cancelled: ['Đã huỷ', '#6b7c8d'] };
const TYPE: Record<string, string> = { sick: 'Nghỉ ốm', family: 'Việc gia đình', other: 'Lý do khác' };
const tone = (n: number) => (n >= 90 ? '#12805c' : n >= 80 ? '#d39a12' : '#c0392b');
const rate = (good: number, total: number) => (total ? Math.round((1000 * good) / total) / 10 : null);
const dvn = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('vi-VN');
const errMsg = (e: any) => {
    if (!e?.response && e?.request) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng hoặc báo quản trị viên.';
    const er = e?.response?.data?.errors;
    return (er && (Object.values(er)[0] as string[])[0]) || e?.response?.data?.message || e?.message || 'Có lỗi xảy ra, vui lòng thử lại.';
};

function Rate({ good, total }: { good: number; total: number }) {
    const r = rate(good, total);
    return <b style={{ color: r === null ? '#9db2c6' : tone(r) }}>{r === null ? '—' : `${r}%`}</b>;
}

export default function TeacherClassesPage() {
    const [me, setMe] = useState<any>(null);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<'teach' | 'home' | 'leaves'>('teach');
    const [asg, setAsg] = useState<any[] | null>(null);
    const [detail, setDetail] = useState<any>(null);
    const [open, setOpen] = useState<any>(null);
    const [home, setHome] = useState<any>(null);
    const [q, setQ] = useState('');
    const [leaves, setLeaves] = useState<any[] | null>(null);
    const [lf, setLf] = useState('pending');
    const [toasts, setToasts] = useState<{ id: number; type: string; text: string }[]>([]);

    const toast = useCallback((type: string, text: string) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, text }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    }, []);
    const bad = useCallback((e: any) => toast('error', errMsg(e)), [toast]);

    const loadMe = useCallback(() => API.profile().then(setMe).catch((e) => setErr(`${e?.response?.status ? `[${e.response.status}] ` : ''}${errMsg(e)}`)), []);
    useEffect(() => { loadMe(); API.assignments().then((r) => setAsg(r.data)).catch(() => {}); }, [loadMe]);
    useEffect(() => { if (tab === 'home' && !home && me?.homeroom) API.homeroom().then(setHome).catch(bad); }, [tab, home, me, bad]);
    useEffect(() => { if (tab === 'leaves' && me?.homeroom) { setLeaves(null); API.leaves(lf === 'all' ? undefined : lf).then((r) => setLeaves(r.data)).catch(bad); } }, [tab, lf, me, bad]);
    useEffect(() => {
        const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);

    const openAsg = (x: any) => { setOpen(x); setDetail(null); API.assignment(x.id).then(setDetail).catch(bad); };
    const review = async (l: any, decision: 'approve' | 'reject') => {
        let note: string | undefined;
        if (decision === 'reject') { const n = prompt('Nhập lý do từ chối (bắt buộc):'); if (!n) return; note = n; }
        else if (!confirm(`Duyệt đơn xin nghỉ của ${l.full_name}? Các buổi vắng không phép trong khoảng ngày sẽ chuyển thành vắng có phép.`)) return;
        try {
            const r = await API.review(l.id, { decision, note }); toast('success', r.message);
            API.leaves(lf === 'all' ? undefined : lf).then((x) => setLeaves(x.data)); loadMe(); setHome(null);
        } catch (e) { bad(e); }
    };

    if (err) return (
        <div className="pf at"><div className="pf-card pf-err"><h2>Không tải được thông tin giáo viên</h2><code>{err}</code>
            <p className="pf-mut">{err.startsWith('[403]') ? 'Tài khoản này chưa liên kết với giáo viên. Hãy chạy file teacher_accounts_homeroom.sql rồi đăng nhập lại.' : err.startsWith('[401]') ? 'Hãy đăng xuất rồi đăng nhập lại cổng giáo viên.' : 'Kiểm tra backend đang chạy và đã thêm route /gv/teacher.'}</p>
            <button className="pf-btn" onClick={() => location.reload()}>Thử lại</button></div></div>
    );
    if (!me) return <div className="pf at"><p className="pf-card">Đang tải…</p></div>;

    const hr = me.homeroom, st = me.stats;
    const students = (home?.data || []).filter((s: any) => !q || (s.full_name + s.code).toLowerCase().includes(q.toLowerCase()));
    const hAll = (home?.data || []).reduce((a: any, s: any) => ({ good: a.good + Number(s.present) + Number(s.late), total: a.total + Number(s.total) }), { good: 0, total: 0 });

    return (
        <div className="pf at">
            <div className="pf-toasts" aria-live="polite">
                {toasts.map((x) => <div key={x.id} className={`pf-toast ${x.type}`}><p>{x.text}</p><button onClick={() => setToasts((l) => l.filter((i) => i.id !== x.id))}>✕</button></div>)}
            </div>

            <section className="pf-card at-hero" style={{ gridTemplateColumns: '1fr' }}>
                <div className="at-top">
                    <div><h1>{me.teacher.full_name}</h1><p>{me.teacher.code} · {me.position}</p>
                        <div className="pf-chips">{hr && <span className="pf-chip ok">GVCN lớp {hr.name}</span>}<span className="pf-chip">Bộ môn {me.teacher.main_subject}</span></div></div>
                </div>
                <div className="at-kpis">
                    {([['Lớp đang dạy', st.classes, '#0e6ba8'], ['Môn / lớp được phân công', st.assignments, '#12805c'], ['Sĩ số lớp chủ nhiệm', hr ? st.students : '—', '#d39a12'], ['Đơn xin nghỉ chờ duyệt', hr ? st.pending_leaves : '—', '#c0392b']] as const).map(([l, v, c]) => (
                        <div key={l} className="at-kpi" style={{ ['--c' as any]: c }}><b>{v}</b><span>{l}</span></div>))}
                </div>
            </section>

            <nav className="at-nav" role="tablist">
                <button className={tab === 'teach' ? 'on' : ''} onClick={() => setTab('teach')}>Môn tôi dạy</button>
                {hr && <button className={tab === 'home' ? 'on' : ''} onClick={() => setTab('home')}>Lớp chủ nhiệm {hr.name}</button>}
                {hr && <button className={tab === 'leaves' ? 'on' : ''} onClick={() => setTab('leaves')}>Đơn xin nghỉ{st.pending_leaves > 0 && <em>{st.pending_leaves}</em>}</button>}
            </nav>

            {tab === 'teach' && (<>
                {!asg && <p className="pf-card pf-mut">Đang tải…</p>}
                <div className="at-subs">
                    {(asg || []).map((x) => (
                        <button key={x.id} className="at-sub" onClick={() => openAsg(x)}>
                            <div className="at-sub-h"><b>{x.subject} · Lớp {x.class_name}</b><strong><Rate good={Number(x.good)} total={Number(x.total)} /></strong></div>
                            <small className="pf-mut">{x.students} học sinh · {x.periods_per_week} tiết/tuần</small>
                            <div className="at-track"><i style={{ width: `${rate(Number(x.good), Number(x.total)) || 0}%`, background: tone(rate(Number(x.good), Number(x.total)) ?? 0) }} /></div>
                            <small className="pf-mut">{Number(x.total) ? `${x.total} lượt điểm danh` : 'Chưa có dữ liệu điểm danh'} · Xem từng học sinh →</small>
                        </button>))}
                </div>
            </>)}

            {tab === 'home' && hr && (
                <section className="pf-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="at-month" style={{ padding: '16px 18px 0' }}>
                        <h2>Lớp {hr.name} · Chuyên cần chung {home ? <Rate good={hAll.good} total={hAll.total} /> : ''}</h2>
                        <input className="pf-in" style={{ maxWidth: 260 }} placeholder="Tìm học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    {!home && <p className="pf-mut" style={{ padding: 20 }}>Đang tải…</p>}
                    {home && <table className="at-tbl"><thead><tr><th>Mã HS</th><th>Họ và tên</th><th>Đi học</th><th>Có mặt</th><th>Muộn</th><th>Có phép</th><th>Không phép</th></tr></thead>
                        <tbody>{students.map((s: any) => (
                            <tr key={s.id}><td>{s.code}</td><td><b>{s.full_name}</b></td><td><Rate good={Number(s.present) + Number(s.late)} total={Number(s.total)} /></td>
                                <td>{s.present}</td><td>{s.late}</td><td>{s.excused}</td><td style={{ color: Number(s.unexcused) ? '#c0392b' : undefined, fontWeight: 700 }}>{s.unexcused}</td></tr>))}</tbody></table>}
                </section>
            )}

            {tab === 'leaves' && hr && (<>
                <div className="at-leg" style={{ marginTop: 0 }}>
                    {[['pending', 'Chờ duyệt'], ['all', 'Tất cả'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối']].map(([k, l]) => (
                        <button key={k} className={lf === k ? 'pf-btn' : 'ta-btn'} style={{ padding: '8px 16px' }} onClick={() => setLf(k)}>{l}</button>))}
                </div>
                {!leaves && <p className="pf-card pf-mut">Đang tải…</p>}
                <div className="at-list">
                    {(leaves || []).map((l) => (
                        <div key={l.id} className="at-lv" style={{ ['--c' as any]: LV[l.status][1] }}>
                            <div><b>{l.full_name}</b> <span className="pf-mut">({l.code})</span> <span className="at-badge" style={{ ['--c' as any]: LV[l.status][1] }}>{LV[l.status][0]}</span>
                                <p>{TYPE[l.leave_type]} · {dvn(l.from_date) === dvn(l.to_date) ? dvn(l.from_date) : `${dvn(l.from_date)} → ${dvn(l.to_date)}`}</p>
                                <p className="pf-mut">{l.reason}</p>{l.reviewer_note && <p><b>Phản hồi:</b> {l.reviewer_note}</p>}</div>
                            {l.status === 'pending' && <div style={{ display: 'flex', gap: 8 }}>
                                <button className="pf-btn" style={{ padding: '8px 14px' }} onClick={() => review(l, 'approve')}>Duyệt</button>
                                <button className="ta-btn" style={{ color: '#c0392b' }} onClick={() => review(l, 'reject')}>Từ chối</button></div>}
                        </div>))}
                    {leaves && !leaves.length && <p className="pf-card pf-mut">Không có đơn nào.</p>}
                </div>
            </>)}

            {open && <>
                <div className="at-ov" onClick={() => setOpen(null)} />
                <aside className="at-dr" role="dialog">
                    <header><div><h2>{open.subject} · Lớp {open.class_name}</h2><span className="pf-mut">{open.students} học sinh · {open.periods_per_week} tiết/tuần</span></div>
                        <button className="at-x" onClick={() => setOpen(null)} aria-label="Đóng">✕</button></header>
                    <div className="bd">
                        {!detail && <p className="pf-mut">Đang tải…</p>}
                        {detail && <div className="pf-card" style={{ padding: 0, overflow: 'auto' }}><table className="at-tbl"><thead><tr><th>Học sinh</th><th>Đi học</th><th>Muộn</th><th>Có phép</th><th>Không phép</th></tr></thead>
                            <tbody>{detail.data.map((s: any) => (<tr key={s.id}><td><b>{s.full_name}</b><br /><span className="pf-mut">{s.code}</span></td>
                                <td><Rate good={Number(s.present) + Number(s.late)} total={Number(s.total)} /></td><td>{s.late}</td><td>{s.excused}</td>
                                <td style={{ color: Number(s.unexcused) ? '#c0392b' : undefined, fontWeight: 700 }}>{s.unexcused}</td></tr>))}</tbody></table></div>}
                    </div>
                </aside>
            </>}
        </div>
    );
}