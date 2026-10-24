// Gọi API học phí của học sinh: /api/hs/fees/*  (dùng token đăng nhập của học sinh)
import { getStudentToken } from '@/hooks/useCurrentStudent';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export class FeeError extends Error {
    status: number;
    constructor(m: string, status: number) { super(m); this.status = status; }
}

export async function feeApi<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
    const token = getStudentToken();
    if (!token) throw new FeeError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);
    let res: Response;
    try {
        res = await fetch(`${API}/hs/fees/${path}`, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
    } catch {
        throw new FeeError('Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.', 0);
    }
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new FeeError(json?.message || 'Có lỗi xảy ra, vui lòng thử lại.', res.status);
    return (json?.data ?? json) as T;
}

export const qs = (o: Record<string, string | number | null | undefined>) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.set(k, String(v)); });
    const s = p.toString();
    return s ? `?${s}` : '';
};

export const vnd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n.toLocaleString('vi-VN')}đ`);
export const vndShort = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu` : n.toLocaleString('vi-VN') + 'đ');

export const STATUS: Record<string, { label: string; tone: string }> = {
    paid: { label: 'Đã thanh toán', tone: 'ok' },
    partial: { label: 'Thanh toán một phần', tone: 'warn' },
    unpaid: { label: 'Chưa thanh toán', tone: 'info' },
    cancelled: { label: 'Đã hủy', tone: 'mut' },
    overdue: { label: 'Quá hạn', tone: 'err' },
    confirmed: { label: 'Đã xác nhận', tone: 'ok' },
    pending: { label: 'Chờ xác nhận', tone: 'warn' },
    rejected: { label: 'Bị từ chối', tone: 'err' },
};