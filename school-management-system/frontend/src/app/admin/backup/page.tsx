'use client';

import { useCallback, useEffect, useState } from 'react';
import { adm, AdmError } from '@/lib/adminApi';
import './backup.css';

type BackupItem = {
    id: number;
    code: string;
    type: string;
    type_label: string;
    status: string;
    status_label: string;
    file_name?: string;
    file_size_label?: string;
    note?: string;
    error?: string;
    created_at?: string;
    finished_at?: string;
};

type Stats = {
    total: number;
    done: number;
    failed: number;
    total_size: string;
    disk_free: string;
    disk_total: string;
    disk_used_pct: number;
};

type Settings = {
    auto_enabled: boolean;
    auto_time: string;
    keep_days: number;
    max_files: number;
    last_run_at?: string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function AdminBackupPage() {
    const [items, setItems] = useState<BackupItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [settings, setSettings] = useState<Settings>({
        auto_enabled: false,
        auto_time: '02:00',
        keep_days: 30,
        max_files: 20,
    });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [note, setNote] = useState('');
    const [type, setType] = useState<'db' | 'full'>('db');
    const [tab, setTab] = useState<'list' | 'settings'>('list');

    const toast = (t: string, isErr = false) => {
        if (isErr) setErr(t);
        else setMsg(t);
        setTimeout(() => {
            setMsg('');
            setErr('');
        }, 3200);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const r = await adm<{
                stats: Stats;
                settings: Settings;
                items: BackupItem[];
            }>('backups');
            setStats(r.data.stats);
            setSettings(r.data.settings);
            setItems(r.data.items || []);
        } catch (e) {
            setErr(e instanceof AdmError ? e.message : 'Không tải được dữ liệu sao lưu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const createBackup = async () => {
        if (!confirm('Tạo bản sao lưu cơ sở dữ liệu ngay bây giờ?')) return;
        setBusy(true);
        try {
            await adm('backups', { method: 'POST', body: { type, note } });
            setNote('');
            toast('Sao lưu thành công');
            await load();
        } catch (e) {
            toast(e instanceof AdmError ? e.message : 'Sao lưu thất bại', true);
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Xóa bản sao lưu này?')) return;
        try {
            await adm(`backups/${id}`, { method: 'DELETE' });
            toast('Đã xóa');
            await load();
        } catch (e) {
            toast(e instanceof AdmError ? e.message : 'Xóa thất bại', true);
        }
    };

    const restore = async (id: number, code: string) => {
        if (!confirm(`PHỤC HỒI từ ${code}?\nThao tác này ghi đè dữ liệu hiện tại. Chỉ dùng khi thật sự cần.`)) return;
        if (!confirm('Xác nhận lần 2: bạn chắc chắn muốn phục hồi?')) return;
        setBusy(true);
        try {
            await adm(`backups/${id}/restore`, { method: 'POST' });
            toast('Phục hồi thành công');
            await load();
        } catch (e) {
            toast(e instanceof AdmError ? e.message : 'Phục hồi thất bại', true);
        } finally {
            setBusy(false);
        }
    };

    const download = (id: number) => {
        const token =
            typeof window !== 'undefined'
                ? localStorage.getItem('token') || localStorage.getItem('admin_token') || ''
                : '';
        window.open(`${API}/admin/backups/${id}/download?token=${encodeURIComponent(token)}`, '_blank');
    };

    const saveSettings = async () => {
        setBusy(true);
        try {
            await adm('backups/settings', { method: 'PUT', body: settings });
            toast('Đã lưu cấu hình');
            await load();
        } catch (e) {
            toast(e instanceof AdmError ? e.message : 'Lưu thất bại', true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="bk">
            <div className="bk-top">
                <div>
                    <h1>Sao lưu & Phục hồi</h1>
                    <p>Bảo vệ dữ liệu toàn trường · lịch sử bản sao · cấu hình tự động</p>
                </div>
                <div className="bk-top-acts">
                    <button type="button" className="bk-btn ghost" onClick={load} disabled={loading}>
                        Làm mới
                    </button>
                    <button type="button" className="bk-btn primary" onClick={createBackup} disabled={busy}>
                        {busy ? 'Đang xử lý…' : '+ Tạo sao lưu ngay'}
                    </button>
                </div>
            </div>

            {msg && <div className="bk-toast ok">{msg}</div>}
            {err && <div className="bk-toast err">{err}</div>}

            <div className="bk-kpi">
                <div className="bk-kpi-card">
                    <span>Tổng bản sao</span>
                    <b>{stats?.total ?? '—'}</b>
                </div>
                <div className="bk-kpi-card ok">
                    <span>Thành công</span>
                    <b>{stats?.done ?? '—'}</b>
                </div>
                <div className="bk-kpi-card bad">
                    <span>Thất bại</span>
                    <b>{stats?.failed ?? '—'}</b>
                </div>
                <div className="bk-kpi-card">
                    <span>Dung lượng backup</span>
                    <b className="sm">{stats?.total_size ?? '—'}</b>
                </div>
                <div className="bk-kpi-card">
                    <span>Ổ đĩa trống</span>
                    <b className="sm">{stats?.disk_free ?? '—'}</b>
                    <small>{stats ? `${stats.disk_used_pct}% đã dùng` : ''}</small>
                </div>
            </div>

            <div className="bk-chips">
                <button type="button" className={`bk-chip ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}>
                    Lịch sử sao lưu
                </button>
                <button
                    type="button"
                    className={`bk-chip ${tab === 'settings' ? 'on' : ''}`}
                    onClick={() => setTab('settings')}
                >
                    Cấu hình
                </button>
            </div>

            {tab === 'list' && (
                <div className="bk-panel">
                    <div className="bk-create">
                        <label>
                            Loại
                            <select value={type} onChange={(e) => setType(e.target.value as 'db' | 'full')}>
                                <option value="db">Cơ sở dữ liệu (SQL)</option>
                                <option value="full">Toàn hệ thống (DB)</option>
                            </select>
                        </label>
                        <label className="grow">
                            Ghi chú
                            <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Ví dụ: Trước khi nhập điểm HK2"
                            />
                        </label>
                        <button type="button" className="bk-btn primary" disabled={busy} onClick={createBackup}>
                            Sao lưu
                        </button>
                    </div>

                    <div className="bk-table-wrap">
                        <table className="bk-table">
                            <thead>
                            <tr>
                                <th>Mã</th>
                                <th>Loại</th>
                                <th>Trạng thái</th>
                                <th>Dung lượng</th>
                                <th>Thời gian</th>
                                <th>Ghi chú</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="bk-empty">
                                        Đang tải…
                                    </td>
                                </tr>
                            )}
                            {!loading && items.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="bk-empty">
                                        Chưa có bản sao lưu — bấm “Tạo sao lưu ngay”
                                    </td>
                                </tr>
                            )}
                            {items.map((b) => (
                                <tr key={b.id}>
                                    <td>
                                        <code>{b.code}</code>
                                    </td>
                                    <td>{b.type_label}</td>
                                    <td>
                                        <span className={`bk-pill ${b.status}`}>{b.status_label}</span>
                                    </td>
                                    <td>{b.file_size_label || '—'}</td>
                                    <td className="muted">{b.created_at || '—'}</td>
                                    <td className="muted">{b.note || b.error || '—'}</td>
                                    <td className="bk-row-acts">
                                        {b.status === 'done' && (
                                            <>
                                                <button type="button" className="bk-link" onClick={() => download(b.id)}>
                                                    Tải
                                                </button>
                                                <button
                                                    type="button"
                                                    className="bk-link warn"
                                                    onClick={() => restore(b.id, b.code)}
                                                >
                                                    Phục hồi
                                                </button>
                                            </>
                                        )}
                                        <button type="button" className="bk-link danger" onClick={() => remove(b.id)}>
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'settings' && (
                <div className="bk-panel settings">
                    <div className="bk-form">
                        <label className="check">
                            <input
                                type="checkbox"
                                checked={settings.auto_enabled}
                                onChange={(e) => setSettings({ ...settings, auto_enabled: e.target.checked })}
                            />
                            Bật sao lưu tự động hàng ngày
                        </label>
                        <label>
                            Giờ chạy
                            <input
                                type="time"
                                value={settings.auto_time}
                                onChange={(e) => setSettings({ ...settings, auto_time: e.target.value })}
                            />
                        </label>
                        <label>
                            Giữ lại (ngày)
                            <input
                                type="number"
                                min={1}
                                value={settings.keep_days}
                                onChange={(e) => setSettings({ ...settings, keep_days: Number(e.target.value) })}
                            />
                        </label>
                        <label>
                            Số bản tối đa
                            <input
                                type="number"
                                min={1}
                                value={settings.max_files}
                                onChange={(e) => setSettings({ ...settings, max_files: Number(e.target.value) })}
                            />
                        </label>
                        <p className="hint">
                            Lần chạy gần nhất: <b>{settings.last_run_at || 'Chưa có'}</b>
                        </p>
                        <button type="button" className="bk-btn primary" disabled={busy} onClick={saveSettings}>
                            Lưu cấu hình
                        </button>
                    </div>
                    <div className="bk-tips">
                        <h3>Khuyến nghị vận hành</h3>
                        <ul>
                            <li>Sao lưu trước mọi đợt nhập điểm / phân lớp / kết chuyển năm học.</li>
                            <li>Tải file `.sql` về máy hoặc ổ ngoài định kỳ.</li>
                            <li>Phục hồi chỉ khi có sự cố — luôn xác nhận 2 lần.</li>
                            <li>Ổ đĩa máy chủ nên còn tối thiểu 20% trống.</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}