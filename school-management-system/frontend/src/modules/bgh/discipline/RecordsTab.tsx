'use client';
import { useCallback, useEffect, useState } from 'react';
import { fmtDateTime, GROUPS, SEVERITY, STATUS } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import type { DiscRecord, Paged, TabProps } from './types';
import { Avatar, Empty, Icon, Pager, Sev, SkelRows, StatusBadge, useUI } from './ui';

export default function RecordsTab({ meta, scope, tick, openRecord, newRecord, filter }: TabProps) {
    const { toast } = useUI();
    const init = { q: '', class_id: '', grade: '', category_id: '', group: '', severity: '', status: '', from: '', to: '', ...(filter ?? {}) };
    const [f, setF] = useState(init);
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Paged<DiscRecord> | null>(null);
    const [sort, setSort] = useState<{ k: string; dir: 'asc' | 'desc' }>({ k: 'occurred_at', dir: 'desc' });

    useEffect(() => { if (filter) { setF({ ...init, ...filter }); setPage(1); } }, [filter]);

    const params = useCallback(() => ({ ...f, year_id: scope.yearId, semester: scope.semester, sort: sort.k, dir: sort.dir }), [f, scope, sort]);
    const load = useCallback(() => {
        setData(null);
        disciplineService.records({ ...params(), page, per_page: 15 }).then(setData).catch((e) => { toast('error', 'Không tải được danh sách', errMsg(e)); setData({ data: [], current_page: 1, last_page: 1, total: 0, per_page: 15 }); });
    }, [params, page]);
    useEffect(() => { const t = setTimeout(load, f.q ? 300 : 0); return () => clearTimeout(t); }, [load, tick]);

    const set = (k: string, v: string) => { setF((s) => ({ ...s, [k]: v })); setPage(1); };
    const th = (k: string, label: string) => (
        <th style={{ cursor: 'pointer' }} onClick={() => setSort((s) => ({ k, dir: s.k === k && s.dir === 'desc' ? 'asc' : 'desc' }))}>
            {label}{sort.k === k ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}</th>
    );
    const hasFilter = Object.values(f).some(Boolean);

    return (
        <section className="dc-card">
            <div className="dc-card-h">
                <h3>Biên bản vi phạm</h3>
                <button className="dc-btn sm" onClick={() => disciplineService.exportCsv(params()).then(() => toast('success', 'Đã xuất file CSV')).catch((e) => toast('error', 'Xuất file thất bại', errMsg(e)))}><Icon n="download" />Xuất CSV</button>
                <button className="dc-btn sm primary" onClick={newRecord}><Icon n="plus" />Ghi nhận mới</button>
            </div>
            <div className="dc-filters">
                <input className="dc-input" placeholder="Tìm tên, mã học sinh, mã biên bản…" value={f.q} onChange={(e) => set('q', e.target.value)} />
                <select className="dc-select" value={f.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="">Mọi trạng thái</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                <select className="dc-select" value={f.grade} onChange={(e) => { set('grade', e.target.value); set('class_id', ''); }}>
                    <option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <select className="dc-select" value={f.class_id} onChange={(e) => set('class_id', e.target.value)}>
                    <option value="">Mọi lớp</option>{meta.classes.filter((c) => !f.grade || c.grade === Number(f.grade)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className="dc-select" value={f.group} onChange={(e) => set('group', e.target.value)}>
                    <option value="">Mọi nhóm lỗi</option>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
                <select className="dc-select" value={f.severity} onChange={(e) => set('severity', e.target.value)}>
                    <option value="">Mọi mức độ</option>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input type="date" className="dc-input" style={{ width: 150 }} value={f.from} onChange={(e) => set('from', e.target.value)} title="Từ ngày" />
                <input type="date" className="dc-input" style={{ width: 150 }} value={f.to} onChange={(e) => set('to', e.target.value)} title="Đến ngày" />
                {hasFilter && <button className="dc-btn sm ghost" onClick={() => { setF({ q: '', class_id: '', grade: '', category_id: '', group: '', severity: '', status: '', from: '', to: '' }); setPage(1); }}>Xóa lọc</button>}
            </div>
            {!data ? <SkelRows /> : !data.data.length ? <Empty text={hasFilter ? 'Không có biên bản khớp bộ lọc' : 'Chưa có biên bản vi phạm nào'} /> : (
                <div className="dc-table-wrap">
                    <table className="dc-table">
                        <thead><tr><th>Mã</th>{th('occurred_at', 'Thời gian')}<th>Học sinh</th><th>Lỗi vi phạm</th><th>Mức độ</th>{th('points', 'Điểm trừ')}<th>Trạng thái</th></tr></thead>
                        <tbody>
                        {data.data.map((r) => (
                            <tr key={r.id} className="row" onClick={() => openRecord(r.id)}>
                                <td style={{ fontWeight: 600 }}>{r.code}</td><td>{fmtDateTime(r.occurred_at)}</td>
                                <td><div className="dc-cell"><Avatar name={r.student_name} /><div>{r.student_name}<small>{r.student_code} · {r.class_name}</small></div></div></td>
                                <td>{r.category_name}<small style={{ display: 'block', color: 'var(--muted)' }}>{r.group_name}</small></td>
                                <td><Sev n={r.severity} /></td><td style={{ color: 'var(--bad)', fontWeight: 600 }}>-{r.points}</td><td><StatusBadge s={r.status} /></td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} />}
        </section>
    );
}