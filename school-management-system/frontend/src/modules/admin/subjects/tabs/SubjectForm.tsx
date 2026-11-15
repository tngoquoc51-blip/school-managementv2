
'use client';
import { useState } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { errMsg, fieldErrors, subjectApi } from '../api';
import { CAT_LABEL, TONE_NAMES, tcls } from '../theme';
import type { Category, Group, Kind, Subject, SubjectDetail } from '../types';
import { Stepper, Switch } from './shared';

interface F { code: string; name: string; kind: Kind; category: Category; periods_per_week: number; group_id: number | ''; color: string; grades: number[]; description: string; status: 'active' | 'inactive'; sync_periods: boolean }

export default function SubjectForm({ subject, groups, onClose, onSaved }: { subject: Subject | null; groups: Group[]; onClose: () => void; onSaved: (s: SubjectDetail) => void }) {
    const toast = useToast();
    const edit = !!subject;
    const [f, setF] = useState<F>({
        code: subject?.code ?? '', name: subject?.name ?? '', kind: subject?.kind ?? 'score', category: subject?.category ?? 'required',
        periods_per_week: subject?.periods_per_week ?? 2, group_id: subject?.group_id ?? '', color: subject?.color ?? 'indigo',
        grades: subject?.grades ?? [10, 11, 12], description: subject?.description ?? '', status: subject?.status ?? 'active', sync_periods: false,
    });
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const set = <K extends keyof F>(k: K, v: F[K]) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!/^[A-Za-z0-9_-]{1,10}$/.test(f.code.trim())) e.code = 'Mã môn gồm chữ/số/-/_ (tối đa 10 ký tự)';
        if (!f.name.trim()) e.name = 'Vui lòng nhập tên môn';
        if (f.grades.length === 0) e.grades = 'Chọn ít nhất 1 khối';
        setErrs(e);
        return Object.keys(e).length === 0;
    };

    const save = async () => {
        if (!validate()) { toast.warning('Chưa hợp lệ', 'Vui lòng kiểm tra lại các trường được đánh dấu đỏ.'); return; }
        setBusy(true);
        try {
            const body = { ...f, code: f.code.trim().toUpperCase(), name: f.name.trim(), group_id: f.group_id === '' ? null : f.group_id, description: f.description.trim() || null };
            const res = edit ? await subjectApi.update(subject!.id, body) : await subjectApi.create(body);
            toast.success(edit ? 'Đã cập nhật môn học' : 'Đã tạo môn học', `${res.code} — ${res.name}`);
            onSaved(res);
        } catch (e) {
            const fe = fieldErrors(e);
            if (Object.keys(fe).length) setErrs(fe);
            toast.error('Không lưu được', errMsg(e));
        } finally { setBusy(false); }
    };

    return (
        <Modal size="lg" onClose={onClose} title={edit ? `Sửa môn học: ${subject!.name}` : 'Thêm môn học mới'} subtitle="Thông tin sẽ áp dụng cho phân công giảng dạy, thời khóa biểu và sổ điểm."
               footer={<><button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : <><Icon name="check" size={16} /> {edit ? 'Lưu thay đổi' : 'Tạo môn học'}</>}</button></>}>
            <div className="sj-form">
                <label className="sj-field"><span>Mã môn *</span>
                    <input className={`sj-input ${errs.code ? 'bad' : ''}`} value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={10} placeholder="VD: TOAN" autoFocus />
                    {errs.code ? <small>{errs.code}</small> : <em>Duy nhất, dùng trong báo cáo & nhập liệu</em>}</label>
                <label className="sj-field"><span>Tên môn học *</span>
                    <input className={`sj-input ${errs.name ? 'bad' : ''}`} value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={60} placeholder="VD: Toán học" />
                    {errs.name && <small>{errs.name}</small>}</label>

                <div className="sj-field full"><span>Hình thức đánh giá</span>
                    <div className="sj-radio">
                        <button type="button" className={f.kind === 'score' ? 'on' : ''} onClick={() => set('kind', 'score')}><b>Tính điểm</b><small>Điểm TX, giữa kỳ, cuối kỳ → ĐTB môn (hệ số 10)</small></button>
                        <button type="button" className={f.kind === 'pass' ? 'on' : ''} onClick={() => set('kind', 'pass')}><b>Đánh giá Đạt / Chưa đạt</b><small>Nhận xét, không tính điểm trung bình</small></button>
                    </div></div>

                <label className="sj-field"><span>Nhóm môn</span>
                    <select className="sj-select" value={f.category} onChange={(e) => set('category', e.target.value as Category)}>
                        {(Object.keys(CAT_LABEL) as Category[]).map((k) => <option key={k} value={k}>{CAT_LABEL[k]}</option>)}</select></label>
                <label className="sj-field"><span>Tổ bộ môn</span>
                    <select className="sj-select" value={f.group_id} onChange={(e) => set('group_id', e.target.value ? Number(e.target.value) : '')}>
                        <option value="">— Chưa phân tổ —</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>

                <div className="sj-field"><span>Số tiết / tuần</span><Stepper value={f.periods_per_week} onChange={(n) => set('periods_per_week', n)} />
                    {edit && f.periods_per_week !== subject!.periods_per_week && (
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}><input type="checkbox" className="sj-check" checked={f.sync_periods} onChange={(e) => set('sync_periods', e.target.checked)} /><em>Cập nhật luôn chương trình các khối</em></label>)}</div>
                <div className="sj-field"><span>Khối áp dụng</span>
                    <div className="sj-chips">{[10, 11, 12].map((g) => (
                        <button type="button" key={g} className={`sj-chip ${f.grades.includes(g) ? 'on' : ''}`} onClick={() => set('grades', f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g].sort())}>Khối {g}</button>))}</div>
                    {errs.grades && <small>{errs.grades}</small>}</div>

                <div className="sj-field full"><span>Màu nhận diện</span>
                    <div className="sj-colors">{TONE_NAMES.map((c) => <button type="button" key={c} className={`${tcls(c)} ${f.color === c ? 'on' : ''}`} onClick={() => set('color', c)} title={c} aria-label={c} />)}</div></div>

                <label className="sj-field full"><span>Mô tả</span>
                    <textarea className="sj-textarea" value={f.description} maxLength={500} onChange={(e) => set('description', e.target.value)} placeholder="Mục tiêu, phạm vi chương trình, ghi chú cho giáo vụ…" /></label>

                <div className="sj-field full" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Switch on={f.status === 'active'} onChange={(v) => set('status', v ? 'active' : 'inactive')} label="Trạng thái" />
                    <span>{f.status === 'active' ? 'Đang sử dụng — có thể phân công và xếp thời khóa biểu' : 'Ngừng sử dụng — ẩn khỏi phân công mới'}</span></div>
            </div>
        </Modal>
    );
}