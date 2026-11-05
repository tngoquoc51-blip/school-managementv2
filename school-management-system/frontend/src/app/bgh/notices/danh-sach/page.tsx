'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { NoticeDrawer, useNoticeActions } from '../_detail';
import {
    Btn, CAT_ICON, CAT_TONE, Card, Empty, ErrorBox, Ico, Loading, Notice, Pager, PriorityPill, ReadMeter, StatusPill, Tabs, dt, ago, nt, num, qs, useDebounced, useLoad, useNt,
} from '../_nt';

type St = 'all' | 'draft' | 'pending' | 'scheduled' | 'sent' | 'rejected' | 'archived';

export default function List() {
    const { meta, staff, canApprove } = useNt();
    const [st, setSt] = useState<St>('all');
    const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [pri, setPri] = useState(''); const [mine, setMine] = useState(false); const [sort, setSort] = useState('new');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null);
    const dq = useDebounced(q);

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        const s = sp.get('status'); if (s && ['draft', 'pending', 'scheduled', 'sent', 'rejected', 'archived'].includes(s)) setSt(s as St);
        const o = Number(sp.get('open') || 0); if (o) setOpen(o);
    }, []);

    const { data, err, loading, reload } = useLoad(() => nt<Notice[]>(qs({ status: st === 'all' ? '' : st, q: dq, category: cat, priority: pri, mine, sort, page, per: 12 })), [st, dq, cat, pri, mine, sort, page]);
    const a = useNoticeActions(reload);
    const c = data?.counts ?? {};
    const rows = data?.data ?? [];
    const filtered = !!(dq || cat || pri || mine);

    return (
        <div className="nt-page">
            <div className="nt-ptitle">
                <div><h2>Danh sách thông báo</h2><p>Toàn bộ thông báo của nhà trường: nháp, chờ duyệt, hẹn giờ, đã gửi và đã thu hồi.</p></div>
                <div className="acts"><Link href="/bgh/notices/soan" className="nt-btn primary"><Ico n="plus" size={16} />Soạn thông báo</Link></div>
            </div>

            <Tabs<St> value={st} onChange={(k) => { setSt(k); setPage(1); }} items={[
                { key: 'all', label: 'Tất cả', count: c.all ?? 0 }, { key: 'sent', label: 'Đã gửi', count: c.sent ?? 0, tone: 'green' }, { key: 'scheduled', label: 'Hẹn giờ', count: c.scheduled ?? 0, tone: 'sky' },
                { key: 'pending', label: 'Chờ duyệt', count: c.pending ?? 0, tone: 'amber' }, { key: 'draft', label: 'Bản nháp', count: c.draft ?? 0 },
                { key: 'rejected', label: 'Bị từ chối', count: c.rejected ?? 0, tone: 'rose' }, { key: 'archived', label: 'Đã thu hồi', count: c.archived ?? 0 },
            ]} />

            <div className="nt-filters">
                <label className="nt-search"><Ico n="search" size={16} /><input placeholder="Tìm tiêu đề, nội dung, mã, người soạn…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
                <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">Mọi danh mục</option>{(meta?.categories ?? []).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                <select value={pri} onChange={(e) => { setPri(e.target.value); setPage(1); }}><option value="">Mọi mức độ</option><option value="urgent">Khẩn</option><option value="high">Quan trọng</option><option value="normal">Thường</option></select>
                <select value={sort} onChange={(e) => setSort(e.target.value)}><option value="new">Mới cập nhật</option><option value="old">Cũ nhất</option><option value="read">Nhiều lượt đọc</option></select>
                <button type="button" className={`nt-toggle${mine ? ' on' : ''}`} onClick={() => { setMine(!mine); setPage(1); }}>Của tôi</button>
                {filtered && <button type="button" className="nt-link" onClick={() => { setQ(''); setCat(''); setPri(''); setMine(false); setPage(1); }}>Xóa lọc</button>}
            </div>

            <Card pad={false} className="nt-listcard">
                {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : rows.length === 0 ? (
                    <Empty icon="bell" title={filtered ? 'Không có thông báo phù hợp' : 'Chưa có thông báo nào'} text={filtered ? 'Thử bỏ bớt bộ lọc.' : 'Bấm “Soạn thông báo” để tạo thông báo đầu tiên.'} action={!filtered ? <Link className="nt-btn primary" href="/bgh/notices/soan">Soạn thông báo</Link> : undefined} />
                ) : (
                    <div className="nt-tablewrap">
                        <table className="nt-tbl big">
                            <thead><tr><th>Thông báo</th><th>Người nhận</th><th>Trạng thái</th><th>Thời gian</th><th>Đã đọc</th><th /></tr></thead>
                            <tbody>
                            {rows.map((n) => {
                                const mineRow = n.created_by === staff.username || canApprove;
                                return (
                                    <tr key={n.id} onClick={() => setOpen(n.id)} className={n.priority === 'urgent' ? 'urgent' : ''}>
                                        <td>
                                            <div className="nt-ttl">
                                                <span className={`ic t-${CAT_TONE[n.category] || 'indigo'}`}><Ico n={CAT_ICON[n.category] || 'bell'} size={17} /></span>
                                                <div><b>{n.pinned ? <Ico n="pin" size={13} className="pin" /> : null}{n.title}</b><small>{n.code} · {n.category_label} · {n.created_by_name}</small><p>{n.excerpt}</p></div>
                                            </div><div className="nt-pills"><PriorityPill p={n.priority} />{n.require_ack ? <span className="nt-mini">Cần xác nhận</span> : null}{n.expired ? <span className="nt-mini mute">Hết hạn</span> : null}</div>
                                        </td>
                                        <td className="nt-aud-c">{n.audience_label}{n.recipients_total ? <small>{num(n.recipients_total)} người</small> : null}</td>
                                        <td><StatusPill s={n.status} />{n.status === 'rejected' && n.review_note ? <small className="rj" title={n.review_note}>{n.review_note}</small> : null}</td>
                                        <td className="nt-time">{n.status === 'scheduled' ? <>{dt(n.scheduled_at)}<small>{ago(n.scheduled_at)}</small></> : n.sent_at ? <>{dt(n.sent_at)}<small>{ago(n.sent_at)}</small></> : <>{dt(n.updated_at)}<small>cập nhật</small></>}</td>
                                        <td><ReadMeter n={n} /></td>
                                        <td className="nt-rowact" onClick={(e) => e.stopPropagation()}>
                                            {mineRow && n.status === 'sent' && <Btn size="sm" onClick={() => a.act(n, 'remind')} title="Nhắc người chưa đọc"><Ico n="bell" size={14} /></Btn>}
                                            {mineRow && (n.status === 'draft' || n.status === 'rejected') && <Btn size="sm" tone="primary" onClick={() => a.act(n, 'send_now')}>Gửi</Btn>}
                                            {canApprove && n.status === 'pending' && <Btn size="sm" tone="success" onClick={() => a.act(n, 'approve')}>Duyệt</Btn>}
                                            <RowMenu n={n} mine={mineRow} a={a} onOpen={() => setOpen(n.id)} />
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
                {data?.meta && rows.length > 0 && <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />}
            </Card>

            {open !== null && <NoticeDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
            {a.dialog}
        </div>
    );
}

function RowMenu({ n, mine, a, onOpen }: { n: Notice; mine: boolean; a: ReturnType<typeof useNoticeActions>; onOpen: () => void }) {
    const { canApprove } = useNt();
    const [o, setO] = useState(false);
    const [pos, setPos] = useState<React.CSSProperties>({});
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!o) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setO(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, [o]);
    const it = (label: string, icon: string, fn: () => void, danger?: boolean) => <button key={label} className={danger ? 'd' : ''} onClick={() => { setO(false); fn(); }}><Ico n={icon} size={15} />{label}</button>;
    const items: React.ReactNode[] = [it('Xem chi tiết', 'eye', onOpen)];
    if (mine && ['draft', 'rejected', 'scheduled'].includes(n.status)) items.push(<Link key="e" href={`/bgh/notices/soan?id=${n.id}`} onClick={() => setO(false)}><Ico n="edit" size={15} />Sửa</Link>);
    if (mine && n.status === 'scheduled') items.push(it('Gửi ngay', 'send', () => a.act(n, 'send_now')), it('Hủy hẹn giờ', 'undo', () => a.act(n, 'unschedule')));
    if (mine && n.status === 'sent') items.push(it(n.pinned ? 'Bỏ ghim' : 'Ghim lên đầu', 'pin', () => a.act(n, n.pinned ? 'unpin' : 'pin')));
    if (n.status === 'pending' && canApprove) items.push(it('Từ chối', 'x', () => a.act(n, 'reject'), true));
    items.push(it('Nhân bản', 'copy', () => a.act(n, 'duplicate')));
    if (mine && n.status === 'sent') items.push(it('Thu hồi', 'archive', () => a.act(n, 'archive'), true));
    if (mine && n.status === 'archived') items.push(it('Khôi phục', 'undo', () => a.act(n, 'restore')));
    if (mine && ['draft', 'rejected', 'archived'].includes(n.status)) items.push(it('Xóa', 'trash', () => a.del(n), true));
    return (
        <div className="nt-menu" ref={ref}>
            <Btn size="sm" tone="ghost" aria-label="Thao tác khác" onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const up = window.innerHeight - r.bottom < 300;
                setPos(up ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right } : { top: r.bottom + 4, right: window.innerWidth - r.right });
                setO(!o);
            }}><Ico n="more" size={16} /></Btn>
            {o && <div className="pop" style={pos}>{items}</div>}
        </div>
    );
}