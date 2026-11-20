'use client';
import { useEffect, useState } from 'react';
import { fmtDateTime } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import type { LogItem, TabProps } from './types';
import { Empty, Icon, Pager, SkelRows, useUI } from './ui';

export default function ReportsTab({ meta, scope, tick }: TabProps) {
    const { toast } = useUI();
    const [rows, setRows] = useState<any[] | null>(null);
    const [grade, setGrade] = useState('');
    const [logs, setLogs] = useState<{ data: LogItem[]; current_page: number; last_page: number; total: number } | null>(null);
    const [lp, setLp] = useState(1);

    useEffect(() => {
        setRows(null);
        disciplineService.classReport({ year_id: scope.yearId, semester: scope.semester }).then(setRows).catch((e) => toast('error', 'Không tải được báo cáo', errMsg(e)));
    }, [scope, tick]);
    useEffect(() => {
        if (!meta.permissions.approve) return;
        disciplineService.logs({ page: lp, per_page: 10 }).then(setLogs).catch(() => setLogs(null));
    }, [lp, tick, meta.permissions.approve]);

    const shown = (rows ?? []).filter((r) => !grade || r.grade === Number(grade));
    const total = shown.reduce((a, r) => a + r.violations, 0);

    return (
        <div className="dc-stack">
            <section className="dc-card">
                <div className="dc-card-h"><h3>Báo cáo kỷ luật theo lớp</h3>
                    <select className="dc-select inline" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">Toàn trường</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                    <button className="dc-btn sm" onClick={() => disciplineService.exportCsv({ year_id: scope.yearId, semester: scope.semester }).then(() => toast('success', 'Đã xuất file CSV'))}><Icon n="download" />Xuất chi tiết CSV</button>
                    <button className="dc-btn sm" onClick={() => window.print()}>In báo cáo</button></div>
                {!rows ? <SkelRows /> : !shown.length ? <Empty text="Chưa có dữ liệu lớp" /> : (
                    <div className="dc-table-wrap"><table className="dc-table">
                        <thead><tr><th>Lớp</th><th>GVCN</th><th className="num">Sĩ số</th><th className="num">Vi phạm</th><th className="num">HS vi phạm</th><th className="num">Điểm trừ</th><th className="num">Khen thưởng</th><th className="num">Điểm RL TB</th></tr></thead>
                        <tbody>{shown.map((r) => (
                            <tr key={r.class_id}><td style={{ fontWeight: 600 }}>{r.name}</td><td>{r.homeroom ?? '—'}</td><td className="num">{r.size}</td>
                                <td className="num" style={{ fontWeight: 600, color: r.violations ? 'var(--bad)' : undefined }}>{r.violations}</td><td className="num">{r.students_violated}</td>
                                <td className="num">{r.deducted}</td><td className="num" style={{ color: 'var(--ok)' }}>{r.commendations}</td><td className="num"><b>{r.avg_score}</b></td></tr>))}
                        <tr><td colSpan={3} style={{ fontWeight: 700 }}>Tổng cộng</td><td className="num" style={{ fontWeight: 700 }}>{total}</td><td colSpan={4} /></tr></tbody></table></div>)}
            </section>

            {meta.permissions.approve && (
                <section className="dc-card"><div className="dc-card-h"><h3>Nhật ký hoạt động hệ thống</h3></div>
                    {!logs ? <SkelRows n={5} /> : !logs.data.length ? <Empty text="Chưa có hoạt động" /> : (
                        <div className="dc-list">{logs.data.map((l) => <div key={l.id} className="dc-item"><div className="grow">{l.summary}<small>{l.actor_name} · {fmtDateTime(l.created_at)}</small></div></div>)}</div>)}
                    {logs && <Pager page={logs.current_page} last={logs.last_page} total={logs.total} onPage={setLp} />}
                </section>)}
        </div>
    );
}