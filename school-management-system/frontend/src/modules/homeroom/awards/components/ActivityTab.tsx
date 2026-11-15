'use client';

import { useEffect, useState } from 'react';
import { emuApi, errMsg } from '../awardsService';
import type { ActivityRow, Ctx } from '../types';
import { fmtDate, relTime } from '../utils';
import Icon, { IconName } from './icons';
import { useToast } from './Toast';
import { Empty } from './ui';

export const ACTION_STYLE = (a: string): { icon: IconName; color: string } => {
    if (a.startsWith('record.void')) return { icon: 'undo', color: 'var(--danger)' };
    if (a.startsWith('record')) return { icon: 'plus', color: 'var(--ok)' };
    if (a === 'proposal.approved') return { icon: 'trophy', color: 'var(--gold)' };
    if (a === 'proposal.rejected' || a === 'proposal.cancel') return { icon: 'x', color: 'var(--danger)' };
    if (a === 'proposal.submit') return { icon: 'send', color: 'var(--info)' };
    if (a.startsWith('proposal')) return { icon: 'award', color: 'var(--violet)' };
    return { icon: 'sliders', color: 'var(--brand)' };
};

export default function ActivityTab({ ctx }: { ctx: Ctx }) {
    const toast = useToast();
    const [rows, setRows] = useState<ActivityRow[] | null>(null);

    useEffect(() => {
        emuApi.activity(ctx.scope, 120).then(setRows).catch((e) => toast.error('Không tải được nhật ký', errMsg(e)));
    }, [ctx.scope, ctx.tick, toast]);

    const byDay: Record<string, ActivityRow[]> = {};
    rows?.forEach((r) => (byDay[r.created_at.slice(0, 10)] ||= []).push(r));

    return (
        <div className="emu-page" style={{ maxWidth: 820 }}>
            <div className="emu-card"><div className="emu-card-h"><h3>Nhật ký hoạt động thi đua</h3><span className="emu-sub">Mọi thao tác chấm điểm, đề xuất và duyệt đều được lưu vết</span></div>
                <div className="emu-card-b">
                    {rows && rows.length === 0 && <Empty icon="history" title="Chưa có hoạt động" text="Các thao tác của bạn sẽ xuất hiện ở đây." />}
                    {Object.entries(byDay).map(([day, list]) => (
                        <div key={day} style={{ marginBottom: 18 }}>
                            <div className="emu-day">{fmtDate(day)}</div>
                            <div className="emu-tl" style={{ marginTop: 12 }}>
                                {list.map((r) => {
                                    const st = ACTION_STYLE(r.action);
                                    return (
                                        <div key={r.id} className="emu-tl-item">
                                            <div className="emu-tl-dot" style={{ color: st.color, borderColor: st.color }}><Icon name={st.icon} size={11} /></div>
                                            <div>{r.summary}</div>
                                            <div className="emu-muted" style={{ fontSize: 12 }}>{r.actor_name ?? 'Hệ thống'} · {relTime(r.created_at)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}