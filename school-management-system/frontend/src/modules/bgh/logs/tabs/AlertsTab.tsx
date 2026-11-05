'use client';

import { useCallback, useEffect, useState } from 'react';
import s from '../logs.module.css';
import { errorMessage, logsApi } from '../api';
import { Icon } from '../components/Icons';
import { AlertStatusChip, Card, Confirm, Empty, ErrorBox, Pager, SevChip, Skeleton, useAsync, useToast } from '../components/ui';
import { ago, fmtTime, nf } from '../format';
import type { AlertRow, AlertsData, RuleRow, Severity } from '../types';
import type { TabProps } from './tabProps';

const STATUSES: { k: string; label: string }[] = [{ k: 'open', label: 'Mới' }, { k: 'ack', label: 'Đã tiếp nhận' }, { k: 'resolved', label: 'Đã xử lý' }, { k: 'all', label: 'Tất cả' }];

export default function AlertsTab({ me, tick, openLog, onBadges }: TabProps) {
    const [status, setStatus] = useState('open');
    const [page, setPage] = useState(1);
    const { data, error, run } = useAsync<AlertsData>();
    const rules = useAsync<RuleRow[]>();
    const [resolve, setResolve] = useState<AlertRow | null>(null);
    const toast = useToast();

    const load = useCallback((silent = false) => run(() => logsApi.alerts(status, page), silent), [run, status, page]);
    useEffect(() => { load(tick > 0); }, [load, tick]);
    useEffect(() => { rules.run(() => logsApi.rules()); }, [rules.run]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (data) onBadges({ alerts: Number(data.counts.open || 0) }); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => setPage(1), [status]);

    const ack = async (a: AlertRow) => { try { await logsApi.ackAlert(a.id); toast('ok', 'Đã tiếp nhận cảnh báo'); load(true); } catch (e) { toast('err', errorMessage(e)); } };
    const doResolve = async (note: string) => {
        if (!resolve) return;
        try { await logsApi.resolveAlert(resolve.id, note); toast('ok', 'Đã đánh dấu xử lý'); load(true); } catch (e) { toast('err', errorMessage(e)); }
        setResolve(null);
    };
    const patchRule = async (r: RuleRow, body: Partial<RuleRow>) => {
        try { const u = await logsApi.updateRule(r.id, body); rules.setData((rules.data || []).map((x) => (x.id === r.id ? u : x))); toast('ok', `Đã lưu luật ${r.code}`); }
        catch (e) { toast('err', errorMessage(e)); }
    };

    return (
        <div className={s.stack}>
            <Card title="Cảnh báo bảo mật" sub="Phát sinh tự động từ các luật bên dưới mỗi khi có sự kiện bất thường"
                  right={<div className={s.pills}>{STATUSES.map((x) => (
                      <button key={x.k} className={`${s.pill} ${status === x.k ? s.on : ''}`} onClick={() => setStatus(x.k)}>
                          {x.label}{x.k !== 'all' && data?.counts[x.k as 'open'] ? ` (${data.counts[x.k as 'open']})` : ''}</button>))}</div>}>
                {error && !data && <ErrorBox message={error} onRetry={() => load()} />}
                {!data && !error && <Skeleton h={200} />}
                {data && (data.items.length ? (
                    <>
                        <div className={s.list}>
                            {data.items.map((a) => (
                                <div key={a.id} className={s.li} style={{ alignItems: 'flex-start' }}>
                                    <SevChip v={a.severity} />
                                    <div className={s.liBody}>
                                        <div className={s.liTitle}>{a.title}</div>
                                        <div className={`${s.small} ${s.muted}`}>{a.detail}</div>
                                        <div className={`${s.small} ${s.faint}`} style={{ marginTop: 4 }}>
                                            {a.rule_name && <>{a.rule_name} · </>}{fmtTime(a.created_at, true)} ({ago(a.created_at)}){a.ip && <> · <span className={s.mono}>{a.ip}</span></>}
                                        </div>
                                        {a.status !== 'open' && <div className={`${s.small} ${s.muted}`} style={{ marginTop: 4 }}>
                                            {a.ack_by && <>Tiếp nhận: {a.ack_by}</>}{a.resolved_by && <> · Xử lý: {a.resolved_by}</>}{a.resolve_note && <> — “{a.resolve_note}”</>}</div>}
                                    </div>
                                    <AlertStatusChip v={a.status} />
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {a.ref_log_id && <button className={`${s.btn} ${s.sm}`} onClick={() => openLog(a.ref_log_id!)}><Icon name="eye" size={14} /> Xem log</button>}
                                        {a.status === 'open' && <button className={`${s.btn} ${s.sm}`} onClick={() => ack(a)}>Tiếp nhận</button>}
                                        {a.status !== 'resolved' && <button className={`${s.btn} ${s.sm} ${s.primary}`} onClick={() => setResolve(a)}><Icon name="check" size={14} /> Xử lý</button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pager page={data.meta.page} last={data.meta.last_page} total={data.meta.total} per={data.meta.per_page} onPage={setPage} />
                    </>
                ) : <Empty icon="check" title="Không có cảnh báo nào" hint="Mọi thứ đang ổn." />)}
            </Card>

            <Card title="Luật cảnh báo" sub={me.can_admin ? 'Bật/tắt và chỉnh ngưỡng — thay đổi được ghi vào nhật ký' : 'Chỉ Hiệu trưởng / Quản trị mới được chỉnh luật'}>
                {rules.error && <ErrorBox message={rules.error} />}
                {rules.data?.map((r) => <RuleRowView key={r.id} rule={r} canEdit={me.can_admin} onSave={(b) => patchRule(r, b)} />)}
            </Card>

            {resolve && <Confirm title="Xử lý cảnh báo" confirmText="Đánh dấu đã xử lý" onCancel={() => setResolve(null)} onOk={doResolve}
                                 input={{ label: 'Ghi chú xử lý (tuỳ chọn)' }} body={<>{resolve.title}</>} />}
        </div>
    );
}

function RuleRowView({ rule, canEdit, onSave }: { rule: RuleRow; canEdit: boolean; onSave: (b: Partial<RuleRow>) => void }) {
    const [th, setTh] = useState(String(rule.threshold));
    const [win, setWin] = useState(String(rule.window_minutes));
    const [sev, setSev] = useState<Severity>(rule.severity);
    useEffect(() => { setTh(String(rule.threshold)); setWin(String(rule.window_minutes)); setSev(rule.severity); }, [rule]);
    const dirty = th !== String(rule.threshold) || win !== String(rule.window_minutes) || sev !== rule.severity;
    const usesWindow = rule.rule_type !== 'critical_event' && rule.rule_type !== 'off_hours_login';

    return (
        <div className={s.ruleCard}>
            <div>
                <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>{rule.name} <span className={`${s.chip} ${s.sev_info}`}>{rule.code}</span></div>
                <div className={`${s.small} ${s.muted}`}>{rule.description}</div>
                <div className={s.ruleCtl} style={{ marginTop: 10 }}>
                    {rule.rule_type !== 'critical_event' && rule.rule_type !== 'off_hours_login' && (
                        <label className={s.small}>Ngưỡng <input className={`${s.field} ${s.num}`} type="number" min={1} value={th} disabled={!canEdit} onChange={(e) => setTh(e.target.value)} /></label>)}
                    {usesWindow && <label className={s.small}>Trong (phút) <input className={`${s.field} ${s.num}`} type="number" min={1} value={win} disabled={!canEdit} onChange={(e) => setWin(e.target.value)} /></label>}
                    <label className={s.small}>Mức độ <select className={s.field} value={sev} disabled={!canEdit} onChange={(e) => setSev(e.target.value as Severity)}>
                        <option value="notice">Lưu ý</option><option value="warning">Cảnh báo</option><option value="critical">Nghiêm trọng</option></select></label>
                    {canEdit && dirty && <button className={`${s.btn} ${s.sm} ${s.primary}`} onClick={() => onSave({ threshold: Number(th), window_minutes: Number(win), severity: sev })}>Lưu</button>}
                </div>
            </div>
            <button className={`${s.switch} ${rule.enabled ? s.on : ''}`} disabled={!canEdit} aria-label={`Bật tắt luật ${rule.code}`} aria-pressed={!!rule.enabled}
                    onClick={() => onSave({ enabled: !rule.enabled } as any)} />
        </div>
    );
}