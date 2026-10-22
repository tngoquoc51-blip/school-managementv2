const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

function token() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('hs_token') || localStorage.getItem('token');
}

function headers() {
    const t = token();
    return {
        Accept: 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
}

export type TxType = 'all' | 'topup' | 'pay' | 'refund';

export type WalletTx = {
    id: number | string;
    type: string; // momo | vnpay | pay_fee | refund...
    title: string;
    amount: number;
    status: string; // success | pending | failed
    created_at: string;
    ref?: string;
    note?: string;
};

export async function fetchWalletBalance(): Promise<number> {
    try {
        const res = await fetch(`${API}/hs/wallet/balance`, { headers: headers(), cache: 'no-store' });
        if (!res.ok) return 0;
        const j = await res.json();
        return Number(j?.data?.balance ?? j?.balance ?? 0);
    } catch {
        return 0;
    }
}

export async function fetchWalletTransactions(): Promise<WalletTx[]> {
    try {
        const res = await fetch(`${API}/hs/wallet/transactions`, { headers: headers(), cache: 'no-store' });
        if (!res.ok) return [];
        const j = await res.json();
        const list = j?.data ?? j ?? [];
        if (!Array.isArray(list)) return [];
        return list.map((x: any, i: number) => ({
            id: x.id ?? i,
            type: x.type ?? x.channel ?? x.method ?? 'other',
            title: x.title ?? x.description ?? x.note ?? 'Giao dịch',
            amount: Number(x.amount ?? 0),
            status: x.status ?? 'pending',
            created_at: x.created_at ?? x.time ?? '',
            ref: x.ref ?? x.order_id ?? x.txn_ref ?? '',
            note: x.note ?? x.description ?? '',
        }));
    } catch {
        return [];
    }
}