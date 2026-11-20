'use client';

import { useCallback, useEffect, useState } from 'react';
import { ago, errMsg, fieldErrors, fmtBytes, fmtDT, settingsApi } from './api';
import { Badge, Btn, Card, Empty, Field, Icon, Modal, Skeleton, Toggle, useConfirm, useToast } from './ui';

const TYPE: Record<string, string> = { db: 'Cơ sở dữ liệu', files: 'Tệp tải lên', full: 'Toàn bộ' };
const ST: Record<string, [string, any]> = { done: ['Hoàn tất', 'ok'], running: ['Đang chạy', 'info'], pending: ['Chờ', ''], failed: ['Thất bại', 'bad'] };

export default function Backups() {
    const toast = useToast(); const confirm = useConfirm();
    const [data, setData] = useState<any>(null);
    const [busy, setBusy] = useState('');
    const [make, setMake] = useState<{ type: string; note: string } | null>(null);
    const [cfg, setCfg] = useState<any>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [err, setErr] = useState<any>(null);

    const load = useCallback(async () => {
        try { const d = await settingsApi.backups(); setData(d); setCfg({ ...d.settings, auto_enabled: !!Number(d.settings.auto_enabled), auto_time: String(d.settings.auto_time || '02:00').slice(0, 5) }); }
        catch (e) { toast('err', 'Không tải được danh sách sao lưu', errMsg(e)); setData({ items: [], settings: {} }); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!make) return;
        setBusy('create');
        try { await settingsApi.createBackup(make.type, make.note); toast('ok', 'Đã tạo bản sao lưu'); setMake(null); }
        catch (e) { toast('err', 'Sao lưu thất bại', errMsg(e)); setMake(null); }
        finally { setBusy(''); load(); }
    };
    const saveCfg = async () => {
        setBusy('cfg'); setErrs({});
        try { await settingsApi.saveBackupSettings({ ...cfg, auto_enabled: !!cfg.auto_enabled }); toast('ok', 'Đã lưu lịch sao lưu tự động'); await load(); }
        catch (e) { setErrs(fieldErrors(e)); toast('err', 'Không lưu được', errMsg(e)); } finally { setBusy(''); }
    };
    const del = async (b: any) => {
        if (!(await confirm({ title: `Xóa bản sao lưu ${b.code}?`, danger: true, okText: 'Xóa', text: 'File sao lưu trên máy chủ sẽ bị xóa vĩnh viễn.' }))) return;
        try { await settingsApi.deleteBackup(b.id); toast('ok', 'Đã xóa'); load(); } catch (e) { toast('err', 'Lỗi', errMsg(e)); }
    };
    const dl = async (b: any) => {
        setBusy('dl' + b.id);
        try { await settingsApi.downloadBackup(b.id, b.file_name); } catch (e) { toast('err', 'Không tải được file', 'File có thể không còn trên máy chủ'); } finally { setBusy(''); }
    };
    const restore = async (b: any) => {
        if (!(await confirm({ title: 'Phục hồi cơ sở dữ liệu', danger: true, okText: 'Phục hồi ngay', typeToConfirm: 'KHOI PHUC',
            text: <>Toàn bộ dữ liệu hiện tại sẽ bị <b>ghi đè</b> bằng bản <b>{b.code}</b> ({fmtDT(b.created_at)}). Hệ thống tự tạo một bản sao lưu an toàn trước khi phục hồi. Nên bật chế độ bảo trì trước.</> }))) return;
        setBusy('rs' + b.id);
        try { const r = await settingsApi.restoreBackup(b.id, 'KHOI PHUC'); toast('ok', 'Phục hồi thành công', r.data?.message); load(); }
        catch (e) { toast('err', 'Phục hồi thất bại', errMsg(e)); } finally { setBusy(''); }
    };

    if (!data) return <Skeleton rows={3} />;
    const items: any[] = data.items || [];
    const lastOk = items.find((b) => b.status === 'done');

    return (
        <>
            <div className="st-stats">
                <div className="st-stat"><small>Số bản sao lưu</small><b>{items.filter((b) => b.status === 'done').length}</b><span>{items.length} lần chạy tổng cộng</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-accent)' }}><small>Dung lượng đã dùng</small><b>{fmtBytes(data.total_size)}</b><span>Ổ đĩa còn {data.disk_free_gb} GB</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-ok)' }}><small>Lần gần nhất</small><b style={{ fontSize: 20 }}>{lastOk ? ago(lastOk.created_at) : 'Chưa có'}</b><span>{lastOk ? fmtDT(lastOk.created_at) : 'Hãy tạo bản sao lưu đầu tiên'}</span></div>
                <div className="st-stat" style={{ ['--c' as any]: cfg?.auto_enabled ? 'var(--st-ok)' : 'var(--st-warn)' }}><small>Tự động</small><b style={{ fontSize: 20 }}>{cfg?.auto_enabled ? `Mỗi ngày ${cfg.auto_time}` : 'Đang tắt'}</b><span>Giữ {cfg?.keep_days} ngày · tối đa {cfg?.max_files} file</span></div>
            </div>

            <Card icon="database" title="Lịch sử sao lưu" desc="Tạo, tải về, phục hồi hoặc xóa bản sao lưu" flush
                  actions={<><Btn icon="refresh" className="sm" onClick={load}>Làm mới</Btn><Btn kind="pri" icon="plus" onClick={() => setMake({ type: 'db', note: '' })}>Sao lưu ngay</Btn></>}>
                {items.length === 0 ? <Empty icon="database" text="Chưa có bản sao lưu nào" /> : (
                    <div className="st-tw"><table className="st-table">
                        <thead><tr><th>Mã</th><th>Loại</th><th>Trạng thái</th><th>Dung lượng</th><th>Thời gian</th><th>Người tạo</th><th /></tr></thead>
                        <tbody>{items.map((b) => (
                            <tr key={b.id}>
                                <td><b style={{ fontFamily: 'monospace' }}>{b.code}</b>{b.note && <div style={{ color: 'var(--st-muted)', fontSize: 12 }}>{b.note}</div>}</td>
                                <td>{TYPE[b.type] || b.type}</td>
                                <td><Badge kind={ST[b.status]?.[1]}>{ST[b.status]?.[0] || b.status}</Badge>
                                    {b.status === 'failed' && <button className="st-btn sm ghost" onClick={() => setErr(b)}>Chi tiết</button>}
                                    {b.status === 'done' && !b.file_exists && <Badge kind="warn">Mất file</Badge>}</td>
                                <td>{b.status === 'done' ? fmtBytes(b.file_size) : '—'}</td>
                                <td>{fmtDT(b.created_at)}</td>
                                <td>{b.by_name || <span style={{ color: 'var(--st-muted)' }}>Hệ thống</span>}</td>
                                <td className="act">
                                    {b.status === 'done' && b.file_exists && <Btn className="sm" icon="download" busy={busy === 'dl' + b.id} onClick={() => dl(b)}>Tải</Btn>}{' '}
                                    {b.status === 'done' && b.file_exists && b.type === 'db' && <Btn className="sm" icon="undo" busy={busy === 'rs' + b.id} onClick={() => restore(b)}>Phục hồi</Btn>}{' '}
                                    <Btn className="sm ghost dng" icon="trash" onClick={() => del(b)} />
                                </td>
                            </tr>))}
                        </tbody></table></div>
                )}
            </Card>

            {cfg && (
                <Card icon="calendar" title="Sao lưu tự động & lưu trữ" desc="Cần chạy lịch Laravel: php artisan schedule:work (hoặc Task Scheduler gọi mỗi phút)">
                    <div className="st-grid">
                        <div className="st-toggle-row wide"><div><b>Bật sao lưu tự động hằng ngày</b><small>Sao lưu cơ sở dữ liệu vào giờ đã chọn</small></div><Toggle on={!!cfg.auto_enabled} onChange={(v) => setCfg({ ...cfg, auto_enabled: v })} /></div>
                        <Field label="Giờ chạy" error={errs.auto_time}><input type="time" className="st-in" value={cfg.auto_time} onChange={(e) => setCfg({ ...cfg, auto_time: e.target.value })} /></Field>
                        <Field label="Thư mục lưu" error={errs.storage_path} hint="Tương đối so với thư mục backend, hoặc đường dẫn tuyệt đối"><input className="st-in" value={cfg.storage_path || ''} onChange={(e) => setCfg({ ...cfg, storage_path: e.target.value })} /></Field>
                        <Field label="Giữ bản sao lưu" error={errs.keep_days}><div className="st-addon"><input type="number" className="st-in" value={cfg.keep_days} onChange={(e) => setCfg({ ...cfg, keep_days: e.target.value })} /><span>ngày</span></div></Field>
                        <Field label="Số file tối đa" error={errs.max_files}><input type="number" className="st-in" value={cfg.max_files} onChange={(e) => setCfg({ ...cfg, max_files: e.target.value })} /></Field>
                    </div>
                    <div style={{ marginTop: 16 }}><Btn kind="pri" icon="check" busy={busy === 'cfg'} onClick={saveCfg}>Lưu cấu hình</Btn></div>
                </Card>
            )}

            {make && (
                <Modal title="Tạo bản sao lưu" onClose={() => !busy && setMake(null)} footer={<><Btn onClick={() => setMake(null)} disabled={busy === 'create'}>Hủy</Btn><Btn kind="pri" icon="database" busy={busy === 'create'} onClick={create}>Bắt đầu sao lưu</Btn></>}>
                    <Field label="Loại sao lưu">
                        <div style={{ display: 'grid', gap: 8 }}>
                            {[['db', 'Cơ sở dữ liệu', 'File .sql — nhanh, dùng để phục hồi'], ['files', 'Tệp tải lên', 'Ảnh đại diện, tài liệu trong storage/app/public (.zip)'], ['full', 'Toàn bộ', 'CSDL + tệp tải lên trong 1 file .zip']].map(([v, t, d]) => (
                                <label key={v} className="st-toggle-row" style={{ cursor: 'pointer', borderColor: make.type === v ? 'var(--st-primary)' : undefined }}>
                                    <div><b>{t}</b><small>{d}</small></div><input type="radio" checked={make.type === v} onChange={() => setMake({ ...make, type: v })} />
                                </label>))}
                        </div>
                    </Field>
                    <Field label="Ghi chú (không bắt buộc)"><input className="st-in" value={make.note} onChange={(e) => setMake({ ...make, note: e.target.value })} placeholder="Ví dụ: Trước khi nhập điểm HK1" /></Field>
                    {busy === 'create' && <div className="st-alert info"><Icon name="info" /> Đang sao lưu, với CSDL lớn có thể mất vài phút. Vui lòng không đóng trang.</div>}
                </Modal>
            )}
            {err && <Modal title={`Lỗi sao lưu ${err.code}`} onClose={() => setErr(null)}><div className="st-code">{err.error_message}</div><div className="st-alert info"><Icon name="info" />Nếu báo không tìm thấy mysqldump: thêm <code>MYSQLDUMP_PATH</code> vào .env (Laragon: C:\laragon\bin\mysql\...\bin\mysqldump.exe) rồi chạy <code>php artisan config:clear</code>.</div></Modal>}
        </>
    );
}