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
}
