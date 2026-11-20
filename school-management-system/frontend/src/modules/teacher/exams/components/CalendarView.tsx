'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/modules/homeroom/awards/components/Overlay';
import { useToast } from '@/modules/homeroom/awards/components/Toast';
import { cx, fmtDate, toISO } from '@/modules/homeroom/awards/utils';
import { errMsg, examApi } from '../examsService';
import type { CalEvent, Ctx } from '../types';
import X from './xicons';

const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function CalendarView({ ctx }: { ctx: Ctx }) {
    const { meta, tick, openSheet, newTest } = ctx;
    const toast = useToast();
    const [cursor, setCursor] = useState(() => { const d = new Date(meta.today + 'T00:00:00'); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [sel, setSel] = useState<string | null>(null);

    const cells = useMemo(() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const offset = (first.getDay() + 6) % 7;
        const start = new Date(first); start.setDate(1 - offset);
        return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
    }, [cursor]);

    const from = toISO(cells[0]);
    const to = toISO(cells[41]);
    useEffect(() => {
        examApi.calendar(from, to).then(setEvents).catch((e) => toast.error('Không tải được lịch', errMsg(e)));
    }, [from, to, tick, toast]);

    const byDay = useMemo(() => { const m: Record<string, CalEvent[]> = {}; events.forEach((e) => (m[e.date] ||= []).push(e)); return m; }, [events]);
    const move = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
    const selEvents = sel ? byDay[sel] ?? [] : [];

    return (
        <div className="emu-page">
            <div className="emu-row emu-wrap">
                <button className="emu-btn icon" onClick={() => move(-1)} aria-label="Tháng trước"><X name="left" /></button>
                <h2 style={{ margin: 0, fontSize: 20, minWidth: 170, textAlign: 'center' }}>Tháng {cursor.getMonth() + 1}/{cursor.getFullYear()}</h2>
                <button className="emu-btn icon" onClick={() => move(1)} aria-label="Tháng sau"><X name="right" /></button>
                <button className="emu-btn" onClick={() => { const d = new Date(meta.today + 'T00:00:00'); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Hôm nay</button>
                <span className="emu-spacer" />
                <span className="emu-badge violet"><i className="emu-dot" style={{ background: 'var(--violet)' }} /> Lịch của nhà trường</span>
                <span className="emu-badge brand"><i className="emu-dot" style={{ background: 'var(--brand)' }} /> Bài của tôi</span>
                <span className="emu-badge ok"><i className="emu-dot" style={{ background: 'var(--ok)' }} /> Đã hoàn tất</span>
            </div>

            <div className="ex-cal">
                {DOW.map((d) => <div key={d} className="ex-cal-h">{d}</div>)}
                {cells.map((d) => {
                    const iso = toISO(d);
                    const list = byDay[iso] ?? [];
                    return (
                        <div key={iso} className={cx('ex-day', d.getMonth() !== cursor.getMonth() && 'out', iso === meta.today && 'today')} onClick={() => setSel(iso)}>
                            <span className="ex-dnum">{d.getDate()}</span>
                            {list.slice(0, 3).map((e) => (
                                <div key={e.key} className={cx('ex-ev', e.type === 'official' ? 'official' : e.status === 'done' ? 'done' : 'test')} title={`${e.title} · ${e.subject_name} ${e.class_name}`}>
                                    {e.start_time ?? ''} {e.subject_name} {e.class_name}
                                </div>
                            ))}
                            {list.length > 3 && <span className="emu-muted" style={{ fontSize: 11 }}>+{list.length - 3} nữa</span>}
                        </div>
                    );
                })}
            </div>

            <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `Ngày ${fmtDate(sel)}` : ''} subtitle={`${selEvents.length} lượt kiểm tra`}
                   footer={<><button className="emu-btn" onClick={() => setSel(null)}>Đóng</button><button className="emu-btn primary" onClick={() => { const d = sel!; setSel(null); newTest({ test_date: d }); }}><X name="plus" size={15} /> Tạo bài ngày này</button></>}>
                {selEvents.length === 0 && <div className="emu-empty">Chưa có lịch kiểm tra trong ngày.</div>}
                {selEvents.map((e) => (
                    <div key={e.key} className="emu-kcard">
                        <div className="emu-row"><span className={`emu-badge ${e.type === 'official' ? 'violet' : 'brand'}`}>{e.type === 'official' ? 'Nhà trường' : 'Bài của tôi'}</span><b>{e.title}</b></div>
                        <p>{e.subject_name} · lớp {e.class_name} · {e.start_time ?? '—'} · {e.duration_minutes} phút{e.sub ? ` · ${e.sub}` : ''}</p>
                        {e.test_id && <button className="emu-btn primary sm" onClick={() => { setSel(null); openSheet(e.test_id!); }}>Mở bảng điểm</button>}
                    </div>
                ))}
            </Modal>
        </div>
    );
}