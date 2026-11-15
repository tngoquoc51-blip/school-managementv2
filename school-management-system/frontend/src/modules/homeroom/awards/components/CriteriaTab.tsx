'use client';

import { useState } from 'react';
import { emuApi, errMsg } from '../awardsService';
import type { Criterion, Ctx } from '../types';
import { cx, levelLabel, signed } from '../utils';
import Icon from './icons';
import { Modal } from './Overlay';
import { useToast } from './Toast';
import { CatIcon, Field, Points } from './ui';

export default function CriteriaTab({ ctx, reloadMeta }: { ctx: Ctx; reloadMeta: () => void }) {
    const { meta, scope } = ctx;
    const toast = useToast();
    const canEdit = meta.actor.can_edit_criteria;
    const [edit, setEdit] = useState<Partial<Criterion> | null>(null);
    const [saving, setSaving] = useState(false);

    const byCat: Record<string, Criterion[]> = {};
    meta.criteria.forEach((c) => (byCat[c.category] ||= []).push(c));

    const save = async () => {
        if (!edit?.name?.trim() || !edit.points) { toast.warning('Thiếu thông tin', 'Nhập tên tiêu chí và số điểm khác 0.'); return; }
        setSaving(true);
        try {
            await emuApi.saveCriterion(scope, edit.id ?? null, { name: edit.name.trim(), category: edit.category ?? 'study', points: Number(edit.points), is_active: edit.is_active !== false && edit.is_active !== 0 });
            toast.success('Đã lưu tiêu chí'); setEdit(null); reloadMeta();
        } catch (e) { toast.error('Không lưu được', errMsg(e)); }
        finally { setSaving(false); }
    };

    const toggle = async (c: Criterion) => {
        try {
            await emuApi.saveCriterion(scope, c.id, { name: c.name, category: c.category, points: c.points, is_active: !c.is_active });
            toast.info(c.is_active ? 'Đã ngừng sử dụng tiêu chí' : 'Đã bật lại tiêu chí', c.name); reloadMeta();
        } catch (e) { toast.error('Không cập nhật được', errMsg(e)); }
    };

    return (
        <div className="emu-page">
            <div className="emu-grid emu-g-21">
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Tiêu chí thi đua</h3><span className="emu-sub">{meta.criteria.length} tiêu chí</span><span className="emu-spacer" />
                        {canEdit ? <button className="emu-btn primary sm" onClick={() => setEdit({ category: 'study', points: 2, is_active: true })}><Icon name="plus" size={14} /> Thêm tiêu chí</button> : <span className="emu-badge">Chỉ xem · do Giáo vụ/BGH quản lý</span>}
                    </div>
                    <div className="emu-card-b emu-col" style={{ gap: 18 }}>
                        {Object.entries(byCat).map(([cat, list]) => (
                            <div key={cat}>
                                <div className="emu-row" style={{ marginBottom: 6 }}><CatIcon cat={cat} size={28} /><b>{meta.categories[cat] ?? cat}</b></div>
                                <table className="emu-table"><tbody>
                                {list.map((c) => (
                                    <tr key={c.id} style={{ opacity: c.is_active ? 1 : .5 }}>
                                        <td style={{ width: 70 }} className="emu-muted">{c.code}</td><td>{c.name}</td><td className="c" style={{ width: 80 }}><Points value={c.points} /></td>
                                        {canEdit && <td className="r" style={{ width: 150 }}>
                                            <button className="emu-btn ghost sm icon" title="Sửa" onClick={() => setEdit(c)}><Icon name="edit" size={14} /></button>
                                            <button className="emu-btn sm" onClick={() => toggle(c)}>{c.is_active ? 'Ngừng' : 'Bật lại'}</button>
                                        </td>}
                                    </tr>
                                ))}
                                </tbody></table>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="emu-col" style={{ gap: 18 }}>
                    <div className="emu-card"><div className="emu-card-h"><h3>Cách tính điểm</h3></div>
                        <div className="emu-card-b emu-col" style={{ gap: 8 }}>
                            <p className="emu-muted" style={{ margin: 0 }}>Mỗi học sinh bắt đầu với <b style={{ color: 'var(--ink)' }}>{meta.base_score} điểm</b> mỗi kỳ, cộng hoặc trừ theo tiêu chí. Xếp loại:</p>
                            {meta.tiers.map((t, i) => (
                                <div key={t.key} className="emu-row"><i className="emu-dot" style={{ background: t.color }} />{t.label}<span className="emu-spacer" /><b className="emu-num">{i === 0 ? `≥ ${t.min}` : i === meta.tiers.length - 1 ? `< ${meta.tiers[i - 1].min}` : `${t.min} – ${meta.tiers[i - 1].min - 1}`}</b></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="emu-card">
                <div className="emu-card-h"><h3>Danh hiệu & điều kiện tự động gợi ý</h3><span className="emu-sub">Hệ thống đối chiếu điểm thi đua, học lực, hạnh kiểm, chuyên cần</span></div>
                <div className="emu-card-b emu-grid emu-g3">
                    {meta.awards.map((a) => {
                        const rules = [
                            a.min_score != null && `Điểm thi đua ≥ ${a.min_score}`, a.min_gpa != null && `ĐTB ≥ ${a.min_gpa}`,
                            a.allowed_conduct && `Hạnh kiểm: ${a.allowed_conduct.split(',').join(' / ')}`,
                            a.max_unexcused != null && `Nghỉ không phép ≤ ${a.max_unexcused} buổi`, a.min_plus_points != null && `Điểm cộng ≥ ${a.min_plus_points}`,
                        ].filter(Boolean) as string[];
                        return (
                            <div key={a.id} className="emu-kcard">
                                <div className="emu-row"><div className="emu-award-ic" style={{ width: 36, height: 36 }}><Icon name="trophy" size={18} /></div><div style={{ flex: 1 }}><b>{a.name}</b><div className="emu-muted" style={{ fontSize: 11.5 }}>{levelLabel(a.level)}</div></div></div>
                                <p>{a.description}</p>
                                {a.auto_suggest ? <div className="emu-checks">{rules.map((r) => <span key={r} className="emu-check-pill" style={{ background: 'var(--panel-2)', color: 'var(--ink-2)' }}>{r}</span>)}</div> : <span className="emu-badge violet">GVCN đề xuất thủ công</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Sửa tiêu chí' : 'Thêm tiêu chí thi đua'}
                   footer={<><button className="emu-btn" onClick={() => setEdit(null)}>Hủy</button><button className="emu-btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu tiêu chí'}</button></>}>
                <Field label="Tên tiêu chí"><input className="emu-input" value={edit?.name ?? ''} maxLength={160} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus /></Field>
                <div className="emu-grid emu-g2">
                    <Field label="Nhóm"><select className="emu-select" value={edit?.category ?? 'study'} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{Object.entries(meta.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                    <Field label="Số điểm" hint="Dương = cộng, âm = trừ (−50 … 50)"><input type="number" className={cx('emu-input')} value={edit?.points ?? 0} min={-50} max={50} onChange={(e) => setEdit({ ...edit, points: Number(e.target.value) })} /></Field>
                </div>
                <div className="emu-muted" style={{ fontSize: 12.5 }}>Xem trước: <Points value={Number(edit?.points) || 0} /> {signed(Number(edit?.points) || 0)} điểm mỗi lần ghi nhận.</div>
            </Modal>
        </div>
    );
}