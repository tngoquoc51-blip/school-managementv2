'use client';

import { useEffect, useMemo, useState } from 'react';
import { hub } from '../_lib/api';
import { downloadFile, toCsv, toExcelXml } from '../_lib/csv';
import { useToast } from '../_lib/toast';
import type { Dataset } from '../_lib/types';
import { Bar, Icon, Pill, num } from './ui';

type Fmt = 'csv' | 'xls' | 'json';
const stamp = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };

export default function ExportPanel({ datasets, preset, onDone }: { datasets: Dataset[]; preset: string; onDone: () => void }) {
    const toast = useToast();
    const usableSets = datasets.filter((d) => d.table_exists);
    const [dsId, setDsId] = useState(preset || usableSets[0]?.id || '');
    const ds = datasets.find((d) => d.id === dsId) ?? null;
    const fields = useMemo(() => ds?.fields.filter((f) => f.usable) ?? [], [ds]);
    const [cols, setCols] = useState<string[]>([]);
    const [q, setQ] = useState('');
    const [active, setActive] = useState('');
    const [fmt, setFmt] = useState<Fmt>('csv');
    const [head, setHead] = useState<'label' | 'key'>('label');
    const [mask, setMask] = useState(true);
    const [prev, setPrev] = useState<{ rows: Record<string, unknown>[]; total: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const [prog, setProg] = useState(0);

    useEffect(() => { setCols(fields.map((f) => f.key)); }, [fields]);

    useEffect(() => {
        if (!ds || !cols.length) { setPrev(null); return; }
        const t = setTimeout(() => {
            hub.exportRows(ds.id, cols, { q, active }, 1, 8, mask).then((r) => setPrev({ rows: r.rows, total: r.meta.total })).catch(() => setPrev(null));
        }, 350);
        return () => clearTimeout(t);
    }, [ds, cols, q, active, mask]);

    const sensitive = fields.filter((f) => cols.includes(f.key) && f.sensitive);
    const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;

    const run = async () => {
        if (!ds || !cols.length) return;
        setBusy(true); setProg(0);
        try {
            let all: Record<string, unknown>[] = [];
            let page = 1, last = 1;
            do {
                const r = await hub.exportRows(ds.id, cols, { q, active }, page, 1000, mask);
                all = all.concat(r.rows); last = r.meta.last_page;
                setProg(Math.round((page / last) * 100));
                page++;
            } while (page <= last);

            const header = cols.map((k) => (head === 'key' ? k : label(k)));
            const name = `${ds.id}_${stamp()}`;
            if (fmt === 'json') {
                const data = all.map((r) => Object.fromEntries(cols.map((k, i) => [header[i], r[k] ?? null])));
                downloadFile(`${name}.json`, 'application/json;charset=utf-8', JSON.stringify(data, null, 2));
            } else {
                const matrix = [header, ...all.map((r) => cols.map((k) => r[k] ?? ''))];
                if (fmt === 'csv') downloadFile(`${name}.csv`, 'text/csv;charset=utf-8', toCsv(matrix), true);
                else downloadFile(`${name}.xls`, 'application/vnd.ms-excel', toExcelXml(ds.title, matrix));
            }
            await hub.exportLog({ dataset: ds.id, format: fmt, rows: all.length, columns: cols, filters: { q, active }, masked: mask }).catch(() => null);
            toast({ tone: 'success', title: 'Đã xuất dữ liệu', text: `${num(all.length)} dòng · ${fmt.toUpperCase()}${mask ? ' · đã che dữ liệu nhạy cảm' : ''}` });
            onDone();
        } catch (e) {
            toast({ tone: 'error', title: 'Xuất dữ liệu thất bại', text: e instanceof Error ? e.message : '' });
        } finally { setBusy(false); }
    };

    return (
        <div className="dh-grid-side">
            <section className="dh-card">
                <header><h2>Xuất dữ liệu</h2></header>
                <div className="dh-form">
                    <label>Loại dữ liệu
                        <select className="dh-in" value={dsId} onChange={(e) => setDsId(e.target.value)}>
                            {usableSets.map((d) => <option key={d.id} value={d.id}>{d.title} ({num(d.count)})</option>)}
                        </select>
                    </label>
                    <label>Tìm kiếm (tùy chọn)<input className="dh-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tên, mã, email…" /></label>
                    {fields.some((f) => f.key === 'is_active') && (
                        <label>Trạng thái
                            <select className="dh-in" value={active} onChange={(e) => setActive(e.target.value)}>
                                <option value="">Tất cả</option><option value="1">Đang hoạt động</option><option value="0">Đã ngừng</option>
                            </select>
                        </label>
                    )}
                </div>

                <div className="dh-bar-row"><h3 className="dh-h3">Cột cần xuất</h3>
                    <span><button className="dh-link" onClick={() => setCols(fields.map((f) => f.key))}>Chọn hết</button> · <button className="dh-link" onClick={() => setCols([])}>Bỏ hết</button></span></div>
                <div className="dh-chips">
                    {fields.map((f) => (
                        <label key={f.key} className={`dh-chip pick${cols.includes(f.key) ? ' req' : ''}`}>
                            <input type="checkbox" checked={cols.includes(f.key)} onChange={(e) => setCols(e.target.checked ? [...cols, f.key] : cols.filter((k) => k !== f.key))} />
                            {f.label}{f.sensitive && <Icon n="shield" s={12} />}
                        </label>
                    ))}
                </div>

                <div className="dh-form">
                    <label>Định dạng
                        <select className="dh-in" value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)}>
                            <option value="csv">CSV (UTF-8, mở bằng Excel)</option>
                            <option value="xls">Excel (.xls)</option>
                            <option value="json">JSON</option>
                        </select>
                    </label>
                    <label>Tên cột
                        <select className="dh-in" value={head} onChange={(e) => setHead(e.target.value as 'label' | 'key')}>
                            <option value="label">Tiếng Việt (dễ đọc)</option>
                            <option value="key">Tên kỹ thuật</option>
                        </select>
                    </label>
                </div>

                <label className="dh-check"><input type="checkbox" checked={mask} onChange={(e) => setMask(e.target.checked)} />
                    <span><b>Che dữ liệu nhạy cảm</b> (số điện thoại, email, địa chỉ, ngày sinh)</span></label>
                {!mask && sensitive.length > 0 && <div className="dh-alert warn"><Icon n="alert" s={18} /><span>File sẽ chứa dữ liệu cá nhân đầy đủ ({sensitive.map((f) => f.label).join(', ')}). Chỉ xuất khi cần thiết và bảo quản cẩn thận. Lần xuất này sẽ được ghi nhật ký.</span></div>}

                {busy && <Bar value={prog} label={`Đang xuất… ${prog}%`} />}
                <button className="dh-btn lg" onClick={run} disabled={busy || !cols.length || !ds}><Icon n="download" s={18} />Xuất {prev ? num(prev.total) : ''} dòng</button>
            </section>

            <section className="dh-card">
                <header><h2>Xem trước</h2>{prev && <Pill tone="pri">{num(prev.total)} dòng</Pill>}</header>
                {!prev ? <p className="dh-mut">Chọn ít nhất một cột để xem trước.</p> : (
                    <div className="dh-tw"><table className="dh-table">
                        <thead><tr>{cols.map((k) => <th key={k}>{label(k)}</th>)}</tr></thead>
                        <tbody>{prev.rows.map((r, i) => <tr key={i}>{cols.map((k) => <td key={k}>{String(r[k] ?? '')}</td>)}</tr>)}
                        {!prev.rows.length && <tr><td colSpan={cols.length} className="dh-mut">Không có dữ liệu phù hợp.</td></tr>}</tbody>
                    </table></div>
                )}
            </section>
        </div>
    );
}