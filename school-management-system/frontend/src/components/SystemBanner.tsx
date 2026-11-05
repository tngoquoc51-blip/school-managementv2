'use client';
// Banner thông báo hệ thống – gắn MỘT LẦN trong app/layout.tsx là hiện ở mọi cổng.
// Tự chọn đối tượng theo đường dẫn: /student* → học sinh; /academic, /admin, /teacher, /accountant, /bgh → nhân viên; còn lại → mọi người.
// Nổi phía trên cùng (position: fixed) nên không làm lệch bố cục các cổng.
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';
type Ann = { id: number; title: string; body: string | null; level: 'info' | 'success' | 'warning' | 'critical' };
const STYLE: Record<string, { bg: string; fg: string; bd: string; ic: string }> = {
    info: { bg: '#eff6ff', fg: '#1e3a8a', bd: '#bfdbfe', ic: 'i' }, success: { bg: '#ecfdf5', fg: '#065f46', bd: '#a7f3d0', ic: '✓' },
    warning: { bg: '#fffbeb', fg: '#78350f', bd: '#fde68a', ic: '!' }, critical: { bg: '#fef2f2', fg: '#7f1d1d', bd: '#fecaca', ic: '⚠' },
};

function audienceOf(path: string): 'all' | 'staff' | 'student' {
    if (/^\/(login-student|student)(\/|$)/.test(path)) return 'student';
    if (/^\/(academic|admin|teacher|accountant|bgh|login\/(admin|academic|bgh|accountant))(\/|$)/.test(path)) return 'staff';
    return 'all';
}

export default function SystemBanner({ audience }: { audience?: 'all' | 'staff' | 'student' }) {
    const path = usePathname() || '/';
    const aud = audience ?? audienceOf(path);
    const [items, setItems] = useState<Ann[]>([]);
    const [hidden, setHidden] = useState<number[]>([]);

    useEffect(() => {
        try { setHidden(JSON.parse(sessionStorage.getItem('sys_ann_hidden') || '[]')); } catch {}
    }, []);

    useEffect(() => {
        let live = true;
        const load = () => fetch(`${BASE}/public/announcements?audience=${aud}`, { headers: { Accept: 'application/json' } })
            .then((r) => (r.ok ? r.json() : { data: [] })).then((j) => live && setItems(Array.isArray(j.data) ? j.data : [])).catch(() => {});
        load();
        const id = setInterval(load, 120000);
        return () => { live = false; clearInterval(id); };
    }, [aud]);

    const show = items.filter((a) => !hidden.includes(a.id));
    if (!show.length) return null;
    const close = (id: number) => { const n = [...hidden, id]; setHidden(n); try { sessionStorage.setItem('sys_ann_hidden', JSON.stringify(n)); } catch {} };

    return (
        <div role="region" aria-label="Thông báo hệ thống"
             style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'grid', gap: 8, width: 'min(680px, calc(100vw - 24px))', pointerEvents: 'none' }}>
            {show.map((a) => { const s = STYLE[a.level] || STYLE.info; return (
                <div key={a.id} role={a.level === 'critical' ? 'alert' : 'status'}
                     style={{ pointerEvents: 'auto', display: 'flex', gap: 10, alignItems: 'flex-start', background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, borderRadius: 14, padding: '10px 12px', fontSize: 14, lineHeight: 1.45, boxShadow: '0 10px 30px -12px rgba(15,27,45,.35)' }}>
                    <b style={{ width: 22, height: 22, borderRadius: 99, background: s.fg, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, flex: 'none' }}>{s.ic}</b>
                    <div style={{ flex: 1, minWidth: 0 }}><strong>{a.title}</strong>{a.body && <div style={{ opacity: 0.9, overflowWrap: 'anywhere' }}>{a.body}</div>}</div>
                    <button onClick={() => close(a.id)} aria-label="Đóng thông báo" style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>); })}
        </div>
    );
}