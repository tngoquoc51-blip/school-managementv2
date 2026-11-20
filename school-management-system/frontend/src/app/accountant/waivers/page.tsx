'use client';
import { useCallback, useEffect, useState } from 'react';
import '@/modules/waivers/waivers.css';
import { errMsg, wApi } from '@/modules/waivers/api';
import type { Meta } from '@/modules/waivers/types';
import { Icon, Skeleton, UIProvider, useUI } from '@/modules/waivers/ui';
import OverviewTab from '@/modules/waivers/OverviewTab';
import RequestsTab from '@/modules/waivers/RequestsTab';
import RecordsTab from '@/modules/waivers/RecordsTab';
import TypesTab from '@/modules/waivers/TypesTab';
import LogsTab from '@/modules/waivers/LogsTab';
import RequestDrawer from '@/modules/waivers/RequestDrawer';

const TABS = [
    { id: 'overview', label: 'Tổng quan', icon: 'grid' },
    { id: 'requests', label: 'Đơn đề nghị', icon: 'file' },
    { id: 'records', label: 'Đang áp dụng', icon: 'gift' },
    { id: 'types', label: 'Danh mục chính sách', icon: 'tag' },
    { id: 'logs', label: 'Nhật ký', icon: 'shield' },
];

function WaiverApp() {
    const { toast } = useUI();
    const [meta, setMeta] = useState<Meta | null>(null);
    const [yearId, setYearId] = useState(0);
    const [tab, setTab] = useState('overview');
    const [tick, setTick] = useState(0);
    const [creating, setCreating] = useState(false);
    const [pending, setPending] = useState(0);
    const [fail, setFail] = useState('');

    const refresh = useCallback(() => setTick((t) => t + 1), []);

    useEffect(() => {
        wApi.meta().then((m) => { setMeta(m); setYearId(m.current_year_id); }).catch((e) => { setFail(errMsg(e)); toast('error', 'Không tải được dữ liệu', errMsg(e)); });
    }, [toast]);

    // đếm đơn chờ duyệt cho huy hiệu trên tab
    useEffect(() => {
        if (!yearId) return;
        wApi.stats(yearId).then((s) => setPending(s.requests.pending)).catch(() => {});
    }, [yearId, tick]);

    // phím tắt: N = lập đơn mới
    useEffect(() => {
        const k = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) { e.preventDefault(); setCreating(true); }
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);

    if (fail) return <div className="wv"><div className="wv-wrap"><div className="wv-card"><div className="wv-callout bad"><Icon n="alert" /><div><b>Không kết nối được API.</b> {fail}<br />Kiểm tra backend đang chạy, token đăng nhập còn hạn và tài khoản có vai trò kế toán.</div></div></div></div></div>;
    if (!meta || !yearId) return <div className="wv"><div className="wv-wrap"><div className="wv-card"><Skeleton rows={9} /></div></div></div>;

    const year = meta.years.find((y) => y.id === yearId);

    return (
        <div className="wv">
            <div className="wv-wrap">
                <header className="wv-hero">
                    <div>
                        <h1>Miễn giảm học phí</h1>
                        <p>Quản lý đơn đề nghị, duyệt chính sách và tự động trừ vào hóa đơn học phí. Mọi thao tác đều được ghi nhật ký.</p>
                    </div>
                    <div className="wv-hero-actions">
                        <select className="wv-select-glass" value={yearId} onChange={(e) => setYearId(Number(e.target.value))} aria-label="Năm học">
                            {meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}
                        </select>
                        <button className="wv-btn ghost-w" onClick={refresh}><Icon n="refresh" /> Làm mới</button>
                        <button className="wv-btn" style={{ background: '#fff', color: '#312e81', border: 0 }} onClick={() => setCreating(true)}><Icon n="plus" /> Lập đơn mới</button>
                    </div>
                </header>

                <nav className="wv-tabs" role="tablist">
                    {TABS.map((t) => (
                        <button key={t.id} role="tab" aria-selected={tab === t.id} className={`wv-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                            <Icon n={t.icon} />{t.label}{t.id === 'requests' && pending > 0 && <span className="wv-pill">{pending}</span>}
                        </button>
                    ))}
                </nav>

                {tab === 'overview' && <OverviewTab yearId={yearId} tick={tick} goto={setTab} />}
                {tab === 'requests' && <RequestsTab meta={meta} yearId={yearId} tick={tick} onChanged={refresh} onNew={() => setCreating(true)} />}
                {tab === 'records' && <RecordsTab meta={meta} yearId={yearId} tick={tick} onChanged={refresh} />}
                {tab === 'types' && <TypesTab meta={meta} tick={tick} onChanged={() => { refresh(); wApi.meta().then(setMeta).catch(() => {}); }} />}
                {tab === 'logs' && <LogsTab tick={tick} />}

                {creating && <RequestDrawer meta={meta} yearId={yearId} onClose={() => setCreating(false)} onDone={() => { refresh(); if (tab === 'overview') setTab('requests'); }} />}
                <p className="wv-sub" style={{ textAlign: 'center', marginTop: 28 }}>Năm học {year?.label} · Phím tắt <kbd>N</kbd> lập đơn mới · <kbd>Esc</kbd> đóng cửa sổ</p>
            </div>
        </div>
    );
}

export default function WaiversPage() {
    return <UIProvider><WaiverApp /></UIProvider>;
}