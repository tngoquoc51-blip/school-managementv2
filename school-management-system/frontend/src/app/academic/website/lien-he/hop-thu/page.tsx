'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, qs } from '@/app/academic/_lib/api';
import { Pager, dt, downloadCsv, useDebounced, useList, useToast } from '@/app/academic/website/_wm';
import { Av, BASE, ST, StPill, ago } from '../_lh';

const TABS: [string, string][] = [['open', 'Đang mở'], ['new', 'Mới'], ['working', 'Đang xử lý'], ['done', 'Đã trả lời'], ['spam', 'Spam'], ['', 'Tất cả']];

/** Hộp thư: danh sách có lọc, chọn nhiều để thao tác hàng loạt. Bấm vào một tin để mở màn hình chi tiết. */
export default function Inbox() {
    const router = useRouter();
    const [f, setF] = useState({ status: 'open', topic: '', assigned: '', priority: false, overdue: false, starred: false, sort: 'smart', from: '', to: '' });
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [ready, setReady] = useState(false);
    const [sel, setSel] = useState<number[]>([]);
    const dq = useDebounced(q);
    const toast = useToast();

    useEffect(() => { // đọc bộ lọc từ địa chỉ (?status=new&overdue=1) khi bấm từ trang Tổng quan
        const p = new URLSearchParams(window.location.search);
        setF((x) => ({ ...x, status: p.get('status') ?? x.status, assigned: p.get('assigned') ?? '', overdue: p.get('overdue') === '1', priority: p.get('priority') === '1', starred: p.get('starred') === '1', topic: p.get('topic') ?? '' }));
        if (p.get('overdue') === '1' && !p.get('status')) setF((x) => ({ ...x, status: 'open' }));
        setReady(true);
    }, []);

    const filt = { status: f.status, topic: f.topic, assigned: f.assigned, priority: f.priority ? 1 : '', overdue: f.overdue ? 1 : '', starred: f.starred ? 1 : '', sort: f.sort, from: f.from, to: f.to, q: dq };
    const list = useList<any>(ready ? `website/inbox${qs({ ...filt, page })}` : 'website/inbox?page=1');
    const staff = useList<any[]>('website/staff');
    const d = list.data;
    const set = (k: string, v: any) => { setF((x) => ({ ...x, [k]: v })); setPage(1); setSel([]); };
    const allOn = !!d?.items.length && d.items.every((x: any) => sel.includes(x.id));

    async function bulk(action: string, value = '') {
        if (!sel.length) return;
        if (action === 'delete' && !confirm(`Xóa vĩnh viễn ${sel.length} tin nhắn đã chọn?`)) return;
        try { const r = await api<any>('website/inbox/bulk', { method: 'POST', body: { ids: sel, action, value } }); toast.ok(r.message || 'Đã cập nhật.'); setSel([]); list.reload(); } catch (e: any) { toast.fail(e.message); }
    }
    async function star(m: any, ev: React.MouseEvent) {
        ev.stopPropagation();
        try { await api(`website/inbox/${m.id}`, { method: 'PUT', body: { is_starred: !m.is_starred } }); list.reload(); } catch (e: any) { toast.fail(e.message); }
    }
    async function exportCsv() {
        try {
            const r = await api<any>(`website/inbox/export${qs(filt)}`);
            downloadCsv(`tin-nhan-lien-he-${new Date().toISOString().slice(0, 10)}.csv`, ['Mã', 'Người gửi', 'Điện thoại', 'Email', 'Chủ đề', 'Nội dung', 'Trạng thái', 'Ưu tiên', 'Người phụ trách', 'Quá hạn', 'Gửi lúc', 'Trả lời lần đầu'],
                r.items.map((m: any) => [m.id, m.full_name, m.phone ? `="${m.phone}"` : '', m.email, m.topic, m.message, ST[m.status], m.priority ? 'Cao' : '', m.assigned_name || '', m.overdue ? 'Có' : '', dt(m.created_at), dt(m.first_response_at)]));
            toast.ok(`Đã xuất ${r.items.length} tin nhắn.`);
        } catch (e: any) { toast.fail(e.message); }
    }

    return (
        <>
            {toast.node}
            <div className="lh-pills">
                {TABS.map(([k, v]) => <button key={k || 'all'} className={`lh-pillbtn ${f.status === k ? 'on' : ''}`} onClick={() => set('status', k)}>{v}<em>{d?.tabs?.[k || 'all'] ?? ''}</em></button>)}
            </div>
            <section className="wm-card">
                <div className="wm-bar">
                    <input className="wm-in" placeholder="Tìm theo tên, số điện thoại, email, nội dung…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
                    <select className="wm-sel" value={f.topic} onChange={(e) => set('topic', e.target.value)}><option value="">Mọi chủ đề</option>{(d?.topics ?? []).map((t: string) => <option key={t}>{t}</option>)}</select>
                    <select className="wm-sel" value={f.assigned} onChange={(e) => set('assigned', e.target.value)}>
                        <option value="">Mọi người phụ trách</option><option value="me">Của tôi</option><option value="none">Chưa giao</option>
                        {(staff.data ?? []).map((s: any) => <option key={s.username} value={s.username}>{s.full_name}</option>)}
                    </select>
                    <select className="wm-sel" value={f.sort} onChange={(e) => set('sort', e.target.value)}><option value="smart">Ưu tiên việc cần làm</option><option value="new">Mới nhất</option><option value="old">Cũ nhất</option></select>
                </div>
                <div className="wm-bar lh-bar2">
                    <label className="wm-chk"><input type="checkbox" checked={f.priority} onChange={(e) => set('priority', e.target.checked)} />Ưu tiên cao</label>
                    <label className="wm-chk"><input type="checkbox" checked={f.overdue} onChange={(e) => set('overdue', e.target.checked)} />Quá hạn phản hồi</label>
                    <label className="wm-chk"><input type="checkbox" checked={f.starred} onChange={(e) => set('starred', e.target.checked)} />Gắn sao</label>
                    <span className="lh-sp" />
                    <label className="lh-date">Từ <input type="date" className="wm-in" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
                    <label className="lh-date">Đến <input type="date" className="wm-in" value={f.to} onChange={(e) => set('to', e.target.value)} /></label>
                    <button className="wm-btn ghost sm" onClick={exportCsv}>Xuất Excel (CSV)</button>
                </div>
                {sel.length > 0 && (
                    <div className="lh-bulk" role="region" aria-label="Thao tác hàng loạt">
                        <b>Đã chọn {sel.length} tin</b>
                        <select className="wm-sel" value="" onChange={(e) => e.target.value && bulk('status', e.target.value)}><option value="">Đổi trạng thái…</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                        <select className="wm-sel" value="" onChange={(e) => e.target.value && bulk('assign', e.target.value === '-' ? '' : e.target.value)}><option value="">Giao cho…</option><option value="me">Tôi</option>{(staff.data ?? []).map((s: any) => <option key={s.username} value={s.username}>{s.full_name}</option>)}<option value="-">Bỏ phân công</option></select>
                        <button className="wm-btn ghost sm" onClick={() => bulk('priority', '1')}>Đánh dấu ưu tiên</button>
                        <button className="wm-btn danger sm" onClick={() => bulk('delete')}>Xóa</button>
                        <button className="wm-btn ghost sm" onClick={() => setSel([])}>Bỏ chọn</button>
                    </div>
                )}
                {list.err ? <div className="wm-state err">{list.err} <button className="wm-btn sm" onClick={list.reload}>Thử lại</button></div>
                    : list.loading && !d ? <div className="wm-state">Đang tải…</div>
                        : !d?.items.length ? <div className="wm-state">Không có tin nhắn nào phù hợp bộ lọc.</div> : (
                            <div className="wm-tw"><table className="wm-table lh-table"><thead><tr>
                                <th style={{ width: 36 }}><input type="checkbox" aria-label="Chọn tất cả" checked={allOn} onChange={() => setSel(allOn ? [] : d.items.map((x: any) => x.id))} /></th>
                                <th style={{ width: 34 }} /><th>Người gửi</th><th>Nội dung</th><th>Trạng thái</th><th>Phụ trách</th><th>Gửi lúc</th></tr></thead><tbody>
                            {d.items.map((m: any) => (
                                <tr key={m.id} className={`wm-click ${m.status === 'new' ? 'lh-unread' : ''}`} onClick={() => router.push(`${BASE}/hop-thu/${m.id}`)}>
                                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Chọn tin của ${m.full_name}`} checked={sel.includes(m.id)} onChange={() => setSel((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))} /></td>
                                    <td><button className={`lh-star ${m.is_starred ? 'on' : ''}`} onClick={(e) => star(m, e)} aria-label={m.is_starred ? 'Bỏ gắn sao' : 'Gắn sao'}>{m.is_starred ? '★' : '☆'}</button></td>
                                    <td><div className="lh-who"><Av name={m.full_name} /><div><b>{m.full_name}</b><span className="wm-sub">{m.phone || m.email}</span></div></div></td>
                                    <td><span className="lh-topic">{m.topic}</span>{m.priority === 1 && <span className="lh-flag">Ưu tiên</span>}<p className="lh-prev">{m.message}</p>{m.notes > 0 && <span className="wm-sub">{m.notes} ghi chú, trả lời</span>}</td>
                                    <td><StPill s={m.status} overdue={m.overdue} /></td>
                                    <td>{m.assigned_name || <span className="wm-sub">Chưa giao</span>}</td>
                                    <td title={dt(m.created_at)}>{ago(m.created_at)}</td>
                                </tr>
                            ))}</tbody></table></div>
                        )}
                {d && <Pager page={d.page} pages={d.pages} total={d.total} unit="tin nhắn" onChange={setPage} />}
            </section>
        </>
    );
}