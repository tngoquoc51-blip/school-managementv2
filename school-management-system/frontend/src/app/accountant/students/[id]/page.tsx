'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { errMsg, get } from '@/modules/accountant/finance/api';
import { fdate, initials, vnd } from '@/modules/accountant/finance/format';
import { CollectModal, InvoiceDrawer, NoteModal, ReceiptModal, ReminderModal, WaiverModal } from '@/modules/accountant/finance/modals';
import { useSession } from '@/modules/accountant/finance/session';
import { BASE, notifyChanged } from '@/modules/accountant/finance/Shell';
import {
    DebtTab, DisputesTab, InvoicesTab, OverviewTab, PaymentsTab, TimelineTab, WalletTab, WaiversTab,
} from '@/modules/accountant/finance/tabs';
import type { DebtNote, Detail, Invoice } from '@/modules/accountant/finance/types';
import { Empty, FinChip, Icon, Skeleton } from '@/modules/accountant/finance/ui';

type TabKey = 'overview' | 'invoices' | 'payments' | 'waivers' | 'wallet' | 'debt' | 'disputes' | 'timeline';

export default function StudentFinanceDetail() {
    const { id } = useParams<{ id: string }>();
    const studentId = Number(id);
    const { meta, canWrite } = useSession();
    const router = useRouter();
    const path = usePathname();
    const sp = useSearchParams();

    const yearId = Number(sp.get('year_id') || meta.current_year_id);
    const tab = (sp.get('tab') || 'overview') as TabKey;
    const action = sp.get('action');

    const [d, setD] = useState<Detail | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [error, setError] = useState('');
    const [ver, setVer] = useState(0);

    const [collect, setCollect] = useState<{ invoiceId?: number | null } | null>(null);
    const [invoiceId, setInvoiceId] = useState<number | null>(null);
    const [receiptId, setReceiptId] = useState<number | null>(null);
    const [note, setNote] = useState<DebtNote['kind'] | null>(null);
    const [remind, setRemind] = useState(false);
    const [waiverOpen, setWaiverOpen] = useState(false);

    const nav = useCallback((patch: Record<string, string | null>) => {
        const n = new URLSearchParams(sp.toString());
        Object.entries(patch).forEach(([k, v]) => (v === null ? n.delete(k) : n.set(k, v)));
        router.replace(`${path}?${n.toString()}`);
    }, [sp, router, path]);

    useEffect(() => {
        setError('');
        Promise.all([
            get<Detail>(`/students/${studentId}`, { year_id: yearId }),
            get<Invoice[]>(`/students/${studentId}/invoices`, { year_id: 'all' }),
        ]).then(([det, inv]) => { setD(det); setInvoices(inv); }).catch((e) => setError(errMsg(e)));
    }, [studentId, yearId, ver]);

    const changed = useCallback(() => { setVer((v) => v + 1); notifyChanged(); }, []);

    // /students/12?action=collect → mở sẵn hộp thoại thu tiền (từ nút "Thu tiền" ngoài danh sách)
    useEffect(() => {
        if (action === 'collect' && d && canWrite) { setCollect({}); nav({ action: null }); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [action, d]);

    if (error) return <div className="fx-card"><Empty icon="alert" title="Không tải được hồ sơ" text={error} action={<Link className="fx-btn pri" href={BASE}>Về danh sách</Link>} /></div>;
    if (!d) return <><Skeleton h={190} style={{ borderRadius: 22 }} /><Skeleton h={56} /><Skeleton h={300} /></>;

    const s = d.summary; const c = d.counts;
    const tabs: { k: TabKey; label: string; icon: string; n?: number; hot?: boolean }[] = [
        { k: 'overview', label: 'Tổng quan', icon: 'home' },
        { k: 'invoices', label: 'Hóa đơn', icon: 'file', n: s.open_invoices },
        { k: 'payments', label: 'Phiếu thu', icon: 'wallet', n: c.pending_payments, hot: true },
        { k: 'waivers', label: 'Miễn giảm', icon: 'gift', n: c.waivers },
        { k: 'wallet', label: 'Ví điện tử', icon: 'wallet' },
        { k: 'debt', label: 'Công nợ & nhắc nợ', icon: 'note', n: c.late_promises || c.open_promises, hot: c.late_promises > 0 },
        { k: 'disputes', label: 'Khiếu nại', icon: 'chat', n: c.open_disputes, hot: true },
        { k: 'timeline', label: 'Nhật ký', icon: 'list' },
    ];

    return (
        <>
            <div className="fx-hero">
                <div className="fx-between" style={{ position: 'relative', alignItems: 'flex-start' }}>
                    <div className="fx-row" style={{ gap: 18, flexWrap: 'nowrap' }}>
                        <div className="fx-ava">{initials(d.student.full_name)}</div>
                        <div>
                            <Link href={BASE} className="fx-small" style={{ opacity: .85 }}>← Danh sách học sinh</Link>
                            <h1>{d.student.full_name}</h1>
                            <div className="meta">
                                <span>Mã: <b>{d.student.code}</b></span><span>Lớp: <b>{d.class?.name || 'chưa xếp lớp'}</b></span>
                                <span>{d.student.gender} · {fdate(d.student.birth_date)}</span>
                                <span style={{ background: '#fff', borderRadius: 99, padding: '0 4px' }}><FinChip s={s.fin_status} days={s.max_overdue_days} /></span>
                            </div>
                        </div>
                    </div>
                    <div className="fx-row" style={{ gap: 8 }}>
                        <select className="fx-sel" value={yearId} onChange={(e) => nav({ year_id: e.target.value })}>
                            {meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}</option>)}
                        </select>
                        {canWrite && <>
                            <button className="fx-btn solid" onClick={() => setCollect({})}><Icon name="wallet" size={16} /> Thu tiền</button>
                            <button className="fx-btn" onClick={() => setRemind(true)}><Icon name="send" size={16} /> Nhắc nợ</button>
                            <button className="fx-btn" onClick={() => setNote('note')}><Icon name="note" size={16} /> Ghi chú</button>
                            <button className="fx-btn" onClick={() => setWaiverOpen(true)}><Icon name="gift" size={16} /> Miễn giảm</button>
                        </>}
                    </div>
                </div>
                <div className="fx-sum">
                    <div><small>Tổng phải thu</small><b>{vnd(s.total)}</b></div>
                    <div><small>Đã thu ({s.rate}%)</small><b>{vnd(s.paid)}</b></div>
                    <div><small>Còn nợ</small><b>{vnd(s.debt)}</b></div>
                    <div><small>Quá hạn</small><b>{vnd(s.overdue)}</b></div>
                    <div><small>Hạn nộp gần nhất</small><b>{s.next_due ? fdate(s.next_due) : '—'}</b></div>
                </div>
            </div>

            {(s.overdue > 0 || c.late_promises > 0 || c.pending_payments > 0 || c.open_disputes > 0) && (
                <div className="fx-alerts">
                    {s.overdue > 0 && <div className="fx-alert bad"><Icon name="alert" /><div className="grow"><b>Nợ quá hạn {vnd(s.overdue)}</b> — chậm nhất {s.max_overdue_days} ngày.</div>
                        {canWrite && <><button className="fx-btn sm" onClick={() => setRemind(true)}>Gửi nhắc nợ</button><button className="fx-btn sm ok" onClick={() => setCollect({})}>Thu tiền</button></>}</div>}
                    {c.late_promises > 0 && <div className="fx-alert bad"><Icon name="clock" /><div className="grow">Phụ huynh đã <b>lỡ {c.late_promises} lịch hẹn trả</b> tiền.</div><button className="fx-btn sm" onClick={() => nav({ tab: 'debt' })}>Xem lịch hẹn</button></div>}
                    {c.pending_payments > 0 && <div className="fx-alert warn"><Icon name="wallet" /><div className="grow"><b>{c.pending_payments} phiếu thu</b> đang chờ xác nhận.</div><button className="fx-btn sm" onClick={() => nav({ tab: 'payments' })}>Xử lý</button></div>}
                    {c.open_disputes > 0 && <div className="fx-alert info"><Icon name="chat" /><div className="grow"><b>{c.open_disputes} khiếu nại</b> hóa đơn chưa được trả lời.</div><button className="fx-btn sm" onClick={() => nav({ tab: 'disputes' })}>Trả lời</button></div>}
                </div>
            )}

            <div className="fx-tabs" role="tablist">
                {tabs.map((t) => (
                    <button key={t.k} role="tab" aria-selected={tab === t.k} className={`fx-tab ${tab === t.k ? 'on' : ''}`} onClick={() => nav({ tab: t.k === 'overview' ? null : t.k })}>
                        <Icon name={t.icon} size={16} />{t.label}{!!t.n && <b className={t.hot ? 'hot' : ''}>{t.n}</b>}
                    </button>
                ))}
            </div>

            {tab === 'overview' && <OverviewTab d={d} invoices={invoices} onYear={(y) => nav({ year_id: String(y) })} onOpenInvoice={setInvoiceId} onCollect={(i) => setCollect({ invoiceId: i })} />}
            {tab === 'invoices' && <InvoicesTab invoices={invoices} yearId={yearId} onOpen={setInvoiceId} onCollect={(i) => setCollect({ invoiceId: i })} />}
            {tab === 'payments' && <PaymentsTab studentId={studentId} yearId={yearId} ver={ver} onReceipt={setReceiptId} onChanged={changed} />}
            {tab === 'waivers' && <WaiversTab studentId={studentId} yearId={yearId} ver={ver} onChanged={changed} />}
            {tab === 'wallet' && <WalletTab studentId={studentId} ver={ver} />}
            {tab === 'debt' && <DebtTab studentId={studentId} ver={ver} onNote={setNote} onRemind={() => setRemind(true)} onChanged={changed} />}
            {tab === 'disputes' && <DisputesTab studentId={studentId} ver={ver} onChanged={changed} />}
            {tab === 'timeline' && <TimelineTab studentId={studentId} ver={ver} />}

            {collect && <CollectModal studentId={studentId} invoices={invoices} invoiceId={collect.invoiceId} onClose={() => setCollect(null)}
                                      onDone={(pid) => { setCollect(null); setReceiptId(pid); changed(); }} />}
            {invoiceId && <InvoiceDrawer id={invoiceId} onClose={() => setInvoiceId(null)} onReceipt={setReceiptId}
                                         onCollect={(i) => { setInvoiceId(null); setCollect({ invoiceId: i }); }} />}
            {receiptId && <ReceiptModal id={receiptId} onClose={() => setReceiptId(null)} />}
            {note && <NoteModal studentId={studentId} defaultKind={note} onClose={() => setNote(null)} onDone={() => { setNote(null); changed(); nav({ tab: 'debt' }); }} />}
            {remind && <ReminderModal studentId={studentId} onClose={() => setRemind(false)} onDone={() => { setRemind(false); changed(); nav({ tab: 'debt' }); }} />}
            {waiverOpen && <WaiverModal studentId={studentId} yearId={yearId} onClose={() => setWaiverOpen(false)} onDone={() => { setWaiverOpen(false); changed(); nav({ tab: 'waivers' }); }} />}
        </>
    );
}