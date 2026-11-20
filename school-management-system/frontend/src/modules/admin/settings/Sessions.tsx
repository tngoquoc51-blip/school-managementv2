'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ago, errMsg, fmtDT, settingsApi } from './api';
import { Badge, Btn, Card, Empty, Icon, Skeleton, useConfirm, useToast } from './ui';

export default function Sessions() {
    const toast = useToast(); const confirm = useConfirm();
    const [q, setQ] = useState(''); const [state, setState] = useState(''); const [page, setPage] = useState(1);
    const [d, setD] = useState<any>(null); const [loading, setLoading] = useState(true);
    const timer = useRef<any>(null);

    const load = useCallback(async (p = page, qq = q, ss = state) => {
        setLoading(true);
        try { setD(await settingsApi.sessions({ page: p, q: qq, state: ss })); } catch (e) { toast('err', 'Không tải được phiên đăng nhập', errMsg(e)); } finally { setLoading(false); }
    }, [page, q, state]);
    useEffect(() => { load(1, q, state); setPage(1); /* eslint-disable-next-line */ }, [state]);

    const search = (v: string) => { setQ(v); clearTimeout(timer.current); timer.current = setTimeout(() => { setPage(1); load(1, v, state); }, 400); };
    const revoke = async (x: any) => {
        if (!(await confirm({ title: 'Thu hồi phiên đăng nhập?', danger: true, okText: 'Thu hồi', text: `${x.user_name || 'Người dùng'} sẽ bị đăng xuất khỏi thiết bị này ngay lập tức.` }))) return;
        try { await settingsApi.revokeSession(x.id); toast('ok', 'Đã thu hồi phiên'); load(); } catch (e) { toast('err', 'Không thực hiện được', errMsg(e)); }
    };
    const bulk = async (scope: 'others' | 'expired') => {
        const ok = await confirm({ title: scope === 'others' ? 'Đăng xuất tất cả người dùng khác?' : 'Dọn dẹp phiên đã hết hạn?', danger: scope === 'others', okText: 'Thực hiện',
            text: scope === 'others' ? 'Mọi phiên đăng nhập, trừ phiên của bạn, sẽ bị thu hồi. Dùng khi nghi ngờ lộ tài khoản.' : 'Xóa các token đã quá hạn khỏi cơ sở dữ liệu.' });
        if (!ok) return;
        try { const r = await settingsApi.revokeAll(scope); toast('ok', r.data?.message || 'Hoàn tất'); load(1); } catch (e) { toast('err', 'Lỗi', errMsg(e)); }
    };

    const m = d?.meta, st = d?.stats;
    return (
        <>
            <div className="st-stats">
                <div className="st-stat"><small>Tổng phiên</small><b>{st?.total ?? '—'}</b><span>token trong CSDL</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-ok)' }}><small>Đang hoạt động</small><b>{st?.active ?? '—'}</b><span>còn hạn sử dụng</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-warn)' }}><small>Đã hết hạn</small><b>{st?.expired ?? '—'}</b><span>có thể dọn dẹp</span></div>
            </div>
            <Card icon="monitor" title="Phiên đăng nhập" desc="Mỗi lần đăng nhập tạo một token Sanctum. Thu hồi để buộc người dùng đăng nhập lại." flush
                  actions={<><Btn className="sm" icon="trash" onClick={() => bulk('expired')}>Dọn phiên hết hạn</Btn><Btn className="sm dng" icon="power" onClick={() => bulk('others')}>Đăng xuất người khác</Btn></>}>
                <div className="st-filters">
                    <div className="st-search" style={{ margin: 0, minWidth: 260 }}><Icon name="search" size={16} /><input placeholder="Tìm tên, email, tên đăng nhập…" value={q} onChange={(e) => search(e.target.value)} style={{ paddingTop: 8, paddingBottom: 8 }} /></div>
                    <select className="st-in" value={state} onChange={(e) => setState(e.target.value)}><option value="">Tất cả</option><option value="active">Đang hoạt động</option><option value="expired">Đã hết hạn</option></select>
                </div>
                {loading && !d ? <div style={{ padding: 20 }}><Skeleton rows={3} /></div> : !d?.items?.length ? <Empty icon="monitor" text="Không có phiên đăng nhập" /> : (
                    <div className="st-tw" style={{ opacity: loading ? .6 : 1 }}><table className="st-table">
                        <thead><tr><th>Người dùng</th><th>Tạo lúc</th><th>Dùng gần nhất</th><th>Hết hạn</th><th>Trạng thái</th><th /></tr></thead>
                        <tbody>{d.items.map((x: any) => (
                            <tr key={x.id}>
                                <td><b>{x.user_name || `Tài khoản #${x.tokenable_id}`}</b><div style={{ color: 'var(--st-muted)', fontSize: 12 }}>{x.user_email || x.name}</div></td>
                                <td>{fmtDT(x.created_at)}</td><td>{ago(x.last_used_at)}</td><td>{x.expires_at ? fmtDT(x.expires_at) : 'Không giới hạn'}</td>
                                <td>{x.is_current ? <Badge kind="pri">Phiên của bạn</Badge> : x.expired ? <Badge kind="warn">Hết hạn</Badge> : <Badge kind="ok">Hoạt động</Badge>}</td>
                                <td className="act">{!x.is_current && <Btn className="sm dng" icon="x" onClick={() => revoke(x)}>Thu hồi</Btn>}</td>
                            </tr>))}</tbody></table></div>
                )}
                {m && <div className="st-pager"><span>{m.total} phiên · Trang {m.page}/{m.last_page}</span><span style={{ display: 'flex', gap: 8 }}>
          <Btn className="sm" disabled={m.page <= 1} onClick={() => { setPage(m.page - 1); load(m.page - 1); }}>‹ Trước</Btn>
          <Btn className="sm" disabled={m.page >= m.last_page} onClick={() => { setPage(m.page + 1); load(m.page + 1); }}>Sau ›</Btn></span></div>}
            </Card>
        </>
    );
}