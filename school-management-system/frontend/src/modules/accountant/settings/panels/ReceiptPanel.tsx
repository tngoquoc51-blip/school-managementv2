'use client';

import { Card, Field, Skeleton } from '../ui';
import { useFeeSettings } from '../useFeeSettings';
import SaveFooter from './SaveFooter';

const KEYS = ['receipt_accountant', 'receipt_treasurer', 'receipt_footer', 'school_name', 'school_address', 'hotline'];

export default function ReceiptPanel({ onSaved }: { onSaved: () => void }) {
    const s = useFeeSettings(KEYS, onSaved);
    if (s.loading) return <Card title="Phiếu thu"><Skeleton /></Card>;
    const { form: f, set, errors: e } = s;
    return (
        <>
            <Card title="Chữ ký & lời cảm ơn trên phiếu thu" desc="Áp dụng cho các phiếu thu in từ mục Thu phí."
                  footer={<SaveFooter dirty={s.dirty} busy={s.busy} onSave={s.save} onReset={s.reset} />}>
                <div className="acs-pad acs-grid">
                    <Field label="Chức danh người lập phiếu" error={e.receipt_accountant}>
                        <input value={f.receipt_accountant} onChange={(ev) => set('receipt_accountant', ev.target.value)} />
                    </Field>
                    <Field label="Chức danh thủ quỹ" error={e.receipt_treasurer}>
                        <input value={f.receipt_treasurer} onChange={(ev) => set('receipt_treasurer', ev.target.value)} />
                    </Field>
                    <Field label="Lời cảm ơn / ghi chú cuối phiếu" error={e.receipt_footer} span hint={`${(f.receipt_footer || '').length}/255 ký tự`}>
                        <textarea maxLength={255} value={f.receipt_footer} onChange={(ev) => set('receipt_footer', ev.target.value)} />
                    </Field>
                </div>
            </Card>

            <Card title="Xem trước phiếu thu">
                <div className="acs-pad">
                    <div style={{ border: '1px solid #cfd8ea', borderRadius: 12, padding: 22, background: '#fff', maxWidth: 560 }}>
                        <div style={{ textAlign: 'center' }}>
                            <b style={{ color: '#0b1f4d', fontSize: 16 }}>{f.school_name}</b>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{f.school_address} · {f.hotline}</div>
                            <h3 style={{ margin: '14px 0 4px' }}>PHIẾU THU</h3>
                            <div style={{ fontSize: 12, color: '#64748b' }}>Số: PT26000001</div>
                        </div>
                        <div style={{ margin: '16px 0', fontSize: 13 }}>Nguyễn Văn A — Lớp 10A1 — Học phí học kỳ 1: <b>1.150.000đ</b></div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: 13, marginTop: 20 }}>
                            <div><b>{f.receipt_accountant}</b><div style={{ height: 40 }} /></div>
                            <div><b>{f.receipt_treasurer}</b><div style={{ height: 40 }} /></div>
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>{f.receipt_footer}</div>
                    </div>
                </div>
            </Card>
        </>
    );
}