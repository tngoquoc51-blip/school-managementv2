'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

/* Cấu trúc dữ liệu API trả về (giữ nguyên các trường của bạn) */
interface Receipt {
    receipt_no: string;
    student: string;
    class: string;
    amount: string;
    date: string;
}

interface DashboardData {
    total_collected_label: string;
    total_debt_label: string;
    paid_full_count: number;
    debt_student_count: number;
    total_collected?: number; // tuỳ chọn: nếu API có số thô thì hiện thanh tiến độ
    total_debt?: number;
    recent_receipts?: Receipt[];
}

function termInfo(d = new Date()) {
    const m = d.getMonth();
    const start = m >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    const term = m >= 8 || m === 0 ? 'Học kỳ 1' : 'Học kỳ 2';
    return `Năm học ${start} – ${start + 1} · ${term}`;
}

const Svg = ({ children }: { children: ReactNode }) => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);

const ACTIONS = [
    { href: '/accountant/collection', label: 'Thu học phí', icon: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> },
    { href: '/accountant/debts', label: 'Xem công nợ', icon: <><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18h.01" /></> },
    { href: '/accountant/receipts', label: 'Tra cứu phiếu thu', icon: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></> },
    { href: '/accountant/reports', label: 'Báo cáo thu chi', icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></> },
];

export default function AccountantDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const ctrl = new AbortController();
        setError('');
        setData(null);

        fetch(`${API}/accountant/dashboard`, { signal: ctrl.signal })
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            })
            .then((json) => {
                if (json.success) setData(json.data as DashboardData);
                else setError('Không tải được dữ liệu');
            })
            .catch((err) => {
                if (err?.name !== 'AbortError') setError('Lỗi kết nối API (kiểm tra php artisan serve)');
            });

        return () => ctrl.abort();
    }, [reload]);

    /* ---- lỗi ---- */
    if (error) {
        return (
            <div className="ui-alert" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => setReload((n) => n + 1)}>Thử lại</button>
            </div>
        );
    }

    /* ---- đang tải ---- */
    if (!data) {
        return (
            <div aria-busy="true" aria-label="Đang tải dữ liệu">
                <div className="ui-stats">
                    {[0, 1, 2, 3].map((i) => <div key={i} className="ui-skel" />)}
                </div>
                <div className="ui-skel tall" />
            </div>
        );
    }

    const hasProgress =
        typeof data.total_collected === 'number' && typeof data.total_debt === 'number' &&
        data.total_collected + data.total_debt > 0;
    const rate = hasProgress
        ? Math.round((data.total_collected! / (data.total_collected! + data.total_debt!)) * 100)
        : 0;
    const receipts = data.recent_receipts || [];

    return (
        <>
            <p className="ui-sub">{termInfo()} · Dữ liệu từ hệ thống</p>

            <div className="ui-stats">
                <div className="ui-stat ok">
                    <div className="ui-stat-icon"><Svg><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{data.total_collected_label}</div>
                        <div className="ui-stat-label">Đã thu học phí</div>
                    </div>
                </div>
                <div className="ui-stat warn">
                    <div className="ui-stat-icon"><Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{data.total_debt_label}</div>
                        <div className="ui-stat-label">Còn phải thu</div>
                    </div>
                </div>
                <div className="ui-stat blue">
                    <div className="ui-stat-icon"><Svg><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{data.paid_full_count} HS</div>
                        <div className="ui-stat-label">Đã đóng đủ</div>
                    </div>
                </div>
                <div className="ui-stat bad">
                    <div className="ui-stat-icon"><Svg><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18h.01" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{data.debt_student_count} HS</div>
                        <div className="ui-stat-label">Còn nợ</div>
                    </div>
                </div>
            </div>

            {hasProgress && (
                <div className="ui-card">
                    <div className="ui-progress-top">
                        <b>Tiến độ thu học phí</b>
                        <span>{rate}%</span>
                    </div>
                    <div className="ui-progress" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: `${rate}%` }} />
                    </div>
                    <div className="ui-progress-legend">
                        <span>Đã thu: {data.total_collected_label}</span>
                        <span>Còn lại: {data.total_debt_label}</span>
                    </div>
                </div>
            )}

            <div className="ui-grid">
                <section className="ui-card">
                    <div className="ui-card-head"><h2>Thao tác nhanh</h2></div>
                    <div className="ui-actions">
                        {ACTIONS.map((a) => (
                            <Link key={a.href} href={a.href} className="ui-action">
                                <Svg>{a.icon}</Svg>
                                {a.label}
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="ui-card">
                    <div className="ui-card-head">
                        <h2>Thu gần đây</h2>
                        <Link href="/accountant/receipts">Xem tất cả</Link>
                    </div>
                    {receipts.length === 0 ? (
                        <p className="ui-empty">Chưa có phiếu thu nào.</p>
                    ) : (
                        <div className="ui-table-wrap">
                            <table className="ui-table">
                                <thead>
                                <tr>
                                    <th>Học sinh</th>
                                    <th>Lớp</th>
                                    <th className="num">Số tiền</th>
                                    <th>Ngày</th>
                                </tr>
                                </thead>
                                <tbody>
                                {receipts.map((r) => (
                                    <tr key={r.receipt_no}>
                                        <td>{r.student}</td>
                                        <td><span className="ui-class">{r.class}</span></td>
                                        <td className="num">{r.amount}</td>
                                        <td>{r.date}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}