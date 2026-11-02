<?php

namespace Modules\Homework\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Xác thực học sinh theo bảng sm_api_tokens (token_hash = sha256 của Bearer token).
 * Nếu hàm đăng nhập của bạn băm token khác sha256, chỉ cần sửa đúng 1 dòng hash() bên dưới.
 */
class SmStudentAuth
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) return $this->deny('Bạn chưa đăng nhập.', 401);

        $acc = DB::table('sm_api_tokens as t')
            ->join('sm_accounts as a', 'a.id', '=', 't.account_id')
            ->join('sm_students as s', 's.id', '=', 'a.student_id')
            ->where('t.token_hash', hash('sha256', $token))
            ->whereRaw('t.expires_at > NOW()')
            ->where('a.status', 'active')
            ->first(['a.id as account_id', 's.id as student_id', 's.full_name as name']);
        if (!$acc) return $this->deny('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', 401);

        $classId = DB::table('sm_enrollments as e')
            ->join('sm_school_years as y', 'y.id', '=', 'e.school_year_id')
            ->where('e.student_id', $acc->student_id)->where('y.is_current', 1)
            ->value('e.class_id');
        if (!$classId) return $this->deny('Bạn chưa được xếp lớp trong năm học hiện tại.', 403);

        $request->attributes->set('sm_student', [
            'id' => (int) $acc->student_id,
            'account_id' => (int) $acc->account_id,
            'class_id' => (int) $classId,
            'name' => $acc->name,
        ]);
        return $next($request);
    }

    private function deny(string $msg, int $code)
    {
        return response()->json(['success' => false, 'message' => $msg], $code);
    }
}
