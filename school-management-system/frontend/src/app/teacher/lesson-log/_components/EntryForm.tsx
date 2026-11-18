'use client';

import { useEffect, useMemo, useState } from 'react';
import { ll } from '../_lib/api';
import { useToast } from '../_lib/toast';
import type { Detail, Meta, Student } from '../_lib/types';
import { Icon, Modal } from './ui';

export interface FormInit { class_id: number | null; date: string; period: number | null; detail?: Detail }
interface Props { meta: Meta; init: FormInit; onClose: () => void; onSaved: (id: number) => void }
type Ab = Record<number, { type: string; reason: string }>;

export default function EntryForm({ meta, init, onClose, onSaved }: Props) {
    const toast = useToast();
    const d = init.detail;
    const editing = !!d;
    const [classId, setClassId] = useState<string>(String(d?.log.class_id ?? init.class_id ?? meta.classes[0]?.id ?? ''));
    const [date, setDate] = useState(d?.log.lesson_date ?? init.date ?? meta.today);
    const [period, setPeriod] = useState(String(d?.log.period ?? init.period ?? ''));
    const [subject, setSubject] = useState(d?.log.subject_name ?? '');
    const [lessonNo, setLessonNo] = useState(d?.log.lesson_no ? String(d.log.lesson_no) : '');
    const [title, setTitle] = useState(d?.log.title ?? '');
    const [content, setContent] = useState(d?.log.content ?? '');
    const [equipment, setEquipment] = useState(d?.log.equipment ?? '');
    const [homework, setHomework] = useState(d?.log.homework ?? '');
    const [rating, setRating] = useState(d?.log.rating ?? '');
    const [remark, setRemark] = useState(d?.log.remark ?? '');
    const [discipline, setDiscipline] = useState(d?.log.discipline_note ?? '');
    const [ab, setAb] = useState<Ab>(() => Object.fromEntries((d?.absences ?? []).map((a) => [a.student_id, { type: a.type, reason: a.reason ?? '' }])));
    const [roster, setRoster] = useState<Student[]>([]);
    const [q, setQ] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!classId) return;
        ll.students(Number(classId)).then(setRoster).catch(() => setRoster([]));
    }, [classId]);

    const cnt = useMemo(() => {
        const c = { excused: 0, unexcused: 0, late: 0 };
        Object.values(ab).forEach((x) => { if (x.type in c) c[x.type as keyof typeof c]++; });
        return c;
    }, [ab]);

    const toggle = (id: number, type: string) => setAb((m) => {
        const n = { ...m };
        if (n[id]?.type === type) delete n[id]; else n[id] = { type, reason: n[id]?.reason ?? '' };
        return n;
    });
    const shown = roster.filter((s) => !q.trim() || (s.name + ' ' + (s.code ?? '')).toLowerCase().includes(q.trim().toLowerCase()));

    const save = async (sign: boolean) => {
        setErr('');
        if (!classId || !date || !period) return setErr('Vui lòng chọn lớp, ngày và tiết học.');
        if (!subject.trim()) return setErr('Vui lòng chọn hoặc nhập môn học.');
        if (sign && (!title.trim() || !rating)) return setErr('Cần nhập tên bài học và chọn xếp loại tiết học trước khi ký sổ.');
        const body: Record<string, unknown> = {
            subject_name: subject.trim(), lesson_no: lessonNo ? Number(lessonNo) : null, title: title.trim() || null, content: content || null,
            equipment: equipment || null, homework: homework || null, rating: rating || null, remark: remark || null, discipline_note: discipline || null,
            absences: Object.entries(ab).map(([id, v]) => ({ student_id: Number(id), type: v.type, reason: v.reason || null })),
        };
        if (!editing) Object.assign(body, { class_id: Number(classId), lesson_date: date, period: Number(period) });
        setBusy(true);
        let id = d?.log.id ?? 0;
        try {
            if (editing) await ll.update(id, body); else id = await ll.create(body);
        } catch (e) { setErr(e instanceof Error ? e.message : 'Không lưu được.'); setBusy(false); return; }
        try {
            if (sign) await ll.sign(id);
            toast({ tone: 'success', title: sign ? 'Đã lưu và ký sổ' : 'Đã lưu bản nháp', text: `${subject} · tiết ${period}` });
        } catch (e) {
            toast({ tone: 'warn', title: 'Đã lưu nhưng chưa ký được', text: e instanceof Error ? e.message : '' });
        }
        setBusy(false);
        onSaved(id);
    };

    return (
        <Modal wide title={editing ? `Sửa tiết ${d!.log.period} – lớp ${d!.log.class_name}` : 'Ghi sổ tiết học'} onClose={onClose}
               footer={<>
                   <button className="ll-btn ghost" onClick={onClose}>Hủy</button>
                   <button className="ll-btn ghost" disabled={busy} onClick={() => save(false)}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button>
                   <button className="ll-btn" disabled={busy} onClick={() => save(true)}><Icon n="pen" s={15} />Lưu & ký sổ</button>
               </>}>
            <div className="ll-secs">
                {err && <div className="ll-alert err"><Icon n="alert" s={16} /><span>{err}</span></div>}

                <section className="ll-sec">
                    <h4><Icon n="calendar" s={16} />Thông tin tiết học</h4>
                    <div className="ll-fm">
                        <label>Lớp<select className="ll-in" value={classId} disabled={editing} onChange={(e) => { setClassId(e.target.value); setAb({}); }}>{meta.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                        <label>Ngày dạy<input className="ll-in" type="date" value={date} max={meta.today} disabled={editing} onChange={(e) => setDate(e.target.value)} /></label>
                        <label>Tiết<select className="ll-in" value={period} disabled={editing} onChange={(e) => setPeriod(e.target.value)}><option value="">— Chọn —</option>{meta.periods.map((p) => <option key={p.n} value={p.n}>Tiết {p.n} ({p.start})</option>)}</select></label>
                        <label>Tiết PPCT<input className="ll-in" type="number" min={1} value={lessonNo} onChange={(e) => setLessonNo(e.target.value)} placeholder="VD: 12" /></label>
                        <label className="s2">Môn học<input className="ll-in" list="ll-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Chọn hoặc gõ tên môn" /><datalist id="ll-subjects">{meta.subjects.map((s) => <option key={s} value={s} />)}</datalist></label>
                    </div>
                </section>

                <section className="ll-sec">
                    <h4><Icon n="book" s={16} />Nội dung bài dạy</h4>
                    <div className="ll-fm">
                        <label className="s4">Tên bài học<input className="ll-in" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} /></label>
                        <label className="s4">Nội dung đã dạy<textarea className="ll-in" rows={3} value={content} onChange={(e) => setContent(e.target.value)} /></label>
                        <label className="s2">Thiết bị / đồ dùng dạy học<input className="ll-in" value={equipment} onChange={(e) => setEquipment(e.target.value)} /></label>
                        <label className="s2">Bài tập về nhà<input className="ll-in" value={homework} onChange={(e) => setHomework(e.target.value)} /></label>
                    </div>
                </section>

                <section className="ll-sec">
                    <h4><Icon n="check" s={16} />Đánh giá tiết học</h4>
                    <div className="ll-rates" style={{ marginBottom: 10 }}>
                        {Object.entries(meta.ratings).map(([k, l]) => <button key={k} type="button" className={`${rating === k ? 'on ' : ''}${k}`} onClick={() => setRating(rating === k ? '' : k)}>{l}</button>)}
                    </div>
                    <div className="ll-fm">
                        <label className="s2">Nhận xét chung<textarea className="ll-in" rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} /></label>
                        <label className="s2">Vi phạm, nhắc nhở<textarea className="ll-in" rows={2} value={discipline} onChange={(e) => setDiscipline(e.target.value)} /></label>
                    </div>
                </section>

                <section className="ll-sec">
                    <h4><Icon n="users" s={16} />Chuyên cần của tiết học</h4>
                    <div className="ll-cnt">
                        <span className="ll-tg-g">Sĩ số {roster.length}</span><span className="ll-tg-f">Có phép {cnt.excused}</span><span className="ll-tg-x">Không phép {cnt.unexcused}</span><span className="ll-tg-l">Đi muộn {cnt.late}</span>
                    </div>
                    <input className="ll-in" style={{ marginBottom: 8 }} placeholder="Tìm học sinh theo tên hoặc mã…" value={q} onChange={(e) => setQ(e.target.value)} />
                    <div className="ll-roster">
                        {shown.map((s) => {
                            const a = ab[s.id];
                            return (
                                <div key={s.id} className={`ll-stu${a ? ' has' : ''}`}>
                                    <div className="nm"><b>{s.name}</b><small>{s.code ?? ''}</small></div>
                                    <div className="ab">
                                        {Object.entries(meta.absence_types).map(([k, l]) => <button key={k} type="button" className={`${a?.type === k ? 'on ' : ''}${k}`} onClick={() => toggle(s.id, k)}>{l}</button>)}
                                    </div>
                                    {a && <input placeholder="Lý do (tùy chọn)" value={a.reason} onChange={(e) => setAb((m) => ({ ...m, [s.id]: { ...m[s.id], reason: e.target.value } }))} />}
                                </div>
                            );
                        })}
                        {!shown.length && <p className="ll-empty">{roster.length ? 'Không tìm thấy học sinh.' : 'Chưa có danh sách học sinh của lớp này.'}</p>}
                    </div>
                </section>
            </div>
        </Modal>
    );
}