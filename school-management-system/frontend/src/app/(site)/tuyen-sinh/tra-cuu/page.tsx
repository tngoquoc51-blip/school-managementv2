import type { Metadata } from 'next';
import s from '@/modules/website/site.module.css';
import { LookupForm } from '@/modules/website/components/Forms';
import { PageHead } from '@/modules/website/components/Parts';

export const metadata: Metadata = { title: 'Tra cứu hồ sơ tuyển sinh', description: 'Xem tiến độ hồ sơ tuyển sinh bằng mã hồ sơ và số điện thoại đã khai.' };

export default function LookupPage() {
    return (
        <>
            <PageHead title="Tra cứu hồ sơ tuyển sinh" desc="Nhập mã hồ sơ nhận được khi đăng ký và số điện thoại phụ huynh đã khai." trail={[['Tuyển sinh', '/tuyen-sinh'], ['Tra cứu hồ sơ']]} />
            <section className={s.section}><div className={`${s.container} ${s.narrow}`}><LookupForm /></div></section>
        </>
    );
}