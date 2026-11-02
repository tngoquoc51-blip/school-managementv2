'use client';
import { useState } from 'react';
import { api, qs } from '../../_lib/api';
import { Field, Modal, Pager, dd, useDebounced, useList, useToast } from '../_wm';

type Form = { id?: number; kind: string; category: string; title: string; summary: string; body: string; tone: string; cover: string; event_date: string; event_place: string; is_published: boolean; is_featured: boolean; published_at: string };
const today = () => new Date().toISOString().slice(0, 10);
const blank = (): Form => ({ kind: 'news', category: 'Thông báo', title: '', summary: '', body: '', tone: 'a', cover: '', event_date: '', event_place: '', is_published: true, is_featured: false, published_at: today() });

export default function NewsAdminPage() {
    const [kind, setKind] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const dq = useDebounced(q);
    const sum = useList<any>('website/summary');
    const list = useList<any>(`website/news${qs({ kind, q: dq, page })}`);
    const [f, setF] = useState<Form | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [top, setTop] = useState('');
    const [busy, setBusy] = useState(false);
    const toast = useToast();
    const cats: string[] = list.data?.categories ?? ['Thông báo', 'Tuyển sinh', 'Hoạt động', 'Học tập', 'Sự kiện', 'Khác'];
    const set = (k: keyof Form, v: any) => setF((x) => (x ? { ...x, [k]: v } : x));

    async function edit(id: number) {
        try {
            const r = await api<any>(`website/news/${id}`);
            setErrs({}); setTop('');
            setF({ id: r.id, kind: r.kind, category: r.category, title: r.title, summary: r.summary, body: (r.body || '').replace(/\\n/g, '\n'), tone: r.tone, cover: r.cover || '', event_date: r.event_date ? String(r.event_date).slice(0, 10) : '', event_place: r.event_place || '', is_published: !!r.is_published, is_featured: !!r.is_featured, published_at: String(r.published_at).slice(0, 10) });
        } catch (e: any) { toast.fail(e.message); }
    }
    async function save() {
        if (!f) return;
        setBusy(true); setErrs({}); setTop('');
        try {
            const body = { ...f };
            if (f.id) await api(`website/news/${f.id}`, { method: 'PUT', body }); else await api('website/news', { method: 'POST', body });
            toast.ok(f.id ? 'Đã lưu bài viết.' : 'Đã đăng bài.'); setF(null); list.reload(); sum.reload();
        } catch (e: any) { setErrs(e.errors || {}); setTop(e.message); } finally { setBusy(false); }
    }
    async function toggle(id: number, field: string) {
        try { await api(`website/news/${id}/toggle`, { method: 'POST', body: { field } }); list.reload(); sum.reload(); } catch (e: any) { toast.fail(e.message); }
    }
    async function remove(r: any) {
        if (!confirm(`Xóa bài “${r.title}”? Không thể khôi phục.`)) return;
        try { await api(`website/news/${r.id}`, { method: 'DELETE' }); toast.ok('Đã xóa bài viết.'); list.reload(); sum.reload(); } catch (e: any) { toast.fail(e.message); }
    }
    const n = sum.data?.news;
    return (
        <div className="wm">
            {toast.node}
            <div className="wm-head">
                <div><h1>Tin tức và sự kiện</h1><p>Bài đăng hiển thị ở trang Tin tức của website. Bài ẩn hoặc hẹn ngày đăng ở tương lai sẽ chưa hiện ra ngoài.</p></div>
                <div className="wm-act"><button className="wm-btn" onClick={() => { setErrs({}); setTop(''); setF(blank()); }}>+ Đăng bài mới</button></div>
            </div>
            <div className="wm-stats">
                <button className={`wm-stat ${kind === '' ? 'on' : ''}`} onClick={() => { setKind(''); setPage(1); }}><span>Tất cả bài</span><b>{n?.total ?? '…'}</b></button>
                <button className="wm-stat" style={{ cursor: 'default' }}><span>Đang hiển thị</span><b>{n?.published ?? '…'}</b></button>
                <button className={`wm-stat ${kind === 'news' ? 'on' : ''}`} onClick={() => { setKind('news'); setPage(1); }}><span>Chỉ tin tức</span><b>›</b></button>
                <button className={`wm-stat ${kind === 'event' ? 'on' : ''}`} onClick={() => { setKind('event'); setPage(1); }}><span>Chỉ sự kiện</span><b>›</b></button>
            </div>
            <section className="wm-card">
                <div className="wm-bar"><input className="wm-in" placeholder="Tìm theo tiêu đề…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
                {list.err ? <div className="wm-state err">{list.err} <button className="wm-btn sm" onClick={list.reload}>Thử lại</button></div>
                    : list.loading && !list.data ? <div className="wm-state">Đang tải…</div>
                        : !list.data?.items.length ? <div className="wm-state">Chưa có bài viết nào.</div> : (
                            <div className="wm-tw"><table className="wm-table"><thead><tr><th>Tiêu đề</th><th>Loại</th><th>Ngày đăng</th><th>Lượt xem</th><th>Hiển thị</th><th>Nổi bật</th><th /></tr></thead><tbody>
                            {list.data.items.map((r: any) => (
                                <tr key={r.id}>
                                    <td><b>{r.title}</b><span className="wm-sub">{r.category} · /tin-tuc/{r.slug}</span></td>
                                    <td>{r.kind === 'event' ? <>Sự kiện<span className="wm-sub">{dd(r.event_date)}</span></> : 'Tin tức'}</td>
                                    <td>{dd(r.published_at)}</td>
                                    <td>{r.views}</td>
                                    <td><button className={`wm-pill ${r.is_published ? 'on' : 'off'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(r.id, 'is_published')}>{r.is_published ? 'Đang hiện' : 'Đã ẩn'}</button></td>
                                    <td><button className={`wm-pill ${r.is_featured ? 'invited' : 'off'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(r.id, 'is_featured')}>{r.is_featured ? 'Nổi bật' : 'Thường'}</button></td>
                                    <td className="n"><button className="wm-btn sm" onClick={() => edit(r.id)}>Sửa</button> <a className="wm-btn ghost sm" href={`/tin-tuc/${r.slug}`} target="_blank" rel="noopener noreferrer">Xem</a> <button className="wm-btn danger sm" onClick={() => remove(r)}>Xóa</button></td>
                                </tr>
                            ))}</tbody></table></div>
                        )}
                {list.data && <Pager page={list.data.page} pages={list.data.pages} total={list.data.total} unit="bài" onChange={setPage} />}
            </section>

            {f && (
                <Modal title={f.id ? 'Sửa bài viết' : 'Đăng bài mới'} onClose={() => setF(null)} foot={<><button className="wm-btn ghost" onClick={() => setF(null)}>Hủy</button><button className="wm-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : f.id ? 'Lưu thay đổi' : 'Đăng bài'}</button></>}>
                    {top && <p className="wm-state err" style={{ padding: 10, borderRadius: 10, marginBottom: 12 }}>{top}</p>}
                    <div className="wm-row2">
                        <Field label="Loại bài" req err={errs.kind}><select className="wm-sel" value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="news">Tin tức</option><option value="event">Sự kiện</option></select></Field>
                        <Field label="Chuyên mục" req err={errs.category}><select className="wm-sel" value={f.category} onChange={(e) => set('category', e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
                    </div>
                    <Field label="Tiêu đề" req err={errs.title}><input className="wm-in" maxLength={200} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
                    <Field label="Tóm tắt" req err={errs.summary} hint="Hiện ở danh sách tin, 1 đến 2 câu."><textarea className="wm-ta" style={{ minHeight: 70 }} maxLength={400} value={f.summary} onChange={(e) => set('summary', e.target.value)} /></Field>
                    <Field label="Nội dung" req err={errs.body} hint="Mỗi đoạn văn cách nhau một dòng trống."><textarea className="wm-ta" style={{ minHeight: 180 }} value={f.body} onChange={(e) => set('body', e.target.value)} /></Field>
                    {f.kind === 'event' && (
                        <div className="wm-row2">
                            <Field label="Ngày diễn ra" req err={errs.event_date}><input className="wm-in" type="date" value={f.event_date} onChange={(e) => set('event_date', e.target.value)} /></Field>
                            <Field label="Địa điểm" err={errs.event_place}><input className="wm-in" maxLength={120} value={f.event_place} onChange={(e) => set('event_place', e.target.value)} /></Field>
                        </div>
                    )}
                    <Field label="Ảnh bìa" err={errs.cover} hint="Bỏ ảnh vào frontend/public/images/ rồi gõ đường dẫn, ví dụ /images/tin-hop-phu-huynh.jpg. Để trống thì dùng ảnh mặc định theo màu."><input className="wm-in" value={f.cover} onChange={(e) => set('cover', e.target.value)} placeholder="/images/ten-anh.jpg" /></Field>
                    <Field label="Màu nền khi chưa có ảnh"><div className="wm-tones">{['a', 'b', 'c', 'd'].map((t) => <button type="button" key={t} className={`wm-tone ${t} ${f.tone === t ? 'on' : ''}`} onClick={() => set('tone', t)} aria-label={`Màu ${t}`} />)}</div></Field>
                    <div className="wm-row2">
                        <Field label="Ngày đăng" err={errs.published_at} hint="Chọn ngày tương lai để hẹn đăng."><input className="wm-in" type="date" value={f.published_at} onChange={(e) => set('published_at', e.target.value)} /></Field>
                        <div>
                            <label className="wm-chk"><input type="checkbox" checked={f.is_published} onChange={(e) => set('is_published', e.target.checked)} />Hiển thị trên website</label>
                            <label className="wm-chk"><input type="checkbox" checked={f.is_featured} onChange={(e) => set('is_featured', e.target.checked)} />Đặt làm tin nổi bật</label>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}