'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { Criterion, ViewProps } from '@/modules/bgh/rewards/types';
import { CAT_COLOR, Empty, Icon, Modal, num, Skeleton, sgn, useUI } from '../ui';

const blank = { code: '', name: '', category: 'nenep', type: 'minus', default_points: '2', description: '', sort_order: '0' };

export default function Criteria({ meta, rev, changed }: ViewProps) {
    const { toast, confirm } = useUI();
    const [list, setList] = useState<Criterion[] | null>(null);
    const [err, setErr] = useState('');
    const [edit, setEdit] = useState<{ id?: number; form: typeof blank } | null>(null);
    const [busy, setBusy] = useState(false);
    const canEdit = meta.can.review;

    useEffect(() => {
        rewardsApi.criteria().then(setList).catch((e) => setErr(errMsg(e)));
    }, [rev]);

    const open = (c?: Criterion) =>
        setEdit(c ? { id: c.id, form: { code: c.code, name: c.name, category: c.category, type: c.type, default_points: String(Math.abs(num(c.default_points))), description: c.description || '', sort_order: String(c.sort_order || 0) } } : { form: blank });

    const save = async () => {
        if (!edit || busy) return;
        setBusy(true);
        try {
            const res = await rewardsApi.saveCriterion({ ...edit.form, default_points: Number(edit.form.default_points), sort_order: Number(edit.form.sort_order) }, edit.id);
            toast('success', edit.id ? 'Đã cập nhật tiêu chí' : 'Đã thêm tiêu chí', res.message);
            setEdit(null); changed();
        } catch (e) { toast('error', 'Không thể lưu tiêu chí', errMsg(e)); }
        setBusy(false);
    };

    const toggle = async (c: Criterion) => {
        try { const r: any = await rewardsApi.toggleCriterion(c.id); toast('info', r.message, c.name); changed(); }
        catch (e) { toast('error', 'Không thể đổi trạng thái', errMsg(e)); }
    };

    const remove = async (c: Criterion) => {
        if (!(await confirm({ title: 'Xóa tiêu chí?', danger: true, ok: 'Xóa', msg: `Tiêu chí "${c.name}" sẽ bị xóa vĩnh viễn.` }))) return;
        try { await rewardsApi.delCriterion(c.id); toast('success', 'Đã xóa tiêu chí', c.name); changed(); }
        catch (e) { toast('error', 'Không thể xóa', errMsg(e)); }
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!list) return <Skeleton h={360} />;

    const set = (k: string, v: string) => setEdit((x) => x && { ...x, form: { ...x.form, [k]: v } });

    return (
        <div className="rw-stack">
            <div className="row">
                <div><b style={{ fontSize: 15 }}>Bộ tiêu chí thi đua</b><div className="hint">{list.length} tiêu chí · {list.filter((c) => c.is_active).length} đang áp dụng{!canEdit && ' · Chỉ Ban Giám hiệu được chỉnh sửa'}</div></div>
                <span className="spacer" />
                {canEdit && <button className="btn primary" onClick={() => open()}><Icon n="plus" s={16} />Thêm tiêu chí</button>}
            </div>

            {Object.entries(meta.categories).map(([k, label]) => {
                const rows = list.filter((c) => c.category === k);
                if (!rows.length) return null;
                return (
                    <div className="panel" key={k} style={{ overflow: 'auto' }}>
                        <div className="ph"><span style={{ width: 10, height: 10, borderRadius: 3, background: CAT_COLOR[k] }} /><h3>{label}</h3><span className="muted">{rows.length} tiêu chí</span></div>
                        <table className="tbl">
                            <tbody>
                            {rows.map((c) => (
                                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.55 }}>
                                    <td style={{ width: 70 }}><span className="badge info">{c.code}</span></td>
                                    <td><b>{c.name}</b>{c.description && <div className="hint">{c.description}</div>}</td>
                                    <td className={`num ${c.type === 'plus' ? 'good-t' : 'bad-t'}`} style={{ width: 80 }}><b>{sgn(c.default_points)}</b></td>
                                    <td className="muted" style={{ width: 110 }}>{c.used || 0} lượt dùng</td>
                                    {canEdit && (
                                        <td style={{ width: 150, whiteSpace: 'nowrap' }}>
                                            <button className={`toggle${c.is_active ? ' on' : ''}`} onClick={() => toggle(c)} aria-label={c.is_active ? 'Đang áp dụng' : 'Đã ngừng'} title={c.is_active ? 'Đang áp dụng' : 'Đã ngừng'} />{' '}
                                            <button className="icon-btn" title="Sửa" onClick={() => open(c)}><Icon n="edit" s={16} /></button>
                                            <button className="icon-btn" title="Xóa" onClick={() => remove(c)}><Icon n="trash" s={16} /></button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
            {!list.length && <Empty icon="list" text="Chưa có tiêu chí nào." />}

            {edit && (
                <Modal title={edit.id ? 'Sửa tiêu chí' : 'Thêm tiêu chí thi đua'} onClose={() => setEdit(null)} small
                       footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Hủy</button><button className="btn primary" disabled={busy || !edit.form.code || !edit.form.name} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu tiêu chí'}</button></>}>
                    <div className="grid2">
                        <label className="fld">Mã<input value={edit.form.code} maxLength={12} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="NN07" /></label>
                        <label className="fld">Thứ tự<input type="number" value={edit.form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></label>
                    </div>
                    <label className="fld">Tên tiêu chí<input value={edit.form.name} onChange={(e) => set('name', e.target.value)} /></label>
                    <div className="grid2">
                        <label className="fld">Mảng<select value={edit.form.category} onChange={(e) => set('category', e.target.value)}>{Object.entries(meta.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <label className="fld">Loại<select value={edit.form.type} onChange={(e) => set('type', e.target.value)}><option value="plus">Điểm cộng</option><option value="minus">Điểm trừ</option></select></label>
                    </div>
                    <label className="fld">Số điểm mặc định (độ lớn)<input type="number" step="0.5" min="0.5" value={edit.form.default_points} onChange={(e) => set('default_points', e.target.value)} /></label>
                    <label className="fld">Mô tả<textarea value={edit.form.description} onChange={(e) => set('description', e.target.value)} /></label>
                </Modal>
            )}
        </div>
    );
}