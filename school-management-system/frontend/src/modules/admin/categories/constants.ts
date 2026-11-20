import type { Option, TabId } from './types';

export const SUBJECT_GROUPS: Option[] = [
    { value: 'natural', label: 'Khoa học tự nhiên' },
    { value: 'social', label: 'Khoa học xã hội' },
    { value: 'language', label: 'Ngôn ngữ' },
    { value: 'math_tech', label: 'Toán – Công nghệ – Tin' },
    { value: 'art', label: 'Nghệ thuật' },
    { value: 'skill', label: 'Giáo dục – Trải nghiệm' },
    { value: 'other', label: 'Khác' },
];

export const SUBJECT_KINDS: Option[] = [
    { value: 'required', label: 'Bắt buộc' },
    { value: 'elective', label: 'Lựa chọn' },
    { value: 'specialized', label: 'Chuyên đề' },
];

export const GRADING_TYPES: Option[] = [
    { value: 'score', label: 'Tính điểm' },
    { value: 'comment', label: 'Nhận xét' },
];

export const ROOM_TYPES: Option[] = [
    { value: 'classroom', label: 'Phòng học' },
    { value: 'lab_physics', label: 'PTN Vật lí' },
    { value: 'lab_chemistry', label: 'PTN Hóa học' },
    { value: 'lab_biology', label: 'PTN Sinh học' },
    { value: 'computer', label: 'Phòng Tin học' },
    { value: 'music', label: 'Phòng Âm nhạc' },
    { value: 'art', label: 'Phòng Mĩ thuật' },
    { value: 'library', label: 'Thư viện' },
    { value: 'hall', label: 'Hội trường' },
    { value: 'gym', label: 'Nhà thể chất' },
    { value: 'other', label: 'Khác' },
];

export const ROOM_STATUSES: Option[] = [
    { value: 'available', label: 'Sẵn sàng' },
    { value: 'maintenance', label: 'Đang bảo trì' },
    { value: 'unavailable', label: 'Ngừng sử dụng' },
];

export const STATUS_FILTER: Option[] = [
    { value: 'active', label: 'Đang dùng' },
    { value: 'inactive', label: 'Ngừng dùng' },
];

export const ENTITY_LABELS: Record<string, string> = {
    group: 'Nhóm danh mục',
    item: 'Mục danh mục',
    subject: 'Môn học',
    department: 'Tổ chuyên môn',
    room: 'Phòng học',
    user: 'Người dùng',
    student: 'Học sinh',
    class: 'Lớp học',
    role: 'Chức năng',
};

export const ACTION_LABELS: Record<string, { label: string; tone: 'success' | 'info' | 'danger' | 'violet' | 'warning' }> = {
    create: { label: 'Thêm mới', tone: 'success' },
    update: { label: 'Chỉnh sửa', tone: 'info' },
    delete: { label: 'Xóa', tone: 'danger' },
    restore: { label: 'Khôi phục', tone: 'violet' },
    import: { label: 'Nhập dữ liệu', tone: 'warning' },
    lock: { label: 'Khóa tài khoản', tone: 'danger' },
    unlock: { label: 'Mở khóa', tone: 'success' },
    deactivate: { label: 'Ngừng sử dụng', tone: 'warning' },
    reset_password: { label: 'Đặt lại mật khẩu', tone: 'violet' },
    roles: { label: 'Đổi chức năng', tone: 'info' },
    permissions: { label: 'Đổi quyền', tone: 'info' },
    enroll: { label: 'Xếp lớp', tone: 'success' },
    transfer: { label: 'Chuyển lớp', tone: 'violet' },
    unenroll: { label: 'Gỡ khỏi lớp', tone: 'warning' },
    auto_assign: { label: 'Xếp lớp tự động', tone: 'info' },
    view_pii: { label: 'Xem dữ liệu nhạy cảm', tone: 'warning' },
    remove: { label: 'Xóa vĩnh viễn', tone: 'danger' },
};

export const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Quản trị tối cao', principal: 'Hiệu trưởng', vice_principal: 'Phó hiệu trưởng', teacher: 'Giáo viên bộ môn',
    homeroom_teacher: 'Giáo viên chủ nhiệm', department_head: 'Tổ trưởng chuyên môn', academic: 'Giáo vụ / Đào tạo', giao_vu: 'Giáo vụ',
    accountant: 'Kế toán', librarian: 'Thư viện', medical: 'Y tế học đường', supervisor: 'Giám thị', student: 'Học sinh',
    parent: 'Phụ huynh', staff: 'Nhân viên',
};

export const ACCOUNT_TYPES: Option[] = [
    { value: 'web', label: 'Tài khoản hệ thống' },
    { value: 'staff', label: 'Nhân sự' },
    { value: 'student', label: 'Học sinh' },
];

export const ACCOUNT_STATUSES: Option[] = [
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'locked', label: 'Bị khóa' },
    { value: 'inactive', label: 'Ngừng sử dụng' },
];

export const FIELD_LABELS: Record<string, string> = {
    code: 'Mã', name: 'Tên', short_name: 'Viết tắt', description: 'Mô tả', value: 'Giá trị', color: 'Màu', sort_order: 'Thứ tự',
    is_active: 'Hoạt động', is_system: 'Hệ thống', subject_group: 'Nhóm môn', department_id: 'Tổ chuyên môn',
    periods_per_week: 'Số tiết/tuần', coefficient: 'Hệ số', kind: 'Tính chất', grading_type: 'Đánh giá',
    applicable_grades: 'Khối áp dụng', room_type: 'Loại phòng', building: 'Tòa nhà', floor: 'Tầng', capacity: 'Sức chứa',
    facilities: 'Thiết bị', status: 'Tình trạng', head_name: 'Tổ trưởng', phone: 'Điện thoại', email: 'Email', icon: 'Biểu tượng',
    group_id: 'Nhóm', id: 'ID',
};

export const TABS: { id: TabId; label: string; icon: string; hint: string }[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'dashboard', hint: 'Số liệu & cảnh báo' },
    { id: 'users', label: 'Người dùng', icon: 'users', hint: 'Toàn bộ tài khoản: khóa, mở khóa, đặt lại mật khẩu, đổi chức năng' },
    { id: 'roles', label: 'Chức năng & phân quyền', icon: 'shield', hint: 'Mỗi chức năng có bao nhiêu người dùng và được phép làm gì' },
    { id: 'subjects', label: 'Môn học', icon: 'book', hint: 'Chương trình, số tiết, hệ số' },
    { id: 'departments', label: 'Tổ chuyên môn', icon: 'users', hint: 'Tổ, tổ trưởng, môn phụ trách' },
    { id: 'rooms', label: 'Phòng học', icon: 'building', hint: 'Phòng học, PTN, sức chứa' },
    { id: 'lookups', label: 'Danh mục dùng chung', icon: 'layers', hint: 'Dân tộc, tôn giáo, lý do vắng…' },
    { id: 'audit', label: 'Nhật ký thay đổi', icon: 'history', hint: 'Ai sửa gì, khôi phục dữ liệu' },
];

export const GROUP_ICON_KEYS = [
    'layers', 'users', 'clipboard', 'award', 'shield', 'calendar', 'star', 'alert', 'wallet', 'heart',
    'clock', 'globe', 'briefcase', 'book', 'sun', 'flag',
];

export const PALETTE = ['#0b6aa2', '#1b9fde', '#14b8a6', '#10b981', '#eab308', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];

export function labelOf(options: Option[], value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    return options.find((o) => String(o.value) === String(value))?.label ?? String(value);
}

export const GROUP_ICON_LABELS: Record<string, string> = {
    layers: 'Lớp xếp tầng', users: 'Con người', clipboard: 'Bảng ghi', award: 'Giải thưởng', shield: 'Khiên', calendar: 'Lịch',
    star: 'Ngôi sao', alert: 'Cảnh báo', wallet: 'Ví tiền', heart: 'Trái tim', clock: 'Đồng hồ', globe: 'Quả địa cầu',
    briefcase: 'Cặp tài liệu', book: 'Sách', sun: 'Mặt trời', flag: 'Lá cờ',
};