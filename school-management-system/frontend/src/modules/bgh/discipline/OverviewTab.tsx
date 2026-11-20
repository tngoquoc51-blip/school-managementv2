'use client';
import { useEffect, useState } from 'react';
import { fmtDate } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import type { TabProps } from './types';
import { Avatar, Donut, Empty, HBars, Icon, RankBadge, Skel, StatusBadge, TrendChart, rankColor, useUI } from './ui';

export default function OverviewTab({ scope, tick, goTab, openRecord, openStudent }: TabProps) {
    const { toast } = useUI();
    const [d, setD] = useState<any>(null);
    useEffect(() => {
        setD(null);
        disciplineService.overview({ year_id: scope.yearId, semester: scope.semester }).then(setD).catch((e) => toast('error', 'Không tải được tổng quan', errMsg(e)));
    }, [scope.yearId, scope.semester, tick]);

    if (!d) return <div className="dc-stack"><div className="dc-kpis">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={78} />)}</div><Skel h={260} /></div>;

    const diff = d.this_month - d.last_month;
    const kpis = [
        { label: 'Vi phạm đã ghi nhận', v: d.valid, ic: 'alert', c: '#e5662a', bg: '#fdeee6', go: () => goTab('records', { status: '' }),
            extra: d.last_month || d.this_month ? <em className={diff > 0 ? 'up' : 'down'}>{diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff)} so với tháng trước</em> : null },
        { label: 'Chờ duyệt', v: d.pending, ic: 'clock', c: '#b97900', bg: '#fff1cf', go: () => goTab('records', { status: 'pending' }) },
        { label: 'Vi phạm nặng', v: d.severe, ic: 'shield', c: '#c42b45', bg: '#fde3e8', go: () => goTab('records', { severity: '3' }) },
        { label: 'Học sinh liên quan', v: d.students, ic: 'user', c: '#2a6fdb', bg: '#e1ecfd', sub: `/${d.enrolled} học sinh` },
        { label: 'Khen thưởng', v: d.commend, ic: 'star', c: '#12935f', bg: '#dcf5ea', go: () => goTab('commendations') },
        { label: 'Khiếu nại chờ xử lý', v: d.appeals_pending, ic: 'chat', c: '#7a3fd1', bg: '#efe6fb', go: () => goTab('appeals') },
    ];
    const dist = d.rank_distribution as Record<string, number>;

    return (
        <div className="dc-stack">
            <div className="dc-kpis">
                {kpis.map((k) => (
                    <div key={k.label} className={`dc-kpi ${k.go ? 'link' : ''}`} onClick={k.go}>
                        <div className="ic" style={{ background: k.bg, color: k.c }}><Icon n={k.ic} /></div>
                        <div><b>{k.v}{k.sub && <small style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}> {k.sub}</small>}</b><span>{k.label}</span>{k.extra}</div>
                    </div>
                ))}
            </div>

            <div className="dc-cols">
                <section className="dc-card"><div className="dc-card-h"><h3>Diễn biến vi phạm 30 ngày gần nhất</h3></div><div className="dc-card-b"><TrendChart data={d.trend} /></div></section>
                <section className="dc-card"><div className="dc-card-h"><h3>Hạnh kiểm đề xuất toàn trường</h3></div>
                    <div className="dc-card-b"><Donut parts={(['Tốt', 'Khá', 'Đạt', 'Chưa đạt'] as const).map((r) => ({ label: r, value: dist[r] ?? 0, color: rankColor(r) }))} /></div></section>
            </div>

            <div className="dc-cols">
                <section className="dc-card"><div className="dc-card-h"><h3>Lỗi vi phạm phổ biến</h3></div>
                    <div className="dc-card-b"><HBars rows={d.by_category.map((c: any) => ({ label: c.name, value: c.count, color: ['', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'][c.severity] }))} /></div></section>
                <section className="dc-card"><div className="dc-card-h"><h3>Lớp có nhiều vi phạm nhất</h3><button className="dc-btn sm ghost" onClick={() => goTab('reports')}>Xem báo cáo</button></div>
                    <div className="dc-card-b"><HBars rows={d.by_class.map((c: any) => ({ label: `Lớp ${c.name}`, value: c.count }))} color="var(--ink-3)" /></div></section>
            </div>

            <div className="dc-cols">
                <section className="dc-card"><div className="dc-card-h"><h3>Học sinh cần quan tâm</h3><span style={{ fontSize: 12, color: 'var(--muted)' }}>Điểm rèn luyện thấp nhất</span></div>
                    <div className="dc-list">
                        {!d.watchlist.length && <Empty icon="ok" text="Chưa có học sinh nào bị trừ điểm" />}
                        {d.watchlist.map((w: any) => (
                            <div key={w.student_id} className="dc-item click" onClick={() => openStudent(w.student_id)}>
                                <Avatar name={w.full_name} /><div className="grow"><b>{w.full_name}</b><small>Lớp {w.class_name} · {w.violations} vi phạm</small></div>
                                <span className="dc-score" style={{ color: rankColor(w.rank) }}>{w.score}</span><RankBadge r={w.rank} />
                            </div>
                        ))}
                    </div></section>
                <section className="dc-card"><div className="dc-card-h"><h3>Biên bản mới nhất</h3><button className="dc-btn sm ghost" onClick={() => goTab('records')}>Tất cả</button></div>
                    <div className="dc-list">
                        {!d.recent.length && <Empty text="Chưa có biên bản nào" />}
                        {d.recent.map((r: any) => (
                            <div key={r.id} className="dc-item click" onClick={() => openRecord(r.id)}>
                                <div className="grow"><b>{r.student_name}</b> · {r.class_name}<small>{r.category_name} · {fmtDate(r.occurred_at)}</small></div>
                                <StatusBadge s={r.status} />
                            </div>
                        ))}
                    </div></section>
            </div>
        </div>
    );
}