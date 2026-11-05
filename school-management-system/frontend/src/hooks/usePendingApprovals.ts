'use client';

import { useCallback, useEffect, useState } from 'react';
import { approvalApi } from '@/modules/bgh/services/approvalService';

/**
 * Số yêu cầu đang chờ duyệt (dùng cho huy hiệu trên menu BGH).
 * Tự cập nhật mỗi 60 giây, và ngay khi trang Phê duyệt phát sự kiện 'approvals:changed'.
 * Trả về null khi chưa tải xong hoặc chưa gọi được API.
 */
export function usePendingApprovals(intervalMs = 60000): number | null {
    const [count, setCount] = useState<number | null>(null);

    const load = useCallback(async () => {
        try {
            const s = await approvalApi.stats();
            setCount(Object.values(s.pending).reduce((a, b) => a + b, 0));
        } catch {
            /* giữ giá trị cũ, không làm hỏng menu */
        }
    }, []);

    useEffect(() => {
        load();
        const timer = setInterval(load, intervalMs);
        window.addEventListener('approvals:changed', load);
        return () => { clearInterval(timer); window.removeEventListener('approvals:changed', load); };
    }, [load, intervalMs]);

    return count;
}