'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../../logs/logs.module.css';
import e from '../evaluations.module.css';
import { Icon } from '../../logs/components/Icons';
import { Confirm, Empty, ErrorBox, Skeleton, useAsync, useToast } from '../../logs/components/ui';
import { errorMessage, evApi } from '../api';
import { Dialog, Field, Tone } from '../components/bits';
import { useEv } from '../components/ctx';
import type { RubricFull } from '../types';

interface Row { group_name: string; name: string; description: string; weight: string; max_score: string }
const blank = (g = ''): Row => ({ group_name: g, name: '', description: '', weight: '10', max_score: '4' });

export default function RubricsTab() {
    const ev = useEv(); const toast = useToast();
    const st = useAsync<RubricFull[]>();
    const [edit, setEdit] = useState<{ id: number | null; clone?: RubricFull } | null>(null);
    const [del, setDel] = useState<RubricFull | null>(null);
    const [view, setView] = useState<RubricFull | null>(null);
    const load = useCallback(() => st.run(() => evApi.rubrics()), []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [load, ev.tick]);
    const toggle = async (r: RubricFull) => { try { await evApi.toggleRubric(r.id); toast('ok', r.is_active ? 'Đã tắt mẫu phiếu' : 'Đã bật mẫu phiếu'); load(); ev.reload(); } catch (x) { toast('err', errorMessage(x)); } };
    const open = async (r: RubricFull) => { try { setView(await evApi.rubric(r.id)); } catch (x) { toast('err', errorMessage(x)); } };
    const clone = async (r: RubricFull) => { try { setEdit({ id: null, clone: await evApi.rubric(r.id) }); } catch (x) { toast('err', errorMessage(x)); } };

    return (
        <div className={s.stack}>
            <div className={s.card}>
                <div className={e.flex}>
                    <div className={e.grow}><h3 className={s.cardTitle}>Mẫu phiếu & tiêu chí đánh giá giờ dạy</h3><div className={s.cardSub}>Điểm phiếu = Σ(trọng số × điểm/điểm tối đa) ÷ Σ trọng số × 100. Mẫu đã dùng cho phiếu thì khoá tiêu chí — hãy nhân bản thành mẫu mới để chỉnh.</div></div>
                    <button className={`${s.btn} ${s.primary}`} onClick={() => setEdit({ id: null })}><Icon name="list" size={15} /> Tạo mẫu mới</button>
                </div>
            </div>
            {st.error ? <ErrorBox message={st.error} onRetry={load} /> : !st.data ? <Skeleton h={240} /> : st.data.length === 0 ? <div className={s.card}><Empty title="Chưa có mẫu phiếu" /></div> : (
                <div className={s.stack} style={{ gap: 12 }}>
                    {st.data.map((r) => (
                        <div key={r.id} className={`${e.rubCard} ${r.is_active ? '' : e.off}`}>
                            <div className={e.grow}>
                                <div className={e.flex}><b style={{ fontSize: 15 }}>{r.name}</b><span className={s.mono}>{r.code}</span>{String(r.id) === ev.settings.default_rubric_id && <Tone tone="info">Mặc định</Tone>}{!r.is_active && <Tone tone="muted">Đang tắt</Tone>}</div>
                                <div className={`${s.small} ${s.muted}`} style={{ marginTop: 3 }}>{r.description || 'Không có mô tả'} · {r.criteria_count} tiêu chí · tổng trọng số {Number(r.weight_sum)} · đã dùng cho {r.used_count} phiếu</div>
                            </div>
                            <button className={`${s.btn} ${s.sm}`} onClick={() => open(r)}>Xem</button>
                            <button className={`${s.btn} ${s.sm}`} onClick={() => clone(r)}>Nhân bản</button>
                            <button className={`${s.btn} ${s.sm}`} onClick={() => setEdit({ id: r.id })}>Sửa</button>
                            <button className={`${s.btn} ${s.sm}`} onClick={() => toggle(r)}>{r.is_active ? 'Tắt' : 'Bật'}</button>
                            <button className={`${s.btn} ${s.sm} ${s.danger}`} onClick={() => setDel(r)} aria-label="Xoá"><Icon name="trash" size={13} /></button>
                        </div>
                    ))}
                </div>
            )}
            {view && (
                <Dialog title={view.name} width={760} onClose={() => setView(null)}>
                    <table className={e.tbl}><thead><tr><th>Nhóm</th><th>Tiêu chí</th><th>Trọng số</th><th>Điểm tối đa</th></tr></thead>
                        <tbody>{view.criteria?.map((c) => <tr key={c.id}><td>{c.group_name}</td><td><b>{c.name}</b><div className={e.tdSub}>{c.description}</div></td><td>{Number(c.weight)}</td><td>{c.max_score}</td></tr>)}</tbody></table>
                </Dialog>
            )}
            {edit && <Builder id={edit.id} clone={edit.clone} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); ev.reload(); }} />}
            {del && <Confirm title="Xoá mẫu phiếu" danger body={`Xoá “${del.name}”? Chỉ xoá được mẫu chưa dùng cho phiếu nào.`} confirmText="Xoá" onCancel={() => setDel(null)} onOk={async () => { try { await evApi.deleteRubric(del.id); toast('ok', 'Đã xoá mẫu phiếu'); load(); ev.reload(); } catch (x) { toast('err', errorMessage(x)); } setDel(null); }} />}
        </div>
    );
}

function Builder({ id, clone, onClose, onSaved }: { id: number | null; clone?: RubricFull; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const [f, setF] = useState({ code: '', name: '', description: '' });
    const [rows, setRows] = useState<Row[]>([blank('Nhóm 1')]);
    const [locked, setLocked] = useState(false);
    const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [ready, setReady] = useState(!id);
    const fill = (r: RubricFull, keepCode: boolean) => {
        setF({ code: keepCode ? r.code : r.code + '-COPY', name: keepCode ? r.name : r.name + ' (bản sao)', description: r.description ?? '' });
        setRows((r.criteria ?? []).map((c) => ({ group_name: c.group_name, name: c.name, description: c.description ?? '', weight: String(Number(c.weight)), max_score: String(c.max_score) })));
    };
    useEffect(() => {
        if (clone) fill(clone, false);
        else if (id) evApi.rubric(id).then((r) => { fill(r, true); setLocked(r.used_count > 0); setReady(true); }).catch((x) => { setErr(errorMessage(x)); setReady(true); });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const set = (i: number, k: keyof Row, v: string) => setRows((o) => o.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    const sum = rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);
    const save = async () => {
        setBusy(true); setErr('');
        try {
            const body: Record<string, unknown> = { ...f };
            if (!locked) body.criteria = rows.map((r) => ({ ...r, weight: Number(r.weight), max_score: Number(r.max_score) }));
            await evApi.saveRubric(id, body); toast('ok', id ? 'Đã cập nhật mẫu phiếu' : 'Đã tạo mẫu phiếu'); onSaved();
        } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
    };
    return (
        <Dialog title={id ? 'Sửa mẫu phiếu' : clone ? 'Nhân bản mẫu phiếu' : 'Tạo mẫu phiếu mới'} width={980} onClose={onClose} busy={busy}
                footer={<><span className={`${s.small} ${s.muted}`} style={{ marginRight: 'auto' }}>{rows.length} tiêu chí · tổng trọng số {sum}</span><button className={s.btn} onClick={onClose}>Huỷ</button><button className={`${s.btn} ${s.primary}`} disabled={busy || !ready} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu mẫu phiếu'}</button></>}>
            <div className={e.form}>
                {err && <div className={e.errLine}>{err}</div>}
                {locked && <div className={e.errLine} style={{ background: 'var(--warnSoft)', color: 'var(--warn)' }}>Mẫu này đã dùng cho phiếu dự giờ nên chỉ sửa được tên và mô tả. Muốn đổi tiêu chí hãy “Nhân bản”.</div>}
                <div className={e.fg3} style={{ gridTemplateColumns: '1fr 2fr' }}>
                    <Field label="Mã mẫu" required><input className={e.input} value={f.code} disabled={!!id} maxLength={30} onChange={(x) => setF({ ...f, code: x.target.value })} placeholder="VD: DG-TOAN" /></Field>
                    <Field label="Tên mẫu phiếu" required><input className={e.input} value={f.name} maxLength={160} onChange={(x) => setF({ ...f, name: x.target.value })} /></Field>
                </div>
                <Field label="Mô tả"><input className={e.input} value={f.description} maxLength={500} onChange={(x) => setF({ ...f, description: x.target.value })} /></Field>
                <div>
                    <label className={e.lbl}>Tiêu chí</label>
                    <div className={e.builderRow} style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)' }}><span>NHÓM</span><span>TIÊU CHÍ / MÔ TẢ</span><span>TRỌNG SỐ</span><span>TỐI ĐA</span><span /></div>
                    {rows.map((r, i) => (
                        <div key={i} className={e.builderRow}>
                            <input className={e.input} disabled={locked} value={r.group_name} placeholder="Nhóm" onChange={(x) => set(i, 'group_name', x.target.value)} />
                            <div style={{ display: 'grid', gap: 4 }}>
                                <input className={e.input} disabled={locked} value={r.name} placeholder="Tên tiêu chí" onChange={(x) => set(i, 'name', x.target.value)} />
                                <input className={e.input} disabled={locked} value={r.description} placeholder="Mô tả cách chấm (không bắt buộc)" onChange={(x) => set(i, 'description', x.target.value)} />
                            </div>
                            <input type="number" min={1} className={e.input} disabled={locked} value={r.weight} onChange={(x) => set(i, 'weight', x.target.value)} />
                            <input type="number" min={2} max={10} className={e.input} disabled={locked} value={r.max_score} onChange={(x) => set(i, 'max_score', x.target.value)} />
                            <button type="button" className={e.iconSm} disabled={locked || rows.length <= 1} onClick={() => setRows((o) => o.filter((_, j) => j !== i))} aria-label="Xoá dòng"><Icon name="x" size={14} /></button>
                        </div>
                    ))}
                    {!locked && <button type="button" className={`${s.btn} ${s.sm}`} onClick={() => setRows((o) => [...o, blank(o[o.length - 1]?.group_name)])}>+ Thêm tiêu chí</button>}
                </div>
            </div>
        </Dialog>
    );
}