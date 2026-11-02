'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import s from './homework.module.css';
import { teacherPortal } from '@/services/teacherPortal';
import { teacherHomework as hw, errorMessage } from '@/services/teacherHomework';

interface Assign { id: number; class_name: string; subject: string }
interface Hw {
    id: number; class_subject_id: number; title: string; type: string; priority: string; max_score: number;
    due_at: string; allow_late: boolean; status: 'draft' | 'published'; class_name: string; subject: string;
    students: number; submitted: number; graded: number; description?: string | null;
}
interface Meta { current_page: number; last_page: number; total: number }
interface Stu {
    student_id: number; code: string; full_name: string; submission_id: number | null;
    status: 'missing' | 'submitted' | 'graded' | 'returned'; content: string | null; link_url: string | null;
    is_late: boolean; submitted_at: string | null; attempt: number; score: number | null; feedback: string | null;
    files: { id: number; name: string; size_kb: number }[];
}
interface Form {
    id?: number; class_subject_id: number; title: string; description: string; type: string; priority: string;
    max_score: string; due_at: string; allow_late: boolean; status: 'draft' | 'published';
}
type Flash = (ok: boolean, text: string) => void;

const pad = (n: number) => String(n).padStart(2, '0');
const toInput = (v: string) => v.replace(' ', 'T').slice(0, 16);
const fromInput = (v: string) => `${v.replace('T', ' ')}:00`;
const fmt = (v: string) => { const x = new Date(v.replace(' ', 'T')); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const STATUS: Record<Stu['status'], string> = { missing: 'Chưa nộp', submitted: 'Chờ chấm', graded: 'Đã chấm', returned: 'Làm lại' };
const TYPES: Record<string, string> = { exercise: 'Bài tập', essay: 'Tự luận', quiz: 'Ôn tập', project: 'Dự án' };

export default function TeacherHomeworkPage() {
    const [assigns, setAssigns] = useState<Assign[]>([]);
    const [cs, setCs] = useState(0);
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<Hw[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [form, setForm] = useState<Form | null>(null);
    const [saving, setSaving] = useState(false);
    const [viewId, setViewId] = useState<number | null>(null);

    const flash: Flash = useCallback((ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), ok ? 4000 : 7000); }, []);

    const load = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            const r = await hw.list({ class_subject_id: cs || undefined, status: status || undefined, page });
            setItems(r.data as Hw[]); setMeta(r.meta as Meta);
        } catch (e) { setErr(errorMessage(e)); } finally { setLoading(false); }
    }, [cs, status, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { teacherPortal.assignments().then((r: any) => setAssigns((r?.data ?? []) as Assign[])).catch(() => {}); }, []);

    const openNew = () => {
        const t = new Date(Date.now() + 86400000);
        setForm({
            class_subject_id: cs || assigns[0]?.id || 0, title: '', description: '', type: 'exercise', priority: 'normal',
            max_score: '10', due_at: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T20:00`, allow_late: false, status: 'published',
        });
    };

    const openEdit = async (h: Hw) => {
        try {
            const r = await hw.show(h.id);
            const x = r.data as Hw;
            setForm({
                id: x.id, class_subject_id: x.class_subject_id, title: x.title, description: x.description ?? '', type: x.type,
                priority: x.priority, max_score: String(x.max_score), due_at: toInput(x.due_at), allow_late: x.allow_late, status: x.status,
            });
        } catch (e) { flash(false, errorMessage(e)); }
    };

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        if (!form.class_subject_id) { flash(false, 'Hãy chọn lớp và môn giao bài.'); return; }
        if (!form.title.trim()) { flash(false, 'Hãy nhập tiêu đề bài tập.'); return; }
        const body = {
            class_subject_id: form.class_subject_id, title: form.title.trim(), description: form.description.trim() || null,
            type: form.type, priority: form.priority, max_score: Number(form.max_score) || 10, due_at: fromInput(form.due_at),
            allow_late: form.allow_late, status: form.status,
        };
        setSaving(true);
        try {
            if (form.id) await hw.update(form.id, body); else await hw.create(body);
            flash(true, form.id ? 'Đã lưu thay đổi.' : form.status === 'published' ? 'Đã giao bài. Học sinh thấy ngay trên trang bài tập.' : 'Đã lưu bản nháp.');
            setForm(null); load();
        } catch (er) { flash(false, errorMessage(er)); } finally { setSaving(false); }
    };

    const remove = async (h: Hw) => {
        if (!window.confirm(`Xóa bài "${h.title}"?`)) return;
        try { const r = await hw.remove(h.id); flash(true, r.message ?? 'Đã xóa bài tập.'); load(); }
        catch (er) { flash(false, errorMessage(er)); }
    };

    const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

    return (
        <div className={s.page}>
            <div className={s.head}>
                <div>
                    <h1 className={s.title}>Bài tập</h1>
                    <p className={s.sub}>Giao bài cho các lớp bạn dạy, xem bài nộp, chấm điểm hoặc trả lại để học sinh làm lại.</p>
                </div>
                <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={openNew} disabled={assigns.length === 0}>Giao bài mới</button>
            </div>

            {msg && <div className={`${s.flash} ${msg.ok ? s.flashOk : s.flashErr}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</div>}

            <div className={s.toolbar}>
                <label><span className={s.srOnly}>Lớp và môn</span>
                    <select value={cs} onChange={(e) => { setCs(Number(e.target.value)); setPage(1); }}>
                        <option value={0}>Tất cả lớp và môn</option>
                        {assigns.map((a) => <option key={a.id} value={a.id}>{a.class_name} – {a.subject}</option>)}
                    </select>
                </label>
                <label><span className={s.srOnly}>Trạng thái</span>
                    <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="published">Đã giao</option>
                        <option value="draft">Bản nháp / đã ẩn</option>
                    </select>
                </label>
            </div>

            {err ? (
                <div className={s.empty} role="alert"><b>Chưa tải được danh sách</b><p>{err}</p><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={load}>Tải lại</button></div>
            ) : loading && items.length === 0 ? (
                <div className={s.empty}>Đang tải…</div>
            ) : items.length === 0 ? (
                <div className={s.empty}><b>Chưa có bài tập nào</b><p>Bấm “Giao bài mới” để giao bài cho lớp bạn dạy.</p></div>
            ) : (
                <div className={s.tableWrap}>
                    <table className={s.table}>
                        <thead><tr><th>Bài tập</th><th>Lớp, môn</th><th>Hạn nộp</th><th>Đã nộp</th><th>Đã chấm</th><th>Trạng thái</th><th /></tr></thead>
                        <tbody>
                        {items.map((h) => (
                            <tr key={h.id}>
                                <td><b>{h.title}</b><div className={s.muted}>{TYPES[h.type] ?? 'Bài tập'}{h.priority === 'high' ? ' · Quan trọng' : ''}</div></td>
                                <td>{h.class_name}<div className={s.muted}>{h.subject}</div></td>
                                <td>{fmt(h.due_at)}</td>
                                <td>{h.submitted}/{h.students}</td>
                                <td>{h.graded}/{h.submitted}</td>
                                <td><span className={`${s.tag} ${h.status === 'draft' ? s.tagDraft : s.tagOn}`}>{h.status === 'draft' ? 'Nháp' : 'Đã giao'}</span></td>
                                <td className={s.acts}>
                                    <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => setViewId(h.id)}>Bài nộp</button>
                                    <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => openEdit(h)}>Sửa</button>
                                    <button type="button" className={`${s.btn} ${s.btnSm} ${s.btnDanger}`} onClick={() => remove(h)}>Xóa</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {meta && meta.last_page > 1 && (
                <div className={s.pager}>
                    <button type="button" className={s.btn} disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button>
                    <span>Trang {meta.current_page} / {meta.last_page}</span>
                    <button type="button" className={s.btn} disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>Trang sau</button>
                </div>
            )}

            {form && (
                <div className={s.scrim} onClick={() => setForm(null)}>
                    <form className={s.modal} onClick={(e) => e.stopPropagation()} onSubmit={save} role="dialog" aria-modal="true" aria-label="Giao bài">
                        <h2>{form.id ? 'Sửa bài tập' : 'Giao bài mới'}</h2>
                        <label className={s.field}><span>Lớp và môn</span>
                            <select value={form.class_subject_id} disabled={!!form.id} onChange={(e) => set('class_subject_id', Number(e.target.value))}>
                                {assigns.map((a) => <option key={a.id} value={a.id}>{a.class_name} – {a.subject}</option>)}
                            </select>
                        </label>
                        <label className={s.field}><span>Tiêu đề</span>
                            <input value={form.title} maxLength={160} onChange={(e) => set('title', e.target.value)} placeholder="Ví dụ: Bài tập chương 2" />
                        </label>
                        <label className={s.field}><span>Đề bài và hướng dẫn</span>
                            <textarea rows={5} value={form.description} maxLength={5000} onChange={(e) => set('description', e.target.value)} />
                        </label>
                        <div className={s.row2}>
                            <label className={s.field}><span>Hạn nộp</span><input type="datetime-local" value={form.due_at} onChange={(e) => set('due_at', e.target.value)} /></label>
                            <label className={s.field}><span>Điểm tối đa</span><input type="number" min={1} max={99} step={0.5} value={form.max_score} onChange={(e) => set('max_score', e.target.value)} /></label>
                        </div>
                        <div className={s.row2}>
                            <label className={s.field}><span>Loại bài</span>
                                <select value={form.type} onChange={(e) => set('type', e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                            </label>
                            <label className={s.field}><span>Mức độ</span>
                                <select value={form.priority} onChange={(e) => set('priority', e.target.value)}><option value="normal">Bình thường</option><option value="high">Quan trọng</option></select>
                            </label>
                        </div>
                        <label className={s.check}><input type="checkbox" checked={form.allow_late} onChange={(e) => set('allow_late', e.target.checked)} /> Cho phép nộp muộn</label>
                        <label className={s.check}><input type="checkbox" checked={form.status === 'published'} onChange={(e) => set('status', e.target.checked ? 'published' : 'draft')} /> Giao ngay cho học sinh (bỏ chọn để lưu nháp)</label>
                        <div className={s.formActs}>
                            <button type="button" className={s.btn} onClick={() => setForm(null)}>Hủy</button>
                            <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
                        </div>
                    </form>
                </div>
            )}

            {viewId !== null && <Submissions id={viewId} onClose={() => setViewId(null)} onChanged={load} flash={flash} />}
        </div>
    );
}

function Submissions({ id, onClose, onChanged, flash }: { id: number; onClose: () => void; onChanged: () => void; flash: Flash }) {
    const [data, setData] = useState<{ homework: Hw; students: Stu[] } | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [open, setOpen] = useState<number | null>(null);
    const [score, setScore] = useState('');
    const [fb, setFb] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { const r = await hw.submissions(id); setData(r.data); } catch (e) { setErr(errorMessage(e)); }
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const expand = (st: Stu) => {
        if (!st.submission_id) return;
        setOpen(open === st.student_id ? null : st.student_id);
        setScore(st.score !== null ? String(st.score) : ''); setFb(st.feedback ?? '');
    };

    const act = async (st: Stu, action: 'grade' | 'return') => {
        if (!st.submission_id) return;
        if (action === 'grade' && (score.trim() === '' || Number.isNaN(Number(score)))) { flash(false, 'Hãy nhập điểm.'); return; }
        if (action === 'return' && !fb.trim()) { flash(false, 'Hãy ghi rõ học sinh cần làm lại điều gì.'); return; }
        setBusy(true);
        try {
            await hw.grade(st.submission_id, { action, score: action === 'grade' ? Number(score) : undefined, feedback: fb.trim() || undefined });
            flash(true, action === 'grade' ? `Đã chấm điểm cho ${st.full_name}.` : `Đã trả bài để ${st.full_name} làm lại.`);
            setOpen(null); await load(); onChanged();
        } catch (e) { flash(false, errorMessage(e)); } finally { setBusy(false); }
    };

    const h = data?.homework;
    return (
        <div className={s.scrim} onClick={onClose}>
            <aside className={s.drawer} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Bài nộp">
                <div className={s.drawerHead}>
                    <div><h2>{h ? h.title : 'Bài nộp'}</h2>{h && <p className={s.muted}>{h.class_name} · {h.subject} · hạn {fmt(h.due_at)} · tối đa {h.max_score} điểm</p>}</div>
                    <button type="button" className={s.btn} onClick={onClose} aria-label="Đóng">Đóng</button>
                </div>
                {err && <div className={s.flashErr} role="alert">{err}</div>}
                {!data && !err && <p className={s.muted}>Đang tải…</p>}
                {data && (
                    <ul className={s.stuList}>
                        {data.students.map((st) => (
                            <li key={st.student_id} className={s.stu}>
                                <button type="button" className={s.stuMain} onClick={() => expand(st)} disabled={!st.submission_id}>
                                    <span><b>{st.full_name}</b> <span className={s.muted}>{st.code}</span></span>
                                    <span className={s.stuRight}>
                                        {st.score !== null && <b>{st.score}</b>}
                                        <span className={`${s.tag} ${s['st_' + st.status]}`}>{STATUS[st.status]}{st.is_late && st.status !== 'missing' ? ' (muộn)' : ''}</span>
                                    </span>
                                </button>
                                {open === st.student_id && (
                                    <div className={s.grade}>
                                        <p className={s.muted}>Nộp lúc {st.submitted_at ? fmt(st.submitted_at) : ''}, lần {st.attempt}</p>
                                        {st.content && <p className={s.content}>{st.content}</p>}
                                        {st.link_url && <p><a href={st.link_url} target="_blank" rel="noopener noreferrer">{st.link_url}</a></p>}
                                        {st.files.map((f) => (
                                            <p key={f.id}><button type="button" className={s.link} onClick={() => hw.download(f.id, f.name).catch((e) => flash(false, errorMessage(e)))}>{f.name}</button> <span className={s.muted}>{f.size_kb} KB</span></p>
                                        ))}
                                        <div className={s.row2}>
                                            <label className={s.field}><span>Điểm (tối đa {h?.max_score})</span>
                                                <input type="number" min={0} max={h?.max_score} step={0.25} value={score} onChange={(e) => setScore(e.target.value)} />
                                            </label>
                                        </div>
                                        <label className={s.field}><span>Nhận xét</span><textarea rows={3} value={fb} maxLength={2000} onChange={(e) => setFb(e.target.value)} /></label>
                                        <div className={s.formActs}>
                                            <button type="button" className={s.btn} disabled={busy} onClick={() => act(st, 'return')}>Trả lại làm lại</button>
                                            <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={() => act(st, 'grade')}>Chấm điểm</button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </aside>
        </div>
    );
}