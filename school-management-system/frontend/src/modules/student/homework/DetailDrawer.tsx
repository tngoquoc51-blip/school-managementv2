'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import s from './homework.module.css';
import { homeworkService, errorMessage, type Comment, type Detail } from './api';
import { useToast } from './Toast';
import PenScore from './PenScore';
import { dueLabel, fmtDateTime, fmtSize, STATUS_LABEL, TYPE_LABEL } from './utils';

type TabKey = 'brief' | 'work' | 'qa';
const MAX_FILES = 5, MAX_MB = 10;

export default function DetailDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
    const toast = useToast();
    const closeRef = useRef<HTMLButtonElement>(null);
    const [d, setD] = useState<Detail | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('brief');
    const [notes, setNotes] = useState('');
    const [content, setContent] = useState('');
    const [link, setLink] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [comments, setComments] = useState<Comment[] | null>(null);
    const [body, setBody] = useState('');

    const load = useCallback(async () => {
        try {
            const x = await homeworkService.detail(id);
            setD(x); setNotes(x.notes ?? ''); setContent(x.submission?.content ?? ''); setLink(x.submission?.link_url ?? '');
        } catch (e) { setErr(errorMessage(e)); }
    }, [id]);

    useEffect(() => { setD(null); setErr(null); setTab('brief'); setFiles([]); setComments(null); load(); }, [load]);
    useEffect(() => { closeRef.current?.focus(); }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    useEffect(() => {
        if (tab === 'qa' && comments === null) homeworkService.comments(id).then(setComments).catch((e) => toast.push('error', 'Chưa tải được hỏi đáp', errorMessage(e)));
    }, [tab, comments, id, toast]);

    const saveState = async (patch: { starred?: boolean; progress?: number; notes?: string | null }) => {
        try {
            const r = await homeworkService.saveState(id, patch);
            setD((x) => (x ? { ...x, starred: r.starred, progress: r.progress, notes: r.notes } : x));
            onChanged();
        } catch (e) { toast.push('error', 'Chưa lưu được', errorMessage(e)); }
    };

    const addFiles = (list: FileList | null) => {
        if (!list) return;
        const next = [...files];
        for (const f of Array.from(list)) {
            if (f.size > MAX_MB * 1024 * 1024) { toast.push('error', `Tệp "${f.name}" quá lớn`, `Mỗi tệp tối đa ${MAX_MB} MB.`); continue; }
            if (next.length >= MAX_FILES) { toast.push('info', `Chỉ đính kèm tối đa ${MAX_FILES} tệp`); break; }
            next.push(f);
        }
        setFiles(next);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!d) return;
        if (!content.trim() && !link.trim() && files.length === 0) {
            toast.push('error', 'Chưa có nội dung để nộp', 'Hãy nhập nội dung, dán liên kết hoặc đính kèm tệp.');
            return;
        }
        if (dueLabel(d.due_at).tone === 'late' && !window.confirm('Bài này đã quá hạn. Bài nộp sẽ được đánh dấu là nộp muộn. Em vẫn muốn nộp?')) return;
        const fd = new FormData();
        if (content.trim()) fd.append('content', content.trim());
        if (link.trim()) fd.append('link_url', link.trim());
        files.forEach((f) => fd.append('files[]', f));
        setSending(true);
        try {
            const r = await homeworkService.submit(id, fd);
            toast.push('success', r.attempt > 1 ? 'Đã nộp lại bài' : 'Đã nộp bài', r.is_late ? 'Bài được ghi nhận là nộp muộn.' : `${d.title} đã được ghi nhận lúc ${fmtDateTime(r.submitted_at)}.`);
            setFiles([]); setTab('work'); await load(); onChanged();
        } catch (er) { toast.push('error', 'Chưa nộp được bài', errorMessage(er)); }
        finally { setSending(false); }
    };

    const postComment = async (e: FormEvent) => {
        e.preventDefault();
        if (body.trim().length < 2) return;
        try {
            const c = await homeworkService.addComment(id, body.trim());
            setComments((a) => [...(a ?? []), c]); setBody('');
        } catch (er) { toast.push('error', 'Chưa gửi được câu hỏi', errorMessage(er)); }
    };

    const due = d ? dueLabel(d.due_at) : null;
    const sub = d?.submission ?? null;

    return (
        <>
            <div className={s.scrim} onClick={onClose} />
            <aside className={s.drawer} role="dialog" aria-modal="true" aria-label="Chi tiết bài tập">
                <div className={s.dHead}>
                    <div>
                        {d && <span className={s.chip}>{d.subject}</span>}
                        <h2 className={s.dTitle}>{d ? d.title : err ? 'Không mở được bài tập' : 'Đang tải…'}</h2>
                        {d && due && (
                            <p className={s.dMeta}>
                                <span className={`${s.badge} ${s['badge_' + d.status]}`}>{STATUS_LABEL[d.status]}</span>
                                <span>Hạn nộp {fmtDateTime(d.due_at)}</span>
                                {(d.status === 'todo' || d.status === 'overdue' || d.status === 'returned') && <span className={`${s.due} ${s['due_' + due.tone]}`}>{due.text}</span>}
                            </p>
                        )}
                    </div>
                    <button ref={closeRef} type="button" className={s.dClose} aria-label="Đóng" onClick={onClose}>×</button>
                </div>

                {err && <div className={s.dBody}><div className={s.empty} role="alert"><p>{err}</p><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => { setErr(null); load(); }}>Thử lại</button></div></div>}

                {d && (
                    <>
                        <div className={s.dTabs} role="tablist">
                            {([['brief', 'Đề bài'], ['work', 'Bài nộp'], ['qa', `Hỏi đáp${d.comments_count ? ` (${d.comments_count})` : ''}`]] as [TabKey, string][]).map(([k, label]) => (
                                <button key={k} type="button" role="tab" aria-selected={tab === k} className={`${s.dTab} ${tab === k ? s.dTabOn : ''}`} onClick={() => setTab(k)}>{label}</button>
                            ))}
                        </div>

                        <div className={s.dBody}>
                            {tab === 'brief' && (
                                <>
                                    <dl className={s.facts}>
                                        <div><dt>Giáo viên</dt><dd>{d.teacher}</dd></div>
                                        <div><dt>Loại bài</dt><dd>{TYPE_LABEL[d.type] ?? 'Bài tập'}</dd></div>
                                        <div><dt>Giao lúc</dt><dd>{fmtDateTime(d.assigned_at)}</dd></div>
                                        <div><dt>Điểm tối đa</dt><dd>{d.max_score}</dd></div>
                                    </dl>
                                    <p className={s.desc}>{d.description || 'Giáo viên chưa ghi mô tả cho bài này.'}</p>
                                    {d.attachments.length > 0 && (
                                        <ul className={s.files}>
                                            {d.attachments.map((a) => (
                                                <li key={a.id}><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.size_kb ? <span className={s.muted}>{fmtSize(a.size_kb)}</span> : null}</li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className={s.mine}>
                                        <h3>Theo dõi cá nhân</h3>
                                        <p className={s.muted}>Chỉ mình em thấy phần này.</p>
                                        <div className={s.steps} role="group" aria-label="Mức độ đã làm">
                                            {[0, 25, 50, 75, 100].map((p) => (
                                                <button key={p} type="button" className={`${s.step} ${d.progress === p ? s.stepOn : ''}`} aria-pressed={d.progress === p} onClick={() => saveState({ progress: p })}>{p}%</button>
                                            ))}
                                        </div>
                                        <label className={s.field}>
                                            <span>Ghi chú riêng</span>
                                            <textarea rows={3} maxLength={1000} value={notes} placeholder="Ví dụ: làm câu 1–3 trước, hỏi cô câu 5" onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} onBlur={() => notes !== (d.notes ?? '') && saveState({ notes: notes.trim() || null })} />
                                        </label>
                                    </div>
                                </>
                            )}

                            {tab === 'work' && (
                                <>
                                    {sub && (
                                        <section className={s.sheet}>
                                            <div className={s.sheetTop}>
                                                <div>
                                                    <strong>Lần nộp thứ {sub.attempt}</strong>
                                                    <p className={s.muted}>{fmtDateTime(sub.submitted_at)}{sub.is_late ? ', nộp muộn' : ', đúng hạn'}</p>
                                                </div>
                                                {sub.status === 'graded' && sub.score !== null && <PenScore big score={sub.score} max={d.max_score} />}
                                            </div>
                                            {sub.content && <p className={s.desc}>{sub.content}</p>}
                                            {sub.link_url && <p><a href={sub.link_url} target="_blank" rel="noopener noreferrer">{sub.link_url}</a></p>}
                                            {sub.files.length > 0 && (
                                                <ul className={s.files}>
                                                    {sub.files.map((f) => (
                                                        <li key={f.id}>
                                                            <button type="button" className={s.linkBtn} onClick={() => homeworkService.download(f.id, f.name).catch((e) => toast.push('error', 'Chưa tải được tệp', errorMessage(e)))}>{f.name}</button>
                                                            <span className={s.muted}>{fmtSize(f.size_kb)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {sub.feedback && (sub.status === 'graded' || sub.status === 'returned') && (
                                                <blockquote className={s.feedback}>
                                                    <span className={s.feedbackLabel}>{sub.status === 'returned' ? 'Giáo viên yêu cầu làm lại' : 'Nhận xét của giáo viên'}</span>
                                                    {sub.feedback}
                                                </blockquote>
                                            )}
                                        </section>
                                    )}

                                    {d.can_submit ? (
                                        <form className={s.form} onSubmit={submit}>
                                            <h3>{sub ? 'Nộp lại bài' : 'Nộp bài'}</h3>
                                            <label className={s.field}>
                                                <span>Nội dung bài làm</span>
                                                <textarea rows={6} maxLength={20000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Gõ câu trả lời hoặc ghi chú cho giáo viên" />
                                            </label>
                                            <label className={s.field}>
                                                <span>Liên kết (không bắt buộc)</span>
                                                <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/…" />
                                            </label>
                                            <div className={s.field}>
                                                <span>Tệp đính kèm (tối đa {MAX_FILES} tệp, mỗi tệp {MAX_MB} MB)</span>
                                                <label className={s.drop} onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={(e: DragEvent<HTMLLabelElement>) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
                                                    <input type="file" multiple className={s.srOnly} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.zip" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                                                    Kéo thả tệp vào đây hoặc bấm để chọn
                                                </label>
                                                {files.length > 0 && (
                                                    <ul className={s.files}>
                                                        {files.map((f, i) => (
                                                            <li key={`${f.name}-${i}`}>{f.name}<span className={s.muted}>{fmtSize(Math.ceil(f.size / 1024))}</span>
                                                                <button type="button" className={s.linkBtn} aria-label={`Bỏ tệp ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>Bỏ</button></li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {sub && files.length > 0 && sub.files.length > 0 && <p className={s.muted}>Tệp mới sẽ thay thế các tệp đã nộp trước đó.</p>}
                                            </div>
                                            <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={sending}>{sending ? 'Đang nộp…' : sub ? 'Nộp lại bài' : 'Nộp bài'}</button>
                                        </form>
                                    ) : (
                                        <p className={s.notice}>{d.submit_block_reason}</p>
                                    )}
                                </>
                            )}

                            {tab === 'qa' && (
                                <>
                                    <p className={s.muted}>Câu hỏi hiển thị với cả lớp và giáo viên bộ môn.</p>
                                    {comments === null ? <p className={s.muted}>Đang tải…</p> : comments.length === 0 ? (
                                        <p className={s.notice}>Chưa có câu hỏi nào. Em cứ hỏi nếu chưa rõ đề bài.</p>
                                    ) : (
                                        <ul className={s.thread}>
                                            {comments.map((c) => (
                                                <li key={c.id} className={`${s.msg} ${c.mine ? s.msgMine : ''}`}>
                                                    <strong>{c.author_name}{c.author_type === 'teacher' ? ' (giáo viên)' : ''}</strong>
                                                    <p>{c.body}</p>
                                                    <span className={s.muted}>{fmtDateTime(c.created_at)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <form className={s.ask} onSubmit={postComment}>
                                        <label className={s.srOnly} htmlFor="hw-ask">Câu hỏi của em</label>
                                        <textarea id="hw-ask" rows={2} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Em chưa hiểu câu nào?" />
                                        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={body.trim().length < 2}>Gửi câu hỏi</button>
                                    </form>
                                </>
                            )}
                        </div>
                    </>
                )}
            </aside>
        </>
    );
}