'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Btn, Ico, ta, longDate, todayStr } from './_ta';

export default function TodayAttendancePage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        ta('today')
            .then((res) => {
                setData(res);
            })
            .catch((err: any) => {
                setError(err?.message || 'Không tải được dữ liệu');
            })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="ta-loading">
                <div className="ta-spin" />
                <span>Đang tải lịch hôm nay...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="ta-err">
                <Ico n="alert" size={20} />
                <div>
                    <b>Không tải được dữ liệu</b>
                    <p>{error}</p>
                </div>
                <Btn tone="primary" onClick={() => window.location.reload()}>
                    Thử lại
                </Btn>
            </div>
        );
    }

    // Nếu API chưa có dữ liệu, hiện trạng thái trống đẹp
    return (
        <div className="ta-page">
            <div className="ta-greet">
                <div>
                    <h2>Hôm nay · {longDate(todayStr())}</h2>
                    <p>Danh sách tiết bạn cần điểm danh trong ngày</p>
                </div>
                <Link href="/teacher/attendance/tiet" className="ta-btn primary">
                    <Ico n="checks" size={16} />
                    Điểm danh ngay
                </Link>
            </div>

            <div className="ta-card">
                <div className="ta-empty">
                    <div className="ic">
                        <Ico n="cal" size={24} />
                    </div>
                    <b>Chưa có tiết nào cần điểm danh hôm nay</b>
                    <p>
                        Tài khoản này có thể chưa được phân công dạy tiết, hoặc chưa có dữ liệu thời khóa biểu.
                        Hãy kiểm tra lại phân công giảng dạy.
                    </p>
                    <Link href="/teacher/attendance/tiet" className="ta-btn primary">
                        Xem điểm danh tiết
                    </Link>
                </div>
            </div>
        </div>
    );
}