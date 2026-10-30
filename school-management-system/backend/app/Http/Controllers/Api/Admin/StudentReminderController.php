<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\FeeReminderRepo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Thông báo nhắc học phí trên cổng học sinh (prefix /api/v1/hs/fees/reminders, middleware StudentToken).
 *   GET  fees/reminders                 danh sách thông báo nhắc nợ và số tin chưa đọc
 *   POST fees/reminders/read-all        đánh dấu đã đọc tất cả
 *   POST fees/reminders/{id}/read       đánh dấu đã đọc một tin
 */
class StudentReminderController extends Controller
{
    private function repo(): FeeReminderRepo
    {
        return new FeeReminderRepo(DB::connection()->getPdo());
    }

    private function sid(Request $r): int
    {
        $a = $r->attributes->get('sm_account');
        return (int) (is_array($a) ? ($a['student_id'] ?? 0) : ($a->student_id ?? 0));
    }

    public function index(Request $r)
    {
        return response()->json(['data' => $this->repo()->forStudent($this->sid($r))]);
    }

    public function read(Request $r, int $id)
    {
        $x = $this->repo()->markRead($this->sid($r), $id);
        return response()->json(['message' => 'OK', 'data' => ['updated' => $x['updated']]]);
    }

    public function readAll(Request $r)
    {
        $x = $this->repo()->markRead($this->sid($r), null);
        return response()->json(['message' => 'OK', 'data' => ['updated' => $x['updated']]]);
    }
}
