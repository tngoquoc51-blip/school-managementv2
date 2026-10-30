import type { Metadata } from 'next';
import Link from 'next/link';
import s from '@/modules/website/site.module.css';
import Icon from '@/modules/website/components/Icons';
import { AdmissionForm } from '@/modules/website/components/Forms';
import { Faq, PageHead, SectionHead } from '@/modules/website/components/Parts';
import { ADMISSION_DATES, ADMISSION_DOCS, ADMISSION_STEPS, FAQ, SCHOOL } from '@/modules/website/data/school';

export const metadata: Metadata = { title: 'Tuyển sinh', description: `Đăng ký nhập học lớp 10 năm học ${SCHOOL.admissionYear}, hồ sơ cần chuẩn bị và cách tra cứu tiến độ.` };

export default function AdmissionPage() {
    return (
        <>
            <PageHead title={`Tuyển sinh lớp 10, năm học ${SCHOOL.admissionYear}`} desc="Đăng ký trực tuyến trong vài phút, nhận mã hồ sơ và theo dõi tiến độ bất cứ lúc nào." trail={[['Tuyển sinh']]}>
                <p className={s.row}><a href="#dang-ky" className={`${s.btn} ${s.btnHot} ${s.btnLg}`}>Đăng ký ngay</a><Link href="/tuyen-sinh/tra-cuu" className={`${s.btn} ${s.btnLine} ${s.btnLg}`}>Tra cứu hồ sơ</Link></p>
            </PageHead>

            <section className={s.section}>
                <div className={s.container}>
                    <SectionHead title="Quy trình bốn bước" />
                    <ol className={s.steps}>
                        {ADMISSION_STEPS.map((x, i) => <li key={x.title}><span>{i + 1}</span><h3>{x.title}</h3><p>{x.text}</p></li>)}
                    </ol>
                </div>
            </section>

            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={`${s.container} ${s.split}`}>
                    <div>
                        <h2 className={s.h2}>Hồ sơ cần chuẩn bị</h2>
                        <ul className={s.checklist}>{ADMISSION_DOCS.map((d) => <li key={d}><Icon name="check" size={18} />{d}</li>)}</ul>
                    </div>
                    <div>
                        <h2 className={s.h2}>Các mốc thời gian</h2>
                        <p className={s.muted}>Nhà trường sẽ cập nhật ngày cụ thể khi có thông báo chính thức.</p>
                        <dl className={s.defs}>{ADMISSION_DATES.map(([d, t]) => <div key={t}><dt>{d}</dt><dd>{t}</dd></div>)}</dl>
                    </div>
                </div>
            </section>

            <section className={s.section} id="dang-ky">
                <div className={`${s.container} ${s.formWrap}`}>
                    <div>
                        <h2 className={s.h2} id="dang-ky-h">Đăng ký nhập học trực tuyến</h2>
                        <p className={s.lead}>Điền thông tin của học sinh và phụ huynh. Sau khi gửi, bạn nhận một mã hồ sơ.</p>
                        <p className={s.muted}>Thông tin chỉ dùng để tư vấn tuyển sinh. Có thắc mắc, gọi {SCHOOL.phone} trong giờ làm việc.</p>
                    </div>
                    <AdmissionForm />
                </div>
            </section>

            <section className={`${s.section} ${s.sectionTint}`}>
                <div className={`${s.container} ${s.narrow}`}><SectionHead title="Câu hỏi về tuyển sinh" /><Faq items={FAQ} /></div>
            </section>
        </>
    );
}