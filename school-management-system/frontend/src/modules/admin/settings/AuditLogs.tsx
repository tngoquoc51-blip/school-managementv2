'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg, fmtDT, settingsApi } from './api';
import { Badge, Btn, Card, Empty, Icon, Modal, Skeleton, useToast } from './ui';
import GroupForm from './GroupForm';

const SEV: Record<string, [string, any]> = { info: ['Thông tin', 'info'], notice: ['Lưu ý', 'pri'], warning: ['Cảnh báo', 'warn'], critical: ['Nghiêm trọng', 'bad'] };
const RES: Record<string, [string, any]> = { success: ['Thành công', 'ok'], failed: ['Thất bại', 'bad'], denied: ['Bị từ chối', 'warn'] };

export default function AuditLogs() {
    const toast = useToast();
    const [f, setF] = useState<Record<string, string>>({ q: '', module: '', severity: '', status: '', from: '', to: '' });
    const [page, setPage] = useState(1);
    const [data, setData] = useState<any>(null);
    const [meta, setMeta] = useState<any>({ modules: [] });
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<any>(null);
    const [policy, setPolicy] = useState(false);
    const [exporting, setExporting] = useState(false);
    const timer = useRef<any>(null);

    const load = useCallback(async (p = page, filters = f) => {
        setLoading(true);
        try { setData(await settingsApi.audit({ ...filters, page: p, per_page: 20 })); }
        catch (e) { toast('err', 'Không tải được nhật ký', errMsg(e)); }
        finally { setLoading(false); }
    }, [page, f]);

    useEffect(() => { settingsApi.auditMeta().then(setMeta).catch(() => {}); }, []);
    useEffect(() => { load(1, f); setPage(1); /* eslint-disable-next-line */ }, [f.module, f.severity, f.status, f.from, f.to]);
    const onSearch = (v: string) => { const n = { ...f, q: v }; setF(n); clearTimeout(timer.current); timer.current = setTimeout(() => { setPage(1); load(1, n); }, 400); };
    const go = (p: number) => { setPage(p); load(p, f); };

    const open = async (id: number) => { try { setDetail(await settingsApi.auditOne(id)); } catch (e) { toast('err', 'Lỗi', errMsg(e)); } };
    const exportCsv = async () => {
        setExporting(true);
        try { await settingsApi.auditExport(f); toast('ok', 'Đã xuất nhật ký (CSV)'); } catch (e) { toast('err', 'Không xuất được', errMsg(e)); } finally { setExporting(false); }
    };
    const reset = () => setF({ q: '', module: '', severity: '', status: '', from: '', to: '' });

    const st = data?.stats;
    const m = data?.meta;
    return (
        <>
            <div className="st-stats">
                <div className="st-stat"><small>Tổng sự kiện</small><b>{Number(st?.total || 0).toLocaleString('vi-VN')}</b><span>toàn bộ nhật ký</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-accent)' }}><small>Hôm nay</small><b>{st?.today ?? 0}</b><span>sự kiện mới</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-warn)' }}><small>Cảnh báo / nghiêm trọng</small><b>{st?.alerts ?? 0}</b><span>cần xem xét</span></div>
                <div className="st-stat" style={{ ['--c' as any]: 'var(--st-bad)' }}><small>Thao tác thất bại</small><b>{st?.failed ?? 0}</b><span>bị lỗi hoặc từ chối</span></div>
            </div>

            <Card icon="file" title="Nhật ký hoạt động" desc="Bản ghi chỉ-ghi (append-only): không có chức năng sửa hoặc xóa" flush
                  actions={<><Btn className="sm" icon="eye" onClick={() => setPolicy(true)}>Chính sách</Btn><Btn className="sm" icon="download" busy={exporting} onClick={exportCsv}>Xuất CSV</Btn></>}>
                <div className="st-filters">
                    <div className="st-search" style={{ margin: 0, minWidth: 240 }}>
                        <Icon name="search" size={16} /><input placeholder="Tìm nội dung, người dùng, IP…" value={f.q} onChange={(e) => onSearch(e.target.value)} style={{ paddingTop: 8, paddingBottom: 8 }} />
                    </div>
                    <select className="st-in" value={f.module} onChange={(e) => setF({ ...f, module: e.target.value })}><option value="">Tất cả phân hệ</option>{meta.modules.map((x: string) => <option key={x}>{x}</option>)}</select>
                    <select className="st-in" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option value="">Mọi mức độ</option>{Object.entries(SEV).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
                    <select className="st-in" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Mọi kết quả</option>{Object.entries(RES).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
                    <input type="date" className="st-in" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title="Từ ngày" />
                    <input type="date" className="st-in" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title="Đến ngày" />
                    <Btn className="sm ghost" icon="x" onClick={reset}>Xóa lọc</Btn>
                </div>

                {loading && !data ? <div style={{ padding: 20 }}><Skeleton rows={4} /></div> : !data?.items?.length ? <Empty icon="file" text="Không có sự kiện nào khớp bộ lọc" /> : (
                    <div className="st-tw" style={{ opacity: loading ? .6 : 1 }}><table className="st-table">
                        <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Phân hệ</th><th>Nội dung</th><th>Mức độ</th><th>Kết quả</th><th>IP</th></tr></thead>
                        <tbody>{data.items.map((x: any) => (
                            <tr key={x.id} onClick={() => open(x.id)} style={{ cursor: 'pointer' }}>
                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDT(x.occurred_at)}</td>
                                <td><b>{x.actor_name || '—'}</b><div style={{ color: 'var(--st-muted)', fontSize: 12 }}>{x.actor_role || x.actor_type}</div></td>
                                <td><Badge>{x.module}</Badge></td>
                                <td style={{ maxWidth: 380 }}><div style={{ fontWeight: 600 }}>{x.summary}</div><div style={{ color: 'var(--st-muted)', fontSize: 12, fontFamily: 'monospace' }}>{x.action}</div></td>
                                <td><Badge kind={SEV[x.severity]?.[1]}>{SEV[x.severity]?.[0] || x.severity}</Badge></td>
                                <td><Badge kind={RES[x.status]?.[1]}>{RES[x.status]?.[0] || x.status}</Badge></td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{x.ip || '—'}</td>
                            </tr>))}</tbody></table></div>
                )}
                {m && (
                    <div className="st-pager">
                        <span>{m.total.toLocaleString('vi-VN')} kết quả · Trang {m.page}/{m.last_page}</span>
                        <span style={{ display: 'flex', gap: 8 }}>
              <Btn className="sm" disabled={m.page <= 1} onClick={() => go(m.page - 1)}>‹ Trước</Btn>
              <Btn className="sm" disabled={m.page >= m.last_page} onClick={() => go(m.page + 1)}>Sau ›</Btn>
            </span>
                    </div>
                )}
            </Card>

            {detail && (
                <Modal right title={`Sự kiện #${detail.id}`} onClose={() => setDetail(null)}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Badge kind={SEV[detail.severity]?.[1]}>{SEV[detail.severity]?.[0]}</Badge><Badge kind={RES[detail.status]?.[1]}>{RES[detail.status]?.[0]}</Badge><Badge>{detail.module}</Badge></div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.summary}</div>
                    <dl className="st-kv" style={{ gridTemplateColumns: '120px 1fr' }}>
                        <dt>Thời gian</dt><dd>{fmtDT(detail.occurred_at)}</dd>
                        <dt>Người thực hiện</dt><dd>{detail.actor_name || '—'} <span style={{ color: 'var(--st-muted)', fontWeight: 400 }}>({detail.actor_role || detail.actor_type})</span></dd>
                        <dt>Hành động</dt><dd style={{ fontFamily: 'monospace' }}>{detail.action}</dd>
                        <dt>Đối tượng</dt><dd>{detail.entity_label || detail.entity_type || '—'} {detail.entity_id && <span style={{ color: 'var(--st-muted)' }}>#{detail.entity_id}</span>}</dd>
                        <dt>Địa chỉ IP</dt><dd style={{ fontFamily: 'monospace' }}>{detail.ip || '—'}</dd>
                        <dt>Yêu cầu</dt><dd style={{ fontFamily: 'monospace' }}>{detail.method} {detail.path}</dd>
                        <dt>Trình duyệt</dt><dd style={{ fontSize: 12 }}>{detail.user_agent || '—'}</dd>
                        <dt>Mã request</dt><dd style={{ fontFamily: 'monospace', fontSize: 12 }}>{detail.request_id || '—'}</dd>
                    </dl>
                    {detail.old_values && <><b>Giá trị cũ</b><div className="st-code">{JSON.stringify(detail.old_values, null, 2)}</div></>}
                    {detail.new_values && <><b>Giá trị mới</b><div className="st-code">{JSON.stringify(detail.new_values, null, 2)}</div></>}
                    {detail.meta && <><b>Dữ liệu kèm theo</b><div className="st-code">{JSON.stringify(detail.meta, null, 2)}</div></>}
                </Modal>
            )}
            {policy && <Modal right title="Chính sách nhật ký" onClose={() => setPolicy(false)}><GroupForm group="audit" /></Modal>}
        </>
    );
}