<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StudentClassmatesController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $cs = DB::table('class_students as cs')
            ->join('classes as c', 'c.id', '=', 'cs.class_id')
            ->where('cs.user_id', $user->id)
            ->orderByDesc('cs.is_current')
            ->select('cs.class_id', 'c.name as class_name')
            ->first();

        if (!$cs) {
            return response()->json(['success' => true, 'data' => ['class' => null, 'students' => []]]);
        }

        $rows = DB::table('class_students as cs')
            ->join('users as u', 'u.id', '=', 'cs.user_id')
            ->where('cs.class_id', $cs->class_id)
            ->where(function ($q) {
                $q->where('cs.is_current', 1)->orWhereNull('cs.is_current');
            })
            ->orderBy('u.name')
            ->get(['u.id', 'u.name', 'u.username', 'u.email']);

        $students = $rows->values()->map(function ($s, $i) {
            return [
                'stt'  => $i + 1,
                'id'   => $s->id,
                'code' => $s->username ?: preg_replace('/@.*/', '', (string) $s->email) ?: ('HS'.$s->id),
                'name' => $s->name,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'class'    => ['id' => $cs->class_id, 'name' => $cs->class_name],
                'students' => $students,
            ],
        ]);
    }
}
