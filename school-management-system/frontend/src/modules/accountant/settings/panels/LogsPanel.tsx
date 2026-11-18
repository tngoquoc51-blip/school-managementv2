'use client';

import { useEffect, useState } from 'react';
import { LogRow, SettingsApi } from '../api';
import { Card, Skeleton, dt, useToast } from '../ui';

const AREAS: Record<string, string> = { payment: 'Tài khoản nhận tiền', receipt: 'Phiếu thu', reminder: 'Nhắc nợ', fee_item: 'Khoản thu', template: 'Mẫu thông báo', security: 'Bảo mật', prefs: 'Tùy chọn' };
const ACTIONS: Record<string, string> = { update: 'Cập nhật', create: 'Thêm', delete: 'Xóa', enable: 'Bật', disable: 'Tắt', password: 'Đổi mật khẩu', revoke: 'Đăng xuất phiên', revoke_all: 'Đăng xuất hàng loạt' };

export default function LogsPanel() {
    const toast = useToast();
    const [rows, setRows] = useState<LogRow[] | null>(null);
    const [page, setPage] = useState(1);
    const [last, setLast] = useState(1);
    const [total, setTotal] = useState(0);
    const [area, setArea] = useState('');
    const [q, setQ] = useState('');

    useEffect(() => {
        setRows(null);
        const t = setTimeout(() => {
            SettingsApi.logs(page, area, q)
                .then((r) => { setRows(r.data); setLast(r.meta.last_page); setTotal(r.meta.total); })
                .catch((e) => { toast('error', 'Không tải được nhật ký', e.message); setRows([]); });
        }, 250);
        return () => clearTimeout(t);
    }, [page, area, q, toast]);

    return (
        <Card title="Nhật ký thay đổi cài đặt" desc="Ghi lại ai đã sửa gì, lúc nào, từ địa chỉ IP nào — phục vụ kiểm toán nội bộ.">
            <div className="acs-tools">
                <input placeholder="Tìm theo người sửa hoặc nội dung…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
                <select value={area} onChange={(e) => { setPage(1); setArea(e.target.value); }}>
                    <option value="">Tất cả mục</option>
                    {Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>
            {!rows ? <Skeleton rows={6} /> : rows.length === 0 ? <div className="acs-empty">Chưa có thay đổi nào được ghi nhận.</div> : (
                <div className="acs-wrap">
                    <table className="acs-table">
                        <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Mục</th><th>Thao tác</th><th>Chi tiết</th><th>IP</th></tr></thead>
                        <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td style={{ whiteSpace: 'nowrap' }}>{dt(r.created_at)}</td>
                                <td>{r.staff_name}</td>
                                <td><span className="acs-tag">{AREAS[r.area] || r.area}</span></td>
                                <td>{ACTIONS[r.action] || r.action}</td>
                                <td style={{ maxWidth: 360 }}>{r.detail}</td>
                                <td>{r.ip}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="acs-pager">
                <span>{total} bản ghi</span>
                <button className="acs-btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
                <span>Trang {page}/{last}</span>
                <button className="acs-btn ghost sm" disabled={page >= last} onClick={() => setPage(page + 1)}>Sau ›</button>
            </div>
        </Card>
    );
}