'use client';

import s from '../categories.module.css';
import { departmentApi } from '../catalogApi';
import { Badge } from '../components/ui';
import ResourceManager from '../components/ResourceManager';
import type { Department, ResourceConfig } from '../types';

const config: ResourceConfig<Department> = {
    singular: 'tổ chuyên môn',
    api: departmentApi,
    searchPlaceholder: 'Tìm theo mã, tên tổ, tổ trưởng…',
    rowTitle: (r) => r.name,
    defaultSort: { key: 'sort_order', dir: 'asc' },
    defaults: { code: '', name: '', description: '', head_name: '', phone: '', email: '', sort_order: 0, is_active: true },
    deleteNote: (r) => (r.subjects_count ? `Tổ đang có ${r.subjects_count} môn học nên hệ thống sẽ từ chối xóa.` : null),
    columns: [
        { key: 'name', title: 'Tổ chuyên môn', sortKey: 'name', render: (r) => (
                <div className={s.cellMain}><div><strong>{r.name}</strong><small>{r.code}</small></div></div>
            ) },
        { key: 'head', title: 'Tổ trưởng', render: (r) => r.head_name ? (
                <div className={s.cellMain}><div><strong>{r.head_name}</strong><small>{[r.phone, r.email].filter(Boolean).join(' · ') || '—'}</small></div></div>
            ) : <Badge tone="neutral">Chưa có</Badge> },
        { key: 'subjects', title: 'Số môn', sortKey: 'subjects_count', align: 'center', render: (r) => <Badge tone={r.subjects_count ? 'info' : 'warning'}>{r.subjects_count ?? 0}</Badge> },
        { key: 'desc', title: 'Mô tả', render: (r) => <span className={s.muted}>{r.description || '—'}</span> },
    ],
    fields: [
        { name: 'code', label: 'Mã tổ', type: 'text', required: true, uppercase: true, lockOnEdit: true, placeholder: 'VD: TOAN_TIN' },
        { name: 'name', label: 'Tên tổ', type: 'text', required: true, placeholder: 'VD: Tổ Toán – Tin học' },
        { name: 'head_name', label: 'Tổ trưởng', type: 'text', placeholder: 'Họ và tên' },
        { name: 'phone', label: 'Điện thoại', type: 'text', placeholder: '09xx xxx xxx' },
        { name: 'email', label: 'Email', type: 'text', span: 2, placeholder: 'to.truong@truong.edu.vn' },
        { name: 'description', label: 'Mô tả / môn phụ trách', type: 'textarea', span: 2 },
        { name: 'sort_order', label: 'Thứ tự hiển thị', type: 'number', min: 0, max: 9999 },
        { name: 'is_active', label: 'Trạng thái', type: 'switch' },
    ],
};

export default function DepartmentsTab({ onMutated, refreshToken }: { onMutated: () => void; refreshToken: number }) {
    return <ResourceManager<Department> config={config} onMutated={onMutated} refreshToken={refreshToken} />;
}