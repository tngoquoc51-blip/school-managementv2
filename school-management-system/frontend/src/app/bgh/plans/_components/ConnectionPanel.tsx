'use client';

import { useState } from 'react';
import { bestOf, endpoint, getBase, getPrefix, hasToken, probe, setConn } from '../_lib/http';
import type { ProbeRow } from '../_lib/http';
import { Icon, Pill } from './ui';

const explain = (s: ProbeRow['status']) =>
    s === 200 ? { t: 'ok' as const, l: 'Hoạt động', d: 'API Kế hoạch trả lời bình thường.' }
        : s === 401 || s === 403 ? { t: 'warn' as const, l: `HTTP ${s}`, d: 'Kết nối được nhưng chưa được cấp quyền – hãy đăng xuất rồi đăng nhập lại bằng tài khoản admin.' }
            : s === 404 ? { t: 'warn' as const, l: 'HTTP 404', d: 'Kết nối được nhưng chưa có route – sai tiền tố, hoặc chưa dán plans_snippet.php vào nhóm route Ban Giám hiệu.' }
                : s === 'network' ? { t: 'err' as const, l: 'Không kết nối', d: 'Máy chủ tắt, sai cổng, hoặc bị chặn CORS.' }
                    : { t: 'err' as const, l: `HTTP ${s}`, d: 'Máy chủ lỗi – xem backend/storage/logs/laravel.log.' };

export default function ConnectionPanel({ message, status, onRetry }: { message: string; status?: number; onRetry: () => void }) {
    const [rows, setRows] = useState<ProbeRow[] | null>(null);
    const [busy, setBusy] = useState(false);
    const [base, setBase] = useState(getBase());
    const [prefix, setPrefix] = useState(getPrefix());

    const run = async () => {
        setBusy(true);
        const r = await probe();
        setRows(r);
        setBusy(false);
        const best = bestOf(r);
        if (best && best.status === 200) { setConn(best.base, getPrefix()); onRetry(); }
    };
    const use = (b: string) => { setConn(b, getPrefix()); setBase(b); onRetry(); };
    const save = () => { setConn(base, prefix); onRetry(); };

    return (
        <section className="pl-card pl-conn">
            <header><h2>Chưa kết nối được máy chủ API</h2></header>
            <div className="pl-alert err"><Icon n="alert" s={18} /><span>{message}{status ? ` (HTTP ${status})` : ''}</span></div>

            <div className="pl-conn-grid">
                <div>
                    <h3 className="pl-h3">Đang gọi tới</h3>
                    <code className="pl-code">{endpoint('plans/options')}</code>
                    <p className="pl-mut">Token đăng nhập: {hasToken() ? <b style={{ color: '#059669' }}>có</b> : <b style={{ color: '#dc2626' }}>không tìm thấy – hãy đăng nhập lại</b>}</p>

                    <h3 className="pl-h3">Nhập tay địa chỉ API</h3>
                    <div className="pl-form">
                        <label>Địa chỉ gốc API<input className="pl-in" value={base} onChange={(e) => setBase(e.target.value)} placeholder="http://127.0.0.1:8000/api/v1" /></label>
                        <label>Tiền tố route admin<input className="pl-in" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="/admin" /></label>
                    </div>
                    <div className="pl-row">
                        <button className="pl-btn" onClick={save}>Lưu & thử lại</button>
                        <button className="pl-btn ghost" onClick={onRetry}>Thử lại</button>
                    </div>
                </div>

                <div>
                    <h3 className="pl-h3">Tự dò địa chỉ API</h3>
                    <p className="pl-mut">Thử lần lượt các địa chỉ thường gặp và tự chọn địa chỉ chạy được.</p>
                    <button className="pl-btn ghost" onClick={run} disabled={busy}>{busy ? 'Đang dò…' : 'Tự dò địa chỉ API'}</button>
                    {rows && (
                        <div className="pl-tw"><table className="pl-table">
                            <thead><tr><th>Địa chỉ</th><th>Kết quả</th><th></th></tr></thead>
                            <tbody>
                            {rows.map((r) => {
                                const x = explain(r.status);
                                return (
                                    <tr key={r.base}>
                                        <td><code>{r.base}</code><div className="pl-mut" style={{ fontSize: '.85em' }}>{x.d}</div></td>
                                        <td><Pill tone={x.t}>{x.l}</Pill><div className="pl-mut" style={{ fontSize: '.8em' }}>{r.ms} ms</div></td>
                                        <td>{r.status !== 'network' && <button className="pl-btn ghost sm" onClick={() => use(r.base)}>Dùng</button>}</td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table></div>
                    )}
                </div>
            </div>

            <h3 className="pl-h3">Kiểm tra theo thứ tự</h3>
            <ol className="pl-steps">
                <li>Backend đang chạy (<code>php artisan serve</code> hoặc Docker) và mở được địa chỉ ở trên trên trình duyệt.</li>
                <li>Đã dán nội dung <code>plans_snippet.php</code> <b>vào trong</b> nhóm route Ban Giám hiệu của <code>routes/api.php</code>, rồi chạy <code>php artisan route:list --path=data-hub</code> thấy route.</li>
                <li>Đã chạy <code>php artisan migrate</code> (4 bảng school_plan*).</li>
                <li>CORS cho phép <code>http://localhost:3000</code> (file <code>config/cors.php</code>), sau đó <code>php artisan config:clear</code>.</li>
                <li>Đăng nhập admin và có token (mục “Token đăng nhập” ở trên là “có”).</li>
            </ol>
        </section>
    );
}