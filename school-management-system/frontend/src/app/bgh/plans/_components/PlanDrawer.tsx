'use client';

import { useCallback, useEffect, useState } from 'react';
import { pl } from '../_lib/api';
import { useToast } from '../_lib/toast';
import { PRIORITY_TONE, STATUS_TONE, TASK_TONE } from '../_lib/types';
import type { Detail, Options, Plan, Task } from '../_lib/types';
import { Bar, Icon, Modal, Pill, fmtDT, fmtDate, vnd } from './ui';

interface Props { id: number; opts: Options; onClose: () => void; onChanged: () => void; onOpen: (id: number) => void; onEdit: (p: Plan) => void }
type Tab = 'info' | 'tasks' | 'links' | 'log';

const ACTIONS: Record<string, { to: string; label: string; cls: string; need?: boolean }[]> = {
    draft: [{ to: 'pending', label: 'Gửi phê duyệt', cls: 'white' }],
    pending: [{ to: 'approved', label: 'Phê duyệt', cls: 'white' }, { to: 'rejected', label: 'Từ chối', cls: 'glass', need: true }, { to: 'draft', label: 'Trả về nháp', cls: 'glass' }],
    approved: [{ to: 'running', label: 'Bắt đầu thực hiện', cls: 'white' }],
    running: [{ to: 'completed', label: 'Hoàn thành', cls: 'white' }, { to: 'paused', label: 'Tạm dừng', cls: 'glass' }],
    paused: [{ to: 'running', label: 'Tiếp tục', cls: 'white' }],
    rejected: [{ to: 'draft', label: 'Chuyển về nháp', cls: 'white' }],
    cancelled: [{ to: 'draft', label: 'Khôi phục', cls: 'white' }],
};

export default function PlanDrawer({ id, opts, onClose, onChanged, onOpen, onEdit }: Props) {
    const toast = useToast();
    const [d, setD] = useState<Detail | null>(null);
    const [err, setErr] = useState('');
    const [tab, setTab] = useState<Tab>('info');
    const [ask, setAsk] = useState<{ to: string; label: string; need: boolean; force?: boolean; msg?: string } | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [nt, setNt] = useState({ title: '', assignee_name: '', due_date: '', priority: 'normal', weight: '5' });
    const [cm, setCm] = useState('');
    const [lk, setLk] = useState({ label: '', url: '' });
    const [dup, setDup] = useState<string | null>(null);
    const [del, setDel] = useState(false);

    const load = useCallback(async () => {
        try { setD(await pl.show(id)); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Không tải được.'); }
    }, [id]);
    useEffect(() => { setD(null); setTab('info'); load(); }, [load]);
    useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && !ask && !dup && !del && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, ask, dup, del]);

    const done = () => { load(); onChanged(); };
    const bad = (title: string, e: unknown) => toast({ tone: 'error', title, text: e instanceof Error ? e.message : '' });

    const transition = async (to: string, text?: string, force?: boolean) => {
        setBusy(true);
        try { await pl.transition(id, to, text || undefined, force); toast({ tone: 'success', title: opts.statuses[to] }); setAsk(null); setNote(''); done(); }
        catch (e) {
            const m = e instanceof Error ? e.message : '';
            if (to === 'completed' && m.includes('chưa hoàn thành')) setAsk({ to, label: 'Vẫn hoàn thành', need: false, force: true, msg: m });
            else bad('Không chuyển được trạng thái', e);
        } finally { setBusy(false); }
    };
    const click = (a: { to: string; label: string; need?: boolean }) => (a.need || a.to === 'approved' ? setAsk({ to: a.to, label: a.label, need: !!a.need }) : transition(a.to));

    const addTask = async () => {
        if (!nt.title.trim()) return toast({ tone: 'warn', title: 'Nhập tên nhiệm vụ' });
        try { await pl.addTask(id, { ...nt, due_date: nt.due_date || null, assignee_name: nt.assignee_name || null, weight: Number(nt.weight) }); setNt({ ...nt, title: '' }); toast({ tone: 'success', title: 'Đã thêm nhiệm vụ' }); done(); }
        catch (e) { bad('Không thêm được', e); }
    };
    const setTask = async (t: Task, status: string) => { try { await pl.updateTask(t.id, { status }); done(); } catch (e) { bad('Không cập nhật được', e); } };
    const delTask = async (t: Task) => { if (!confirm(`Xóa nhiệm vụ “${t.title}”?`)) return; try { await pl.deleteTask(t.id); done(); } catch (e) { bad('Không xóa được', e); } };
    const sendCm = async () => { if (!cm.trim()) return; try { await pl.comment(id, cm.trim()); setCm(''); done(); } catch (e) { bad('Không gửi được', e); } };
    const addLink = async (label: string, url: string, kind = 'other') => { if (!label.trim()) return toast({ tone: 'warn', title: 'Nhập tên liên kết' }); try { await pl.addLink(id, { label, url: url || undefined, kind }); setLk({ label: '', url: '' }); done(); } catch (e) { bad('Không thêm được', e); } };
    const delLink = async (lid: number) => { try { await pl.deleteLink(lid); done(); } catch (e) { bad('Không gỡ được', e); } };
    const doDup = async () => { if (!dup) return; try { const nid = await pl.duplicate(id, dup); toast({ tone: 'success', title: 'Đã nhân bản kế hoạch' }); setDup(null); onChanged(); onOpen(nid); } catch (e) { bad('Không nhân bản được', e); } };
    const doDel = async () => { try { await pl.remove(id); toast({ tone: 'success', title: 'Đã xóa kế hoạch' }); onChanged(); onClose(); } catch (e) { bad('Không xóa được', e); setDel(false); } };

    const p = d?.plan;
    const acts = p ? ACTIONS[p.status] ?? [] : [];
    const canCancel = p ? (opts.transitions[p.status] ?? []).includes('cancelled') : false;
    const canEdit = p ? !['completed', 'cancelled'].includes(p.status) : false;
    const canDel = p ? ['draft', 'cancelled', 'rejected'].includes(p.status) : false;
    const late = (t: Task) => t.status !== 'done' && !!t.due_date && t.due_date < new Date().toISOString().slice(0, 10);

    return (
        <div className="pl-dr-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="pl-dr" role="dialog" aria-modal="true">
                <header>
                    <div className="top">
                        <div>
                            <small>{p ? `${p.code} · ${opts.levels[p.level]} · ${opts.categories[p.category]}` : 'Đang tải…'}</small>
                            <h2>{p?.title ?? '…'}</h2>
                            {p && <div className="pl-row"><Pill tone={STATUS_TONE[p.status] ?? 'mut'}>{opts.statuses[p.status]}</Pill><Pill tone={PRIORITY_TONE[p.priority] ?? 'mut'}>Ưu tiên: {opts.priorities[p.priority]}</Pill>{p.is_late && <Pill tone="err">Trễ hạn {Math.abs(p.days_left ?? 0)} ngày</Pill>}</div>}
                        </div>
                        <button className="pl-dr-x" onClick={onClose} aria-label="Đóng"><Icon n="x" s={16} /></button>
                    </div>
                    {p && (
                        <>
                            <div style={{ marginTop: 12 }}><Bar value={p.progress} tone={p.progress >= 100 ? 'ok' : 'sky'} /><small>Tiến độ {p.progress}%{p.tasks_total ? ` · ${p.tasks_done}/${p.tasks_total} nhiệm vụ` : ''}</small></div>
                            <div className="pl-dr-act">
                                {acts.map((a) => <button key={a.to} className={`pl-btn ${a.cls} sm`} onClick={() => click(a)}>{a.label}</button>)}
                                {canEdit && <button className="pl-btn glass sm" onClick={() => onEdit(p)}><Icon n="edit" s={14} />Sửa</button>}
                                <button className="pl-btn glass sm" onClick={() => setDup(new Date().toISOString().slice(0, 10))}><Icon n="copy" s={14} />Nhân bản</button>
                                {canCancel && <button className="pl-btn glass sm" onClick={() => setAsk({ to: 'cancelled', label: 'Hủy kế hoạch', need: false })}>Hủy kế hoạch</button>}
                                {canDel && <button className="pl-btn glass sm" onClick={() => setDel(true)}><Icon n="trash" s={14} />Xóa</button>}
                            </div>
                        </>
                    )}
                </header>

                <nav className="pl-dr-tabs">
                    {([['info', 'Tổng quan'], ['tasks', `Nhiệm vụ${p ? ` (${p.tasks_total})` : ''}`], ['links', `Liên kết${d ? ` (${d.links.length})` : ''}`], ['log', 'Hoạt động & bình luận']] as [Tab, string][]).map(([k, l]) => (
                        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
                    ))}
                </nav>

                <div className="pl-dr-b">
                    {err && <div className="pl-alert err"><Icon n="alert" s={16} /><span>{err}</span></div>}
                    {!d && !err && <div className="pl-loading"><i className="pl-spin" />Đang tải…</div>}

                    {d && p && tab === 'info' && (
                        <>
                            <div className="pl-info">
                                <div><span>Người phụ trách</span><b>{p.owner_name || '—'}</b></div>
                                <div><span>Tổ / Phòng ban</span><b>{p.department || '—'}</b></div>
                                <div><span>Thời gian</span><b>{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</b></div>
                                <div><span>Năm học / Học kỳ</span><b>{p.school_year || '—'}{p.term ? ` · ${p.term}` : ''}</b></div>
                                <div><span>Dự toán</span><b>{vnd(p.budget)}</b></div>
                                <div><span>Đã chi</span><b>{vnd(p.spent)}{p.budget ? ` (${Math.round((p.spent / p.budget) * 100)}%)` : ''}</b></div>
                                {p.approved_at && <div><span>Phê duyệt</span><b>{fmtDT(p.approved_at)}</b>{p.approval_note && <small className="pl-mu">{p.approval_note}</small>}</div>}
                                {p.completed_at && <div><span>Hoàn thành</span><b>{fmtDT(p.completed_at)}</b></div>}
                            </div>
                            {d.parent && <p className="pl-note">Thuộc kế hoạch: <a href="#" onClick={(e) => { e.preventDefault(); onOpen(d.parent!.id); }}><b>{d.parent.code} · {d.parent.title}</b></a></p>}
                            {p.objectives && <section className="pl-card"><header><h2>Mục tiêu</h2></header><p className="pl-text">{p.objectives}</p></section>}
                            {p.content && <section className="pl-card"><header><h2>Nội dung thực hiện</h2></header><p className="pl-text">{p.content}</p></section>}
                            {p.result && <section className="pl-card"><header><h2>Kết quả đạt được</h2></header><p className="pl-text">{p.result}</p></section>}
                            {d.children.length > 0 && (
                                <section className="pl-card"><header><h2>Kế hoạch con ({d.children.length})</h2></header>
                                    <div className="pl-mini">{d.children.map((c) => (
                                        <button key={c.id} onClick={() => onOpen(c.id)}><div className="r"><b>{c.title}</b><Pill tone={STATUS_TONE[c.status] ?? 'mut'}>{opts.statuses[c.status]}</Pill></div><Bar value={c.progress} /><small className="pl-mu">{c.code} · {fmtDate(c.start_date)} → {fmtDate(c.end_date)} · {c.progress}%</small></button>
                                    ))}</div></section>
                            )}
                        </>
                    )}

                    {d && p && tab === 'tasks' && (
                        <>
                            <section className="pl-card">
                                <header><h2>Thêm nhiệm vụ</h2></header>
                                <div className="pl-form">
                                    <label className="full">Tên nhiệm vụ<input className="pl-in" value={nt.title} onChange={(e) => setNt({ ...nt, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addTask()} /></label>
                                    <label>Người thực hiện<input className="pl-in" value={nt.assignee_name} onChange={(e) => setNt({ ...nt, assignee_name: e.target.value })} /></label>
                                    <label>Hạn hoàn thành<input className="pl-in" type="date" value={nt.due_date} onChange={(e) => setNt({ ...nt, due_date: e.target.value })} /></label>
                                    <label>Ưu tiên<select className="pl-in" value={nt.priority} onChange={(e) => setNt({ ...nt, priority: e.target.value })}>{Object.entries(opts.priorities).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                                    <label>Trọng số (1–10, ảnh hưởng tiến độ)<input className="pl-in" type="number" min={1} max={10} value={nt.weight} onChange={(e) => setNt({ ...nt, weight: e.target.value })} /></label>
                                </div>
                                <div style={{ marginTop: 12 }}><button className="pl-btn" onClick={addTask}><Icon n="plus" s={16} />Thêm nhiệm vụ</button></div>
                            </section>
                            {d.tasks.map((t) => (
                                <div key={t.id} className={`pl-task${t.status === 'done' ? ' done' : ''}`}>
                                    <button className={`pl-chk${t.status === 'done' ? ' on' : ''}`} onClick={() => setTask(t, t.status === 'done' ? 'todo' : 'done')} aria-label="Hoàn thành">{t.status === 'done' && <Icon n="check" s={14} />}</button>
                                    <div className="tt"><b>{t.title}</b><small className="pl-mu">{t.assignee_name || 'Chưa giao'} · <span className={late(t) ? 'late' : ''}>hạn {fmtDate(t.due_date)}{late(t) ? ' (quá hạn)' : ''}</span> · <Pill tone={PRIORITY_TONE[t.priority] ?? 'mut'}>{opts.priorities[t.priority]}</Pill> · trọng số {t.weight}</small></div>
                                    <div className="pl-row"><select value={t.status} onChange={(e) => setTask(t, e.target.value)}>{Object.entries(opts.task_statuses).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                                        <button className="pl-btn ghost danger sm" onClick={() => delTask(t)} aria-label="Xóa"><Icon n="trash" s={14} /></button></div>
                                </div>
                            ))}
                            {!d.tasks.length && <p className="pl-empty">Chưa có nhiệm vụ. Thêm nhiệm vụ để theo dõi tiến độ tự động.</p>}
                        </>
                    )}

                    {d && p && tab === 'links' && (
                        <>
                            <section className="pl-card"><header><h2>Liên kết nhanh tới chức năng khác</h2></header>
                                <div className="pl-lk">{opts.link_targets.map((t) => <button key={t.kind} className="pl-btn ghost sm" onClick={() => addLink(t.label, t.url, t.kind)}><Icon n="plus" s={13} />{t.label}</button>)}</div></section>
                            <section className="pl-card"><header><h2>Liên kết tùy chọn</h2></header>
                                <div className="pl-form"><label>Tên<input className="pl-in" value={lk.label} onChange={(e) => setLk({ ...lk, label: e.target.value })} placeholder="VD: Công văn 123/SGD" /></label>
                                    <label>Đường dẫn (tùy chọn)<input className="pl-in" value={lk.url} onChange={(e) => setLk({ ...lk, url: e.target.value })} placeholder="/bgh/... hoặc https://..." /></label></div>
                                <div style={{ marginTop: 12 }}><button className="pl-btn" onClick={() => addLink(lk.label, lk.url)}>Thêm liên kết</button></div></section>
                            <section className="pl-card"><header><h2>Đã liên kết ({d.links.length})</h2></header>
                                <div className="pl-lk">{d.links.map((l) => (
                                    <span key={l.id} className="l">{l.url ? <a href={l.url}><Icon n="link" s={14} />{l.label}</a> : <><Icon n="link" s={14} />{l.label}</>}<button onClick={() => delLink(l.id)} aria-label="Gỡ"><Icon n="x" s={13} /></button></span>
                                ))}{!d.links.length && <span className="pl-mu">Chưa có liên kết.</span>}</div></section>
                        </>
                    )}

                    {d && p && tab === 'log' && (
                        <>
                            <section className="pl-card"><header><h2>Bình luận</h2></header>
                                <textarea className="pl-in" rows={3} value={cm} onChange={(e) => setCm(e.target.value)} placeholder="Ghi chú, chỉ đạo, trao đổi về kế hoạch…" />
                                <div style={{ marginTop: 10 }}><button className="pl-btn" onClick={sendCm} disabled={!cm.trim()}><Icon n="send" s={15} />Gửi</button></div></section>
                            <section className="pl-card"><header><h2>Dòng thời gian</h2></header>
                                <ul className="pl-feed">{d.activities.map((a) => (
                                    <li key={a.id}><span className={`dot ${a.type}`}><Icon n={a.type === 'comment' ? 'comment' : a.type === 'approval' ? 'check' : a.type === 'link' ? 'link' : a.type === 'task' ? 'flag' : 'edit'} s={14} /></span>
                                        <div><span>{a.message}</span><small>{a.user_name ?? 'Hệ thống'} · {fmtDT(a.created_at)}</small></div></li>
                                ))}</ul></section>
                        </>
                    )}
                </div>
            </aside>

            {ask && (
                <Modal title={ask.label} onClose={() => { setAsk(null); setNote(''); }}
                       footer={<><button className="pl-btn ghost" onClick={() => { setAsk(null); setNote(''); }}>Đóng</button>
                           <button className={`pl-btn${ask.to === 'rejected' || ask.to === 'cancelled' ? ' dfill' : ''}`} disabled={busy || (ask.need && !note.trim())} onClick={() => transition(ask.to, note, ask.force)}>{busy ? 'Đang xử lý…' : ask.label}</button></>}>
                    {ask.msg && <div className="pl-alert err"><Icon n="alert" s={16} /><span>{ask.msg}</span></div>}
                    {!ask.force && <label className="pl-form" style={{ display: 'grid' }}><span>{ask.need ? 'Lý do (bắt buộc)' : 'Ghi chú (tùy chọn)'}</span><textarea className="pl-in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></label>}
                </Modal>
            )}
            {dup !== null && (
                <Modal title="Nhân bản kế hoạch" onClose={() => setDup(null)} footer={<><button className="pl-btn ghost" onClick={() => setDup(null)}>Hủy</button><button className="pl-btn" onClick={doDup}>Nhân bản</button></>}>
                    <p>Tạo bản sao (trạng thái Nháp) cùng toàn bộ nhiệm vụ; các ngày được dời theo ngày bắt đầu mới.</p>
                    <label className="pl-form" style={{ display: 'grid' }}><span>Ngày bắt đầu mới</span><input className="pl-in" type="date" value={dup} onChange={(e) => setDup(e.target.value)} /></label>
                </Modal>
            )}
            {del && (
                <Modal title="Xóa kế hoạch?" onClose={() => setDel(false)} footer={<><button className="pl-btn ghost" onClick={() => setDel(false)}>Không</button><button className="pl-btn dfill" onClick={doDel}>Xóa</button></>}>
                    <p>Kế hoạch <b>{p?.title}</b> sẽ bị xóa khỏi danh sách. Hành động này không thể hoàn lại trên giao diện.</p>
                </Modal>
            )}
        </div>
    );
}