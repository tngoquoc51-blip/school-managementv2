'use client';

import { useEffect, useState } from 'react';
import s from '../logs.module.css';
import { errorMessage, logsApi } from '../api';
import { Icon } from '../components/Icons';
import { Card, Confirm, ErrorBox, Skeleton, useAsync, useToast } from '../components/ui';
import { fmtTime, nf } from '../format';
import type { SettingsData } from '../types';
import type { TabProps } from './tabProps';

const SNIPPET = `use Modules\\Logs\\Support\\AuditLogger;

AuditLogger::log([
    'module'       => 'exam',
    'action'       => 'grade.update',
    'entity_type'  => 'grade',
    'entity_id'    => $grade->id,
    'entity_label' => 'Toán 10A1 — Nguyễn Văn A',
    'summary'      => 'Sửa điểm giữa kỳ',
    'old_values'   => ['gk' => 6.5],
    'new_values'   => ['gk' => 8.0],
    'severity'     => 'notice',
]);

// Hoặc tự ghi mọi thao tác ghi dữ liệu của 1 module:
Route::middleware(\\Modules\\Logs\\Middleware\\AuditWrites::class . ':finance')->group(...);`;

export default function SettingsTab({ me, tick }: TabProps) {
    const { data, error, run } = useAsync<SettingsData>();
    const [form, setForm] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState('');
    const [verify, setVerify] = useState<null | { ok: boolean; checked: number; unchained: number; first_broken_id: number | null; verified_at: string }>(null);
    const [confirm, setConfirm] = useState<'' | 'purge' | 'import'>('');
    const toast = useToast();

    useEffect(() => { run(() => logsApi.settings(), tick > 0); }, [tick, run]);
    useEffect(() => { if (data) setForm(Object.fromEntries(Object.entries(data.settings).map(([k, v]) => [k, v ?? '']))); }, [data]);

    if (error && !data) return <ErrorBox message={error} onRetry={() => run(() => logsApi.settings())} />;
    if (!data) return <Skeleton h={300} />;

    const st = data.stats, can = me.can_admin;
    const save = async (body: Record<string, unknown>) => {
        try { await logsApi.saveSettings(body); toast('ok', 'Đã lưu cấu hình'); run(() => logsApi.settings(), true); } catch (e) { toast('err', errorMessage(e)); }
    };
    const act = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast('err', errorMessage(e)); } finally { setBusy(''); } };

    const Toggle = ({ k, title, hint }: { k: string; title: string; hint: string }) => (
        <div className={s.row}>
            <div className={s.rowText}><div style={{ fontWeight: 600 }}>{title}</div><div className={`${s.small} ${s.muted}`}>{hint}</div></div>
            <button className={`${s.switch} ${form[k] === '1' ? s.on : ''}`} disabled={!can} aria-pressed={form[k] === '1'} aria-label={title}
                    onClick={() => save({ [k]: form[k] !== '1' })} />
        </div>
    );

    return (
        <div className={s.stack}>
            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Kho nhật ký" sub="Bảng sm_audit_logs">
                    <dl className={s.kv}>
                        <dt>Tổng số bản ghi</dt><dd><b>{nf(st.total)}</b></dd>
                        <dt>Bản ghi đầu tiên</dt><dd>{fmtTime(st.first_at, true)}</dd>
                        <dt>Bản ghi mới nhất</dt><dd>{fmtTime(st.last_at, true)}</dd>
                        <dt>Kiểm tra gần nhất</dt><dd>{data.settings.last_verify_at ? `${fmtTime(data.settings.last_verify_at, true)} — ${data.settings.last_verify_result === 'ok' ? 'Toàn vẹn' : 'PHÁT HIỆN BẤT THƯỜNG'}` : 'Chưa kiểm tra'}</dd>
                    </dl>
                </Card>
                <Card title="Kiểm tra toàn vẹn" sub="Mỗi bản ghi được băm SHA-256 nối với bản ghi trước. Sửa hoặc xoá lén một dòng sẽ làm đứt chuỗi.">
                    <button className={`${s.btn} ${s.primary}`} disabled={busy === 'verify'} onClick={() => act('verify', async () => { setVerify(await logsApi.verify()); run(() => logsApi.settings(), true); })}>
                        <Icon name="fingerprint" size={16} /> {busy === 'verify' ? 'Đang kiểm tra…' : 'Kiểm tra ngay'}</button>
                    {verify && (
                        <div className={s.errorBox} style={{ marginTop: 14, background: verify.ok ? 'var(--okSoft)' : undefined, borderColor: verify.ok ? 'var(--ok)' : undefined }}>
                            <Icon name={verify.ok ? 'check' : 'alert'} size={22} />
                            <div>{verify.ok ? <><b>Nhật ký toàn vẹn.</b> Đã kiểm tra {nf(verify.checked)} bản ghi{verify.unchained ? `, ${nf(verify.unchained)} bản ghi chưa có mã băm bị bỏ qua` : ''}.</>
                                : <><b>Phát hiện nhật ký bị can thiệp</b> tại bản ghi #{verify.first_broken_id}. Hãy sao lưu DB và kiểm tra ngay.</>}</div>
                        </div>)}
                </Card>
            </div>

            <Card title="Chính sách lưu trữ & bảo mật" sub={can ? undefined : 'Chỉ Hiệu trưởng / Quản trị mới được thay đổi'}>
                <div className={s.row}>
                    <div className={s.rowText}><div style={{ fontWeight: 600 }}>Thời gian lưu nhật ký</div><div className={`${s.small} ${s.muted}`}>Bản ghi cũ hơn số ngày này sẽ bị xoá khi bấm “Dọn nhật ký cũ”.</div></div>
                    <input className={`${s.field} ${s.num}`} type="number" min={30} disabled={!can} value={form.retention_days || ''} onChange={(e) => setForm({ ...form, retention_days: e.target.value })} />
                    <span className={s.muted}>ngày</span>
                    <button className={`${s.btn} ${s.sm}`} disabled={!can} onClick={() => save({ retention_days: Number(form.retention_days) })}>Lưu</button>
                </div>
                <div className={s.row}>
                    <div className={s.rowText}><div style={{ fontWeight: 600 }}>Số dòng tối đa khi xuất CSV</div><div className={`${s.small} ${s.muted}`}>Giới hạn để tránh xuất toàn bộ dữ liệu ngoài ý muốn.</div></div>
                    <input className={`${s.field} ${s.num}`} type="number" min={100} disabled={!can} value={form.export_max_rows || ''} onChange={(e) => setForm({ ...form, export_max_rows: e.target.value })} />
                    <button className={`${s.btn} ${s.sm}`} disabled={!can} onClick={() => save({ export_max_rows: Number(form.export_max_rows) })}>Lưu</button>
                </div>
                <Toggle k="mask_ip" title="Ẩn một phần địa chỉ IP" hint="Hiển thị 113.160.x.x thay vì IP đầy đủ trên giao diện (dữ liệu gốc vẫn được lưu)." />
                <Toggle k="hash_chain" title="Chuỗi băm chống sửa log" hint="Nên luôn bật. Tắt chỉ áp dụng cho bản ghi mới." />
            </Card>

            <div className={`${s.grid} ${s.g2}`}>
                <Card title="Nhập nhật ký cũ" sub="Gộp sm_fee_audit, sm_fee_period_log, sm_payment_log, sm_security_audit, sm_staff_activity vào nhật ký trung tâm. Chạy lại nhiều lần vẫn an toàn (không trùng).">
                    <button className={s.btn} disabled={!can || busy === 'import'} onClick={() => setConfirm('import')}><Icon name="db" size={16} /> {busy === 'import' ? 'Đang nhập…' : 'Nhập log cũ'}</button>
                </Card>
                <Card title="Dọn nhật ký cũ" sub="Xoá vĩnh viễn bản ghi cũ hơn thời gian lưu. Hãy xuất CSV để lưu trữ trước. Thao tác này được ghi lại ở mức nghiêm trọng.">
                    <button className={`${s.btn} ${s.danger}`} disabled={!can || busy === 'purge'} onClick={() => setConfirm('purge')}><Icon name="trash" size={16} /> Dọn nhật ký cũ</button>
                </Card>
            </div>

            <Card title="Ghi nhật ký từ module khác" sub="Gọi AuditLogger trong controller/service, hoặc gắn middleware để tự ghi mọi thao tác ghi dữ liệu.">
                <pre className={`${s.code} ${s.mono}`} style={{ margin: 0 }}>{SNIPPET}</pre>
            </Card>

            {confirm === 'import' && <Confirm title="Nhập nhật ký cũ" confirmText="Nhập" onCancel={() => setConfirm('')} body="Các bản ghi từ 5 bảng log cũ sẽ được sao chép vào nhật ký trung tâm (không xoá bảng cũ)."
                                              onOk={() => { setConfirm(''); act('import', async () => { const r = await logsApi.importLegacy(); toast('ok', `Đã nhập ${nf(Object.values(r).reduce((a, b) => a + b, 0))} dòng`); run(() => logsApi.settings(), true); }); }} />}
            {confirm === 'purge' && <Confirm danger title="Dọn nhật ký cũ" confirmText="Xoá vĩnh viễn" onCancel={() => setConfirm('')}
                                             body={<>Xoá mọi bản ghi cũ hơn <b>{data.settings.retention_days} ngày</b>. Không thể hoàn tác.</>} input={{ label: 'Gõ XOA để xác nhận', match: 'XOA' }}
                                             onOk={() => { setConfirm(''); act('purge', async () => { const r = await logsApi.purgeLogs(); toast('ok', `Đã xoá ${nf(r.deleted)} dòng`); run(() => logsApi.settings(), true); }); }} />}
        </div>
    );
}