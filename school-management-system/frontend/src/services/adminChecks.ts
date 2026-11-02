import api from '@/services/api';
import { cfg } from '@/services/adminProfile';

const B = '/admin/checks';
const d = (p: Promise<any>): Promise<any> =>
    p.then((r) => (r && typeof r === 'object' && 'status' in r && 'data' in r ? r.data : r));

export const adminChecks = {
    get: () => d(api.get(B, cfg())),
    run: () => d(api.post(`${B}/run`, {}, cfg())),
    detail: (code: string) => d(api.get(`${B}/${code}`, cfg())),
};