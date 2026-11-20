<?php

namespace App\Http\Middleware;

use App\Support\AcademicRepo;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Xac thuc nhan vien bang Bearer token. Moi bo phan dung mot tai khoan rieng:
 *   - teacher           : chi dung Cong Giang day (phan cong, bai tap, diem danh tiet)
 *   - homeroom_teacher  : chi dung Cong Chu nhiem (lop chu nhiem, duyet don xin nghi)
 *   - vai tro khac      : Giao vu / Hieu truong / Pho HT / Quan tri - khong bi gioi han o day
 * Muon cho phep them API nao do, sua cac danh sach COMMON / TEACHER / HOMEROOM / SHARED ben duoi.
 *
 * Luu y: duong dan duoc chuan hoa ve dang "gv/..." truoc khi so khop, nen ca
 * /api/v1/gv/teacher/homeroom/... va /api/v1/teacher/homeroom/... deu duoc nhan.
 */
class StaffToken
{
    /** Cac API ca hai loai tai khoan giao vien deu duoc dung (ho so ca nhan, doi mat khau...). */
    private const COMMON = [
        'gv/me', 'gv/logout', 'gv/change-password', 'gv/activity', 'gv/profile/contact',
        'gv/security', 'gv/security/revoke-others', 'gv/teacher/me',
    ];

    /** Trang Ho so ca nhan giao vien (/teacher/profile) – ca hai loai tai khoan deu dung duoc. */
    private const PROFILE = '#^gv/teacher/profile(/|$)#';

    /** Cong Giang day (tai khoan teacher). */
    private const TEACHER = '#^gv/(teacher|attendance)(/|$)#';

    /** Cong Chu nhiem (tai khoan homeroom_teacher). */
    private const HOMEROOM = '#^gv/(teacher/homeroom|homeroom)(/|$)#';

    /** So dau bai – ca Giao vien bo mon (ghi so) va Giao vien chu nhiem (theo doi lop, xac nhan tuan) deu dung. */
    private const LESSON_LOG = '#^gv/(teacher/lesson-log|teacher/homeroom/lesson-log|homeroom/lesson-log|lesson-log)(/|$)#';

    /**
     * Chuc nang dung chung cho CA HAI loai tai khoan giao vien (giao vien chu nhiem cung day bo mon):
     *   nt  = Trung tam thong bao (/teacher/notifications)
     *   att = Diem danh tung tiet (/teacher/attendance)
     *   tt  = Thoi khoa bieu giao vien (/teacher/schedule)
     * Them module moi dung chung thi chi can them ten vao nhom trong ngoac.
     */
    private const SHARED = '#^gv/teacher/(nt|att|tt|ob|exams)(/|$)#';

    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $staff = (new AcademicRepo(DB::connection()->getPdo()))->authenticate($token);

        if (!$staff) {
            return response()->json(['message' => "Phi\u{00EA}n \u{0111}\u{0103}ng nh\u{1EAD}p kh\u{00F4}ng h\u{1EE3}p l\u{1EC7} ho\u{1EB7}c \u{0111}\u{00E3} h\u{1EBF}t h\u{1EA1}n."], 401);
        }

        $role = (string) ($staff['role'] ?? '');
        if (in_array($role, ['teacher', 'homeroom_teacher'], true) && !$this->allowed($role, $request)) {
            Log::warning('StaffToken chan ' . $role . ': ' . $request->method() . ' /' . $request->path());
            return response()->json(['message' => 'Tai khoan nay khong duoc dung chuc nang nay. Moi bo phan dung tai khoan rieng.'], 403);
        }

        $request->attributes->set('sm_staff', $staff);
        $request->attributes->set('sm_staff_token', $token);

        return $next($request);
    }

    private function allowed(string $role, Request $request): bool
    {
        $method = $request->method();
        $p = preg_replace('#^api/(v1/)?#', '', trim($request->path(), '/'));
        // Chuan hoa: duong dan khong co tien to "gv/" van duoc coi nhu "gv/..."
        if (strpos($p, 'gv/') !== 0) {
            $p = 'gv/' . $p;
        }

        if (in_array($p, self::COMMON, true)) {
            return true;
        }
        if (preg_match(self::PROFILE, $p)) {
            return true;
        }
        if (preg_match(self::LESSON_LOG, $p)) {
            return true;
        }
        if (preg_match(self::SHARED, $p)) {
            return true;
        }
        if (preg_match('#^gv/security/sessions/\d+/revoke$#', $p)) {
            return true;
        }
        if (in_array($method, ['GET', 'HEAD'], true) && $p === 'gv/notifications') {
            return true;
        }
        if ($method === 'POST' && preg_match('#^gv/notifications/(read-all|\d+/read)$#', $p)) {
            return true;
        }

        return (bool) preg_match($role === 'teacher' ? self::TEACHER : self::HOMEROOM, $p);
    }
}
