'use client';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, vnd } from '../_lib/cash';
import { Chip, ErrorBox, Loading, Modal } from '../../periods/_components/ui';

type Rc = {
    id: number; receipt_code: string; status: string; reason: string | null; amount: number; amount_words: string; method_label: string; reference: string | null; note: string | null;
    paid_at: string | null; cashier: string | null; remaining_after: number;
    school: { name: string; address: string; hotline: string; footer: string; treasurer: string; accountant: string };
    student: { code: string; name: string; birth_date: string | null; class: string | null };
    invoice: { id: number; code: string; title: string; year: string; total: number; lines: { description: string; quantity: number; unit_price: number; discount: number; amount: number }[] };
    log: { action: string; detail: string; actor: string; at: string | null }[];
};

/** Nội dung chỉ dùng khi in: gắn thẳng vào <body> để không bị khung trang cắt, màn hình thường không thấy. */
export function PrintPortal({ children }: { children: ReactNode }) {
    const [ok, setOk] = useState(false);
    useEffect(() => setOk(true), []);
    if (!ok) return null;
    return createPortal(<div className="pd cl cl-printroot" aria-hidden>{children}</div>, document.body);
}

const ACTION: Record<string, string> = { collect: 'Thu tại quầy', confirm: 'Xác nhận', reject: 'Từ chối', void: 'Hủy phiếu', print: 'In phiếu', recon: 'Đối soát', unrecon: 'Bỏ đối soát' };

function Paper({ r }: { r: Rc }) {
    return (
        <article className={`cl-paper ${r.status === 'voided' ? 'void' : ''}`}>
            {r.status === 'voided' && <div className="cl-stamp">ĐÃ HỦY</div>}
            <header>
                <div><b>{r.school.name || 'TRƯỜNG THPT'}</b><span>{r.school.address}{r.school.hotline ? ` · ĐT ${r.school.hotline}` : ''}</span></div>
                <div className="r"><span>Số phiếu</span><b className="cl-mono">{r.receipt_code}</b></div>
            </header>
            <h2>PHIẾU THU HỌC PHÍ</h2>
            <p className="cl-paper-date">Thời điểm thu: {r.paid_at}</p>
            <dl>
                <div><dt>Học sinh</dt><dd><b>{r.student.name}</b> (Mã {r.student.code}{r.student.class ? `, lớp ${r.student.class}` : ''})</dd></div>
                <div><dt>Hóa đơn</dt><dd>{r.invoice.title} <span className="cl-mono">({r.invoice.code})</span> · Năm học {r.invoice.year}</dd></div>
                <div><dt>Hình thức</dt><dd>{r.method_label}{r.reference ? <> · Mã GD <span className="cl-mono">{r.reference}</span></> : null}</dd></div>
                {r.note && <div><dt>Ghi chú</dt><dd>{r.note}</dd></div>}
            </dl>
            <table>
                <thead><tr><th>Nội dung khoản thu của hóa đơn</th><th className="n">SL</th><th className="n">Đơn giá</th><th className="n">Thành tiền</th></tr></thead>
                <tbody>
                {r.invoice.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td className="n">{l.quantity}</td><td className="n">{vnd(l.unit_price)}</td><td className="n">{vnd(l.amount)}</td></tr>)}
                <tr className="sum"><td colSpan={3}>Tổng hóa đơn</td><td className="n">{vnd(r.invoice.total)}</td></tr>
                </tbody>
            </table>
            <div className="cl-paper-amt">
                <div><span>Số tiền thu lần này</span><b>{vnd(r.amount)}</b></div>
                <div><span>Còn lại sau lần thu này</span><b>{vnd(r.remaining_after)}</b></div>
            </div>
            <p className="cl-paper-words">Bằng chữ: <i>{r.amount_words}</i></p>
            <div className="cl-sign">
                <div><b>Người nộp tiền</b><span>(Ký, ghi rõ họ tên)</span></div>
                <div><b>{r.school.accountant}</b><span>{r.cashier}</span></div>
                <div><b>{r.school.treasurer}</b><span>(Ký, đóng dấu)</span></div>
            </div>
            {r.school.footer && <p className="cl-paper-foot">{r.school.footer}</p>}
        </article>
    );
}

/** Xem và in một hoặc nhiều phiếu thu. */
export function ReceiptModal({ ids, title = 'Phiếu thu', banner, onClose, onPrint }: { ids: number[]; title?: string; banner?: ReactNode; onClose: () => void; onPrint?: (ids: number[]) => void }) {
    const [list, setList] = useState<Rc[] | null>(null);
    const [err, setErr] = useState('');
    const key = ids.join(',');
    useEffect(() => {
        let live = true;
        Promise.all(key.split(',').map((id) => api<Rc>(`cashier/payments/${id}`))).then((d) => live && setList(d)).catch((e) => live && setErr(e.message));
        return () => { live = false; };
    }, [key]);

    return (
        <Modal title={title} onClose={onClose} wide
               foot={<><button className="pd-btn ghost" onClick={onClose}>Đóng</button>{list && <button className="pd-btn" onClick={() => { window.print(); onPrint?.(list.map((r) => r.id)); }}>In {list.length > 1 ? `${list.length} phiếu` : 'phiếu thu'}</button>}</>}>
            {banner}
            {err && <ErrorBox msg={err} />}
            {!list && !err && <Loading text="Đang tải phiếu thu…" />}
            {list && (
                <>
                    <div className="cl-preview">{list.map((r) => <Paper key={r.id} r={r} />)}</div>
                    <PrintPortal>{list.map((r) => <Paper key={r.id} r={r} />)}</PrintPortal>
                </>
            )}
            {list && list.length === 1 && list[0].log.length > 0 && (
                <div className="cl-noprint">
                    <h4 className="cl-h4">Lịch sử thao tác</h4>
                    <ul className="pd-log">
                        {list[0].log.map((l, i) => <li key={i} className={l.action === 'void' ? 'cancel' : l.action === 'reject' ? 'cancel' : 'issue'}><i /><div><b>{ACTION[l.action] || l.action} <Chip>{l.actor}</Chip></b><span>{l.detail}</span><small>{l.at}</small></div></li>)}
                    </ul>
                </div>
            )}
        </Modal>
    );
}