'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { NoticeDrawer, useNoticeActions } from '../_detail';
import { Avatar, Btn, CAT_ICON, CAT_TONE, Empty, ErrorBox, Ico, Loading, Notice, Pager, Pill, PriorityPill, Tabs, ago, dt, nt, qs, useLoad, useNt } from '../_nt';

export default function Approvals() {
    const { canApprove, staff } = useNt();
    const [tab, setTab] = useState<'pending' | 'rejected'>('pending');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null);
    const { data, err, loading, reload } = useLoad(() => nt<Notice[]>(qs({ status: tab, page, per: 10, mine: !canApprove })), [tab, page, canApprove]);
    const a = useNoticeActions(reload);
    const counts = data?.counts ?? {};
    const rows = data?.data ?? [];

    return (
        <div className="nt-page">
            <div className="nt-ptitle">
                <div><h2>Phê duyệt thông báo</h2>
                    <p>{canApprove ? 'Xem và duyệt các thông báo do Phó hiệu trưởng gửi lên. Duyệt xong thông báo sẽ tự gửi (hoặc đúng giờ hẹn).' : 'Theo dõi thông báo bạn đã gửi lên Hiệu trưởng duyệt.'}</p></div>
            </div>

            {!canApprove && <div className="nt-note"><Ico n="lock" size={18} /><div><b>Chỉ Hiệu trưởng được duyệt</b><p>Bạn đang đăng nhập với vai trò {staff.role_label}. Tại đây bạn chỉ xem được các thông báo của mình.</p></div></div>}

            <Tabs<'pending' | 'rejected'> value={tab} onChange={(k) => { setTab(k); setPage(1); }} items={[
                { key: 'pending', label: 'Chờ duyệt', count: counts.pending ?? 0, tone: 'amber' }, { key: 'rejected', label: 'Bị từ chối', count: counts.rejected ?? 0, tone: 'rose' },
            ]} />

            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : rows.length === 0 ? (
                <Empty icon="checks" title={tab === 'pending' ? 'Không có thông báo nào chờ duyệt' : 'Không có thông báo bị từ chối'} text={tab === 'pending' ? 'Khi Phó hiệu trưởng gửi thông báo (và chế độ duyệt đang bật), chúng sẽ hiện ở đây.' : undefined} />
            ) : (
                <div className="nt-appr">
                    {rows.map((n) => (
                        <article key={n.id} className={`nt-ap p-${n.priority}`}>
                            <header>
                                <span className={`ic t-${CAT_TONE[n.category] || 'indigo'}`}><Ico n={CAT_ICON[n.category] || 'bell'} size={19} /></span>
                                <div><h3>{n.title}</h3><small>{n.code} · {n.category_label}</small></div>
                                <div className="pl"><PriorityPill p={n.priority} />{n.require_ack ? <Pill tone="violet">Cần xác nhận</Pill> : null}</div>
                            </header>
                            <p className="ex">{n.excerpt}{n.excerpt.length >= 160 ? '…' : ''}</p>
                            <ul className="meta">
                                <li><Ico n="users" size={14} />{n.audience_label}</li>
                                <li><Ico n="clock" size={14} />{n.scheduled_at ? `Hẹn gửi ${dt(n.scheduled_at)}` : 'Gửi ngay khi duyệt'}</li>
                                <li><Avatar name={n.created_by_name} tone="indigo" />{n.created_by_name} · {ago(n.updated_at)}</li>
                            </ul>
                            {tab === 'rejected' && n.review_note && <div className="nt-note bad"><Ico n="alert" size={16} /><div><b>Lý do từ chối{n.approved_by ? ` · ${n.approved_by}` : ''}</b><p>{n.review_note}</p></div></div>}
                            <footer>
                                <Btn onClick={() => setOpen(n.id)}><Ico n="eye" size={15} />Xem toàn văn</Btn>
                                {tab === 'pending' && canApprove && (<><Btn tone="danger" onClick={() => a.act(n, 'reject')}>Từ chối</Btn><Btn tone="success" onClick={() => a.act(n, 'approve')}><Ico n="check" size={15} />Duyệt & gửi</Btn></>)}
                                {tab === 'rejected' && (n.created_by === staff.username || canApprove) && <Link className="nt-btn primary" href={`/bgh/notices/soan?id=${n.id}`}><Ico n="edit" size={15} />Chỉnh sửa & gửi lại</Link>}
                            </footer>
                        </article>
                    ))}
                </div>
            )}
            {data?.meta && rows.length > 0 && <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} />}
            {open !== null && <NoticeDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
            {a.dialog}
        </div>
    );
}