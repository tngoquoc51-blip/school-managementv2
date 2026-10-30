'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import './reminders.css';
import { RMeta, SugRes, StatsRes, vndShort } from './_lib/rm';
import { ErrorBox, Ico, ICON, Stat, Toast, useApi, useToast } from '../periods/_components/ui';
import { Suggest } from './_components/Suggest';
import { Compose } from './_components/Compose';
import { Batches } from './_components/Batches';
import { Templates } from './_components/Templates';
import { Effect } from './_components/Effect';

type Tab = 'suggest' | 'batches' | 'templates' | 'effect';

/** Nhắc nợ phụ huynh: đề xuất học sinh cần nhắc, soạn và gửi, theo dõi các đợt, mẫu tin và hiệu quả. Dữ liệu thật từ /api/kt/reminders/*. */
export default function RemindersPage() {
    const [tab, setTab] = useState<Tab>('suggest');
    const [ids, setIds] = useState<number[] | null>(null);
    const [tick, setTick] = useState(0);
    const [openBatch, setOpenBatch] = useState<number | null>(null);
    const toast = useToast();
    const meta = useApi<RMeta>('reminders/meta');
    const sug = useApi<SugRes>('reminders/suggestions?per_page=1');
    const st = useApi<StatsRes>(`reminders/stats?days=30&t=${tick}`);
    const t = { ok: toast.ok, fail: toast.fail };
    const changed = useCallback(() => { sug.reload(); setTick((n) => n + 1); }, [sug]);
    const s = sug.data?.summary;
    const x = st.data;

    const done = (id: number, instant: boolean) => {
        setIds(null); changed(); setOpenBatch(id); setTab('batches');
        toast.ok(instant ? 'Đã gửi thông báo tới cổng học sinh.' : 'Đã tạo đợt gửi. Hãy xuất danh sách hoặc in giấy báo rồi đánh dấu đã gửi.');
    };
    const TABS: [Tab, string, number | null][] = [['suggest', 'Cần nhắc', s?.eligible ?? null], ['batches', 'Lịch sử gửi', x?.queued_all || null], ['templates', 'Mẫu tin & cài đặt', null], ['effect', 'Hiệu quả', null]];

    return (
        <div className="cl rmd">
            <header className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><span>Kế toán</span><i>›</i><b>Nhắc nợ phụ huynh</b></nav>
                    <h1>Nhắc nợ phụ huynh</h1>
                    <p>Hệ thống đề xuất học sinh cần nhắc theo tuổi nợ, soạn tin theo mẫu có sẵn thông tin từng em, gửi lên cổng học sinh hoặc xuất danh sách SMS, Zalo, giấy báo, rồi theo dõi hiệu quả.</p>
                </div>
                <div className="pd-head-act">
                    <Link href="/accountant/debts" className="pd-btn ghost">Công nợ</Link>
                    <Link href="/accountant/collection" className="pd-btn">+ Thu học phí</Link>
                </div>
            </header>

            {sug.err && <ErrorBox msg={sug.err} retry={sug.reload} />}
            <div className="pd-stats cl-top">
                <button className="cl-stat-btn" onClick={() => setTab('suggest')} aria-label="Xem học sinh cần nhắc"><Stat label="Cần nhắc ngay" value={s ? s.eligible.toLocaleString('vi-VN') : '…'} hint={s ? `${s.debtors} học sinh còn nợ · ${s.never} chưa từng nhắc` : ''} tone={s && s.eligible ? 'err' : 'ok'} icon={<Ico d={ICON.alert} />} /></button>
                <Stat label="Đã nhắc 30 ngày qua" value={x ? x.total.toLocaleString('vi-VN') : '…'} hint={x ? `${x.students} học sinh` : ''} tone="info" icon={<Ico d={ICON.doc} />} />
                <button className="cl-stat-btn" onClick={() => setTab('batches')} aria-label="Xem tin chờ gửi"><Stat label="Chờ gửi ra ngoài" value={x ? String(x.queued_all) : '…'} hint={x ? (x.queued_all ? 'Bấm để xem các đợt →' : 'Không có tin tồn đọng') : ''} tone={x && x.queued_all ? 'warn' : 'mut'} icon={<Ico d={ICON.hourglass} />} /></button>
                <Stat label="Đóng đủ sau nhắc" value={x ? `${x.paid_rate.toLocaleString('vi-VN')}%` : '…'} hint={x ? `${x.paid_after}/${x.students} học sinh` : ''} tone="ok" icon={<Ico d={ICON.check} />} />
            </div>
            {s && s.balance > 0 && <p className="pd-muted rmd-note">Tổng công nợ hiện tại: <b>{vndShort(s.balance)}</b>. Khoảng cách tối thiểu giữa hai lần nhắc: {sug.data?.gap_days} ngày.</p>}

            <div className="pd-tabs solo cl-tabs" role="tablist">
                {TABS.map(([k, l, n]) => (
                    <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{n ? <em>{n}</em> : null}</button>
                ))}
            </div>

            {meta.err && <ErrorBox msg={meta.err} retry={meta.reload} />}
            {meta.data && (
                <>
                    {tab === 'suggest' && <Suggest meta={meta.data} refreshKey={tick} onCompose={setIds} toast={t} />}
                    {tab === 'batches' && <Batches meta={meta.data} refreshKey={tick} openId={openBatch} onOpened={() => setOpenBatch(null)} onChanged={changed} toast={t} />}
                    {tab === 'templates' && <Templates meta={meta.data} onReload={() => { meta.reload(); sug.reload(); }} toast={t} />}
                    {tab === 'effect' && <Effect refreshKey={tick} />}
                    {ids && <Compose meta={meta.data} ids={ids} onClose={() => { setIds(null); changed(); }} onDone={done} toast={t} />}
                </>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </div>
    );
}