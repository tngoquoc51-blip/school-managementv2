'use client';

import { useEffect, useState } from 'react';
import { apiError, cmtApi } from '@/services/teacherCommentService';
import { useToast } from '@/components/Toast';
import StudentModal from '../StudentModal';
import { Empty, ErrorBox, Icon, Modal, RATING, RatingPicker, Skeleton, Spin, TagPicker, colorOf, fmtDateTime, fmtScore, initials, scoreColor, useDebounced, useFetch } from '../ui';
import type { Filters, RosterStudent } from '../types';
import s from '../comments.module.css';

interface Edit { rating: string; content: string; tags: string[] }
const EMPTY: Edit = { rating: '', content: '', tags: [] };
const same = (a?: Edit, b?: Edit) => JSON.stringify(a) === JSON.stringify(b);

export default function WriteTab({ f, onChanged }: { f: Filters; onChanged: () => void }) {
    const toast = useToast();
    const key = JSON.stringify(f);
    const { data, loading, error, reload } = useFetch(() => cmtApi.roster(f), [key]);
    const [edits, setEdits] = useState<Record<number, Edit>>({});
    const [base, setBase] = useState<Record<number, Edit>>({});
    const [qIn, setQIn] = useState(''); const q = useDebounced(qIn, 250);
    const [only, setOnly] = useState<'all' | 'todo' | 'draft' | 'done'>('all');
    const [busy, setBusy] = useState(false);
    const [picker, setPicker] = useState<RosterStudent | null>(null);
    const [detail, setDetail] = useState<number | null>(null);
    const [del, setDel] = useState<RosterStudent | null>(null);
    const [tagOpen, setTagOpen] = useState<number | null>(null);

    useEffect(() => {
        if (!data) return;
        const m: Record<number, Edit> = {};
        data.students.forEach((st) => { const c = st.comment; m[st.id] = { rating: c?.rating || '', content: c?.content || '', tags: c?.tags ? c.tags.split(',') : [] }; });
        setEdits(m); setBase(JSON.parse(JSON.stringify(m)));
    }, [data]);

    const students = data?.students ?? [];
    const isDirty = (id: number) => !same(edits[id], base[id]);
    const dirtyCount = students.filter((st) => isDirty(st.id)).length;
    const written = students.filter((st) => st.comment).length;
    const patch = (id: number, p: Partial<Edit>) => setEdits((e) => ({ ...e, [id]: { ...(e[id] ?? EMPTY), ...p } }));
    const list = students.filter((st) => {
        if (q && !`${st.full_name} ${st.code}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (only === 'todo') return !st.comment && !(edits[st.id]?.content);
        if (only === 'draft') return st.comment?.status === 'draft';
        if (only === 'done') return st.comment?.status === 'published';
        return true;
    });

    function suggestOne(st: RosterStudent, silent = false) {
        if (!st.suggest.text) { if (!silent) toast.info('Chưa có điểm để gợi ý', 'Hãy nhập điểm cho học sinh này trước.'); return false; }
        patch(st.id, { rating: st.suggest.rating || '', content: st.suggest.text });
        return true;
    }
    function suggestAll() {
        let n = 0;
        students.forEach((st) => { if (!(edits[st.id]?.content || '').trim() && suggestOne(st, true)) n++; });
        n ? toast.success(`Đã gợi ý nhận xét cho ${n} học sinh`, 'Hãy đọc lại và chỉnh sửa trước khi lưu.') : toast.info('Không có ô trống nào có thể gợi ý');
    }

    async function saveAll(status: 'draft' | 'published') {
        const items = students.filter((st) => {
            const e = edits[st.id]; if (!e || e.content.trim().length < 3) return false;
            return isDirty(st.id) || (status === 'published' && st.comment?.status !== 'published');
        }).map((st) => ({
            student_id: st.id, class_subject_id: f.cs, semester: f.semester, kind: f.kind, period: f.period,
            rating: edits[st.id].rating || st.suggest.rating || 'good', content: edits[st.id].content.trim(), tags: edits[st.id].tags,
            status: (status === 'draft' && st.comment?.status === 'published' ? 'published' : status) as 'draft' | 'published',
        }));
        if (!items.length) return toast.info('Không có nhận xét nào cần lưu');
        setBusy(true);
        try {
            await cmtApi.bulk(items);
            toast.success(status === 'published' ? `Đã lưu và công bố ${items.length} nhận xét` : `Đã lưu ${items.length} nhận xét`);
            await reload(); onChanged();
        } catch (e) { toast.error('Không lưu được', apiError(e).message); } finally { setBusy(false); }
    }

    async function unpublish() {
        setBusy(true);
        try { const r = await cmtApi.setStatus(f, 'draft'); toast.success(`Đã thu hồi ${r.changed} nhận xét về bản nháp`); await reload(); onChanged(); }
        catch (e) { toast.error('Không thu hồi được', apiError(e).message); } finally { setBusy(false); }
    }

    async function doDelete() {
        if (!del) return; setBusy(true);
        try {
            if (del.comment) { await cmtApi.remove(del.comment.id); toast.success('Đã xóa nhận xét', del.full_name); await reload(); onChanged(); }
            else patch(del.id, EMPTY);
            setDel(null);
        } catch (e) { toast.error('Không xóa được', apiError(e).message); } finally { setBusy(false); }
    }

    const status = (st: RosterStudent) => (isDirty(st.id) ? ['Chưa lưu', s.bWarn] : st.comment ? (st.comment.status === 'published' ? ['Đã công bố', s.bOk] : ['Bản nháp', s.bInfo]) : ['Chưa nhận xét', s.bMute]);

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}>
                    <div><h3 className={s.cardTitle}><Icon n="pen" /> Soạn nhận xét {data ? `– Lớp ${data.assignment.class_name} · ${data.assignment.subject_name}` : ''}</h3>
                        <div className={s.cardSub}>{written}/{students.length} học sinh đã có nhận xét · {dirtyCount} thay đổi chưa lưu</div></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className={s.btn} onClick={suggestAll} disabled={busy || !students.length}><Icon n="wand" size={16} /> Gợi ý cho ô trống</button>
                        <button className={`${s.btn} ${s.btnP}`} onClick={() => saveAll('published')} disabled={busy || !students.length}>{busy ? <Spin /> : <Icon n="send" size={16} />} Công bố tất cả</button>
                        <button className={s.btn} onClick={unpublish} disabled={busy || !students.some((x) => x.comment?.status === 'published')}>Thu hồi công bố</button>
                    </div>
                </div>
                <div className={s.bar} style={{ marginBottom: 14 }}><div className={s.barFill} style={{ width: `${students.length ? Math.round((written / students.length) * 100) : 0}%` }} /></div>
                <div className={s.toolbar}>
                    <input className={s.input} style={{ minWidth: 240 }} placeholder="Tìm học sinh theo tên hoặc mã…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                    <div className={s.filters}>{([['all', 'Tất cả'], ['todo', 'Chưa nhận xét'], ['draft', 'Bản nháp'], ['done', 'Đã công bố']] as const).map(([k, l]) => <button key={k} className={`${s.pill} ${only === k ? s.pillOn : ''}`} onClick={() => setOnly(k)}>{l}</button>)}</div>
                </div>

                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={110} n={4} /> : list.length === 0 ? <Empty icon="📝" text="Không có học sinh phù hợp bộ lọc." /> : (
                    <div style={{ opacity: loading ? 0.6 : 1 }}>{list.map((st) => {
                        const e = edits[st.id] ?? EMPTY; const [lb, cl] = status(st) as [string, string];
                        const tx = [st.scores.tx1, st.scores.tx2, st.scores.tx3, st.scores.tx4].filter((x) => x !== null).map((x) => fmtScore(x)).join(' · ') || '—';
                        return (
                            <div key={st.id} className={`${s.stRow} ${isDirty(st.id) ? s.stDirty : ''}`}>
                                <div className={s.stHead}>
                                    <div className={s.avatarMini} style={{ background: colorOf(st.full_name) }}>{initials(st.full_name)}</div>
                                    <div style={{ minWidth: 0 }}>
                                        <div className={s.stName} onClick={() => setDetail(st.id)} title="Xem hồ sơ học tập">{st.full_name}</div>
                                        <div className={s.cardSub}>{st.code} · {st.gender}</div>
                                        <div style={{ marginTop: 6 }}><span className={s.chipScore} style={{ color: scoreColor(st.score) }}>TBM {fmtScore(st.score)}
                                            {st.suggest.trend === 'up' && <span className={s.trendUp}><Icon n="up" size={13} /></span>}{st.suggest.trend === 'down' && <span className={s.trendDown}><Icon n="down" size={13} /></span>}</span></div>
                                        <div className={s.scoreLine}>TX: {tx}<br />GK: {fmtScore(st.scores.gk)} · CK: {fmtScore(st.scores.ck)}</div>
                                    </div>
                                </div>
                                <div className={s.areaWrap}>
                                    <RatingPicker value={e.rating} onChange={(v) => patch(st.id, { rating: v })} />
                                    <textarea className={s.textarea} style={{ minHeight: 76 }} maxLength={1000} value={e.content} placeholder="Viết nhận xét… hoặc bấm “Gợi ý” / “Mẫu”"
                                              onChange={(ev) => patch(st.id, { content: ev.target.value, rating: e.rating || st.suggest.rating || '' })} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button type="button" className={`${s.btn} ${s.btnS}`} onClick={() => setTagOpen(tagOpen === st.id ? null : st.id)}>{e.tags.length ? `${e.tags.length} đặc điểm` : '+ Đặc điểm'}</button>
                                        <span className={s.count}>{e.content.length}/1000</span>
                                    </div>
                                    {tagOpen === st.id && <TagPicker value={e.tags} onChange={(v) => patch(st.id, { tags: v })} />}
                                </div>
                                <div className={s.actions}>
                                    <span className={`${s.badge} ${cl}`} style={{ alignSelf: 'flex-start' }}>{lb}</span>
                                    {st.comment && <span className={s.cardSub}>{fmtDateTime(st.comment.updated_at)}</span>}
                                    <button className={`${s.btn} ${s.btnS}`} onClick={() => suggestOne(st)}><Icon n="wand" size={14} /> Gợi ý</button>
                                    <button className={`${s.btn} ${s.btnS}`} onClick={() => setPicker(st)}><Icon n="template" size={14} /> Mẫu</button>
                                    {(st.comment || e.content) && <button className={`${s.btn} ${s.btnS} ${s.btnD}`} onClick={() => setDel(st)}><Icon n="trash" size={14} /> Xóa</button>}
                                </div>
                            </div>);
                    })}</div>)}
            </section>

            {dirtyCount > 0 && (
                <div className={s.saveBar} role="alert">
                    <span>{dirtyCount} nhận xét chưa lưu</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={s.btn} onClick={() => setEdits(JSON.parse(JSON.stringify(base)))} disabled={busy}>Hoàn tác</button>
                        <button className={s.btn} onClick={() => saveAll('draft')} disabled={busy}>{busy ? <Spin /> : <Icon n="check" size={16} />} Lưu nháp</button>
                        <button className={`${s.btn} ${s.btnP}`} onClick={() => saveAll('published')} disabled={busy}><Icon n="send" size={15} /> Lưu & công bố</button>
                    </div>
                </div>)}

            {picker && <TemplatePicker rating={edits[picker.id]?.rating || picker.suggest.rating || ''} onClose={() => setPicker(null)}
                                       onPick={(t) => { patch(picker.id, { content: t.body, rating: edits[picker.id]?.rating || (t.rating !== 'any' ? t.rating : '') }); cmtApi.useTemplate(t.id); setPicker(null); }} />}
            {detail && <StudentModal studentId={detail} cs={f.cs} onClose={() => setDetail(null)} />}
            {del && (
                <Modal title="Xóa nhận xét?" onClose={() => setDel(null)}>
                    <p>{del.comment ? <>Xóa nhận xét đã lưu của <b>{del.full_name}</b>? Hành động này không thể hoàn tác.</> : <>Xóa nội dung đang soạn của <b>{del.full_name}</b>?</>}</p>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setDel(null)}>Hủy</button><button className={`${s.btn} ${s.btnD}`} disabled={busy} onClick={doDelete}>{busy && <Spin />} Xóa</button></div>
                </Modal>)}
        </div>
    );
}

function TemplatePicker({ rating, onPick, onClose }: { rating: string; onPick: (t: { id: number; rating: string; body: string }) => void; onClose: () => void }) {
    const { data, loading } = useFetch(() => cmtApi.templates(rating), [rating]);
    return (
        <Modal title={rating ? `Mẫu nhận xét – mức ${RATING[rating]?.label}` : 'Mẫu nhận xét'} wide onClose={onClose}>
            {loading ? <Skeleton h={60} n={3} /> : !data?.length ? <Empty text="Chưa có mẫu phù hợp. Bạn có thể tạo mẫu riêng ở tab “Mẫu nhận xét”." /> : (
                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>{data.map((t) => (
                    <div key={t.id} className={s.tplItem} onClick={() => onPick(t)}>
                        <b>{t.title} {t.rating !== 'any' && <span className={s.badge} style={{ background: RATING[t.rating].bg, color: RATING[t.rating].color }}>{RATING[t.rating].label}</span>} {!t.is_system && <span className={`${s.badge} ${s.bInfo}`}>Của tôi</span>}</b>
                        <span className={s.cardSub}>{t.body}</span></div>))}</div>)}
        </Modal>
    );
}