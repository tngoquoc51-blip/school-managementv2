'use client';

import { useMemo, useState } from 'react';
import { Card, Confirm, ErrorBox, HBars, Loading, Pill, WriteNote, bytes, dt, dur, mon, num, useLoad, useMon } from '../_hl';

export default function Database() {
    const { canWrite, toast } = useMon();
    const { data, err, loading, reload } = useLoad<any>('database', 120);
    const [q, setQ] = useState('');
    const [counts, setCounts] = useState<Record<string, number | null> | null>(null);
    const [busy, setBusy] = useState('');
    const [ask, setAsk] = useState<{ key: string; label: string; n: number } | null>(null);

    const list = useMemo(() => (data?.tables || []).filter((t: any) => t.name.includes(q.trim().toLowerCase())), [data, q]);
    if (loading && !data) return <Loading rows={5} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const d = data!, s = d.status;
    const top = d.tables.slice(0, 8).map((t: any) => ({ label: t.name, value: t.data_b + t.index_b }));

    const exact = async () => { setBusy('count'); try { setCounts(await mon('database/counts')); toast('Đã đếm chính xác số dòng các bảng sm_*.'); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); } };
    const analyze = async (t: string) => { setBusy(t); try { const r: any = await mon('database/analyze', { method: 'POST', body: { table: t } }); toast(r.message); reload(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(''); } };

    return (
        <div className="hl-stack">
            <WriteNote />
            <div className="hl-kpis six">
                <div className="hl-kpi t-indigo"><span>Dung lượng CSDL</span><b>{bytes(d.total_b)}</b><small>{d.tables.length} bảng · {d.database}</small></div>
                <div className="hl-kpi t-blue"><span>MySQL</span><b>{String(d.version).split('-')[0]}</b><small>chạy {dur(s.uptime_s)}</small></div>
                <div className="hl-kpi t-teal"><span>Kết nối</span><b>{s.threads} / {s.max_conn}</b><small>{s.running} đang chạy truy vấn</small></div>
                <div className="hl-kpi t-violet"><span>Tổng truy vấn</span><b>{num(s.queries)}</b><small>từ lúc khởi động</small></div>
                <div className={`hl-kpi t-${s.slow > 0 ? 'amber' : 'green'}`}><span>Truy vấn chậm</span><b>{num(s.slow)}</b><small>{s.aborted} kết nối bị hủy</small></div>
                <div className={`hl-kpi t-${s.buffer_hit !== null && s.buffer_hit < 95 ? 'amber' : 'green'}`}><span>Buffer pool hit</span><b>{s.buffer_hit ?? '—'}{s.buffer_hit !== null && '%'}</b><small>càng cao càng tốt</small></div>
            </div>

            <div className="hl-grid2 even">
                <Card title="Bảng chiếm nhiều dung lượng nhất"><HBars items={top} fmt={bytes} tone="indigo" /></Card>
                <Card title="Dọn dẹp dữ liệu tạm" sub="Xóa bản ghi không còn giá trị sử dụng">
                    <ul className="hl-clean">{d.cleanup.map((c: any) => (
                        <li key={c.key}><div><b>{c.label}</b><small>{num(c.n)} bản ghi</small></div>
                            {canWrite && <button className="hl-btn sm" disabled={!c.n} onClick={() => setAsk(c)}>Dọn</button>}</li>))}</ul>
                </Card>
            </div>

            <Card title="Danh sách bảng" right={<div className="hl-row">
                <input className="hl-in" placeholder="Tìm bảng…" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="hl-btn" onClick={exact} disabled={busy === 'count'}>{busy === 'count' ? 'Đang đếm…' : 'Đếm chính xác số dòng'}</button></div>} flush>
                <div className="hl-tw"><table className="hl-table">
                    <thead><tr><th>Bảng</th><th>Engine</th><th className="r">Số dòng</th><th className="r">Dữ liệu</th><th className="r">Chỉ mục</th><th className="r">Tổng</th><th>Cập nhật</th>{canWrite && <th />}</tr></thead>
                    <tbody>{list.map((t: any) => (
                        <tr key={t.name}><td><span className="mono">{t.name}</span></td><td>{t.engine}</td>
                            <td className="r">{counts && counts[t.name] != null ? <b>{num(counts[t.name])}</b> : <>~{num(t.est_rows)}</>}</td>
                            <td className="r">{bytes(t.data_b)}</td><td className="r">{bytes(t.index_b)}</td><td className="r"><b>{bytes(t.data_b + t.index_b)}</b></td>
                            <td>{t.update_time ? dt(t.update_time) : '—'}</td>
                            {canWrite && <td className="r">{/^sm_/.test(t.name) && <button className="hl-btn sm" disabled={busy === t.name} onClick={() => analyze(t.name)}>{busy === t.name ? '…' : 'Phân tích'}</button>}</td>}</tr>))}</tbody>
                </table></div>
            </Card>
            <p className="hl-hint">“~” là số dòng ước lượng của InnoDB. Bấm “Đếm chính xác” để đếm thật (chỉ bảng sm_*). “Phân tích” cập nhật thống kê chỉ mục, an toàn và không khóa dữ liệu lâu.</p>

            {ask && <Confirm title="Dọn dẹp dữ liệu" okText="Dọn ngay" danger text={<>Xóa <b>{num(ask.n)}</b> bản ghi: {ask.label.toLowerCase()}? Hành động được ghi vào nhật ký.</>} onClose={() => setAsk(null)}
                             onOk={async () => { try { const r: any = await mon('database/cleanup', { method: 'POST', body: { target: ask.key } }); toast(r.message); setAsk(null); reload(); } catch (e: any) { toast(e.message, 'err'); } }} />}
        </div>
    );
}