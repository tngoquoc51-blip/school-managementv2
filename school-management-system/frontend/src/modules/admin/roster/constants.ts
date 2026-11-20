export const GRADES = [10, 11, 12];
export const GENDERS = ['Nam', 'Nữ'] as const;

export const ACCOUNT_LABEL: Record<string, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' }> = {
    active: { label: 'Đang hoạt động', tone: 'success' },
    locked: { label: 'Bị khóa', tone: 'danger' },
    inactive: { label: 'Ngừng sử dụng', tone: 'neutral' },
    pending: { label: 'Chờ duyệt', tone: 'warning' },
};

export const SIZE_LABEL: Record<string, { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }> = {
    ok: { label: 'Đủ sĩ số', tone: 'success' },
    over: { label: 'Quá sĩ số', tone: 'danger' },
    under: { label: 'Thiếu sĩ số', tone: 'warning' },
    empty: { label: 'Chưa có học sinh', tone: 'neutral' },
};

export const CONDUCT_TONE: Record<string, 'success' | 'info' | 'warning' | 'danger'> = { Tốt: 'success', Khá: 'info', 'Đạt': 'warning', 'Chưa đạt': 'danger' };

export const PROFILE_FIELDS: { key: string; label: string; group: 'basic' | 'family' | 'health' }[] = [
    { key: 'ethnicity', label: 'Dân tộc', group: 'basic' },
    { key: 'religion', label: 'Tôn giáo', group: 'basic' },
    { key: 'birth_place', label: 'Nơi sinh', group: 'basic' },
    { key: 'hometown', label: 'Quê quán', group: 'basic' },
    { key: 'father_name', label: 'Họ tên cha', group: 'family' },
    { key: 'father_job', label: 'Nghề nghiệp cha', group: 'family' },
    { key: 'mother_name', label: 'Họ tên mẹ', group: 'family' },
    { key: 'mother_job', label: 'Nghề nghiệp mẹ', group: 'family' },
    { key: 'guardian_name', label: 'Người giám hộ', group: 'family' },
    { key: 'guardian_relation', label: 'Quan hệ', group: 'family' },
    { key: 'blood_type', label: 'Nhóm máu', group: 'health' },
    { key: 'height_cm', label: 'Chiều cao (cm)', group: 'health' },
    { key: 'weight_kg', label: 'Cân nặng (kg)', group: 'health' },
];

export const PII_FIELDS: { key: string; label: string; wide?: boolean }[] = [
    { key: 'phone', label: 'Điện thoại học sinh' },
    { key: 'father_phone', label: 'Điện thoại cha' },
    { key: 'mother_phone', label: 'Điện thoại mẹ' },
    { key: 'guardian_phone', label: 'Điện thoại người giám hộ' },
    { key: 'emergency_phone', label: 'Điện thoại khẩn cấp' },
    { key: 'permanent_address', label: 'Hộ khẩu thường trú', wide: true },
    { key: 'current_address', label: 'Nơi ở hiện nay', wide: true },
    { key: 'health_note', label: 'Ghi chú sức khỏe', wide: true },
];

export const fmtDate = (v: string | null | undefined) => {
    if (!v) return '—';
    const [y, m, d] = v.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
};
export const money = (n: number) => n.toLocaleString('vi-VN') + ' ₫';
export const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((p) => p[0]).join('').toUpperCase();