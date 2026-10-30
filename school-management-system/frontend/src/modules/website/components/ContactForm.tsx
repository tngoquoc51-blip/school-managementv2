'use client';
import { useState, type FormEvent } from 'react';
import s from '../extra.module.css';

export default function ContactForm() {
    const [v, setV] = useState({ name: '', contact: '', message: '' });
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);

    function submit(e: FormEvent) {
        e.preventDefault();
        if (!v.name.trim() || !v.contact.trim() || v.message.trim().length < 10) {
            setErr('Nhập họ tên, số điện thoại hoặc email, và nội dung từ 10 ký tự.');
            return;
        }
        setErr('');
        setDone(true); /* TODO: gọi POST /contacts khi backend sẵn sàng */
    }

    if (done) return (
        <div className={s.ok} role="status">
            <h3>Đã nhận tin nhắn</h3>
            <p>Văn phòng nhà trường sẽ phản hồi trong giờ làm việc.</p>
            <button type="button" className={s.linkBtn} onClick={() => { setV({ name: '', contact: '', message: '' }); setDone(false); }}>Gửi tin nhắn khác</button>
        </div>
    );
    const f = (k: 'name' | 'contact' | 'message') => ({ value: v[k], onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }) });
    return (
        <form className={s.cform} onSubmit={submit} noValidate>
            <label>Họ và tên<input {...f('name')} autoComplete="name" /></label>
            <label>Số điện thoại hoặc email<input {...f('contact')} /></label>
            <label>Nội dung<textarea rows={5} {...f('message')} /></label>
            {err && <p className={s.err} role="alert">{err}</p>}
            <button type="submit" className={s.send}>Gửi tin nhắn</button>
        </form>
    );
}