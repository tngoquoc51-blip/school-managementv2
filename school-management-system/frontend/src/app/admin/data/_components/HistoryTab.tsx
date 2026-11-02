'use client';

import { useCallback, useEffect, useState } from 'react';
import { hub } from '../_lib/api';
import { downloadFile, toCsv } from '../_lib/csv';
import { useToast } from '../_lib/toast';
import { MODE_LABEL, STATUS_LABEL } from '../_lib/types';
import type { Batch, Dataset, ExportLog } from '../_lib/types';
import { Icon, Modal, Pill, fmtDT, num } from './ui';

const tone = (s: string): 'ok' | 'warn' | 'err' | 'mut' | 'pri' =>
    s === 'completed' ? 'ok' : s === 'completed_with_errors' ? 'warn' : s === 'running' ? 'pri' : s === 'undone' ? 'mut' : 'err';

export default function HistoryTab({ datasets, onChanged }: { datasets: Dataset[]; onChanged: () => void }) {
    const toast = useToast();
    const [sub, setSub] = useState<'imports' | 'exports'>('imports');
    const [page, setPage] = useState(1);
    const [last, setLast] = useState(1);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [logs, setLogs] = useState<ExportLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<Batch | null>(null);
    const [confirm, setConfirm] = useState<Batch | null>(null);
    const [busy, setBusy] = useState(false);
    const title = (id: string) => datasets.find((d) => d.id === id)?.title ?? id;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (sub === 'imports') { const r = await hub.batches(page); setBatches(r.items); setLast(r.meta?.last_page ?? 1); }
            else { const r = await hub.exportLogs(page); setLogs(r.items); setLast(r.meta?.last_page ?? 1); }
        } catch (e) { toast({ tone: 'error', title: 'Không tải được lịch sử', text: e instanceof Error ? e.message : '' }); }
        finally { setLoading(false); }
    }, [sub, page, toast]);
    useEffect(() => { load(); }, [load]);

    const open = async (b: Batch) => { try { setDetail(await hub.batch(b.id)); } catch (e) { toast({ tone: 'error', title: 'Không mở được chi tiết', text: e instanceof Error ? e.message : '' }); } };
    const askUndo = async (b: Batch) => { try { setConfirm(await hub.batch(b.id)); } catch { setConfirm(b); } };
    const doUndo = async () => {
        if (!confirm) return;
        setBusy(true);
        try {
            const r = await hub.undo(confirm.id);
            toast({ tone: r.blocked ? 'warn' : 'success', title: 'Đã hoàn tác', text: `Xóa ${num(r.removed)} · khôi phục ${num(r.restored)}${r.blocked ? ` · ${r.blocked} bản ghi đang được dùng nên giữ lại` : ''}` });
            setConfirm(null); load(); onChanged();
        } catch (e) { toast({ tone: 'error', title: 'Không hoàn tác được', text: e instanceof Error ? e.message : '' }); }
        finally { setBusy(false); }
    };

    return (
        <section className="dh-card">
            <header>
                <div className="dh-seg">
                    <button className={sub === 'imports' ? 'on' : ''} onClick={() => { setSub('imports'); setPage(1); }}>Lịch sử nhập</button>
                    <button className={sub === 'exports' ? 'on' : ''} onClick={() => { setSub('exports'); setPage(1); }}>Lịch sử xuất</button>
                </div>
                <button className="dh-btn ghost sm" onClick={load} disabled={loading}>Làm mới</button>
            </header>

            <div className="dh-tw"><table className="dh-table">
                {sub === 'imports' ? (
                    <>
                        <thead><tr><th>#</th><th>Dữ liệu</th><th>Tệp</th><th>Cách xử lý</th><th>Kết quả</th><th>Trạng thái</th><th>Người nhập</th><th>Thời gian</th><th></th></tr></thead>
                        <tbody>
                        {batches.map((b) => (
                            <tr key={b.id}>
                                <td>#{b.id}</td><td><b>{title(b.dataset)}</b></td><td className="dh-mut">{b.filename || '—'}</td><td>{MODE_LABEL[b.mode]}</td>
                                <td className="dh-mut">+{num(b.inserted)} · ~{num(b.updated)} · ={num(b.unchanged)} · ✕{num(b.failed)}</td>
                                <td><Pill tone={tone(b.status)}>{STATUS_LABEL[b.status] ?? b.status}</Pill></td>
                                <td>{b.user_name ?? '—'}</td><td>{fmtDT(b.created_at)}</td>
                                <td className="dh-act">
                                    <button className="dh-btn ghost sm" onClick={() => open(b)}>Chi tiết</button>
                                    {(b.status === 'completed' || b.status === 'completed_with_errors') && !b.undone_at && (b.inserted + b.updated) > 0 &&
                                        <button className="dh-btn ghost sm danger" onClick={() => askUndo(b)}><Icon n="undo" s={14} />Hoàn tác</button>}
                                </td>
                            </tr>
                        ))}
                        {!loading && !batches.length && <tr><td colSpan={9} className="dh-mut">Chưa có lần nhập nào.</td></tr>}
                        </tbody>
                    </>
                ) : (
                    <>
                        <thead><tr><th>#</th><th>Dữ liệu</th><th>Định dạng</th><th>Số dòng</th><th>Bảo vệ</th><th>Người xuất</th><th>IP</th><th>Thời gian</th></tr></thead>
                        <tbody>
                        {logs.map((l) => (
                            <tr key={l.id}>
                                <td>#{l.id}</td><td><b>{title(l.dataset)}</b></td><td>{l.format.toUpperCase()}</td><td>{num(l.rows_count)}</td>
                                <td>{l.masked ? <Pill tone="ok">Đã che dữ liệu</Pill> : <Pill tone="warn">Đầy đủ</Pill>}</td>
                                <td>{l.user_name ?? '—'}</td><td className="dh-mut">{l.ip ?? '—'}</td><td>{fmtDT(l.created_at)}</td>
                            </tr>
                        ))}
                        {!loading && !logs.length && <tr><td colSpan={8} className="dh-mut">Chưa có lần xuất nào.</td></tr>}
                        </tbody>
                    </>
                )}
            </table></div>

            {last > 1 && (
                <div className="dh-pager">
                    <button className="dh-btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
                    <span>Trang {page} / {last}</span>
                    <button className="dh-btn ghost sm" disabled={page >= last} onClick={() => setPage(page + 1)}>Sau ›</button>
                </div>
            )}

            {detail && (
                <Modal wide title={`Lô nhập #${detail.id} – ${title(detail.dataset)}`} onClose={() => setDetail(null)}
                       footer={<button className="dh-btn ghost" onClick={() => setDetail(null)}>Đóng</button>}>
                    <ul className="dh-sum">
                        <li>Tệp: <b>{detail.filename || '—'}</b> · {MODE_LABEL[detail.mode]} · <Pill tone={tone(detail.status)}>{STATUS_LABEL[detail.status]}</Pill></li>
                        <li>Bắt đầu {fmtDT(detail.started_at)} · kết thúc {fmtDT(detail.finished_at)}{detail.undone_at && <> · hoàn tác {fmtDT(detail.undone_at)}</>}</li>
                        <li>Tổng {num(detail.total)} · thêm mới <b>{num(detail.inserted)}</b> · cập nhật <b>{num(detail.updated)}</b> · không đổi {num(detail.unchanged)} · lỗi <b>{num(detail.failed)}</b></li>
                    </ul>
                    {detail.errors && detail.errors.length > 0 ? (
                        <>
                            <div className="dh-bar-row"><h3 className="dh-h3">Các dòng lỗi khi ghi</h3>
                                <button className="dh-btn ghost sm" onClick={() => downloadFile(`loi-lo-${detail.id}.csv`, 'text/csv;charset=utf-8', toCsv([['Dòng', 'Lỗi'], ...detail.errors!.map((x) => [x.row, x.message])]), true)}><Icon n="download" s={14} />Tải CSV</button></div>
                            <div className="dh-tw" style={{ maxHeight: 280 }}><table className="dh-table"><thead><tr><th>Dòng</th><th>Lỗi</th></tr></thead>
                                <tbody>{detail.errors.slice(0, 200).map((x, i) => <tr key={i}><td><b>{x.row}</b></td><td className="dh-err">{x.message}</td></tr>)}</tbody></table></div>
                        </>
                    ) : <p className="dh-mut">Không có lỗi nào được ghi nhận.</p>}
                </Modal>
            )}

            {confirm && (
                <Modal title={`Hoàn tác lô nhập #${confirm.id}?`} onClose={() => setConfirm(null)}
                       footer={<><button className="dh-btn ghost" onClick={() => setConfirm(null)}>Không</button><button className="dh-btn danger-fill" onClick={doUndo} disabled={busy}>{busy ? 'Đang hoàn tác…' : 'Hoàn tác'}</button></>}>
                    <p>Hệ thống sẽ <b>xóa {num(confirm.inserted)} bản ghi</b> được thêm mới và <b>khôi phục giá trị cũ</b> của {num(confirm.updated)} bản ghi đã cập nhật.</p>
                    <div className="dh-alert warn"><Icon n="alert" s={18} /><span>Nếu bản ghi đã được chỉnh sửa/sử dụng ở nơi khác sau khi nhập, kết quả có thể không trọn vẹn. Hành động này không thể hoàn lại.</span></div>
                </Modal>
            )}
        </section>
    );
}