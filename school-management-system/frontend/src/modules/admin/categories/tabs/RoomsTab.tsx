'use client';

import s from '../categories.module.css';
import { roomApi } from '../catalogApi';
import { Badge } from '../components/ui';
import ResourceManager from '../components/ResourceManager';
import { ROOM_STATUSES, ROOM_TYPES, labelOf } from '../constants';
import type { ResourceConfig, Room } from '../types';

const statusTone = { available: 'success', maintenance: 'warning', unavailable: 'danger' } as const;

const config: ResourceConfig<Room> = {
    singular: 'phòng học',
    api: roomApi,
    searchPlaceholder: 'Tìm theo mã, tên phòng, tòa nhà…',
    rowTitle: (r) => r.name,
    defaultSort: { key: 'sort_order', dir: 'asc' },
    defaults: { code: '', name: '', room_type: 'classroom', building: '', floor: 1, capacity: 45, facilities: '', status: 'available', sort_order: 0, is_active: true },
    filters: [
        { key: 'room_type', label: 'Loại phòng', options: ROOM_TYPES },
        { key: 'room_status', label: 'Tình trạng', options: ROOM_STATUSES },
    ],
    columns: [
        { key: 'name', title: 'Phòng', sortKey: 'name', render: (r) => (
                <div className={s.cellMain}><div><strong>{r.name}</strong><small>{r.code}</small></div></div>
            ) },
        { key: 'type', title: 'Loại phòng', sortKey: 'room_type', render: (r) => labelOf(ROOM_TYPES, r.room_type) },
        { key: 'place', title: 'Vị trí', sortKey: 'building', render: (r) => `${r.building || '—'} · Tầng ${r.floor}` },
        { key: 'cap', title: 'Sức chứa', sortKey: 'capacity', align: 'center', render: (r) => r.capacity > 0 ? `${r.capacity} chỗ` : <Badge tone="warning">Chưa khai báo</Badge> },
        { key: 'status', title: 'Tình trạng', sortKey: 'status', render: (r) => <Badge tone={statusTone[r.status as keyof typeof statusTone] ?? 'neutral'} dot>{labelOf(ROOM_STATUSES, r.status)}</Badge> },
        { key: 'fac', title: 'Trang thiết bị', render: (r) => <span className={s.muted}>{r.facilities || '—'}</span> },
    ],
    fields: [
        { name: 'code', label: 'Mã phòng', type: 'text', required: true, uppercase: true, lockOnEdit: true, placeholder: 'VD: P101' },
        { name: 'name', label: 'Tên phòng', type: 'text', required: true, placeholder: 'VD: Phòng 101' },
        { name: 'room_type', label: 'Loại phòng', type: 'select', required: true, options: ROOM_TYPES },
        { name: 'status', label: 'Tình trạng', type: 'select', required: true, options: ROOM_STATUSES },
        { name: 'building', label: 'Tòa nhà / khu', type: 'text', placeholder: 'VD: Nhà A' },
        { name: 'floor', label: 'Tầng', type: 'number', required: true, min: -2, max: 30 },
        { name: 'capacity', label: 'Sức chứa (chỗ)', type: 'number', required: true, min: 0, max: 2000 },
        { name: 'sort_order', label: 'Thứ tự hiển thị', type: 'number', min: 0, max: 9999 },
        { name: 'facilities', label: 'Trang thiết bị', type: 'textarea', span: 2, placeholder: 'Máy chiếu, điều hòa, bảng từ…' },
        { name: 'is_active', label: 'Trạng thái sử dụng', type: 'switch' },
    ],
};

export default function RoomsTab({ onMutated, refreshToken }: { onMutated: () => void; refreshToken: number }) {
    return <ResourceManager<Room> config={config} onMutated={onMutated} refreshToken={refreshToken} />;
}