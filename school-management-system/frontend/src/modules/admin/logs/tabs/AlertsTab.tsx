'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '../Icon';
import { logsApi } from '../logsApi';
import { useToast } from '../ToastProvider';
import { Chip, ConfirmDialog, Empty, ErrorState, Modal, Pager, Panel, Segmented, Skeleton, Toggle } from '../ui';
import type { Incident, IncidentList, Rule, RuleInput } from '../types';
import { CATEGORY_LABEL, LEVELS, fmtFull, timeAgo } from '../utils';

interface Props {
    canManage: boolean;
    refreshKey: number;
    onOpenEvent: (id: number) => void;
    onChanged: () => void;
}

const SEV_LABEL = { warning: 'Cảnh báo', error: 'Lỗi', critical: 'Nghiêm trọng' } as const;
const STATUS_LABEL = { open: 'Đang mở', acknowledged: 'Đã nhận', resolved: 'Đã đóng' } as const;
const EMPTY_RULE: RuleInput = { name: '', description: '', category: null, action_pattern: '', min_level: 'warning', threshold: 5, window_minutes: 10, cooldown_minutes: 30, severity: 'warning', enabled: true };

export default function AlertsTab({ canManage, refreshKey, onOpenEvent, onChanged }: Props) {
    const toast = useToast();
    const [view, setView] = useState<'incidents' | 'rules'>('incidents');
    const [status, setStatus] = useState<'active' | 'open' | 'acknowledged' | 'resolved' | ''>('active');
    const [page, setPage] = useState(1);
    const [inc, setInc] = useState<IncidentList | null>(null);
    const [rules, setRules] = useState<Rule[] | null>(null);
    const [error, setError] = useState('');
    const [resolving, setResolving] = useState<Incident | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState<{ id: number | null; form: RuleInput } | null>(null);
    const [formErr, setFormErr] = useState<Record<string, string>>({});
    const [testRes, setTestRes] = useState<{ matching: number; would_trigger: boolean; threshold: number } | null>(null);
    const [delRule, setDelRule] = useState<Rule | null>(null);

    const loadInc = useCallback(async () => {
        try { setInc(await logsApi.incidents({ status, page, per_page: 10 })); setError(''); } catch (e) { setError((e as Error).message); }
    }, [status, page]);
    const loadRules = useCallback(async () => {
        try { setRules(await logsApi.rules()); setError(''); } catch (e) { setError((e as Error).message); }
    }, []);
    useEffect(() => { loadInc(); }, [loadInc, refreshKey]);
    useEffect(() => { loadRules(); }, [loadRules, refreshKey]);

    const act = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true);
        try { await fn(); toast.success(ok); await Promise.all([loadInc(), loadRules()]); onChanged(); }
        catch (e) { toast.error('Chưa thực hiện được', (e as Error).message); } finally { setBusy(false); }
    };

    const evaluate = async () => {
        setBusy(true);
        try { const r = await logsApi.evaluate(); r.opened ? toast.warning(`Đã mở ${r.opened} sự cố mới`, 'Kiểm tra danh sách sự cố bên dưới.') : toast.info('Không có sự cố mới', 'Chưa quy tắc nào vượt ngưỡng.'); await Promise.all([loadInc(), loadRules()]); onChanged(); }
        catch (e) { toast.error('Chưa đánh giá được', (e as Error).message); } finally { setBusy(false); }
    };

    const openForm = (r?: Rule) => { setFormErr({}); setTestRes(null); setEditing({ id: r?.id ?? null, form: r ? { name: r.name, description: r.description ?? '', category: r.category, action_pattern: r.action_pattern ?? '', min_level: r.min_level, threshold: r.threshold, window_minutes: r.window_minutes, cooldown_minutes: r.cooldown_minutes, severity: r.severity, enabled: r.enabled } : { ...EMPTY_RULE } }); };

    const clean = (f: RuleInput): RuleInput => ({ ...f, name: f.name.trim(), description: f.description?.trim() || null, action_pattern: f.action_pattern?.trim() || null, category: f.category || null });

    const validate = (f: RuleInput) => {
        const e: Record<string, string> = {};
        if (!f.name.trim()) e.name = 'Vui lòng nhập tên quy tắc.';
        if (!(f.threshold >= 1)) e.threshold = 'Ngưỡng tối thiểu là 1.';
        if (!(f.window_minutes >= 1 && f.window_minutes <= 1440)) e.window_minutes = 'Từ 1 đến 1440 phút.';
        return e;
    };

    const saveRule = async () => {
        if (!editing) return;
        const e = validate(editing.form);
        setFormErr(e);
        if (Object.keys(e).length) return;
        setBusy(true);
        try {
            const body = clean(editing.form);
            if (editing.id) await logsApi.updateRule(editing.id, body); else await logsApi.createRule(body);
            toast.success(editing.id ? 'Đã lưu quy tắc' : 'Đã tạo quy tắc', body.name);
            setEditing(null);
            await loadRules();
        } catch (er) { setFormErr({ name: (er as Error).message }); toast.error('Chưa lưu được', (er as Error).message); } finally { setBusy(false); }
    };

    const testRule = async () => {
        if (!editing) return;
        const e = validate(editing.form);
        setFormErr(e);
        if (Object.keys(e).length) return;
        try { setTestRes(await logsApi.testRule(clean(editing.form))); } catch (er) { toast.error('Không chạy thử được', (er as Error).message); }
    };

    const toggleRule = (r: Rule, enabled: boolean) => act(() => logsApi.updateRule(r.id, { name: r.name, description: r.description, category: r.category, action_pattern: r.action_pattern, min_level: r.min_level, threshold: r.threshold, window_minutes: r.window_minutes, cooldown_minutes: r.cooldown_minutes, severity: r.severity, enabled }), enabled ? 'Đã bật quy tắc' : 'Đã tắt quy tắc');

    const setF = <K extends keyof RuleInput>(k: K, v: RuleInput[K]) => setEditing((s) => s && { ...s, form: { ...s.form, [k]: v } });

    if (error && !inc && !rules) return <ErrorState message={error} onRetry={() => { loadInc(); loadRules(); }} />;

    return (
        <div className="lg-stack">
            <div className="lg-toolbar">
                <Segmented label="Chế độ xem" value={view} onChange={setView} options={[{ key: 'incidents', label: `Sự cố${inc && inc.counts.open ? ` (${inc.counts.open} mở)` : ''}` }, { key: 'rules', label: `Quy tắc${rules ? ` (${rules.length})` : ''}` }]} />
                <div className="lg-row">
                    <button type="button" className="lg-btn lg-btn--ghost" onClick={evaluate} disabled={!canManage || busy} title={canManage ? 'Đánh giá tất cả quy tắc ngay bây giờ' : 'Cần quyền quản trị'}><Icon name="refresh" size={16} /> Đánh giá ngay</button>
                    {view === 'rules' && <button type="button" className="lg-btn lg-btn--primary" onClick={() => openForm()} disabled={!canManage}><Icon name="plus" size={16} /> Thêm quy tắc</button>}
                </div>
            </div>

            {view === 'incidents' ? (
                <>
                    <div className="lg-statusbar" role="tablist" aria-label="Lọc theo trạng thái">
                        {([['active', 'Chưa đóng'], ['open', 'Đang mở'], ['acknowledged', 'Đã nhận'], ['resolved', 'Đã đóng'], ['', 'Tất cả']] as const).map(([k, label]) => (
                            <button key={k} type="button" role="tab" aria-selected={status === k} className={status === k ? 'is-active' : ''} onClick={() => { setStatus(k); setPage(1); }}>{label}{k && k !== 'active' && inc ? <b>{inc.counts[k]}</b> : null}</button>
                        ))}
                    </div>
                    {!inc ? <Skeleton h={120} r={14} /> : inc.items.length === 0 ? (
                        <Empty icon="check" title="Không có sự cố" text={status === 'resolved' ? 'Chưa có sự cố nào được đóng.' : 'Mọi quy tắc đều trong ngưỡng an toàn.'} />
                    ) : (
                        <ul className="lg-incidents">
                            {inc.items.map((i) => (
                                <li key={i.id} className={`lg-incident lg-incident--${i.severity}${i.status === 'resolved' ? ' is-done' : ''}`}>
                                    <span className="lg-incident__icon"><Icon name={i.status === 'resolved' ? 'check' : 'bell'} size={20} /></span>
                                    <div className="lg-incident__main">
                                        <div className="lg-row"><strong>{i.title}</strong></div>
                                        <p>{i.detail ?? i.rule_name}</p>
                                        <small className="lg-muted">Phát sinh {timeAgo(i.triggered_at)} ({fmtFull(i.triggered_at)}) · {i.matched_count} sự kiện khớp
                                            {i.acknowledged_by && ` · ${i.acknowledged_by} đã nhận`}{i.resolved_by && ` · ${i.resolved_by} đóng ${timeAgo(i.resolved_at)}`}</small>
                                        {i.note && <blockquote>{i.note}</blockquote>}
                                    </div>
                                    <div className="lg-incident__side">
                                        <div className="lg-row"><Chip tone={i.severity === 'critical' ? 'coral' : i.severity === 'error' ? 'coral' : 'amber'}>{SEV_LABEL[i.severity]}</Chip><Chip tone={i.status === 'open' ? 'coral' : i.status === 'acknowledged' ? 'amber' : 'teal'}>{STATUS_LABEL[i.status]}</Chip></div>
                                        <div className="lg-row">
                                            {i.last_log_id && <button type="button" className="lg-btn lg-btn--ghost" onClick={() => onOpenEvent(i.last_log_id as number)}>Sự kiện gần nhất</button>}
                                            {i.status === 'open' && <button type="button" className="lg-btn lg-btn--soft" disabled={!canManage || busy} onClick={() => act(() => logsApi.acknowledge(i.id), 'Đã xác nhận đang xử lý')}>Tôi nhận</button>}
                                            {i.status !== 'resolved' && <button type="button" className="lg-btn lg-btn--primary" disabled={!canManage || busy} onClick={() => { setResolving(i); setNote(''); }}>Đóng sự cố</button>}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {inc && <Pager meta={inc.meta} onPage={setPage} />}
                </>
            ) : !rules ? <Skeleton h={160} r={14} /> : (
                <Panel flush>
                    <ul className="lg-rules">
                        {rules.map((r) => (
                            <li key={r.id} className={r.enabled ? '' : 'is-off'}>
                                <Toggle checked={r.enabled} onChange={(v) => toggleRule(r, v)} label={`Bật quy tắc ${r.name}`} disabled={!canManage || busy} />
                                <div className="lg-rules__main">
                                    <strong>{r.name}</strong>
                                    <p>{r.description || 'Không có mô tả.'}</p>
                                    <div className="lg-chips">
                                        <Chip tone="neutral">≥ {r.threshold} sự kiện / {r.window_minutes} phút</Chip>
                                        <Chip tone="neutral">Từ mức {LEVELS.find((l) => l.key === r.min_level)?.label}</Chip>
                                        {r.category && <Chip tone="brand">{CATEGORY_LABEL[r.category] ?? r.category}</Chip>}
                                        {r.action_pattern && <Chip tone="violet"><code>{r.action_pattern}</code></Chip>}
                                        <Chip tone={r.severity === 'warning' ? 'amber' : 'coral'}>→ {SEV_LABEL[r.severity]}</Chip>
                                    </div>
                                </div>
                                <div className="lg-rules__stat"><b className={(r.matching_now ?? 0) >= r.threshold ? 'lg-bad' : ''}>{r.matching_now ?? 0}<small>/{r.threshold}</small></b><small>đang khớp</small>{(r.open_incidents ?? 0) > 0 && <Chip tone="coral">{r.open_incidents} sự cố mở</Chip>}</div>
                                <div className="lg-row">
                                    <button type="button" className="lg-iconbtn" onClick={() => openForm(r)} disabled={!canManage} aria-label={`Sửa ${r.name}`}><Icon name="edit" size={16} /></button>
                                    <button type="button" className="lg-iconbtn" onClick={() => setDelRule(r)} disabled={!canManage} aria-label={`Xóa ${r.name}`}><Icon name="trash" size={16} /></button>
                                </div>
                            </li>
                        ))}
                        {rules.length === 0 && <Empty icon="bell" title="Chưa có quy tắc nào" text="Tạo quy tắc để hệ thống tự cảnh báo khi có dấu hiệu bất thường." />}
                    </ul>
                </Panel>
            )}

            {/* đóng sự cố */}
            <ConfirmDialog open={!!resolving} tone="brand" title="Đóng sự cố" message={resolving?.title ?? ''} confirmLabel="Đóng sự cố" loading={busy} onCancel={() => setResolving(null)}
                           onConfirm={() => resolving && act(() => logsApi.resolve(resolving.id, note.trim() || null), 'Đã đóng sự cố').then(() => setResolving(null))}>
                <div className="lg-field"><label htmlFor="lg-note">Ghi chú xử lý (tùy chọn)</label><textarea id="lg-note" className="lg-textarea" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd Đã chặn IP, đã đổi mật khẩu tài khoản…" /></div>
            </ConfirmDialog>

            <ConfirmDialog open={!!delRule} title="Xóa quy tắc?" message={`Quy tắc “${delRule?.name}” sẽ bị xóa. Các sự cố đã phát sinh vẫn được giữ lại.`} confirmLabel="Xóa quy tắc" loading={busy}
                           onCancel={() => setDelRule(null)} onConfirm={() => delRule && act(() => logsApi.deleteRule(delRule.id), 'Đã xóa quy tắc').then(() => setDelRule(null))} />

            {/* thêm / sửa quy tắc */}
            <Modal wide open={!!editing} title={editing?.id ? 'Sửa quy tắc cảnh báo' : 'Thêm quy tắc cảnh báo'} onClose={() => setEditing(null)}
                   footer={<><button type="button" className="lg-btn lg-btn--ghost" onClick={testRule}><Icon name="flask" size={15} /> Chạy thử</button><span className="lg-spacer" /><button type="button" className="lg-btn lg-btn--ghost" onClick={() => setEditing(null)}>Hủy</button><button type="button" className="lg-btn lg-btn--primary" onClick={saveRule} disabled={busy}>{busy && <span className="lg-spinner" />} Lưu quy tắc</button></>}>
                {editing && (
                    <div className="lg-formgrid">
                        <div className={`lg-field lg-field--wide${formErr.name ? ' has-error' : ''}`}><label htmlFor="r-name">Tên quy tắc *</label><input id="r-name" value={editing.form.name} onChange={(e) => setF('name', e.target.value)} maxLength={120} autoFocus />{formErr.name && <small className="lg-err">{formErr.name}</small>}</div>
                        <div className="lg-field lg-field--wide"><label htmlFor="r-desc">Mô tả</label><input id="r-desc" value={editing.form.description ?? ''} onChange={(e) => setF('description', e.target.value)} maxLength={255} /></div>
                        <div className="lg-field"><label htmlFor="r-cat">Nhóm sự kiện</label><select id="r-cat" value={editing.form.category ?? ''} onChange={(e) => setF('category', e.target.value || null)}><option value="">Mọi nhóm</option>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                        <div className="lg-field"><label htmlFor="r-act">Hành động (có thể dùng %)</label><input id="r-act" value={editing.form.action_pattern ?? ''} onChange={(e) => setF('action_pattern', e.target.value)} placeholder="vd auth.login_failed hoặc finance.%" /></div>
                        <div className="lg-field"><label htmlFor="r-lvl">Từ mức độ</label><select id="r-lvl" value={editing.form.min_level} onChange={(e) => setF('min_level', e.target.value as RuleInput['min_level'])}>{LEVELS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select></div>
                        <div className="lg-field"><label htmlFor="r-sev">Mức của sự cố</label><select id="r-sev" value={editing.form.severity} onChange={(e) => setF('severity', e.target.value as RuleInput['severity'])}><option value="warning">Cảnh báo</option><option value="error">Lỗi</option><option value="critical">Nghiêm trọng</option></select></div>
                        <div className={`lg-field${formErr.threshold ? ' has-error' : ''}`}><label htmlFor="r-th">Ngưỡng (số sự kiện)</label><input id="r-th" type="number" min={1} value={editing.form.threshold} onChange={(e) => setF('threshold', Number(e.target.value))} />{formErr.threshold && <small className="lg-err">{formErr.threshold}</small>}</div>
                        <div className={`lg-field${formErr.window_minutes ? ' has-error' : ''}`}><label htmlFor="r-win">Trong khoảng (phút)</label><input id="r-win" type="number" min={1} max={1440} value={editing.form.window_minutes} onChange={(e) => setF('window_minutes', Number(e.target.value))} />{formErr.window_minutes && <small className="lg-err">{formErr.window_minutes}</small>}</div>
                        <div className="lg-field"><label htmlFor="r-cd">Chờ giữa 2 lần báo (phút)</label><input id="r-cd" type="number" min={0} value={editing.form.cooldown_minutes} onChange={(e) => setF('cooldown_minutes', Number(e.target.value))} /></div>
                        <label className="lg-check"><input type="checkbox" checked={editing.form.enabled} onChange={(e) => setF('enabled', e.target.checked)} /> Bật quy tắc này</label>
                        {testRes && <div className={`lg-banner ${testRes.would_trigger ? 'lg-banner--warn' : 'lg-banner--ok'} lg-field--wide`}><Icon name={testRes.would_trigger ? 'alert' : 'check'} size={18} /><span>Hiện có <strong>{testRes.matching}</strong> sự kiện khớp (ngưỡng {testRes.threshold}). {testRes.would_trigger ? 'Quy tắc này SẼ mở sự cố ngay.' : 'Quy tắc chưa vượt ngưỡng.'}</span></div>}
                    </div>
                )}
            </Modal>
        </div>
    );
}