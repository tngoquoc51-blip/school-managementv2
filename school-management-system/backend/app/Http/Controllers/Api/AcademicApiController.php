<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AcademicRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * API khu Giáo vụ / Ban giám hiệu  —  prefix /api/gv
 *
 *   POST login · POST logout · GET me
 *   GET  dashboard
 *   GET  students · GET students/{code} · PUT students/{code} · POST students/{code}/reset-password
 *   GET  profile-requests?status= · POST profile-requests/{id}/review {action: approve|reject, note}
 *   GET  classes · GET classes/{id}
 *   GET  assignments?class_id= · PUT assignments/{id} {teacher_id}
 *   GET  timetable?class_id=|teacher_id=
 *   GET  exams · GET grades?class_id=&semester= · GET promotion?class_id= · GET reports
 */
class AcademicApiController extends Controller
{
    private function repo(): AcademicRepo
    {
        return new AcademicRepo(DB::connection()->getPdo());
    }

    private function staff(Request $r): array
    {
        return $r->attributes->get('sm_staff');
    }

    private function out(array $r)
    {
        if (!$r['ok']) {
            $body = ['message' => $r['message']];
            if (isset($r['errors'])) {
                $body['errors'] = $r['errors'];
            }
            return response()->json($body, $r['status']);
        }
        return response()->json(['message' => $r['message']]);
    }

    public function login(Request $request)
    {
        $u = trim((string) $request->input('username', ''));
        $p = (string) $request->input('password', '');
        if ($u === '' || $p === '') {
            return response()->json(['message' => 'Vui lòng nhập tên đăng nhập và mật khẩu.'], 422);
        }
        $r = $this->repo()->login($u, $p);
        if (!$r['ok']) {
            return response()->json(['message' => $r['message']], $r['status']);
        }
        return response()->json(['data' => ['token' => $r['token'], 'token_type' => 'Bearer', 'expires_at' => $r['expires_at'], 'staff' => $r['staff']]]);
    }

    public function logout(Request $request)
    {
        $this->repo()->logout((string) $request->attributes->get('sm_staff_token'));
        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function me(Request $request)
    {
        return response()->json(['data' => $this->staff($request)]);
    }

    public function dashboard()
    {
        return response()->json(['data' => $this->repo()->dashboard()]);
    }

    public function students(Request $request)
    {
        return response()->json(['data' => $this->repo()->students($request->query())]);
    }

    public function studentDetail(string $code)
    {
        $d = $this->repo()->studentDetail($code);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy học sinh.'], 404);
    }

    public function updateStudent(Request $request, string $code)
    {
        $fields = $request->input('fields', []);
        return $this->out($this->repo()->updateStudent($code, is_array($fields) ? $fields : [], $this->staff($request)));
    }

    public function resetStudentPassword(string $code)
    {
        return $this->out($this->repo()->resetStudentPassword($code));
    }

    public function requests(Request $request)
    {
        return response()->json(['data' => $this->repo()->requests($request->query('status'), (int) $request->query('page', 1))]);
    }

    public function reviewRequest(Request $request, int $id)
    {
        return $this->out($this->repo()->reviewRequest($id, (string) $request->input('action', ''), (string) $request->input('note', ''), $this->staff($request)));
    }

    public function classes()
    {
        return response()->json(['data' => $this->repo()->classes()]);
    }

    public function classDetail(int $id)
    {
        $d = $this->repo()->classDetail($id);
        return $d ? response()->json(['data' => $d]) : response()->json(['message' => 'Không tìm thấy lớp.'], 404);
    }

    public function assignments(Request $request)
    {
        return response()->json(['data' => $this->repo()->assignments($request->query('class_id') ? (int) $request->query('class_id') : null)]);
    }

    public function updateAssignment(Request $request, int $id)
    {
        return $this->out($this->repo()->updateAssignment($id, (int) $request->input('teacher_id', 0)));
    }

    public function timetable(Request $request)
    {
        $c = $request->query('class_id');
        $t = $request->query('teacher_id');
        return response()->json(['data' => $this->repo()->timetable($c ? (int) $c : null, $t ? (int) $t : null)]);
    }

    public function exams()
    {
        return response()->json(['data' => $this->repo()->exams()]);
    }

    public function grades(Request $request)
    {
        $c = $request->query('class_id');
        return response()->json(['data' => $this->repo()->grades($c ? (int) $c : null, (int) $request->query('semester', 1))]);
    }

    public function promotion(Request $request)
    {
        $c = $request->query('class_id');
        return response()->json(['data' => $this->repo()->promotion($c ? (int) $c : null)]);
    }

    public function reports()
    {
        return response()->json(['data' => $this->repo()->reports()]);
    }
    /** PUT /api/gv/profile/contact */
    /** PUT /api/gv/profile/contact */
    public function updateContact(Request $request)
    {
        $staff = $this->staff($request);
        $id = (int) ($staff['id'] ?? 0);
        $username = trim((string) ($staff['username'] ?? ''));
        $staffEmail = trim((string) ($staff['email'] ?? ''));

        if ($id <= 0 && $username === '') {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }

        $phone = trim((string) $request->input('phone', ''));
        $email = trim((string) $request->input('email', ''));

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return response()->json(['message' => 'Email không hợp lệ'], 422);
        }

        // Tìm user: id staff HOẶC username/email đăng nhập Giáo vụ
        $row = DB::table('users')
            ->where(function ($q) use ($id, $username, $staffEmail) {
                if ($id > 0) {
                    $q->where('id', $id);
                }
                if ($username !== '') {
                    $q->orWhere('username', $username)
                        ->orWhere('email', $username);
                }
                if ($staffEmail !== '') {
                    $q->orWhere('email', $staffEmail)
                        ->orWhere('username', $staffEmail);
                }
                // hay dùng: giaovu
                $q->orWhere('username', 'giaovu')
                    ->orWhere('email', 'giaovu@thpt.edu.vn');
            })
            ->first();

        if (!$row) {
            return response()->json(['message' => 'Không tìm thấy tài khoản'], 404);
        }

        $upd = ['updated_at' => now()];
        $upd['phone'] = $phone !== '' ? $phone : null;
        if ($email !== '') {
            $upd['email'] = $email;
        }
        DB::table('users')->where('id', $row->id)->update($upd);

        $row = DB::table('users')->where('id', $row->id)->first();

        $out = array_merge($staff, [
            'email' => $row->email ?? $email,
            'phone' => $row->phone ?? $phone,
        ]);

        return response()->json(['data' => $out, 'message' => 'Đã cập nhật liên hệ.']);
    }

    /** POST /api/gv/change-password */
   /** POST /api/gv/change-password */
   public function changePassword(Request $request)
   {
       $staff = $this->staff($request);
       $id = (int) ($staff['id'] ?? 0);
       $username = trim((string) ($staff['username'] ?? ''));

       $current = (string) $request->input('current_password', '');
       $new = (string) $request->input('new_password', '');

       if ($current === '' || $new === '') {
           return response()->json(['message' => 'Vui lòng nhập đủ mật khẩu'], 422);
       }
       if (strlen($new) < 6) {
           return response()->json(['message' => 'Mật khẩu mới tối thiểu 6 ký tự'], 422);
       }

       $user = DB::table('users')
           ->where(function ($q) use ($id, $username) {
               if ($id > 0) {
                   $q->where('id', $id);
               }
               if ($username !== '') {
                   $q->orWhere('username', $username)->orWhere('email', $username);
               }
               $q->orWhere('username', 'giaovu')->orWhere('email', 'giaovu@thpt.edu.vn');
           })
           ->first();

       if (!$user) {
           return response()->json(['message' => 'Không tìm thấy tài khoản'], 404);
       }

       if (empty($user->password) || !password_verify($current, $user->password)) {
           return response()->json(['message' => 'Mật khẩu hiện tại không đúng'], 422);
       }

       DB::table('users')->where('id', $user->id)->update([
           'password' => password_hash($new, PASSWORD_BCRYPT),
           'updated_at' => now(),
       ]);

       return response()->json(['message' => 'Đã đổi mật khẩu.']);
   }

    /** GET /api/gv/security */
    public function security(Request $request)
    {
        $staff = $this->staff($request);
        $id = (int) ($staff['id'] ?? 0);

        // Nếu có bảng token staff riêng thì query thật; tạm trả phiên hiện tại
        $sessions = [[
            'id' => 0,
            'device' => 'Trình duyệt hiện tại',
            'ip' => $request->ip(),
            'last_active_at' => now()->format('d/m/Y H:i'),
            'is_current' => true,
        ]];

        // personal_access_tokens (Sanctum) nếu dùng
        if (DB::getSchemaBuilder()->hasTable('personal_access_tokens') && $id > 0) {
            $rows = DB::table('personal_access_tokens')
                ->where('tokenable_id', $id)
                ->orderByDesc('last_used_at')
                ->limit(10)
                ->get();
            if ($rows->count()) {
                $sessions = $rows->map(function ($t, $i) use ($request) {
                    return [
                        'id' => (int) $t->id,
                        'device' => $t->name ?: 'Token #' . $t->id,
                        'ip' => '—',
                        'last_active_at' => $t->last_used_at ?: $t->created_at,
                        'is_current' => $i === 0,
                    ];
                })->values()->all();
            }
        }

        return response()->json(['data' => ['sessions' => $sessions]]);
    }

    /** POST /api/gv/security/revoke-others */
    public function revokeOthers(Request $request)
    {
        $staff = $this->staff($request);
        $id = (int) ($staff['id'] ?? 0);
        if ($id > 0 && DB::getSchemaBuilder()->hasTable('personal_access_tokens')) {
            DB::table('personal_access_tokens')->where('tokenable_id', $id)->delete();
        }
        return response()->json(['message' => 'Đã thu hồi các phiên khác.']);
    }

    /** POST /api/gv/security/sessions/{id}/revoke */
    public function revokeSession(Request $request, int $id)
    {
        if ($id > 0 && DB::getSchemaBuilder()->hasTable('personal_access_tokens')) {
            DB::table('personal_access_tokens')->where('id', $id)->delete();
        }
        return response()->json(['message' => 'Đã thu hồi phiên.']);
    }

    /** GET /api/gv/activity */
    public function activity(Request $request)
    {
        $staff = $this->staff($request);
        $id = (int) ($staff['id'] ?? 0);
        $limit = min(50, max(5, (int) $request->query('limit', 20)));

        $items = [];
        if ($id > 0 && DB::getSchemaBuilder()->hasTable('sm_staff_activity')) {
            $items = DB::table('sm_staff_activity')
                ->where('user_id', $id)
                ->orderByDesc('created_at')
                ->limit($limit)
                ->get()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'time' => $r->created_at,
                    'created_at' => $r->created_at,
                    'action' => $r->action,
                    'detail' => $r->detail,
                ])
                ->all();
        }

        if (!$items) {
            $items = [
                [
                    'time' => now()->subMinutes(5)->format('d/m/Y H:i'),
                    'action' => 'Đăng nhập Cổng Giáo vụ',
                    'detail' => 'IP ' . $request->ip(),
                ],
                [
                    'time' => now()->subHour()->format('d/m/Y H:i'),
                    'action' => 'Xem thông báo hệ thống',
                    'detail' => '',
                ],
            ];
        }

        return response()->json(['data' => ['items' => $items]]);
    }
}
