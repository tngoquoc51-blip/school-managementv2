'use client';

import { useCallback, useEffect, useState } from 'react';
import { ll } from '../_lib/api';
import { useToast } from '../_lib/toast';
import type { Meta, WeekData } from '../_lib/types';
import { Icon, Modal, Pill, addDays, dmy, fmtDT } from './ui';
import type { FormInit } from './EntryForm';

interface Props {
    meta: Meta; classId: number; setClassId: (id: number) => void; date: string; setDate: (d: string) => void; tick: number;
    onOpen: (id: number) => void; onCreate: (i: FormInit) => void; onChanged: () => void;
}
const RATE_TAG: Record<string, string> = { good: 'g', fair: 'f', pass: 'p', poor: 'x' };

export default function WeekGrid({ meta, classId, setClassId, date, setDate, tick, onOpen, onCreate, onChanged }: Props) {
    const toast = useToast();
    const [d, setD] = useState<WeekData | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [ask, setAsk] = useState<{ kind: 'confirm' | 'reopen'; force?: boolean; msg?: string } | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setD(await ll.week(classId, date)); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Không tải được sổ tuần.'); } finally { setLoading(false); }
    }, [classId, date]);
    useEffect(() => { load(); }, [load, tick]);

    const confirm = async (force?: boolean) => {
        setBusy(true);
        try {
            const r = await ll.confirmWeek(classId, date, note || undefined, force);
            toast({ tone: 'success', title: 'Đã xác nhận sổ tuần', text: `${r.confirmed} tiết được khóa${r.drafts ? `, còn ${r.drafts} tiết nháp` : ''}` });
            setAsk(null); setNote(''); load(); onChanged();
        } catch (e) {
            const m = e instanceof Error ? e.message : '';
            if (m.includes('chưa ký sổ')) setAsk({ kind: 'confirm', force: true, msg: m });
            else toast({ tone: 'error', title: 'Không xác nhận được', text: m });
        } finally { setBusy(false); }
    };
    const reopen = async () => {
        setBusy(true);
        try { await ll.reopenWeek(classId, date); toast({ tone: 'success', title: 'Đã mở lại sổ tuần' }); setAsk(null); load(); onChanged(); }
        catch (e) { toast({ tone: 'error', title: 'Không mở lại được', text: e instanceof Error ? e.message : '' }); } finally { setBusy(false); }
    };

    const locked = d?.week.status === 'confirmed';
    const morning = meta.periods.filter((p) => p.session === 'morning');
    const afternoon = meta.periods.filter((p) => p.session === 'afternoon');

    const renderRows = (list: typeof meta.periods, title: string) => list.length === 0 ? null : (
        <>
            <tr className="sess"><td colSpan={7}>{title}</td></tr>
            {list.map((p) => (
                <tr key={p.n}>
                    <td className="per"><b>Tiết {p.n}</b><small>{p.start}–{p.end}</small></td>
                    {d!.days.map((day) => {
                        const c = d!.cells[day.date]?.[String(p.n)];
                        if (c) {
                            return (
                                <td key={day.date}>
                                    <button className={`ll-cell ${c.status}${c.mine ? ' mine' : ''}`} onClick={() => onOpen(c.id)} title={`${c.subject_name} – ${c.title ?? ''}`}>
                                        <b>{c.subject_name}</b><small>{c.title || 'Chưa nhập tên bài'}</small><small>{c.teacher_name ?? ''}</small>
                                        <span className="tg">
                                            {c.status === 'draft' && <i className="ll-tg-p">Nháp</i>}
                                            {c.rating && <i className={`ll-tg-${RATE_TAG[c.rating]}`}>{meta.ratings[c.rating]}</i>}
                                            {c.absent > 0 && <i className="ll-tg-a">Vắng {c.absent}</i>}
                                            {c.late > 0 && <i className="ll-tg-l">Muộn {c.late}</i>}
                                        </span>
                                    </button>
                                </td>
                            );
                        }
                        const future = day.date > meta.today;
                        return (
                            <td key={day.date}>
                                <button className="ll-cell empty" disabled={future || locked} title={future ? 'Chưa đến ngày' : locked ? 'Tuần đã được xác nhận' : 'Ghi sổ tiết này'}
                                        onClick={() => onCreate({ class_id: classId, date: day.date, period: p.n })}>{future || locked ? '·' : '+'}</button>
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );

    return (
        <div className="ll-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            <div className="ll-weekbar">
                <select className="ll-in" style={{ width: 190 }} value={classId} onChange={(e) => setClassId(Number(e.target.value))}>
                    {meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}{meta.me.homeroom_class_ids.includes(c.id) ? ' (chủ nhiệm)' : ''}</option>)}
                </select>
                <button className="ll-btn ghost sm" onClick={() => setDate(addDays(date, -7))}><Icon n="arrowL" s={14} />Tuần trước</button>
                <button className="ll-btn ghost sm" onClick={() => setDate(meta.today)}>Tuần này</button>
                <button className="ll-btn ghost sm" onClick={() => setDate(addDays(date, 7))}>Tuần sau<Icon n="arrowR" s={14} /></button>
                {d && <b className="ll-ttl">{dmy(d.week_start)} → {dmy(d.week_end)}</b>}
                <span className="grow" />
                {d && (locked
                    ? <Pill tone="ok">Đã xác nhận{d.week.confirmed_name ? ` bởi ${d.week.confirmed_name}` : ''}</Pill>
                    : <Pill tone="warn">Chưa xác nhận</Pill>)}
                {d?.can_confirm && !locked && <button className="ll-btn ok sm" onClick={() => { setNote(''); setAsk({ kind: 'confirm' }); }}><Icon n="lock" s={14} />Xác nhận sổ tuần</button>}
                {d?.can_confirm && locked && <button className="ll-btn ghost sm" onClick={() => setAsk({ kind: 'reopen' })}><Icon n="unlock" s={14} />Mở lại tuần</button>}
            </div>

            {d && (
                <div className="ll-sum">
                    <span>{d.summary.entries} tiết đã ghi</span><span>{d.summary.signed} đã ký</span><span>{d.summary.drafts} nháp</span>
                    <span style={{ color: '#b91c1c' }}>{d.summary.absent} lượt vắng</span><span style={{ color: '#b45309' }}>{d.summary.late} đi muộn</span>
                    {locked && d.week.confirmed_at && <span>Xác nhận lúc {fmtDT(d.week.confirmed_at)}</span>}
                </div>
            )}
            {err && <div className="ll-alert err"><Icon n="alert" s={18} /><span>{err}</span></div>}

            {d && (
                <div className="ll-wk">
                    <table>
                        <thead>
                        <tr><th style={{ width: 96 }}>Tiết</th>{d.days.map((day) => <th key={day.date} className={day.is_today ? 'today' : ''}>{day.label}<small>{dmy(day.date).slice(0, 5)}</small></th>)}</tr>
                        </thead>
                        <tbody>{renderRows(morning, 'BUỔI SÁNG')}{renderRows(afternoon, 'BUỔI CHIỀU')}</tbody>
                    </table>
                </div>
            )}
            {d?.week.note && <p className="ll-note">Ghi chú của GVCN: {d.week.note}</p>}

            {ask && (
                <Modal title={ask.kind === 'confirm' ? 'Xác nhận sổ tuần' : 'Mở lại sổ tuần'} onClose={() => setAsk(null)}
                       footer={<><button className="ll-btn ghost" onClick={() => setAsk(null)}>Đóng</button>
                           {ask.kind === 'confirm'
                               ? <button className="ll-btn ok" disabled={busy} onClick={() => confirm(ask.force)}>{busy ? 'Đang xử lý…' : ask.force ? 'Vẫn xác nhận' : 'Xác nhận'}</button>
                               : <button className="ll-btn" disabled={busy} onClick={reopen}>{busy ? 'Đang xử lý…' : 'Mở lại tuần'}</button>}</>}>
                    {ask.msg && <div className="ll-alert err"><Icon n="alert" s={16} /><span>{ask.msg}</span></div>}
                    {ask.kind === 'confirm' && !ask.force && (
                        <>
                            <p>Xác nhận toàn bộ sổ đầu bài lớp <b>{d?.class.name}</b> tuần {d && dmy(d.week_start)}. Các tiết đã ký sẽ được <b>khóa</b>, giáo viên không sửa được nữa.</p>
                            <label className="ll-form" style={{ display: 'grid' }}><span>Ghi chú của giáo viên chủ nhiệm (tùy chọn)</span><textarea className="ll-in" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                        </>
                    )}
                    {ask.kind === 'reopen' && <p>Tuần sẽ được mở lại: các tiết quay về trạng thái “Đã ký sổ” và giáo viên có thể được mở lại để chỉnh sửa.</p>}
                </Modal>
            )}
        </div>
    );
}