'use client';

import { useState } from 'react';
import { Card, Empty, ErrorBox, Field, Loading, Modal, Pill, Tabs, WriteNote, ago, dt, mon, useLoad, useMon } from '../_hl';

export default function Alerts() {
    const { canWrite, toast, refreshBadge } = useMon();
    const [tab, setTab] = useState('active');
    const { data, err, loading, reload } = useLoad<any>(`alerts?status=${tab === 'rules' ? 'active' : tab}`, 30);
    const [edit, setEdit] = useState<any>(null);
    const [form, setForm] = useState<{ threshold: string; severity: string; enabled: boolean }>({ threshold: '', severity: 'warning', enabled: true });
    const [errs, setErrs] = useState<Record<string, string>>({});

    const act = async (id: number, action: 'ack' | 'resolve') => {
        try { const r: any = await mon(`alerts/${id}`, { method: 'POST', body: { action } }); toast(r.message); reload(); refreshBadge(); } catch (e: any) { toast(e.message, 'err'); }
    };
    const openRule = (r: any) => { setEdit(r); setErrs({}); setForm({ threshold: String(r.threshold), severity: r.severity, enabled: !!r.enabled }); };
    const save = async () => {
        try { await mon(`rules/${edit.id}`, { method: 'PUT', body: { threshold: form.threshold === '' ? null : Number(form.threshold), severity: form.severity, enabled: form.enabled } }); toast('Đã lưu quy tắc.'); setEdit(null); reload(); }
        catch (e: any) { setErrs(e.errors || {}); toast(e.message, 'err'); }
    };

    if (loading && !data) return <Loading rows={4} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const d = data!;

    return (
        <div className="hl-stack">
            <WriteNote />
            <Tabs value={tab} onChange={setTab} items={[{ key: 'active', label: 'Đang mở', n: d.counts.open + d.counts.ack }, { key: 'resolved', label: 'Đã đóng', n: d.counts.resolved }, { key: 'rules', label: 'Quy tắc cảnh báo', n: d.rules.length }]} />

            {tab !== 'rules' && (
                d.items.length === 0 ? <Card><Empty title={tab === 'active' ? 'Không có cảnh báo nào đang mở' : 'Chưa có cảnh báo nào được đóng'} text="Hệ thống đánh giá các quy tắc mỗi lần mở Tổng quan hoặc chạy kiểm tra." /></Card> : (
                    <div className="hl-alist">{d.items.map((a: any) => (
                        <article key={a.id} className={`hl-alert sev-${a.severity} st-${a.status}`}>
                            <i className="bar" />
                            <div className="bd">
                                <div className="hd"><b>{a.title}</b><Pill tone={a.severity === 'critical' ? 'red' : 'amber'}>{a.severity === 'critical' ? 'Nghiêm trọng' : 'Cảnh báo'}</Pill>
                                    {a.status === 'ack' && <Pill tone="blue">Đã tiếp nhận</Pill>}{a.status === 'resolved' && <Pill tone="green">Đã đóng</Pill>}</div>
                                <p>{a.detail}</p>
                                <small>Phát sinh {dt(a.created_at)} ({ago(a.created_at)})
                                    {a.ack_by ? ` · tiếp nhận bởi ${a.ack_by}` : ''}{a.resolved_by ? ` · đóng bởi ${a.resolved_by === 'system' ? 'hệ thống (tự đóng)' : a.resolved_by}` : ''}</small>
                            </div>
                            {canWrite && a.status !== 'resolved' && <div className="ac">
                                {a.status === 'open' && <button className="hl-btn sm" onClick={() => act(a.id, 'ack')}>Tiếp nhận</button>}
                                <button className="hl-btn sm primary" onClick={() => act(a.id, 'resolve')}>Đóng</button></div>}
                        </article>))}</div>
                )
            )}

            {tab === 'rules' && (
                <Card title="Quy tắc cảnh báo" sub="Hệ thống tự mở cảnh báo khi chỉ số vượt ngưỡng và tự đóng khi trở lại bình thường" flush>
                    <div className="hl-tw"><table className="hl-table">
                        <thead><tr><th>Quy tắc</th><th>Điều kiện</th><th>Mức độ</th><th>Trạng thái</th>{canWrite && <th />}</tr></thead>
                        <tbody>{d.rules.map((r: any) => (
                            <tr key={r.id}><td><b>{r.name}</b><small>{r.description}</small></td>
                                <td><span className="mono">{r.metric} {r.op} {r.threshold} {r.unit}</span></td>
                                <td><Pill tone={r.severity === 'critical' ? 'red' : 'amber'}>{r.severity === 'critical' ? 'Nghiêm trọng' : 'Cảnh báo'}</Pill></td>
                                <td>{r.enabled ? <Pill tone="green" dot>Đang bật</Pill> : <Pill tone="gray" dot>Đã tắt</Pill>}</td>
                                {canWrite && <td className="r"><button className="hl-btn sm" onClick={() => openRule(r)}>Sửa</button></td>}</tr>))}</tbody>
                    </table></div>
                </Card>
            )}

            {edit && (
                <Modal title={`Sửa quy tắc: ${edit.name}`} onClose={() => setEdit(null)} foot={<><button className="hl-btn" onClick={() => setEdit(null)}>Hủy</button><button className="hl-btn primary" onClick={save}>Lưu quy tắc</button></>}>
                    <p className="hl-p">{edit.description}</p>
                    <Field label={`Ngưỡng (${edit.metric} ${edit.op} … ${edit.unit})`} error={errs.threshold}><input className="hl-in" type="number" step="any" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></Field>
                    <Field label="Mức độ" error={errs.severity}><select className="hl-in" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}><option value="warning">Cảnh báo</option><option value="critical">Nghiêm trọng</option></select></Field>
                    <label className="hl-check"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Bật quy tắc này</label>
                </Modal>
            )}
        </div>
    );
}