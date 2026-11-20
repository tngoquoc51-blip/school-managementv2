'use client';
// Báo cáo dự giờ toàn trường (/teacher/observations/bao-cao) – dành cho Ban giám hiệu / giáo vụ
import React, { useMemo, useState } from 'react';
import { ADMIN_ROLES, Bar, Btn, Card, Donut2, Empty, ErrorBox, Ico, Loading, Pill, RATING, Rating, RatingPill, STATUS, SStatus, ob, useLoad, useTa } from '../_ob';

type T = { id: number; name: string; observer_n: number; taught_n: number; upcoming: number; avg_percent: number | null; avg_rating: Rating | null; observe_ok: boolean; taught_ok: boolean };
type Rep = {
    totals: { sessions: number; by_status: Record<string, number>; evals: number; avg_percent: number | null; avg_rating: Rating | null; teachers: number; below_observe: number; below_taught: number };
    settings: { quota_observe: number; quota_taught: number }; by_kind: { kind: string; label: string; n: number }[]; distribution: Record<string, number>;
    by_month: { m: string; n: number }[]; groups: { name: string; percent: number }[]; teachers: T[]; years: { id: number; name: string }[];
};
const tone = (p: number) => (p >= 85 ? '#059669' : p >= 70 ? '#0284c7' : p >= 50 ? '#d97706' : '#e11d48');
const KC = ['#0284c7', '#7c3aed', '#0d9488', '#d97706', '#e11d48'];

export default function Page() {
    const { staff } = useTa(); const admin = ADMIN_ROLES.includes(staff?.role || '');
    const [year, setYear] = useState('current'); const { data, err, loading, reload } = useLoad(() => (admin ? ob<Rep>(`report?year=${year}`) : Promise.resolve(null as unknown as Rep)), [year, admin]);
    const [q, setQ] = useState(''); const [lack, setLack] = useState(false); const [sort, setSort] = useState<'name' | 'observer_n' | 'taught_n' | 'avg_percent'>('name'); const [dir, setDir] = useState(1);
    const rows = useMemo(() => {
        if (!data) return []; const k = q.trim().toLowerCase();
        return data.teachers.filter((t) => (!k || t.name.toLowerCase().includes(k)) && (!lack || !t.observe_ok || !t.taught_ok))
            .sort((a, b) => { const x = a[sort] ?? -1, y = b[sort] ?? -1; return (typeof x === 'string' ? x.localeCompare(y as string, 'vi') : (x as number) - (y as number)) * dir; });
    }, [data, q, lack, sort, dir]);
    if (!admin) return <div className="ta-page"><Card><Empty icon="lock" title="Chỉ dành cho Ban giám hiệu / giáo vụ" text="Bạn xem được kết quả của chính mình ở mục Kết quả." /></Card></div>;
    if (loading && !data) return <div className="ta-page"><Loading /></div>; if (err || !data) return <div className="ta-page"><ErrorBox msg={err || 'Lỗi'} retry={reload} /></div>;
    const t = data.totals; const set = data.settings; const maxM = Math.max(1, ...data.by_month.map((m) => m.n));
    const th = (k: typeof sort, l: string) => <th><button type="button" className="ob-link" onClick={() => { if (sort === k) setDir(-dir); else { setSort(k); setDir(1); } }}>{l}{sort === k ? (dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>;
    const csv = () => {
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['Giáo viên', 'Số tiết đã dự', `Chỉ tiêu dự (${set.quota_observe})`, 'Số tiết được dự', `Chỉ tiêu được dự (${set.quota_taught})`, 'Điểm TB (%)', 'Xếp loại', 'Sắp tới'].map(esc).join(',')]
            .concat(rows.map((r) => [r.name, r.observer_n, r.observe_ok ? 'Đạt' : 'Chưa đạt', r.taught_n, r.taught_ok ? 'Đạt' : 'Chưa đạt', r.avg_percent ?? '', r.avg_rating ?? '', r.upcoming].map(esc).join(',')));
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `bao-cao-du-gio-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    };
    const kpi = (l: string, v: React.ReactNode, e: string, c: string, cs: string, ic: string) => <div className="ob-kpi" style={{ ['--c' as string]: c, ['--cs' as string]: cs }}><div className="top"><small>{l}</small><span className="ic"><Ico n={ic} size={17} /></span></div><b>{v}</b><em>{e}</em></div>;
    return (
        <div className="ta-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <p className="ta-mute">Số liệu dự giờ toàn trường theo năm học. Chỉ tiêu: dự {set.quota_observe} tiết · được dự {set.quota_taught} tiết (chỉnh ở mục Tiêu chí).</p>
                <select className="ta-sel" value={year} onChange={(e) => setYear(e.target.value)}><option value="current">Năm học hiện tại</option><option value="all">Tất cả năm học</option>{data.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
            </div>
            <div className="ob-kpis">
                {kpi('Buổi dự giờ', t.sessions, `${t.by_status.completed || 0} hoàn thành`, '#0284c7', '#e0f2fe', 'cal')}
                {kpi('Phiếu đã nộp', t.evals, 'nhận xét', '#7c3aed', '#ede9fe', 'doc')}
                {kpi('Điểm trung bình', `${t.avg_percent ?? 0}%`, t.avg_rating || 'Chưa có', t.avg_rating ? RATING[t.avg_rating].c : '#64748b', t.avg_rating ? RATING[t.avg_rating].cs : '#e2e8f0', 'stats')}
                {kpi('Chưa đủ tiết dự', t.below_observe, `/ ${t.teachers} giáo viên`, '#d97706', '#fef3c7', 'alert')}
                {kpi('Chưa đủ tiết được dự', t.below_taught, `/ ${t.teachers} giáo viên`, '#e11d48', '#ffe4e9', 'alert')}
            </div>
            <div className="ob-grid2">
                <Card title="Xếp loại phiếu"><Donut2 items={(Object.keys(RATING) as Rating[]).map((k) => ({ label: k, n: data.distribution[k] || 0, c: RATING[k].c }))} /></Card>
                <Card title="Trạng thái &amp; loại buổi dự giờ">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>{(Object.keys(STATUS) as SStatus[]).map((k) => <Pill key={k} tone={STATUS[k].tone}>{STATUS[k].label}: {t.by_status[k] || 0}</Pill>)}</div>
                    <Donut2 items={data.by_kind.map((k, i) => ({ label: k.label, n: k.n, c: KC[i % KC.length] }))} />
                </Card>
            </div>
            <div className="ob-grid2">
                <Card title="Số buổi theo tháng">{data.by_month.length === 0 ? <Empty icon="cal" title="Chưa có dữ liệu" /> : data.by_month.map((m) => <div key={m.m} className="ob-hbar" style={{ gridTemplateColumns: '70px 1fr 36px' }}><span>{m.m.slice(5)}/{m.m.slice(0, 4)}</span><div className="trk"><i style={{ width: `${(m.n / maxM) * 100}%`, background: '#0284c7' }} /></div><b>{m.n}</b></div>)}</Card>
                <Card title="Điểm trung bình theo nhóm tiêu chí">{data.groups.length === 0 ? <Empty icon="stats" title="Chưa có phiếu" /> : data.groups.map((g) => <div key={g.name} className="ob-hbar"><span>{g.name}</span><div className="trk"><i style={{ width: `${g.percent}%`, background: tone(g.percent) }} /></div><b>{g.percent}%</b></div>)}</Card>
            </div>
            <Card title="Thực hiện chỉ tiêu theo giáo viên" right={<Btn size="sm" onClick={csv}><Ico n="download" size={14} />Xuất CSV</Btn>} pad={false}>
                <div style={{ display: 'flex', gap: 10, padding: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input placeholder="Tìm giáo viên…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={lack} onChange={(e) => setLack(e.target.checked)} />Chỉ hiện người chưa đủ chỉ tiêu</label>
                    <span className="ta-mute" style={{ marginLeft: 'auto' }}>{rows.length} giáo viên</span>
                </div>
                <div className="ob-tbl-wrap"><table className="ob-tbl"><thead><tr>{th('name', 'Giáo viên')}{th('observer_n', `Đã dự (/${set.quota_observe})`)}{th('taught_n', `Được dự (/${set.quota_taught})`)}{th('avg_percent', 'Điểm TB')}<th>Sắp tới</th></tr></thead>
                    <tbody>{rows.length === 0 ? <tr><td colSpan={5}><Empty icon="users" title="Không có giáo viên phù hợp" /></td></tr> : rows.map((r) => (
                        <tr key={r.id}><td><b>{r.name}</b></td>
                            <td><div style={{ minWidth: 120 }}>{r.observer_n}{r.observe_ok ? <Pill tone="green">Đạt</Pill> : null}<Bar value={Math.min(100, (r.observer_n / Math.max(1, set.quota_observe)) * 100)} tone={r.observe_ok ? 'green' : 'amber'} slim /></div></td>
                            <td><div style={{ minWidth: 110 }}>{r.taught_n}{r.taught_ok ? <Pill tone="green">Đạt</Pill> : null}<Bar value={Math.min(100, (r.taught_n / Math.max(1, set.quota_taught)) * 100)} tone={r.taught_ok ? 'green' : 'rose'} slim /></div></td>
                            <td>{r.avg_rating ? <RatingPill rating={r.avg_rating} percent={r.avg_percent} /> : <span className="ta-mute">—</span>}</td><td>{r.upcoming || '—'}</td></tr>))}</tbody></table></div>
            </Card>
        </div>
    );
}