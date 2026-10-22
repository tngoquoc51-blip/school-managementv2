<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\SchoolRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

/**
 * API dành cho học sinh (đọc dữ liệu thật từ các bảng sm_*).
 *
 *   POST /api/hs/login            { username, password }  → { data: { token, student, ... } }
 *   POST /api/hs/logout
 *   GET  /api/hs/me               hồ sơ + lớp hiện tại
 *   GET  /api/hs/schedule         thời khóa biểu của LỚP mình (cùng lớp = cùng TKB, không có phòng học)
 *   GET  /api/hs/exams            lịch thi theo khối của mình
 *   GET  /api/hs/grades           bảng điểm tất cả năm học · HK1 · HK2
 *   POST /api/hs/change-password  { current_password, new_password }
 *
 * Hồ sơ cá nhân (cần đăng nhập):
 *   GET  /api/hs/profile                         toàn bộ hồ sơ + học tập + yêu cầu
 *   PUT  /api/hs/profile/contact                 tự sửa liên hệ, sức khỏe
 *   POST /api/hs/profile/requests                { field, new_value, reason } gửi yêu cầu chỉnh sửa
 *   POST /api/hs/profile/requests/{id}/cancel    hủy yêu cầu đang chờ
 *
 * Trung tâm bảo mật (cần đăng nhập):
 *   GET  /api/hs/security                       điểm bảo mật + các phiên đăng nhập
 *   POST /api/hs/security/revoke-others         đăng xuất mọi thiết bị khác
 *   POST /api/hs/security/sessions/{id}/revoke  đăng xuất 1 phiên
 *
 * Quên mật khẩu (công khai, không cần đăng nhập):
 *   POST /api/hs/forgot-password          { email }                                  → gửi mã 6 số qua Gmail
 *   POST /api/hs/forgot-password/verify   { email, code }                            → kiểm tra mã
 *   POST /api/hs/forgot-password/reset    { email, code, password, password_confirmation }
 */
class StudentApiController extends Controller
{
    private function repo(): SchoolRepo
    {
        return new SchoolRepo(DB::connection()->getPdo());
    }

    private function studentId(Request $request): int
    {
        return (int) $request->attributes->get('sm_account')['student_id'];
    }

    public function login(Request $request)
    {
        $username = trim((string) $request->input('username', ''));
        $password = (string) $request->input('password', '');
        if ($username === '' || $password === '') {
            return response()->json(['message' => 'Vui lòng nhập tên đăng nhập và mật khẩu.'], 422);
        }

        $r = $this->repo()->login($username, $password);
        if (!$r['ok']) {
            return response()->json(['message' => $r['message']], $r['status']);
        }

        return response()->json(['data' => [
            'token' => $r['token'],
            'token_type' => 'Bearer',
            'expires_at' => $r['expires_at'],
            'must_change_password' => $r['must_change_password'],
            'student' => $r['student'],
        ]]);
    }

    public function logout(Request $request)
    {
        $this->repo()->logout((string) $request->attributes->get('sm_token'));

        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function me(Request $request)
    {
        $p = $this->repo()->profile($this->studentId($request));

        return $p ? response()->json(['data' => $p]) : response()->json(['message' => 'Không tìm thấy học sinh.'], 404);
    }

        public function schedule(Request $request)
        {
            $d = $this->repo()->schedule($this->studentId($request));

            return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Học sinh chưa được xếp lớp ở năm học hiện tại.'], 404);
        }

        public function classmates(Request $request)
        {
            $d = $this->repo()->classmates($this->studentId($request));

            return $d
                ? response()->json(['success' => true, 'data' => $d])
                : response()->json(['success' => false, 'message' => 'Học sinh chưa được xếp lớp ở năm học hiện tại.'], 404);
        }

        public function exams(Request $request)
    {
        $d = $this->repo()->exams($this->studentId($request));

        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Học sinh chưa được xếp lớp ở năm học hiện tại.'], 404);
    }

    public function grades(Request $request)
    {
        $d = $this->repo()->grades($this->studentId($request));

        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy học sinh.'], 404);
    }

    public function changePassword(Request $request)
    {
        $r = $this->repo()->changePassword(
            (int) $request->attributes->get('sm_account')['id'],
            (string) $request->input('current_password', ''),
            (string) $request->input('new_password', ''),
            (string) $request->attributes->get('sm_token')
        );

        return response()->json(['message' => $r['message']], $r['status']);
    }

    /* ===================== HỒ SƠ CÁ NHÂN ===================== */

    public function profile(Request $request)
    {
        $a = $request->attributes->get('sm_account');
        $d = $this->repo()->fullProfile((int) $a['student_id'], (int) $a['id']);

        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy học sinh.'], 404);
    }

    public function updateContact(Request $request)
    {
        $in = [];
        foreach (array_keys(SchoolRepo::PROFILE_DIRECT) as $k) {
            if ($request->has($k)) {
                $in[$k] = $request->input($k);
            }
        }
        $r = $this->repo()->updateContact($this->studentId($request), $in);
        $body = ['message' => $r['message']];
        if (!empty($r['errors'])) {
            $body['errors'] = $r['errors'];
        }

        return response()->json($body, $r['status']);
    }

    public function createProfileRequest(Request $request)
    {
        $r = $this->repo()->createProfileRequest(
            $this->studentId($request),
            (string) $request->input('field', ''),
            (string) $request->input('new_value', ''),
            (string) $request->input('reason', '')
        );

        return response()->json(['message' => $r['message']], $r['status']);
    }

    public function cancelProfileRequest(Request $request, int $id)
    {
        $r = $this->repo()->cancelProfileRequest($this->studentId($request), $id);

        return response()->json(['message' => $r['message']], $r['status']);
    }

    /* ===================== TRUNG TÂM BẢO MẬT ===================== */

    public function security(Request $request)
    {
        $d = $this->repo()->security((int) $request->attributes->get('sm_account')['id'], (string) $request->attributes->get('sm_token'));

        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy tài khoản.'], 404);
    }

    public function revokeOthers(Request $request)
    {
        $n = $this->repo()->revokeOtherSessions((int) $request->attributes->get('sm_account')['id'], (string) $request->attributes->get('sm_token'));

        return response()->json(['message' => $n > 0 ? "Đã đăng xuất {$n} phiên khác." : 'Không có phiên nào khác.', 'data' => ['revoked' => $n]]);
    }

    public function revokeSession(Request $request, int $id)
    {
        $ok = $this->repo()->revokeSession((int) $request->attributes->get('sm_account')['id'], $id, (string) $request->attributes->get('sm_token'));

        return $ok
            ? response()->json(['message' => 'Đã đăng xuất phiên đăng nhập.'])
            : response()->json(['message' => 'Không tìm thấy phiên hoặc đây là phiên đang dùng.'], 404);
    }

    /* ===================== QUÊN MẬT KHẨU ===================== */

    public function forgotPassword(Request $request)
    {
        $email = (string) $request->input('email', '');
        $r = $this->repo()->forgotStart($email);
        if (!$r['ok']) {
            return response()->json(['message' => $r['message']], $r['status']);
        }

        $data = ['expires_in' => SchoolRepo::RESET_MINUTES * 60, 'resend_in' => SchoolRepo::RESET_RESEND_SECONDS];

        if (!empty($r['send'])) {
            try {
                $this->sendResetMail($r['to'], $r['name'], $r['code']);
            } catch (\Throwable $e) {
                report($e);
                if (!config('app.debug')) {
                    return response()->json(['message' => 'Không gửi được email lúc này. Vui lòng thử lại sau.'], 500);
                }
            }
            // Chỉ khi APP_DEBUG=true: trả mã ra để thử mà chưa cần cấu hình email thật
            if (config('app.debug')) {
                $data['dev_code'] = $r['code'];
            }
        }

        // Trả lời giống nhau dù Gmail có tồn tại hay không
        return response()->json([
            'message' => 'Nếu Gmail này đã đăng ký với nhà trường, mã xác nhận đã được gửi. Vui lòng kiểm tra hộp thư (cả mục Spam).',
            'data' => $data,
        ]);
    }

    public function forgotVerify(Request $request)
    {
        $r = $this->repo()->forgotVerify((string) $request->input('email', ''), (string) $request->input('code', ''));

        return response()->json(['message' => $r['ok'] ? 'Mã hợp lệ.' : $r['message']], $r['status']);
    }

    public function forgotReset(Request $request)
    {
        $r = $this->repo()->forgotReset(
            (string) $request->input('email', ''),
            (string) $request->input('code', ''),
            (string) $request->input('password', ''),
            (string) $request->input('password_confirmation', '')
        );

        return response()->json(['message' => $r['message']], $r['status']);
    }

    private function sendResetMail(string $to, string $name, string $code): void
    {
        $mins = SchoolRepo::RESET_MINUTES;
        $n = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
        $html = <<<HTML
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f2a43">
  <h2 style="margin:0 0 8px;color:#0369a1">Đặt lại mật khẩu cổng học sinh</h2>
  <p style="margin:0 0 16px">Xin chào <b>{$n}</b>, bạn vừa yêu cầu đặt lại mật khẩu. Mã xác nhận của bạn là:</p>
  <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;padding:16px;border-radius:12px;background:#e0f2fe;color:#0c4a6e">{$code}</div>
  <p style="margin:16px 0 0;font-size:14px;color:#475569">Mã có hiệu lực trong {$mins} phút và chỉ dùng được một lần. Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả giáo viên.</p>
  <p style="margin:8px 0 0;font-size:13px;color:#94a3b8">Nếu bạn không yêu cầu, hãy bỏ qua email này, mật khẩu của bạn không thay đổi.</p>
</div>
HTML;
        Mail::send([], [], function ($m) use ($to, $html) {
            $m->to($to)->subject('Mã xác nhận đặt lại mật khẩu')->html($html);
        });
    }
}
