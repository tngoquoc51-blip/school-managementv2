/** @type {import('next').NextConfig} */
// Chuyển tiếp mọi lời gọi /api/* sang backend Laravel (máy dev và server dùng chung một cách).
// Trình duyệt luôn gọi CÙNG domain → không lỗi CORS, không phải đoán địa chỉ/cổng.
// Nếu đã có next.config.js riêng, chỉ cần gộp phần "rewrites" vào.
const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

module.exports = {
    reactStrictMode: true,
    async rewrites() {
        return [{ source: '/api/:path*', destination: `${BACKEND}/api/:path*` }];
    },
};