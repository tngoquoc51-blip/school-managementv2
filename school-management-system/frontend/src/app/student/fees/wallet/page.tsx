'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './wallet.css';

type PayMethod = 'momo' | 'vnpay';
type TxType = 'topup' | 'pay_fee' | 'refund';

interface Tx {
    id: string;
    type: TxType;
    title: string;
    amount: number;
    method?: string;
    status: 'success' | 'pending' | 'failed';
    time: string;
}

const PRESETS = [100000, 200000, 500000, 1000000, 2000000];
const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

function money(n: number) {
    return new Intl.NumberFormat('vi-VN').format(Math.abs(n)) + ' đ';
}

function token() {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('hs_token') || localStorage.getItem('token') || '';
}

export default function StudentWalletPage() {
    const [balance, setBalance] = useState(0);
    const [txs, setTxs] = useState<Tx[]>([]);
    const [amount, setAmount] = useState(200000);
    const [custom, setCustom] = useState('');
    const [method, setMethod] = useState<PayMethod>('momo');
    const [loading, setLoading] = useState(false);
    const [booting, setBooting] = useState(true);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<'all' | 'topup' | 'pay_fee'>('all');

    const loadWallet = useCallback(async () => {
        const t = token();
        if (!t) {
            setBooting(false);
            return;
        }
        try {
            const [bRes, tRes] = await Promise.all([
                fetch(`${API}/hs/wallet/balance`, {
                    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
                }),
                fetch(`${API}/hs/wallet/transactions`, {
                    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
                }),
            ]);

            if (bRes.ok) {
                const j = await bRes.json();
                setBalance(Number(j?.data?.balance ?? 0));
            }

            if (tRes.ok) {
                const j = await tRes.json();
                const list: Tx[] = (j.data || []).map((r: any) => ({
                    id: String(r.id),
                    type: (r.type || 'topup') as TxType,
                    title: r.title || 'Giao dịch',
                    amount: Number(r.amount || 0),
                    method: r.method || undefined,
                    status: (r.status || 'success') as Tx['status'],
                    time: r.time || '',
                }));
                setTxs(list);
            }
        } catch {
            /* giữ nguyên state */
        } finally {
            setBooting(false);
        }
    }, []);

    useEffect(() => {
        loadWallet();

        const params = new URLSearchParams(window.location.search);
        if (params.get('pay') === 'success') {
            setMsg('Thanh toán thành công – số dư đã cập nhật.');
            loadWallet();
        }
        if (params.get('pay') === 'failed') {
            setErr('Thanh toán không thành công.');
        }

        // badge module fees (nếu có API)
        const t = token();
        if (t) {
            fetch(`${API}/hs/notifications/read-module`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${t}`,
                    Accept: 'application/json',
                },
                body: JSON.stringify({ module: 'fees' }),
            })
                .then(() => window.dispatchEvent(new Event('badges-updated')))
                .catch(() => {});
        }
    }, [loadWallet]);

    const displayAmount = custom ? Number(custom.replace(/\D/g, '')) || 0 : amount;

    const filtered = useMemo(() => {
        if (tab === 'all') return txs;
        return txs.filter((x) => x.type === tab);
    }, [txs, tab]);

    const topupMonth = useMemo(
        () => txs.filter((x) => x.type === 'topup' && x.status === 'success').reduce((s, x) => s + x.amount, 0),
        [txs]
    );
    const paidFees = useMemo(
        () =>
            Math.abs(
                txs.filter((x) => x.type === 'pay_fee' && x.status === 'success').reduce((s, x) => s + x.amount, 0)
            ),
        [txs]
    );

    const startTopup = async () => {
        setErr('');
        setMsg('');
        if (displayAmount < 10000) {
            setErr('Số tiền nạp tối thiểu 10.000 đ');
            return;
        }
        if (displayAmount > 50000000) {
            setErr('Số tiền nạp tối đa 50.000.000 đ / lần');
            return;
        }

        setLoading(true);
        try {
            const t = token();
            const res = await fetch(`${API}/hs/wallet/topup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(t ? { Authorization: `Bearer ${t}` } : {}),
                },
                body: JSON.stringify({
                    amount: displayAmount,
                    method,
                    return_url: `${window.location.origin}/student/fees/wallet`,
                }),
            });

            const json = await res.json().catch(() => ({}));

            // Có link cổng thật
            if (res.ok && json.data?.pay_url) {
                window.location.href = json.data.pay_url;
                return;
            }

            // Demo local backend (WALLET_DEMO_TOPUP) — res.ok, không có pay_url
            if (res.ok) {
                setMsg(json.message || `Đã nạp ${money(displayAmount)} vào ví.`);
                await loadWallet();
                return;
            }

            setErr(json.message || 'Không tạo được phiên thanh toán. Kiểm tra đăng nhập / API.');
        } catch {
            setErr('Không kết nối được máy chủ API (port 8000).');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wl-page">
            <header className="wl-hero">
                <div className="wl-hero-main">
                    <p className="wl-kicker">Ví học phí · Cổng học sinh</p>
                    <h1>Số dư khả dụng</h1>
                    <div className="wl-balance">{booting ? '…' : money(balance)}</div>
                    <p className="wl-hero-note">
                        Dùng để thanh toán học phí, khoản thu nhà trường. Nạp qua MoMo hoặc VNPay (sandbox khi test).
                    </p>
                    <div className="wl-hero-actions">
                        <a href="#nap-tien" className="wl-btn-primary">Nạp tiền vào ví</a>
                        <Link href="/student/fees" className="wl-btn-ghost">Hóa đơn học phí</Link>
                    </div>
                </div>
                <div className="wl-hero-cards">
                    <div className="wl-mini">
                        <span>Đã nạp (từ lịch sử)</span>
                        <strong>{money(topupMonth)}</strong>
                    </div>
                    <div className="wl-mini">
                        <span>Đã chi học phí</span>
                        <strong>{money(paidFees)}</strong>
                    </div>
                    <div className="wl-mini">
                        <span>Giao dịch</span>
                        <strong>{txs.length}</strong>
                    </div>
                </div>
            </header>

            <div className="wl-grid">
                <section className="wl-card" id="nap-tien">
                    <div className="wl-card-head">
                        <h2>Nạp tiền vào ví</h2>
                        <span className="wl-tag">MoMo · VNPay Sandbox</span>
                    </div>

                    {err && <div className="wl-alert err">{err}</div>}
                    {msg && <div className="wl-alert ok">{msg}</div>}

                    <p className="wl-label">Chọn số tiền</p>
                    <div className="wl-presets">
                        {PRESETS.map((p) => (
                            <button
                                key={p}
                                type="button"
                                className={`wl-preset ${!custom && amount === p ? 'on' : ''}`}
                                onClick={() => {
                                    setAmount(p);
                                    setCustom('');
                                }}
                            >
                                {money(p)}
                            </button>
                        ))}
                    </div>

                    <label className="wl-label" htmlFor="custom-amount">Hoặc nhập số khác</label>
                    <div className="wl-input">
                        <input
                            id="custom-amount"
                            inputMode="numeric"
                            placeholder="VD: 300000"
                            value={custom}
                            onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))}
                        />
                        <span>đ</span>
                    </div>

                    <p className="wl-label">Phương thức</p>
                    <div className="wl-methods">
                        <button
                            type="button"
                            className={`wl-method ${method === 'momo' ? 'on' : ''}`}
                            onClick={() => setMethod('momo')}
                        >
                            <span className="wl-method-logo momo">Momo</span>
                            <div>
                                <b>Ví MoMo</b>
                                <small>Sandbox test</small>
                            </div>
                        </button>
                        <button
                            type="button"
                            className={`wl-method ${method === 'vnpay' ? 'on' : ''}`}
                            onClick={() => setMethod('vnpay')}
                        >
                            <span className="wl-method-logo vnpay">VNP</span>
                            <div>
                                <b>VNPay</b>
                                <small>Sandbox test</small>
                            </div>
                        </button>
                    </div>

                    <div className="wl-summary">
                        <span>Số tiền nạp</span>
                        <strong>{money(displayAmount)}</strong>
                    </div>

                    <button
                        type="button"
                        className="wl-btn-pay"
                        disabled={loading || displayAmount < 10000}
                        onClick={startTopup}
                    >
                        {loading
                            ? 'Đang tạo phiên…'
                            : `Thanh toán ${money(displayAmount)} bằng ${method === 'momo' ? 'MoMo' : 'VNPay'}`}
                    </button>

                    <p className="wl-hint">
                        Chưa cấu hình sandbox: hệ thống demo cộng tiền vào DB. Có key MoMo/VNPay sẽ mở cổng thanh toán.
                    </p>
                </section>

                <aside className="wl-side">
                    <div className="wl-card">
                        <div className="wl-card-head">
                            <h2>Lịch sử ví</h2>
                            <div className="wl-tabs">
                                {(['all', 'topup', 'pay_fee'] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        className={tab === t ? 'on' : ''}
                                        onClick={() => setTab(t)}
                                    >
                                        {t === 'all' ? 'Tất cả' : t === 'topup' ? 'Nạp' : 'Chi'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <ul className="wl-tx-list">
                            {filtered.map((tx) => (
                                <li key={tx.id} className={`wl-tx ${tx.type}`}>
                                    <div className="wl-tx-ico">
                                        {tx.type === 'topup' ? '↓' : tx.type === 'refund' ? '↺' : '↑'}
                                    </div>
                                    <div className="wl-tx-body">
                                        <b>{tx.title}</b>
                                        <span>
                                            {tx.time}
                                            {tx.method ? ` · ${tx.method}` : ''}
                                        </span>
                                    </div>
                                    <div className={`wl-tx-amt ${tx.amount >= 0 ? 'plus' : 'minus'}`}>
                                        {tx.amount >= 0 ? '+' : '−'}
                                        {money(tx.amount)}
                                        <small className={`st-${tx.status}`}>
                                            {tx.status === 'success'
                                                ? 'Thành công'
                                                : tx.status === 'pending'
                                                    ? 'Đang xử lý'
                                                    : 'Thất bại'}
                                        </small>
                                    </div>
                                </li>
                            ))}
                            {filtered.length === 0 && (
                                <li className="wl-empty">Chưa có giao dịch.</li>
                            )}
                        </ul>
                        <Link href="/student/fees/history" className="wl-link-more">
                            Xem lịch sử đầy đủ →
                        </Link>
                    </div>

                    <div className="wl-card tip">
                        <h2>Thanh toán học phí bằng ví</h2>
                        <ol>
                            <li>Nạp tiền vào ví (MoMo / VNPay).</li>
                            <li>
                                Vào <Link href="/student/fees">Hóa đơn học phí</Link>.
                            </li>
                            <li>Chọn khoản cần đóng → Thanh toán bằng số dư ví.</li>
                        </ol>
                    </div>
                </aside>
            </div>
        </div>
    );
}