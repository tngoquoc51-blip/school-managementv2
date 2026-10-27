<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminNotificationController extends Controller
{
    private function q(Request $r)
    {
        return DB::table('admin_notifications')->where('user_id', $r->user()->id);
    }

    public function index(Request $r)
    {
        $rows = $this->q($r)->when($r->boolean('unread'), fn ($q) => $q->whereNull('read_at'))
            ->orderByDesc('id')->limit(min((int) $r->query('limit', 50), 100))->get();
        return response()->json(['data' => $rows, 'unread' => $this->q($r)->whereNull('read_at')->count()]);
    }

    public function read(Request $r, int $id)
    {
        $this->q($r)->where('id', $id)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['unread' => $this->q($r)->whereNull('read_at')->count()]);
    }

    public function readAll(Request $r)
    {
        $this->q($r)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['unread' => 0]);
    }

    public function destroy(Request $r, int $id)
    {
        $this->q($r)->where('id', $id)->delete();
        return response()->json(['unread' => $this->q($r)->whereNull('read_at')->count()]);
    }
}
