/* Gọi API công khai của trường: /api/public/*
   Máy chủ (trang tải sẵn) và trình duyệt (form) dùng chung địa chỉ này.
   Nếu NEXT_PUBLIC_API_URL có đuôi /v1 (vd http://localhost:8000/api/v1) thì bỏ đuôi đó đi. */
export const API = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api').replace(/\/+$/, '').replace(/\/v\d+$/, '');

export type Overview = { school_year: string | null; classes: number; students: number; teachers: number; subjects: number; grades: { grade: number; classes: number; students: number }[] };
export type NewsItem = {
    id: number; slug: string; kind: string; category: string; title: string; summary: string; tone: string; featured: boolean;
    date: string; event_date: string | null; event_place: string | null; views: number; paragraphs?: string[];
};
export type NewsList = { items: NewsItem[]; total: number; page: number; pages: number; per_page: number; categories: string[] };

/** Đọc dữ liệu ở máy chủ. Lỗi mạng hoặc API chưa chạy thì trả dữ liệu dự phòng để trang vẫn hiển thị. */
export async function load<T>(path: string, fallback: T, seconds = 30): Promise<{ data: T; live: boolean }> {
    try {
        const res = await fetch(`${API}/public/${path}`, { next: { revalidate: seconds }, signal: AbortSignal.timeout(3000), headers: { Accept: 'application/json' } });
        if (!res.ok) return { data: fallback, live: false };
        const json = await res.json();
        return { data: (json.data ?? json) as T, live: true };
    } catch {
        return { data: fallback, live: false };
    }
}

export class FormError extends Error {
    constructor(message: string, public status: number, public errors: Record<string, string> = {}) { super(message); }
}

/** Gửi form từ trình duyệt. */
export async function post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${API}/public/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    } catch {
        throw new FormError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại, hoặc gọi điện cho nhà trường.', 0);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new FormError(json.message || 'Có lỗi xảy ra. Vui lòng thử lại.', res.status, json.errors || {});
    return (json.data ?? json) as T;
}

export const fmtDate = (d: string | null | undefined) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');