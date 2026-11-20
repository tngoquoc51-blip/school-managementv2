'use client';

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { errMsg, fieldErrors, fmtDT, settingsApi } from './api';
import { Field as F, Card, Icon, Skeleton, Toggle, useToast, Btn, Badge } from './ui';
import { Field, GROUPS } from './schema';

interface Props {
    group: string;
    onSaved?: (values: Record<string, any>) => void;
    /** khu vực phụ hiển thị phía dưới form (vd: nút gửi thử email) */
    extra?: (ctx: { values: Record<string, any>; dirty: boolean }) => ReactNode;
}

export default function GroupForm({ group, onSaved, extra }: Props) {
    const def = GROUPS[group];
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [orig, setOrig] = useState<Record<string, any>>({});
    const [vals, setVals] = useState<Record<string, any>>({});
    const [secrets, setSecrets] = useState<Record<string, boolean>>({});
    const [clear, setClear] = useState<Record<string, boolean>>({});
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const d = await settingsApi.getGroup(group);
            setOrig(d.values); setVals(d.values); setSecrets(d.secrets || {}); setUpdatedAt(d.updated_at); setClear({}); setErrs({});
        } catch (e) { toast('err', 'Không tải được cài đặt', errMsg(e)); }
        finally { setLoading(false); }
    }, [group]);
    useEffect(() => { load(); }, [load]);

    const dirty = useMemo(
        () => Object.keys(vals).some((k) => String(vals[k] ?? '') !== String(orig[k] ?? '')) || Object.values(clear).some(Boolean),
        [vals, orig, clear]
    );

    // cảnh báo khi rời trang mà chưa lưu
    useEffect(() => {
        const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [dirty]);

    const set = (k: string, v: any) => { setVals((s) => ({ ...s, [k]: v })); setErrs((s) => { const n = { ...s }; delete n[k]; return n; }); };

    const save = async () => {
        setSaving(true); setErrs({});
        try {
            const payload: Record<string, any> = {};
            Object.keys(vals).forEach((k) => { if (String(vals[k] ?? '') !== String(orig[k] ?? '') || secrets[k] !== undefined) payload[k] = vals[k]; });
            Object.keys(clear).forEach((k) => { if (clear[k]) payload[k] = '__CLEAR__'; });
            const d = await settingsApi.saveGroup(group, payload);
            setOrig(d.values); setVals(d.values); setSecrets(d.secrets || {}); setUpdatedAt(d.updated_at); setClear({});
            toast('ok', 'Đã lưu cài đặt', def.title);
            onSaved?.(d.values);
        } catch (e: any) {
            const fe = fieldErrors(e); setErrs(fe);
            toast('err', 'Không lưu được', Object.keys(fe).length ? 'Kiểm tra các trường được đánh dấu đỏ' : errMsg(e));
        } finally { setSaving(false); }
    };
    const discard = () => { setVals(orig); setClear({}); setErrs({}); };

    const renderInput = (f: Field) => {
        const v = vals[f.key] ?? '';
        const bad = errs[f.key] ? 'bad' : '';
        switch (f.type) {
            case 'toggle':
                return <div className="st-toggle-row"><div><b>{f.label}</b>{f.hint && <small>{f.hint}</small>}</div><Toggle on={v === '1' || v === 1 || v === true} onChange={(x) => set(f.key, x ? '1' : '0')} label={f.label} /></div>;
            case 'select':
                return <select className={`st-in ${bad}`} value={v} onChange={(e) => set(f.key, e.target.value)}>{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
            case 'textarea':
                return <textarea className={`st-in ${bad}`} value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
            case 'color':
                return <div className="st-color"><input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#0b63ce'} onChange={(e) => set(f.key, e.target.value)} /><input className={`st-in ${bad}`} value={v} maxLength={7} onChange={(e) => set(f.key, e.target.value)} style={{ maxWidth: 130, fontFamily: 'monospace' }} /></div>;
            case 'secret':
                return (
                    <div>
                        <input className={`st-in ${bad}`} type="password" autoComplete="new-password" value={v} disabled={clear[f.key]}
                               placeholder={secrets[f.key] ? '•••••••• (đã lưu — nhập để thay đổi)' : 'Chưa đặt'} onChange={(e) => set(f.key, e.target.value)} />
                        {secrets[f.key] && (
                            <label style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 12.5, color: 'var(--st-muted)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!clear[f.key]} onChange={(e) => setClear((s) => ({ ...s, [f.key]: e.target.checked }))} /> Xóa giá trị đã lưu
                            </label>
                        )}
                    </div>
                );
            default: {
                const inp = <input className={`st-in ${bad}`} type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'} value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />;
                return f.suffix ? <div className="st-addon">{inp}<span>{f.suffix}</span></div> : inp;
            }
        }
    };

    if (loading) return <Skeleton rows={3} />;

    return (
        <>
            {group === 'appearance' && (
                <div className="st-prev" style={{ ['--p' as any]: vals.primary_color, ['--a' as any]: vals.accent_color }}>
                    <Icon name="school" size={30} />
                    <div><b style={{ fontSize: 16 }}>{vals.login_banner_text || 'Hệ thống quản lý trường THPT'}</b><div style={{ opacity: .85, fontSize: 12.5 }}>Xem trước phối màu chủ đạo của hệ thống</div></div>
                </div>
            )}

            {def.sections.map((s) => (
                <Card key={s.title} icon={s.icon} title={s.title} desc={s.desc}>
                    <div className="st-grid">
                        {s.fields.map((f) =>
                            f.type === 'toggle' ? (
                                <div key={f.key} className={f.wide ? 'wide' : ''}>{renderInput(f)}</div>
                            ) : (
                                <F key={f.key} label={f.label} hint={f.hint} error={errs[f.key]} wide={f.wide}>{renderInput(f)}</F>
                            )
                        )}
                    </div>
                </Card>
            ))}

            {extra?.({ values: vals, dirty })}

            <div style={{ color: 'var(--st-muted)', fontSize: 12.5 }}>
                {updatedAt ? <>Cập nhật lần cuối: <b>{fmtDT(updatedAt)}</b></> : 'Chưa có chỉnh sửa nào'} · Mọi thay đổi đều được ghi vào Nhật ký hệ thống.
            </div>

            {dirty && (
                <div className="st-save" role="alert">
                    <span className="dot" /> <span>Có thay đổi chưa lưu</span>
                    <Btn onClick={discard} disabled={saving} icon="undo">Hoàn tác</Btn>
                    <Btn kind="pri" onClick={save} busy={saving} icon="check">Lưu thay đổi</Btn>
                </div>
            )}
        </>
    );
}