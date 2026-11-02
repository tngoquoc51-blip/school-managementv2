'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '../Icon';
import { logsApi } from '../logsApi';
import { useToast } from '../ToastProvider';
import { Chip, ConfirmDialog, ErrorState, LevelBadge, Panel, Skeleton } from '../ui';
import type { EventFilters, Level, PurgeResult, StorageInfo } from '../types';
import { LEVELS, fmtBytes, fmtDate, fmtNum } from '../utils';

interface Props { canManage: boolean; refreshKey: number; onGoEvents: (p: Partial<EventFilters>) => void; onChanged: () => void }

export default function StorageTab({ canManage, refreshKey, onGoEvents, onChanged }: Props) {
    const toast = useToast();
    const [d, setD] = useState<StorageInfo | null>(null);
    const [days, setDays] = useState<Record<string, number>>({});
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState<PurgeResult | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const [testLevel, setTestLevel] = useState<Level>('warning');

    const load = useCallback(async () => {
        setError('');
        try { const r = await logsApi.storage(); setD(r); setDays(r.retention); } catch (e) { setError((e as Error).message); }
    }, []);
    useEffect(() => { load(); }, [load, refreshKey]);

    const dirty = d ? LEVELS.some((l) => (days[l.key] ?? 0) !== d.retention[l.key]) : false;
    const bad = LEVELS.some((l) => !(days[l.key] >= 1 && days[l.key] <= 3650));

    const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error('Chưa thực hiện được', (e as Error).message); } finally { setBusy(false); } };

    const saveRetention = () => run(async () => { await logsApi.saveRetention(days); toast.success('Đã lưu chính sách lưu giữ'); setPreview(null); await load(); });
    const dryRun = () => run(async () => { const r = await logsApi.purge(true); setPreview(r); r.total ? toast.info(`Có ${fmtNum(r.total)} sự kiện quá hạn`, 'Xem chi tiết bên dưới rồi quyết định dọn dẹp.') : toast.success('Không có gì cần dọn', 'Mọi sự kiện đều còn trong thời hạn lưu giữ.'); });
    const purge = () => run(async () => { const r = await logsApi.purge(false, typed); toast.success(`Đã xóa ${fmtNum(r.total)} sự kiện quá hạn`, 'Sự kiện đã ghim được giữ lại.'); setConfirmOpen(false); setTyped(''); setPreview(null); await load(); onChanged(); });
    const sync = () => run(async () => { const r = await logsApi.sync(); r.imported ? toast.success(`Đã nhập ${r.imported} sự kiện mới`, 'Từ các bảng nhật ký cũ của dự án.') : toast.info('Không có gì mới', 'Các bảng cũ đã được đồng bộ đầy đủ.'); await load(); onChanged(); });
    const test = () => run(async () => { await logsApi.testEvent(testLevel); toast.success('Đã tạo sự kiện thử', 'Mở tab Sự kiện bật “Trực tiếp” để thấy nó xuất hiện.', { action: { label: 'Xem ngay', run: () => onGoEvents({ range: '1h', action: 'system.test_event' }) } }); await load(); });

    if (error && !d) return <ErrorState message={error} onRetry={load} />;
    if (!d) return <div className="lg-stack"><div className="lg-kpis lg-kpis--4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="lg-kpi"><Skeleton h={14} w="60%" /><Skeleton h={30} w="40%" /></div>)}</div><Skeleton h={260} r={14} /></div>;

    return (
        <div className="lg-stack">
            <section className="lg-kpis lg-kpis--4">
                <div className="lg-kpi lg-kpi--brand"><span className="lg-kpi__icon"><Icon name="database" size={18} /></span><span className="lg-kpi__label">Tổng sự kiện</span><strong>{fmtNum(d.total)}</strong></div>
                <div className="lg-kpi lg-kpi--violet"><span className="lg-kpi__icon"><Icon name="archive" size={18} /></span><span className="lg-kpi__label">Dung lượng module</span><strong>{fmtBytes(d.bytes)}</strong></div>
                <div className="lg-kpi lg-kpi--warning"><span className="lg-kpi__icon"><Icon name="trash" size={18} /></span><span className="lg-kpi__label">Quá hạn, có thể dọn</span><strong>{fmtNum(d.expired_total)}</strong></div>
                <div className="lg-kpi lg-kpi--teal"><span className="lg-kpi__icon"><Icon name="star" size={18} /></span><span className="lg-kpi__label">Đã ghim (được giữ lại)</span><strong>{fmtNum(d.pins)}</strong></div>
            </section>

            <Panel title="Chính sách lưu giữ" desc="Mỗi mức độ có thời hạn riêng: lỗi nghiêm trọng giữ lâu hơn nhật ký debug. Sự kiện đã ghim không bao giờ bị xóa tự động."
                   actions={<button type="button" className="lg-btn lg-btn--primary" onClick={saveRetention} disabled={!canManage || !dirty || bad || busy}>{busy ? <span className="lg-spinner" /> : <Icon name="save" size={16} />} Lưu chính sách</button>}>
                <div className="lg-tablewrap"><table className="lg-table lg-table--plain">
                    <thead><tr><th>Mức độ</th><th>Số sự kiện</th><th>Cũ nhất</th><th>Mới nhất</th><th>Giữ (ngày)</th><th>Quá hạn</th></tr></thead>
                    <tbody>{d.levels.map((l) => (
                        <tr key={l.level}>
                            <td><LevelBadge level={l.level} compact /></td>
                            <td><button type="button" className="lg-link" onClick={() => onGoEvents({ range: 'all', level: [l.level] })}>{fmtNum(l.count)}</button></td>
                            <td>{fmtDate(l.oldest)}</td><td>{fmtDate(l.newest)}</td>
                            <td><input className="lg-num" type="number" min={1} max={3650} value={days[l.level] ?? ''} disabled={!canManage} aria-label={`Số ngày giữ mức ${l.level}`} onChange={(e) => setDays((s) => ({ ...s, [l.level]: Number(e.target.value) }))} /></td>
                            <td>{l.expired > 0 ? <Chip tone="amber">{fmtNum(l.expired)}</Chip> : <span className="lg-muted">0</span>}</td>
                        </tr>))}</tbody>
                </table></div>
                {bad && <p className="lg-err">Số ngày phải từ 1 đến 3650.</p>}
            </Panel>

            <div className="lg-grid lg-grid--two">
                <Panel title="Dọn dẹp" desc="Xóa các sự kiện đã quá thời hạn lưu giữ ở trên.">
                    <div className="lg-stack">
                        <button type="button" className="lg-btn lg-btn--soft" onClick={dryRun} disabled={!canManage || busy}><Icon name="eye" size={16} /> Xem trước (không xóa)</button>
                        {preview && (
                            <div className="lg-preview" aria-live="polite">
                                <strong>{preview.total ? `Sẽ xóa ${fmtNum(preview.total)} sự kiện` : 'Không có sự kiện nào quá hạn'}</strong>
                                {preview.total > 0 && <ul>{preview.detail.filter((x) => x.matched > 0).map((x) => <li key={x.level}><LevelBadge level={x.level} compact /> {fmtNum(x.matched)} sự kiện cũ hơn {x.days} ngày</li>)}</ul>}
                            </div>
                        )}
                        <button type="button" className="lg-btn lg-btn--danger" onClick={() => setConfirmOpen(true)} disabled={!canManage || busy || d.expired_total === 0}><Icon name="trash" size={16} /> Dọn dẹp ngay{d.expired_total > 0 ? ` (${fmtNum(d.expired_total)})` : ''}</button>
                        <p className="lg-hint">Có thể tự động hóa: <code>php artisan logs:purge</code> chạy mỗi đêm (xem hướng dẫn cài đặt).</p>
                    </div>
                </Panel>
                <Panel title="Công cụ" desc="Dành cho quản trị viên.">
                    <div className="lg-stack">
                        <div className="lg-tool"><div><strong>Đồng bộ từ bảng cũ</strong><small>Gom nhật ký từ <code>sm_fee_audit</code>, <code>sm_payment_log</code>, <code>sm_security_audit</code>… (tự động chạy khi mở trang).</small></div><button type="button" className="lg-btn lg-btn--ghost" onClick={sync} disabled={!canManage || busy}><Icon name="refresh" size={16} /> Đồng bộ</button></div>
                        <div className="lg-tool"><div><strong>Tạo sự kiện thử</strong><small>Để xem luồng trực tiếp, thông báo và thử quy tắc cảnh báo.</small></div>
                            <div className="lg-row"><select className="lg-select" value={testLevel} onChange={(e) => setTestLevel(e.target.value as Level)} aria-label="Mức độ sự kiện thử">{LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select><button type="button" className="lg-btn lg-btn--ghost" onClick={test} disabled={!canManage || busy}><Icon name="zap" size={16} /> Tạo</button></div></div>
                    </div>
                </Panel>
            </div>

            <ConfirmDialog open={confirmOpen} title="Dọn dẹp sự kiện quá hạn?" message={`Thao tác này xóa vĩnh viễn ${fmtNum(d.expired_total)} sự kiện và không thể hoàn tác. Sự kiện đã ghim được giữ lại.`} confirmLabel="Xóa vĩnh viễn" loading={busy} disabled={typed !== 'XOA'} onConfirm={purge} onCancel={() => { setConfirmOpen(false); setTyped(''); }}>
                <div className="lg-field"><label htmlFor="lg-xoa">Gõ <b>XOA</b> để xác nhận</label><input id="lg-xoa" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoComplete="off" /></div>
            </ConfirmDialog>
        </div>
    );
}