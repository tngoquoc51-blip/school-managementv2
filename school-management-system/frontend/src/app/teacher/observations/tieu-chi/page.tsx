'use client';
// Bộ tiêu chí & chỉ tiêu dự giờ (/teacher/observations/tieu-chi)
import React, { useState } from 'react';
import { Btn, Card, Empty, ErrorBox, Field, Ico, Loading, Modal, Pill, ob, useLoad, useTa } from '../_ob';

type Tpl = { id: number; name: string; description: string | null; is_default: boolean; status: 'active' | 'archived'; criteria: number; used: number };
type TplRes = { data: Tpl[]; settings: { quota_observe: number; quota_taught: number }; is_admin: boolean };
type C = { id: number; group: string; name: string; hint: string | null; weight: number };
type Detail = { data: Omit<Tpl, 'criteria' | 'used'>; criteria: C[] };

function Viewer({ id, admin, onClose, onChange }: { id: number; admin: boolean; onClose: () => void; onChange: () => void }) {
    const { toast, refresh } = useTa(); const { data, err, loading, reload } = useLoad(() => ob<Detail>(`templates/${id}`), [id]);
    const [edit, setEdit] = useState(false);
    return (
        <Modal wide title={data?.data.name || 'Bộ phiếu'} onClose={onClose} foot={admin && data && !edit ? <>{!data.data.is_default && data.data.status === 'active' && <Btn onClick={async () => { try { const r = await ob<{ message: string }>(`templates/${id}/default`, { method: 'POST' }); toast(r.message); refresh(); onChange(); reload(); } catch (e) { toast((e as Error).message, 'err'); } }}><Ico n="flag" size={15} />Đặt làm mặc định</Btn>}<Btn tone="primary" onClick={() => setEdit(true)}><Ico n="edit" size={15} />Chỉnh sửa</Btn></> : undefined}>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Lỗi'} retry={reload} /> : edit ? <Editor init={data} onCancel={() => setEdit(false)} onDone={() => { onChange(); reload(); setEdit(false); }} /> : <Read d={data} />}
        </Modal>
    );
}
function Read({ d }: { d: Detail }) {
    const gs: { g: string; items: C[] }[] = []; d.criteria.forEach((c) => { const l = gs[gs.length - 1]; if (l && l.g === c.group) l.items.push(c); else gs.push({ g: c.group, items: [c] }); });
    return <>{d.data.description && <p className="ta-mute" style={{ marginBottom: 12 }}>{d.data.description}</p>}{gs.map((g) => <div key={g.g} className="ob-grp"><h4><span>{g.g}</span></h4>{g.items.map((c) => <div key={c.id} className="ob-top"><div style={{ flex: 1 }}><b>{c.name}</b>{c.hint && <small className="ta-mute" style={{ display: 'block' }}>{c.hint}</small>}</div>{c.weight !== 1 && <Pill tone="violet">×{c.weight}</Pill>}</div>)}</div>)}<p className="ta-mute">Thang điểm mỗi tiêu chí 1–4. Xếp loại: ≥85% Tốt · ≥70% Khá · ≥50% Đạt · còn lại Chưa đạt.</p></>;
}

function Editor({ init, seed, onCancel, onDone }: { init?: Detail; seed?: Detail; onCancel: () => void; onDone: (id?: number) => void }) {
    const { toast, refresh } = useTa();
    const base = init || seed; const [name, setName] = useState(base?.data.name || ''); const [desc, setDesc] = useState(base?.data.description || ''); const [status, setStatus] = useState<'active' | 'archived'>(init?.data.status || 'active');
    const [rows, setRows] = useState<C[]>(base?.criteria.length ? base.criteria : [{ id: 0, group: 'Chuẩn bị', name: '', hint: '', weight: 1 }, { id: 0, group: 'Chuẩn bị', name: '', hint: '', weight: 1 }, { id: 0, group: 'Chuẩn bị', name: '', hint: '', weight: 1 }]);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const up = (i: number, p: Partial<C>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
    const mv = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= rows.length) return; const a = [...rows]; [a[i], a[j]] = [a[j], a[i]]; setRows(a); };
    const groups = Array.from(new Set(rows.map((r) => r.group).filter(Boolean)));
    const save = async () => {
        setBusy(true); setErr('');
        try { const r = await ob<{ id: number; message: string }>(init ? `templates/${init.data.id}` : 'templates', { method: init ? 'PUT' : 'POST', body: { name, description: desc, status, criteria: rows } }); toast(r.message); refresh(); onDone(r.id); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <>
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr' }}>
                <Field label="Tên bộ phiếu *"><input value={name} maxLength={160} onChange={(e) => setName(e.target.value)} /></Field>
                {init && !init.data.is_default ? <Field label="Trạng thái"><select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}><option value="active">Đang dùng</option><option value="archived">Lưu trữ</option></select></Field> : <span />}
            </div>
            <Field label="Mô tả"><input value={desc} maxLength={400} onChange={(e) => setDesc(e.target.value)} /></Field>
            <datalist id="ob-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            <div style={{ marginTop: 8 }}>{rows.map((r, i) => (
                <div key={i} className="ob-crow">
                    <input list="ob-groups" placeholder="Nhóm" value={r.group} maxLength={140} onChange={(e) => up(i, { group: e.target.value })} />
                    <input placeholder="Nội dung tiêu chí *" value={r.name} maxLength={300} onChange={(e) => up(i, { name: e.target.value })} />
                    <input placeholder="Gợi ý quan sát" value={r.hint || ''} maxLength={300} onChange={(e) => up(i, { hint: e.target.value })} />
                    <input type="number" step="0.5" min={0.5} max={5} title="Trọng số" value={r.weight} onChange={(e) => up(i, { weight: Number(e.target.value) })} style={{ width: 70 }} />
                    <span style={{ display: 'flex' }}><Btn size="sm" tone="ghost" aria-label="Lên" onClick={() => mv(i, -1)}>↑</Btn><Btn size="sm" tone="ghost" aria-label="Xuống" onClick={() => mv(i, 1)}>↓</Btn><Btn size="sm" tone="ghost" aria-label="Xóa" onClick={() => setRows(rows.filter((_, k) => k !== i))}><Ico n="trash" size={14} /></Btn></span>
                </div>))}</div>
            <Btn size="sm" onClick={() => setRows([...rows, { id: 0, group: rows[rows.length - 1]?.group || '', name: '', hint: '', weight: 1 }])}><Ico n="plus" size={14} />Thêm tiêu chí</Btn>
            <p className="ta-mute" style={{ marginTop: 8 }}>Tiêu chí bị xóa chỉ bị ẩn đi, điểm các phiếu cũ vẫn được giữ nguyên.</p>
            {err && <p className="ta-ferr">{err}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn onClick={onCancel}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={save}>Lưu bộ phiếu</Btn></div>
        </>
    );
}

function Quota({ s, onSaved }: { s: { quota_observe: number; quota_taught: number }; onSaved: () => void }) {
    const { toast, refresh } = useTa(); const [a, setA] = useState(String(s.quota_observe)); const [b, setB] = useState(String(s.quota_taught)); const [busy, setBusy] = useState(false);
    return (
        <Card title="Chỉ tiêu dự giờ mỗi năm học" sub="Áp dụng cho toàn trường, dùng để cảnh báo ở Tổng quan và Báo cáo">
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr auto', alignItems: 'end' }}>
                <Field label="Số tiết phải dự (người dự)"><input type="number" min={0} max={200} value={a} onChange={(e) => setA(e.target.value)} /></Field>
                <Field label="Số tiết được dự (người dạy)"><input type="number" min={0} max={200} value={b} onChange={(e) => setB(e.target.value)} /></Field>
                <Btn tone="primary" busy={busy} onClick={async () => { setBusy(true); try { const r = await ob<{ message: string }>('settings', { method: 'PUT', body: { quota_observe: Number(a), quota_taught: Number(b) } }); toast(r.message); refresh(); onSaved(); } catch (e) { toast((e as Error).message, 'err'); } setBusy(false); }}>Lưu</Btn>
            </div>
        </Card>
    );
}

export default function Page() {
    const { toast } = useTa(); const { data, err, loading, reload } = useLoad(() => ob<TplRes>('templates'), []);
    const [view, setView] = useState<number | null>(null); const [create, setCreate] = useState(false); const [dup, setDup] = useState<Tpl | null>(null); const [dupInit, setDupInit] = useState<Detail | undefined>();
    if (loading && !data) return <div className="ta-page"><Loading /></div>; if (err || !data) return <div className="ta-page"><ErrorBox msg={err || 'Lỗi'} retry={reload} /></div>;
    const admin = data.is_admin;
    const copy = async (t: Tpl) => { try { const d = await ob<Detail>(`templates/${t.id}`); setDupInit({ data: { ...d.data, id: 0, name: d.data.name + ' (bản sao)', is_default: false }, criteria: d.criteria.map((c) => ({ ...c, id: 0 })) }); setDup(t); } catch (e) { toast((e as Error).message, 'err'); } };
    return (
        <div className="ta-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <p className="ta-mute" style={{ maxWidth: 640 }}>Bộ tiêu chí dùng để chấm phiếu dự giờ. Mỗi tiêu chí chấm 1–4 điểm, có thể có trọng số. {admin ? 'Bạn có quyền tạo và chỉnh sửa.' : 'Chỉ giáo vụ / Ban giám hiệu chỉnh sửa được.'}</p>
                {admin && <Btn tone="primary" onClick={() => setCreate(true)}><Ico n="plus" size={15} />Bộ phiếu mới</Btn>}
            </div>
            {data.data.length === 0 ? <Card><Empty icon="list" title="Chưa có bộ phiếu" /></Card> : (
                <div className="ob-tpls">{data.data.map((t) => (
                    <div key={t.id} className="ob-tpl">
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{t.is_default && <Pill tone="green" dot>Mặc định</Pill>}{t.status === 'archived' && <Pill tone="slate">Lưu trữ</Pill>}</div>
                        <h4>{t.name}</h4><p className="ta-mute">{t.description || 'Không có mô tả'}</p>
                        <p className="ta-mute"><b>{t.criteria}</b> tiêu chí · dùng trong <b>{t.used}</b> phiếu</p>
                        <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}><Btn size="sm" onClick={() => setView(t.id)}><Ico n="eye" size={14} />{admin ? 'Xem / sửa' : 'Xem'}</Btn>{admin && <Btn size="sm" tone="ghost" onClick={() => copy(t)}><Ico n="copy" size={14} />Nhân bản</Btn>}</div>
                    </div>))}</div>)}
            {admin && <Quota s={data.settings} onSaved={reload} />}
            {!admin && <Card title="Chỉ tiêu của trường"><p>Mỗi năm học: dự giờ <b>{data.settings.quota_observe}</b> tiết, được dự giờ <b>{data.settings.quota_taught}</b> tiết.</p></Card>}
            {view !== null && <Viewer id={view} admin={admin} onClose={() => setView(null)} onChange={reload} />}
            {create && <Modal wide title="Bộ phiếu mới" onClose={() => setCreate(false)}><Editor onCancel={() => setCreate(false)} onDone={() => { setCreate(false); reload(); }} /></Modal>}
            {dup && dupInit && <Modal wide title="Nhân bản bộ phiếu" onClose={() => setDup(null)}><Editor seed={dupInit} onCancel={() => setDup(null)} onDone={() => { setDup(null); reload(); }} key={dup.id} /></Modal>}
        </div>
    );
}