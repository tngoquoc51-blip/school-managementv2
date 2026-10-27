'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './receipts.css';
import { RegisterRes, RMeta, vnd, vndShort } from './_lib/rc';
import { ErrorBox, Ico, ICON, Stat, Toast, useApi, useToast } from '../periods/_components/ui';
import { Register } from './_components/Register';
import { Recon } from './_components/Recon';
import { Stats } from './_components/Stats';

type Tab = 'register' | 'recon' | 'stats';

/** Phiếu thu / Biên lai: sổ phiếu thu, đối soát chuyển khoản với sao kê, thống kê. Dữ liệu thật từ /api/kt/receipts/*. */
export default function ReceiptsPage() {
    const [tab, setTab] = useState<Tab>('register');
    const [tick, setTick] = useState(0);
    const toast = useToast();
    const meta = useApi<RMeta>('receipts/meta');
    const sum = useApi<RegisterRes>('receipts?per_page=1');

    useEffect(() => {
        const t = new URLSearchParams(window.location.search).get('tab');
        if (t === 'recon' || t === 'stats') setTab(t);
    }, []);
    const changed = useCallback(() => { sum.reload(); setTick((n) => n + 1); }, [sum]);
    const s = sum.data?.summary;
    const cash = s?.by_method.find((m) => m.method === 'cash');
    const todo = s?.recon.todo.count ?? 0;
    const t = { ok: toast.ok, fail: toast.fail };
    const TABS: [Tab, string][] = [['register', 'Sổ phiếu thu'], ['recon', 'Đối soát chuyển khoản'], ['stats', 'Thống kê']];

    return (
        <div className="cl rc">
            <header className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><span>Kế toán</span><i>›</i><b>Phiếu thu / Biên lai</b></nav>
                    <h1>Phiếu thu / Biên lai</h1>
                    <p>Tra cứu mọi phiếu thu, in lại biên lai, hủy phiếu có lý do, đối soát chuyển khoản với sao kê ngân hàng và xem thống kê số thu.</p>
                </div>
                <div className="pd-head-act">
                    {meta.data && <span className="cl-year">Hôm nay {meta.data.today.split('-').reverse().join('/')}</span>}
                    <Link href="/accountant/periods" className="pd-btn ghost">Đợt thu / Kỳ thu</Link>
                    <Link href="/accountant/collection" className="pd-btn">+ Lập phiếu thu</Link>
                </div>
            </header>

            {sum.err && <ErrorBox msg={sum.err} retry={sum.reload} />}
            <div className="pd-stats cl-top">
                <Stat label="Phiếu thu hợp lệ" value={s ? s.valid.count.toLocaleString('vi-VN') : '…'} hint={s ? vnd(s.valid.amount) : ''} tone="ok" icon={<Ico d={ICON.doc} />} />
                <Stat label="Tiền mặt" value={s ? vndShort(cash?.amount ?? 0) : '…'} hint={s ? `${(cash?.count ?? 0).toLocaleString('vi-VN')} phiếu · không tiền mặt ${vndShort(s.valid.amount - (cash?.amount ?? 0))}` : ''} tone="info" icon={<Ico d={ICON.cash} />} />
                <button className="cl-stat-btn" onClick={() => setTab('recon')} aria-label="Mở đối soát chuyển khoản">
                    <Stat label="Chưa đối soát" value={s ? `${todo.toLocaleString('vi-VN')} phiếu` : '…'} hint={s ? (todo ? `${vndShort(s.recon.todo.amount)} · bấm để đối soát →` : 'Đã khớp hết sao kê') : ''} tone={todo ? 'warn' : 'mut'} icon={<Ico d={ICON.hourglass} />} />
                </button>
                <Stat label="Phiếu đã hủy" value={s ? s.voided.count.toLocaleString('vi-VN') : '…'} hint={s ? vnd(s.voided.amount) : ''} tone={s && s.voided.count ? 'err' : 'mut'} icon={<Ico d={ICON.alert} />} />
            </div>

            <div className="pd-tabs solo cl-tabs" role="tablist">
                {TABS.map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                        {l}{k === 'recon' && todo > 0 ? <em>{todo}</em> : null}
                    </button>
                ))}
            </div>

            {meta.err && <ErrorBox msg={meta.err} retry={meta.reload} />}
            {meta.data && (
                <>
                    {tab === 'register' && <Register meta={meta.data} refreshKey={tick} onChanged={changed} toast={t} />}
                    {tab === 'recon' && <Recon meta={meta.data} refreshKey={tick} onChanged={changed} toast={t} />}
                    {tab === 'stats' && <Stats refreshKey={tick} />}
                </>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}