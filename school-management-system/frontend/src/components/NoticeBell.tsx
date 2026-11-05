'use client';
// Chuông thông báo của Ban Giám hiệu, đặt vào thanh đầu của cổng Học sinh / Phụ huynh / Giáo viên / Nhân viên.
// Dùng:  <NoticeBell audience="student" userKey={maHocSinh} />
//   audience: 'student' | 'parent' (key = mã học sinh của con) | 'teacher' (key = mã giáo viên) | 'staff' (key = tên đăng nhập)
import React, { useCallback, useEffect, useRef, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
type Item = {
    id: number; code: string; title: string; body: string; category_label: string; priority: 'normal' | 'high' | 'urgent'; pinned: number; require_ack: number;
    links: { label: string; url: string }[]; sent_at: string | null; reminded: boolean; read: boolean; acked: boolean;
};
type Props = { audience: 'student' | 'parent' | 'teacher' | 'staff'; userKey: string; refreshSec?: number; className?: string };

const when = (s: string | null) => {
    if (!s) return '';
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z');
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`;
};

export default function NoticeBell({ audience, userKey, refreshSec = 60, className = '' }: Props) {
    const [items, setItems] = useState<Item[]>([]);
    const [open, setOpen] = useState(false);
    const [sel, setSel] = useState<number | null>(null);
    const box = useRef<HTMLDivElement>(null);

    const load = useCallback(() => {
        if (!userKey) return;
        fetch(`${BASE}/public/notices?audience=${audience}&key=${encodeURIComponent(userKey)}`, { headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((j: { data: Item[] }) => setItems(j.data || []))
            .catch(() => { /* im lặng: không làm hỏng cổng */ });
    }, [audience, userKey]);

    useEffect(() => { load(); const t = setInterval(load, refreshSec * 1000); return () => clearInterval(t); }, [load, refreshSec]);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setSel(null); } };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, [open]);

    const mark = (it: Item, ack = false) => {
        fetch(`${BASE}/public/notices/${it.id}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ audience, key: userKey, ack }) })
            .then(() => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, read: true, acked: x.acked || ack } : x)))).catch(() => { /* bỏ qua */ });
    };
    const unread = items.filter((i) => !i.read).length;
    const cur = items.find((i) => i.id === sel) || null;
    const tone = (p: string) => (p === 'urgent' ? '#e11d48' : p === 'high' ? '#d97706' : '#4f46e5');

    return (
        <div ref={box} className={className} style={{ position: 'relative', display: 'inline-block' }}>
            <button type="button" aria-label="Thông báo nhà trường" onClick={() => setOpen(!open)}
                    style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(0,0,0,.08)', background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 004 0" /></svg>
                {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, background: '#e11d48', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>}
            </button>
            {open && (
                <div style={{ position: 'absolute', right: 0, top: 48, width: 'min(380px, calc(100vw - 24px))', maxHeight: '70vh', overflow: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 24px 60px -20px rgba(30,27,75,.5)', border: '1px solid #e4e6f2', zIndex: 9999, fontSize: 14 }}>
                    <div style={{ padding: '14px 16px', fontWeight: 800, borderBottom: '1px solid #eef0f8', display: 'flex', justifyContent: 'space-between' }}>
                        {cur ? <button type="button" onClick={() => setSel(null)} style={{ border: 0, background: 'none', color: '#4338ca', fontWeight: 700, cursor: 'pointer' }}>← Quay lại</button> : <span>Thông báo nhà trường</span>}
                        {!cur && <span style={{ fontWeight: 600, color: '#6b7185', fontSize: 12.5 }}>{unread} chưa đọc</span>}
                    </div>
                    {cur ? (
                        <div style={{ padding: 16 }}>
                            <div style={{ fontSize: 12, color: '#6b7185', marginBottom: 6 }}>{cur.category_label} · {when(cur.sent_at)}</div>
                            <h4 style={{ margin: '0 0 10px', fontSize: 16 }}>{cur.title}</h4>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#3f3d63', wordBreak: 'break-word' }}>{cur.body}</div>
                            {cur.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: 10, color: '#4338ca', fontWeight: 600 }}>🔗 {l.label}</a>)}
                            {cur.require_ack === 1 && (cur.acked
                                ? <p style={{ marginTop: 14, color: '#059669', fontWeight: 700 }}>✓ Bạn đã xác nhận đã đọc</p>
                                : <button type="button" onClick={() => mark(cur, true)} style={{ marginTop: 14, border: 0, borderRadius: 10, background: '#059669', color: '#fff', padding: '9px 16px', fontWeight: 700, cursor: 'pointer' }}>Tôi đã đọc và hiểu</button>)}
                        </div>
                    ) : items.length === 0 ? (
                        <p style={{ padding: 28, textAlign: 'center', color: '#6b7185' }}>Chưa có thông báo nào.</p>
                    ) : items.map((it) => (
                        <button key={it.id} type="button" onClick={() => { setSel(it.id); if (!it.read) mark(it); }}
                                style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #f1f2fa', background: it.read ? '#fff' : '#f7f8ff', padding: '12px 16px', cursor: 'pointer', borderLeft: `4px solid ${tone(it.priority)}` }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: it.read ? 600 : 800, color: '#1e1b4b' }}>
                                {it.pinned ? '📌' : ''}{it.priority === 'urgent' ? '⚡' : ''}<span style={{ flex: 1 }}>{it.title}</span>
                                {it.reminded && !it.read && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 6, padding: '1px 6px' }}>Nhắc lại</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7185', marginTop: 3 }}>{it.category_label} · {when(it.sent_at)}{it.require_ack === 1 && !it.acked ? ' · cần xác nhận' : ''}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}