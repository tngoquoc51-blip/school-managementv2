<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentPortalController extends Controller
{
    private function studentOf(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            $uid = (int) $request->query('user_id', 0);
            $user = $uid ? User::find($uid) : null;
        }
        if (!$user) {
            return null;
        }

        return DB::table('students as s')
            ->leftJoin('classes as c', 'c.id', '=', 's.class_id')
            ->where('s.user_id', $user->id)
            ->select([
                's.id',
                's.code',
                's.full_name',
                's.class_id',
                's.status',
                'c.name as class_name',
            ])
            ->first();
    }

    /** GET /api/student/me */
    public function me(Request $request)
    {
        $st = $this->studentOf($request);
        if (!$st) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ học sinh',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $st->id,
                'code' => $st->code,
                'name' => $st->full_name,
                'class' => $st->class_name,
                'class_id' => $st->class_id,
                'status' => $st->status ?? 'active',
            ],
        ]);
    }

    /** GET /api/student/dashboard */
    public function dashboard(Request $request)
    {
        $st = $this->studentOf($request);
        if (!$st) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ học sinh',
            ], 404);
        }

        $avg = DB::table('grades')
            ->where('student_id', $st->id)
            ->where('semester', 1)
            ->avg('avg_score');

        $absent = 0;
        if (DB::getSchemaBuilder()->hasTable('attendances')) {
            $absent = (int) DB::table('attendances')
                ->where('student_id', $st->id)
                ->where('status', 'absent')
                ->count();
        }

        return response()->json([
            'success' => true,
            'data' => [
                'student' => [
                    'name' => $st->full_name,
                    'code' => $st->code,
                    'class' => $st->class_name,
                ],
                'stats' => [
                    'avg' => $avg !== null ? round((float) $avg, 1) : null,
                    'capacity' => null,
                    'conduct' => null,
                    'absent' => $absent,
                ],
            ],
        ]);
    }

    /** GET /api/student/schedule */
    public function schedule(Request $request)
    {
        $st = $this->studentOf($request);
        if (!$st) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ học sinh',
            ], 404);
        }

        $rows = DB::table('timetables as t')
            ->leftJoin('subjects as sub', 'sub.id', '=', 't.subject_id')
            ->leftJoin('users as tea', 'tea.id', '=', 't.teacher_id')
            ->where('t.class_id', $st->class_id)
            ->orderBy('t.day_of_week')
            ->orderBy('t.period')
            ->get([
                't.day_of_week',
                't.period',
                't.start_time',
                't.end_time',
                't.room',
                'sub.name as subject',
                'tea.name as teacher',
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $st->class_name,
                'items' => $rows,
            ],
        ]);
    }

    /** GET /api/student/exams */
    public function exams(Request $request)
    {
        $st = $this->studentOf($request);
        if (!$st) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ học sinh',
            ], 404);
        }

        $rows = DB::table('exams as e')
            ->leftJoin('subjects as sub', 'sub.id', '=', 'e.subject_id')
            ->where('e.class_id', $st->class_id)
            ->orderBy('e.exam_date')
            ->get([
                'sub.name as subject',
                'e.exam_date',
                'e.start_time',
                'e.end_time',
                'e.form',
                'e.room',
                'e.seat_no',
                'e.status',
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $st->class_name,
                'items' => $rows,
            ],
        ]);
    }

    /** GET /api/student/grades */
    public function grades(Request $request)
    {
        $st = $this->studentOf($request);
        if (!$st) {
            return response()->json([
                'success' => false,
                'message' => 'Không tìm thấy hồ sơ học sinh',
            ], 404);
        }

        $semester = (int) $request->query('semester', 1);
        if (!in_array($semester, [0, 1, 2], true)) {
            $semester = 1;
        }

        $query = DB::table('grades as g')
            ->leftJoin('subjects as sub', 'sub.id', '=', 'g.subject_id')
            ->where('g.student_id', $st->id)
            ->orderBy('sub.name');

        if ($semester === 1 || $semester === 2) {
            $query->where('g.semester', $semester);
        }

        $rows = $query->get([
            'g.id',
            'sub.name as subject',
            'g.tx1',
            'g.tx2',
            'g.tx3',
            'g.mid',
            'g.final',
            'g.avg_score',
            'g.semester',
        ]);

        $subjects = [];
        $sum = 0.0;
        $count = 0;

        foreach ($rows as $r) {
            $tbm = $r->avg_score !== null ? round((float) $r->avg_score, 1) : null;
            if ($tbm !== null) {
                $sum += $tbm;
                $count++;
            }

            $rank = null;
            if ($tbm !== null) {
                if ($tbm >= 8.0) {
                    $rank = 'Giỏi';
                } elseif ($tbm >= 6.5) {
                    $rank = 'Khá';
                } elseif ($tbm >= 5.0) {
                    $rank = 'TB';
                } else {
                    $rank = 'Yếu';
                }
            }

            $subjects[] = [
                'id' => $r->id,
                'name' => $r->subject,
                'type' => 'score',
                'tx' => [
                    $r->tx1 !== null ? (float) $r->tx1 : null,
                    $r->tx2 !== null ? (float) $r->tx2 : null,
                    $r->tx3 !== null ? (float) $r->tx3 : null,
                ],
                'gk' => $r->mid !== null ? (float) $r->mid : null,
                'ck' => $r->final !== null ? (float) $r->final : null,
                'tbm' => $tbm,
                'rank' => $rank,
                'teacher' => null,
                'updated_at' => null,
            ];
        }

        $gpa = $count > 0 ? round($sum / $count, 1) : null;

        $academic = null;
        if ($gpa !== null) {
            if ($gpa >= 8.0) {
                $academic = 'Giỏi';
            } elseif ($gpa >= 6.5) {
                $academic = 'Khá';
            } elseif ($gpa >= 5.0) {
                $academic = 'TB';
            } else {
                $academic = 'Yếu';
            }
        }

        $schoolYear = '2025-2026';

        return response()->json([
            'success' => true,
            'data' => [
                'student' => [
                    'code' => $st->code,
                    'name' => $st->full_name,
                    'class_name' => $st->class_name,
                ],
                'school_year' => $schoolYear,
                'semester' => $semester === 0 ? 1 : $semester,
                'years' => [
                    [
                        'school_year' => $schoolYear,
                        'class_name' => $st->class_name,
                        'is_current' => true,
                        'gpa_hk1' => ($semester === 1 || $semester === 0) ? $gpa : null,
                        'gpa_hk2' => $semester === 2 ? $gpa : null,
                        'gpa_year' => $gpa,
                        'academic' => $academic,
                        'conduct' => 'Tốt',
                    ],
                ],
                'subjects' => $subjects,
                'summary' => [
                    'gpa' => $gpa,
                    'academic' => $academic,
                    'conduct' => 'Tốt',
                    'rank_in_class' => null,
                    'class_size' => null,
                ],
            ],
        ]);
    }
}
