'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, Empty, ErrorBox, ICON, Ico, Loading, Progress, Stat, useApi } from './_components/ui';
import { PHASE, fmtDate, pct, qs, vnd, vndShort } from './_lib/api';

const TABS: [string, string][] = [['', 'Tất cả'], ['open', 'Đang thu'], ['overdue', 'Quá hạn'], ['draft', 'Bản nháp'], ['closed', 'Đã kết thúc'], ['cancelled', 'Đã hủy']];

export default function PeriodsPage() {
    const [status, setStatus] = useState('');
    const [year, setYear] = useState('');
    const [term, setTerm] = useState('');
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    useEffect(() => { const id = setTimeout(() => setDq(q), 300); return () => clearTimeout(id); }, [q]);
    const meta = useApi<any>('meta');
    const { data, err, loading, reload } = useApi<any>(`periods${qs({ status, year, term, q: dq })}`);
    // số lượng trên các tab luôn tính trên toàn bộ (không theo bộ lọc trạng thái)
    const all = useApi<any>(`periods${qs({ year, term, q: dq })}`);
    const counts = all.data?.counts;
    const sum = all.data?.summary;

    return (
        <>
            <div className="pd-head">
                <div>
                    <nav className="pd-crumb" aria-label="Đường dẫn"><span>Thu phí</span><i>›</i><b>Đợt thu / Kỳ thu</b></nav>
                    <h1>Đợt thu / Kỳ thu học phí</h1>
                    <p>Mỗi đợt thu gom các khoản thu của một học kỳ, tự tạo hóa đơn cho học sinh và theo dõi tiến độ thu tiền.</p>
                </div>
                <div className="pd-head-act"><Link className="pd-btn" href="/accountant/periods/new"><span aria-hidden>＋</span> Tạo đợt thu</Link></div>
            </div>

            <div className="pd-stats">
                <Stat label="Đang thu" value={sum ? `${sum.open_count} đợt` : '—'} hint="Trong các bộ lọc hiện tại" tone="pri" icon={<Ico d={ICON.doc} />} />
                <Stat label="Tổng phải thu" value={sum ? vndShort(sum.billed) : '—'} hint={sum ? vnd(sum.billed) : undefined} tone="info" icon={<Ico d={ICON.cash} />} />
                <Stat label="Đã thu" value={sum ? vndShort(sum.paid) : '—'} hint={sum ? `Đạt ${pct(sum.rate)}` : undefined} tone="ok" icon={<Ico d={ICON.check} />} />
                <Stat label="Còn phải thu" value={sum ? vndShort(sum.remaining) : '—'} hint={sum && sum.overdue_amount > 0 ? `Trong đó quá hạn ${vndShort(sum.overdue_amount)}` : 'Chưa có khoản quá hạn'} tone={sum && sum.overdue_amount > 0 ? 'err' : 'warn'} icon={<Ico d={ICON.alert} />} />
            </div>

            <div className="pd-toolbar">
                <div className="pd-tabs" role="tablist">
                    {TABS.map(([k, l]) => (
                        <button key={k} role="tab" aria-selected={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
                            {l}{counts && <em>{k === '' ? counts.all : counts[k] ?? 0}</em>}
                        </button>
                    ))}
                </div>
                <div className="pd-filters">
                    <input className="pd-in" placeholder="Tìm theo tên hoặc mã đợt…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm đợt thu" />
                    <select className="pd-in" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Năm học"><option value="">Mọi năm học</option>{meta.data?.years.map((y: any) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}</select>
                    <select className="pd-in" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Học kỳ"><option value="">Mọi học kỳ</option>{meta.data && Object.entries(meta.data.terms).map(([k, l]) => <option key={k} value={k}>{l as string}</option>)}</select>
                </div>
            </div>

            {err ? <ErrorBox msg={err} retry={reload} /> : loading && !data ? <Loading /> : !data || data.items.length === 0 ? (
                <Empty text={status || year || term || dq ? 'Không có đợt thu nào khớp bộ lọc.' : 'Chưa có đợt thu nào. Hãy tạo đợt thu đầu tiên.'}>
                    <Link className="pd-btn" href="/accountant/periods/new">Tạo đợt thu</Link>
                </Empty>
            ) : (
                <div className="pd-list">
                    {data.items.map((p: any) => {
                        const ph = PHASE[p.phase] ?? PHASE.open;
                        const s = p.stats;
                        const dueTxt = p.status === 'open' ? (p.days_left < 0 ? `Quá hạn ${-p.days_left} ngày` : p.days_left === 0 ? 'Hạn nộp là hôm nay' : `Còn ${p.days_left} ngày`) : '';
                        return (
                            <Link key={p.id} href={`/accountant/periods/${p.id}`} className={`pd-item ${p.phase}`}>
                                <div className="pd-item-top">
                                    <div className="pd-item-title">
                                        <b>{p.name}</b>
                                        <span>{p.code} · {p.year_label}</span>
                                    </div>
                                    <Chip tone={ph.tone}>{ph.label}</Chip>
                                </div>
                                <div className="pd-tags">
                                    <Chip tone="info">{p.term_label}</Chip><Chip tone="mut">{p.scope_label}</Chip>
                                    <span className="pd-date">Mở {fmtDate(p.open_date)} → hạn {fmtDate(p.due_date)}{dueTxt && <em className={p.days_left < 0 && s.remaining > 0 ? 'bad' : ''}> · {dueTxt}</em>}</span>
                                </div>
                                {p.status === 'draft' ? (
                                    <p className="pd-draft">Chưa phát hành hóa đơn. Mở đợt thu để xem trước và phát hành.</p>
                                ) : (
                                    <>
                                        <Progress paid={s.paid} pending={s.pending} total={s.billed} />
                                        <div className="pd-nums">
                                            <span>Đã thu <b>{vndShort(s.paid)}</b> / {vndShort(s.billed)} <em>({pct(s.rate)})</em></span>
                                            <span>{s.invoices} hóa đơn · {s.paid_count} đóng đủ</span>
                                            {s.overdue_count > 0 && p.status === 'open' && <span className="bad">{s.overdue_count} quá hạn</span>}
                                            {s.pending > 0 && <span className="warn">Chờ xác nhận {vndShort(s.pending)}</span>}
                                        </div>
                                    </>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}
        </>
    );
}