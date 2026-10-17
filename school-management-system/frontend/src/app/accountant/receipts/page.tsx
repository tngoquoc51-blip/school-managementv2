'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function AccountantReceiptsPage() {
    const [rows, setRows] = useState<any[]>([]);
    const [q, setQ] = useState('');
    const [date, setDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (date) params.set('date', date);

        fetch(`${API}/accountant/receipts?${params}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.success) setRows(json.data || []);
                else setError('Không tải được phiếu thu');
            })
            .catch(() => setError('Lỗi kết nối API'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="acc-page">
            <div className="acc-hero">
                <h1>Phiếu thu / Biên lai</h1>
                <p>Tra cứu phiếu thu từ hệ thống</p>
            </div>

            <div className="acc-panel">
                <div className="acc-toolbar">
                    <input
                        className="acc-input"
                        placeholder="Số phiếu / Mã HS / Tên..."
                        style={{ minWidth: 240 }}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <input
                        className="acc-input"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                    <button type="button" className="acc-btn-primary" onClick={load}>
                        Tìm
                    </button>
                </div>

                {error && <p style={{ color: '#dc2626' }}>{error}</p>}
                {loading && <p style={{ color: '#64748b' }}>Đang tải...</p>}

                <div className="acc-table-wrap">
                    <table className="acc-table">
                        <thead>
                        <tr>
                            <th>Số phiếu</th>
                            <th>Học sinh</th>
                            <th>Lớp</th>
                            <th>Số tiền</th>
                            <th>Hình thức</th>
                            <th>Ngày thu</th>
                            <th>Người thu</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((r) => (
                            <tr key={r.no}>
                                <td style={{ fontWeight: 600, color: '#0284c7' }}>{r.no}</td>
                                <td>{r.student}</td>
                                <td>{r.class}</td>
                                <td className="acc-money green">{r.amount}</td>
                                <td>{r.method}</td>
                                <td>{r.date}</td>
                                <td>{r.by}</td>
                                <td>
                                    <button type="button" className="acc-btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}>
                                        In lại
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8' }}>
                                    Không có phiếu thu
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}