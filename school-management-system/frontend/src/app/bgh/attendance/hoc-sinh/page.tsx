'use client';

import React, { useEffect, useState } from 'react';
import { StudentDrawer, StudentRow } from '../_student';
import { Avatar, Card, Empty, ErrorBox, Ico, Loading, Pager, Pill, RangeBar, RatePill, StackBar, Tabs, ca, num, presetRange, qs, useCa, useDebounced, useLoad } from '../_ca';

type Filter = 'all' | 'risk' | 'perfect' | 'nodata';

export default function Students() {
    const { meta } = useCa();
    const [range, setRange] = useState(presetRange('month'));
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [cls, setCls] = useState(0); const [grade, setGrade] = useState(0);
    const [filter, setFilter] = useState<Filter>('all'); const [sort, setSort] = useState('absent'); const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const f = sp.get('filter'); if (f && ['risk', 'perfect', 'nodata'].includes(f)) setFilter(f as Filter);
        const o = Number(sp.get('open') || 0); if (o) setOpen(o);
    }, []);

    const { data, err, loading, reload } = useLoad(() => ca<StudentRow[]>(`students${qs({ from: range.from, to: range.to, q: dq, class_id: cls, grade, filter, sort, page, per: 20 })}`), [range.from, range.to, dq, cls, grade, filter, sort, page]);
    const c = data?.counts ?? {}; const rows = data?.data ?? [];
    const good = Number(meta?.settings.good_rate ?? 95), warn = Number(meta?.settings.warn_rate ?? 85);
    const grades = Array.from(new Set((meta?.classes ?? []).map((x) => x.grade))).sort((a, b) => a - b);
    const reset = () => setPage(1);

    return (
        <div className="ca-page">
            <div className="ca-ptitle"><div><h2>Chuyên cần từng học sinh</h2><p>Tra cứu theo tên, mã hoặc lớp. Bấm vào học sinh để xem lịch điểm danh, đơn nghỉ và hồ sơ theo dõi.</p></div></div>
            <RangeBar value={range} onChange={(r) => { setRange(r); reset(); }} />
            <Tabs<Filter> value={filter} onChange={(k) => { setFilter(k); reset(); }} items={[
                { key: 'all', label: 'Tất cả', count: c.all ?? 0 }, { key: 'risk', label: `Dưới ${warn}%`, count: c.risk ?? 0, tone: 'rose' },
                { key: 'perfect', label: 'Không vắng, không muộn', count: c.perfect ?? 0, tone: 'green' }, { key: 'nodata', label: 'Chưa có dữ liệu', count: c.nodata ?? 0 },
            ]} />
            <div className="ca-filters">
                <label className="ca-search"><Ico n="search" size={16} /><input placeholder="Tìm theo họ tên hoặc mã học sinh…" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} /></label>
                <select value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setCls(0); reset(); }}><option value={0}>Mọi khối</option>{grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                <select value={cls} onChange={(e) => { setCls(Number(e.target.value)); reset(); }}><option value={0}>Mọi lớp</option>{(meta?.classes ?? []).filter((x) => !grade || x.grade === grade).map((x) => <option key={x.id} value={x.id}>Lớp {x.name}</option>)}</select>
                <select value={sort} onChange={(e) => { setSort(e.target.value); reset(); }}><option value="absent">Vắng nhiều nhất</option><option value="rate">Tỉ lệ thấp nhất</option><option value="name">Theo lớp và tên</option></select>
            </div>
            <Card pad={false}>
                {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : rows.length === 0 ? <Empty icon="user" title="Không có học sinh phù hợp" text="Thử đổi khoảng ngày hoặc bỏ bớt bộ lọc." /> : (
                    <div className="ca-tablewrap"><table className="ca-tbl big">
                        <thead><tr><th>Học sinh</th><th>Lớp</th><th style={{ minWidth: 190 }}>Cơ cấu</th><th>Có mặt</th><th>Muộn</th><th>Vắng</th><th>Tỉ lệ</th></tr></thead>
                        <tbody>{rows.map((s) => (
                            <tr key={s.id} onClick={() => setOpen(s.id)}>
                                <td><div className="ca-who2"><Avatar name={s.name} tone="teal" /><div><b>{s.name}</b><small>{s.code}</small></div></div></td>
                                <td>{s.class_name}</td><td><StackBar c={s} /></td>
                                <td>{num(s.present)}</td><td>{s.late ? <Pill tone="amber">{s.late}</Pill> : 0}</td>
                                <td>{s.absent ? <>{s.absent}{s.unexcused ? <small className="rj">{s.unexcused} không phép</small> : <small>có phép</small>}</> : 0}</td>
                                <td><RatePill c={s} good={good} warn={warn} /></td>
                            </tr>
                        ))}</tbody></table></div>
                )}
                {data?.meta && rows.length > 0 && <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />}
            </Card>
            {open !== null && <StudentDrawer id={open} range={range} onClose={() => setOpen(null)} onChanged={reload} />}
        </div>
    );
}