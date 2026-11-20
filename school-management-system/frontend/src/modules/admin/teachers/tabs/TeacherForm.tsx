'use client';
import { useState } from 'react';
import Modal from '../../subjects/ui/Modal';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { errMsg, fieldErrors, teacherApi } from '../api';
import type { Contract, Degree, Meta, TStatus, TeacherDetail } from '../types';

interface F { code: string; full_name: string; gender: string; birth_date: string; phone: string; email: string; address: string; degree: Degree; position: string; hire_date: string; contract: Contract; status: TStatus; note: string; main_subject_id: number | ''; subject_ids: number[] }

export default function TeacherForm({ teacher, meta, onClose, onSaved }: { teacher: TeacherDetail | null; meta: Meta; onClose: () => void; onSaved: (id: number) => void }) {
    const toast = useToast();
    const edit = !!teacher;
    const [f, setF] = useState<F>({
        code: teacher?.code ?? '', full_name: teacher?.full_name ?? '', gender: teacher?.gender ?? 'Nữ', birth_date: teacher?.birth_date?.slice(0, 10) ?? '',
        phone: teacher?.phone ?? '', email: teacher?.email ?? '', address: teacher?.address ?? '', degree: teacher?.degree ?? 'bachelor', position: teacher?.position ?? 'Giáo viên',
        hire_date: teacher?.hire_date?.slice(0, 10) ?? '', contract: teacher?.contract ?? 'permanent', status: teacher?.status ?? 'active', note: teacher?.note ?? '',
        main_subject_id: teacher?.main_subject_id ?? '', subject_ids: teacher?.subject_ids ?? [],
    });
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const set = <K extends keyof F>(k: K, v: F[K]) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!f.code.trim()) e.code = 'Vui lòng nhập mã giáo viên';
        if (!f.full_name.trim()) e.full_name = 'Vui lòng nhập họ tên';
        if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Email không hợp lệ';
        if (f.phone && !/^[0-9+\s.-]{8,15}$/.test(f.phone)) e.phone = 'Số điện thoại không hợp lệ';
        setErrs(e);
        return !Object.keys(e).length;
    };

    const save = async () => {
        if (!validate()) { toast.warning('Chưa hợp lệ', 'Vui lòng kiểm tra các trường được đánh dấu đỏ.'); return; }
        setBusy(true);
        try {
            const body = { ...f, code: f.code.trim(), full_name: f.full_name.trim(), main_subject_id: f.main_subject_id === '' ? null : f.main_subject_id };
            const res = edit ? await teacherApi.update(teacher!.id, body) : await teacherApi.create(body);
            toast.success(edit ? 'Đã cập nhật giáo viên' : 'Đã thêm giáo viên', f.full_name);
            onSaved(res.id);
        } catch (e) {
            const fe = fieldErrors(e);
            if (Object.keys(fe).length) setErrs(fe);
            toast.error('Không lưu được', errMsg(e));
        } finally { setBusy(false); }
    };

    const toggleSub = (id: number) => set('subject_ids', f.subject_ids.includes(id) ? f.subject_ids.filter((x) => x !== id) : [...f.subject_ids, id]);

    return (
        <Modal size="xl" onClose={onClose} title={edit ? `Sửa hồ sơ: ${teacher!.full_name}` : 'Thêm giáo viên mới'} subtitle="Hồ sơ dùng cho phân công giảng dạy, chủ nhiệm, thời khóa biểu và nhập điểm."
               footer={<><button className="sj-btn ghost" onClick={onClose}>Hủy</button><button className="sj-btn primary" onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : <><Icon name="check" size={16} /> {edit ? 'Lưu thay đổi' : 'Thêm giáo viên'}</>}</button></>}>
            <div className="sj-form">
                <label className="sj-field"><span>Mã giáo viên *</span><input className={`sj-input ${errs.code ? 'bad' : ''}`} value={f.code} onChange={(e) => set('code', e.target.value)} autoFocus placeholder="VD: GV250041" />{errs.code && <small>{errs.code}</small>}</label>
                <label className="sj-field"><span>Họ và tên *</span><input className={`sj-input ${errs.full_name ? 'bad' : ''}`} value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />{errs.full_name && <small>{errs.full_name}</small>}</label>
                <label className="sj-field"><span>Giới tính</span><select className="sj-select" value={f.gender} onChange={(e) => set('gender', e.target.value)}><option>Nữ</option><option>Nam</option></select></label>
                <label className="sj-field"><span>Ngày sinh</span><input type="date" className="sj-input" value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} /></label>
                <label className="sj-field"><span>Điện thoại</span><input className={`sj-input ${errs.phone ? 'bad' : ''}`} value={f.phone} onChange={(e) => set('phone', e.target.value)} />{errs.phone && <small>{errs.phone}</small>}</label>
                <label className="sj-field"><span>Email</span><input className={`sj-input ${errs.email ? 'bad' : ''}`} value={f.email} onChange={(e) => set('email', e.target.value)} />{errs.email && <small>{errs.email}</small>}</label>
                <label className="sj-field full"><span>Địa chỉ</span><input className="sj-input" value={f.address} onChange={(e) => set('address', e.target.value)} /></label>

                <label className="sj-field"><span>Trình độ</span><select className="sj-select" value={f.degree} onChange={(e) => set('degree', e.target.value as Degree)}>{Object.entries(meta.degrees).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="sj-field"><span>Chức vụ</span><select className="sj-select" value={f.position} onChange={(e) => set('position', e.target.value)}>{['Giáo viên', 'Tổ trưởng chuyên môn', 'Tổ phó chuyên môn', 'Phó hiệu trưởng', 'Hiệu trưởng', 'Giáo vụ'].map((p) => <option key={p}>{p}</option>)}</select></label>
                <label className="sj-field"><span>Ngày vào trường</span><input type="date" className="sj-input" value={f.hire_date} onChange={(e) => set('hire_date', e.target.value)} /></label>
                <label className="sj-field"><span>Loại hợp đồng</span><select className="sj-select" value={f.contract} onChange={(e) => set('contract', e.target.value as Contract)}>{Object.entries(meta.contracts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="sj-field"><span>Trạng thái</span><select className="sj-select" value={f.status} onChange={(e) => set('status', e.target.value as TStatus)}>{Object.entries(meta.statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="sj-field"><span>Môn chính</span><select className="sj-select" value={f.main_subject_id} onChange={(e) => set('main_subject_id', e.target.value ? Number(e.target.value) : '')}><option value="">— Chưa chọn —</option>{meta.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>

                <div className="sj-field full"><span>Có thể dạy thêm các môn</span>
                    <div className="sj-chips">{meta.subjects.map((s) => <button type="button" key={s.id} className={`sj-chip ${f.subject_ids.includes(s.id) || f.main_subject_id === s.id ? 'on' : ''}`} onClick={() => toggleSub(s.id)}>{s.name}</button>)}</div>
                    <em>Môn chính luôn được tính là chuyên môn. Dùng để gợi ý phân công và dạy thay.</em></div>
                <label className="sj-field full"><span>Ghi chú</span><textarea className="sj-textarea" maxLength={500} value={f.note} onChange={(e) => set('note', e.target.value)} /></label>
            </div>
        </Modal>
    );
}