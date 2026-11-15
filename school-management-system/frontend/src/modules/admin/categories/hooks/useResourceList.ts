import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../catalogApi';
import type { ListParams, Meta, ResourceApi } from '../types';

const EMPTY_META: Meta = { current_page: 1, last_page: 1, per_page: 15, total: 0, from: null, to: null };

/** Tải danh sách có phân trang; bỏ qua phản hồi cũ nếu người dùng đã đổi bộ lọc (tránh nhấp nháy dữ liệu sai). */
export function useResourceList<T>(api: ResourceApi<T>, params: ListParams, refreshToken = 0) {
    const [items, setItems] = useState<T[]>([]);
    const [meta, setMeta] = useState<Meta>(EMPTY_META);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);
    const key = JSON.stringify(params);

    const load = useCallback(async () => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);
        try {
            const page = await api.list(JSON.parse(key) as ListParams);
            if (id !== requestId.current) return;
            setItems(page.items);
            setMeta(page.meta);
        } catch (e) {
            if (id !== requestId.current) return;
            setError(getErrorMessage(e));
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, [api, key]);

    useEffect(() => {
        load();
    }, [load, refreshToken]);

    return { items, meta, loading, error, reload: load, setItems };
}