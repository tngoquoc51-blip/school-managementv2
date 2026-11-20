'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal, useConfirm } from '@/modules/homeroom/awards/components/Overlay';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Empty, Field } from '@/modules/homeroom/awards/components/ui';
import { cx, useDebounced } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi, type QuestionPayload } from '../examsService';
import type { Ctx, Difficulty, Question, QuestionPage, QKind } from '../types';
import { DIFF_CLASS, DIFF_LABEL, LETTERS, QKIND_LABEL } from './shared';
import X from './xicons';

const blank = (meta: Ctx['meta']): Question => ({
    id: 0, subject_id: meta.subjects[0]?.id ?? 0, subject_name: null, grade: 10, kind: 'mcq', difficulty: 'medium', topic: '', content: '',
    options: ['', '', '', ''], answer: 'A', points: 0.5, is_active: true,
});

export function QuestionBody({ q, showAnswer }: { q: Question; showAnswer?: boolean }) {
    return (
        <>
            <div style={{ whiteSpace: 'pre-wrap' }}>{q.content}</div>
            {q.options && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>{q.options.map((o, i) => <div key={i} className={cx('ex-opt', showAnswer && q.answer === LETTERS[i] && 'right')}><b>{LETTERS[i]}</b><span>{o}</span></div>)}</div>}
            {showAnswer && q.answer && <div className="emu-muted" style={{ fontSize: 12, marginTop: 6 }}>Đáp án: <b style={{ color: 'var(--ok)' }}>{q.answer}</b></div>}
        </>
    );
}

export default function BankView({ ctx }: { ctx: Ctx }) {
    const { meta, tick } = ctx;
    const toast = useToast();
    const confirm = useConfirm();
    const [data, setData] = useState<QuestionPage | null>(null);
    const [page, setPage] = useState(1);
    const [f, setF] = useState({ subject_id: '', grade: '', kind: '', difficulty: '', q: '' });
    const dq = useDebounced(f.q, 300);
    const [edit, setEdit] = useState<Question | null>(null);
    const [saving, setSaving] = useState(false);
    const [show, setShow] = useState<number | null>(null);

    const load = useCallback(async () => {
        try { setData(await examApi.questions({ ...f, q: dq, page, per_page: 12 })); } catch (e) { toast.error('Không tải được ngân hàng câu hỏi', errMsg(e)); }
    }, [f.subject_id, f.grade, f.kind, f.difficulty, dq, page, toast]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load, tick]);
    useEffect(() => { setPage(1); }, [f.subject_id, f.grade, f.kind, f.difficulty, dq]);

    const save = async () => {
        if (!edit) return;
        if (!edit.content.trim()) { toast.warning('Thiếu nội dung câu hỏi'); return; }
        const body: QuestionPayload = {
            subject_id: edit.subject_id, grade: edit.grade, kind: edit.kind, difficulty: edit.difficulty, topic: edit.topic ?? '', content: edit.content,
            options: edit.kind === 'essay' ? [] : (edit.options ?? []), answer: edit.answer ?? '', points: edit.points, is_active: edit.is_active,
        };
        setSaving(true);
        try { if (edit.id) await examApi.updateQuestion(edit.id, body); else await examApi.createQuestion(body); toast.success(edit.id ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi'); setEdit(null); load(); }
        catch (e) { toast.error('Không lưu được', errMsg(e)); }
        finally { setSaving(false); }
    };

    const del = async (q: Question) => {
        if (!(await confirm({ title: 'Xóa câu hỏi này?', message: q.content.slice(0, 120), confirmText: 'Xóa', tone: 'danger' }))) return;
        try { await examApi.deleteQuestion(q.id); toast.success('Đã xóa câu hỏi'); load(); } catch (e) { toast.warning('Chưa xóa hẳn', errMsg(e)); load(); }
    };

    const by = data?.by_difficulty;
    const pages = data ? Math.max(1, Math.ceil(data.total / data.per_page)) : 1;
    const setOpt = (i: number, v: string) => setEdit((e) => (e ? { ...e, options: (e.options ?? []).map((o, k) => (k === i ? v : o)) } : e));

    return (
        <div className="emu-page">
            <div className="emu-grid emu-g4">
                <div className="emu-card emu-kpi"><div><b>{data?.total ?? '—'}</b><span>Câu hỏi theo bộ lọc</span></div></div>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => <div key={d} className="emu-card emu-kpi"><div><b>{by?.[d] ?? '—'}</b><span><span className={`emu-badge ${DIFF_CLASS[d]}`}>{DIFF_LABEL[d]}</span></span></div></div>)}
            </div>

            <div className="emu-card">
                <div className="emu-card-h" style={{ flexWrap: 'wrap' }}>
                    <h3>Ngân hàng câu hỏi</h3><span className="emu-spacer" />
                    <div className="emu-search" style={{ width: 200 }}><X name="search" size={15} /><input className="emu-input" style={{ height: 32 }} placeholder="Nội dung, chủ đề…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
                    <select className="emu-select" style={{ width: 140, height: 32 }} value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })}><option value="">Mọi môn</option>{meta.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    <select className="emu-select" style={{ width: 100, height: 32 }} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}><option value="">Mọi khối</option>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select>
                    <select className="emu-select" style={{ width: 130, height: 32 }} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="">Mọi dạng</option>{Object.entries(QKIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <select className="emu-select" style={{ width: 130, height: 32 }} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}><option value="">Mọi độ khó</option>{Object.entries(DIFF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <button className="emu-btn primary sm" onClick={() => setEdit(blank(meta))}><X name="plus" size={14} /> Thêm câu hỏi</button>
                </div>
                <div style={{ marginTop: 12 }}>
                    {data && data.items.length === 0 && <Empty icon="database" title="Chưa có câu hỏi" text="Thêm câu hỏi để tạo đề kiểm tra tự động theo ma trận độ khó." action={<button className="emu-btn primary" onClick={() => setEdit(blank(meta))}><X name="plus" /> Thêm câu hỏi đầu tiên</button>} />}
                    {data?.items.map((q) => (
                        <div key={q.id} className="ex-q" style={{ opacity: q.is_active ? 1 : .55 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="emu-row emu-wrap" style={{ marginBottom: 6 }}>
                                    <span className={`emu-badge ${DIFF_CLASS[q.difficulty]}`}>{DIFF_LABEL[q.difficulty]}</span><span className="emu-badge">{QKIND_LABEL[q.kind]}</span>
                                    <span className="emu-badge brand">{q.subject_name} · {q.grade}</span>{q.topic && <span className="emu-badge violet">{q.topic}</span>}<span className="emu-badge gold">{q.points} điểm</span>{!q.is_active && <span className="emu-badge">Đã ẩn</span>}
                                </div>
                                <QuestionBody q={q} showAnswer={show === q.id} />
                            </div>
                            <div className="emu-col" style={{ gap: 6 }}>
                                <button className="emu-btn sm" onClick={() => setShow(show === q.id ? null : q.id)}>{show === q.id ? 'Ẩn đáp án' : 'Xem đáp án'}</button>
                                <button className="emu-btn sm" onClick={() => setEdit({ ...q, options: q.options ?? (q.kind === 'essay' ? null : ['', '', '', '']) })}><X name="edit" size={13} /> Sửa</button>
                                <button className="emu-btn danger sm" onClick={() => del(q)}><X name="trash" size={13} /></button>
                            </div>
                        </div>
                    ))}
                </div>
                {pages > 1 && <div className="emu-row" style={{ justifyContent: 'center', padding: 12 }}><button className="emu-btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span className="emu-muted">Trang {page}/{pages}</span><button className="emu-btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></div>}
            </div>

            <Modal open={!!edit} onClose={() => setEdit(null)} width={680} title={edit?.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
                   footer={<><button className="emu-btn" onClick={() => setEdit(null)}>Hủy</button><button className="emu-btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu câu hỏi'}</button></>}>
                {edit && (
                    <>
                        <div className="emu-grid emu-g3">
                            <Field label="Môn học"><select className="emu-select" value={edit.subject_id} onChange={(e) => setEdit({ ...edit, subject_id: Number(e.target.value) })}>{meta.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
                            <Field label="Khối"><select className="emu-select" value={edit.grade} onChange={(e) => setEdit({ ...edit, grade: Number(e.target.value) })}>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select></Field>
                            <Field label="Điểm của câu"><input type="number" className="emu-input" min={0.1} max={10} step={0.25} value={edit.points} onChange={(e) => setEdit({ ...edit, points: Number(e.target.value) })} /></Field>
                        </div>
                        <div className="emu-grid emu-g3">
                            <Field label="Dạng câu"><select className="emu-select" value={edit.kind} onChange={(e) => { const k = e.target.value as QKind; setEdit({ ...edit, kind: k, options: k === 'essay' ? null : k === 'truefalse' ? ['Đúng', 'Sai'] : edit.options?.length ? edit.options : ['', '', '', ''], answer: k === 'essay' ? '' : 'A' }); }}>{Object.entries(QKIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                            <Field label="Độ khó"><select className="emu-select" value={edit.difficulty} onChange={(e) => setEdit({ ...edit, difficulty: e.target.value as Difficulty })}>{Object.entries(DIFF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                            <Field label="Chủ đề / chương"><input className="emu-input" maxLength={120} value={edit.topic ?? ''} onChange={(e) => setEdit({ ...edit, topic: e.target.value })} /></Field>
                        </div>
                        <Field label="Nội dung câu hỏi"><textarea className="emu-textarea" style={{ minHeight: 110 }} maxLength={5000} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} autoFocus /></Field>
                        {edit.kind !== 'essay' && (
                            <div className="emu-col" style={{ gap: 8 }}>
                                <label className="emu-muted" style={{ fontSize: 12, fontWeight: 600 }}>Phương án (chọn đáp án đúng)</label>
                                {(edit.options ?? []).map((o, i) => (
                                    <div key={i} className="emu-row"><input type="radio" className="emu-check" name="ans" checked={edit.answer === LETTERS[i]} onChange={() => setEdit({ ...edit, answer: LETTERS[i] })} /><b style={{ width: 20 }}>{LETTERS[i]}</b><input className="emu-input" value={o} readOnly={edit.kind === 'truefalse'} onChange={(e) => setOpt(i, e.target.value)} /></div>
                                ))}
                                {edit.kind === 'mcq' && (edit.options?.length ?? 0) < 6 && <button className="emu-btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setEdit({ ...edit, options: [...(edit.options ?? []), ''] })}><X name="plus" size={13} /> Thêm phương án</button>}
                            </div>
                        )}
                        {edit.kind === 'essay' && <Field label="Đáp án / hướng dẫn chấm"><textarea className="emu-textarea" value={edit.answer ?? ''} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} /></Field>}
                        <label className="emu-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="emu-check" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Cho phép dùng khi tạo đề</label>
                    </>
                )}
            </Modal>
        </div>
    );
}