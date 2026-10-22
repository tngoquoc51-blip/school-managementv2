'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    fetchWalletBalance,
    fetchWalletTransactions,
    type WalletTx,
    type TxType,
} from '@/lib/hs-wallet';
import './history.css';

type Tab = 'all' | 'topup' | 'pay' | 'pending';

function formatVnd(n: number) {
    return new Intl.NumberFormat('vi-VN').format(Math.abs(n)) + ' đ';
}

function isTopup(t: WalletTx) {
    const s = `${t.type} ${t.title}`.toLowerCase();
    return s.includes('momo') || s.includes('vnpay') || s.includes('nạp') || s.includes('topup');
}

function isPay(t: WalletTx) {
    const s = `${t.type} ${t.title}`.toLowerCase();
    return s.includes('học phí') || s.includes('pay') || s.includes('chi') || s.includes('thanh toán');
}

function statusClass(s: string) {
    const x = s.toLowerCase();
    if (x.includes('success') || x.includes('thành') || x === 'paid' || x === 'done') return 'success';
    if (x.includes('fail') || x.includes('hủy') || x.includes('error')) return 'failed';
    return 'pending';
}

function statusLabel(s: string) {
    const c = statusClass(s);
    if (c === 'success') return 'Thành công';
    if (c === 'failed') return 'Thất bại';
    return 'Đang xử lý';
}

export default function FeeHistoryPage() {
    const [list, setList] = useState<WalletTx[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');
    const [q, setQ] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selected, setSelected] = useState<WalletTx | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [txs, bal] = await Promise.all([fetchWalletTransactions(), fetchWalletBalance()]);
        setList(txs);
        setBalance(bal);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        return list.filter((t) => {
            if (tab === 'topup' && !isTopup(t)) return false;
            if (tab === 'pay' && !isPay(t)) return false;
            if (tab === 'pending' && statusClass(t.status) !== 'pending') return false;
            if (statusFilter !== 'all' && statusClass(t.status) !== statusFilter) return false;
            if (q.trim()) {
                const hay = `${t.title} ${t.ref} ${t.note}`.toLowerCase();
                if (!hay.includes(q.trim().toLowerCase())) return false;
            }
            return true;
        });
    }, [list, tab, q, statusFilter]);

    const sumTopup = list.filter(isTopup).reduce((s, t) => s + Math.abs(t.amount), 0);
    const sumPay = list.filter(isPay).reduce((s, t) => s + Math.abs(t.amount), 0);
    const pendingCount = list.filter((t) => statusClass(t.status) === 'pending').length;

    return (
        <div className="tx-page">
            <div className="tx-head">
                <div>
                    <h1>Lịch sử giao dịch</h1>
                    <p>Theo dõi nạp ví, thanh toán học phí và trạng thái từng giao dịch</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Link href="/student/fees/wallet" className="tx-btn-primary" style={{ textDecoration: 'none' }}>
                        Nạp tiền vào ví
                    </Link>
                    <Link href="/student/fees" className="tx-btn-ghost" style={{ textDecoration: 'none' }}>
                        Hóa đơn học phí
                    </Link>
                </div>
            </div>

            <div className="tx-stats">
                <div className="tx-stat">
                    <label>Số dư ví</label>
                    <strong>{formatVnd(balance)}</strong>
                </div>
                <div className="tx-stat ok">
                    <label>Tổng đã nạp</label>
                    <strong>+{formatVnd(sumTopup)}</strong>
                </div>
                <div className="tx-stat bad">
                    <label>Tổng chi / học phí</label>
                    <strong>-{formatVnd(sumPay)}</strong>
                </div>
                <div className="tx-stat warn">
                    <label>Đang xử lý</label>
                    <strong>{pendingCount}</strong>
                </div>
            </div>

            <div className="tx-toolbar">
                <div className="tx-tabs">
                    {(
                        [
                            ['all', 'Tất cả'],
                            ['topup', 'Nạp tiền'],
                            ['pay', 'Thanh toán'],
                            ['pending', 'Đang xử lý'],
                        ] as [Tab, string][]
                    ).map(([k, label]) => (
                        <button
                            key={k}
                            type="button"
                            className={`tx-tab ${tab === k ? 'active' : ''}`}
                            onClick={() => setTab(k)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="tx-search">
                    <input
                        placeholder="Tìm mã / nội dung..."
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Mọi trạng thái</option>
                        <option value="success">Thành công</option>
                        <option value="pending">Đang xử lý</option>
                        <option value="failed">Thất bại</option>
                    </select>
                    <button type="button" className="tx-btn" onClick={load}>
                        Làm mới
                    </button>
                </div>
            </div>

            <div className="tx-card">
                {loading ? (
                    <div className="tx-empty">Đang tải giao dịch...</div>
                ) : filtered.length === 0 ? (
                    <div className="tx-empty">Không có giao dịch phù hợp</div>
                ) : (
                    <table className="tx-table">
                        <thead>
                        <tr>
                            <th>Thời gian</th>
                            <th>Nội dung</th>
                            <th>Số tiền</th>
                            <th>Trạng thái</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map((t) => {
                            const plus = isTopup(t);
                            return (
                                <tr key={String(t.id)}>
                                    <td>
                                        <div className="tx-title">{t.created_at || '—'}</div>
                                    </td>
                                    <td>
                                        <div className="tx-title">{t.title}</div>
                                        <div className="tx-meta">
                                            {t.type}
                                            {t.ref ? ` · ${t.ref}` : ''}
                                        </div>
                                    </td>
                                    <td className={plus ? 'tx-amt-plus' : 'tx-amt-minus'}>
                                        {plus ? '+' : '-'}
                                        {formatVnd(t.amount)}
                                    </td>
                                    <td>
                      <span className={`tx-badge ${statusClass(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                                    </td>
                                    <td>
                                        <button type="button" className="tx-btn" onClick={() => setSelected(t)}>
                                            Chi tiết
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                )}
            </div>

            {selected && (
                <div className="tx-drawer-bg" onClick={() => setSelected(null)}>
                    <aside className="tx-drawer" onClick={(e) => e.stopPropagation()}>
                        <h2>Chi tiết giao dịch</h2>
                        <div className="tx-drawer-row">
                            <span>Nội dung</span>
                            <strong>{selected.title}</strong>
                        </div>
                        <div className="tx-drawer-row">
                            <span>Loại</span>
                            <strong>{selected.type}</strong>
                        </div>
                        <div className="tx-drawer-row">
                            <span>Số tiền</span>
                            <strong>{formatVnd(selected.amount)}</strong>
                        </div>
                        <div className="tx-drawer-row">
                            <span>Trạng thái</span>
                            <strong>{statusLabel(selected.status)}</strong>
                        </div>
                        <div className="tx-drawer-row">
                            <span>Thời gian</span>
                            <strong>{selected.created_at || '—'}</strong>
                        </div>
                        <div className="tx-drawer-row">
                            <span>Mã tham chiếu</span>
                            <strong>{selected.ref || '—'}</strong>
                        </div>
                        {selected.note && (
                            <div className="tx-drawer-row">
                                <span>Ghi chú</span>
                                <strong>{selected.note}</strong>
                            </div>
                        )}
                        <div className="tx-drawer-actions">
                            <button type="button" className="tx-btn-ghost" onClick={() => setSelected(null)}>
                                Đóng
                            </button>
                            {statusClass(selected.status) === 'pending' && (
                                <Link href="/student/fees/wallet" className="tx-btn-primary" style={{ textDecoration: 'none' }}>
                                    Tiếp tục thanh toán
                                </Link>
                            )}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}