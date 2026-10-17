export interface AdmissionPayload {
    fullName: string;
    dob: string;
    gender: string;
    middleSchool: string;
    parentName: string;
    phone: string;
    email: string;
    track: string;
    note: string;
}

/* CHẾ ĐỘ THỬ NGHIỆM
   true  : form chỉ giả lập gửi thành công, KHÔNG gửi dữ liệu đi đâu cả.
   false : gửi thật tới API  POST {NEXT_PUBLIC_API_URL}/admissions
   Khi backend có API tuyển sinh, đổi thành false. */
export const ADMISSIONS_DEMO = true;

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export async function submitAdmission(payload: AdmissionPayload): Promise<{ code: string }> {
    if (ADMISSIONS_DEMO) {
        await new Promise((r) => setTimeout(r, 700));
        return { code: 'TS-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
    }

    const res = await fetch(`${API}/admissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Không gửi được hồ sơ');
    const json = await res.json();
    return { code: json?.data?.code ?? '' };
}
