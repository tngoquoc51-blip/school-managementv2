<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Giám sát toàn hệ thống (module Giám sát hệ thống):
 *  1) Số liệu mỗi request API (thời gian xử lý, mã trạng thái)  → sm_mon_requests
 *  2) Sự kiện đăng nhập thành công / thất bại                   → sm_mon_logs (auth)
 *  3) Lỗi máy chủ 5xx, bị giới hạn tần suất 429                 → sm_mon_logs (api)
 *  4) NHẬT KÝ THAO TÁC (audit): ai làm gì – mọi thao tác ghi dữ liệu
 *     (POST/PUT/PATCH/DELETE) thành công của giáo vụ, giáo viên, kế toán, học sinh, quản trị,
 *     cùng việc xuất / tải dữ liệu                              → sm_mon_logs (audit)
 *
 * AN TOÀN: mọi lỗi khi ghi đều bị nuốt – không bao giờ làm hỏng request thật.
 * KHÔNG ghi mật khẩu, token hay nội dung body; chỉ ghi route, phương thức, mã trạng thái, id trên đường dẫn.
 */
class RequestMonitor
{
    /** Thao tác bỏ qua (quá nhiều / không có giá trị kiểm toán) */
    private const SKIP = [
        '#notifications/(\{id\}/read|read-all|read-module)$#', '#notifications/(unread-count|badges)$#',
        '#homework/\{id\}/state$#', '#data-hub/import/\{batch\}/chunk$#', '#export/log$#', '#reminders/\{id\}/read#',
        '#reminders/read-all$#', '#public/notices/\{id\}/read$#', '#^gv/notices/audience$#', '#gv/logout$#', '#hs/logout$#', '#kt/logout$#', '#/preview$#', '#periods/preview$#',
    ];

    /** [regex trên đường dẫn đã chuẩn hóa, phương thức|*, nhãn tiếng Việt, mức: i = info, s = bảo mật] */
    private const LABELS = [
        ['#^gv/students/\{code\}/reset-password$#', 'POST', 'Đặt lại mật khẩu học sinh', 's'],
        ['#^gv/students/\{code\}$#', 'PUT', 'Sửa hồ sơ học sinh', 'i'],
        ['#^gv/profile-requests/\{id\}/review$#', 'POST', 'Duyệt yêu cầu chỉnh sửa hồ sơ', 'i'],
        ['#^gv/assignments/\{id\}$#', 'PUT', 'Sửa phân công giảng dạy', 'i'],
        ['#^gv/notifications$#', 'POST', 'Gửi thông báo giáo vụ', 'i'],
        ['#^gv/website/admissions/\{id\}$#', 'PUT', 'Cập nhật hồ sơ tuyển sinh', 'i'],
        ['#^gv/website/admissions/\{id\}$#', 'DELETE', 'Xóa hồ sơ tuyển sinh', 's'],
        ['#^gv/website/admissions/export$#', 'GET', 'Xuất danh sách tuyển sinh', 's'],
        ['#^gv/website/contacts/\{id\}$#', 'DELETE', 'Xóa tin nhắn liên hệ', 's'],
        ['#^gv/website/inbox/\{id\}/events$#', 'POST', 'Trả lời / ghi chú tin nhắn liên hệ', 'i'],
        ['#^gv/website/inbox/bulk$#', 'POST', 'Xử lý hàng loạt tin nhắn liên hệ', 'i'],
        ['#^gv/website/inbox/\{id\}$#', '*', 'Xử lý tin nhắn liên hệ', 'i'],
        ['#^gv/website/inbox/templates#', '*', 'Quản lý mẫu trả lời', 'i'],
        ['#^gv/website/inbox/settings$#', 'PUT', 'Sửa cài đặt hộp thư liên hệ', 'i'],
        ['#^gv/website/news/\{id\}/toggle$#', 'POST', 'Ẩn / hiện bài viết', 'i'],
        ['#^gv/website/news#', 'POST', 'Đăng bài viết', 'i'],
        ['#^gv/website/news#', 'PUT', 'Sửa bài viết', 'i'],
        ['#^gv/website/news#', 'DELETE', 'Xóa bài viết', 's'],
        ['#^gv/attendance/mark$#', 'POST', 'Điểm danh tiết học', 'i'],
        ['#^gv/teacher/homeroom/leaves/\{id\}/review$#', 'POST', 'Duyệt đơn xin nghỉ', 'i'],
        ['#^gv/teacher/homework/submissions/\{submissionId\}/grade$#', 'POST', 'Chấm bài tập', 'i'],
        ['#^gv/teacher/homework#', 'POST', 'Giao / bình luận bài tập', 'i'],
        ['#^gv/teacher/homework#', 'PUT', 'Sửa bài tập', 'i'],
        ['#^gv/teacher/homework#', 'DELETE', 'Xóa bài tập', 's'],
        ['#^gv/change-password$#', 'POST', 'Đổi mật khẩu (nhân viên)', 's'],
        ['#^gv/security/#', 'POST', 'Thu hồi phiên đăng nhập (nhân viên)', 's'],
        ['#^gv/profile/contact$#', 'PUT', 'Cập nhật liên hệ cá nhân (nhân viên)', 'i'],
        ['#^kt/cashier/collect$#', 'POST', 'Thu học phí', 'i'],
        ['#^kt/cashier/payments/\{id\}/void$#', 'POST', 'Hủy phiếu thu', 's'],
        ['#^kt/cashier/payments/\{id\}/(confirm|reject)$#', 'POST', 'Xác nhận / từ chối khoản thanh toán', 'i'],
        ['#^kt/cashier/payments/bulk-confirm$#', 'POST', 'Xác nhận thanh toán hàng loạt', 'i'],
        ['#^kt/cashier/disputes/\{id\}/reply$#', 'POST', 'Phản hồi khiếu nại học phí', 'i'],
        ['#^kt/periods/\{id\}/(issue|extend|close|reopen|cancel)$#', 'POST', 'Thay đổi trạng thái đợt thu', 'i'],
        ['#^kt/periods#', 'POST', 'Tạo đợt thu', 'i'],
        ['#^kt/periods#', 'PUT', 'Sửa đợt thu', 'i'],
        ['#^kt/receipts/(reconcile|unreconcile|print)$#', 'POST', 'Phiếu thu: đối soát / in', 'i'],
        ['#^kt/reminders/send$#', 'POST', 'Gửi nhắc nợ phụ huynh', 'i'],
        ['#^kt/reminders#', 'POST', 'Cấu hình nhắc nợ', 'i'],
        ['#^kt/debts/notes#', 'POST', 'Ghi chú công nợ', 'i'],
        ['#^v1/accountant/#', 'POST', 'Kế toán: ghi dữ liệu', 'i'],
        ['#^hs/change-password$#', 'POST', 'Đổi mật khẩu (học sinh)', 's'],
        ['#^hs/security/#', 'POST', 'Thu hồi phiên đăng nhập (học sinh)', 's'],
        ['#^hs/profile/requests#', 'POST', 'Gửi / hủy yêu cầu chỉnh sửa hồ sơ', 'i'],
        ['#^hs/profile/(contact|name)$#', 'PUT', 'Cập nhật thông tin cá nhân (học sinh)', 'i'],
        ['#^hs/attendance/leaves#', 'POST', 'Gửi / hủy đơn xin nghỉ', 'i'],
        ['#^hs/homework/\{id\}/submit$#', 'POST', 'Nộp bài tập', 'i'],
        ['#^hs/homework/\{id\}/comments$#', 'POST', 'Bình luận bài tập', 'i'],
        ['#^hs/wallet/topup$#', 'POST', 'Nạp ví học phí', 'i'],
        ['#^hs/fees/invoices/\{id\}/(declare|dispute)$#', 'POST', 'Khai báo / khiếu nại học phí', 'i'],
        ['#^hs/fees/payments/\{id\}/cancel$#', 'POST', 'Hủy khoản thanh toán', 'i'],
        ['#^hs/forgot-password#', 'POST', 'Quên mật khẩu (học sinh)', 's'],
        ['#^admin/roles#', '*', 'Quản lý vai trò & phân quyền', 's'],
        ['#^admin/school-years#', '*', 'Quản lý năm học', 'i'],
        ['#^admin/semesters#', '*', 'Sửa học kỳ', 'i'],
        ['#^admin/backups/\{id\}/restore$#', 'POST', 'PHỤC HỒI dữ liệu từ bản sao lưu', 's'],
        ['#^admin/backups/\{id\}/download$#', 'GET', 'Tải bản sao lưu', 's'],
        ['#^admin/backups#', '*', 'Quản lý sao lưu', 's'],
        ['#^admin/profile#', '*', 'Hồ sơ cá nhân quản trị', 'i'],
        ['#^admin/checks#', 'POST', 'Chạy kiểm tra dữ liệu', 'i'],
        ['#^data-hub/import/batches/\{batch\}/undo$#', 'POST', 'Hoàn tác nhập dữ liệu', 's'],
        ['#^data-hub/import#', 'POST', 'Nhập dữ liệu hàng loạt', 'i'],
        ['#^data-hub/export#', '*', 'Xuất dữ liệu', 's'],
        ['#^data-hub/mappings#', '*', 'Mẫu ghép cột nhập liệu', 'i'],
        ['#^gv/notices/\{id\}/action$#', 'POST', 'Thao tác thông báo BGH (duyệt / gửi / thu hồi / nhắc lại)', 'i'],
        ['#^gv/notices/templates#', '*', 'Quản lý mẫu thông báo BGH', 'i'],
        ['#^gv/notices/settings$#', 'PUT', 'Sửa cài đặt thông báo BGH', 'i'],
        ['#^gv/notices/\{id\}/export$#', 'GET', 'Xuất danh sách đã đọc thông báo BGH', 's'],
        ['#^gv/notices#', 'POST', 'Soạn / gửi thông báo BGH', 'i'],
        ['#^gv/notices#', 'PUT', 'Sửa thông báo BGH', 'i'],
        ['#^gv/notices#', 'DELETE', 'Xóa thông báo BGH', 's'],
        ['#^admin/#', '*', 'Thao tác quản trị', 'i'],
    ];

    public function handle(Request $request, Closure $next)
    {
        $t0 = microtime(true);
        $response = $next($request);

        try {
            $this->record($request, $response, (int) round((microtime(true) - $t0) * 1000));
        } catch (\Throwable $e) {
            // Không làm hỏng request thật, nhưng ghi lý do vào storage/logs/laravel.log để dễ tìm lỗi
            try { Log::warning('RequestMonitor không ghi được: ' . $e->getMessage()); } catch (\Throwable $x) {}
        }
        return $response;
    }

    private function record(Request $request, $response, int $ms): void
    {
        if ($request->isMethod('OPTIONS')) return;

        $route = $request->route();
        $uri = $route && method_exists($route, 'uri') ? (string) $route->uri() : trim($request->path(), '/');
        if ($uri === '' || str_contains($uri, 'gv/monitor') || str_contains($uri, 'public/announcements') || str_contains($uri, '{aliasPath}')) return; // tránh tự đo chính mình

        $status = (int) $response->getStatusCode();
        $method = strtoupper($request->method());
        $ip = mb_substr((string) $request->ip(), 0, 45);
        $now = now()->format('Y-m-d H:i:s');
        $db = DB::connection();

        $db->insert('INSERT INTO sm_mon_requests (route, method, status, ms, ip, created_at) VALUES (?,?,?,?,?,?)',
            [mb_substr($uri, 0, 140), mb_substr($method, 0, 8), $status, max(0, $ms), $ip ?: null, $now]);

        // --- Sự kiện đăng nhập ---
        if ($method === 'POST' && preg_match('#(^|/)login$#', $uri)) {
            $who = mb_substr(strtolower(trim((string) $this->loginName($request))), 0, 60);
            $area = str_contains($uri, 'gv/') ? 'nhân viên' : (str_contains($uri, 'hs/') ? 'học sinh' : (str_contains($uri, 'kt/') ? 'kế toán' : 'quản trị'));
            if ($status >= 200 && $status < 300) {
                $this->log($db, 'info', 'auth', 'login_ok', "Đăng nhập thành công ($area): $who", $who, $ip, $uri, $now);
            } elseif (in_array($status, [401, 403, 422, 423], true)) {
                $this->log($db, 'security', 'auth', 'login_failed', "Đăng nhập thất bại ($area): $who (HTTP $status)", $who, $ip, $uri, $now);
            }
            return;
        }

        // --- Lỗi máy chủ ---
        if ($status >= 500) {
            $this->log($db, 'error', 'api', 'server_error', "Lỗi máy chủ HTTP $status tại $method /$uri", $this->actor($request)[0], $ip, $uri, $now, $this->ctx($request, $uri, $status));
        } elseif ($status === 429) {
            $this->log($db, 'warn', 'api', 'rate_limited', "Bị giới hạn tần suất (429) tại /$uri", $this->actor($request)[0], $ip, $uri, $now);
        } elseif ($status === 403) {
            [$a, $disp] = $this->actor($request);
            $this->log($db, 'warn', 'api', 'forbidden', "Bị từ chối quyền (403): $disp $method /$uri", $a, $ip, $uri, $now, $this->ctx($request, $uri, $status));
        }

        // --- Nhật ký thao tác (audit) ---
        $norm = preg_replace('#^(api/)?(v1/)?#', '', $uri);
        $write = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        $sensitiveRead = $method === 'GET' && preg_match('#(export|download)#', $norm);
        if (($write || $sensitiveRead) && $status >= 200 && $status < 400) {
            foreach (self::SKIP as $re) { if (preg_match($re, $norm)) return; }
            [$a, $disp, $type] = $this->actor($request);
            [$label, $lv] = $this->label($norm, $method);
            $level = $lv === 's' ? 'security' : 'info';
            $this->log($db, $level, 'audit', 'audit', "$label — $disp", $a, $ip, $uri, $now, $this->ctx($request, $uri, $status, $type));
        }
    }

    /** @return array{0:?string,1:string,2:string} [tên đăng nhập, tên hiển thị, loại] */
    private function actor(Request $request): array
    {
        $g = fn (string $k) => $request->attributes->get($k);
        if ($s = $g('sm_staff')) { $s = (array) $s; $u = $s['username'] ?? null; return [$u, ($s['name'] ?? $u ?? 'Nhân viên') . ' (' . ($s['role_label'] ?? 'nhân viên') . ')', 'staff']; }
        if ($s = $g('kt_staff')) { $s = (array) $s; $u = $s['username'] ?? null; return [$u, ($s['name'] ?? $s['full_name'] ?? $u ?? 'Kế toán') . ' (kế toán)', 'accountant']; }
        if ($s = $g('sm_account')) { $s = (array) $s; $u = $s['username'] ?? null; return [$u, ($s['full_name'] ?? $s['name'] ?? $u ?? 'Học sinh') . ' (học sinh)', 'student']; }
        try {
            $u = $request->user();
            if ($u) return [mb_substr((string) ($u->email ?? $u->username ?? $u->id), 0, 60), ($u->name ?? $u->email ?? 'Quản trị') . ' (quản trị)', 'admin'];
        } catch (\Throwable $e) { /* chưa cấu hình guard */ }
        if ($request->bearerToken() === 'demo-token') return ['admin', 'Quản trị viên (quản trị)', 'admin'];
        return [null, 'Không xác định', 'unknown'];
    }

    /** @return array{0:string,1:string} */
    private function label(string $norm, string $method): array
    {
        foreach (self::LABELS as [$re, $m, $text, $lv]) {
            if (($m === '*' || $m === $method) && preg_match($re, $norm)) return [$text, $lv];
        }
        return ["Thao tác $method /$norm", 'i'];
    }

    private function ctx(Request $request, string $uri, int $status, string $type = ''): array
    {
        $p = [];
        try {
            foreach (($request->route()?->parameters() ?? []) as $k => $v) {
                if (is_scalar($v)) $p[$k] = mb_substr((string) $v, 0, 60);
            }
        } catch (\Throwable $e) {}
        return array_filter(['method' => $request->method(), 'route' => '/' . $uri, 'status' => $status, 'params' => $p ?: null, 'actor_type' => $type ?: null]);
    }

    private function log($db, string $level, string $source, string $action, string $msg, ?string $actor, ?string $ip, ?string $route, string $now, ?array $ctx = null): void
    {
        $db->insert('INSERT INTO sm_mon_logs (level, source, action, message, actor, ip, route, context, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [$level, $source, $action, mb_substr($msg, 0, 500), $actor ? mb_substr($actor, 0, 60) : null, $ip ?: null, $route ? mb_substr($route, 0, 140) : null,
             $ctx ? json_encode($ctx, JSON_UNESCAPED_UNICODE) : null, $now]);
    }

    /** Lấy tên đăng nhập người dùng đã gõ, dù form gửi bằng tên trường nào */
    private function loginName(Request $request): string
    {
        foreach (['username', 'email', 'identifier', 'login', 'user', 'account', 'user_name', 'student_code', 'code', 'ma', 'phone'] as $k) {
            $v = $request->input($k);
            if (is_string($v) && trim($v) !== '') return $v;
        }
        return '';
    }
}
