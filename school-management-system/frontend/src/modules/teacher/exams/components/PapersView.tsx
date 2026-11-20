'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, useConfirm } from '@/modules/homeroom/awards/components/Overlay';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { Empty, Field } from '@/modules/homeroom/awards/components/ui';
import { cx, fmtDate } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi } from '../examsService';
import type { Ctx, Difficulty, Generated, PaperFull, PaperRow, Question } from '../types';
import { QuestionBody } from './BankView';
import { DIFF_CLASS, DIFF_LABEL, LETTERS, QKIND_LABEL } from './shared';
import X from './xicons';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

export default function PapersView({ ctx }: { ctx: Ctx }) {
    const { meta, tick, refresh } = ctx;
    const toast = useToast();
    const confirm = useConfirm();
    const [subjectId, setSubjectId] = useState(meta.subjects[0]?.id ?? 0);
    const [grade, setGrade] = useState(10);
    const [matrix, setMatrix] = useState<Record<Difficulty, number>>({ easy: 4, medium: 4, hard: 2 });
    const [kinds, setKinds] = useState<string[]>(['mcq', 'essay']);
    const [topic, setTopic] = useState('');
    const [items, setItems] = useState<Question[]>([]);
    const [points, setPoints] = useState<Record<number, number>>({});
    const [shortage, setShortage] = useState<Generated['shortage']>({});
    const [busy, setBusy] = useState(false);
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState(45);
    const [papers, setPapers] = useState<PaperRow[]>([]);
    const [view, setView] = useState<PaperFull | null>(null);
    const [answers, setAnswers] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);

    const loadPapers = () => examApi.papers().then(setPapers).catch((e) => toast.error('Không tải được danh sách đề', errMsg(e)));
    useEffect(() => { loadPapers(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

    const total = useMemo(() => Math.round(items.reduce((a, q) => a + (points[q.id] ?? q.points), 0) * 10) / 10, [items, points]);
    const want = matrix.easy + matrix.medium + matrix.hard;

    const generate = async () => {
        if (!want) { toast.warning('Chưa chọn số câu', 'Nhập số câu theo từng mức độ khó.'); return; }
        setBusy(true);
        try {
            const r = await examApi.generate({ subject_id: subjectId, grade, matrix, kinds, topic: topic || undefined });
            setItems(r.items); setShortage(r.shortage); setPoints(Object.fromEntries(r.items.map((q) => [q.id, q.points])));
            const miss = Object.entries(r.shortage).map(([k, v]) => `${DIFF_LABEL[k as Difficulty]}: thiếu ${v}`).join(' · ');
            if (miss) toast.warning('Ngân hàng chưa đủ câu', miss); else toast.success(`Đã chọn ${r.items.length} câu`, 'Bạn có thể đổi câu, chỉnh điểm và sắp xếp lại.');
        } catch (e) { toast.error('Không tạo được đề', errMsg(e)); }
        finally { setBusy(false); }
    };

    const reroll = async (q: Question) => {
        try {
            const r = await examApi.generate({ subject_id: subjectId, grade, matrix: { easy: 0, medium: 0, hard: 0, [q.difficulty]: 1 }, kinds, topic: topic || undefined, exclude: items.map((x) => x.id) });
            if (!r.items[0]) { toast.info('Không còn câu khác cùng mức độ'); return; }
            const n = r.items[0];
            setItems((l) => l.map((x) => (x.id === q.id ? n : x))); setPoints((p) => ({ ...p, [n.id]: n.points }));
        } catch (e) { toast.error('Không đổi được câu', errMsg(e)); }
    };

    const move = (i: number, d: -1 | 1) => setItems((l) => { const a = [...l]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

    const save = async () => {
        if (!title.trim()) { toast.warning('Hãy đặt tên đề'); return; }
        setBusy(true);
        try {
            const r = await examApi.savePaper({ title: title.trim(), subject_id: subjectId, grade, duration_minutes: duration, items: items.map((q) => ({ question_id: q.id, points: points[q.id] ?? q.points })) });
            toast.success('Đã lưu đề', `Tổng ${r.total_points} điểm`); setSaveOpen(false); setItems([]); setTitle(''); loadPapers(); refresh();
        } catch (e) { toast.error('Không lưu được đề', errMsg(e)); }
        finally { setBusy(false); }
    };

    const open = async (id: number) => { try { setView(await examApi.paper(id)); setAnswers(false); } catch (e) { toast.error('Không mở được đề', errMsg(e)); } };
    const del = async (p: PaperRow) => {
        if (!(await confirm({ title: `Xóa đề «${p.title}»?`, confirmText: 'Xóa đề', tone: 'danger' }))) return;
        try { await examApi.deletePaper(p.id); toast.success('Đã xóa đề'); loadPapers(); } catch (e) { toast.error('Không xóa được', errMsg(e)); }
    };

    return (
        <div className="emu-page">
            <div className="emu-card">
                <div className="emu-card-h"><h3><X name="zap" size={16} /> Tạo đề tự động theo ma trận độ khó</h3></div>
                <div className="emu-card-b emu-col" style={{ gap: 14 }}>
                    <div className="emu-grid emu-g3">
                        <Field label="Môn học"><select className="emu-select" value={subjectId} onChange={(e) => setSubjectId(Number(e.target.value))}>{meta.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
                        <Field label="Khối"><select className="emu-select" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>{[10, 11, 12].map((g) => <option key={g} value={g}>Khối {g}</option>)}</select></Field>
                        <Field label="Chủ đề (không bắt buộc)"><input className="emu-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="VD: Hàm số bậc hai" /></Field>
                    </div>
                    <div className="ex-matrix">
                        {LEVELS.map((lv) => (
                            <Field key={lv} label={`Số câu mức ${DIFF_LABEL[lv].toLowerCase()}`} hint={shortage[lv] ? `Ngân hàng thiếu ${shortage[lv]} câu` : undefined}>
                                <input type="number" className="emu-input" min={0} max={50} value={matrix[lv]} onChange={(e) => setMatrix({ ...matrix, [lv]: Math.max(0, Number(e.target.value)) })} />
                            </Field>
                        ))}
                    </div>
                    <div className="emu-row emu-wrap">
                        <span className="emu-muted" style={{ fontSize: 12.5 }}>Dạng câu:</span>
                        {Object.entries(QKIND_LABEL).map(([k, v]) => (
                            <label key={k} className="emu-row" style={{ cursor: 'pointer', gap: 6 }}><input type="checkbox" className="emu-check" checked={kinds.includes(k)} onChange={(e) => setKinds((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />{v}</label>
                        ))}
                        <span className="emu-spacer" /><span className="emu-badge brand">{want} câu</span>
                        <button className="emu-btn primary" disabled={busy || !subjectId} onClick={generate}><X name="shuffle" size={15} /> {items.length ? 'Tạo lại' : 'Tạo đề'}</button>
                    </div>
                </div>
            </div>

            {items.length > 0 && (
                <div className="emu-card">
                    <div className="emu-card-h"><h3>Xem trước đề · {items.length} câu · {total} điểm</h3><span className="emu-spacer" /><button className="emu-btn primary" onClick={() => setSaveOpen(true)}><X name="save" size={15} /> Lưu đề</button></div>
                    <div style={{ marginTop: 10 }}>
                        {items.map((q, i) => (
                            <div key={q.id} className="ex-q">
                                <b style={{ width: 28 }}>{i + 1}.</b>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="emu-row emu-wrap" style={{ marginBottom: 6 }}><span className={`emu-badge ${DIFF_CLASS[q.difficulty]}`}>{DIFF_LABEL[q.difficulty]}</span><span className="emu-badge">{QKIND_LABEL[q.kind]}</span>{q.topic && <span className="emu-badge violet">{q.topic}</span>}</div>
                                    <QuestionBody q={q} showAnswer />
                                </div>
                                <div className="emu-col" style={{ gap: 6, alignItems: 'flex-end' }}>
                                    <input type="number" className="emu-input" style={{ width: 80, height: 32 }} min={0.1} step={0.25} value={points[q.id] ?? q.points} onChange={(e) => setPoints({ ...points, [q.id]: Number(e.target.value) })} title="Điểm" />
                                    <div className="emu-row" style={{ gap: 4 }}>
                                        <button className="emu-btn sm icon" onClick={() => move(i, -1)} disabled={i === 0}><X name="arrowUp" size={13} /></button>
                                        <button className="emu-btn sm icon" onClick={() => move(i, 1)} disabled={i === items.length - 1}><X name="arrowDown" size={13} /></button>
                                        <button className="emu-btn sm icon" title="Đổi câu khác" onClick={() => reroll(q)}><X name="shuffle" size={13} /></button>
                                        <button className="emu-btn danger sm icon" onClick={() => setItems((l) => l.filter((x) => x.id !== q.id))}><X name="x" size={13} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="emu-card">
                <div className="emu-card-h"><h3>Đề đã lưu</h3><span className="emu-sub">{papers.length} đề</span></div>
                <div className="emu-tw" style={{ marginTop: 12 }}>
                    {papers.length === 0 ? <Empty icon="file" title="Chưa có đề nào" text="Tạo đề tự động ở trên rồi bấm Lưu đề." /> : (
                        <table className="emu-table">
                            <thead><tr><th>Tên đề</th><th>Môn · Khối</th><th className="c">Số câu</th><th className="c">Điểm</th><th className="c">Thời gian</th><th>Ngày tạo</th><th /></tr></thead>
                            <tbody>{papers.map((p) => (
                                <tr key={p.id}><td><b>{p.title}</b>{p.used_in > 0 && <span className="emu-badge ok" style={{ marginLeft: 8 }}>Dùng {p.used_in} bài</span>}</td><td>{p.subject_name} · {p.grade}</td><td className="c">{p.question_count}</td><td className="c">{p.total_points}</td><td className="c">{p.duration_minutes}′</td><td className="emu-num">{fmtDate(p.created_at)}</td>
                                    <td className="r"><button className="emu-btn sm" onClick={() => open(p.id)}><X name="printer" size={13} /> Xem / In</button>{' '}<button className="emu-btn danger sm icon" onClick={() => del(p)}><X name="trash" size={13} /></button></td></tr>
                            ))}</tbody>
                        </table>
                    )}
                </div>
            </div>

            <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title="Lưu đề kiểm tra" subtitle={`${items.length} câu · ${total} điểm`}
                   footer={<><button className="emu-btn" onClick={() => setSaveOpen(false)}>Hủy</button><button className="emu-btn primary" disabled={busy} onClick={save}>Lưu đề</button></>}>
                <Field label="Tên đề"><input className="emu-input" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Đề kiểm tra 1 tiết – Chương 2" autoFocus /></Field>
                <Field label="Thời gian làm bài (phút)"><input type="number" className="emu-input" min={5} max={240} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
            </Modal>

            <Modal open={!!view} onClose={() => setView(null)} width={820} title={view?.title ?? ''} subtitle="Xem trước bản in"
                   footer={<><label className="emu-row" style={{ marginRight: 'auto', cursor: 'pointer' }}><input type="checkbox" className="emu-check" checked={answers} onChange={(e) => setAnswers(e.target.checked)} /> Kèm đáp án (bản cho giáo viên)</label><button className="emu-btn" onClick={() => setView(null)}>Đóng</button><button className="emu-btn primary" onClick={() => window.print()}><X name="printer" size={15} /> In đề</button></>}>
                {view && (
                    <div className="ex-paper-print">
                        <div className="ex-paper">
                            <div className="ex-line"><span>Năm học {view.school_year}</span><span>Họ và tên: ................................  Lớp: ........</span></div>
                            <h2>{view.title}</h2>
                            <div className="ex-meta">Môn: {view.subject_name} — Khối {view.grade} — Thời gian: {view.duration_minutes} phút — Tổng điểm: {view.total_points}</div>
                            {view.items.map((q) => (
                                <div key={q.id} className="q"><b>Câu {q.position}.</b> ({q.points} điểm) <span style={{ whiteSpace: 'pre-wrap' }}>{q.content}</span>
                                    {q.options && <div className="opts">{q.options.map((o, i) => <span key={i} style={answers && q.answer === LETTERS[i] ? { fontWeight: 700, textDecoration: 'underline' } : undefined}>{LETTERS[i]}. {o}</span>)}</div>}
                                    {!q.options && <div style={{ height: 64 }} />}
                                    {answers && q.answer && <div style={{ fontStyle: 'italic', color: '#0a6' }}>Đáp án: {q.answer}</div>}
                                </div>
                            ))}
                            <div style={{ textAlign: 'center', marginTop: 18 }}>— Hết — Giáo viên: {view.teacher_name}</div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}