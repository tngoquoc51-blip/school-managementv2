'use client';
// Khoản thu – danh mục các khoản thu (/admin/finance/khoan-thu)
import React, { useState } from 'react';
import { Btn, Card, Confirm, Empty, ErrorBox, Field, Ico, Loading, Modal, Pill, Switch, fi, num, useFi, useLoad, useTa, vnd } from '../_fi';

type Item = { id: number; code: string; name: string; category: string; category_label: string; amount: number; unit: string | null; grade: number | null; is_mandatory: boolean; note: string | null; used: number };
const EMPTY = { code: '', name: '', category: 'tuition', amount: '', unit: '', grade: '', is_mandatory: true, note: '' };
const UNITS: Record<string, string> = { year: 'năm', term: 'học kỳ', month: 'tháng', once: 'một lần' };

export default function ItemsPage() {
    const { meta } = useFi(); const { toast } = useTa();
    const { data, err, loading, reload } = useLoad(() => fi<{ data: Item[] }>('items'), []);
    const [edit, setEdit] = useState<Item | 'new' | null>(null); const [del, setDel] = useState<Item | null>(null); const [cat, setCat] = useState('');
    const list = (data?.data || []).filter((i) => !cat || i.category === cat);
    const cats = Object.entries(meta.categories);
    const tones: Record<string, string> = { tuition: 'green', insurance: 'sky', fund: 'amber', service: 'violet', uniform: 'rose', other: 'slate' };

    return (
        <div className="ta-page">
            <div className="ta-filters"><div className="ta-seg" style={{ marginBottom: 0 }}><button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>Tất cả</button>{cats.map(([k, v]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{v}</button>)}</div>
                <span style={{ flex: 1 }} /><Btn tone="primary" onClick={() => setEdit('new')}><Ico n="plus" size={16} />Thêm khoản thu</Btn></div>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : list.length === 0 ? <Card><Empty icon="tpl" title="Chưa có khoản thu nào" action={<Btn tone="primary" onClick={() => setEdit('new')}>Thêm khoản thu đầu tiên</Btn>} /></Card> : (
                <div className="fi-cards">{list.map((i) => (
                    <div key={i.id} className={`fi-card t-${tones[i.category] || 'slate'}`}>
                        <div className="fi-row" style={{ justifyContent: 'space-between' }}><Pill tone={tones[i.category] || 'slate'}>{i.category_label}</Pill>{i.is_mandatory ? <Pill tone="rose">Bắt buộc</Pill> : <Pill tone="slate">Tự nguyện</Pill>}</div>
                        <h4>{i.name}</h4>
                        <div><b style={{ fontSize: 22 }} className="fi-money">{vnd(i.amount)}</b> <span className="ta-mute">/ {UNITS[i.unit || ''] || i.unit || 'lần'}</span></div>
                        <p className="ta-mute">Mã {i.code} · {i.grade ? `Khối ${i.grade}` : 'Mọi khối'} · đã dùng trong {num(i.used)} dòng hóa đơn</p>
                        {i.note && <p>{i.note}</p>}
                        <footer><Btn size="sm" onClick={() => setEdit(i)}><Ico n="edit" size={14} />Sửa</Btn><Btn size="sm" tone="danger" onClick={() => setDel(i)} disabled={i.used > 0}>Xóa</Btn></footer>
                    </div>))}</div>)}
            <p className="ta-mute">Thay đổi đơn giá chỉ áp dụng cho các hóa đơn phát hành sau. Hóa đơn đã phát hành giữ nguyên số tiền. Khoản đã dùng trong hóa đơn không xóa được.</p>
            {edit && <ItemForm item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); toast('Đã lưu khoản thu.'); }} />}
            {del && <Confirm title="Xóa khoản thu?" tone="danger" okText="Xóa" text={<>Khoản thu <b>{del.name}</b> ({del.code}) sẽ bị xóa khỏi danh mục.</>} onClose={() => setDel(null)} onOk={async () => { await fi(`items/${del.id}`, { method: 'DELETE' }); toast('Đã xóa khoản thu.'); setDel(null); reload(); }} />}
        </div>
    );
}

function ItemForm({ item, onClose, onDone }: { item: Item | null; onClose: () => void; onDone: () => void }) {
    const { meta } = useFi();
    const [f, setF] = useState(item ? { code: item.code, name: item.name, category: item.category, amount: String(item.amount), unit: item.unit || '', grade: item.grade ? String(item.grade) : '', is_mandatory: item.is_mandatory, note: item.note || '' } : EMPTY);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const set = (k: keyof typeof EMPTY, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
    const go = async () => {
        setErr('');
        if (!f.code.trim() || !f.name.trim()) { setErr('Hãy nhập mã và tên khoản thu.'); return; }
        const amount = Number(String(f.amount).replace(/\D/g, '')); if (!Number.isFinite(amount)) { setErr('Số tiền không hợp lệ.'); return; }
        setBusy(true);
        try { await fi(item ? `items/${item.id}` : 'items', { method: item ? 'PUT' : 'POST', body: { code: f.code.trim(), name: f.name.trim(), category: f.category, amount, unit: f.unit || null, grade: f.grade ? Number(f.grade) : null, is_mandatory: f.is_mandatory, note: f.note.trim() || null } }); onDone(); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title={item ? 'Sửa khoản thu' : 'Thêm khoản thu'} onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}>Lưu</Btn></>}>
            <div className="fi-twocol">
                <Field label="Mã khoản thu *"><input value={f.code} onChange={(e) => set('code', e.target.value)} maxLength={30} placeholder="HP-HK1" /></Field>
                <Field label="Nhóm *"><select value={f.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(meta.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            <Field label="Tên khoản thu *"><input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={160} placeholder="Học phí học kỳ 1" /></Field>
            <div className="fi-twocol">
                <Field label="Số tiền (đồng) *"><input inputMode="numeric" value={f.amount ? Number(String(f.amount).replace(/\D/g, '')).toLocaleString('vi-VN') : ''} onChange={(e) => set('amount', e.target.value.replace(/\D/g, ''))} placeholder="3.000.000" /></Field>
                <Field label="Thu theo"><select value={f.unit} onChange={(e) => set('unit', e.target.value)}><option value="">—</option>{Object.entries(UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            </div>
            <Field label="Áp dụng cho"><select value={f.grade} onChange={(e) => set('grade', e.target.value)}><option value="">Mọi khối</option><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option></select></Field>
            <Field label="Ghi chú"><textarea rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={500} /></Field>
            <Switch on={f.is_mandatory} onChange={(v) => set('is_mandatory', v)} label="Khoản bắt buộc" sub="Tắt nếu là khoản tự nguyện (quỹ, đồng phục…)" />
            {err && <p className="ta-ferr">{err}</p>}
        </Modal>
    );
}