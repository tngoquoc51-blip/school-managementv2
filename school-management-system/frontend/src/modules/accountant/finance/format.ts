import type { FinStatus, InvoiceState } from './types';

const nf = new Intl.NumberFormat('vi-VN');
export const vnd = (n: number | null | undefined) => `${nf.format(Math.round(n || 0))} ₫`;
export const num = (n: number | null | undefined) => nf.format(Math.round(n || 0));
export function vndShort(n: number): string {
    const a = Math.abs(n);
    if (a >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
    if (a >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} tr`;
    if (a >= 1e3) return `${Math.round(n / 1e3)}k`;
    return String(n);
}
export function fdate(d?: string | null): string {
    if (!d) return '—';
    const [y, m, day] = d.slice(0, 10).split('-');
    return y && m && day ? `${day}/${m}/${y}` : d;
}
export function fdt(d?: string | null): string {
    if (!d) return '—';
    return `${fdate(d)} ${d.slice(11, 16)}`;
}
export function ago(d?: string | null): string {
    if (!d) return '';
    const t = new Date(d.replace(' ', 'T')).getTime();
    if (isNaN(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'vừa xong';
    if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
    if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
    if (s < 86400 * 30) return `${Math.floor(s / 86400)} ngày trước`;
    return fdate(d);
}
export function initials(name: string): string {
    const p = name.trim().split(/\s+/);
    return ((p[p.length - 2]?.[0] || '') + (p[p.length - 1]?.[0] || '')).toUpperCase() || '?';
}
export const FIN_LABEL: Record<FinStatus, string> = { paid: 'Đã đủ', debt: 'Còn nợ', overdue: 'Quá hạn', none: 'Chưa có hóa đơn' };
export const INV_LABEL: Record<InvoiceState, string> = { paid: 'Đã thanh toán', unpaid: 'Chưa thanh toán', partial: 'Thanh toán một phần', overdue: 'Quá hạn', cancelled: 'Đã hủy' };
export const PAY_LABEL: Record<string, string> = { confirmed: 'Đã xác nhận', pending: 'Chờ xác nhận', rejected: 'Bị từ chối', cancelled: 'Đã hủy' };
export const METHOD_LABEL: Record<string, string> = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Thẻ', ewallet: 'Ví điện tử' };
export const TERM_LABEL: Record<string, string> = { YEAR: 'Đầu năm', HK1: 'Học kỳ 1', HK2: 'Học kỳ 2' };
export const CHANNEL_LABEL: Record<string, string> = { inapp: 'Thông báo trên ứng dụng', sms: 'SMS', zalo: 'Zalo', print: 'In giấy mời', phone: 'Điện thoại', direct: 'Gặp trực tiếp', email: 'Email', other: 'Khác' };
export const NOTE_STATUS_LABEL: Record<string, string> = { done: 'Đã ghi', open: 'Đang chờ', kept: 'Đã giữ lời', broken: 'Lỡ hẹn', cancelled: 'Đã hủy', queued: 'Chờ gửi', sent: 'Đã gửi', read: 'Đã đọc', answered: 'Đã trả lời' };

const D = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function three(n: number, full: boolean): string {
    const t = Math.floor(n / 100), c = Math.floor((n % 100) / 10), u = n % 10; const out: string[] = [];
    if (full || t > 0) out.push(`${D[t]} trăm`);
    if (c > 1) { out.push(`${D[c]} mươi`); if (u === 1) out.push('mốt'); else if (u === 5) out.push('lăm'); else if (u > 0) out.push(D[u]); }
    else if (c === 1) { out.push('mười'); if (u === 5) out.push('lăm'); else if (u > 0) out.push(D[u]); }
    else if (u > 0) { if (t > 0 || full) out.push('lẻ'); out.push(D[u]); }
    return out.join(' ');
}
/** Đọc số tiền thành chữ, ví dụ 2.104.520 → "Hai triệu một trăm lẻ bốn nghìn năm trăm hai mươi đồng". */
export function vndWords(n: number): string {
    n = Math.round(n);
    if (n <= 0) return 'Không đồng';
    const units = ['', ' nghìn', ' triệu', ' tỷ']; const parts: string[] = [];
    let i = 0, rest = n;
    while (rest > 0 && i < units.length) { const g = rest % 1000; if (g) parts.unshift(three(g, rest >= 1000 && g < 100 ? true : false) + units[i]); rest = Math.floor(rest / 1000); i++; }
    const s = parts.join(' ').replace(/\s+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
}