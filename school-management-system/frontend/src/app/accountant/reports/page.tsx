'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function AccountantReportsPage() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${API}/accountant/reports`)
            .then((r) => r.json())
            .then((json) => {
                if (json.success) setData(json.data);
                else setError('Không tải được báo cáo');
            })
            .catch(() => setError('Lỗi kết nối API'));
    }, []);

    if (error) {
        return (
            <div className="acc-page">
                <p style={{ color: '#dc2626' }}>{error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="acc-page">
                <p>Đang tải...</p>
            </div>
        );
    }

    return (
        <div className="acc-page">
            <div className="acc-hero">
                <h1>Báo cáo thu chi</h1>
                <p>Thống kê từ hệ thống · Năm học hiện tại</p>
            </div>

            <div className="acc-stats">
                <div className="acc-stat">
                    <span className="acc-stat-val green">{data.today_collected_label}</span>
                    <span className="acc-stat-lbl">Thu hôm nay</span>
                </div>
                <div className="acc-stat">
                    <span className="acc-stat-val sky">{data.semester_collected_label}</span>
                    <span className="acc-stat-lbl">Thu HK (lũy kế)</span>
                </div>
                <div className="acc-stat">
                    <span className="acc-stat-val amber">{data.semester_debt_label}</span>
                    <span className="acc-stat-lbl">Còn phải thu</span>
                </div>
                <div className="acc-stat">
                    <span className="acc-stat-val">{(data.by_item || []).length}</span>
                    <span className="acc-stat-lbl">Khoản thu</span>
                </div>
            </div>

            <div className="acc-panel">
                <div className="acc-toolbar">
                    <h2 style={{ margin: 0 }}>Theo từng khoản thu</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="acc-btn-outline">Xuất Excel</button>
                        <button type="button" className="acc-btn-primary">Xuất PDF</button>
                    </div>
                </div>

                <div className="acc-table-wrap">
                    <table className="acc-table">
                        <thead>
                        <tr>
                            <th>Khoản thu</th>
                            <th>Số HS đã đóng</th>
                            <th>Số tiền đã thu</th>
                            <th>Số HS còn nợ</th>
                            <th>Số tiền còn lại</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(data.by_item || []).map((r: any) => (
                            <tr key={r.name}>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td>{r.paid_students}</td>
                                <td className="acc-money green">{r.collected}</td>
                                <td>{r.debt_students}</td>
                                <td className="acc-money red">{r.remain}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}