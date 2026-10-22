'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export interface CurrentStudent {
    id: number;
    code: string;
    full_name: string;
    class_name: string;
    class_id?: number;
    academic_year?: string;
    semester?: number;
}

/** Token của hệ thống học sinh mới (hs_token); nếu chưa có thì dùng token cũ. */
export function getStudentToken(): string | null {
    if (typeof window === 'undefined') return null;
    return (
        localStorage.getItem('hs_token') ??
        sessionStorage.getItem('hs_token') ??
        localStorage.getItem('token')
    );
}

export function useCurrentStudent() {
    const [student, setStudent] = useState<CurrentStudent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = getStudentToken();
        const raw = localStorage.getItem('user');

        if (!token || !raw) {
            setLoading(false);
            setError('Chưa đăng nhập');
            return;
        }

        // Hiện ngay tên + lớp đã lưu lúc đăng nhập
        let fallback: CurrentStudent = { id: 0, code: '', full_name: 'Học sinh', class_name: '' };
        try {
            const u = JSON.parse(raw);
            fallback = {
                id: Number(u.id) || 0,
                code: u.student_code || u.code || '',
                full_name: u.full_name || u.name || 'Học sinh',
                class_name: u.class_name || u.class || '',
            };
        } catch {
            /* ignore */
        }
        setStudent(fallback);

        // Lấy hồ sơ thật từ API học sinh mới
        fetch(`${API}/hs/me`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
            .then(async (r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            })
            .then((j) => {
                const d = j?.data;
                if (!d) return;
                const profile: CurrentStudent = {
                    id: d.id,
                    code: d.code || '',
                    full_name: d.name || fallback.full_name,
                    class_name: d.class?.name || fallback.class_name,
                    class_id: d.class?.id,
                    academic_year: d.year?.label,
                    semester: 1,
                };
                setStudent(profile);
                // Giữ cả tên cũ (name, class) cho các trang con đang đọc student_profile
                localStorage.setItem(
                    'student_profile',
                    JSON.stringify({
                        ...profile,
                        name: profile.full_name,
                        class: profile.class_name,
                    }),
                );
            })
            .catch(() => {
                setError('Không lấy được hồ sơ học sinh từ API');
            })
            .finally(() => setLoading(false));
    }, []);

    return { student, loading, error };
}