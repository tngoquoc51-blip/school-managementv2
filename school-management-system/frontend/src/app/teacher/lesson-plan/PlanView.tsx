'use client';

import { useCallback, useEffect, useState } from 'react';
import s from './lessonplan.module.css';
import { lessonPlans, errMsg, type Item, type PlanDetail, type PlanRow } from '@/services/teacherLessonPlan';
import LessonEditor from './LessonEditor';
import { EVENT_LABEL, Icon, SECTION_KEYS, SEM_LABEL, STATUS_LABEL, filled, fmtD, fmtDT, fmtDow, pct, useToast } from './ui';

interface Props { id: number; onChanged: () => void; onClone: (p: PlanRow) => void; onDeleted: () => void; onBack: () => void }
type Tab = 'lessons' | 'weeks' | 'history';

const esc = (v: string | null | undefined) => (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/** In kế hoạch: mở cửa sổ riêng với bố cục văn bản để tránh lẫn giao diện của hệ thống */
function printPlan(d: PlanDetail): boolean {
    const w = window.open('', '_blank');
    if (!w) return false;
    const block = (t: string, v: string | null) => (v && v.trim() ? `<h4>${t}</h4><p>${esc(v)}</p>` : '');
    const lessons = d.items.map((i) => `
      <section class="lesson"><h3>Bài ${i.position}: ${esc(i.title)}</h3>
      <p class="meta">Tuần ${i.week_no} · ${i.periods} tiết${i.planned_date ? ' · Dự kiến ' + fmtD(i.planned_date) : ''}</p>
      <h4>I. MỤC TIÊU</h4>${block('1. Về kiến thức', i.objectives_knowledge)}${block('2. Về năng lực', i.objectives_competence)}${block('3. Về phẩm chất', i.objectives_quality)}
      <h4>II. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU</h4><p>${esc(i.equipment) || '…'}</p>
      <h4>III. TIẾN TRÌNH DẠY HỌC</h4>${block('1. Hoạt động khởi động', i.act_start)}${block('2. Hoạt động hình thành kiến thức mới', i.act_learn)}${block('3. Hoạt động luyện tập', i.act_practice)}${block('4. Hoạt động vận dụng', i.act_apply)}
      ${i.assessment ? '<h4>IV. KIỂM TRA, ĐÁNH GIÁ</h4><p>' + esc(i.assessment) + '</p>' : ''}</section>`).join('');
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
      body{font:14px/1.6 "Times New Roman",serif;color:#111;margin:28px auto;max-width:780px;padding:0 20px}
      h1{text-align:center;font-size:20px;margin:0 0 4px}.sub{text-align:center;margin:0 0 18px;color:#333}
      h3{font-size:16px;margin:0 0 2px}h4{font-size:14px;margin:12px 0 2px}p{margin:2px 0 4px}.meta{color:#444;font-style:italic}
      .lesson{border-top:1.5px solid #111;padding-top:12px;margin-top:20px;page-break-inside:auto}.lesson:first-of-type{border-top:0}
      @media print{body{margin:0}}</style></head><body>
      <h1>KẾ HOẠCH BÀI DẠY</h1><p class="sub">${esc(d.title)}<br>Môn ${esc(d.subject)} · Lớp ${esc(d.class_name)} · ${SEM_LABEL[d.semester] ?? ''} · ${d.total_periods} tiết</p>
      ${d.description ? '<p>' + esc(d.description) + '</p>' : ''}${lessons}</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
    return true;
}

export default function PlanView({ id, onChanged, onClone, onDeleted, onBack }: Props) {
    const toast = useToast();
    const [d, setD] = useState<PlanDetail | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('lessons');
    const [editor, setEditor] = useState<{ item: Item | null } | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { const r = await lessonPlans.show(id); setD(r.data as PlanDetail); setErr(null); } catch (e) { setErr(errMsg(e)); }
    }, [id]);
    useEffect(() => { setD(null); setTab('lessons'); setEditor(null); load(); }, [load]);

    const run = async (fn: () => Promise<any>, okTitle: string, okText?: string) => {
        setBusy(true);
        try { await fn(); toast.push('success', okTitle, okText); await load(); onChanged(); }
        catch (e) { toast.push('error', 'Chưa thực hiện được', errMsg(e)); } finally { setBusy(false); }
    };

    if (err) return <div className={s.emptyPane} role="alert"><h2>Không mở được kế hoạch</h2><p>{err}</p><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={load}>Thử lại</button></div>;
    if (!d) return <div className={s.skelPane} aria-busy="true" />;

    const submit = () => run(async () => { await lessonPlans.submit(d.id); }, 'Đã nộp duyệt', 'Ban giám hiệu sẽ xem xét và phản hồi trong cổng này.');
    const reopen = () => {
        const msg = d.status === 'submitted' ? 'Rút kế hoạch về bản nháp để chỉnh sửa?' : 'Mở lại kế hoạch đã duyệt? Sau khi chỉnh sửa bạn phải nộp duyệt lại.';
        if (window.confirm(msg)) run(async () => { await lessonPlans.reopen(d.id); }, 'Đã mở lại kế hoạch', 'Bạn có thể chỉnh sửa các bài học.');
    };
    const remove = async () => {
        if (!window.confirm(`Xóa kế hoạch "${d.title}" và toàn bộ bài học trong đó?`)) return;
        try { await lessonPlans.remove(d.id); toast.push('success', 'Đã xóa kế hoạch'); onDeleted(); } catch (e) { toast.push('error', 'Chưa xóa được', errMsg(e)); }
    };
    const removeItem = async (i: Item) => {
        if (!window.confirm(`Xóa bài "${i.title}"?`)) return;
        run(async () => { await lessonPlans.removeItem(i.id); }, 'Đã xóa bài học');
    };
    const move = (idx: number, dir: -1 | 1) => {
        const ids = d.items.map((x) => x.id);
        const j = idx + dir;
        if (j < 0 || j >= ids.length) return;
        [ids[idx], ids[j]] = [ids[j], ids[idx]];
        run(async () => { await lessonPlans.reorder(d.id, ids); }, 'Đã sắp xếp lại bài học');
    };
    const toggleTaught = (i: Item) => run(async () => { await lessonPlans.taught(i.id, i.status !== 'taught'); }, i.status === 'taught' ? 'Đã bỏ đánh dấu đã dạy' : 'Đã đánh dấu đã dạy', i.title);

    const canTrack = d.status === 'approved' || d.status === 'submitted';
    const weeks = Array.from(new Set(d.items.map((i) => i.week_no))).sort((a, b) => a - b);
    const progress = pct(d.taught, d.lessons);

    return (
        <div className={s.pane}>
            <button type="button" className={s.backBtn} onClick={onBack}>← Quay lại danh sách</button>
            <header className={s.planHead}>
                <div className={s.planHeadMain}>
                    <p className={s.eyebrow}>{d.subject} · Lớp {d.class_name} · {SEM_LABEL[d.semester]}</p>
                    <h2 className={s.planTitle}>{d.title}</h2>
                    <div className={s.metaRow}>
                        <span className={`${s.badge} ${s['badge_' + d.status]}`}>{STATUS_LABEL[d.status]}</span>
                        <span>{d.lessons} bài, {d.total_periods} tiết</span>
                        <span>Cập nhật {fmtDT(d.updated_at)}</span>
                    </div>
                </div>
                <div className={s.planActs}>
                    {d.can_edit && <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={busy} onClick={submit}><Icon name="send" size={16} />Nộp duyệt</button>}
                    {(d.status === 'submitted' || d.status === 'approved') && <button type="button" className={s.btn} disabled={busy} onClick={reopen}><Icon name="undo" size={16} />{d.status === 'submitted' ? 'Rút lại để sửa' : 'Mở lại để sửa'}</button>}
                    <button type="button" className={s.btn} onClick={() => onClone(d)}><Icon name="copy" size={16} />Sao chép sang lớp khác</button>
                    <button type="button" className={s.btn} onClick={() => { if (!printPlan(d)) toast.push('error', 'Trình duyệt chặn cửa sổ in', 'Hãy cho phép cửa sổ bật lên rồi thử lại.'); }}><Icon name="print" size={16} />In</button>
                    {d.status === 'draft' && <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={remove}><Icon name="trash" size={16} />Xóa</button>}
                </div>
            </header>

            {d.status === 'returned' && (
                <div className={s.bannerWarn} role="alert"><Icon name="alert" size={18} /><div><b>Ban giám hiệu yêu cầu chỉnh sửa{d.reviewer_name ? `, ${d.reviewer_name}` : ''}</b><p>{d.review_note ?? 'Hãy xem lịch sử để biết nội dung cần chỉnh sửa.'}</p></div></div>
            )}
            {d.status === 'submitted' && <div className={s.bannerInfo}><Icon name="history" size={18} />Kế hoạch đang chờ Ban giám hiệu duyệt, tạm thời không chỉnh sửa được.</div>}
            {d.status === 'approved' && <div className={s.bannerOk}><Icon name="check" size={18} />Kế hoạch đã được duyệt{d.reviewed_at ? ` ngày ${fmtD(d.reviewed_at)}` : ''}. Bạn có thể đánh dấu tiến độ đã dạy cho từng bài.</div>}

            <div className={s.progress}>
                <div className={s.progressTop}><b>Tiến độ thực hiện</b><span>{d.taught}/{d.lessons} bài đã dạy ({progress}%)</span></div>
                <div className={s.meter}><i style={{ width: `${progress}%` }} /></div>
            </div>

            <div className={s.tabs} role="tablist">
                {([['lessons', 'Bài học', 'list'], ['weeks', 'Theo tuần', 'grid'], ['history', 'Lịch sử', 'history']] as [Tab, string, string][]).map(([k, l, ic]) => (
                    <button key={k} type="button" role="tab" aria-selected={tab === k} className={`${s.tab} ${tab === k ? s.tabOn : ''}`} onClick={() => setTab(k)}><Icon name={ic} size={15} />{l}</button>
                ))}
                {d.can_edit && <button type="button" className={`${s.btn} ${s.btnSm} ${s.addBtn}`} onClick={() => setEditor({ item: null })}><Icon name="plus" size={15} />Thêm bài học</button>}
            </div>

            {tab === 'lessons' && (
                d.items.length === 0 ? (
                    <div className={s.emptyPane}><Icon name="book" size={34} /><h2>Chưa có bài học nào</h2><p>{d.can_edit ? 'Bấm “Thêm bài học” để soạn bài đầu tiên theo mẫu 4 hoạt động.' : 'Kế hoạch này chưa có bài học.'}</p></div>
                ) : (
                    <ol className={s.items}>
                        {d.items.map((i, idx) => {
                            const n = filled(i).length;
                            return (
                                <li key={i.id} className={`${s.item} ${i.status === 'taught' ? s.itemDone : ''}`}>
                                    <span className={s.pos}>{i.position}</span>
                                    <button type="button" className={s.itemMain} onClick={() => setEditor({ item: i })}>
                                        <span className={s.itemTitle}>{i.title}</span>
                                        <span className={s.itemMeta}>Tuần {i.week_no} · {i.periods} tiết{i.planned_date ? ` · ${fmtDow(i.planned_date)}` : ''}{i.status === 'taught' && i.taught_date ? ` · Đã dạy ${fmtD(i.taught_date)}` : ''}</span>
                                        <span className={s.itemFill} title={`Đã soạn ${n}/${SECTION_KEYS.length} phần`}><i className={n === SECTION_KEYS.length ? s.fillFull : ''} style={{ width: `${(n / SECTION_KEYS.length) * 100}%` }} /><em>{n}/{SECTION_KEYS.length}</em></span>
                                    </button>
                                    <div className={s.itemActs}>
                                        <label className={`${s.taughtBox} ${!canTrack ? s.taughtOff : ''}`} title={canTrack ? 'Đánh dấu đã dạy' : 'Cần nộp và được duyệt kế hoạch trước'}>
                                            <input type="checkbox" checked={i.status === 'taught'} disabled={!canTrack || busy} onChange={() => toggleTaught(i)} />Đã dạy
                                        </label>
                                        {d.can_edit && (
                                            <>
                                                <button type="button" className={s.iconBtn} onClick={() => move(idx, -1)} disabled={busy || idx === 0} aria-label="Chuyển lên"><Icon name="up" size={15} /></button>
                                                <button type="button" className={s.iconBtn} onClick={() => move(idx, 1)} disabled={busy || idx === d.items.length - 1} aria-label="Chuyển xuống"><Icon name="down" size={15} /></button>
                                                <button type="button" className={s.iconBtn} onClick={() => setEditor({ item: i })} aria-label="Sửa bài"><Icon name="edit" size={15} /></button>
                                                <button type="button" className={`${s.iconBtn} ${s.iconDanger}`} onClick={() => removeItem(i)} aria-label="Xóa bài"><Icon name="trash" size={15} /></button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )
            )}

            {tab === 'weeks' && (
                weeks.length === 0 ? <div className={s.emptyPane}><p>Chưa có bài học để xếp theo tuần.</p></div> : (
                    <div className={s.weeks}>
                        {weeks.map((w) => {
                            const list = d.items.filter((i) => i.week_no === w);
                            return (
                                <section key={w} className={s.week}>
                                    <h3>Tuần {w}<span>{list.reduce((a, i) => a + i.periods, 0)} tiết</span></h3>
                                    <ul>{list.map((i) => <li key={i.id}><button type="button" onClick={() => setEditor({ item: i })}><i className={i.status === 'taught' ? s.dotDone : s.dotPlan} />{i.title}</button></li>)}</ul>
                                </section>
                            );
                        })}
                    </div>
                )
            )}

            {tab === 'history' && (
                <ol className={s.timeline}>
                    {[...d.events].reverse().map((e) => (
                        <li key={e.id} className={`${s.tlItem} ${s['tl_' + e.action]}`}>
                            <span className={s.tlDot} />
                            <div><b>{EVENT_LABEL[e.action] ?? e.action}</b> <span className={s.muted}>{e.actor_name}, {fmtDT(e.created_at)}</span>{e.note && <p className={s.tlNote}>{e.note}</p>}</div>
                        </li>
                    ))}
                </ol>
            )}

            {editor && <LessonEditor planId={d.id} item={editor.item} canEdit={d.can_edit} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await load(); onChanged(); }} />}
        </div>
    );
}