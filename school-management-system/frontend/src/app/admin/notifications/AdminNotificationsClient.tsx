'use client';

import { useCallback, useEffect, useState } from 'react';

type Noti = {
    id: number;
    title?: string;
    body?: string;
    message?: string;
    type?: string;
    read_at?: string | null;
    created_at?: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

function token() {
    if (typeof window === 'undefined') return '';
    return (
        localStorage.getItem('token') ||
        localStorage.getItem('admin_token') ||
        localStorage.getItem('staff_token') ||
        ''
    );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token()}`,
            ...(init?.headers || {}),
        },
    });
    if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
    }
    return res.json();
}

function fmt(s?: string) {
    if (!s) return '';
    try {
        return new Date(s).toLocaleString('vi-VN');
    } catch {
        return s;
    }
}

export function AdminNotificationsClient() {
    const [items, setItems] = useState<Noti[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        const paths = [
            '/v1/admin/profile/notifications',
            '/admin/profile/notifications',
        ];
        let list: Noti[] = [];
        let last = '';
        for (const p of paths) {
            try {
                const data: any = await api(p);
                list = Array.isArray(data) ? data : data.data || data.items || data.notifications || [];
                last = '';
                break;
            } catch (e: any) {
                last = e?.message || String(e);
            }
        }
        if (last && !list.length) setErr(last);
        setItems(list);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const unread = items.filter((n) => !n.read_at).length;
    const shown = filter === 'unread' ? items.filter((n) => !n.read_at) : items;

    const markRead = async (id: number) => {
        setBusy(true);
        try {
            for (const p of [
                `/v1/admin/profile/notifications/${id}/read`,
                `/admin/profile/notifications/${id}/read`,
            ]) {
                try {
                    await api(p, { method: 'POST' });
                    break;
                } catch {
                    /* thử path khác */
                }
            }
            setItems((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
            );
        } catch (e: any) {
            setErr(e?.message || 'Không đánh dấu được');
        }
        setBusy(false);
    };

    const markAll = async () => {
        setBusy(true);
        try {
            for (const p of [
                '/v1/admin/profile/notifications/read-all',
                '/admin/profile/notifications/read-all',
            ]) {
                try {
                    await api(p, { method: 'POST' });
                    break;
                } catch {
                    /* */
                }
            }
            setItems((prev) =>
                prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })),
            );
        } catch (e: any) {
            setErr(e?.message || 'Không đọc tất cả được');
        }
        setBusy(false);
    };

    return (
        <div style={{ padding: 24, maxWidth: 900 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Thông báo</h1>
                    <p style={{ color: '#64748b', margin: '6px 0 0' }}>
                        Hộp thư quản trị{unread ? ` · ${unread} chưa đọc` : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={load} disabled={loading || busy} style={btn}>
                        Làm mới
                    </button>
                    <button
                        type="button"
                        onClick={markAll}
                        disabled={busy || unread === 0}
                        style={{ ...btn, background: '#0f766e', color: '#fff', borderColor: '#0f766e' }}
                    >
                        Đọc tất cả
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={() => setFilter('all')}
                    style={{
                        ...btn,
                        background: filter === 'all' ? '#1e293b' : '#fff',
                        color: filter === 'all' ? '#fff' : '#334155',
                    }}
                >
                    Tất cả ({items.length})
                </button>
                <button
                    type="button"
                    onClick={() => setFilter('unread')}
                    style={{
                        ...btn,
                        background: filter === 'unread' ? '#1e293b' : '#fff',
                        color: filter === 'unread' ? '#fff' : '#334155',
                    }}
                >
                    Chưa đọc ({unread})
                </button>
            </div>

            {err && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', marginBottom: 16, fontSize: 14 }}>
                    {err}
                </div>
            )}

            {loading ? (
                <p style={{ color: '#64748b' }}>Đang tải…</p>
            ) : shown.length === 0 ? (
                <p style={{ color: '#94a3b8' }}>Không có thông báo.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {shown.map((n) => {
                        const unreadItem = !n.read_at;
                        return (
                            <div
                                key={n.id}
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    padding: '14px 16px',
                                    background: unreadItem ? '#f0f9ff' : '#fff',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <strong>{n.title || n.type || 'Thông báo'}</strong>
                                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmt(n.created_at)}</span>
                                </div>
                                {(n.body || n.message) && (
                                    <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14 }}>
                                        {n.body || n.message}
                                    </p>
                                )}
                                {unreadItem && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => markRead(n.id)}
                                        style={{ ...btn, marginTop: 10, padding: '4px 10px', fontSize: 12 }}
                                    >
                                        Đánh dấu đã đọc
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const btn: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
};