import Link from 'next/link';
import s from '@/modules/website/site.module.css';

export default function NotFound() {
    return (
        <section className={s.pageHead}>
            <div className={s.container}>
                <h1>Không tìm thấy trang này</h1>
                <p>Đường dẫn có thể đã đổi hoặc bài viết đã được gỡ. Hãy quay về trang chủ hoặc xem tin mới nhất.</p>
                <p className={s.row}><Link href="/" className={`${s.btn} ${s.btnHot}`}>Về trang chủ</Link><Link href="/tin-tuc" className={`${s.btn} ${s.btnLine}`}>Xem tin tức</Link></p>
            </div>
        </section>
    );
}