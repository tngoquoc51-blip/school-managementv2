'use client';
import { useState } from 'react';
import s from './TinTuc.module.css';
import Icon from '../Icons';
import { TT_POST } from './tin-tuc.data';

/** Nút sao chép liên kết và nút in, dùng ở cuối bài viết. */
export default function CopyLink() {
    const [ok, setOk] = useState(false);
    async function copy() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setOk(true); setTimeout(() => setOk(false), 2000);
        } catch { window.prompt('Sao chép liên kết:', window.location.href); }
    }
    return (
        <div className={s.share}>
            <b>{TT_POST.share}</b>
            <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={copy}><Icon name={ok ? 'check' : 'arrow'} size={16} />{ok ? TT_POST.copied : TT_POST.copy}</button>
            <button type="button" className={`${s.btn} ${s.btnLine}`} onClick={() => window.print()}>{TT_POST.print}</button>
        </div>
    );
}