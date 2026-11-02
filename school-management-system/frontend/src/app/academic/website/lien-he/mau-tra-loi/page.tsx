'use client';
import { useState } from 'react';
import { api } from '@/app/academic/_lib/api';
import { Field, Modal, useList, useToast } from '@/app/academic/website/_wm';

type T = { id?: number; title: string; topic: string; body: string; sort_order: number };
const blank = (): T => ({ title: '', topic: '', body: '', sort_order: 0 });

/** Mẫu trả lời: soạn sẵn các câu thường dùng, bấm một nút để chèn vào khi trả lời. */
export default function Templates() {
    const { data: d, err, loading, reload } = useList<any>('website/inbox/templates');
    const [f, setF] = useState<T | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [top, setTop] = useState('');
    const [busy, setBusy] = useState(false);
    const [filter, setFilter] = useState('');
    const toast = useToast();

    async function save() {
        if (!f) return;
        setBusy(true); setErrs({}); setTop('');
        try {
            if (f.id) await api(`website/inbox/templates/${f.id}`, { method: 'PUT', body: f }); else await api('website/inbox/templates', { method: 'POST', body: f });
            toast.ok('Đã lưu mẫu trả lời.'); setF(null); reload();
        } catch (e: any) { setErrs(e.errors || {}); setTop(e.message); } finally { setBusy(false); }
    }
    async function remove(t: any) {
        if (!confirm(`Xóa mẫu “${t.title}”?`)) return;
        try { await api(`website/inbox/templates/${t.id}`, { method: 'DELETE' }); toast.ok('Đã xóa mẫu.'); reload(); } catch (e: any) { toast.fail(e.message); }
    }
    const items = (d?.items ?? []).filter((t: any) => !filter || (filter === '-' ? !t.topic : t.topic === filter));
    return (
        <>
            {toast.node}
            <div className="wm-head" style={{ marginBottom: 14 }}>
                <div><h2 className="lh-h" style={{ margin: 0 }}>Mẫu trả lời</h2><p className="wm-sub">Dùng khi trả lời tin nhắn: bấm tên mẫu để chèn nội dung và chữ ký vào ô soạn thảo. Phần [ngoặc vuông] nhân viên điền thông tin thật.</p></div>
                <div className="wm-act"><button className="wm-btn" onClick={() => { setErrs({}); setTop(''); setF(blank()); }}>+ Thêm mẫu</button></div>
            </div>
            <div className="lh-pills">
                {[['', 'Tất cả'], ['-', 'Dùng chung'], ...(d?.topics ?? []).map((t: string) => [t, t])].map(([k, v]: string[]) => <button key={k || 'all'} className={`lh-pillbtn ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{v}</button>)}
            </div>
            {err ? <div className="wm-state err">{err} <button className="wm-btn sm" onClick={reload}>Thử lại</button></div>
                : loading && !d ? <div className="wm-state">Đang tải…</div>
                    : !items.length ? <div className="wm-card"><div className="wm-state">Chưa có mẫu nào trong mục này.</div></div> : (
                        <div className="lh-tplgrid">
                            {items.map((t: any) => (
                                <article key={t.id} className="wm-card lh-tpl">
                                    <header><h3>{t.title}</h3><span className="lh-topic">{t.topic || 'Dùng chung'}</span></header>
                                    <p>{t.body}</p>
                                    <footer><button className="wm-btn sm" onClick={() => { setErrs({}); setTop(''); setF({ id: t.id, title: t.title, topic: t.topic || '', body: t.body, sort_order: t.sort_order }); }}>Sửa</button><button className="wm-btn danger sm" onClick={() => remove(t)}>Xóa</button></footer>
                                </article>
                            ))}
                        </div>
                    )}
            {d?.signature && <p className="wm-sub" style={{ marginTop: 14 }}>Chữ ký tự chèn kèm mẫu: <b>{d.signature}</b> (đổi ở mục Cài đặt).</p>}

            {f && (
                <Modal title={f.id ? 'Sửa mẫu trả lời' : 'Thêm mẫu trả lời'} onClose={() => setF(null)} foot={<><button className="wm-btn ghost" onClick={() => setF(null)}>Hủy</button><button className="wm-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu mẫu'}</button></>}>
                    {top && <p className="wm-state err" style={{ padding: 10, borderRadius: 10, marginBottom: 12 }}>{top}</p>}
                    <Field label="Tên mẫu" req err={errs.title}><input className="wm-in" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
                    <div className="wm-row2">
                        <Field label="Chủ đề" err={errs.topic} hint="Mẫu cùng chủ đề với tin nhắn sẽ hiện lên đầu."><select className="wm-sel" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}><option value="">Dùng chung</option>{(d?.topics ?? []).map((t: string) => <option key={t}>{t}</option>)}</select></Field>
                        <Field label="Thứ tự hiển thị" hint="Số nhỏ hiện trước."><input className="wm-in" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></Field>
                    </div>
                    <Field label="Nội dung" req err={errs.body} hint={`${f.body.length}/1500 ký tự`}><textarea className="wm-ta" style={{ minHeight: 190 }} maxLength={1500} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
                </Modal>
            )}
        </>
    );
}