'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, FeeItem, SettingsApi } from '../api';
import { CATEGORY, Card, Confirm, Field, Modal, Skeleton, money, useToast } from '../ui';

const EMPTY: Partial<FeeItem> = { code: '', name: '', category: 'tuition', amount: 0, unit: 'năm', grade: null, is_mandatory: 1, note: '' };

export default function FeeItemsPanel({ onChanged }: { onChanged: () => void }) {
    const toast = useToast();
    const [rows, setRows] = useState<FeeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [cat, setCat] = useState('');
    const [edit, setEdit] = useState<Partial<FeeItem> | null>(null);
    const [errs, setErrs] = useState<Record<string, string>>({});
    const [del, setDel] = useState<FeeItem | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setRows((await SettingsApi.feeItems(q, cat)).data); }
        catch (e) { toast('error', 'Không tải được danh mục khoản thu', (e as Error).message); }
        finally { setLoading(false); }
    }, [q, cat, toast]);

    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

    const save = async () => {
        if (!edit) return;
        setBusy(true); setErrs({});
        const body = { ...edit, amount: Number(edit.amount || 0), is_mandatory: !!edit.is_mandatory, grade: edit.grade || null };
        try {
            const res: any = edit.id ? await SettingsApi.updateFeeItem(edit.id, body) : await SettingsApi.createFeeItem(body);
            toast('success', res.message); setEdit(null); load(); onChanged();
        } catch (e) {
            const err = e as ApiError;
            if (err.errors) setErrs(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
            toast('error', 'Chưa lưu được', err.message);
        } finally { setBusy(false); }
    };

    const remove = async () => {
        if (!del) return;
        setBusy(true);
        try { const r: any = await SettingsApi.deleteFeeItem(del.id); toast('success', r.message); setDel(null); load(); onChanged(); }
        catch (e) { toast('error', 'Không xóa được', (e as Error).message); setDel(null); }
        finally { setBusy(false); }
    };

    const set = (k: keyof FeeItem, v: any) => setEdit((s) => ({ ...s!, [k]: v }));

    return (
        <Card title="Danh mục khoản thu" desc="Học phí, bảo hiểm, quỹ, dịch vụ… dùng khi tạo đợt thu và phát hành hóa đơn.">
            <div className="acs-tools">
                <input placeholder="Tìm theo mã hoặc tên khoản thu…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">Tất cả nhóm</option>
                    {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button className="acs-btn" onClick={() => { setErrs({}); setEdit({ ...EMPTY }); }}>+ Thêm khoản thu</button>
            </div>

            {loading ? <Skeleton /> : rows.length === 0 ? <div className="acs-empty">Chưa có khoản thu nào.</div> : (
                <div className="acs-wrap">
                    <table className="acs-table">
                        <thead><tr><th>Mã</th><th>Tên khoản thu</th><th>Nhóm</th><th>Đơn giá</th><th>Khối</th><th>Bắt buộc</th><th>Đã dùng</th><th /></tr></thead>
                        <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td><b>{r.code}</b></td>
                                <td>{r.name}<div style={{ color: '#64748b', fontSize: 12 }}>{r.note}</div></td>
                                <td><span className="acs-tag">{CATEGORY[r.category] || r.category}</span></td>
                                <td>{money(r.amount)}<div style={{ color: '#64748b', fontSize: 12 }}>/ {r.unit}</div></td>
                                <td>{r.grade ? `Khối ${r.grade}` : 'Mọi khối'}</td>
                                <td>{r.is_mandatory ? <span className="acs-tag warn">Bắt buộc</span> : <span className="acs-tag off">Tự nguyện</span>}</td>
                                <td>{r.used_count ? `${r.used_count} dòng` : '—'}</td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                    <button className="acs-btn ghost sm" onClick={() => { setErrs({}); setEdit({ ...r }); }}>Sửa</button>{' '}
                                    <button className="acs-btn danger sm" onClick={() => setDel(r)}>Xóa</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {edit && (
                <Modal title={edit.id ? 'Sửa khoản thu' : 'Thêm khoản thu'} onClose={() => setEdit(null)}
                       footer={<><button className="acs-btn ghost" onClick={() => setEdit(null)}>Hủy</button><button className="acs-btn" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu'}</button></>}>
                    <div className="acs-grid">
                        <Field label="Mã khoản thu" error={errs.code}><input value={edit.code || ''} onChange={(e) => set('code', e.target.value.toUpperCase())} /></Field>
                        <Field label="Nhóm" error={errs.category}>
                            <select value={edit.category} onChange={(e) => set('category', e.target.value)}>
                                {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </Field>
                        <Field label="Tên khoản thu" error={errs.name} span><input value={edit.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
                        <Field label="Đơn giá (VNĐ)" error={errs.amount} hint={money(edit.amount || 0)}>
                            <input inputMode="numeric" value={edit.amount ?? 0} onChange={(e) => set('amount', e.target.value.replace(/\D/g, ''))} />
                        </Field>
                        <Field label="Đơn vị tính" error={errs.unit}><input value={edit.unit || ''} onChange={(e) => set('unit', e.target.value)} placeholder="năm, học kỳ, lần…" /></Field>
                        <Field label="Áp dụng cho khối" error={errs.grade}>
                            <select value={edit.grade ?? ''} onChange={(e) => set('grade', e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Mọi khối</option><option value="10">Khối 10</option><option value="11">Khối 11</option><option value="12">Khối 12</option>
                            </select>
                        </Field>
                        <Field label="Tính chất">
                            <select value={edit.is_mandatory ? '1' : '0'} onChange={(e) => set('is_mandatory', e.target.value === '1' ? 1 : 0)}>
                                <option value="1">Bắt buộc</option><option value="0">Tự nguyện</option>
                            </select>
                        </Field>
                        <Field label="Ghi chú" error={errs.note} span><input value={edit.note || ''} onChange={(e) => set('note', e.target.value)} /></Field>
                    </div>
                    {edit.id ? <div className="acs-alert info" style={{ marginTop: 16, marginBottom: 0 }}>Đổi đơn giá chỉ áp dụng cho đợt thu mới. Hóa đơn đã phát hành giữ nguyên số tiền.</div> : null}
                </Modal>
            )}

            {del && (
                <Confirm title="Xóa khoản thu" danger busy={busy} okText="Xóa" onOk={remove} onCancel={() => setDel(null)}
                         text={`Xóa khoản thu "${del.code} – ${del.name}"? Nếu khoản này đã nằm trong hóa đơn hoặc đợt thu, hệ thống sẽ không cho xóa.`} />
            )}
        </Card>
    );
}