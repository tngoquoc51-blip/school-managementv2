'use client';

import { Card, Field, Skeleton } from '../ui';
import { useFeeSettings } from '../useFeeSettings';
import SaveFooter from './SaveFooter';

const KEYS = ['account_name', 'account_no', 'bank_bin', 'bank_name', 'bank_short', 'transfer_hint',
    'school_name', 'school_address', 'hotline', 'office'];

const BANKS = [
    { bin: '970436', short: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)' },
    { bin: '970415', short: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam (VietinBank)' },
    { bin: '970418', short: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)' },
    { bin: '970405', short: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn (Agribank)' },
    { bin: '970407', short: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)' },
    { bin: '970422', short: 'MB Bank', name: 'Ngân hàng TMCP Quân đội (MB Bank)' },
    { bin: '970416', short: 'ACB', name: 'Ngân hàng TMCP Á Châu (ACB)' },
    { bin: '970432', short: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)' },
    { bin: '970403', short: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)' },
    { bin: '970423', short: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong (TPBank)' },
];

export default function PaymentPanel({ onSaved, demo }: { onSaved: () => void; demo: boolean }) {
    const s = useFeeSettings(KEYS, onSaved);
    if (s.loading) return <Card title="Thông tin nhận tiền"><Skeleton /></Card>;
    const { form: f, set, errors: e } = s;

    const pickBank = (bin: string) => {
        const b = BANKS.find((x) => x.bin === bin);
        if (b) { set('bank_bin', b.bin); set('bank_short', b.short); set('bank_name', b.name); }
    };

    return (
        <>
            {demo && (
                <div className="acs-alert">
                    <span>⚠</span>
                    <div><b>Đang dùng số tài khoản minh họa.</b> Hãy nhập tài khoản thật của nhà trường để phụ huynh chuyển khoản đúng nơi.</div>
                </div>
            )}

            <Card title="Tài khoản nhận học phí" desc="Hiển thị cho phụ huynh/học sinh khi thanh toán và in trên phiếu thu."
                  footer={<SaveFooter dirty={s.dirty} busy={s.busy} onSave={s.save} onReset={s.reset} />}>
                <div className="acs-pad acs-grid">
                    <Field label="Ngân hàng" hint="Chọn nhanh để tự điền mã BIN và tên ngân hàng">
                        <select value={BANKS.some((b) => b.bin === f.bank_bin) ? f.bank_bin : ''} onChange={(ev) => pickBank(ev.target.value)}>
                            <option value="">— Chọn ngân hàng —</option>
                            {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.short} ({b.bin})</option>)}
                        </select>
                    </Field>
                    <Field label="Mã BIN ngân hàng" error={e.bank_bin}>
                        <input value={f.bank_bin} maxLength={6} onChange={(ev) => set('bank_bin', ev.target.value.replace(/\D/g, ''))} />
                    </Field>
                    <Field label="Tên chủ tài khoản" error={e.account_name} hint="Viết hoa, không dấu — đúng như ngân hàng đăng ký">
                        <input value={f.account_name} onChange={(ev) => set('account_name', ev.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Số tài khoản" error={e.account_no}>
                        <input value={f.account_no} inputMode="numeric" maxLength={20} onChange={(ev) => set('account_no', ev.target.value.replace(/\D/g, ''))} />
                    </Field>
                    <Field label="Tên ngân hàng (đầy đủ)" error={e.bank_name} span>
                        <input value={f.bank_name} onChange={(ev) => set('bank_name', ev.target.value)} />
                    </Field>
                    <Field label="Tên ngắn" error={e.bank_short}>
                        <input value={f.bank_short} onChange={(ev) => set('bank_short', ev.target.value)} />
                    </Field>
                    <Field label="Hướng dẫn nội dung chuyển khoản" error={e.transfer_hint}>
                        <input value={f.transfer_hint} onChange={(ev) => set('transfer_hint', ev.target.value)} />
                    </Field>
                </div>
            </Card>

            <Card title="Xem trước trên màn hình phụ huynh">
                <div className="acs-pad">
                    <div className="acs-preview">
                        <b>{f.school_name || 'TÊN TRƯỜNG'}</b>{'\n'}
                        Ngân hàng: {f.bank_short || '—'}{'\n'}
                        Số tài khoản: <b>{f.account_no || '—'}</b>{'\n'}
                        Chủ tài khoản: {f.account_name || '—'}{'\n'}
                        {f.transfer_hint}
                    </div>
                </div>
            </Card>

            <Card title="Thông tin nhà trường & phòng kế toán" desc="Dùng chung cho phiếu thu, thông báo nhắc nợ và trang liên hệ."
                  footer={<SaveFooter dirty={s.dirty} busy={s.busy} onSave={s.save} onReset={s.reset} />}>
                <div className="acs-pad acs-grid">
                    <Field label="Tên trường" error={e.school_name}><input value={f.school_name} onChange={(ev) => set('school_name', ev.target.value)} /></Field>
                    <Field label="Hotline kế toán" error={e.hotline}><input value={f.hotline} onChange={(ev) => set('hotline', ev.target.value)} /></Field>
                    <Field label="Địa chỉ" error={e.school_address} span><input value={f.school_address} onChange={(ev) => set('school_address', ev.target.value)} /></Field>
                    <Field label="Vị trí & giờ làm việc phòng kế toán" error={e.office} span><input value={f.office} onChange={(ev) => set('office', ev.target.value)} /></Field>
                </div>
            </Card>
        </>
    );
}