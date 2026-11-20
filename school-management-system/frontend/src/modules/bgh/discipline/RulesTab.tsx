'use client';
import { useCallback, useEffect, useState } from 'react';
import { ACTIONS, GROUPS, SEVERITY, actionLabel } from './constants';
import { disciplineService, errMsg } from './disciplineService';
import type { Category, Settings, TabProps } from './types';
import { Badge, Empty, Field, Icon, Modal, Sev, SkelRows, useUI } from './ui';

const blank: Partial<Category> = { code: '', name: '', group_name: 'Nề nếp', severity: 1, points: 2, suggested_action: 'nhac_nho', is_active: 1 };

export default function RulesTab({ meta, refresh }: TabProps) {
    const { toast, confirm } = useUI();
    const can = meta.permissions.approve;
    const [cats, setCats] = useState<Category[] | null>(null);
    const [edit, setEdit] = useState<Partial<Category> | null>(null);
    const [st, setSt] = useState<Settings>(meta.settings);
    const [group, setGroup] = useState('');

    const load = useCallback(() => disciplineService.categories().then(setCats).catch((e) => toast('error', 'Không tải được danh mục', errMsg(e))), []);
    useEffect(() => { load(); }, [load]);

    const saveCat = async () => {
        try { const r = await disciplineService.saveCategory(edit!); toast('success', r.message); setEdit(null); load(); refresh(); }
        catch (e) { toast('error', 'Không lưu được', errMsg(e)); }
    };
    const del = async (c: Category) => {
        if (!(await confirm({ title: 'Xóa lỗi vi phạm?', text: `“${c.name}”. Nếu đã có biên bản sử dụng, lỗi sẽ chỉ bị ngừng áp dụng.`, okLabel: 'Xóa', tone: 'danger' }))) return;
        try { const r = await disciplineService.deleteCategory(c.id); toast(r.deactivated ? 'warn' : 'success', r.message); load(); refresh(); }
        catch (e) { toast('error', 'Không xóa được', errMsg(e)); }
    };
    const saveSettings = async () => {
        try { const r = await disciplineService.saveSettings(st); toast('success', r.message); refresh(); } catch (e) { toast('error', 'Không lưu được quy chế', errMsg(e)); }
    };
    const num = (k: keyof Settings, label: string, hint?: string) => (
        <Field label={label} hint={hint}><input type="number" className="dc-input" disabled={!can} value={st[k]} onChange={(e) => setSt({ ...st, [k]: Number(e.target.value) })} /></Field>);

    return (
        <div className="dc-stack">
            <section className="dc-card">
                <div className="dc-card-h"><h3>Quy chế điểm rèn luyện</h3>{can && <button className="dc-btn sm primary" onClick={saveSettings}>Lưu quy chế</button>}</div>
                <div className="dc-card-b dc-grid3">
                    {num('base_score', 'Điểm ban đầu mỗi học kỳ')}{num('tot_min', 'Loại Tốt: từ … điểm')}{num('kha_min', 'Loại Khá: từ … điểm')}
                    {num('dat_min', 'Loại Đạt: từ … điểm', 'Dưới mức này là Chưa đạt')}{num('warn_score', 'Ngưỡng cảnh báo', 'Dưới mức này vào danh sách cần quan tâm')}
                    {num('appeal_days', 'Hạn khiếu nại (ngày)')}{num('repeat_count', 'Tái phạm: số lần')}{num('repeat_days', 'Trong vòng (ngày)')}
                </div>
            </section>

            <section className="dc-card">
                <div className="dc-card-h"><h3>Danh mục lỗi vi phạm</h3>
                    <select className="dc-select inline" value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Tất cả nhóm</option>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select>
                    {can && <button className="dc-btn sm primary" onClick={() => setEdit({ ...blank })}><Icon n="plus" />Thêm lỗi</button>}</div>
                {!cats ? <SkelRows /> : !cats.length ? <Empty text="Chưa có danh mục" /> : (
                    <div className="dc-table-wrap"><table className="dc-table">
                        <thead><tr><th>Mã</th><th>Lỗi vi phạm</th><th>Nhóm</th><th>Mức độ</th><th className="num">Điểm trừ</th><th>Xử lý đề xuất</th><th>Đã dùng</th><th /></tr></thead>
                        <tbody>{cats.filter((c) => !group || c.group_name === group).map((c) => (
                            <tr key={c.id} style={{ opacity: c.is_active ? 1 : .5 }}>
                                <td style={{ fontWeight: 600 }}>{c.code}</td><td>{c.name}{!c.is_active && <Badge tone="mute"> Ngừng</Badge>}</td><td>{c.group_name}</td>
                                <td><Sev n={c.severity} /> {SEVERITY[c.severity]}</td><td className="num" style={{ color: 'var(--bad)', fontWeight: 600 }}>-{c.points}</td>
                                <td>{actionLabel(c.suggested_action)}</td><td>{c.used_count}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>{can && <><button className="dc-x" onClick={() => setEdit(c)} aria-label="Sửa"><Icon n="edit" /></button><button className="dc-x" onClick={() => del(c)} aria-label="Xóa"><Icon n="trash" /></button></>}</td>
                            </tr>))}</tbody></table></div>)}
            </section>

            {edit && (
                <Modal title={edit.id ? 'Sửa lỗi vi phạm' : 'Thêm lỗi vi phạm'} onClose={() => setEdit(null)} footer={<>
                    <button className="dc-btn" onClick={() => setEdit(null)}>Hủy</button>
                    <button className="dc-btn primary" disabled={!edit.code || !edit.name} onClick={saveCat}>Lưu</button></>}>
                    <div className="dc-grid2">
                        <Field label="Mã lỗi *"><input className="dc-input" value={edit.code ?? ''} maxLength={16} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
                        <Field label="Nhóm"><select className="dc-select" value={edit.group_name} onChange={(e) => setEdit({ ...edit, group_name: e.target.value })}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></Field>
                    </div>
                    <Field label="Tên lỗi vi phạm *"><input className="dc-input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                    <div className="dc-grid3">
                        <Field label="Mức độ"><select className="dc-select" value={edit.severity} onChange={(e) => setEdit({ ...edit, severity: Number(e.target.value) })}>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                        <Field label="Điểm trừ"><input type="number" min={0} max={100} className="dc-input" value={edit.points} onChange={(e) => setEdit({ ...edit, points: Number(e.target.value) })} /></Field>
                        <Field label="Xử lý đề xuất"><select className="dc-select" value={edit.suggested_action ?? ''} onChange={(e) => setEdit({ ...edit, suggested_action: e.target.value || null })}><option value="">—</option>{ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></Field>
                    </div>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={!!edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked ? 1 : 0 })} /> Đang áp dụng</label>
                </Modal>
            )}
        </div>
    );
}