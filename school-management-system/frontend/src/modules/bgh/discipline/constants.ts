import type { Rank, Status } from './types';

export const STATUS: Record<Status, { label: string; tone: string }> = {
    pending: { label: 'Chờ duyệt', tone: 'warn' },
    approved: { label: 'Đã duyệt', tone: 'info' },
    resolved: { label: 'Đã xử lý', tone: 'ok' },
    rejected: { label: 'Từ chối', tone: 'mute' },
    cancelled: { label: 'Đã hủy', tone: 'mute' },
};
export const SEVERITY: Record<number, string> = { 1: 'Nhẹ', 2: 'Trung bình', 3: 'Nặng', 4: 'Rất nặng' };
export const GROUPS = ['Nề nếp', 'Học tập', 'Đạo đức', 'An toàn', 'Khác'];
export const ACTIONS = [
    { v: 'nhac_nho', l: 'Nhắc nhở' }, { v: 'phe_binh', l: 'Phê bình trước lớp' }, { v: 'kiem_diem', l: 'Viết bản kiểm điểm' },
    { v: 'lao_dong', l: 'Lao động công ích' }, { v: 'moi_phu_huynh', l: 'Mời phụ huynh làm việc' },
    { v: 'khien_trach', l: 'Khiển trách' }, { v: 'canh_cao', l: 'Cảnh cáo' }, { v: 'dinh_chi', l: 'Đình chỉ học tập' },
];
export const actionLabel = (v?: string | null) => ACTIONS.find((a) => a.v === v)?.l ?? '—';
export const COMMEND_KINDS = [
    { v: 'khen_mieng', l: 'Biểu dương trước lớp' }, { v: 'giay_khen', l: 'Giấy khen' }, { v: 'hoc_tap', l: 'Thành tích học tập' },
    { v: 'hoat_dong', l: 'Hoạt động phong trào' }, { v: 'tieu_bieu', l: 'Học sinh tiêu biểu' },
];
export const commendLabel = (v: string) => COMMEND_KINDS.find((k) => k.v === v)?.l ?? v;
export const RANK_TONE: Record<Rank, string> = { 'Tốt': 'ok', 'Khá': 'info', 'Đạt': 'warn', 'Chưa đạt': 'bad' };
export const SEMESTERS = [{ v: 0, l: 'Cả năm' }, { v: 1, l: 'Học kỳ 1' }, { v: 2, l: 'Học kỳ 2' }];

export const fmtDate = (s?: string | null) => (s ? new Date(s.replace(' ', 'T')).toLocaleDateString('vi-VN') : '—');
export const fmtDateTime = (s?: string | null) =>
    s ? new Date(s.replace(' ', 'T')).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
export const toInputDT = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const initials = (n: string) => n.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();