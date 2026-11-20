'use client';

import { useEffect, useState } from 'react';
import { errMsg, settingsApi } from './api';
import { Badge, Btn, Card, Field, Icon, Toggle, useConfirm, useToast } from './ui';

export default function Maintenance() {
    const toast = useToast(); const confirm = useConfirm();
    const [on, setOn] = useState(false);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState('');

    useEffect(() => {
        settingsApi.getGroup('maintenance').then((d) => { setOn(d.values.maintenance_on === '1'); setMsg(d.values.maintenance_message || ''); }).catch((e) => toast('err', 'Lỗi', errMsg(e)));
    }, []);

    const apply = async (enabled: boolean) => {
        const ok = await confirm({
            title: enabled ? 'Bật chế độ bảo trì?' : 'Tắt chế độ bảo trì?', danger: enabled, okText: enabled ? 'Bật bảo trì' : 'Tắt bảo trì',
            text: enabled ? 'Giáo viên, học sinh, phụ huynh sẽ không dùng được hệ thống cho đến khi bạn tắt. Chỉ tài khoản Super Admin vẫn truy cập bình thường.' : 'Người dùng sẽ truy cập lại bình thường.',
        });
        if (!ok) return;
        setBusy('m');
        try { await settingsApi.maintenance(enabled, msg); setOn(enabled); toast(enabled ? 'warn' : 'ok', enabled ? 'Đã bật bảo trì' : 'Đã tắt bảo trì'); }
        catch (e) { toast('err', 'Không thực hiện được', errMsg(e)); }
        finally { setBusy(''); }
    };
    const clear = async () => {
        setBusy('c');
        try { const r = await settingsApi.clearCache(); toast('ok', 'Hoàn tất', r.message); } catch (e) { toast('err', 'Lỗi', errMsg(e)); } finally { setBusy(''); }
    };

    return (
        <>
            {on && <div className="st-alert bad"><Icon name="alert" /><div><b>Hệ thống đang ở chế độ bảo trì.</b> Mọi người dùng ngoài Super Admin nhận mã 503 khi gọi API.</div></div>}
            <Card icon="power" title="Chế độ bảo trì" desc="Tạm khóa hệ thống khi nâng cấp, nhập điểm hàng loạt hoặc phục hồi dữ liệu"
                  actions={<Badge kind={on ? 'bad' : 'ok'}>{on ? 'Đang bật' : 'Đang tắt'}</Badge>}>
                <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
                    <Field label="Thông báo hiển thị cho người dùng" hint="Hiển thị khi người dùng bị chặn trong lúc bảo trì">
                        <textarea className="st-in" value={msg} onChange={(e) => setMsg(e.target.value)} />
                    </Field>
                    <div className="st-toggle-row">
                        <div><b>Bảo trì hệ thống</b><small>Có hiệu lực trong vòng ~15 giây</small></div>
                        <Toggle on={on} onChange={(v) => apply(v)} label="Bảo trì" />
                    </div>
                    {on && <div><Btn icon="check" onClick={() => apply(true)} busy={busy === 'm'}>Cập nhật thông báo</Btn></div>}
                </div>
            </Card>

            <Card icon="refresh" title="Bộ nhớ đệm" desc="Xóa cache cấu hình, route, view sau khi sửa .env hoặc triển khai bản mới">
                <Btn icon="trash" onClick={clear} busy={busy === 'c'}>Xóa toàn bộ cache</Btn>
            </Card>

            <Card icon="clipboard" title="Danh sách kiểm tra khi đưa lên máy chủ thật">
                <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, color: 'var(--st-muted)' }}>
                    <li>Đặt <code>APP_ENV=production</code>, <code>APP_DEBUG=false</code> trong <code>.env</code>, chạy <code>php artisan config:cache</code>.</li>
                    <li>Đổi mật khẩu MySQL root, tạo user riêng cho ứng dụng; không để trống mật khẩu.</li>
                    <li>Bật HTTPS; sửa <code>CORS_ALLOWED_ORIGINS</code> thành tên miền thật của frontend.</li>
                    <li>Chạy <code>php artisan schedule:work</code> (hoặc cron mỗi phút) để sao lưu tự động hoạt động.</li>
                    <li>Khai báo <code>MYSQLDUMP_PATH</code> / <code>MYSQL_PATH</code> trong <code>.env</code> nếu máy chủ không có sẵn trong PATH.</li>
                </ul>
            </Card>
        </>
    );
}