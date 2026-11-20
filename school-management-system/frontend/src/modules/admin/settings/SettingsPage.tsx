'use client';

import { useEffect, useState } from 'react';
import './settings.css';
import { NAV, GROUPS } from './schema';
import { errMsg, settingsApi } from './api';
import { ConfirmProvider, Icon, ToastProvider, useToast, Card, Btn, Field } from './ui';
import GroupForm from './GroupForm';
import Overview from './Overview';
import SchoolYears from './SchoolYears';
import Backups from './Backups';
import AuditLogs from './AuditLogs';
import Sessions from './Sessions';
import Maintenance from './Maintenance';

const ALL = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

function MailTest() {
    const toast = useToast();
    const [to, setTo] = useState(''); const [busy, setBusy] = useState(false);
    const send = async () => {
        setBusy(true);
        try { const r = await settingsApi.mailTest(to); toast('ok', 'Đã gửi', r.message); } catch (e) { toast('err', 'Gửi thất bại', errMsg(e)); } finally { setBusy(false); }
    };
    return (
        <Card icon="send" title="Gửi email thử" desc="Dùng cấu hình đã LƯU (hãy lưu trước khi thử)">
            <div style={{ display: 'flex', gap: 10, maxWidth: 560 }}>
                <input className="st-in" placeholder="email.nhan@vi-du.com" value={to} onChange={(e) => setTo(e.target.value)} />
                <Btn kind="pri" icon="send" busy={busy} disabled={!to} onClick={send}>Gửi thử</Btn>
            </div>
        </Card>
    );
}

function Inner() {
    const [active, setActive] = useState('overview');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [brand, setBrand] = useState<{ p?: string; a?: string }>({});

    // điều hướng bằng hash: /admin/settings#security
    useEffect(() => {
        const read = () => { const h = window.location.hash.replace('#', ''); if (ALL.some((i) => i.id === h)) setActive(h); };
        read(); window.addEventListener('hashchange', read);
        try { const t = localStorage.getItem('st-theme'); if (t === 'dark') setTheme('dark'); } catch {}
        settingsApi.getGroup('appearance').then((d) => setBrand({ p: d.values.primary_color, a: d.values.accent_color })).catch(() => {});
        return () => window.removeEventListener('hashchange', read);
    }, []);

    const go = (id: string) => { setActive(id); history.replaceState(null, '', `#${id}`); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); try { localStorage.setItem('st-theme', t); } catch {} };

    const item = ALL.find((i) => i.id === active)!;
    const grp = NAV.find((g) => g.items.some((i) => i.id === active))!;

    const body = () => {
        switch (active) {
            case 'overview': return <Overview go={go} />;
            case 'years': return <SchoolYears />;
            case 'backup': return <Backups />;
            case 'audit': return <AuditLogs />;
            case 'sessions': return <Sessions />;
            case 'maintenance': return <Maintenance />;
            case 'mail': return <GroupForm key="mail" group="mail" extra={() => <MailTest />} />;
            case 'appearance': return <GroupForm key="appearance" group="appearance" onSaved={(v) => setBrand({ p: v.primary_color, a: v.accent_color })} />;
            default: return GROUPS[active] ? <GroupForm key={active} group={active} /> : null;
        }
    };

    // màu mặc định cũ (#4f46e5 - tím) bị bỏ qua để dùng màu xanh của hệ thống
    const style: any = {};
    if (brand.p && brand.p.toLowerCase() !== '#4f46e5') style['--st-primary'] = brand.p;
    if (brand.a && brand.a.toLowerCase() !== '#14b8a6') style['--st-accent'] = brand.a;

    return (
        <div className="st-root" data-theme={theme} style={style}>
            <div className="st-top">
                <div className="st-groups" role="tablist">
                    {NAV.map((g) => (
                        <button key={g.title} role="tab" className={`st-gbtn ${g.title === grp.title ? 'on' : ''}`} onClick={() => go(g.items[0].id)}>{g.title}</button>
                    ))}
                </div>
                <button className="st-btn" onClick={toggleTheme} title="Đổi giao diện sáng/tối"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />{theme === 'dark' ? 'Sáng' : 'Tối'}</button>
            </div>

            {grp.items.length > 1 && (
                <div className="st-tabs">
                    {grp.items.map((i) => (
                        <button key={i.id} className={`st-tab ${active === i.id ? 'on' : ''}`} onClick={() => go(i.id)} title={i.desc}>
                            <span className="ic"><Icon name={i.icon} size={14} /></span>{i.label}
                        </button>
                    ))}
                </div>
            )}

            <main className="st-main">
                <div className="st-head">
                    <div>
                        <div className="st-crumb">{grp.title} › {item.label}</div>
                        <h1>{GROUPS[active]?.title || item.label}</h1>
                        <p>{GROUPS[active]?.desc || item.desc}</p>
                    </div>
                </div>
                <div className="st-body">{body()}</div>
            </main>
        </div>
    );
}

export default function SettingsPage() {
    return <ToastProvider><ConfirmProvider><Inner /></ConfirmProvider></ToastProvider>;
}