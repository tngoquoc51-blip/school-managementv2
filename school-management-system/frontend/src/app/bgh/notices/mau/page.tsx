'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import {
    ApiError, Btn, CAT_ICON, CAT_TONE, Confirm, Empty, ErrorBox, Field, Ico, Loading, Modal, PRIORITY, Pill, Seg, nt, useLoad, useNt,
} from '../_nt';

type Tpl = { id: number; name: string; category: string; category_label: string; priority: string; title: string; body: string; uses: number; created_by_name: string };
const BLANK = { name: '', category: 'general', priority: 'normal', title: '', body: '' };

export default function Templates() {
    const { meta, toast, refresh } = useNt();
    const { data, err, loading, reload } = useLoad(async () => (await nt<Tpl[]>('templates')).data);
    const [edit, setEdit] = useState<(typeof BLANK & { id?: number }) | null>(null);
    const [del, setDel] = useState<Tpl | null>(null);
    const [q, setQ] = useState('');
    const list = (data ?? []).filter((t) => !q || (t.name + t.title + t.body).toLowerCase().includes(q.toLowerCase()));

    return (
        <div className="nt-page">
            <div className="nt-ptitle">
                <div><h2>Mẫu thông báo</h2><p>Lưu các thông báo thường dùng (nghỉ lễ, họp phụ huynh, lịch thi…) để soạn nhanh chỉ với một cú bấm.</p></div>
                <div className="acts"><Btn tone="primary" onClick={() => setEdit({ ...BLANK })}><Ico n="plus" size={16} />Tạo mẫu mới</Btn></div>
            </div>
            <div className="nt-filters"><label className="nt-search"><Ico n="search" size={16} /><input placeholder="Tìm mẫu…" value={q} onChange={(e) => setQ(e.target.value)} /></label></div>

            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : list.length === 0 ? <Empty icon="tpl" title="Không có mẫu nào" text="Tạo mẫu mới hoặc chạy lại file SQL để nạp các mẫu có sẵn." /> : (
                <div className="nt-tplgrid">
                    {list.map((t) => (
                        <article key={t.id} className="nt-tpl">
                            <header><span className={`ic t-${CAT_TONE[t.category] || 'indigo'}`}><Ico n={CAT_ICON[t.category] || 'bell'} size={19} /></span>
                                <div><h3>{t.name}</h3><small>{t.category_label}{t.uses ? ` · dùng ${t.uses} lần` : ''}</small></div>
                                {t.priority !== 'normal' && <Pill tone={PRIORITY[t.priority]?.tone}>{PRIORITY[t.priority]?.label}</Pill>}</header>
                            <b className="tt">{t.title}</b>
                            <p>{t.body}</p>
                            <footer>
                                <Link className="nt-btn primary sm" href={`/bgh/notices/soan?tpl=${t.id}`}><Ico n="pen" size={14} />Dùng mẫu</Link>
                                <Btn size="sm" onClick={() => setEdit({ id: t.id, name: t.name, category: t.category, priority: t.priority, title: t.title, body: t.body })}><Ico n="edit" size={14} />Sửa</Btn>
                                <Btn size="sm" tone="ghost" onClick={() => setDel(t)} aria-label="Xóa mẫu"><Ico n="trash" size={14} /></Btn>
                            </footer>
                        </article>
                    ))}
                </div>
            )}

            {edit && <TplForm init={edit} categories={meta?.categories ?? []} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); toast(m); refresh(); reload(); }} />}
            {del && <Confirm title="Xóa mẫu?" tone="danger" okText="Xóa mẫu" text={<>Xóa mẫu <b>“{del.name}”</b>? Các thông báo đã soạn từ mẫu này không bị ảnh hưởng.</>}
                             onOk={async () => { await nt(`templates/${del.id}`, { method: 'DELETE' }); setDel(null); toast('Đã xóa mẫu.'); reload(); }} onClose={() => setDel(null)} />}
        </div>
    );
}

function TplForm({ init, categories, onClose, onSaved }: { init: typeof BLANK & { id?: number }; categories: { key: string; label: string }[]; onClose: () => void; onSaved: (m: string) => void }) {
    const [f, setF] = useState(init); const [errs, setErrs] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
    const save = async () => {
        setBusy(true); setErrs({}); setMsg('');
        try {
            const r = f.id ? await nt(`templates/${f.id}`, { method: 'PUT', body: f }) : await nt('templates', { method: 'POST', body: f });
            onSaved(r.message || 'Đã lưu mẫu.');
        } catch (e) { const er = e as ApiError; setErrs(er.errors || {}); setMsg(er.errors ? '' : er.message); setBusy(false); }
    };
    return (
        <Modal title={f.id ? 'Sửa mẫu thông báo' : 'Tạo mẫu thông báo'} wide onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={save}>Lưu mẫu</Btn></>}>
            <Field label="Tên mẫu (chỉ để bạn tìm kiếm)" error={errs.name}><input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="VD: Thông báo nghỉ lễ" /></Field>
            <div className="nt-two">
                <Field label="Danh mục"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
                <div><div className="nt-lab">Mức độ</div><Seg value={f.priority} onChange={(v) => setF({ ...f, priority: v })} items={[['normal', 'Thường'], ['high', 'Quan trọng'], ['urgent', 'Khẩn']]} /></div>
            </div>
            <Field label="Tiêu đề thông báo" error={errs.title}><input value={f.title} maxLength={150} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            <Field label="Nội dung" error={errs.body} hint="Dùng [dấu ngoặc vuông] cho phần cần điền khi soạn."><textarea rows={10} value={f.body} maxLength={8000} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
            {msg && <p className="nt-ferr">{msg}</p>}
        </Modal>
    );
}