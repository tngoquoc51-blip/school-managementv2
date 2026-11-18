'use client';
// Cài đặt thanh toán & nhật ký (/admin/finance/cai-dat)
import React, { useEffect, useState } from 'react';
import { Btn, Card, Empty, ErrorBox, Field, Ico, Loading, Pager, Pill, Tabs, dt, fi, qs, useLoad, useTa } from '../_fi';

type S = Record<string, string>;
type A = { id: number; actor: string | null; action: string; entity: string | null; entity_id: string | null; detail: string | null; ip: string | null; created_at: string };
const FIELDS: { k: string; label: string; ph?: string; wide?: boolean }[] = [
    { k: 'bank_name', label: 'Tên ngân hàng', ph: 'Ngân hàng TMCP Ngoại thương Việt Nam' }, { k: 'bank_short', label: 'Tên viết tắt', ph: 'Vietcombank' },
    { k: 'bank_bin', label: 'Mã BIN (6 số, dùng tạo mã QR)', ph: '970436' }, { k: 'account_no', label: 'Số tài khoản', ph: '0123456789' },
    { k: 'account_name', label: 'Chủ tài khoản', ph: 'TRUONG THPT NGO SY LIEN', wide: true }, { k: 'transfer_hint', label: 'Cú pháp nội dung chuyển khoản', ph: 'HOCPHI [Mã học sinh] [Họ tên]', wide: true },
    { k: 'office', label: 'Nơi thu trực tiếp', ph: 'Phòng Kế toán – tầng 1' }, { k: 'hotline', label: 'Hotline hỗ trợ', ph: '0123 456 789' },
    { k: 'demo_note', label: 'Ghi chú hiển thị cho học sinh', ph: 'Nhà trường không thu tiền mặt ngoài giờ hành chính', wide: true },
];

export default function SettingsPage() {
    const [tab, setTab] = useState('pay');
    return (<div className="ta-page"><Tabs value={tab} onChange={setTab} items={[{ key: 'pay', label: 'Thanh toán' }, { key: 'log', label: 'Nhật ký thao tác' }]} />{tab === 'pay' ? <Pay /> : <Log />}</div>);
}

function Pay() {
    const { toast } = useTa();
    const { data, err, loading, reload } = useLoad(() => fi<{ data: S }>('settings'), []);
    const [f, setF] = useState<S>({}); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
    useEffect(() => { if (data) setF(data.data); }, [data]);
    if (loading && !data) return <Loading />;
    if (err || !data) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const dirty = JSON.stringify(f) !== JSON.stringify(data.data);
    const save = async () => { setMsg(''); setBusy(true); try { await fi('settings', { method: 'PUT', body: { data: f } }); toast('Đã lưu cài đặt thanh toán.'); reload(); } catch (e) { setMsg((e as Error).message); } setBusy(false); };
    const acc = (f.account_no || '').replace(/\s/g, '');
    return (
        <div className="fi-grid g21">
            <Card title="Tài khoản nhận học phí" sub="Thông tin này hiển thị cho học sinh khi thanh toán và dùng để tạo mã QR">
                <div className="fi-twocol">{FIELDS.map((x) => <div key={x.k} style={x.wide ? { gridColumn: '1 / -1' } : undefined}><Field label={x.label}><input value={f[x.k] || ''} placeholder={x.ph} maxLength={300} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} /></Field></div>)}</div>
                {msg && <p className="ta-ferr">{msg}</p>}
                <div className="fi-row" style={{ marginTop: 12 }}><Btn tone="primary" busy={busy} disabled={!dirty} onClick={save}><Ico n="check" size={16} />Lưu cài đặt</Btn>{dirty && <Btn onClick={() => setF(data.data)}>Hoàn tác</Btn>}</div>
            </Card>
            <Card title="Xem trước">
                <div className="fi-bank">
                    <small>{f.bank_short || 'Ngân hàng'}</small>
                    <b className="fi-money">{acc ? acc.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• ••••'}</b>
                    <span>{f.account_name || 'TÊN CHỦ TÀI KHOẢN'}</span>
                    <em>{f.bank_name || 'Tên ngân hàng'}</em>
                </div>
                <div className="fi-note" style={{ marginTop: 12 }}><b>Nội dung chuyển khoản</b><p>{f.transfer_hint || '—'}</p></div>
                {f.office && <p className="ta-mute">Nộp trực tiếp: {f.office}{f.hotline ? ` · ${f.hotline}` : ''}</p>}
            </Card>
        </div>
    );
}

function Log() {
    const [page, setPage] = useState(1);
    const { data, err, loading, reload } = useLoad(() => fi<{ meta: { page: number; pages: number; total: number }; data: A[] }>(`audit${qs({ page })}`), [page]);
    if (loading && !data) return <Loading />;
    if (err || !data) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const tone = (a: string) => (a.includes('delete') || a.includes('cancel') || a.includes('void') ? 'rose' : a.includes('create') ? 'green' : 'sky');
    return (
        <Card pad={false} title="Nhật ký thao tác" sub={`${data.meta.total} bản ghi · ghi lại mọi thay đổi trong module Tài chính`}>
            {data.data.length === 0 ? <Empty icon="doc" title="Chưa có thao tác nào" /> : (<>
                <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Chi tiết</th><th>IP</th></tr></thead><tbody>
                {data.data.map((a) => <tr key={a.id}><td className="ta-time">{dt(a.created_at)}</td><td>{a.actor || '—'}</td><td><Pill tone={tone(a.action)}>{a.action}</Pill></td><td>{a.detail || '—'}{a.entity && <small>{a.entity}{a.entity_id ? ` #${a.entity_id}` : ''}</small>}</td><td className="ta-mute">{a.ip || '—'}</td></tr>)}</tbody></table></div>
                <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} /></>)}
        </Card>
    );
}