'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQ, useSeating } from '@/components/hr-seating/Shell';
import SeatCanvas, { SeatMap } from '@/components/hr-seating/SeatCanvas';
import { Badge, Card, Empty, ErrorBox, Icon, Modal, PageHeader, Skeleton, useToast } from '@/components/hr-seating/ui';
import { EventRow, Layout, Student, errText, hrGet, hrSend, seatKey, timeAgo } from '@/lib/hr-seating';

const ACTION: Record<string, { label: string; icon: string }> = {
    create: { label: 'Tạo sơ đồ', icon: 'plus' }, update: { label: 'Sửa sơ đồ', icon: 'edit' }, save: { label: 'Lưu sơ đồ', icon: 'check' },
    publish: { label: 'Công bố', icon: 'award' }, delete: { label: 'Xóa sơ đồ', icon: 'trash' }, auto: { label: 'Xếp tự động', icon: 'wand' },
    groups: { label: 'Cập nhật tổ', icon: 'users' }, officers: { label: 'Ban cán sự', icon: 'star' }, flag: { label: 'Lưu ý chỗ ngồi', icon: 'eye' }, seed: { label: 'Khởi tạo', icon: 'info' },
};

export default function HistoryPage() {
    const { params } = useSeating();
    const toast = useToast();
    const layouts = useQ<Layout[]>('/layouts');
    const events = useQ<EventRow[]>('/events');
    const roster = useQ<{ students: Student[] }>('/roster');
    const [view, setView] = useState<Layout | null>(null);
    const [confirm, setConfirm] = useState<{ kind: 'publish' | 'delete'; layout: Layout } | null>(null);
    const [busy, setBusy] = useState(false);
    const students = useMemo(() => new Map((roster.data?.students || []).map((s) => [s.id, s])), [roster.data]);

    const open = async (l: Layout) => {
        try { setView(await hrGet<Layout>(`/layouts/${l.id}`, params)); } catch (e) { toast.error('Không mở được sơ đồ', errText(e)); }
    };
    const act = async (fn: () => Promise<any>, ok: string) => {
        setBusy(true);
        try { await fn(); toast.success(ok); layouts.reload(); events.reload(); } catch (e) { toast.error('Không thực hiện được', errText(e)); }
        finally { setBusy(false); setConfirm(null); }
    };

    const statusBadge = (l: Layout) => l.is_active ? <Badge tone="ok">Đang áp dụng</Badge> : l.status === 'archived' ? <Badge tone="muted">Lưu trữ</Badge> : <Badge tone="warn">Bản nháp</Badge>;
    const viewSeats: SeatMap = {};
    (view?.seats || []).forEach((s) => { viewSeats[seatKey(s.row, s.col, s.pos)] = { student_id: s.student_id, locked: s.locked, note: s.note }; });

    return (
        <>
            <PageHeader title="Phiên bản & lịch sử" desc="Các phiên bản sơ đồ của lớp. Chỉ một bản được áp dụng; bản cũ được lưu trữ để xem lại hoặc khôi phục.">
                <Link href="/homeroom/seating/chart" className="hs-btn primary"><Icon name="plus" size={16} /> Tạo / chỉnh sơ đồ</Link>
            </PageHeader>

            <div className="hs-grid hs-g-7-5">
                <div className="hs-grid" style={{ gap: 14, alignContent: 'start' }}>
                    {layouts.error ? <ErrorBox error={layouts.error} onRetry={layouts.reload} /> : layouts.loading && !layouts.data ? <Skeleton h={110} n={3} /> : (layouts.data || []).length === 0 ? <Empty icon="layers" title="Chưa có sơ đồ nào" hint="Bấm “Tạo / chỉnh sơ đồ” để bắt đầu." /> : (
                        (layouts.data || []).map((l) => (
                            <Card key={l.id}>
                                <div className="hs-row" style={{ alignItems: 'flex-start' }}>
                                    <div className="hs-avatar hs-tone-primary" style={{ width: 44, height: 44 }}><Icon name="layers" size={20} /></div>
                                    <div style={{ flex: 1 }}>
                                        <div className="hs-row hs-wrap"><b style={{ fontSize: 15 }}>{l.name}</b>{statusBadge(l)}</div>
                                        <div className="hs-small hs-muted" style={{ marginTop: 4 }}>
                                            {l.rows_n} hàng × {l.cols_n} dãy × {l.seats_per_desk} chỗ · {l.seated} học sinh · Cập nhật {timeAgo(l.updated_at)}{l.created_by_name ? ` · ${l.created_by_name}` : ''}
                                        </div>
                                        {l.note && <div className="hs-small" style={{ marginTop: 4 }}>{l.note}</div>}
                                        <div className="hs-row hs-wrap" style={{ marginTop: 12 }}>
                                            <button className="hs-btn sm" onClick={() => open(l)}><Icon name="eye" size={14} /> Xem</button>
                                            <Link className="hs-btn sm" href={`/homeroom/seating/chart?layout=${l.id}`}><Icon name="edit" size={14} /> Chỉnh sửa</Link>
                                            <button className="hs-btn sm" disabled={busy} onClick={() => act(() => hrSend('POST', `/layouts/${l.id}/duplicate`, {}, params), 'Đã nhân bản sơ đồ')}><Icon name="copy" size={14} /> Nhân bản</button>
                                            {!l.is_active && <button className="hs-btn sm ok" disabled={busy} onClick={() => setConfirm({ kind: 'publish', layout: l })}><Icon name="award" size={14} /> Công bố</button>}
                                            {!l.is_active && <button className="hs-btn sm bad" disabled={busy} onClick={() => setConfirm({ kind: 'delete', layout: l })}><Icon name="trash" size={14} /> Xóa</button>}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                <Card title="Nhật ký thay đổi">
                    {events.loading && !events.data ? <Skeleton h={50} n={4} /> : (events.data || []).length === 0 ? <Empty title="Chưa có nhật ký" /> : (
                        <div className="hs-timeline">{(events.data || []).map((e) => (
                            <div className="hs-tl" key={e.id}>
                                <div className="hs-row"><Icon name={(ACTION[e.action] || ACTION.seed).icon} size={14} /><span className="hs-b hs-small">{(ACTION[e.action] || { label: e.action }).label}</span></div>
                                {e.detail && <div className="hs-small">{e.detail}</div>}
                                <div className="hs-small hs-muted">{timeAgo(e.created_at)}{e.actor_name ? ` · ${e.actor_name}` : ''}</div>
                            </div>
                        ))}</div>
                    )}
                </Card>
            </div>

            <Modal open={!!view} onClose={() => setView(null)} title={view?.name || 'Sơ đồ'} width={980}>
                {view && <SeatCanvas rows={view.rows_n} cols={view.cols_n} per={view.seats_per_desk} blocked={new Set(view.blocked)} seats={viewSeats} students={students} readOnly compact />}
            </Modal>
            <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === 'publish' ? 'Công bố sơ đồ này?' : 'Xóa sơ đồ này?'}
                   footer={<><button className="hs-btn" onClick={() => setConfirm(null)}>Hủy</button>
                       <button className={`hs-btn ${confirm?.kind === 'delete' ? 'bad' : 'primary'}`} disabled={busy} onClick={() => confirm && act(() => confirm.kind === 'publish' ? hrSend('POST', `/layouts/${confirm.layout.id}/publish`, {}, params) : hrSend('DELETE', `/layouts/${confirm.layout.id}`, undefined, params), confirm.kind === 'publish' ? 'Đã công bố sơ đồ' : 'Đã xóa sơ đồ')}>
                           {busy ? 'Đang xử lý…' : confirm?.kind === 'publish' ? 'Công bố' : 'Xóa'}</button></>}>
                {confirm?.kind === 'publish' ? <p>Sơ đồ <b>{confirm.layout.name}</b> sẽ trở thành bản đang áp dụng. Bản hiện tại được chuyển sang lưu trữ.</p> : <p>Sơ đồ <b>{confirm?.layout.name}</b> sẽ bị xóa vĩnh viễn.</p>}
            </Modal>
        </>
    );
}