'use client';
import { useEffect, useRef, useState } from 'react';
import type { AlertItem } from './types';
import { Empty, Icon } from './ui';

export default function NotificationCenter({ alerts, total, onPick }: { alerts: AlertItem[]; total: number; onPick: (a: AlertItem) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    return (
        <div className="dc-bell" ref={ref}>
            <button className="dc-btn" onClick={() => setOpen((o) => !o)} aria-label="Thông báo hệ thống"><Icon n="bell" />{total > 0 && <span className="dot">{total > 99 ? '99+' : total}</span>}</button>
            {open && (
                <div className="dc-bellpanel">
                    <h4>Thông báo hệ thống</h4>
                    {!alerts.length ? <Empty icon="ok" text="Không có việc cần xử lý" /> : alerts.map((a) => (
                        <button key={a.key} className={`dc-alert ${a.level}`} onClick={() => { setOpen(false); onPick(a); }}>
                            <i /><span><b>{a.title}</b><small>{a.message}</small></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}