<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentGradeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            $userId = $request->query('user_id');
            if ($userId) {
                $user = \App\Models\User::find($userId);
            }
        }

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $year = $request->query('school_year');
        $semester = (int) $request->query('semester', 1);

        $cs = DB::table('class_students as cs')
            ->join('classes as c', 'c.id', '=', 'cs.class_id')
            ->where('cs.user_id', $user->id)
            ->orderByDesc('cs.is_current')
            ->orderByDesc('cs.academic_year')
            ->select('cs.*', 'c.name as class_name', 'c.grade')
            ->first();

        if (!$year && $cs) {
            $year = $cs->academic_year ?? '2025-2026';
        }
        $year = $year ?: '2025-2026';

        $yearsRows = DB::table('class_students as cs')
            ->join('classes as c', 'c.id', '=', 'cs.class_id')
            ->where('cs.user_id', $user->id)
            ->select('cs.academic_year', 'c.name as class_name', 'cs.is_current')
            ->orderBy('cs.academic_year')
            ->get();

        $years = $yearsRows->map(function ($y) {
            return [
                'school_year' => $y->academic_year,
                'class_name'  => $y->class_name,
                'is_current'  => (bool) ($y->is_current ?? true),
                'gpa_hk1'     => null,
                'gpa_hk2'     => null,
                'gpa_year'    => null,
                'academic'    => null,
                'conduct'     => null,
            ];
        })->values()->all();

        $q = DB::table('student_scores as sc')
            ->join('subjects as s', 's.id', '=', 'sc.subject_id')
            ->where('sc.user_id', $user->id)
            ->where('sc.academic_year', $year);

        if ($semester === 1 || $semester === 2) {
            $q->where('sc.semester', $semester);
        }

        $rows = $q->select(
            's.id as subject_id',
            's.name as subject_name',
            's.is_pass_fail',
            'sc.score_type',
            'sc.score',
            'sc.teacher_name',
            'sc.updated_at',
            'sc.semester'
        )->get();

        $bySubject = [];
        foreach ($rows as $r) {
            $sid = $r->subject_id;
            if (!isset($bySubject[$sid])) {
                $bySubject[$sid] = [
                    'id'         => $sid,
                    'name'       => $r->subject_name,
                    'type'       => $r->is_pass_fail ? 'pass_fail' : 'score',
                    'tx'         => [null, null, null, null],
                    'gk'         => null,
                    'ck'         => null,
                    'tbm'        => null,
                    'rank'       => null,
                    'teacher'    => $r->teacher_name,
                    'updated_at' => $r->updated_at,
                ];
            }
            $map = ['tx1' => 0, 'tx2' => 1, 'tx3' => 2, 'tx4' => 3];
            if (isset($map[$r->score_type])) {
                $bySubject[$sid]['tx'][$map[$r->score_type]] = $r->score !== null ? (float) $r->score : null;
            } elseif ($r->score_type === 'gk') {
                $bySubject[$sid]['gk'] = $r->score !== null ? (float) $r->score : null;
            } elseif ($r->score_type === 'ck') {
                $bySubject[$sid]['ck'] = $r->score !== null ? (float) $r->score : null;
            }
            if ($r->teacher_name) {
                $bySubject[$sid]['teacher'] = $r->teacher_name;
            }
            if ($r->updated_at) {
                $bySubject[$sid]['updated_at'] = $r->updated_at;
            }
        }

        $subjects = [];
        $gpaSum = 0;
        $gpaCount = 0;

        foreach ($bySubject as $sub) {
            if ($sub['type'] === 'pass_fail') {
                $sub['tbm'] = null;
                $sub['rank'] = ($sub['ck'] !== null && $sub['ck'] >= 1) ? 'Đạt' : (($sub['ck'] !== null) ? 'Chưa đạt' : null);
            } else {
                $txVals = array_values(array_filter($sub['tx'], fn ($v) => $v !== null));
                $txAvg = count($txVals) ? array_sum($txVals) / count($txVals) : null;
                $gk = $sub['gk'];
                $ck = $sub['ck'];

                if ($txAvg !== null && $gk !== null && $ck !== null) {
                    $tbm = round(($txAvg * 2 + $gk * 2 + $ck * 3) / 7, 1);
                    $sub['tbm'] = $tbm;
                    $gpaSum += $tbm;
                    $gpaCount++;
                    if ($tbm >= 8.0) {
                        $sub['rank'] = 'Giỏi';
                    } elseif ($tbm >= 6.5) {
                        $sub['rank'] = 'Khá';
                    } elseif ($tbm >= 5.0) {
                        $sub['rank'] = 'TB';
                    } else {
                        $sub['rank'] = 'Yếu';
                    }
                }
            }
            $subjects[] = $sub;
        }

        $gpa = $gpaCount ? round($gpaSum / $gpaCount, 1) : null;
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

        return response()->json([
            'success' => true,
            'data'    => [
                'student' => [
                    'code'       => preg_replace('/@.*/', '', $user->email ?? ''),
                    'name'       => $user->name,
                    'class_name' => $cs->class_name ?? '',
                ],
                'school_year' => $year,
                'semester'    => $semester,
                'years'       => $years,
                'subjects'    => $subjects,
                'summary'     => [
                    'gpa'           => $gpa,
                    'academic'      => $academic,
                    'conduct'       => 'Tốt',
                    'rank_in_class' => null,
                    'class_size'    => null,
                ],
            ],
        ]);
    }
}
