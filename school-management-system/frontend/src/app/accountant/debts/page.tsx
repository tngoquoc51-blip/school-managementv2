'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export default function AccountantDebtsPage() {
    const [rows, setRows] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [grade, setGrade] = useState('');
    const [status, setStatus] = useState('all');
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (grade) params.set('grade', grade);
        if (status) params.set('status', status);
        if (q.trim()) params.set('q', q.trim());

        fetch(`${API}/accountant/debts?${params}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.success) {
                    setRows(json.data || []);
                    setSummary(json.summary || null);
                } else setError('Không tải được công nợ');
            })
            .catch(() => setError('Lỗi kết nối API'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const formatCompact = (n: number) => {
        if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + ' tỷ';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' triệu';
        return n.toLocaleString('vi-VN') + ' đ';
    };

    return (
        <div className="acc-page">
            <div className="acc-hero">
                <h1>Công nợ học phí</h1>
                <p>Danh sách học sinh còn phải thu · Dữ liệu từ hệ thống</p>
            </div>

            <div className="acc-stats">
                <div className="acc-stat">
                    <span className="acc-stat-val red">{summary?.debt_count ?? '—'}</span>
                    <span className="acc-stat-lbl">Học sinh còn nợ</span>
                </div>
                <div className="acc-stat">
          <span className="acc-stat-val amber">
            {summary ? formatCompact(summary.total_debt) : '—'}
          </span>
                    <span className="acc-stat-lbl">Tổng công nợ</span>
                </div>
                <div className="acc-stat">
                    <span className="acc-stat-val sky">{summary?.partial_count ?? '—'}</span>
                    <span className="acc-stat-lbl">Nợ một phần</span>
                </div>
                <div className="acc-stat">
                    <span className="acc-stat-val red">{summary?.unpaid_count ?? '—'}</span>
                    <span className="acc-stat-lbl">Chưa đóng</span>
                </div>
            </div>

            <div className="acc-panel">
                <div className="acc-toolbar">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <select className="acc-select" value={grade} onChange={(e) => setGrade(e.target.value)}>
                            <option value="">Tất cả khối</option>
                            <option value="10">Khối 10</option>
                            <option value="11">Khối 11</option>
                            <option value="12">Khối 12</option>
                        </select>
                        <select className="acc-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="all">Mọi trạng thái</option>
                            <option value="unpaid">Chưa đóng</option>
                            <option value="partial">Đóng một phần</option>
                        </select>
                        <input
                            className="acc-input"
                            placeholder="Tìm tên / mã HS..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                        <button type="button" className="acc-btn-primary" onClick={load}>
                            Lọc
                        </button>
                    </div>
                    <button type="button" className="acc-btn-outline">Xuất Excel</button>
                </div>

                {error && <p style={{ color: '#dc2626' }}>{error}</p>}
                {loading && <p style={{ color: '#64748b' }}>Đang tải...</p>}

                <div className="acc-table-wrap">
                    <table className="acc-table">
                        <thead>
                        <tr>
                            <th>STT</th>
                            <th>Mã HS</th>
                            <th>Họ và tên</th>
                            <th>Lớp</th>
                            <th>Phải thu</th>
                            <th>Đã thu</th>
                            <th>Còn nợ</th>
                            <th>Trạng thái</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((d) => (
                            <tr key={d.code}>
                                <td>{d.stt}</td>
                                <td>{d.code}</td>
                                <td style={{ fontWeight: 600, color: '#0c4a6e' }}>{d.name}</td>
                                <td>{d.class}</td>
                                <td className="acc-money">{d.total}</td>
                                <td className="acc-money green">{d.paid}</td>
                                <td className="acc-money red">{d.debt}</td>
                                <td>
                                    {d.status === 'unpaid' ? (
                                        <span className="acc-badge-debt">Chưa đóng</span>
                                    ) : (
                                        <span className="acc-badge-partial">Một phần</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && rows.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8' }}>
                                    Không có học sinh còn nợ
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