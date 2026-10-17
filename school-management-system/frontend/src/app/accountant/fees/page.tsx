'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function AccountantFeesPage() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API}/accountant/fees`)
            .then((r) => r.json())
            .then((json) => {
                if (json.success) setItems(json.data || []);
                else setError('Không tải được danh mục');
            })
            .catch(() => setError('Lỗi kết nối API'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="acc-page">
            <div className="acc-hero">
                <h1>Danh mục học phí & khoản thu</h1>
                <p>Dữ liệu từ hệ thống · Năm học hiện tại</p>
            </div>

            <div className="acc-panel">
                <div className="acc-toolbar">
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {loading ? 'Đang tải...' : `${items.length} khoản thu`}
          </span>
                    <button type="button" className="acc-btn-primary">+ Thêm khoản thu</button>
                </div>

                {error && <p style={{ color: '#dc2626' }}>{error}</p>}

                <div className="acc-table-wrap">
                    <table className="acc-table">
                        <thead>
                        <tr>
                            <th>STT</th>
                            <th>Tên khoản thu</th>
                            <th>Đối tượng</th>
                            <th>Số tiền</th>
                            <th>Kỳ thu</th>
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((f) => (
                            <tr key={f.id}>
                                <td>{f.stt}</td>
                                <td style={{ fontWeight: 600, color: '#0c4a6e' }}>{f.name}</td>
                                <td>{f.target}</td>
                                <td className="acc-money">{f.amount} đ</td>
                                <td>{f.period}</td>
                                <td>
                                    {f.status === 'active' ? (
                                        <span className="acc-badge-ok">{f.status_label}</span>
                                    ) : (
                                        <span className="acc-badge-partial">{f.status_label}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && items.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>
                                    Chưa có khoản thu
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