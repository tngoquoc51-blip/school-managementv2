'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './debts.css';
import { DMeta, ListRes, vnd, vndShort } from './_lib/db';
import { ErrorBox, Ico, ICON, Progress, Stat, Toast, useApi, useToast } from '../periods/_components/ui';
import { Overview } from './_components/Overview';
import { List, Preset } from './_components/List';
import { Promises } from './_components/Promises';
import { StudentModal } from './_components/StudentModal';

type Tab = 'overview' | 'list' | 'promises';

/** Công nợ học phí: tổng quan tuổi nợ, danh sách học sinh còn nợ, lời hẹn trả và nhật ký liên hệ. Dữ liệu thật từ /api/kt/debts/*. */
export default function DebtsPage() {
    const [tab, setTab] = useState<Tab>('overview');
    const [preset, setPreset] = useState<Preset>({});
    const [lk, setLk] = useState(0);
    const [tick, setTick] = useState(0);
    const [open, setOpen] = useState<number | null>(null);
    const toast = useToast();
    const meta = useApi<DMeta>('debts/meta');
    const sum = useApi<ListRes>('debts?per_page=1');

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const t = p.get('tab');
        if (t === 'list' || t === 'promises') setTab(t);
        const s = Number(p.get('student'));
        if (s > 0) setOpen(s);
    }, []);
    const changed = useCallback(() => { sum.reload(); setTick((n) => n + 1); }, [sum]);
    const go = (p: Preset) => { setPreset(p); setLk((n) => n + 1); setTab('list'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const s = sum.data?.summary;
    const t = { ok: toast.ok, fail: toast.fail };
    const late = s?.promise_late ?? 0;
    const TABS: [Tab, string][] = [['overview', 'Tổng quan'], ['list', 'Học sinh còn nợ'], ['promises', 'Hẹn trả & liên hệ']];

    return (
        <div className="cl dbt">
            <header className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><span>Kế toán</span><i>›</i><b>Công nợ</b></nav>
                    <h1>Công nợ học phí</h1>
                    <p>Theo dõi học sinh còn nợ theo tuổi nợ, khối, lớp và đợt thu. Ghi nhận liên hệ phụ huynh, lời hẹn trả và chuyển sang quầy thu khi phụ huynh đến đóng.</p>
                </div>
                <div className="pd-head-act">
                    {meta.data && <span className="cl-year">Hôm nay {meta.data.today.split('-').reverse().join('/')}</span>}
                    <Link href="/accountant/reminders" className="pd-btn ghost">Nhắc nợ phụ huynh</Link>
                    <Link href="/accountant/collection" className="pd-btn">+ Thu học phí</Link>
                </div>
            </header>

            {sum.err && <ErrorBox msg={sum.err} retry={sum.reload} />}
            <div className="pd-stats cl-top">
                <Stat label="Học sinh còn nợ" value={s ? s.students.toLocaleString('vi-VN') : '…'} hint={s ? `${s.unpaid} chưa đóng · ${s.partial} đóng một phần` : ''} tone={s && s.students ? 'err' : 'ok'} icon={<Ico d={ICON.users} />} />
                <Stat label="Tổng công nợ" value={s ? vndShort(s.balance) : '…'} hint={s ? `${vnd(s.balance)}${s.pending ? ` · chờ xác nhận ${vndShort(s.pending)}` : ''}` : ''} tone="warn" icon={<Ico d={ICON.cash} />} />
                <button className="cl-stat-btn" onClick={() => go({ state: 'overdue' })} aria-label="Xem học sinh nợ quá hạn"><Stat label="Nợ quá hạn" value={s ? vndShort(s.overdue) : '…'} hint={s ? `${s.overdue_students} học sinh · bấm để xem →` : ''} tone={s && s.overdue ? 'err' : 'mut'} icon={<Ico d={ICON.alert} />} /></button>
                <button className="cl-stat-btn" onClick={() => setTab('promises')} aria-label="Xem lời hẹn trả"><Stat label="Lời hẹn trả" value={s ? `${s.promise_open + late}` : '…'} hint={s ? (late ? `${late} đã quá hẹn · bấm để xem →` : 'Không có lời hẹn quá hạn') : ''} tone={late ? 'err' : 'info'} icon={<Ico d={ICON.clock} />} /></button>
            </div>
            {s && <div className="dbt-rate"><span>Tỷ lệ đã thu trên tổng phải thu: <b>{s.collect_pct.toLocaleString('vi-VN')}%</b> ({vnd(s.paid)} / {vnd(s.billed)})</span><Progress paid={s.paid} total={Math.max(s.billed, 1)} /></div>}

            <div className="pd-tabs solo cl-tabs" role="tablist">
                {TABS.map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                        {l}{k === 'promises' && late > 0 ? <em>{late}</em> : null}{k === 'list' && s && s.students > 0 ? <em>{s.students}</em> : null}
                    </button>
                ))}
            </div>

            {meta.err && <ErrorBox msg={meta.err} retry={meta.reload} />}
            {meta.data && (
                <>
                    {tab === 'overview' && <Overview meta={meta.data} refreshKey={tick} onOpen={setOpen} onGo={go} />}
                    {tab === 'list' && <List key={lk} meta={meta.data} preset={preset} refreshKey={tick} onOpen={setOpen} toast={t} />}
                    {tab === 'promises' && <Promises meta={meta.data} refreshKey={tick} onOpen={setOpen} onChanged={changed} toast={t} />}
                    {open !== null && <StudentModal id={open} meta={meta.data} onClose={() => setOpen(null)} onChanged={changed} toast={t} />}
                </>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}