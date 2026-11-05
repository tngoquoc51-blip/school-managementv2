'use client';
// Thao tác & khung chi tiết thông báo, dùng chung cho Tổng quan / Danh sách / Phê duyệt
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import {
    Audience, Bar, Btn, CAT_ICON, CAT_TONE, Confirm, Drawer, Empty, ErrorBox, HIST, Ico, Loading, Notice, Pager, Pill, PriorityPill, Ring, StatusPill,
    TYPE_LABEL, ago, downloadCsv, dt, nt, num, pct, useDebounced, useLoad, useNt, qs,
} from './_nt';

type Dlg = { title: string; text?: React.ReactNode; ok: string; tone: 'primary' | 'danger' | 'success'; label?: string; required?: boolean; run: (note: string) => Promise<void> };

/** Hook thao tác. Gọi `dialog` ở cuối JSX của trang để hiện hộp xác nhận. */
export function useNoticeActions(onChanged?: () => void) {
    const { toast, refresh } = useNt();
    const router = useRouter();
    const [dlg, setDlg] = useState<Dlg | null>(null);

    const post = async (id: number, action: string, note?: string) => {
        const r = await nt<Notice>(`${id}/action`, { method: 'POST', body: { action, note } });
        toast(r.message || 'Đã thực hiện.'); refresh(); onChanged?.();
        return r;
    };
    const direct = async (id: number, action: string) => { try { await post(id, action); } catch (e) { toast((e as Error).message, 'err'); } };

    const act = (n: Notice, action: string) => {
        switch (action) {
            case 'send_now':
                setDlg({ title: 'Gửi thông báo ngay?', ok: 'Gửi ngay', tone: 'primary', run: async () => { await post(n.id, action); setDlg(null); },
                    text: <>Thông báo <b>“{n.title}”</b> sẽ được gửi tới <b>{n.audience_label}</b>. Nếu bạn là Phó hiệu trưởng và nhà trường bật chế độ duyệt, thông báo sẽ chờ Hiệu trưởng duyệt.</> }); break;
            case 'approve':
                setDlg({ title: 'Duyệt và gửi thông báo', ok: 'Duyệt & gửi', tone: 'success', label: 'Ghi chú cho người soạn (không bắt buộc)', run: async (note) => { await post(n.id, action, note); setDlg(null); },
                    text: <>Duyệt <b>“{n.title}”</b> của <b>{n.created_by_name}</b>. Thông báo sẽ gửi tới <b>{n.audience_label}</b>{n.scheduled_at ? <> vào lúc <b>{dt(n.scheduled_at)}</b></> : ' ngay sau khi duyệt'}.</> }); break;
            case 'reject':
                setDlg({ title: 'Từ chối thông báo', ok: 'Từ chối & trả lại', tone: 'danger', label: 'Lý do từ chối (người soạn sẽ đọc được)', required: true, run: async (note) => { await post(n.id, action, note); setDlg(null); },
                    text: <>Trả lại <b>“{n.title}”</b> cho <b>{n.created_by_name}</b> để chỉnh sửa.</> }); break;
            case 'archive':
                setDlg({ title: 'Thu hồi thông báo?', ok: 'Thu hồi', tone: 'danger', label: 'Lý do thu hồi (không bắt buộc)', run: async (note) => { await post(n.id, action, note); setDlg(null); },
                    text: <>Thông báo sẽ <b>không còn hiện</b> ở các cổng Giáo viên, Học sinh, Phụ huynh. Số liệu đã đọc vẫn được giữ lại và bạn có thể khôi phục sau.</> }); break;
            case 'remind':
                setDlg({ title: 'Nhắc lại những người chưa đọc?', ok: 'Nhắc lại', tone: 'primary', run: async () => { await post(n.id, action); setDlg(null); },
                    text: <>Thông báo sẽ được đẩy lên đầu danh sách và gắn nhãn “Nhắc lại” với những người chưa đọc. Hiện có <b>{num(n.reads_count)}</b>/<b>{num(n.recipients_total)}</b> người đã đọc.</> }); break;
            case 'duplicate':
                nt<Notice>(`${n.id}/action`, { method: 'POST', body: { action } })
                    .then((r) => { toast(r.message || 'Đã nhân bản.'); refresh(); router.push(`/bgh/notices/soan?id=${r.data.id}`); })
                    .catch((e: Error) => toast(e.message, 'err')); break;
            default: void direct(n.id, action);
        }
    };

    const del = (n: Notice) => setDlg({
        title: 'Xóa thông báo?', ok: 'Xóa', tone: 'danger',
        text: <>Xóa vĩnh viễn <b>{n.code} – {n.title}</b> cùng lịch sử và số liệu đã đọc. Không thể hoàn tác.</>,
        run: async () => { const r = await nt(`${n.id}`, { method: 'DELETE' }); toast(r.message || 'Đã xóa.'); refresh(); onChanged?.(); setDlg(null); },
    });

    const dialog = dlg ? <Confirm title={dlg.title} text={dlg.text} okText={dlg.ok} tone={dlg.tone} noteLabel={dlg.label} noteRequired={dlg.required} onOk={dlg.run} onClose={() => setDlg(null)} /> : null;
    return { act, del, dialog };
}

/** Nút thao tác theo trạng thái (dùng ở chân khung chi tiết và trong danh sách) */
export function ActionButtons({ n, a, onEdit }: { n: Notice; a: ReturnType<typeof useNoticeActions>; onEdit?: () => void }) {
    const { staff, canApprove } = useNt();
    const mine = n.created_by === staff.username || canApprove;
    const edit = <Link key="e" className="nt-btn" href={`/bgh/notices/soan?id=${n.id}`} onClick={onEdit}><Ico n="edit" size={15} />Sửa</Link>;
    const dup = <Btn key="d" onClick={() => a.act(n, 'duplicate')}><Ico n="copy" size={15} />Nhân bản</Btn>;
    const out: React.ReactNode[] = [];
    if (n.status === 'draft' || n.status === 'rejected') { if (mine) out.push(edit, <Btn key="s" tone="primary" onClick={() => a.act(n, 'send_now')}><Ico n="send" size={15} />Gửi ngay</Btn>); out.push(dup); if (mine) out.push(<Btn key="x" tone="danger" onClick={() => a.del(n)}><Ico n="trash" size={15} /></Btn>); }
    if (n.status === 'scheduled') { if (mine) out.push(edit, <Btn key="s" tone="primary" onClick={() => a.act(n, 'send_now')}><Ico n="send" size={15} />Gửi ngay</Btn>, <Btn key="u" onClick={() => a.act(n, 'unschedule')}><Ico n="undo" size={15} />Hủy hẹn giờ</Btn>); out.push(dup); }
    if (n.status === 'pending') { if (canApprove) out.push(<Btn key="a" tone="success" onClick={() => a.act(n, 'approve')}><Ico n="check" size={15} />Duyệt & gửi</Btn>, <Btn key="r" tone="danger" onClick={() => a.act(n, 'reject')}>Từ chối</Btn>); else out.push(<Pill key="w" tone="amber" dot>Đang chờ Hiệu trưởng duyệt</Pill>); out.push(dup); }
    if (n.status === 'sent') { if (mine) out.push(<Btn key="m" tone="primary" onClick={() => a.act(n, 'remind')}><Ico n="bell" size={15} />Nhắc người chưa đọc</Btn>, <Btn key="p" onClick={() => a.act(n, n.pinned ? 'unpin' : 'pin')}><Ico n="pin" size={15} />{n.pinned ? 'Bỏ ghim' : 'Ghim'}</Btn>); out.push(dup); if (mine) out.push(<Btn key="x" tone="danger" onClick={() => a.act(n, 'archive')}><Ico n="archive" size={15} />Thu hồi</Btn>); }
    if (n.status === 'archived') { if (mine) out.push(<Btn key="r" tone="primary" onClick={() => a.act(n, 'restore')}><Ico n="undo" size={15} />Khôi phục</Btn>); out.push(dup); if (mine) out.push(<Btn key="x" tone="danger" onClick={() => a.del(n)}><Ico n="trash" size={15} /></Btn>); }
    return <>{out}</>;
}

type Detail = {
    notice: Notice; audience: Audience; groups: { key: string; label: string; total: number; read: number }[];
    by_class: { name: string; grade: number; total: number; read: number }[]; timeline: { d: string; n: number }[];
    history: { action: string; actor: string; note: string | null; created_at: string }[];
};

export function NoticeDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged?: () => void }) {
    const [tab, setTab] = useState<'content' | 'stats' | 'unread' | 'history'>('content');
    const { data, err, loading, reload } = useLoad(async () => (await nt<Detail>(`${id}`)).data, [id]);
    const a = useNoticeActions(() => { reload(); onChanged?.(); });
    const n = data?.notice;
    const live = n && (n.status === 'sent' || n.status === 'archived');

    return (
        <Drawer onClose={onClose}
                title={n ? <span className="nt-dr-t"><span className={`ic t-${CAT_TONE[n.category] || 'indigo'}`}><Ico n={CAT_ICON[n.category] || 'bell'} size={18} /></span>{n.title}</span> : 'Chi tiết thông báo'}
                sub={n ? <span className="nt-dr-s">{n.code}<StatusPill s={n.status} /><PriorityPill p={n.priority} />{n.pinned ? <Pill tone="violet">📌 Đã ghim</Pill> : null}{n.expired ? <Pill tone="slate">Đã hết hạn</Pill> : null}</span> : undefined}
                foot={n ? <div className="nt-dr-act"><ActionButtons n={n} a={a} onEdit={onClose} /></div> : undefined}>
            {loading && !data && <Loading />}
            {err && !data && <ErrorBox msg={err} retry={reload} />}
            {n && data && (
                <>
                    <div className="nt-tabs mini">
                        {([['content', 'Nội dung'], ['stats', 'Thống kê đọc'], ['unread', 'Chưa đọc'], ['history', 'Lịch sử']] as const).map(([k, l]) => (
                            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
                        ))}
                    </div>
                    {tab === 'content' && <ContentTab d={data} />}
                    {tab === 'stats' && (live ? <StatsTab d={data} /> : <Empty icon="stats" title="Chưa có số liệu đọc" text="Thông báo cần được gửi đi thì mới có người đọc và có thống kê." />)}
                    {tab === 'unread' && (live ? <UnreadTab d={data} /> : <Empty icon="eye" title="Chưa gửi" text="Danh sách chưa đọc có sau khi thông báo được gửi." />)}
                    {tab === 'history' && <HistoryTab d={data} />}
                </>
            )}
            {a.dialog}
        </Drawer>
    );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) { return <div className="nt-kv"><span>{k}</span><b>{v}</b></div>; }

function ContentTab({ d }: { d: Detail }) {
    const n = d.notice; const au = d.audience;
    return (
        <div className="nt-dr-sec">
            {n.review_note && <div className={`nt-note ${n.status === 'rejected' ? 'bad' : ''}`}><Ico n={n.status === 'rejected' ? 'alert' : 'check'} size={18} /><div><b>{n.status === 'rejected' ? 'Lý do từ chối' : 'Ghi chú khi duyệt'}{n.approved_by ? ` · ${n.approved_by}` : ''}</b><p>{n.review_note}</p></div></div>}
            <div className="nt-body">{n.body}</div>
            {n.links.length > 0 && <div className="nt-links">{n.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"><Ico n="link" size={15} />{l.label}</a>)}</div>}
            <div className="nt-kvs">
                <Meta k="Danh mục" v={n.category_label} />
                <Meta k="Người soạn" v={`${n.created_by_name} · ${ago(n.created_at)}`} />
                <Meta k="Người nhận" v={n.audience_label} />
                <Meta k="Số người nhận" v={`${num(n.status === 'sent' || n.status === 'archived' ? n.recipients_total : au.total)}${n.status === 'sent' || n.status === 'archived' ? '' : ' (dự kiến)'}`} />
                {n.classes && n.classes.length > 0 && <Meta k="Lớp chọn" v={n.classes.map((c) => c.name).join(', ')} />}
                {n.scheduled_at && <Meta k="Hẹn gửi lúc" v={dt(n.scheduled_at)} />}
                {n.sent_at && <Meta k="Đã gửi lúc" v={dt(n.sent_at)} />}
                {n.expires_at && <Meta k="Hết hạn" v={dt(n.expires_at)} />}
                {n.require_ack ? <Meta k="Xác nhận" v={`Yêu cầu xác nhận đã đọc${n.ack_count !== null ? ` · ${num(n.ack_count)} đã xác nhận` : ''}`} /> : null}
                {n.last_reminded_at && <Meta k="Nhắc lại lần cuối" v={dt(n.last_reminded_at)} />}
            </div>
        </div>
    );
}

function StatsTab({ d }: { d: Detail }) {
    const n = d.notice; const p = pct(n.reads_count, n.recipients_total);
    const [type, setType] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q);
    const rd = useLoad(() => nt<{ user_type: string; user_key: string; user_name: string; class_name: string | null; read_at: string; ack_at: string | null }[]>(`${n.id}/reads${qs({ type, q: dq, page })}`), [n.id, type, dq, page]);
    const { toast } = useNt(); const [busy, setBusy] = useState(false);
    const maxT = Math.max(...d.timeline.map((x) => x.n), 1);
    return (
        <div className="nt-dr-sec">
            <div className="nt-statrow">
                <Ring value={p} label="đã đọc" tone={p >= 70 ? 'green' : p >= 40 ? 'amber' : 'rose'} />
                <div><b>{num(n.reads_count)}</b><small>lượt đã đọc</small></div>
                <div><b>{num(n.recipients_total)}</b><small>người nhận</small></div>
                {n.require_ack ? <div><b>{num(n.ack_count)}</b><small>đã xác nhận</small></div> : null}
            </div>
            {d.groups.length > 0 && <div className="nt-grp">{d.groups.map((g) => (<div key={g.key}><span>{g.label}</span><Bar value={pct(g.read, g.total)} tone={pct(g.read, g.total) >= 70 ? 'green' : 'indigo'} /><b>{num(g.read)}/{num(g.total)}</b></div>))}</div>}
            {d.by_class.length > 0 && (<><h4 className="nt-h4">Tỉ lệ đã đọc theo lớp</h4>
                <div className="nt-cls">{d.by_class.map((c) => { const v = pct(c.read, c.total); return (<div key={c.name} title={`${c.read}/${c.total}`}><b>{c.name}</b><i className={v >= 70 ? 'g' : v >= 40 ? 'a' : 'r'} style={{ height: `${Math.max(6, v)}%` }} /><small>{v}%</small></div>); })}</div></>)}
            {d.timeline.length > 0 && (<><h4 className="nt-h4">Lượt đọc theo ngày</h4>
                <div className="nt-tl">{d.timeline.slice(-14).map((x) => (<div key={x.d} title={`${x.d}: ${x.n}`}><i style={{ height: `${Math.max(8, (x.n / maxT) * 100)}%` }} /><small>{x.d.slice(8, 10)}/{x.d.slice(5, 7)}</small></div>))}</div></>)}
            <div className="nt-toolbar">
                <h4 className="nt-h4" style={{ margin: 0 }}>Người đã đọc</h4>
                <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">Tất cả</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input placeholder="Tìm tên, mã, lớp…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
                <Btn size="sm" busy={busy} onClick={async () => { setBusy(true); try { await downloadCsv(n.id, n.code); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false); }}><Ico n="download" size={14} />CSV</Btn>
            </div>
            {rd.loading && !rd.data ? <Loading /> : rd.err ? <ErrorBox msg={rd.err} retry={rd.reload} /> : !rd.data?.data.length ? <Empty icon="eye" title="Chưa có ai đọc" text="Khi người dùng mở thông báo trên các cổng, tên họ sẽ xuất hiện ở đây." /> : (
                <>
                    <table className="nt-tbl"><thead><tr><th>Người dùng</th><th>Lớp</th><th>Đọc lúc</th><th>Xác nhận</th></tr></thead>
                        <tbody>{rd.data.data.map((r) => (<tr key={r.user_type + r.user_key}><td><b>{r.user_name || r.user_key}</b><small>{TYPE_LABEL[r.user_type]} · {r.user_key}</small></td><td>{r.class_name || '—'}</td><td>{dt(r.read_at)}</td><td>{r.ack_at ? <Pill tone="green">Đã xác nhận</Pill> : <span className="nt-mute">—</span>}</td></tr>))}</tbody></table>
                    {rd.data.meta && <Pager page={rd.data.meta.page} pages={rd.data.meta.pages} total={rd.data.meta.total} onPage={setPage} />}
                </>
            )}
        </div>
    );
}

function UnreadTab({ d }: { d: Detail }) {
    const n = d.notice; const { meta } = useNt();
    const first = n.to_students ? 'student' : n.to_parents ? 'parent' : n.to_teachers ? 'teacher' : 'none';
    const [type, setType] = useState(first); const [cls, setCls] = useState('');
    const ld = useLoad(() => (type === 'none' ? Promise.resolve(null) : nt<{ code: string; name: string; class_name: string | null }[]>(`${n.id}/unread${qs({ type, class: cls })}`)), [n.id, type, cls]);
    if (first === 'none') return <Empty icon="eye" title="Không có danh sách" text="Chỉ tính được danh sách chưa đọc cho học sinh, phụ huynh và giáo viên." />;
    const types = [n.to_students ? ['student', 'Học sinh'] : null, n.to_parents ? ['parent', 'Phụ huynh'] : null, n.to_teachers ? ['teacher', 'Giáo viên'] : null].filter(Boolean) as string[][];
    const list = ld.data?.data ?? [];
    return (
        <div className="nt-dr-sec">
            <div className="nt-toolbar">
                <select value={type} onChange={(e) => { setType(e.target.value); setCls(''); }}>{types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                {type !== 'teacher' && <select value={cls} onChange={(e) => setCls(e.target.value)}><option value="">Tất cả lớp</option>{(meta?.classes ?? []).filter((c) => n.class_ids.length === 0 || n.class_ids.includes(c.id)).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>}
                <span className="nt-mute">{ld.data ? `${num(list.length)}${ld.data.meta?.total && ld.data.meta.total >= 300 ? '+' : ''} người chưa đọc` : ''}</span>
            </div>
            {ld.loading && !ld.data ? <Loading /> : ld.err ? <ErrorBox msg={ld.err} retry={ld.reload} /> : list.length === 0 ? <Empty icon="checks" title="Tất cả đã đọc" text="Không còn ai chưa đọc trong nhóm này." /> : (
                <table className="nt-tbl"><thead><tr><th>Người dùng</th><th>Lớp</th></tr></thead>
                    <tbody>{list.map((r) => <tr key={r.code}><td><b>{r.name}</b><small>{r.code}</small></td><td>{r.class_name || '—'}</td></tr>)}</tbody></table>
            )}
        </div>
    );
}

function HistoryTab({ d }: { d: Detail }) {
    if (!d.history.length) return <Empty icon="clock" title="Chưa có lịch sử" />;
    return (
        <ol className="nt-hist">
            {d.history.map((h, i) => (
                <li key={i} className={`h-${h.action}`}><i /><div><b>{HIST[h.action] || h.action}</b><span>{h.actor} · {dt(h.created_at)}</span>{h.note && <p>{h.note}</p>}</div></li>
            ))}
        </ol>
    );
}