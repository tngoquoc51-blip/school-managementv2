'use client';

import { useEffect, useMemo, useState } from 'react';
import s from '../categories.module.css';
import { departmentApi, subjectApi } from '../catalogApi';
import { Badge, ColorDot } from '../components/ui';
import ResourceManager from '../components/ResourceManager';
import { GRADING_TYPES, SUBJECT_GROUPS, SUBJECT_KINDS, labelOf } from '../constants';
import type { Option, ResourceConfig, Subject } from '../types';

export default function SubjectsTab({ onMutated, refreshToken }: { onMutated: () => void; refreshToken: number }) {
    const [departments, setDepartments] = useState<Option[]>([]);

    useEffect(() => {
        let alive = true;
        departmentApi.list({ per_page: 200, sort: 'name' }).then((p) => {
            if (alive) setDepartments(p.items.map((d) => ({ value: d.id, label: d.name })));
        }).catch(() => undefined);
        return () => { alive = false; };
    }, [refreshToken]);

    const config = useMemo<ResourceConfig<Subject>>(() => ({
        singular: 'môn học',
        api: subjectApi,
        searchPlaceholder: 'Tìm theo mã, tên môn…',
        rowTitle: (r) => r.name,
        defaultSort: { key: 'sort_order', dir: 'asc' },
        defaults: { code: '', name: '', short_name: '', subject_group: 'natural', department_id: '', periods_per_week: 2, coefficient: 1, kind: 'required', grading_type: 'score', applicable_grades: [10, 11, 12], description: '', color: null, sort_order: 0, is_active: true },
        filters: [
            { key: 'subject_group', label: 'Nhóm môn', options: SUBJECT_GROUPS },
            { key: 'department_id', label: 'Tổ', options: departments },
            { key: 'kind', label: 'Tính chất', options: SUBJECT_KINDS },
        ],
        columns: [
            { key: 'name', title: 'Môn học', sortKey: 'name', render: (r) => (
                    <div className={s.cellMain}><ColorDot color={r.color} size={12} /><div><strong>{r.name}</strong><small>{r.code}{r.short_name ? ` · ${r.short_name}` : ''}</small></div></div>
                ) },
            { key: 'group', title: 'Nhóm môn', sortKey: 'subject_group', render: (r) => labelOf(SUBJECT_GROUPS, r.subject_group) },
            { key: 'dept', title: 'Tổ chuyên môn', render: (r) => r.department ? r.department.name : <Badge tone="warning">Chưa gán</Badge> },
            { key: 'periods', title: 'Tiết/tuần', sortKey: 'periods_per_week', align: 'center', render: (r) => r.periods_per_week },
            { key: 'coef', title: 'Hệ số', sortKey: 'coefficient', align: 'center', render: (r) => r.coefficient },
            { key: 'kind', title: 'Tính chất', sortKey: 'kind', render: (r) => <Badge tone={r.kind === 'required' ? 'info' : r.kind === 'elective' ? 'violet' : 'neutral'}>{labelOf(SUBJECT_KINDS, r.kind)}</Badge> },
            { key: 'grading', title: 'Đánh giá', render: (r) => <Badge tone={r.grading_type === 'score' ? 'success' : 'neutral'}>{labelOf(GRADING_TYPES, r.grading_type)}</Badge> },
            { key: 'grades', title: 'Khối', render: (r) => (r.applicable_grades?.length ? r.applicable_grades.join(', ') : '—') },
        ],
        fields: [
            { name: 'code', label: 'Mã môn', type: 'text', required: true, uppercase: true, lockOnEdit: true, placeholder: 'VD: TOAN', hint: 'Chữ HOA, số, gạch dưới. Không đổi được sau khi tạo.' },
            { name: 'name', label: 'Tên môn học', type: 'text', required: true, placeholder: 'VD: Toán' },
            { name: 'short_name', label: 'Tên viết tắt', type: 'text', placeholder: 'VD: Toán' },
            { name: 'subject_group', label: 'Nhóm môn', type: 'select', required: true, options: SUBJECT_GROUPS },
            { name: 'department_id', label: 'Tổ chuyên môn', type: 'select', options: departments, placeholder: '— Chưa gán —' },
            { name: 'kind', label: 'Tính chất', type: 'select', required: true, options: SUBJECT_KINDS },
            { name: 'periods_per_week', label: 'Số tiết / tuần', type: 'number', required: true, min: 0, max: 20, step: 0.5, hint: 'Cho phép 0.5 (môn học xen kẽ tuần).' },
            { name: 'coefficient', label: 'Hệ số môn', type: 'number', required: true, min: 0, max: 5, step: 0.5, hint: 'Dùng khi tính điểm trung bình các môn.' },
            { name: 'grading_type', label: 'Hình thức đánh giá', type: 'select', required: true, options: GRADING_TYPES },
            { name: 'applicable_grades', label: 'Khối áp dụng', type: 'multicheck', span: 2, options: [{ value: 10, label: 'Khối 10' }, { value: 11, label: 'Khối 11' }, { value: 12, label: 'Khối 12' }] },
            { name: 'description', label: 'Mô tả', type: 'textarea', span: 2 },
            { name: 'color', label: 'Màu nhận diện', type: 'color', span: 2 },
            { name: 'sort_order', label: 'Thứ tự hiển thị', type: 'number', min: 0, max: 9999 },
            { name: 'is_active', label: 'Trạng thái', type: 'switch' },
        ],
    }), [departments]);

    return <ResourceManager<Subject> config={config} onMutated={onMutated} refreshToken={refreshToken} />;
}