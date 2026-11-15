'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Confirm, Empty, ErrorBox, Pager, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { fmtDate } from '../../logs/format';
import { errorMessage, evApi } from '../api';
import { Avatar, SearchBox, StatTabs, Tone, useDebounced } from '../components/bits';
import ActionDialog from '../components/ActionDialog';
import { useEv } from '../components/ctx';
import { ACT_STATUS, PRIORITY } from '../format';
import type { Action, Paged } from '../types';

export default function ActionsTab() {
    const ev = useEv(); const toast = useToast();
    const [status, setStatus] = useState('active'); const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1);
    const st = useAsync<Paged<Action>>();
    const [edit, setEdit] = useState<Action | null>(null);
    const [done, setDone] = useState<Action | null>(null);
    const [del, setDel] = useState<Action | null>(null);
    const load = useCallback(() => st.run(() => evApi.actions({ status, q: dq, page, per_page: 15 })), [status, dq, page]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setPage(1); }, [status, dq]);
    useEffect(() => { load(); }, [load, ev.tick]);
    const c = st.data?.counts;
    const move = async (a: Action, to: string, note?: string) => {
        try { await evApi.actionStatus(a.id, to, note); toast('ok', 'Đã cập nhật: ' + ACT_STATUS[to as 'open'].label); load(); ev.reload(); }
        catch (x) { toast('err', errorMessage(x)); }
    };
    return (
        <div className={s.stack}>
            <div className={e.toolbar}>
                <SearchBox value={q} onChange={setQ} placeholder="Tìm nội dung, giáo viên…" />
                <button className={`${s.btn} ${s.primary}`} onClick={() => ev.newAction()}><Icon name="bell" size={15} /> Giao kế hoạch cải tiến</button>
            </div>
            <StatTabs value={status} onChange={setStatus} items={[['active', 'Đang mở', (c?.open ?? 0) + (c?.in_progress ?? 0)], ['overdue', 'Quá hạn', c?.overdue], ['done', 'Hoàn thành', c?.done], ['cancelled', 'Đã huỷ', c?.cancelled], ['all', 'Tất cả', c?.all]]} />
            {st.error ? <ErrorBox message={st.error} onRetry={load} /> : !st.data ? <Skeleton h={340} /> : st.data.items.length === 0 ? (
                <div className={s.card}><Empty icon="bell" title="Không có kế hoạch cải tiến" hint="Sau mỗi phiếu dự giờ xếp loại thấp, hãy giao kế hoạch bồi dưỡng cho giáo viên." /></div>
            ) : (
                <div className={s.card} style={{ padding: 0 }}>
                    <div className={s.tableWrap} style={{ border: 0 }}>
                        <table className={s.table}>
                            <thead><tr><th>Nội dung</th><th>Giáo viên</th><th>Ưu tiên</th><th>Hạn</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>
                            {st.data.items.map((a) => {
                                const stt = a.overdue ? 'overdue' : a.status;
                                const open = a.status === 'open' || a.status === 'in_progress';
                                return (
                                    <tr key={a.id} onClick={() => setEdit(a)}>
                                        <td style={{ maxWidth: 360 }}><div className={e.tdMain}>{a.title}</div><div className={e.tdSub}>{a.observation_code ? 'Từ phiếu ' + a.observation_code : 'Giao trực tiếp'}{a.result_note ? ' · KQ: ' + a.result_note : ''}</div></td>
                                        <td><div className={s.who}><Avatar name={a.teacher_name} /><div className={e.tdMain}>{a.teacher_name}</div></div></td>
                                        <td><Tone tone={PRIORITY[a.priority].tone}>{PRIORITY[a.priority].label}</Tone></td>
                                        <td>{fmtDate(a.due_date)}</td>
                                        <td><Tone tone={ACT_STATUS[stt as 'open'].tone}>{ACT_STATUS[stt as 'open'].label}</Tone></td>
                                        <td onClick={(x) => x.stopPropagation()}>
                                            <div className={e.rowActions}>
                                                {a.status === 'open' && <button className={`${s.btn} ${s.sm}`} onClick={() => move(a, 'in_progress')}>Bắt đầu</button>}
                                                {open && <button className={`${s.btn} ${s.sm} ${s.primary}`} onClick={() => setDone(a)}>Hoàn thành</button>}
                                                {open && <button className={`${s.btn} ${s.sm}`} onClick={() => move(a, 'cancelled')}>Huỷ</button>}
                                                {!open && <button className={`${s.btn} ${s.sm}`} onClick={() => move(a, 'open')}>Mở lại</button>}
                                                <button className={`${s.btn} ${s.sm} ${s.danger}`} onClick={() => setDel(a)} aria-label="Xoá"><Icon name="trash" size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '0 18px 14px' }}><Pager page={st.data.page} last={st.data.last_page} total={st.data.total} per={st.data.per_page} onPage={setPage} /></div>
                </div>
            )}
            {edit && <ActionDialog action={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); ev.reload(); }} />}
            {done && <Confirm title="Hoàn thành kế hoạch cải tiến" body={`“${done.title}” — ${done.teacher_name}`} input={{ label: 'Kết quả thực hiện', required: true }} confirmText="Xác nhận hoàn thành" onCancel={() => setDone(null)} onOk={(t) => { move(done, 'done', t); setDone(null); }} />}
            {del && <Confirm title="Xoá kế hoạch cải tiến" danger body={`Xoá “${del.title}”? Thao tác được ghi vào Nhật ký.`} confirmText="Xoá" onCancel={() => setDel(null)} onOk={async () => { try { await evApi.deleteAction(del.id); toast('ok', 'Đã xoá'); load(); ev.reload(); } catch (x) { toast('err', errorMessage(x)); } setDel(null); }} />}
        </div>
    );
}