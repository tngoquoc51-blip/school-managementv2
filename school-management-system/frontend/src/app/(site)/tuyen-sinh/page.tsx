import type { Metadata } from 'next';
import s from '@/modules/website/website.module.css';
import AdmissionForm from '@/modules/website/components/AdmissionForm';
import Faq from '@/modules/website/components/Faq';
import Icon from '@/modules/website/components/Icons';
import { ADMISSION_DOCS, ADMISSION_STEPS, SCHOOL } from '@/modules/website/data/school';

export const metadata: Metadata = {
    title: `Tuyển sinh ${SCHOOL.admissionYear} – ${SCHOOL.fullName}`,
    description: 'Thông tin tuyển sinh lớp 10 và biểu mẫu đăng ký nhập học trực tuyến.',
};

export default function AdmissionPage() {
    return (
        <>
            <section className={s.pageHero}>
                <div className={s.container}>
                    <h1 className={s.heroTitle}>Tuyển sinh năm học {SCHOOL.admissionYear}</h1>
                    <p className={s.heroText}>
                        Đăng ký trực tuyến để nhà trường ghi nhận thông tin, tư vấn và hẹn lịch nộp hồ sơ cho bạn.
                    </p>
                </div>
            </section>

            <section className={s.section}>
                <div className={`${s.container} ${s.infoGrid}`}>
                    <div className={s.infoBox}>
                        <h2>Quy trình 3 bước</h2>
                        <ol className={s.stepsLight}>
                            {ADMISSION_STEPS.map((st, i) => (
                                <li key={st.title}>
                                    <span className={s.stepNum}>{i + 1}</span>
                                    <div><h3>{st.title}</h3><p>{st.text}</p></div>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className={s.infoBox}>
                        <h2>Hồ sơ cần chuẩn bị</h2>
                        <ul className={s.checkList}>
                            {ADMISSION_DOCS.map((d) => (
                                <li key={d}><Icon name="check" size={22} /><span>{d}</span></li>
                            ))}
                        </ul>
                        <p className={s.formNote}>
                            Thời gian, chỉ tiêu và hình thức xét tuyển cụ thể sẽ được nhà trường thông báo chính thức theo quy định của địa phương.
                        </p>
                    </div>
                </div>
            </section>

            <section id="dang-ky" className={`${s.section} ${s.sectionSky}`}>
                <div className={`${s.container} ${s.formWrap}`}>
                    <div className={s.sectionHead}>
                        <h2 className={s.sectionTitle}>Đăng ký nhập học trực tuyến</h2>
                        <p className={s.sectionDesc}>Điền thông tin bên dưới. Các mục có thể bỏ trống đã được ghi rõ.</p>
                    </div>
                    <AdmissionForm />
                </div>
            </section>

            <section className={s.section}>
                <div className={`${s.container} ${s.faqWrap}`}>
                    <div className={s.sectionHead}>
                        <h2 className={s.sectionTitle}>Câu hỏi thường gặp</h2>
                    </div>
                    <Faq />
                </div>
            </section>
        </>
    );
}
