<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /** User đang đăng nhập (Sanctum hoặc StudentToken) */
    protected function userId(Request $request): int
    {
        // StudentToken gắn account HS vào đây
        $acc = $request->attributes->get('sm_account');
        if (is_array($acc) && !empty($acc['id'])) {
            return (int) $acc['id'];
        }

        // Fallback Sanctum (nếu có)
        $user = $request->user();
        if ($user) {
            return (int) $user->id;
        }

        if ($request->attributes->has('user_id')) {
            return (int) $request->attributes->get('user_id');
        }

        abort(401, 'Unauthenticated');
    }

    /** Badge theo từng module (menu) */
    public function badges(Request $request)
    {
        $uid = $this->userId($request);

        $rows = Notification::where('user_id', $uid)
            ->where('is_read', false)
            ->selectRaw('type, COUNT(*) as cnt')
            ->groupBy('type')
            ->pluck('cnt', 'type');

        $total = (int) $rows->sum();

        return response()->json([
            'success' => true,
            'total'   => $total,
            'badge'   => $total > 9 ? '9+' : (string) $total,
            'by_type' => $rows,
        ]);
    }

    /** Số chưa đọc */
    public function unreadCount(Request $request)
    {
        $count = Notification::where('user_id', $this->userId($request))
            ->where('is_read', false)
            ->count();

        return response()->json([
            'success' => true,
            'count'   => $count,
            'badge'   => $count > 9 ? '9+' : (string) $count,
        ]);
    }

    /** Danh sách */
    public function index(Request $request)
    {
        $items = Notification::where('user_id', $this->userId($request))
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $items,
        ]);
    }

    /** Đánh dấu đã đọc theo module/type */
    public function readModule(Request $request)
    {
        $request->validate([
            'type' => 'required|string|max:50',
        ]);

        Notification::where('user_id', $this->userId($request))
            ->where('type', $request->type)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json(['success' => true]);
    }

    /** Đọc tất cả */
    public function readAll(Request $request)
    {
        Notification::where('user_id', $this->userId($request))
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json(['success' => true]);
    }

    /** Đọc 1 tin */
    public function markRead(Request $request, int $id)
    {
        $n = Notification::where('user_id', $this->userId($request))
            ->where('id', $id)
            ->firstOrFail();

        if (!$n->is_read) {
            $n->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }
}
