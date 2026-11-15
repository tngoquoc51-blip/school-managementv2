import axios from 'axios';
import { HomeroomReport, SmartAlert } from '@/types/homeroom-report';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const getAuthHeader = () => ({
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
});

export const homeroomReportService = {
    getReports: async (params?: any): Promise<HomeroomReport[]> => {
        const res = await axios.get(`${API}/v1/homeroom/reports`, {
            params,
            headers: getAuthHeader(),
        });
        return res.data.data || res.data;
    },

    getReport: async (id: number): Promise<HomeroomReport> => {
        const res = await axios.get(`${API}/v1/homeroom/reports/${id}`, {
            headers: getAuthHeader(),
        });
        return res.data.data || res.data;
    },

    createReport: async (payload: any) => {
        const res = await axios.post(`${API}/v1/homeroom/reports`, payload, {
            headers: getAuthHeader(),
        });
        return res.data;
    },

    updateReport: async (id: number, payload: any) => {
        const res = await axios.put(`${API}/v1/homeroom/reports/${id}`, payload, {
            headers: getAuthHeader(),
        });
        return res.data;
    },

    submitReport: async (id: number) => {
        const res = await axios.post(`${API}/v1/homeroom/reports/${id}/submit`, {}, {
            headers: getAuthHeader(),
        });
        return res.data;
    },

    getSmartAlerts: async (): Promise<SmartAlert[]> => {
        const res = await axios.get(`${API}/v1/homeroom/reports/alerts`, {
            headers: getAuthHeader(),
        });
        return res.data.data || res.data;
    },

    getClassSummary: async (classId: number) => {
        const res = await axios.get(`${API}/v1/homeroom/reports/class/${classId}/summary`, {
            headers: getAuthHeader(),
        });
        return res.data.data || res.data;
    },
};