'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../_lib/api';
import { Card, Empty, ErrorBox, Loading, Modal, PageHead, Pager, Pill, Toast, fmtDT, useApi, useToast } from '../../_components/ui';

const TABS: [string, string][] = [['pending', 'Chờ duyệt'], ['approved', 'Đã xử lý'], ['rejected', 'Đã từ chối'], ['cancelled', 'Học sinh hủy']];

export default function Requests() {
    const [tab, setTab] = useState('pending');
    const [page, setPage] = useState(1);
    const { data, err, loading, reload } = useApi<any>(`profile-requests?status=${tab}&page=${page}`);
    const [target, setTarget] = useState<any>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const toast = useToast();

    const act = async (r: any, action: 'approve' | 'reject', n = '') => {
        setBusy(true);
        try {
            const res = await api<any>(`profile-requests/${r.id}/review`, { method: 'POST', body: { action, note: n } });
            toast.ok(res.message || 'Đã xử lý.'); setTarget(null); setNote(''); reload();
        } catch (e: any) { toast.fail(e.message); } finally { setBusy(false); }
    };

    return (
        <>
            <PageHead title="Duyệt hồ sơ học sinh" sub="Học sinh gửi đề nghị chỉnh sửa thông tin quan trọng (ngày sinh, họ tên bố mẹ, địa chỉ thường trú…). Duyệt để hệ thống tự cập nhật." />
            <div className="ac-tabs">
                {TABS.map(([k, l]) => <button key={k} className={`ac-tab ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setPage(1); }}>{l}{data?.counts ? <em>{data.counts[k] ?? 0}</em> : null}</button>)}
            </div>
            <Card pad={false}>
                {err ? <div style={{ padding: 16 }}><ErrorBox msg={err} retry={reload} /></div> : loading && !data ? <Loading /> : data && data.ready === false ? <Empty text="Chưa tạo bảng hồ sơ. Hãy chạy file them-ho-so-hoc-sinh.sql." /> : !data || data.items.length === 0 ? <Empty text="Không có yêu cầu nào." /> : (
                    <>
                        {data.items.map((r: any) => (
                            <div key={r.id} className="ac-req">
                                <div className="ac-req-top">
                                    <div><Link className="lk" href={`/academic/students/${r.student.code}`} style={{ fontWeight: 700, color: '#0369a1' }}>{r.student.name}</Link><span className="ac-sub">{r.student.code} · Lớp {r.student.class ?? '—'} · Gửi lúc {fmtDT(r.created_at)}</span></div>
                                    <div><Pill tone="pri">{r.field_label}</Pill></div>
                                </div>
                                <div className="ac-diff">
                                    <div><small>Hiện tại</small><span className="old">{r.old_value || '(trống)'}</span></div>
                                    <span>→</span>
                                    <div><small>Đề nghị đổi thành</small><span className="new">{r.new_value}</span></div>
                                </div>
                                <p style={{ color: '#5b6f85', marginBottom: 10 }}>Lý do: {r.reason}</p>
                                {r.status === 'pending' ? (
                                    <div className="ac-req-act">
                                        <button className="ac-btn ok sm" disabled={busy} onClick={() => act(r, 'approve')}>Duyệt &amp; cập nhật</button>
                                        <button className="ac-btn danger sm" disabled={busy} onClick={() => { setTarget(r); setNote(''); }}>Từ chối</button>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: 13 }}><Pill tone={r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'err' : 'mut'}>{r.status === 'approved' ? 'Đã duyệt' : r.status === 'rejected' ? 'Đã từ chối' : 'Đã hủy'}</Pill>{r.reviewed_by && <> · bởi {r.reviewed_by}</>}{r.reviewed_at && <> · {fmtDT(r.reviewed_at)}</>}{r.review_note && <> · “{r.review_note}”</>}</p>
                                )}
                            </div>
                        ))}
                        <Pager page={data.page} pages={data.pages} onChange={setPage} />
                    </>
                )}
            </Card>
            {target && (
                <Modal title="Từ chối đề nghị" onClose={() => setTarget(null)} foot={<><button className="ac-btn ghost" onClick={() => setTarget(null)}>Hủy</button><button className="ac-btn danger" disabled={busy || note.trim().length < 3} onClick={() => act(target, 'reject', note)}>Xác nhận từ chối</button></>}>
                    <p style={{ marginBottom: 12 }}>Đề nghị đổi <b>{target.field_label}</b> của <b>{target.student.name}</b>.</p>
                    <div className="ac-field"><label>Lý do từ chối (học sinh sẽ thấy)</label><textarea className="ac-ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Vui lòng mang giấy khai sinh đến văn phòng để đối chiếu." autoFocus /></div>
                </Modal>
            )}
            <Toast t={toast.t} clear={toast.clear} />
        </>
    );
}