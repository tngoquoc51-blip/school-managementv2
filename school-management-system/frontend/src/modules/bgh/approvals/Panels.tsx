'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import s from './approvals.module.css';
import { approvals, errMsg, type Delegation, type Me, type Report, type TypeRow } from '@/services/bghApproval';
import { Icon, LEVEL_LABEL, ROLE_LABEL, fmtD, fmtMoney, pad, useToast } from './ui';

const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isTop = (me: Me | null) => me?.role === 'principal' || me?.role === 'super_admin';

/* ================= BÁO CÁO ================= */
export function ReportPanel() {
    const toast = useToast();
    const [to, setTo] = useState(() => iso(new Date()));
    const [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86400000)));
    const [r, setR] = useState<Report | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { const x = await approvals.report({ from, to }); setR(x.data as Report); }
        catch (e) { toast.push('error', 'Không tải được báo cáo', errMsg(e)); }
    }, [from, to, toast]);
    useEffect(() => { load(); }, [load]);

    const exportCsv = async () => {
        setBusy(true);
        try { await approvals.exportCsv({ from, to }); toast.push('success', 'Đã xuất file CSV', 'Mở bằng Excel để xem danh sách yêu cầu.'); }
        catch (e) { toast.push('error', 'Chưa xuất được', errMsg(e)); } finally { setBusy(false); }
    };

    const max = Math.max(1, ...(r?.trend.map((t) => t.total) ?? [1]));
    const sm = r?.summary;
    return (
        <section className={s.panel}>
            <div className={s.panelHead}>
                <div><h2>Báo cáo phê duyệt</h2><p className={s.muted}>Thống kê theo loại yêu cầu, người xử lý và xu hướng 6 tháng.</p></div>
                <div className={s.range}>
                    <label><span className={s.srOnly}>Từ ngày</span><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
                    <span>đến</span>
                    <label><span className={s.srOnly}>Đến ngày</span><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
                    <button type="button" className={s.btn} onClick={exportCsv} disabled={busy}><Icon name="download" size={16} />Xuất CSV</button>
                </div>
            </div>

            {!r ? <div className={s.skelBlock} aria-busy="true" /> : (
                <>
                    <div className={s.cards}>
                        <div className={s.card}><span>Tổng yêu cầu</span><b>{sm!.total}</b></div>
                        <div className={s.card}><span>Đã duyệt</span><b className={s.numOk}>{sm!.approved}</b></div>
                        <div className={s.card}><span>Từ chối</span><b className={s.numNo}>{sm!.rejected}</b></div>
                        <div className={s.card}><span>Đang chờ</span><b>{sm!.pending}</b></div>
                        <div className={s.card}><span>Quá hạn</span><b className={sm!.overdue ? s.numNo : ''}>{sm!.overdue}</b></div>
                        <div className={s.card}><span>Giá trị đã duyệt</span><b className={s.numMoney}>{fmtMoney(sm!.approved_amount)}</b></div>
                    </div>

                    <div className={s.twoCol}>
                        <div className={s.block}>
                            <h3>Theo loại yêu cầu</h3>
                            <div className={s.tableWrap}>
                                <table className={s.tbl}>
                                    <thead><tr><th>Loại</th><th>Tổng</th><th>Tỷ lệ xử lý</th><th>TB (giờ)</th></tr></thead>
                                    <tbody>
                                    {r.by_type.map((t) => (
                                        <tr key={t.name}>
                                            <td>{t.name}</td><td>{t.total}</td>
                                            <td>
                                                {t.total === 0 ? <span className={s.muted}>Chưa có</span> : (
                                                    <div className={s.barStack} title={`Duyệt ${t.approved}, từ chối ${t.rejected}, trả lại ${t.returned}, chờ ${t.pending}`}>
                                                        <i className={s.segOk} style={{ width: `${(t.approved / t.total) * 100}%` }} />
                                                        <i className={s.segNo} style={{ width: `${(t.rejected / t.total) * 100}%` }} />
                                                        <i className={s.segRet} style={{ width: `${(t.returned / t.total) * 100}%` }} />
                                                        <i className={s.segPen} style={{ width: `${(t.pending / t.total) * 100}%` }} />
                                                    </div>
                                                )}
                                            </td>
                                            <td>{t.avg_hours ?? '–'}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className={s.legend}><i className={s.segOk} />Đã duyệt <i className={s.segNo} />Từ chối <i className={s.segRet} />Trả lại <i className={s.segPen} />Đang chờ</p>
                        </div>

                        <div className={s.block}>
                            <h3>Xu hướng 6 tháng</h3>
                            {r.trend.length === 0 ? <p className={s.muted}>Chưa có dữ liệu.</p> : (
                                <div className={s.trend}>
                                    {r.trend.map((t) => (
                                        <div key={t.m} className={s.trendCol} title={`${t.m}: ${t.total} yêu cầu, ${t.approved} duyệt`}>
                                            <span className={s.trendNum}>{t.total}</span>
                                            <div className={s.trendBar} style={{ height: `${(t.total / max) * 100}%` }}><i style={{ height: t.total ? `${(t.approved / t.total) * 100}%` : 0 }} /></div>
                                            <span className={s.trendLbl}>{t.m.slice(5)}/{t.m.slice(2, 4)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <h3 className={s.h3gap}>Người xử lý</h3>
                            {r.by_approver.length === 0 ? <p className={s.muted}>Chưa có yêu cầu nào được xử lý trong khoảng này.</p> : (
                                <table className={s.tbl}>
                                    <thead><tr><th>Họ tên</th><th>Đã xử lý</th><th>Duyệt</th><th>Từ chối</th><th>Trả lại</th></tr></thead>
                                    <tbody>{r.by_approver.map((a) => <tr key={a.name}><td>{a.name}<div className={s.muted}>{ROLE_LABEL[a.role] ?? a.role}</div></td><td>{a.decided}</td><td>{a.approved}</td><td>{a.rejected}</td><td>{a.returned}</td></tr>)}</tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}

/* ================= LOẠI PHÊ DUYỆT ================= */
export function TypesPanel({ me }: { me: Me | null }) {
    const toast = useToast();
    const [rows, setRows] = useState<TypeRow[]>([]);
    const [draft, setDraft] = useState<Record<string, Partial<TypeRow>>>({});
    const top = isTop(me);

    const load = useCallback(async () => {
        try { const r = await approvals.types(); setRows(r.data as TypeRow[]); setDraft({}); }
        catch (e) { toast.push('error', 'Không tải được danh mục', errMsg(e)); }
    }, [toast]);
    useEffect(() => { load(); }, [load]);

    const edit = (code: string, patch: Partial<TypeRow>) => setDraft((d) => ({ ...d, [code]: { ...d[code], ...patch } }));
    const save = async (t: TypeRow) => {
        const p = draft[t.code];
        if (!p) return;
        try {
            await approvals.updateType(t.code, { sla_hours: p.sla_hours !== undefined ? Number(p.sla_hours) : undefined, approver_role: p.approver_role, is_active: p.is_active !== undefined ? !!p.is_active : undefined });
            toast.push('success', 'Đã lưu cấu hình', t.name); load();
        } catch (e) { toast.push('error', 'Chưa lưu được', errMsg(e)); }
    };

    return (
        <section className={s.panel}>
            <div className={s.panelHead}>
                <div><h2>Loại phê duyệt</h2><p className={s.muted}>Thời hạn xử lý (SLA) và cấp phê duyệt cho từng loại yêu cầu. {top ? '' : 'Chỉ Hiệu trưởng được thay đổi.'}</p></div>
            </div>
            <div className={s.tableWrap}>
                <table className={s.tbl}>
                    <thead><tr><th>Loại yêu cầu</th><th>Cấp duyệt</th><th>Hạn xử lý (giờ)</th><th>Đang chờ</th><th>Bật</th><th /></tr></thead>
                    <tbody>
                    {rows.map((t) => {
                        const v = { ...t, ...draft[t.code] };
                        const dirty = !!draft[t.code];
                        return (
                            <tr key={t.code}>
                                <td><b>{t.name}</b><div className={s.muted}>{t.description}</div></td>
                                <td>
                                    <select value={v.approver_role} disabled={!top} onChange={(e) => edit(t.code, { approver_role: e.target.value })} aria-label="Cấp duyệt">
                                        {['vice_principal', 'principal', 'any'].map((k) => <option key={k} value={k}>{LEVEL_LABEL[k]}</option>)}
                                    </select>
                                </td>
                                <td><input className={s.numIn} type="number" min={1} max={720} value={v.sla_hours} disabled={!top} onChange={(e) => edit(t.code, { sla_hours: Number(e.target.value) })} aria-label="Hạn xử lý" /></td>
                                <td>{t.pending}</td>
                                <td><input type="checkbox" checked={!!v.is_active} disabled={!top} onChange={(e) => edit(t.code, { is_active: e.target.checked })} aria-label="Bật loại này" /></td>
                                <td>{top && <button type="button" className={`${s.btn} ${s.btnSm} ${dirty ? s.btnPrimary : ''}`} disabled={!dirty} onClick={() => save(t)}>Lưu</button>}</td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

/* ================= ỦY QUYỀN ================= */
export function DelegationPanel({ me }: { me: Me | null }) {
    const toast = useToast();
    const [rows, setRows] = useState<Delegation[]>([]);
    const [staff, setStaff] = useState<{ id: number; name: string }[]>([]);
    const [to, setTo] = useState(0);
    const [from, setFrom] = useState(() => iso(new Date()));
    const [until, setUntil] = useState(() => iso(new Date(Date.now() + 7 * 86400000)));
    const [reason, setReason] = useState('');
    const top = isTop(me);

    const load = useCallback(async () => {
        try { const r = await approvals.delegations(); setRows(r.data as Delegation[]); }
        catch (e) { toast.push('error', 'Không tải được ủy quyền', errMsg(e)); }
    }, [toast]);
    useEffect(() => { load(); approvals.staff().then((r: any) => { const l = (r?.data ?? []) as { id: number; name: string }[]; setStaff(l); if (l[0]) setTo(l[0].id); }).catch(() => {}); }, [load]);

    const create = async (e: FormEvent) => {
        e.preventDefault();
        if (!to) { toast.push('error', 'Chưa chọn người nhận ủy quyền'); return; }
        try { await approvals.createDelegation({ to_staff_id: to, from_date: from, to_date: until, reason: reason.trim() || undefined }); toast.push('success', 'Đã ủy quyền', `Từ ${fmtD(from)} đến ${fmtD(until)}.`); setReason(''); load(); }
        catch (er) { toast.push('error', 'Chưa ủy quyền được', errMsg(er)); }
    };
    const revoke = async (id: number) => {
        if (!window.confirm('Thu hồi ủy quyền này?')) return;
        try { await approvals.revokeDelegation(id); toast.push('success', 'Đã thu hồi ủy quyền'); load(); }
        catch (er) { toast.push('error', 'Chưa thu hồi được', errMsg(er)); }
    };

    return (
        <section className={s.panel}>
            <div className={s.panelHead}>
                <div><h2>Ủy quyền phê duyệt</h2><p className={s.muted}>Hiệu trưởng ủy quyền cho Phó hiệu trưởng duyệt cả các yêu cầu cấp Hiệu trưởng trong một khoảng thời gian.</p></div>
            </div>
            <div className={s.twoCol}>
                {top ? (
                    <form className={s.block} onSubmit={create}>
                        <h3>Tạo ủy quyền mới</h3>
                        <label className={s.field}><span>Người nhận ủy quyền</span>
                            <select value={to} onChange={(e) => setTo(Number(e.target.value))}>{staff.length === 0 && <option value={0}>Chưa có Phó hiệu trưởng</option>}{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                        </label>
                        <div className={s.row2}>
                            <label className={s.field}><span>Từ ngày</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                            <label className={s.field}><span>Đến ngày</span><input type="date" value={until} min={from} onChange={(e) => setUntil(e.target.value)} /></label>
                        </div>
                        <label className={s.field}><span>Lý do (không bắt buộc)</span><input value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: Hiệu trưởng đi công tác" /></label>
                        <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={!staff.length}><Icon name="plus" size={16} />Ủy quyền</button>
                    </form>
                ) : <div className={s.block}><h3>Quyền ủy quyền</h3><p className={s.muted}>Chỉ Hiệu trưởng được tạo hoặc thu hồi ủy quyền. Danh sách bên cạnh cho biết bạn có đang được ủy quyền hay không.</p></div>}

                <div className={s.block}>
                    <h3>Danh sách ủy quyền</h3>
                    {rows.length === 0 ? <p className={s.muted}>Chưa có ủy quyền nào.</p> : (
                        <ul className={s.delList}>
                            {rows.map((d) => (
                                <li key={d.id}>
                                    <div>
                                        <b>{d.from_name}</b> ủy quyền cho <b>{d.to_name}</b>
                                        <div className={s.muted}>{fmtD(d.from_date)} đến {fmtD(d.to_date)}{d.reason ? `. ${d.reason}` : ''}</div>
                                    </div>
                                    <div className={s.delSide}>
                                        <span className={`${s.badge} ${d.running ? s.badge_approved : s.badge_cancelled}`}>{d.running ? 'Đang hiệu lực' : d.is_active ? 'Chưa hoặc hết hạn' : 'Đã thu hồi'}</span>
                                        {top && d.is_active ? <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => revoke(d.id)}><Icon name="trash" size={14} />Thu hồi</button> : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}