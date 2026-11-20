export const money = (n: number | string | null | undefined) =>
    (Number(n) || 0).toLocaleString('vi-VN') + ' ₫';

export const moneyShort = (n: number) => {
    const v = Number(n) || 0;
    if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + ' triệu';
    return v.toLocaleString('vi-VN') + ' ₫';
};

export const fmtDate = (d?: string | null) => (d ? new Date(d.replace(' ', 'T')).toLocaleDateString('vi-VN') : '—');
export const fmtDateTime = (d?: string | null) =>
    d ? new Date(d.replace(' ', 'T')).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();

export const STATUS: Record<string, string> = {
    pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy', active: 'Đang áp dụng', revoked: 'Đã thu hồi',
};

export const TERM: Record<string, string> = { HK1: 'Học kỳ 1', HK2: 'Học kỳ 2' };
export const termText = (t?: string | null) => (t || 'HK1,HK2').split(',').map((x) => x.replace('HK', 'HK')).join(' + ');

export const ACTION: Record<string, string> = {
    create: 'Lập đơn', approve: 'Duyệt đơn', reject: 'Từ chối đơn', cancel: 'Hủy đơn', revoke: 'Thu hồi miễn giảm',
    recalc: 'Tính lại hóa đơn', 'type.create': 'Thêm chính sách', 'type.update': 'Sửa chính sách',
};

export const CHART = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#64748b'];