'use client';

import { useEffect, useState } from 'react';
import { errMsg, rewardsApi } from '@/modules/bgh/rewards/rewardsService';
import type { AwardType, ViewProps } from '@/modules/bgh/rewards/types';
import { Empty, fmt, Icon, Modal, Skeleton, useUI } from '../ui';

const TARGET: Record<string, string> = { class: 'Tập thể lớp', student: 'Học sinh', both: 'Lớp & học sinh' };
const blank = { code: '', name: '', level: 'Trường', target_type: 'class', bonus_points: '5', description: '', sort_order: '0' };

/** Danh mục danh hiệu khen thưởng + điểm thưởng thi đua mặc định */
export default function AwardTypes({ meta, rev, changed }: ViewProps) {
    const { toast, confirm } = useUI();
    const [list, setList] = useState<AwardType[] | null>(null);
    const [err, setErr] = useState('');
    const [edit, setEdit] = useState<{ id?: number; form: typeof blank } | null>(null);
    const [busy, setBusy] = useState(false);
    const canEdit = meta.can.review;

    useEffect(() => { rewardsApi.awardTypes().then(setList).catch((e) => setErr(errMsg(e))); }, [rev]);

    const open = (t?: AwardType) => setEdit(t
        ? { id: t.id, form: { code: t.code, name: t.name, level: t.level, target_type: t.target_type, bonus_points: String(Number(t.bonus_points)), description: t.description || '', sort_order: String(t.sort_order || 0) } }
        : { form: blank });
    const set = (k: string, v: string) => setEdit((x) => x && { ...x, form: { ...x.form, [k]: v } });

    const save = async () => {
        if (!edit || busy) return;
        setBusy(true);
        try {
            const f = edit.form;
            const r = await rewardsApi.saveAwardType({ ...f, bonus_points: Number(f.bonus_points) || 0, sort_order: Number(f.sort_order) || 0 }, edit.id);
            toast('success', edit.id ? 'Đã cập nhật danh hiệu' : 'Đã thêm danh hiệu', r.message);
            setEdit(null); changed();
        } catch (e) { toast('error', 'Không thể lưu danh hiệu', errMsg(e)); }
        setBusy(false);
    };

    const toggle = async (t: AwardType) => {
        try { const r: any = await rewardsApi.toggleAwardType(t.id); toast('info', r.message, t.name); changed(); }
        catch (e) { toast('error', 'Không thể đổi trạng thái', errMsg(e)); }
    };

    const remove = async (t: AwardType) => {
        if (!(await confirm({ title: 'Xóa danh hiệu?', danger: true, ok: 'Xóa', msg: `Danh hiệu "${t.name}" sẽ bị xóa vĩnh viễn.` }))) return;
        try { await rewardsApi.delAwardType(t.id); toast('success', 'Đã xóa danh hiệu', t.name); changed(); }
        catch (e) { toast('error', 'Không thể xóa', errMsg(e)); }
    };

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!list) return <Skeleton h={360} />;

    return (
        <div className="rw-stack">
            <div className="row">
                <div><b style={{ fontSize: 15 }}>Danh hiệu khen thưởng</b><div className="hint">{list.length} danh hiệu · {list.filter((t) => t.is_active).length} đang áp dụng{!canEdit && ' · Chỉ Ban Giám hiệu được chỉnh sửa'}</div></div>
                <span className="spacer" />
                {canEdit && <button className="btn primary" onClick={() => open()}><Icon n="plus" s={16} />Thêm danh hiệu</button>}
            </div>

            {!list.length ? <div className="panel"><Empty icon="award" text="Chưa có danh hiệu nào." /></div> : (
                <div className="panel" style={{ overflow: 'auto' }}>
                    <table className="tbl">
                        <thead><tr><th>Mã</th><th>Danh hiệu</th><th>Đối tượng</th><th>Cấp</th><th className="num">Điểm thưởng</th><th>Đã dùng</th>{canEdit && <th />}</tr></thead>
                        <tbody>
                        {list.map((t) => (
                            <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.55 }}>
                                <td><span className="badge info">{t.code}</span></td>
                                <td><b>{t.name}</b>{t.description && <div className="hint">{t.description}</div>}</td>
                                <td>{TARGET[t.target_type]}</td>
                                <td>{t.level}</td>
                                <td className="num">{Number(t.bonus_points) > 0 ? <span className="badge good">+{fmt(t.bonus_points, 0)} điểm</span> : <span className="muted">—</span>}</td>
                                <td className="muted">{t.used || 0} lượt</td>
                                {canEdit && (
                                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        <button className={`toggle${t.is_active ? ' on' : ''}`} onClick={() => toggle(t)} aria-label={t.is_active ? 'Đang áp dụng' : 'Đã ngừng'} title={t.is_active ? 'Đang áp dụng' : 'Đã ngừng'} />{' '}
                                        <button className="icon-btn" title="Sửa" onClick={() => open(t)}><Icon n="edit" s={16} /></button>
                                        <button className="icon-btn" title="Xóa" onClick={() => remove(t)}><Icon n="trash" s={16} /></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {edit && (
                <Modal title={edit.id ? 'Sửa danh hiệu' : 'Thêm danh hiệu khen thưởng'} small onClose={() => setEdit(null)}
                       footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Hủy</button><button className="btn primary" disabled={busy || !edit.form.code || !edit.form.name} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu danh hiệu'}</button></>}>
                    <div className="grid2">
                        <label className="fld">Mã<input value={edit.form.code} maxLength={12} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="TT11" /></label>
                        <label className="fld">Thứ tự<input type="number" value={edit.form.sort_order} onChange={(e) => set('sort_order', e.target.value)} /></label>
                    </div>
                    <label className="fld">Tên danh hiệu<input value={edit.form.name} onChange={(e) => set('name', e.target.value)} /></label>
                    <div className="grid2">
                        <label className="fld">Đối tượng<select value={edit.form.target_type} onChange={(e) => set('target_type', e.target.value)}>{Object.entries(TARGET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                        <label className="fld">Cấp<select value={edit.form.level} onChange={(e) => set('level', e.target.value)}>{['Lớp', 'Khối', 'Trường', 'Cấp trên'].map((x) => <option key={x}>{x}</option>)}</select></label>
                    </div>
                    {edit.form.target_type !== 'student' && (
                        <label className="fld">Điểm thưởng thi đua cộng cho lớp khi được duyệt<input type="number" min="0" max="50" step="0.5" value={edit.form.bonus_points} onChange={(e) => set('bonus_points', e.target.value)} /></label>
                    )}
                    <label className="fld">Mô tả<textarea value={edit.form.description} onChange={(e) => set('description', e.target.value)} /></label>
                </Modal>
            )}
        </div>
    );
}