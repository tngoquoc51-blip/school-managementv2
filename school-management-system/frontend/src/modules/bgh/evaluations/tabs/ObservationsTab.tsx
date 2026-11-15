'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Empty, ErrorBox, Pager, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { fmtDate } from '../../logs/format';
import { errorMessage, evApi } from '../api';
import { Avatar, RatingChip, SearchBox, StatTabs, Tone, useDebounced } from '../components/bits';
import { useEv } from '../components/ctx';
import { KIND, OBS_STATUS, RATING, score } from '../format';
import type { Obs, Paged } from '../types';

export default function ObservationsTab() {
    const ev = useEv(); const toast = useToast();
    const [status, setStatus] = useState('');
    const [q, setQ] = useState(''); const dq = useDebounced(q);
    const [rating, setRating] = useState(''); const [subject, setSubject] = useState(''); const [kind, setKind] = useState('');
    const [sort, setSort] = useState('date'); const [dir, setDir] = useState('desc');
    const [page, setPage] = useState(1);
    const st = useAsync<Paged<Obs>>();
    const params = { year: ev.year, semester: ev.semester, status, q: dq, rating, subject_id: subject, kind, sort, dir };
    const load = useCallback(() => st.run(() => evApi.observations({ ...params, page, per_page: 15 })), [ev.year, ev.semester, status, dq, rating, subject, kind, sort, dir, page]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setPage(1); }, [status, dq, rating, subject, kind, sort, dir, ev.semester]);
    useEffect(() => { load(); }, [load, ev.tick]);
    const c = st.data?.counts;
    const sortBy = (k: string) => { if (sort === k) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(k); setDir(k === 'teacher' ? 'asc' : 'desc'); } };
    const arrow = (k: string) => (sort === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
    const exp = async () => { try { await evApi.exportObservations(params); toast('ok', 'Đã xuất danh sách phiếu dự giờ (CSV)'); } catch (x) { toast('err', errorMessage(x)); } };

    return (
        <div className={s.stack}>
            <div className={e.toolbar}>
                <SearchBox value={q} onChange={setQ} placeholder="Tìm mã phiếu, giáo viên, bài dạy, người dự…" />
                <select className={s.field} value={subject} onChange={(x) => setSubject(x.target.value)} aria-label="Tổ / môn"><option value="">Mọi tổ / môn</option>{ev.lk.subjects.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <select className={s.field} value={rating} onChange={(x) => setRating(x.target.value)} aria-label="Xếp loại"><option value="">Mọi xếp loại</option>{Object.entries(RATING).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                <select className={s.field} value={kind} onChange={(x) => setKind(x.target.value)} aria-label="Hình thức"><option value="">Mọi hình thức</option>{Object.entries(KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <button className={s.btn} onClick={exp}><Icon name="download" size={15} /> Xuất CSV</button>
                <button className={`${s.btn} ${s.primary}`} onClick={() => ev.newObs()}><Icon name="check" size={15} /> Phiếu mới</button>
            </div>
            <StatTabs value={status} onChange={setStatus} items={[['', 'Tất cả', c?.all], ['draft', 'Bản nháp', c?.draft], ['submitted', 'Chờ GV xác nhận', c?.submitted], ['disputed', 'GV có phản hồi', c?.disputed], ['acknowledged', 'GV đã xác nhận', c?.acknowledged], ['closed', 'Đã chốt', c?.closed]]} />
            {st.error ? <ErrorBox message={st.error} onRetry={load} /> : !st.data ? <Skeleton h={380} /> : st.data.items.length === 0 ? (
                <div className={s.card}><Empty icon="list" title="Không có phiếu dự giờ phù hợp" hint="Phiếu được tạo khi bấm “Bắt đầu dự giờ” ở lịch dự giờ, hoặc “Phiếu mới” cho dự giờ đột xuất." /></div>
            ) : (
                <div className={s.card} style={{ padding: 0 }}>
                    <div className={s.tableWrap} style={{ border: 0 }}>
                        <table className={s.table}>
                            <thead><tr><th>Mã phiếu</th><th className={s.sortable} onClick={() => sortBy('teacher')}>Giáo viên{arrow('teacher')}</th><th className={s.sortable} onClick={() => sortBy('date')}>Ngày dự{arrow('date')}</th><th>Lớp / Bài dạy</th><th>Người dự</th><th className={s.sortable} onClick={() => sortBy('score')}>Điểm{arrow('score')}</th><th>Xếp loại</th><th className={s.sortable} onClick={() => sortBy('status')}>Trạng thái{arrow('status')}</th></tr></thead>
                            <tbody>
                            {st.data.items.map((o) => (
                                <tr key={o.id} onClick={() => ev.openObs(o.id)}>
                                    <td className={s.mono}>{o.code}</td>
                                    <td><div className={s.who}><Avatar name={o.teacher_name} /><div><div className={e.tdMain}>{o.teacher_name}</div><div className={e.tdSub}>{o.subject_name}</div></div></div></td>
                                    <td><div>{fmtDate(o.observed_on)}</div><div className={e.tdSub}>{KIND[o.kind]}{o.period ? ` · Tiết ${o.period}` : ''}</div></td>
                                    <td><div>{o.class_name ? 'Lớp ' + o.class_name : '—'}</div><div className={`${e.tdSub} ${s.ellipsis}`} style={{ maxWidth: 220 }}>{o.topic || '—'}</div></td>
                                    <td>{o.observer_name || '—'}</td>
                                    <td><b>{score(o.total_score)}</b></td>
                                    <td><RatingChip v={o.rating} /></td>
                                    <td><Tone tone={OBS_STATUS[o.status].tone}>{OBS_STATUS[o.status].label}</Tone></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '0 18px 14px' }}><Pager page={st.data.page} last={st.data.last_page} total={st.data.total} per={st.data.per_page} onPage={setPage} /></div>
                </div>
            )}
        </div>
    );
}