'use client';
import { useCallback, useEffect, useState } from 'react';
import { wApi, errMsg } from './api';
import type { Meta, WType } from './types';
import { Empty, Icon, Modal, Pct, Skeleton, useUI } from './ui';

const BLANK: Partial<WType> = { code: '', label: '', description: '', default_percent: 50, applies_to: 'tuition', legal_basis: '', required_docs: '', is_active: 1, sort_order: 50 };

function Editor({ t, onClose, onSaved }: { t: Partial<WType>; onClose: () => void; onSaved: () => void }) {
    const { toast } = useUI();
    const [f, setF] = useState<Partial<WType>>(t);
    const [busy, setBusy] = useState(false);
    const set = (k: keyof WType, v: any) => setF((x) => ({ ...x, [k]: v }));
    const ok = !!f.code && /^[a-z0-9_]+$/.test(f.code) && !!f.label && (f.default_percent ?? -1) >= 0;

    async function save() {
        setBusy(true);
        try { await wApi.saveType(f); toast('success', f.id ? 'Đã cập nhật chính sách' : 'Đã thêm chính sách mới'); onSaved(); onClose(); }
        catch (e) { toast('error', 'Không lưu được', errMsg(e)); } finally { setBusy(false); }
    }
    return (
        <Modal onClose={onClose}>
            <h3>{f.id ? 'Sửa chính sách' : 'Thêm chính sách miễn giảm'}</h3>
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                <div className="wv-row">
                    <div className="wv-f"><label>Mã (a-z, 0-9, _) *</label><input className="wv-input" value={f.code || ''} disabled={!!f.id} onChange={(e) => set('code', e.target.value.toLowerCase())} placeholder="vd: teacher_child" /></div>
                    <div className="wv-f"><label>Tỷ lệ mặc định (%) *</label><input className="wv-input" type="number" min={0} max={100} value={f.default_percent ?? 0} onChange={(e) => set('default_percent', Number(e.target.value))} /></div>
                </div>
                <div className="wv-f"><label>Tên chính sách *</label><input className="wv-input" value={f.label || ''} onChange={(e) => set('label', e.target.value)} /></div>
                <div className="wv-f"><label>Mô tả đối tượng</label><input className="wv-input" value={f.description || ''} onChange={(e) => set('description', e.target.value)} /></div>
                <div className="wv-f"><label>Căn cứ văn bản</label><input className="wv-input" value={f.legal_basis || ''} onChange={(e) => set('legal_basis', e.target.value)} placeholder="Số hiệu văn bản do nhà trường tự đối chiếu" /></div>
                <div className="wv-f"><label>Hồ sơ minh chứng (cách nhau dấu ;)</label><textarea className="wv-area" rows={2} value={f.required_docs || ''} onChange={(e) => set('required_docs', e.target.value)} /></div>
            </div>
            <div className="acts"><button className="wv-btn" onClick={onClose}>Hủy</button><button className="wv-btn pri" disabled={!ok || busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu'}</button></div>
        </Modal>
    );
}

export default function TypesTab({ meta, tick, onChanged }: { meta: Meta; tick: number; onChanged: () => void }) {
    const { toast } = useUI();
    const [list, setList] = useState<WType[] | null>(null);
    const [edit, setEdit] = useState<Partial<WType> | null>(null);

    const load = useCallback(() => wApi.types().then(setList).catch((e) => toast('error', 'Không tải được danh mục', errMsg(e))), [toast]);
    useEffect(() => { load(); }, [load, tick]);

    async function toggle(t: WType) {
        try { const r = await wApi.toggleType(t.id); toast('info', r.is_active ? 'Đã bật chính sách' : 'Đã tạm ngưng chính sách', t.label); onChanged(); load(); }
        catch (e) { toast('error', 'Thao tác thất bại', errMsg(e)); }
    }

    return (
        <>
            <div className="wv-bar">
                <p className="wv-sub" style={{ margin: 0, flex: 1 }}>Danh mục dùng khi lập đơn. Tạm ngưng chính sách sẽ không ảnh hưởng các miễn giảm đang áp dụng.</p>
                {meta.can_approve && <button className="wv-btn pri" onClick={() => setEdit({ ...BLANK })}><Icon n="plus" /> Thêm chính sách</button>}
            </div>
            {!list ? <div className="wv-card"><Skeleton rows={6} /></div> : list.length === 0 ? <Empty icon="tag" title="Chưa có chính sách nào" /> : (
                <div className="wv-tg">
                    {list.map((t) => (
                        <div key={t.id} className={`wv-card wv-tc ${t.is_active ? '' : 'off'}`}>
                            <header>
                                <div><b style={{ fontSize: 15 }}>{t.label}</b><div className="wv-sub">{t.code}</div></div>
                                {meta.can_approve && <button className={`wv-switch ${t.is_active ? 'on' : ''}`} onClick={() => toggle(t)} aria-label="Bật/tắt" title={t.is_active ? 'Đang bật' : 'Đang tắt'} />}
                            </header>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Pct v={t.default_percent} /><span className="wv-sub">mặc định · {t.usage || 0} học sinh đang áp dụng</span></div>
                            {t.description && <div className="wv-sub">{t.description}</div>}
                            {t.required_docs && <div className="wv-sub"><b>Hồ sơ:</b> {t.required_docs.split(';').map((x) => x.trim()).join(' · ')}</div>}
                            {t.legal_basis && <div className="wv-sub"><b>Căn cứ:</b> {t.legal_basis}</div>}
                            {meta.can_approve && <div><button className="wv-btn sm" onClick={() => setEdit(t)}><Icon n="edit" /> Sửa</button></div>}
                        </div>))}
                </div>)}
            {edit && <Editor t={edit} onClose={() => setEdit(null)} onSaved={() => { onChanged(); load(); }} />}
        </>
    );
}