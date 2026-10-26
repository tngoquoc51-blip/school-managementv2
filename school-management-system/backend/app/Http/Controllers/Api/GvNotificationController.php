<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GvNotificationController extends Controller
{
    private function uid(Request $r): int
    {
        $staff = $r->attributes->get('sm_staff') ?? $r->attributes->get('staff');
        if (is_array($staff) && !empty($staff['id'])) {
            return (int) $staff['id'];
        }
        $user = $r->user();
        return $user ? (int) $user->id : 0;
    }

    public function index(Request $request)
    {
        $uid = $this->uid($request);
        $status = $request->query('status', 'all');
        $type = $request->query('type', '');
        $q = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $per = 15;

        $base = DB::table('sm_notifications as n')
            ->leftJoin('sm_notification_reads as r', function ($j) use ($uid) {
                $j->on('r.notification_id', '=', 'n.id')->where('r.user_id', '=', $uid);
            });

        if ($type !== '') {
            $base->where('n.type', $type);
        }
        if ($q !== '') {
            $base->where(function ($w) use ($q) {
                $w->where('n.title', 'like', "%{$q}%")->orWhere('n.body', 'like', "%{$q}%");
            });
        }

        // counts
        $all = (clone $base)->count();
        $unread = (clone $base)->whereNull('r.id')->count();
        $read = (clone $base)->whereNotNull('r.id')->count();
        $sent = DB::table('sm_notifications')->where('sender_id', $uid)->count();

        $query = clone $base;
        if ($status === 'unread') {
            $query->whereNull('r.id');
        } elseif ($status === 'read') {
            $query->whereNotNull('r.id');
        } elseif ($status === 'sent') {
            $query = DB::table('sm_notifications as n')
                ->leftJoin('sm_notification_reads as r', function ($j) use ($uid) {
                    $j->on('r.notification_id', '=', 'n.id')->where('r.user_id', '=', $uid);
                })
                ->where('n.sender_id', $uid);
        }

        $total = $query->count();
        $rows = $query
            ->orderByDesc('n.created_at')
            ->forPage($page, $per)
            ->get([
                'n.id', 'n.title', 'n.body', 'n.type', 'n.priority', 'n.audience',
                'n.sender_id', 'n.sender_name', 'n.created_at',
                DB::raw('IF(r.id IS NULL, 0, 1) as is_read'),
            ]);

        $items = $rows->map(function ($n) use ($uid) {
            $out = $n->sender_id && (int) $n->sender_id === $uid;
            return [
                'id' => (int) $n->id,
                'title' => $n->title,
                'body' => $n->body,
                'type' => $n->type,
                'priority' => $n->priority,
                'audience' => $n->audience,
                'audience_label' => match ($n->audience) {
                    'students' => 'Học sinh',
                    'all' => 'Toàn trường',
                    default => 'Cán bộ / GV',
                },
                'sender_name' => $n->sender_name,
                'created_at' => $n->created_at,
                'is_read' => (bool) $n->is_read,
                'direction' => $out ? 'out' : 'in',
            ];
        });

        return response()->json([
            'data' => [
                'items' => $items,
                'counts' => [
                    'all' => $all,
                    'unread' => $unread,
                    'read' => $read,
                    'sent' => $sent,
                ],
                'page' => $page,
                'pages' => max(1, (int) ceil($total / $per)),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $uid = $this->uid($request);
        $data = $request->validate([
            'title' => 'required|string|min:3|max:255',
            'body' => 'required|string|min:3',
            'type' => 'nullable|string|max:32',
            'audience' => 'nullable|string|max:32',
            'priority' => 'nullable|string|max:16',
        ]);

        $staff = $request->attributes->get('sm_staff') ?? $request->attributes->get('staff');
        $name = is_array($staff) ? ($staff['name'] ?? 'Giáo vụ') : 'Giáo vụ';

        $id = DB::table('sm_notifications')->insertGetId([
            'title' => $data['title'],
            'body' => $data['body'],
            'type' => $data['type'] ?? 'general',
            'priority' => $data['priority'] ?? 'normal',
            'audience' => $data['audience'] ?? 'staff',
            'sender_id' => $uid ?: null,
            'sender_name' => $name,
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Đã gửi thông báo.', 'data' => ['id' => $id]]);
    }

    public function read(Request $request, int $id)
    {
        $uid = $this->uid($request);
        if ($uid <= 0) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }
        DB::table('sm_notification_reads')->updateOrInsert(
            ['notification_id' => $id, 'user_id' => $uid],
            ['read_at' => now()]
        );
        return response()->json(['message' => 'ok']);
    }

    public function readAll(Request $request)
    {
        $uid = $this->uid($request);
        if ($uid <= 0) {
            return response()->json(['message' => 'Chưa đăng nhập'], 401);
        }
        $ids = DB::table('sm_notifications')->pluck('id');
        foreach ($ids as $nid) {
            DB::table('sm_notification_reads')->updateOrInsert(
                ['notification_id' => $nid, 'user_id' => $uid],
                ['read_at' => now()]
            );
        }
        return response()->json(['message' => 'Đã đánh dấu tất cả đã đọc.']);
    }

    public function destroy(Request $request, int $id)
    {
        DB::table('sm_notifications')->where('id', $id)->delete();
        return response()->json(['message' => 'Đã xóa.']);
    }
}
