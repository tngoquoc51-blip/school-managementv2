'use client';
import { useState } from 'react';
import type { Ctx } from '../SubjectsPage';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useConfirm } from '../ui/Confirm';
import { errMsg, fieldErrors, subjectApi } from '../api';
import { tcls } from '../theme';
import type { Group } from '../types';
import { Empty, ErrorBox, Loading, useLoad } from './shared';

type Pick = { id: number; code: string; name: string; color: string };

export default function GroupsTab({ ctx }: { ctx: Ctx }) {
    const toast = useToast();
    const confirm = useConfirm();
    const q = useLoad(() => subjectApi.groups(), []);
    const [edit, setEdit] = useState<{ group: Group | null } | null>(null);

    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const { groups, ungrouped } = q.data;
    const after = () => { q.reload(true); ctx.refreshMeta(); };

    const remove = async (g: Group) => {
        if (!(await confirm({ title: `Xóa tổ “${g.name}”?`, tone: 'danger', confirmText: 'Xóa tổ', message: `${g.subjects_count ?? 0} môn thuộc tổ sẽ chuyển sang “Chưa phân tổ”. Không ảnh hưởng đến phân công và điểm.` }))) return;
        try { await subjectApi.removeGroup(g.id); toast.success('Đã xóa tổ bộ môn', g.name); after(); } catch (e) { toast.error('Không xóa được', errMsg(e)); }
    };

    return (
        <>
            <div className="sj-bar"><div><h3 style={{ fontSize: 17 }}>Tổ bộ môn</h3><p className="sj-muted">Nhóm các môn học theo tổ chuyên môn, gán tổ trưởng và quản lý đội ngũ giáo viên.</p></div><span className="sj-spacer" />
                <button className="sj-btn primary" onClick={() => setEdit({ group: null })}><Icon name="plus" size={16} /> Thêm tổ bộ môn</button></div>
            {groups.length === 0 ? <div className="sj-card"><Empty icon="layers" title="Chưa có tổ bộ môn" /></div> : (
                <div className="sj-grid sj-g3">
                    {groups.map((g) => (
                        <div key={g.id} className="sj-card sj-gcard">
                            <div className="sj-card-h" style={{ marginBottom: 6 }}><div><span className="sj-badge pri">{g.code}</span><h3 style={{ marginTop: 8 }}>{g.name}</h3></div>
                                <div className="sj-acts"><button className="sj-btn icon" title="Sửa" onClick={() => setEdit({ group: g })}><Icon name="edit" size={15} /></button>
                                    <button className="sj-btn icon danger-h" title="Xóa" onClick={() => remove(g)}><Icon name="trash" size={15} /></button></div></div>
                            {g.description && <p className="sj-muted">{g.description}</p>}
                            <div className="sj-gmeta"><span><Icon name="star" size={13} /> Tổ trưởng: <b>{g.head_name ?? 'Chưa bổ nhiệm'}</b></span></div>
                            <div className="sj-gmeta"><span><b>{g.subjects_count}</b> môn</span><span><b>{g.teachers_count}</b> giáo viên</span></div>
                            <div className="sj-gchips">{g.subjects?.length ? g.subjects.map((s) => <span key={s.id} className={`sj-tag ${tcls(s.color)}`} style={{ opacity: s.status === 'active' ? 1 : 0.5 }}>{s.name}</span>) : <span className="sj-muted">Chưa có môn nào</span>}</div>
                        </div>))}
                    {ungrouped.length > 0 && (
                        <div className="sj-card sj-gcard" style={{ borderStyle: 'dashed' }}>
                            <div className="sj-card-h" style={{ marginBottom: 6 }}><h3>Chưa phân tổ</h3><span className="sj-badge warn">{ungrouped.length} môn</span></div>
                            <p className="sj-muted">Các môn này chưa thuộc tổ nào. Mở một tổ và chọn môn để gán.</p>
                            <div className="sj-gchips">{ungrouped.map((s) => <span key={s.id} className={`sj-tag ${tcls(s.color)}`}>{s.name}</span>)}</div>
                        </div>)}
                </div>)}
            {edit && <GroupForm group={edit.group} ctx={ctx} pool={[...(edit.group?.subjects ?? []), ...ungrouped] as Pick[]} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); after(); }} />}
        </>
    );
}

function GroupForm({ group, ctx, pool, onClose, onSaved }: { group: Group | null; ctx: Ctx; pool: Pick[]; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const [f, setF] = useState({ code: group?.code ?? '', name: group?.name ?? '', head_teacher_id: group?.head_teacher_id ?? '' as number | '', description: group?.description ?? '' });
    const [ids, setIds] = useState<number[]>(group?.subjects?.map((s) => s.id) ?? []);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const save = async () => {
        const e: Record<string, string> = {};
        if (!/^[A-Za-z0-9_-]{1,12}$/.test(f.code.trim())) e.code = 'Mã tổ gồm chữ/số/-/_ (tối đa 12 ký tự)';
        if (!f.name.trim()) e.name = 'Vui lòng nhập tên tổ';
        setErrs(e);
        if (Object.keys(e).length) { toast.warning('Chưa hợp lệ', 'Kiểm tra các trường được đánh dấu đỏ.'); return; }
        setBusy(true);
        try {
            await subjectApi.saveGroup(group?.id ?? null, { ...f, code: f.code.trim().toUpperCase(), head_teacher_id: f.head_teacher_id === '' ? null : f.head_teacher_id, subject_ids: ids });
            toast.success(group ? 'Đã cập nhật tổ bộ môn' : 'Đã tạo tổ bộ môn', f.name); onSaved();
        } catch (x) { setErrs(fieldErrors(x)); toast.error('Không lưu được', errMsg(x)); } finally { setBusy(false); }
    };
    const teachers = ctx.meta.teachers;
    return (
        <Modal onClose={onClose} title={group ? `Sửa tổ: ${group.name}` : 'Thêm tổ bộ môn'} footer={<><button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" disabled={busy} onClick={save}><Icon name="check" size={16} /> Lưu</button></>}>
            <div className="sj-form">
                <label className="sj-field"><span>Mã tổ *</span><input className={`sj-input ${errs.code ? 'bad' : ''}`} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} maxLength={12} autoFocus />{errs.code && <small>{errs.code}</small>}</label>
                <label className="sj-field"><span>Tên tổ *</span><input className={`sj-input ${errs.name ? 'bad' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} />{errs.name && <small>{errs.name}</small>}</label>
                <label className="sj-field full"><span>Tổ trưởng</span>
                    <select className="sj-select" value={f.head_teacher_id} onChange={(e) => setF({ ...f, head_teacher_id: e.target.value ? Number(e.target.value) : '' })}>
                        <option value="">— Chưa bổ nhiệm —</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} ({t.code})</option>)}</select></label>
                <label className="sj-field full"><span>Mô tả</span><textarea className="sj-textarea" value={f.description} maxLength={300} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
                <div className="sj-field full"><span>Môn thuộc tổ ({ids.length})</span>
                    <div className="sj-chips">{pool.length === 0 && <span className="sj-muted">Không còn môn nào chưa phân tổ.</span>}
                        {pool.map((s) => (<button type="button" key={s.id} className={`sj-chip ${ids.includes(s.id) ? 'on' : ''}`} onClick={() => setIds(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])}>{s.name}</button>))}</div></div>
            </div>
        </Modal>
    );
}