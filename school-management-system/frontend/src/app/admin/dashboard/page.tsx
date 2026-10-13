'use client';

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard Quản trị</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-500">Tổng tài khoản</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">1.562</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-500">Đang hoạt động</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">1.489</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-500">Tài khoản bị khóa</p>
                    <p className="text-2xl font-bold text-red-500 mt-1">12</p>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border">
                    <p className="text-sm text-gray-500">Nhật ký hôm nay</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">348</p>
                </div>
            </div>
        </div>
    );
}