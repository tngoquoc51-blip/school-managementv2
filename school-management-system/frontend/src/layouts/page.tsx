'use client';

import Link from 'next/link';

/* ====== DỮ LIỆU DEMO – thay bằng dữ liệu thật / gọi API của bạn ====== */
const COLLECTED = 5_700_000; // đã thu
const OUTSTANDING = 4_500_000; // còn phải thu
const PAID_FULL = 2; // HS đã đóng đủ
const IN_DEBT = 6; // HS còn nợ

const RECENT = [
    { name: 'Trần Thị Học', cls: '10A2', amount: 600_000, date: '14/10/2026' },
    { name: 'Lê Minh Đức', cls: '12A3', amount: 120_000, date: '13/10/2026' },
    { name: 'Nguyễn Văn An', cls: '11B1', amount: 1_200_000, date: '13/10/2026' },
    { name: 'Phạm Thu Hà', cls: '10A1', amount: 600_000, date: '12/10/2026' },
];

const ACTIONS = [
    { href: '/accountant/collection', label: 'Thu học phí', icon: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> },
    { href: '/accountant/debts', label: 'Xem công nợ', icon: <><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18h.01" /></> },
    { href: '/accountant/receipts', label: 'Tra cứu phiếu thu', icon: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></> },
    { href: '/accountant/reports', label: 'Báo cáo thu chi', icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></> },
];

/* ====== TIỆN ÍCH ====== */
const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';
const million = (n: number) => (n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' triệu';

function termInfo(d = new Date()) {
    const m = d.getMonth(); // 0 = tháng 1
    const start = m >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    const term = m >= 8 || m === 0 ? 'Học kỳ 1' : 'Học kỳ 2';
    return `Năm học ${start} – ${start + 1} · ${term}`;
}

const Svg = ({ children }: { children: React.ReactNode }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
    </svg>
);

export default function AccountantDashboard() {
    const rate = Math.round((COLLECTED / (COLLECTED + OUTSTANDING)) * 100);

    return (
        <>
            <p className="ui-sub">{termInfo()} · Dữ liệu từ hệ thống</p>

            <div className="ui-stats">
                <div className="ui-stat ok">
                    <div className="ui-stat-icon"><Svg><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{million(COLLECTED)}</div>
                        <div className="ui-stat-label">Đã thu học phí</div>
                    </div>
                </div>
                <div className="ui-stat warn">
                    <div className="ui-stat-icon"><Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{million(OUTSTANDING)}</div>
                        <div className="ui-stat-label">Còn phải thu</div>
                    </div>
                </div>
                <div className="ui-stat blue">
                    <div className="ui-stat-icon"><Svg><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{PAID_FULL} HS</div>
                        <div className="ui-stat-label">Đã đóng đủ</div>
                    </div>
                </div>
                <div className="ui-stat bad">
                    <div className="ui-stat-icon"><Svg><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18h.01" /></Svg></div>
                    <div>
                        <div className="ui-stat-value">{IN_DEBT} HS</div>
                        <div className="ui-stat-label">Còn nợ</div>
                    </div>
                </div>
            </div>

            <div className="ui-card">
                <div className="ui-progress-top">
                    <b>Tiến độ thu học phí</b>
                    <span>{rate}%</span>
                </div>
                <div className="ui-progress" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}>
                    <span style={{ width: `${rate}%` }} />
                </div>
                <div className="ui-progress-legend">
                    <span>Đã thu: {money(COLLECTED)}</span>
                    <span>Còn lại: {money(OUTSTANDING)}</span>
                </div>
            </div>

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
                            {RECENT.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.name}</td>
                                    <td><span className="ui-class">{r.cls}</span></td>
                                    <td className="num">{money(r.amount)}</td>
                                    <td>{r.date}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </>
    );
}