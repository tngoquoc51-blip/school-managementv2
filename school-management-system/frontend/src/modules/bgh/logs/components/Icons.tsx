import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
    shield: <path d="M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3z" />,
    pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c1.9.7 3.2 2.5 3.5 5.2" /></>,
    coin: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.3 0-2.3-.4-2.8-1.2M12 6v2m0 8v2" /></>,
    bell: <path d="M6 9a6 6 0 1112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 004 0" />,
    cog: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    download: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16" />,
    refresh: <path d="M21 12a9 9 0 11-3-6.7M21 4v5h-5" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" /></>,
    moon: <path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    back: <path d="M15 6l-6 6 6 6" />,
    logout: <path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 16l-4-4 4-4M6 12h10" />,
    alert: <><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5m0 3v.1" /></>,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3m-3 3l3 3m-6-0l2 2" /></>,
    link: <path d="M10 14a4 4 0 005.7 0l3-3A4 4 0 0013 5.3l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" />,
    fingerprint: <path d="M12 11v3a6 6 0 01-1 3.5M8 14a4 4 0 118 0c0 2-.4 3.6-1.2 5M5 12a7 7 0 0114 0c0 2.4-.2 4.6-1 6.5M3 9a10 10 0 0118 0M9 20c.9-1.2 1.4-2.8 1.5-4.5" />,
    trash: <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    db: <><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 017.5-2" /></>,
};

export function Icon({ name, size = 18, stroke = 1.9 }: { name: keyof typeof P | string; size?: number; stroke?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {P[name] || P.list}
        </svg>
    );
}