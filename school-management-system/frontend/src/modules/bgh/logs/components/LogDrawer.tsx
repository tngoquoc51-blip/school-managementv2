'use client';

import { useEffect } from 'react';
import s from '../logs.module.css';
import { logsApi } from '../api';
import { fmtTime, pretty, roleLabel } from '../format';
import type { Filters, LogDetail, Mini } from '../types';
import { Icon } from './Icons';
import { ErrorBox, ModTag, SevChip, Skeleton, StatusChip, useAsync, useToast } from './ui';

const sevColor: Record<string, string> = { info: 'var(--info)', notice: 'var(--accent2)', warning: 'var(--warn)', critical: 'var(--crit)' };

function Timeline({ title, items, onOpen }: { title: string; items: Mini[]; onOpen: (id: number) => void }) {
    if (!items?.length) return null;
    return (
        <div>
            <h4 style={{ margin: '0 0 10px', fontSize: 13 }}>{title}</h4>
            <div className={s.timeline}>
                {items.map((m) => (
                    <div key={m.id} className={s.tl} style={{ ['--c' as any]: sevColor[m.severity] }} onClick={() => onOpen(m.id)}>
                        <div className={`${s.small} ${s.muted}`}>{fmtTime(m.occurred_at)} · {m.actor_name || 'Hệ thống'}</div>
                        <div style={{ fontWeight: 600 }}>{m.summary}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function LogDrawer({ id, onClose, onOpen, onFilter }: {
    id: number; onClose: () => void; onOpen: (id: number) => void; onFilter: (f: Filters) => void;
}) {
    const { data, error, loading, run } = useAsync<LogDetail>();
    const toast = useToast();

    useEffect(() => { run(() => logsApi.detail(id)); }, [id, run]);
    useEffect(() => {
        const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const l = data?.log;
    const copy = (text: string, msg: string) => navigator.clipboard?.writeText(text).then(() => toast('ok', msg)).catch(() => toast('err', 'Không sao chép được'));

    return (
        <>
            <div className={s.overlay} onClick={onClose} />
            <aside className={s.drawer} role="dialog" aria-modal="true" aria-label="Chi tiết nhật ký">
                <div className={s.drawerHead}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={`${s.small} ${s.muted}`}>Bản ghi #{id}</div>
                        <div style={{ fontWeight: 800, fontSize: 17, marginTop: 2 }}>{l?.summary || 'Đang tải…'}</div>
                        {l && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}><SevChip v={l.severity} /><StatusChip v={l.status} /><ModTag m={l.module} /></div>}
                    </div>
                    <button className={s.iconBtn} onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </div>

                <div className={s.drawerBody}>
                    {loading && !data && (<><Skeleton h={90} /><Skeleton h={160} /><Skeleton h={120} /></>)}
                    {error && <ErrorBox message={error} onRetry={() => run(() => logsApi.detail(id))} />}

                    {l && data && (
                        <>
                            <dl className={s.kv}>
                                <dt>Thời gian</dt><dd className={s.mono}>{fmtTime(l.occurred_at, true)}</dd>
                                <dt>Người thực hiện</dt><dd>{l.actor_name || 'Hệ thống'} <span className={s.muted}>· {roleLabel(l.actor_role)}</span></dd>
                                <dt>Hành động</dt><dd className={s.mono}>{l.action}</dd>
                                <dt>Đối tượng</dt><dd>{l.entity_label || l.entity_id ? `${l.entity_type || ''} ${l.entity_label || ''}`.trim() + (l.entity_id ? ` (#${l.entity_id})` : '') : '—'}</dd>
                                <dt>Địa chỉ IP</dt><dd className={s.mono}>{l.ip || '—'}</dd>
                                <dt>Thiết bị</dt><dd>{l.user_agent || '—'}</dd>
                                <dt>Yêu cầu</dt><dd className={s.mono}>{l.method ? `${l.method} ${l.path || ''}` : '—'}{l.duration_ms != null ? ` · ${l.duration_ms} ms` : ''}</dd>
                                {l.src_table && (<><dt>Nguồn gốc</dt><dd className={s.mono}>Nhập từ bảng {l.src_table}</dd></>)}
                            </dl>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {l.actor_id && <button className={`${s.btn} ${s.sm}`} onClick={() => { onFilter({ actor_type: l.actor_type, actor_id: String(l.actor_id) }); onClose(); }}><Icon name="users" size={14} /> Mọi việc của người này</button>}
                                {l.ip && <button className={`${s.btn} ${s.sm}`} onClick={() => { onFilter({ ip: l.ip! }); onClose(); }}><Icon name="globe" size={14} /> Cùng IP</button>}
                                {l.entity_type && l.entity_id && <button className={`${s.btn} ${s.sm}`} onClick={() => { onFilter({ entity_type: l.entity_type!, entity_id: l.entity_id! }); onClose(); }}><Icon name="link" size={14} /> Lịch sử đối tượng</button>}
                                <button className={`${s.btn} ${s.sm}`} onClick={() => copy(JSON.stringify(l, null, 2), 'Đã sao chép JSON')}><Icon name="list" size={14} /> Sao chép JSON</button>
                            </div>

                            {data.diff.length > 0 && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Thay đổi dữ liệu</h4>
                                    <div className={s.tableWrap}>
                                        <table className={s.diff}>
                                            <thead><tr><th>Trường</th><th>Trước</th><th>Sau</th></tr></thead>
                                            <tbody>{data.diff.map((d) => (
                                                <tr key={d.field}><td className={s.mono}>{d.field}</td>
                                                    <td className={d.changed ? s.o : ''}>{pretty(d.old)}</td><td className={d.changed ? s.n : ''}>{pretty(d.new)}</td></tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {l.meta && (
                                <div><h4 style={{ margin: '0 0 8px', fontSize: 13 }}>Dữ liệu bổ sung</h4>
                                    <pre className={`${s.code} ${s.mono}`} style={{ margin: 0 }}>{JSON.stringify(l.meta, null, 2)}</pre></div>
                            )}

                            <Timeline title="Cùng một yêu cầu" items={data.related.same_request} onOpen={onOpen} />
                            <Timeline title="Lịch sử của đối tượng" items={data.related.same_entity} onOpen={onOpen} />
                            <Timeline title="Hoạt động quanh thời điểm này (±30 phút)" items={data.related.same_actor} onOpen={onOpen} />

                            <div>
                                <h4 style={{ margin: '0 0 8px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="fingerprint" size={16} /> Dấu vân tay chống sửa log</h4>
                                {l.row_hash ? (
                                    <>
                                        <div className={`${s.small} ${s.muted}`} style={{ marginBottom: 6 }}>Mã băm bản ghi (SHA-256, nối với bản ghi trước)</div>
                                        <div className={`${s.hash} ${s.mono}`}>{l.row_hash}</div>
                                        <div className={`${s.small} ${s.muted}`} style={{ margin: '10px 0 6px' }}>Mã băm bản ghi trước</div>
                                        <div className={`${s.hash} ${s.mono}`}>{l.prev_hash}</div>
                                    </>
                                ) : <div className={`${s.small} ${s.muted}`}>Bản ghi này chưa có mã băm (chuỗi băm đang tắt khi ghi).</div>}
                            </div>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}