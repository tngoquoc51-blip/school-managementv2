'use client';

import { useState } from 'react';
import { Card, ErrorBox, Loading, Pill, STATE, Spark, WriteNote, dt, mon, useLoad, useMon } from '../_hl';

const GUIDE: Record<string, string> = {
    database: 'Nếu chậm hoặc mất kết nối: kiểm tra MySQL trong Laragon đã Start chưa, và thông số DB_* trong file .env của backend.',
    disk: 'Dọn log cũ (Nhật ký → Log Laravel), file sao lưu cũ và thư mục storage/framework/cache.',
    storage: 'Cấp quyền ghi cho thư mục backend/storage và backend/bootstrap/cache.',
    cache: 'Chạy php artisan cache:clear. Kiểm tra CACHE_DRIVER trong .env.',
    php: 'Bật extension còn thiếu trong php.ini (Laragon: Menu → PHP → Extensions).',
    debug: 'Khi đưa lên máy chủ thật, đặt APP_ENV=production và APP_DEBUG=false trong .env.',
    backup: 'Vào Quản trị → Sao lưu để tạo bản sao lưu mới và bật lịch tự động.',
    deploy: 'Trên máy chủ thật: APP_ENV=production, APP_DEBUG=false, APP_URL=https://..., đã chạy php artisan key:generate, và đổi mật khẩu mặc định 123456 của mọi tài khoản nhân viên (cổng Giáo vụ → Đổi mật khẩu).',
    traffic: 'Thêm RequestMonitor vào middleware toàn cục của Laravel (xem HUONG-DAN-GIAM-SAT.md).',
};

export default function Services() {
    const { canWrite, toast, refreshBadge } = useMon();
    const { data, err, loading, reload } = useLoad<any>('checks', 60);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState<string | null>(null);

    const run = async () => {
        setBusy(true);
        try { await mon('checks/run', { method: 'POST' }); await reload(); refreshBadge(); toast('Đã kiểm tra lại toàn bộ dịch vụ.'); }
        catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
    };

    if (loading && !data) return <Loading rows={5} />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    const list = data!.services as any[];
    const hist = data!.history as Record<string, { points: any[]; uptime: number | null }>;
    const c = (s: string) => list.filter((x) => x.status === s).length;

    return (
        <div className="hl-stack">
            <WriteNote />
            <div className="hl-bar">
                <div className="hl-summary">
                    <Pill tone="green" dot>{c('ok')} bình thường</Pill><Pill tone="amber" dot>{c('warn')} cần chú ý</Pill>
                    <Pill tone="red" dot>{c('fail')} sự cố</Pill><Pill tone="gray" dot>{c('skip')} chưa có dữ liệu</Pill>
                </div>
                <button className="hl-btn primary" onClick={run} disabled={busy}>{busy ? 'Đang kiểm tra…' : '⟳ Kiểm tra lại'}</button>
            </div>

            <div className="hl-svc-list">
                {list.map((s) => {
                    const h = hist[s.key];
                    const ms = (h?.points || []).map((p) => p.ms);
                    const isOpen = open === s.key;
                    return (
                        <Card key={s.key} className={`hl-svcd s-${s.status}`}>
                            <div className="hl-svcd-h" onClick={() => setOpen(isOpen ? null : s.key)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(isOpen ? null : s.key)}>
                                <i className="dot" />
                                <div className="nm"><b>{s.name}</b><span>{s.detail}</span></div>
                                <div className="vl"><strong>{s.value}</strong><Pill tone={STATE[s.status].tone}>{STATE[s.status].label}</Pill></div>
                                <div className="up"><small>Độ khả dụng</small><b>{h?.uptime != null ? `${h.uptime}%` : '—'}</b></div>
                                <div className="sp">{ms.some((x) => x > 0) ? <Spark values={ms} tone={s.status === 'ok' ? 'green' : s.status === 'warn' ? 'amber' : 'red'} /> : null}</div>
                                <span className="chev">{isOpen ? '▴' : '▾'}</span>
                            </div>
                            {isOpen && (
                                <div className="hl-svcd-b">
                                    <div className="hl-ticks" aria-label="Lịch sử kiểm tra gần nhất">
                                        {(h?.points || []).map((p, i) => <i key={i} className={`s-${p.status}`} title={`${dt(p.created_at)} · ${p.value || ''}`} />)}
                                        {!(h?.points || []).length && <small>Chưa có lịch sử. Mỗi lần mở trang Tổng quan hoặc bấm “Kiểm tra lại”, hệ thống ghi một mốc (tối đa 1 lần / phút).</small>}
                                    </div>
                                    <div className="hl-tip"><b>Cách xử lý</b><p>{GUIDE[s.key]}</p></div>
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>
            {!canWrite ? null : <p className="hl-hint">Mẹo: lịch sử độ khả dụng được tính trên 40 lần kiểm tra gần nhất của mỗi dịch vụ.</p>}
        </div>
    );
}