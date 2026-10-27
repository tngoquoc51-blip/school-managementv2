'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import './collection.css';
import { Meta, Overview, vnd, vndShort } from './_lib/cash';
import { ErrorBox, Ico, ICON, Stat, Toast, useApi, useToast } from '../periods/_components/ui';
import { Counter } from './_components/Counter';
import { Queue } from './_components/Queue';
import { History } from './_components/History';
import { Daily } from './_components/Daily';

type Tab = 'counter' | 'queue' | 'history' | 'daily';
const TABS: [Tab, string][] = [['counter', 'Quầy thu'], ['queue', 'Chờ xác nhận'], ['history', 'Lịch sử phiếu thu'], ['daily', 'Tổng kết ngày']];

/** Thu học phí: quầy thu tại phòng Kế toán + duyệt khoản học sinh khai báo + lịch sử + tổng kết ngày. */
export default function CollectionPage() {
    const [tab, setTab] = useState<Tab>('counter');
    const [studentId, setStudentId] = useState<number | null>(null);
    const [queueQ, setQueueQ] = useState('');
    const [queueSub, setQueueSub] = useState<'pay' | 'disp'>('pay');
    const [tick, setTick] = useState(0);
    const [qk, setQk] = useState(0);
    const toast = useToast();
    const ov = useApi<Overview>('cashier/overview');
    const meta = useApi<Meta>('cashier/meta');

    // Liên kết từ trang khác: ?student=ID hoặc ?tab=queue|history|daily
    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        const s = Number(p.get('student'));
        if (s > 0) { setStudentId(s); setTab('counter'); }
        const t = p.get('tab');
        if (t === 'queue' || t === 'history' || t === 'daily') setTab(t);
    }, []);

    const changed = useCallback(() => { ov.reload(); setTick((n) => n + 1); }, [ov]);
    const openStudent = (id: number) => { setStudentId(id); setTab('counter'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const go = (target: 'queue' | 'disputes', q = '') => { setQueueQ(q); setQueueSub(target === 'disputes' ? 'disp' : 'pay'); setQk((n) => n + 1); setTab('queue'); };
    const o = ov.data;
    const t = { ok: toast.ok, fail: toast.fail };

    return (
        <div className="cl">
            <header className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><span>Kế toán</span><i>›</i><b>Thu học phí</b></nav>
                    <h1>Thu học phí</h1>
                    <p>Quầy thu tại phòng Kế toán: tìm học sinh, thu tiền theo từng hóa đơn, in phiếu thu, đối chiếu khoản học sinh tự khai báo và tổng kết cuối ngày.</p>
                </div>
                <div className="pd-head-act">
                    {meta.data && <span className="cl-year">Năm học {meta.data.year.label}</span>}
                    <Link href="/accountant/periods" className="pd-btn ghost">Đợt thu / Kỳ thu</Link>
                    <button className="pd-btn" onClick={() => { setTab('counter'); setStudentId(null); setTimeout(() => (document.querySelector('input[aria-label="Tìm học sinh"]') as HTMLInputElement | null)?.focus(), 50); }}>+ Lập phiếu thu</button>
                </div>
            </header>

            <nav className="cl-quick" aria-label="Liên kết nhanh">
                <Link href="/accountant/fees">Danh mục khoản thu</Link>
                <Link href="/accountant/periods">Đợt thu / Kỳ thu</Link>
                <Link href="/accountant/debts">Công nợ</Link>
                <Link href="/accountant/reminders">Nhắc nợ phụ huynh</Link>
                <Link href="/accountant/exemptions">Miễn giảm</Link>
                <Link href="/accountant/refunds">Hoàn trả</Link>
            </nav>

            {ov.err && <ErrorBox msg={ov.err} retry={ov.reload} />}
            <div className="pd-stats five cl-top">
                <Stat label="Thu hôm nay" value={o ? vndShort(o.today.amount) : '…'} hint={o ? `${o.today.count} phiếu · tháng này ${vndShort(o.month.amount)}` : ''} tone="ok" icon={<Ico d={ICON.cash} />} />
                <button className="cl-stat-btn" onClick={() => setTab('daily')} aria-label="Mở tổng kết ngày"><Stat label="Tiền mặt hôm nay" value={o ? vndShort(o.today.by_method.find((m) => m.method === 'cash')?.amount ?? 0) : '…'} hint="Xem tổng kết ngày →" tone="info" icon={<Ico d={ICON.doc} />} /></button>
                <button className="cl-stat-btn" onClick={() => go('queue')} aria-label="Mở danh sách chờ xác nhận"><Stat label="Chờ xác nhận" value={o ? `${o.pending.count} khoản` : '…'} hint={o ? (o.pending.count ? `${vndShort(o.pending.amount)} · lâu nhất ${o.pending.oldest_days} ngày` : 'Không tồn đọng') : ''} tone={o && o.pending.count ? 'warn' : 'mut'} icon={<Ico d={ICON.hourglass} />} /></button>
                <Stat label="Nợ quá hạn" value={o ? vndShort(o.debt.overdue) : '…'} hint={o ? `${o.debt.overdue_students} học sinh · tổng nợ ${vndShort(o.debt.balance)}` : ''} tone="err" icon={<Ico d={ICON.alert} />} />
                <button className="cl-stat-btn" onClick={() => go('disputes')} aria-label="Mở phản hồi về hóa đơn"><Stat label="Phản hồi chưa trả lời" value={o ? String(o.disputes_open) : '…'} hint="Học sinh hỏi về hóa đơn" tone={o && o.disputes_open ? 'warn' : 'mut'} icon={<Ico d={ICON.users} />} /></button>
            </div>

            <div className="pd-tabs solo cl-tabs" role="tablist">
                {TABS.map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                        {l}{k === 'queue' && o && o.pending.count + o.disputes_open > 0 ? <em>{o.pending.count + o.disputes_open}</em> : null}
                    </button>
                ))}
            </div>

            {meta.err && <ErrorBox msg={meta.err} retry={meta.reload} />}
            {meta.data && (
                <>
                    {tab === 'counter' && <Counter meta={meta.data} overview={o} studentId={studentId} onSelect={setStudentId} onChanged={changed} onGo={go} toast={t} />}
                    {tab === 'queue' && <Queue key={qk} meta={meta.data} initialQ={queueQ} initialSub={queueSub} onOpenStudent={openStudent} onChanged={changed} toast={t} />}
                    {tab === 'history' && <History meta={meta.data} refreshKey={tick} onOpenStudent={openStudent} onChanged={changed} toast={t} />}
                    {tab === 'daily' && <Daily refreshKey={tick} />}
                </>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}