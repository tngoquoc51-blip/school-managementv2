import type { EventFilters, Level, Range } from './types';

export const LEVELS: { key: Level; label: string; no: number }[] = [
    { key: 'debug', label: 'Debug', no: 10 },
    { key: 'info', label: 'Thông tin', no: 20 },
    { key: 'notice', label: 'Lưu ý', no: 30 },
    { key: 'warning', label: 'Cảnh báo', no: 40 },
    { key: 'error', label: 'Lỗi', no: 50 },
    { key: 'critical', label: 'Nghiêm trọng', no: 60 },
];
export const LEVEL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.key, l.label])) as Record<Level, string>;

export const CATEGORY_LABEL: Record<string, string> = {
    auth: 'Đăng nhập', security: 'Bảo mật', data: 'Dữ liệu', finance: 'Tài chính', academic: 'Học vụ',
    student: 'Học sinh', admin: 'Quản trị', system: 'Hệ thống', api: 'API',
};

export const RANGES: { key: Range; label: string }[] = [
    { key: '1h', label: '1 giờ qua' }, { key: '24h', label: '24 giờ qua' }, { key: '7d', label: '7 ngày qua' },
    { key: '30d', label: '30 ngày qua' }, { key: '90d', label: '90 ngày qua' }, { key: 'all', label: 'Tất cả' },
];

const ACTION_LABEL: Record<string, string> = {
    'auth.login': 'Đăng nhập', 'auth.login_failed': 'Đăng nhập thất bại', 'auth.login_throttled': 'Đăng nhập bị chặn tốc độ', 'auth.logout': 'Đăng xuất',
    'security.access_denied': 'Truy cập bị từ chối', 'security.rate_limited': 'Vượt giới hạn tốc độ', 'security.account_unlocked': 'Mở khóa tài khoản', 'security.log_export': 'Xuất nhật ký',
    'api.server_error': 'Lỗi máy chủ', 'data.update': 'Cập nhật dữ liệu', 'data.create': 'Tạo dữ liệu', 'data.delete': 'Xóa dữ liệu',
    'payment.collect': 'Thu tiền', 'payment.void': 'Hủy phiếu thu', 'payment.reject': 'Từ chối thanh toán', 'payment.confirm': 'Xác nhận thanh toán',
    'student.view_grades': 'Xem bảng điểm', 'admin.role_changed': 'Đổi quyền vai trò', 'admin.log_purged': 'Dọn dẹp nhật ký', 'admin.log_retention_changed': 'Đổi chính sách lưu giữ',
    'system.incident_opened': 'Mở sự cố', 'system.incident_acknowledged': 'Xác nhận sự cố', 'system.incident_resolved': 'Đóng sự cố', 'system.test_event': 'Sự kiện thử',
    'system.db_connection_lost': 'Mất kết nối CSDL', 'system.module_installed': 'Cài đặt module', export_students: 'Xuất danh sách học sinh',
};
export function actionLabel(a: string): string {
    return ACTION_LABEL[a] ?? a;
}

export const DEFAULT_FILTERS: EventFilters = {
    range: '24h', from: '', to: '', level: [], category: [], action: '', actor: '', ip: '', status: '', source: '', q: '',
    pinned: false, request_id: '', subject_type: '', subject_id: '', sort: 'occurred_at', dir: 'desc', page: 1, per_page: 25,
};

/** Số bộ lọc đang bật (không tính phân trang/sắp xếp/khoảng thời gian mặc định). */
export function activeFilterCount(f: EventFilters): number {
    return [f.level.length > 0, f.category.length > 0, !!f.action, !!f.actor, !!f.ip, !!f.status, !!f.source, !!f.q, f.pinned, !!f.request_id, !!f.subject_type, !!f.from || !!f.to].filter(Boolean).length;
}

/* ------------------------------ định dạng ------------------------------ */

const TZ = 'Asia/Ho_Chi_Minh';

/** Lấy từng phần ngày/giờ theo múi giờ Việt Nam — không phụ thuộc ngôn ngữ trình duyệt nên kết quả luôn giống nhau. */
function dateParts(d: Date, opts: Intl.DateTimeFormatOptions) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', ...opts }).formatToParts(d);
    return (t: string) => p.find((x) => x.type === t)?.value ?? '';
}

export function fmtTime(iso: string | null | undefined, withSeconds = true): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const g = dateParts(d, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return withSeconds ? `${g('hour')}:${g('minute')}:${g('second')}` : `${g('hour')}:${g('minute')}`;
}

export function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const g = dateParts(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${g('day')}/${g('month')}/${g('year')}`;
}

export function fmtFull(iso: string | null | undefined): string {
    return iso ? `${fmtTime(iso)} · ${fmtDate(iso)}` : '—';
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
    if (!iso) return '—';
    const diff = Math.max(0, now - new Date(iso).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 10) return 'Vừa xong';
    if (s < 60) return `${s} giây trước`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d} ngày trước` : fmtDate(iso);
}

export const fmtNum = (n: number): string => new Intl.NumberFormat('vi-VN').format(n);

export function fmtBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
    return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export function fmtMs(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return '—';
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

export function fmtValue(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string') return v === '' ? '""' : v;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

/** Nhãn người thực hiện: tên nếu có, nếu không thì "Loại #id". */
export function actorLabel(a: { type: string | null; id: number | null; name: string | null }): string {
    if (a.name) return a.name;
    if (a.id !== null) return `${ACTOR_TYPE[a.type ?? ''] ?? 'Người dùng'} #${a.id}`;
    return a.type === 'system' ? 'Hệ thống' : 'Không xác định';
}

export const ACTOR_TYPE: Record<string, string> = { admin: 'Quản trị', staff: 'Cán bộ', student: 'Học sinh', system: 'Hệ thống', guest: 'Khách' };

export function relativeBucketLabel(iso: string, range: '24h' | '7d' | '30d'): string {
    const d = new Date(iso);
    const g = dateParts(d, { day: '2-digit', month: '2-digit', hour: '2-digit' });
    if (range === '30d') return `${g('day')}/${g('month')}`;
    if (range === '7d') return `${g('day')}/${g('month')} ${g('hour')}h`;
    return `${g('hour')}h`;
}

export function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    return Promise.resolve(false);
}

/** Mô tả ngắn một bộ lọc đã lưu. */
export function describeFilters(f: Partial<EventFilters>): string {
    const p: string[] = [];
    if (f.level?.length) p.push(f.level.map((l) => LEVEL_LABEL[l] ?? l).join(', '));
    if (f.category?.length) p.push(f.category.map((c) => CATEGORY_LABEL[c] ?? c).join(', '));
    if (f.q) p.push(`“${f.q}”`);
    if (f.ip) p.push(`IP ${f.ip}`);
    if (f.action) p.push(f.action);
    if (f.range) p.push(RANGES.find((r) => r.key === f.range)?.label ?? f.range);
    return p.join(' · ') || 'Không có điều kiện';
}