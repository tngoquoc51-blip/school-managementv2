'use client';

import { useCallback, useEffect, useState } from 'react';
import { ll } from '../_lib/api';
import { useToast } from '../_lib/toast';
import { RATING_TONE, STATUS_LABEL, STATUS_TONE } from '../_lib/types';
import type { Detail, Meta } from '../_lib/types';
import { Icon, Modal, Pill, dmy, fmtDT } from './ui';
import type { FormInit } from './EntryForm';

interface Props { id: number; meta: Meta; onClose: () => void; onChanged: () => void; onEdit: (i: FormInit) => void }
type Tab = 'info' | 'abs' | 'log';

export default function EntryDrawer({ id, meta, onClose, onChanged, onEdit }: Props) {
    const toast = useToast();
    const [d, setD] = useState<Detail | null>(null);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<Tab>('info');
    const [reopen, setReopen] = useState<string | null>(null);
    const [del, setDel] = useState(false);
    const [cm, setCm] = useState('');
    const [hn, setHn] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { const r = await ll.show(id); setD(r); setHn(r.log.homeroom_note ?? ''); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Không tải được.'); }
    }, [id]);
    useEffect(() => { setD(null); setTab('info'); load(); }, [load]);
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && reopen === null && !del && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, reopen, del]);

    const run = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true);
        try { await fn(); toast({ tone: 'success', title: ok }); await load(); onChanged(); }
        catch (e) { toast({ tone: 'error', title: 'Không thực hiện được', text: e instanceof Error ? e.message : '' }); }
        finally { setBusy(false); }
    };

    const l = d?.log;
    const p = d?.perms;

    return (
        <div className="ll-dr-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="ll-dr" role="dialog" aria-modal="true">
                <header>
                    <div className="top">
                        <div>
                            <small>{l ? `Lớp ${l.class_name} · Tiết ${l.period} · ${dmy(l.lesson_date)}` : 'Đang tải…'}</small>
                            <h2>{l ? `${l.subject_name}${l.title ? ` – ${l.title}` : ''}` : '…'}</h2>
                            {l && <div className="ll-row"><Pill tone={STATUS_TONE[l.status] ?? 'mut'}>{STATUS_LABEL[l.status] ?? l.status}</Pill>{l.rating && <Pill tone={RATING_TONE[l.rating] ?? 'mut'}>Xếp loại: {meta.ratings[l.rating]}</Pill>}<small>GV: {l.teacher_name ?? '—'}</small></div>}
                        </div>
                        <button className="ll-dr-x" onClick={onClose} aria-label="Đóng"><Icon n="x" s={16} /></button>
                    </div>
                    {d && l && p && (
                        <div className="ll-dr-act">
                            {p.can_edit && <button className="ll-btn white sm" onClick={() => onEdit({ class_id: l.class_id, date: l.lesson_date, period: l.period, detail: d })}><Icon n="edit" s={14} />Sửa</button>}
                            {p.can_sign && <button className="ll-btn white sm" disabled={busy} onClick={() => run(() => ll.sign(id), 'Đã ký sổ')}><Icon n="pen" s={14} />Ký sổ</button>}
                            {p.can_unsign && <button className="ll-btn glass sm" disabled={busy} onClick={() => run(() => ll.unsign(id), 'Đã hủy ký sổ')}><Icon n="unlock" s={14} />Hủy ký để sửa</button>}
                            {p.can_reopen && <button className="ll-btn glass sm" onClick={() => setReopen('')}><Icon n="unlock" s={14} />Mở lại</button>}
                            {p.can_delete && <button className="ll-btn glass sm" onClick={() => setDel(true)}><Icon n="trash" s={14} />Xóa</button>}
                            {p.week_locked && <span className="ll-pill ok"><Icon n="lock" s={12} /> Tuần đã được xác nhận</span>}
                        </div>
                    )}
                </header>

                <nav className="ll-dr-tabs">
                    {([['info', 'Nội dung'], ['abs', `Chuyên cần${l ? ` (${l.absent + l.late_count})` : ''}`], ['log', 'Ý kiến & lịch sử']] as [Tab, string][]).map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}
                </nav>

                <div className="ll-dr-b">
                    {err && <div className="ll-alert err"><Icon n="alert" s={16} /><span>{err}</span></div>}
                    {!d && !err && <div className="ll-loading"><i className="ll-spin" />Đang tải…</div>}

                    {d && l && tab === 'info' && (
                        <>
                            <div className="ll-info">
                                <div><span>Tiết PPCT</span><b>{l.lesson_no ?? '—'}</b></div>
                                <div><span>Sĩ số</span><b>{l.total_students}</b></div>
                                <div><span>Có mặt</span><b>{Math.max(0, l.total_students - l.absent - l.late_count)}</b></div>
                                <div><span>Vắng / muộn</span><b>{l.absent} / {l.late_count}</b></div>
                            </div>
                            {l.content && <section className="ll-card"><header><h2>Nội dung đã dạy</h2></header><p className="ll-text">{l.content}</p></section>}
                            {(l.equipment || l.homework) && (
                                <div className="ll-grid2e">
                                    {l.equipment && <section className="ll-card"><header><h2>Thiết bị dạy học</h2></header><p className="ll-text">{l.equipment}</p></section>}
                                    {l.homework && <section className="ll-card"><header><h2>Bài tập về nhà</h2></header><p className="ll-text">{l.homework}</p></section>}
                                </div>
                            )}
                            {l.remark && <section className="ll-card"><header><h2>Nhận xét chung</h2></header><p className="ll-text">{l.remark}</p></section>}
                            {l.discipline_note && <section className="ll-card"><header><h2>Vi phạm, nhắc nhở</h2></header><p className="ll-text">{l.discipline_note}</p></section>}
                            {l.homeroom_note && <p className="ll-note"><b>Ý kiến GVCN:</b> {l.homeroom_note}</p>}
                            <div className="ll-lks">{meta.links.map((x) => <a key={x.url} href={x.url}>{x.label}</a>)}</div>
                        </>
                    )}

                    {d && tab === 'abs' && (
                        <ul className="ll-abl">
                            {d.absences.map((a) => (
                                <li key={a.id}><div className="ll-t"><b>{a.student_name}</b><small>{a.student_code ?? ''}{a.reason ? ` · ${a.reason}` : ''}</small></div>
                                    <Pill tone={a.type === 'unexcused' ? 'err' : a.type === 'late' ? 'warn' : 'sky'}>{meta.absence_types[a.type] ?? a.type}</Pill></li>
                            ))}
                            {!d.absences.length && <li className="ll-empty" style={{ display: 'block' }}>Cả lớp có mặt đầy đủ.</li>}
                        </ul>
                    )}

                    {d && l && tab === 'log' && (
                        <>
                            {p?.can_note && (
                                <section className="ll-card"><header><h2>Ý kiến giáo viên chủ nhiệm</h2></header>
                                    <textarea className="ll-in" rows={3} value={hn} onChange={(e) => setHn(e.target.value)} placeholder="Nhận xét của GVCN về tiết học / lớp…" />
                                    <div style={{ marginTop: 10 }}><button className="ll-btn sm" disabled={busy} onClick={() => run(() => ll.homeroomNote(id, hn), 'Đã ghi ý kiến chủ nhiệm')}>Lưu ý kiến</button></div></section>
                            )}
                            <section className="ll-card"><header><h2>Bình luận</h2></header>
                                <textarea className="ll-in" rows={2} value={cm} onChange={(e) => setCm(e.target.value)} placeholder="Trao đổi về tiết học này…" />
                                <div style={{ marginTop: 10 }}><button className="ll-btn sm" disabled={busy || !cm.trim()} onClick={() => run(async () => { await ll.comment(id, cm.trim()); setCm(''); }, 'Đã gửi bình luận')}><Icon n="send" s={14} />Gửi</button></div></section>
                            <section className="ll-card"><header><h2>Dòng thời gian</h2></header>
                                <ul className="ll-feed">{d.events.map((e) => (
                                    <li key={e.id}><span className={`dot ${e.type === 'comment' ? 'comment' : e.type === 'sign' || e.type === 'confirm' ? 'approval' : 'task'}`}><Icon n={e.type === 'comment' ? 'comment' : e.type === 'sign' || e.type === 'confirm' ? 'check' : 'edit'} s={14} /></span>
                                        <div><span>{e.message}</span><small>{e.actor_name ?? 'Hệ thống'} · {fmtDT(e.created_at)}</small></div></li>
                                ))}</ul></section>
                        </>
                    )}
                </div>
            </aside>

            {reopen !== null && (
                <Modal title="Mở lại sổ đã ký" onClose={() => setReopen(null)} footer={<><button className="ll-btn ghost" onClick={() => setReopen(null)}>Hủy</button>
                    <button className="ll-btn" disabled={busy || reopen.trim().length < 5} onClick={async () => { await run(() => ll.reopen(id, reopen), 'Đã mở lại để chỉnh sửa'); setReopen(null); }}>Mở lại</button></>}>
                    <label className="ll-form" style={{ display: 'grid' }}><span>Lý do (bắt buộc, tối thiểu 5 ký tự)</span><textarea className="ll-in" rows={3} value={reopen} onChange={(e) => setReopen(e.target.value)} autoFocus /></label>
                </Modal>
            )}
            {del && (
                <Modal title="Xóa bản ghi nháp?" onClose={() => setDel(false)} footer={<><button className="ll-btn ghost" onClick={() => setDel(false)}>Không</button>
                    <button className="ll-btn dfill" disabled={busy} onClick={async () => { try { await ll.remove(id); toast({ tone: 'success', title: 'Đã xóa bản ghi' }); onChanged(); onClose(); } catch (e) { toast({ tone: 'error', title: 'Không xóa được', text: e instanceof Error ? e.message : '' }); setDel(false); } }}>Xóa</button></>}>
                    <p>Bản ghi tiết {l?.period} – {l?.subject_name} (lớp {l?.class_name}) sẽ bị xóa cùng danh sách vắng.</p>
                </Modal>
            )}
        </div>
    );
}