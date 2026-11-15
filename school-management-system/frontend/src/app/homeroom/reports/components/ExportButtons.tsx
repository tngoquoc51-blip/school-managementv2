import { Download, FileText, Table } from 'lucide-react';

interface Props {
    reportId: number;
}

export default function ExportButtons({ reportId }: Props) {
    const handleExport = (format: 'pdf' | 'excel') => {
        // TODO: gọi API export
        window.open(`${process.env.NEXT_PUBLIC_API_URL}/homeroom/reports/${reportId}/export/${format}`, '_blank');
    };

    return (
        <div className="flex gap-2">
            <button
                onClick={() => handleExport('pdf')}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition"
            >
                <FileText className="w-4 h-4" /> Xuất PDF
            </button>
            <button
                onClick={() => handleExport('excel')}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition"
            >
                <Table className="w-4 h-4" /> Xuất Excel
            </button>
        </div>
    );
}