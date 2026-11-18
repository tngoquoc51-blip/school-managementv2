'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { SettingsApi } from '@/modules/accountant/settings/api';
import { ToastProvider, useToast } from '@/modules/accountant/settings/ui';
import FeeItemsPanel from '@/modules/accountant/settings/panels/FeeItemsPanel';
import LogsPanel from '@/modules/accountant/settings/panels/LogsPanel';
import PaymentPanel from '@/modules/accountant/settings/panels/PaymentPanel';
import PreferencesPanel from '@/modules/accountant/settings/panels/PreferencesPanel';
import ReceiptPanel from '@/modules/accountant/settings/panels/ReceiptPanel';
import ReminderPanel from '@/modules/accountant/settings/panels/ReminderPanel';
import SecurityPanel from '@/modules/accountant/settings/panels/SecurityPanel';
import '@/modules/accountant/settings/settings.css';

const I = (d: ReactNode) => <svg viewBox="0 0 24 24">{d}</svg>;
const ICON = {
    bank: I(<><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>),
    receipt: I(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
    tag: I(<><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></>),
    bell: I(<><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 21h4" /></>),
    mail: I(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
    lock: I(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
    clock: I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
};

type Tab = 'payment' | 'receipt' | 'items' | 'reminder' | 'prefs' | 'security' | 'logs';
const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'payment', label: 'Thông tin thu tiền', icon: ICON.bank },
    { id: 'receipt', label: 'Phiếu thu', icon: ICON.receipt },
    { id: 'items', label: 'Danh mục khoản thu', icon: ICON.tag },
    { id: 'reminder', label: 'Nhắc nợ & mẫu thông báo', icon: ICON.mail },
    { id: 'prefs', label: 'Thông báo & giao diện', icon: ICON.bell },
    { id: 'security', label: 'Bảo mật tài khoản', icon: ICON.lock },
    { id: 'logs', label: 'Nhật ký thay đổi', icon: ICON.clock },
];

function Inner() {
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('payment');
    const [ov, setOv] = useState<any>(null);

    const refresh = useCallback(() => {
        SettingsApi.overview().then(setOv).catch((e) => toast('error', 'Không tải được tổng quan', e.message));
    }, [toast]);
    useEffect(() => { refresh(); }, [refresh]);

    // nhớ tab đang mở qua #hash (vd. /accountant/settings#security)
    useEffect(() => {
        const h = window.location.hash.slice(1) as Tab;
        if (TABS.some((t) => t.id === h)) setTab(h);
    }, []);
    const go = (t: Tab) => { setTab(t); history.replaceState(null, '', `#${t}`); };

    const badge: Partial<Record<Tab, string | number>> = ov
        ? { items: ov.fee_items, reminder: `${ov.templates_active}/${ov.templates_total}`, security: ov.sessions }
        : {};

    return (
        <div className="acs-root">
            <div className="acs-hero">
                <div className="acs-hero-badge">
                    <span className="acs-hero-dot" />
                    <span>TRƯỜNG THPT NGÔ SĨ LIÊN</span>
                    <span className="acs-hero-sep">·</span>
                    <span className="acs-hero-subtag">HỆ THỐNG QUẢN TRỊ TÀI CHÍNH & THU PHÍ</span>
                </div>
                <h1>Cài đặt Kế toán & Tài chính <span className="acs-hero-highlight">GDPT 2018</span></h1>
                <p>Thiết lập thông tin tài khoản nhận học phí, định mức khoản thu, mẫu thông báo nhắc nợ và phân quyền bảo mật phòng Kế toán{ov ? ` — Phụ trách: ${ov.staff.name}` : ''}</p>
                <div className="acs-hero-meta">
                    <span className="acs-hero-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> Năm học 2026 – 2027</span>
                    <span className="acs-hero-tag"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Học kỳ I</span>
                    <span className="acs-hero-tag ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Đồng bộ dữ liệu hóa đơn điện tử</span>
                </div>
            </div>

            <div className="acs-kpis">
                <div className="acs-kpi"><small>Mức hoàn thiện cấu hình</small><b>{ov ? `${ov.completeness}%` : '—'}</b><div className="acs-bar"><i style={{ width: `${ov?.completeness || 0}%` }} /></div></div>
                <div className="acs-kpi"><small>Khoản thu trong danh mục</small><b>{ov?.fee_items ?? '—'}</b></div>
                <div className="acs-kpi"><small>Mẫu nhắc nợ đang bật</small><b>{ov ? `${ov.templates_active}/${ov.templates_total}` : '—'}</b></div>
                <div className="acs-kpi"><small>Thay đổi gần nhất</small><b style={{ fontSize: 14, lineHeight: 1.4 }}>{ov?.last_change ? `${ov.last_change.staff_name}` : 'Chưa có'}</b><small>{ov?.last_change?.created_at ?? ''}</small></div>
            </div>

            <div className="acs-body">
                <nav className="acs-nav" aria-label="Mục cài đặt">
                    {TABS.map((t) => (
                        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
                            {t.icon}{t.label}{badge[t.id] !== undefined && <em>{badge[t.id]}</em>}
                        </button>
                    ))}
                </nav>

                <main>
                    {tab === 'payment' && <PaymentPanel onSaved={refresh} demo={!!ov?.using_demo_account} />}
                    {tab === 'receipt' && <ReceiptPanel onSaved={refresh} />}
                    {tab === 'items' && <FeeItemsPanel onChanged={refresh} />}
                    {tab === 'reminder' && <ReminderPanel onChanged={refresh} />}
                    {tab === 'prefs' && <PreferencesPanel onSaved={refresh} />}
                    {tab === 'security' && <SecurityPanel onChanged={refresh} />}
                    {tab === 'logs' && <LogsPanel />}
                </main>
            </div>
        </div>
    );
}

export default function AccountantSettingsPage() {
    return <ToastProvider><Inner /></ToastProvider>;
}