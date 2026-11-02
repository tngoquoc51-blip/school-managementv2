import api from '@/services/api';
import { cfg } from '@/services/teacherAttendance';

const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));
const B = '/gv/teacher';

export const teacherPortal = {
    profile: () => d(api.get(`${B}/me`, cfg())),
    assignments: () => d(api.get(`${B}/assignments`, cfg())),
    assignment: (id: number) => d(api.get(`${B}/assignments/${id}`, cfg())),
    homeroom: () => d(api.get(`${B}/homeroom`, cfg())),
    leaves: (status?: string) => d(api.get(`${B}/homeroom/leaves`, { ...cfg(), params: { status } })),
    review: (id: number, body: { decision: 'approve' | 'reject'; note?: string }) => d(api.post(`${B}/homeroom/leaves/${id}/review`, body, cfg())),
};