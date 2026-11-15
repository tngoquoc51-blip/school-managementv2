import api from '@/services/api';
import { cfg } from '@/services/teacherAttendance';

const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));
const B = '/v1/teacher/homeroom';

export const homeroomPortal = {
    dashboard: () => d(api.get(`${B}/dashboard`, cfg())),
    student: (id: number) => d(api.get(`${B}/students/${id}`, cfg())),
    review: (id: number, body: { decision: 'approve' | 'reject'; note?: string }) => d(api.post(`${B}/leaves/${id}/review`, body, cfg())),
};