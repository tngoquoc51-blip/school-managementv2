export const TONES: Record<string, string> = {
    blue: '#2563eb', violet: '#7c3aed', sky: '#0284c7', amber: '#d97706', emerald: '#059669', green: '#16a34a', rose: '#e11d48',
    orange: '#ea580c', slate: '#475569', cyan: '#0891b2', indigo: '#4f46e5', lime: '#65a30d', teal: '#0d9488', pink: '#db2777',
};
export const TONE_NAMES = Object.keys(TONES);
export const tone = (name?: string) => TONES[name ?? ''] ?? TONES.indigo;
export const tcls = (name?: string) => `t-${TONES[name ?? ''] ? name : 'indigo'}`;

export const KIND_LABEL = { score: 'Tính điểm', pass: 'Đánh giá Đạt/Chưa đạt' } as const;
export const CAT_LABEL = { required: 'Bắt buộc', elective: 'Tự chọn', topic: 'Chuyên đề' } as const;
export const STATUS_LABEL = { active: 'Đang dạy', inactive: 'Ngừng sử dụng' } as const;
export const fmtDate = (s?: string | null) => {
    if (!s) return '—';
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(+d) ? s : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};
export const initials = (name: string) => name.split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
export const shortName = (name: string) => { const p = name.split(' ').filter(Boolean); return p.length > 2 ? `${p[0][0]}. ${p.slice(-2).join(' ')}` : name; };