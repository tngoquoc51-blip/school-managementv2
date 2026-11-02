'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { hub } from '../_lib/api';
import { DhError } from '../_lib/http';
import { downloadFile, toCsv } from '../_lib/csv';
import { sampleValue } from '../_lib/mapping';
import { MODE_LABEL, STATUS_LABEL } from '../_lib/types';
import type { Dataset, Limits, Overview } from '../_lib/types';
import { ToastProvider, useToast } from '../_lib/toast';
import { Bar, Icon, Pill, fmtDT, num } from './ui';
import ConnectionPanel from './ConnectionPanel';
import ImportWizard from './ImportWizard';
import ExportPanel from './ExportPanel';
import HistoryTab from './HistoryTab';
import '../datahub.css';

type Tab = 'overview' | 'import' | 'export' | 'history';

const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'table' },
    { id: 'import', label: 'Nhập dữ liệu', icon: 'upload' },
    { id: 'export', label: 'Xuất dữ liệu', icon: 'download' },
    { id: 'history', label: 'Lịch sử & hoàn tác', icon: 'history' },
];

const tone = (s: string): 'ok' | 'warn' | 'err' | 'mut' | 'pri' =>
    s === 'completed' ? 'ok' : s === 'completed_with_errors' ? 'warn' : s === 'running' ? 'pri' : s === 'undone' ? 'mut' : 'err';

function Inner() {
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('overview');
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [limits, setLimits] = useState<Limits>({ chunk: 500, total: 20000, undo_days: 14 });
    const [ov, setOv] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<{ message: string; status?: number } | null>(null);
    const [preset, setPreset] = useState('');
    const [tick, setTick] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await hub.datasets();
            setDatasets(d.datasets);
            setLimits(d.limits);
            setOv(await hub.overview().catch(() => null));
        } catch (e) {
            setError({ message: e instanceof Error ? e.message : 'Không tải được dữ liệu.', status: e instanceof DhError ? e.status : undefined });
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const refreshed = () => { setTick((t) => t + 1); hub.overview().then(setOv).catch(() => {}); hub.datasets().then((d) => setDatasets(d.datasets)).catch(() => {}); };
    const go = (t: Tab, ds = '') => { setPreset(ds); setTab(t); };

    const template = (d: Dataset) => {
        const f = d.fields.filter((x) => x.usable);
        downloadFile(`${d.id}-file-mau.csv`, 'text/csv;charset=utf-8', toCsv([f.map((x) => x.label), f.map(sampleValue)]), true);
        toast({ tone: 'success', title: 'Đã tải file mẫu', text: d.title });
    };

    const timeline = useMemo(() => {
        const t = (id: string) => datasets.find((d) => d.id === id)?.title ?? id;
        const a = (ov?.recent_imports ?? []).map((b) => ({ at: b.created_at, kind: 'import' as const, title: `Nhập ${t(b.dataset)}`, sub: `+${num(b.inserted)} · ~${num(b.updated)} · ✕${num(b.failed)} · ${b.user_name ?? '—'}`, pill: <Pill tone={tone(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</Pill> }));
        const e = (ov?.recent_exports ?? []).map((l) => ({ at: l.created_at, kind: 'export' as const, title: `Xuất ${t(l.dataset)}`, sub: `${l.format.toUpperCase()} · ${num(l.rows_count)} dòng · ${l.user_name ?? '—'}`, pill: l.masked ? <Pill tone="ok">Đã che</Pill> : <Pill tone="warn">Đầy đủ</Pill> }));
        return [...a, ...e].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 8);
    }, [ov, datasets]);

    const ready = datasets.length > 0 && !error;

    return (
        <div className="dh">
            <div className="dh-head">
                <div>
                    <h1>Nhập / Xuất dữ liệu</h1>
                    <p>Nhập hàng loạt từ CSV hoặc Excel, kiểm tra trước khi ghi, hoàn tác khi cần; xuất dữ liệu có che thông tin nhạy cảm và lưu nhật ký.</p>
                </div>
                <button className="dh-btn ghost" onClick={load} disabled={loading}><Icon n="history" s={16} />Làm mới</button>
            </div>

            <nav className="dh-tabs" role="tablist">
                {TABS.map((t) => (
                    <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
                        <Icon n={t.icon} s={16} />{t.label}
                        {t.id === 'history' && ov && ov.running > 0 && <em>{ov.running}</em>}
                    </button>
                ))}
            </nav>

            {error && <ConnectionPanel message={error.message} status={error.status} onRetry={load} />}
            {loading && !ready && !error && <div className="dh-loading"><i className="dh-spin" />Đang tải…</div>}

            {ready && tab === 'overview' && (
                <div className="dh-ov">
                    <div className="dh-stack">
                        <div className="dh-grid4">
                            <div className="dh-stat"><span>Lần nhập tháng này</span><b>{num(ov?.imports_month)}</b><em>{num(ov?.imports_total)} lần từ trước đến nay</em></div>
                            <div className="dh-stat ok"><span>Dòng đã nhập tháng này</span><b>{num(ov?.rows_imported_month)}</b><em>thêm mới + cập nhật</em></div>
                            <div className="dh-stat"><span>Lần xuất tháng này</span><b>{num(ov?.exports_month)}</b><em>đều có ghi nhật ký</em></div>
                            <div className={`dh-stat ${ov && ov.running > 0 ? 'warn' : 'ok'}`}><span>Đang chạy</span><b>{num(ov?.running)}</b><em>{ov && ov.running > 0 ? 'có lô nhập chưa chốt' : 'không có lô nào treo'}</em></div>
                        </div>

                        <section className="dh-card">
                            <header><h2>Loại dữ liệu</h2><span className="dh-mut">{datasets.length} loại · giới hạn {num(limits.total)} dòng/lần nhập</span></header>
                            <div className="dh-ds-wide">
                                {datasets.map((d) => {
                                    const usable = d.fields.filter((f) => f.usable).length;
                                    const last = ov?.recent_imports.find((b) => b.dataset === d.id);
                                    const keyF = d.fields.find((f) => f.key === d.upsert);
                                    return (
                                        <div key={d.id} className={`dh-dsx${d.table_exists ? '' : ' off'}`}>
                                            <div className="dh-dsx-top">
                                                <span className="dh-ds-ic"><Icon n={d.icon} s={22} /></span>
                                                <div><b>{d.title}</b><small>{d.table_exists ? `${num(d.count)} bản ghi` : 'Chưa có bảng trong CSDL'}</small></div>
                                                {d.missing.length > 0 && d.table_exists && <Pill tone="warn">Thiếu {d.missing.length} cột</Pill>}
                                            </div>
                                            <dl className="dh-meta">
                                                <div><dt>Khóa nhận diện</dt><dd>{keyF?.label ?? d.upsert}</dd></div>
                                                <div><dt>Cột dùng được</dt><dd>{usable}/{d.fields.length}</dd></div>
                                                <div><dt>Bắt buộc</dt><dd>{d.fields.filter((f) => f.required).length} cột</dd></div>
                                                <div><dt>Lần nhập gần nhất</dt><dd>{last ? fmtDT(last.created_at) : 'Chưa có'}</dd></div>
                                            </dl>
                                            <Bar value={(usable / Math.max(1, d.fields.length)) * 100} tone={usable === d.fields.length ? 'ok' : 'warn'} />
                                            <div className="dh-ds-act">
                                                <button className="dh-btn sm" disabled={!d.table_exists} onClick={() => go('import', d.id)}><Icon n="upload" s={14} />Nhập</button>
                                                <button className="dh-btn ghost sm" disabled={!d.table_exists} onClick={() => go('export', d.id)}><Icon n="download" s={14} />Xuất</button>
                                                <button className="dh-btn ghost sm" disabled={!d.table_exists} onClick={() => template(d)}><Icon n="file" s={14} />File mẫu</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="dh-card">
                            <header><h2>Quy trình nhập chuẩn</h2></header>
                            <ol className="dh-flow">
                                <li><span>1</span><b>Chuẩn bị</b><small>Tải file mẫu, điền dữ liệu, lưu CSV UTF-8 (hoặc copy từ Excel).</small></li>
                                <li><span>2</span><b>Ghép cột</b><small>Hệ thống tự nhận cột theo tên; có thể lưu mẫu ghép cột để dùng lại.</small></li>
                                <li><span>3</span><b>Kiểm tra trước</b><small>Xem số dòng thêm mới / cập nhật / lỗi, tải báo cáo lỗi để sửa.</small></li>
                                <li><span>4</span><b>Nhập theo lô</b><small>Ghi từng mảnh {limits.chunk} dòng, có tiến độ và nút dừng.</small></li>
                                <li><span>5</span><b>Hoàn tác</b><small>Trong {limits.undo_days} ngày vẫn hoàn tác được cả lô.</small></li>
                            </ol>
                        </section>
                    </div>

                    <aside className="dh-stack">
                        <section className="dh-card">
                            <header><h2>Hoạt động gần đây</h2><button className="dh-link" onClick={() => go('history')}>Xem tất cả</button></header>
                            <ul className="dh-tl">
                                {timeline.map((x, i) => (
                                    <li key={i} className={x.kind}>
                                        <span className="dot"><Icon n={x.kind === 'import' ? 'upload' : 'download'} s={13} /></span>
                                        <div><b>{x.title}</b><small>{x.sub}</small><small>{fmtDT(x.at)}</small></div>
                                        {x.pill}
                                    </li>
                                ))}
                                {!timeline.length && <li className="empty">Chưa có hoạt động nào.</li>}
                            </ul>
                        </section>
                        <section className="dh-card dh-tips">
                            <header><h2>Khuyến nghị an toàn</h2></header>
                            <ul>
                                <li><Icon n="shield" s={16} />Sao lưu cơ sở dữ liệu trước khi nhập số lượng lớn.</li>
                                <li><Icon n="eye" s={16} />Luôn kiểm tra trước – dòng lỗi được bỏ qua, không làm hỏng dữ liệu.</li>
                                <li><Icon n="undo" s={16} />Mỗi lô nhập hoàn tác được trong {limits.undo_days} ngày.</li>
                                <li><Icon n="download" s={16} />Khi xuất danh sách có số điện thoại, email, địa chỉ nên bật “Che dữ liệu nhạy cảm”.</li>
                            </ul>
                        </section>
                    </aside>
                </div>
            )}

            {ready && tab === 'import' && <ImportWizard key={preset} datasets={datasets} limits={limits} preset={preset} onDone={refreshed} />}
            {ready && tab === 'export' && <ExportPanel key={preset} datasets={datasets} preset={preset} onDone={refreshed} />}
            {ready && tab === 'history' && <HistoryTab key={tick} datasets={datasets} onChanged={refreshed} />}
        </div>
    );
}

export default function DataHub() {
    return (
        <ToastProvider>
            <Inner />
        </ToastProvider>
    );
}