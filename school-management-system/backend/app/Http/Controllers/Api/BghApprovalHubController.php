<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Rewards\Controllers\AwardController;

/**
 * Hộp phê duyệt thống nhất của Ban Giám hiệu (khớp frontend bghApproval.ts).
 * Gom yêu cầu từ: hồ sơ học sinh, đơn xin nghỉ, khiếu nại hóa đơn, khen thưởng / kỷ luật (module Rewards).
 * Bảng: sm_apv_types, sm_apv_requests, sm_apv_events  (xem database/school_approvals.sql)
 */
class BghApprovalHubController extends Controller
{
    private const RANK = ['principal' => 2, 'hieu_truong' => 2, 'super_admin' => 2, 'bgh' => 2, 'vice_principal' => 1, 'pho_hieu_truong' => 1];
    private const LEVEL = ['vice_principal' => 1, 'principal' => 2];
    private const ROLE_VI = ['principal' => 'Hiệu trưởng', 'hieu_truong' => 'Hiệu trưởng', 'super_admin' => 'Quản trị', 'bgh' => 'Ban Giám hiệu', 'vice_principal' => 'Phó hiệu trưởng', 'pho_hieu_truong' => 'Phó hiệu trưởng'];
    private const FIELD_VI = ['phone' => 'số điện thoại', 'address' => 'địa chỉ', 'birth_place' => 'nơi sinh', 'hometown' => 'quê quán', 'full_name' => 'họ và tên', 'email' => 'email'];

    private const COLS = ['r.id', 'r.code', 'r.type_code', 't.name as type_name', 't.icon', 'r.title', 'r.requester_kind', 'r.requester_name',
        'r.requester_info', 'r.priority', 'r.status', 'r.current_level', 'r.due_at', 'r.created_at', 'r.decided_at', 'r.amount'];

    /* =====================  Nhận diện người dùng  ===================== */

    private function actor(Request $r): object
    {
        $o = $this->viaDemo($r) ?? $this->viaStaffToken($r) ?? $this->viaSanctum($r);
        abort_unless($o, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');

        $rank = 0;
        foreach ($o->roles as $role) {
            $rank = max($rank, self::RANK[$role] ?? 0);
        }
        // Người được ủy quyền còn hiệu lực: làm việc ở cấp của người ủy quyền
        if ($o->staff_id) {
            $roles = DB::table('sm_approval_delegations as d')->join('sm_staff_accounts as s', 's.id', '=', 'd.delegator_id')
                ->where('d.delegate_id', $o->staff_id)->where('d.status', 'active')
                ->whereDate('d.from_date', '<=', now())->whereDate('d.to_date', '>=', now())->pluck('s.role');
            foreach ($roles as $role) {
                $rank = max($rank, 1, self::RANK[strtolower((string) $role)] ?? 0);
            }
        }
        abort_unless($rank > 0, 403, 'Vai trò hiện tại (' . implode(', ', $o->roles ?: ['không xác định']) . ') không có quyền phê duyệt.');
        $o->rank = $rank;
        return $o;
    }

    private function make($id, $staffId, string $name, array $roles): object
    {
        $roles = array_values(array_filter(array_unique($roles)));
        return (object) ['id' => (int) $id, 'staff_id' => $staffId ? (int) $staffId : null, 'full_name' => $name, 'roles' => $roles, 'role' => $roles[0] ?? '', 'rank' => 0];
    }

    private function viaDemo(Request $r): ?object
    {
        if (!app()->environment('local') || $r->bearerToken() !== 'demo-token') {
            return null;
        }
        $row = DB::selectOne("SELECT id, full_name FROM sm_staff_accounts WHERE role = 'principal' ORDER BY id LIMIT 1")
            ?? DB::selectOne('SELECT id, full_name FROM sm_staff_accounts ORDER BY id LIMIT 1');
        return $this->make($row->id ?? 0, $row->id ?? null, $row->full_name ?? 'Hiệu trưởng (demo)', ['principal']);
    }

    private function viaStaffToken(Request $r): ?object
    {
        $tk = $r->bearerToken();
        if (!$tk) {
            return null;
        }
        $row = DB::selectOne('SELECT a.id, a.full_name, a.role FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
            WHERE t.token_hash = ? AND t.expires_at > ? LIMIT 1', [hash('sha256', $tk), now()->toDateTimeString()]);
        return $row ? $this->make($row->id, $row->id, $row->full_name, [strtolower((string) $row->role)]) : null;
    }

    private function viaSanctum(Request $r): ?object
    {
        $tk = $r->bearerToken();
        if (!$tk || !class_exists(\Laravel\Sanctum\PersonalAccessToken::class)) {
            return null;
        }
        $u = \Laravel\Sanctum\PersonalAccessToken::findToken($tk)?->tokenable;
        if (!$u) {
            return null;
        }
        $roles = [];
        if (method_exists($u, 'getRoleNames')) {
            $roles = $u->getRoleNames()->map(fn ($x) => strtolower((string) $x))->all();
        }
        if (is_string($u->role ?? null)) {
            $roles[] = strtolower($u->role);
        }
        $login = $u->username ?? $u->email ?? null;
        $sid = $login ? DB::table('sm_staff_accounts')->where('username', $login)->value('id') : null;
        return $this->make($u->id, $sid, (string) ($u->name ?? $u->email ?? 'Người dùng'), $roles);
    }

    private function sid(object $a): int
    {
        abort_unless($a->staff_id, 422, 'Tài khoản đăng nhập chưa gắn với tài khoản nhân sự nên chưa dùng được ủy quyền.');
        return $a->staff_id;
    }

    /* =====================  Tiện ích truy vấn  ===================== */

    private function base()
    {
        return DB::table('sm_apv_requests as r')->join('sm_apv_types as t', 't.code', '=', 'r.type_code');
    }

    /** Lọc theo tab. todo = việc tôi xử lý được; waiting = đang chờ cấp trên */
    private function scope($q, string $tab, int $rank)
    {
        switch ($tab) {
            case 'todo':
                $q->where('r.status', 'pending');
                if ($rank < 2) {
                    $q->where('r.current_level', 'vice_principal');
                }
                break;
            case 'waiting':
                $q->where('r.status', 'pending');
                $rank < 2 ? $q->where('r.current_level', 'principal') : $q->whereRaw('1 = 0');
                break;
            case 'approved':
            case 'rejected':
            case 'returned':
                $q->where('r.status', $tab);
                break;
        }
        return $q;
    }

    private function shape(object $x): array
    {
        $a = (array) $x;
        $a['id'] = (int) $x->id;
        $a['due_min'] = !empty($x->due_at) ? (int) floor((strtotime($x->due_at) - time()) / 60) : 0;
        $a['amount'] = isset($x->amount) ? (float) $x->amount : null;
        return $a;
    }

    private function perm(object $a, object $x): array
    {
        $can = $x->status === 'pending' && (self::LEVEL[$x->current_level] ?? 2) <= $a->rank;
        $actions = $can ? ['approve', 'reject', 'return'] : [];
        if ($can && $x->current_level === 'vice_principal' && $a->rank === 1) {
            $actions[] = 'forward';
        }
        return [$can, $actions];
    }

    private function event(int $requestId, object $a, string $action, ?string $note): void
    {
        DB::table('sm_apv_events')->insert([
            'request_id' => $requestId, 'actor_type' => $a->role ?: 'staff', 'actor_id' => $a->id, 'actor_name' => $a->full_name,
            'action' => $action, 'note' => $note ?: null, 'created_at' => now()->toDateTimeString(),
        ]);
    }

    /* =====================  Tổng quan + danh sách  ===================== */

    public function overview(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $this->freshen();
        $now = now();

        $c = DB::table('sm_apv_requests')->selectRaw("COUNT(*) AS total,
            COALESCE(SUM(status='approved'),0) AS approved, COALESCE(SUM(status='rejected'),0) AS rejected, COALESCE(SUM(status='returned'),0) AS returned,
            COALESCE(SUM(status='pending' AND (current_level='vice_principal' OR ? >= 2)),0) AS todo,
            COALESCE(SUM(status='pending' AND current_level='principal' AND ? < 2),0) AS waiting,
            COALESCE(SUM(status='pending' AND due_at < ?),0) AS overdue", [$a->rank, $a->rank, $now->toDateTimeString()])->first();

        $since = $now->copy()->subDays(30)->toDateTimeString();
        $d = DB::table('sm_apv_requests')->where('decided_at', '>=', $since)->whereIn('status', ['approved', 'rejected', 'returned'])
            ->selectRaw("COALESCE(SUM(status='approved'),0) AS ok, COALESCE(SUM(status IN ('approved','rejected')),0) AS decided,
                AVG(TIMESTAMPDIFF(MINUTE, created_at, decided_at)) / 60 AS hours")->first();
        $today = DB::table('sm_apv_requests')->where('status', 'approved')->whereDate('decided_at', $now->toDateString())->count();

        $byType = DB::table('sm_apv_types as t')->leftJoin('sm_apv_requests as r', 'r.type_code', '=', 't.code')
            ->selectRaw("t.code, t.name, t.icon, COALESCE(SUM(r.status='pending'),0) AS pending, COUNT(r.id) AS total")
            ->groupBy('t.code', 't.name', 't.icon', 't.sort_order')->orderBy('t.sort_order')->get()
            ->map(fn ($x) => ['code' => $x->code, 'name' => $x->name, 'icon' => $x->icon, 'pending' => (int) $x->pending, 'total' => (int) $x->total]);

        $recent = DB::table('sm_apv_events as e')->join('sm_apv_requests as r', 'r.id', '=', 'e.request_id')
            ->where('e.action', '<>', 'create')->orderByDesc('e.id')->limit(8)
            ->get(['e.id', 'e.action', 'e.actor_name', 'e.note', 'e.created_at', 'e.request_id', 'r.code', 'r.title']);

        $payload = [
            'me' => ['id' => $a->id, 'role' => $a->role, 'name' => $a->full_name],
            'counts' => ['todo' => (int) $c->todo, 'waiting' => (int) $c->waiting, 'approved' => (int) $c->approved, 'rejected' => (int) $c->rejected,
                'returned' => (int) $c->returned, 'total' => (int) $c->total, 'overdue' => (int) $c->overdue],
            'approved_today' => (int) $today,
            'approval_rate' => ((int) $d->decided) > 0 ? round(((int) $d->ok) / ((int) $d->decided) * 100, 1) : null,
            'avg_hours' => $d->hours !== null ? round((float) $d->hours, 1) : null,
            'by_type' => $byType, 'recent' => $recent,
        ];
                return response()->json(['success' => true, 'data' => $payload] + $payload);
            }

            /** Alias cho frontend gọi /stats */
            public function stats(Request $r): JsonResponse
            {
                return $this->overview($r);
            }

            /** Lịch sử xử lý gần đây */
            public function history(Request $r): JsonResponse
            {
                $this->actor($r);
                $rows = DB::table('sm_apv_events as e')
                    ->join('sm_apv_requests as r', 'r.id', '=', 'e.request_id')
                    ->where('e.action', '<>', 'create')
                    ->orderByDesc('e.id')
                    ->limit(50)
                    ->get(['e.id', 'e.action', 'e.actor_name', 'e.note', 'e.created_at', 'e.request_id', 'r.code', 'r.title', 'r.status']);
                return response()->json(['success' => true, 'data' => $rows]);
            }

            public function list(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $this->freshen();

        $q = $this->scope($this->base(), (string) $r->query('tab', 'todo'), $a->rank);
        $type = (string) $r->query('type', '');
        if ($type !== '' && $type !== 'all') {
            $q->where('r.type_code', $type);
        }
        $pri = (string) $r->query('priority', '');
        if (in_array($pri, ['normal', 'high', 'urgent'], true)) {
            $q->where('r.priority', $pri);
        }
        if ($r->boolean('overdue')) {
            $q->where('r.status', 'pending')->where('r.due_at', '<', now()->toDateTimeString());
        }
        $kw = trim((string) $r->query('q', ''));
        if ($kw !== '') {
            $q->where(fn ($w) => $w->where('r.title', 'like', "%$kw%")->orWhere('r.code', 'like', "%$kw%")
                ->orWhere('r.requester_name', 'like', "%$kw%")->orWhere('r.requester_info', 'like', "%$kw%"));
        }

        $per = min(100, max(1, (int) $r->query('per_page', 20)));
        $page = max(1, (int) $r->query('page', 1));
        $total = (clone $q)->count();
        $last = max(1, (int) ceil($total / $per));

        if (in_array($r->query('tab'), ['approved', 'rejected', 'returned'], true)) {
            $q->orderByDesc('r.decided_at')->orderByDesc('r.id');
        } else {
            $q->orderByRaw("(r.status = 'pending') DESC")->orderByRaw("FIELD(r.priority, 'urgent', 'high', 'normal')")
                ->orderBy('r.due_at')->orderByDesc('r.id');
        }
                $rows = $q->forPage($page, $per)->get(self::COLS)->map(fn ($x) => $this->shape($x))->all();

                $counts = [
                    'todo' => (int) DB::table('sm_apv_requests')->where('status', 'pending')
                        ->when($a->rank < 2, fn ($q) => $q->where('current_level', 'vice_principal'))->count(),
                    'waiting' => (int) DB::table('sm_apv_requests')->where('status', 'pending')->where('current_level', 'principal')->count(),
                    'approved' => (int) DB::table('sm_apv_requests')->where('status', 'approved')->count(),
                    'rejected' => (int) DB::table('sm_apv_requests')->where('status', 'rejected')->count(),
                    'returned' => (int) DB::table('sm_apv_requests')->where('status', 'returned')->count(),
                    'total' => (int) DB::table('sm_apv_requests')->count(),
                    'overdue' => (int) DB::table('sm_apv_requests')->where('status', 'pending')->where('due_at', '<', now())->count(),
                ];

                return response()->json([
                    'success' => true,
                    'data' => $rows,
                    'meta' => [
                        'page' => $page,
                        'current_page' => $page,
                        'per_page' => $per,
                        'total' => $total,
                        'last_page' => $last,
                        'counts' => $counts,
                    ],
                    'total' => $total,
                    'page' => $page,
                    'current_page' => $page,
                    'per_page' => $per,
                    'last_page' => $last,
                    'has_more' => $page < $last,
                ]);
            }

    public function show(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $x = $this->base()->where('r.id', $id)->first(array_merge(self::COLS, ['r.description', 'r.payload', 'r.ref_table', 'r.ref_id', 'r.decision_note', 'r.decided_by_name']));
        abort_unless($x, 404, 'Không tìm thấy yêu cầu.');

        $d = $this->shape($x);
        $payload = is_string($x->payload) ? json_decode($x->payload, true) : null;
        $d['payload'] = is_array($payload) ? $payload : [];
        $d['events'] = DB::table('sm_apv_events')->where('request_id', $id)->orderBy('id')->get(['id', 'actor_type', 'actor_name', 'action', 'note', 'created_at']);
        $d['attachments'] = [];
        [$can, $actions] = $this->perm($a, $x);
        $d['can_decide'] = $can;
        $d['actions'] = $actions;

        return response()->json(['success' => true, 'data' => $d]);
    }

    /* =====================  Xử lý yêu cầu  ===================== */

    public function decide(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['action' => 'required|in:approve,reject,return,forward', 'note' => 'nullable|string|max:500']);
        $msg = $this->apply($a, $id, $v['action'], trim((string) ($v['note'] ?? '')));
        return response()->json(['success' => true, 'message' => $msg]);
    }

    public function bulk(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate([
            'ids' => 'required|array|min:1|max:50', 'ids.*' => 'integer',
            'action' => 'required|in:approve,reject', 'note' => 'nullable|string|max:500',
        ]);
        $ok = 0;
        $fail = 0;
        foreach ($v['ids'] as $id) {
            try {
                $this->apply($a, (int) $id, $v['action'], trim((string) ($v['note'] ?? '')));
                $ok++;
            } catch (\Throwable $e) {
                $fail++;
            }
        }
        return response()->json(['success' => true, 'ok' => $ok, 'fail' => $fail,
            'message' => "Đã xử lý $ok yêu cầu" . ($fail ? ", $fail yêu cầu lỗi hoặc đã được xử lý" : '')]);
    }

    public function comment(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate(['note' => 'required|string|min:2|max:500']);
        abort_unless(DB::table('sm_apv_requests')->where('id', $id)->exists(), 404, 'Không tìm thấy yêu cầu.');
        $this->event($id, $a, 'comment', trim($v['note']));
        return response()->json(['success' => true, 'message' => 'Đã ghi chú']);
    }

    private function apply(object $a, int $id, string $action, string $note): string
    {
        $x = DB::table('sm_apv_requests')->where('id', $id)->first();
        abort_unless($x, 404, 'Không tìm thấy yêu cầu.');
        abort_unless($x->status === 'pending', 409, 'Yêu cầu này đã được xử lý.');
        abort_unless((self::LEVEL[$x->current_level] ?? 2) <= $a->rank, 403, 'Yêu cầu này cần cấp cao hơn phê duyệt.');
        if ($action === 'forward') {
            abort_unless($x->current_level === 'vice_principal' && $a->rank === 1, 422, 'Chỉ Phó hiệu trưởng mới chuyển được lên Hiệu trưởng.');
        }
        if (in_array($action, ['reject', 'return'], true) && mb_strlen($note) < 5) {
            abort(422, 'Nhập lý do (tối thiểu 5 ký tự).');
        }
        if ($x->type_code === 'dispute' && $action === 'approve' && mb_strlen($note) < 5) {
            abort(422, 'Nhập nội dung phản hồi khiếu nại (tối thiểu 5 ký tự).');
        }

        return DB::transaction(function () use ($a, $x, $id, $action, $note) {
            $now = now()->toDateTimeString();

            if ($action === 'forward') {
                $sla = (int) (DB::table('sm_apv_types')->where('code', $x->type_code)->value('sla_hours') ?: 48);
                DB::table('sm_apv_requests')->where('id', $id)->update(['current_level' => 'principal', 'due_at' => now()->addHours($sla)->toDateTimeString(), 'updated_at' => $now]);
                $this->event($id, $a, 'forward', $note ?: 'Chuyển lên Hiệu trưởng');
                return 'Đã chuyển lên Hiệu trưởng';
            }

            $status = ['approve' => 'approved', 'reject' => 'rejected', 'return' => 'returned'][$action];
            $studentId = $action === 'return' ? null : $this->applySource($a, $x, $action, $note);

            DB::table('sm_apv_requests')->where('id', $id)->update([
                'status' => $status, 'decided_at' => $now, 'decided_by_name' => $a->full_name,
                'decision_note' => $note ?: null, 'updated_at' => $now,
            ]);
            $this->event($id, $a, $action, $note);

            // Giữ tương thích báo cáo cũ (sm_approval_logs) cho 3 loại đơn của học sinh
            if ($action !== 'return' && in_array($x->type_code, ['profile', 'leave', 'dispute'], true) && Schema::hasTable('sm_approval_logs')) {
                DB::table('sm_approval_logs')->insert([
                    'type' => $x->type_code, 'ref_id' => $x->ref_id, 'student_id' => $studentId, 'action' => $action, 'note' => $note ?: null,
                    'actor_id' => $a->id, 'actor_name' => $a->full_name, 'created_at' => $now,
                ]);
            }
            return ['approved' => 'Đã phê duyệt yêu cầu', 'rejected' => 'Đã từ chối yêu cầu', 'returned' => 'Đã trả lại yêu cầu'][$status];
        });
    }

    /** Áp dụng quyết định vào bảng nguồn. Trả về student_id (nếu có). */
    private function applySource(object $a, object $x, string $action, string $note): ?int
    {
        $now = now()->toDateTimeString();
        $st = $action === 'approve' ? 'approved' : 'rejected';
        $id = (int) $x->ref_id;
        $sid = null;

        switch ($x->ref_table) {
            case 'sm_profile_requests':
                $n = DB::table('sm_profile_requests')->where('id', $id)->where('status', 'pending')
                    ->update(['status' => $st, 'review_note' => $note ?: null, 'reviewed_at' => $now, 'reviewed_by' => $a->full_name]);
                abort_unless($n, 409, 'Yêu cầu nguồn đã được xử lý ở nơi khác.');
                $sid = DB::table('sm_profile_requests')->where('id', $id)->value('student_id');
                break;

            case 'sm_leave_requests':
                $n = DB::table('sm_leave_requests')->where('id', $id)->where('status', 'pending')
                    ->update(['status' => $st, 'reviewer_note' => $note ?: null]);
                abort_unless($n, 409, 'Đơn nghỉ đã được xử lý ở nơi khác.');
                $l = DB::table('sm_leave_requests')->where('id', $id)->first();
                $sid = $l->student_id ?? null;
                if ($action === 'approve' && $l && Schema::hasTable('sm_attendance_records')) {
                    DB::table('sm_attendance_records')->where('student_id', $sid)->whereBetween('att_date', [$l->from_date, $l->to_date])
                        ->where('status', 'absent_unexcused')->update(['status' => 'absent_excused', 'note' => "Đơn xin nghỉ #$id"]);
                }
                break;

            case 'sm_invoice_disputes':
                $n = DB::table('sm_invoice_disputes')->where('id', $id)->where('status', 'open')
                    ->update(['status' => 'answered', 'reply' => $note, 'replied_by' => $a->full_name, 'replied_at' => $now]);
                abort_unless($n, 409, 'Khiếu nại đã được phản hồi ở nơi khác.');
                $sid = DB::table('sm_invoice_disputes')->where('id', $id)->value('student_id');
                break;

            case 'sm_rw_awards':
                // Dùng lại đúng luật của module Khen thưởng (tự cộng điểm thưởng thi đua, thông báo, nhật ký)
                $sub = Request::create('/', 'PATCH', ['decision' => $action, 'note' => $note ?: null]);
                $sub->setUserResolver(fn () => (object) ['id' => $a->id, 'name' => $a->full_name, 'role' => $a->role, 'roles' => $a->roles]);
                $resp = app(AwardController::class)->review($sub, $id);
                if ($resp->getStatusCode() >= 400) {
                    abort($resp->getStatusCode(), (string) (($resp->getData(true)['message'] ?? null) ?: 'Không thể xử lý đề xuất khen thưởng.'));
                }
                break;
        }
        return $sid ? (int) $sid : null;
    }

    /* =====================  Đồng bộ từ các module  ===================== */

    public function sync(Request $r): JsonResponse
    {
        $this->actor($r);
        $n = $this->runSync();
        return response()->json(['success' => true, 'message' => $n ? "Đã đồng bộ $n yêu cầu mới" : 'Dữ liệu đã được cập nhật', 'data' => ['added' => $n]]);
    }

    /** Tự đồng bộ nhẹ (tối đa 1 lần / 20 giây) để trang luôn có dữ liệu mới */
    private function freshen(): void
    {
        try {
            if (!Cache::add('apv_sync_lock', 1, 20)) {
                return;
            }
        } catch (\Throwable $e) {
            // cache lỗi: vẫn đồng bộ
        }
        try {
            $this->runSync();
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function classOf(array $studentIds): array
    {
        if (!$studentIds) {
            return [];
        }
        return DB::table('sm_enrollments as e')->join('sm_classes as c', 'c.id', '=', 'e.class_id')
            ->whereIn('e.student_id', $studentIds)->orderBy('e.school_year_id')->pluck('c.name', 'e.student_id')->all();
    }

    private function row(array $types, string $type, string $prefix, string $refTable, int $refId, string $title, ?string $desc,
                         string $kind, string $name, ?string $info, string $priority, ?string $createdAt, array $payload, ?float $amount = null): array
    {
        $created = $createdAt ?: now()->toDateTimeString();
        $t = $types[$type] ?? null;
        return [
            'code' => $prefix . '-' . str_pad((string) $refId, 5, '0', STR_PAD_LEFT), 'type_code' => $type,
            'title' => mb_substr($title, 0, 200), 'description' => $desc, 'requester_kind' => $kind,
            'requester_name' => mb_substr($name ?: '—', 0, 120), 'requester_info' => $info ? mb_substr($info, 0, 160) : null,
            'priority' => $priority, 'status' => 'pending', 'current_level' => $t->approver_role ?? 'vice_principal',
            'due_at' => Carbon::parse($created)->addHours((int) ($t->sla_hours ?? 48))->toDateTimeString(),
            'amount' => $amount, 'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'ref_table' => $refTable, 'ref_id' => $refId, 'created_at' => $created, 'updated_at' => now()->toDateTimeString(),
        ];
    }

    private function newOnes(string $table, string $alias, string $pendingCol, string $pendingVal)
    {
        return DB::table("$table as $alias")
            ->leftJoin('sm_apv_requests as a', fn ($j) => $j->on('a.ref_id', '=', "$alias.id")->where('a.ref_table', '=', $table))
            ->whereNull('a.id')->where("$alias.$pendingCol", $pendingVal)->limit(300);
    }

    private function runSync(): int
    {
        $types = DB::table('sm_apv_types')->get()->keyBy('code')->all();
        $batch = [];

        // 1) Hồ sơ học sinh
        $rows = $this->newOnes('sm_profile_requests', 'r', 'status', 'pending')->join('sm_students as s', 's.id', '=', 'r.student_id')
            ->get(['r.id', 'r.field_key', 'r.old_value', 'r.new_value', 'r.reason', 'r.created_at', 's.id as sid', 's.full_name', 's.code']);
        $cls = $this->classOf($rows->pluck('sid')->all());
        foreach ($rows as $x) {
            $f = self::FIELD_VI[$x->field_key] ?? $x->field_key;
            $batch[] = $this->row($types, 'profile', 'HS', 'sm_profile_requests', (int) $x->id, 'Đổi ' . $f, $x->reason, 'student', $x->full_name,
                $x->code . (isset($cls[$x->sid]) ? ' · Lớp ' . $cls[$x->sid] : ''), 'normal', $x->created_at, [
                    ['label' => 'Trường thay đổi', 'value' => ucfirst($f)], ['label' => 'Giá trị cũ', 'value' => $x->old_value ?: '—'],
                    ['label' => 'Giá trị mới', 'value' => (string) $x->new_value], ['label' => 'Lý do', 'value' => (string) $x->reason],
                ]);
        }

        // 2) Đơn xin nghỉ
        $rows = $this->newOnes('sm_leave_requests', 'l', 'status', 'pending')->join('sm_students as s', 's.id', '=', 'l.student_id')
            ->get(['l.id', 'l.from_date', 'l.to_date', 'l.reason', 'l.created_at', 's.id as sid', 's.full_name', 's.code']);
        $cls = $this->classOf($rows->pluck('sid')->all());
        foreach ($rows as $x) {
            $from = Carbon::parse($x->from_date);
            $to = Carbon::parse($x->to_date);
            $days = $from->diffInDays($to) + 1;
            $batch[] = $this->row($types, 'leave', 'NP', 'sm_leave_requests', (int) $x->id, 'Xin nghỉ ' . $from->format('d/m') . ' – ' . $to->format('d/m'), $x->reason,
                'student', $x->full_name, $x->code . (isset($cls[$x->sid]) ? ' · Lớp ' . $cls[$x->sid] : ''),
                $from->lte(now()->addDay()) ? 'high' : 'normal', $x->created_at, [
                    ['label' => 'Từ ngày', 'value' => $from->format('d/m/Y')], ['label' => 'Đến ngày', 'value' => $to->format('d/m/Y')],
                    ['label' => 'Số ngày nghỉ', 'value' => (string) $days], ['label' => 'Lý do', 'value' => (string) $x->reason],
                ]);
        }

        // 3) Khiếu nại hóa đơn
        $rows = $this->newOnes('sm_invoice_disputes', 'd', 'status', 'open')->join('sm_students as s', 's.id', '=', 'd.student_id')
            ->get(['d.id', 'd.invoice_id', 'd.message', 'd.created_at', 's.id as sid', 's.full_name', 's.code']);
        $cls = $this->classOf($rows->pluck('sid')->all());
        foreach ($rows as $x) {
            $batch[] = $this->row($types, 'dispute', 'KN', 'sm_invoice_disputes', (int) $x->id, 'Khiếu nại hóa đơn #' . $x->invoice_id, $x->message, 'student', $x->full_name,
                $x->code . (isset($cls[$x->sid]) ? ' · Lớp ' . $cls[$x->sid] : ''), 'high', $x->created_at, [
                    ['label' => 'Hóa đơn', 'value' => '#' . $x->invoice_id], ['label' => 'Nội dung khiếu nại', 'value' => (string) $x->message],
                ]);
        }

        // 4) Khen thưởng / kỷ luật (module Rewards)
        if (Schema::hasTable('sm_rw_awards')) {
            $rows = $this->newOnes('sm_rw_awards', 'w', 'status', 'pending')
                ->leftJoin('sm_classes as c', 'c.id', '=', 'w.class_id')->leftJoin('sm_students as s', 's.id', '=', 'w.student_id')
                ->get(['w.id', 'w.target_type', 'w.kind', 'w.title', 'w.reason', 'w.level', 'w.period_label', 'w.bonus_points', 'w.proposed_by_name', 'w.created_at', 'c.name as class_name', 's.full_name as student_name']);
            foreach ($rows as $x) {
                $isAward = $x->kind === 'khen_thuong';
                $who = $x->target_type === 'class' ? 'Lớp ' . $x->class_name : ($x->student_name . ($x->class_name ? ' · Lớp ' . $x->class_name : ''));
                $payload = [['label' => 'Đối tượng', 'value' => $who], ['label' => 'Hình thức', 'value' => ['khen_thuong' => 'Khen thưởng', 'nhac_nho' => 'Nhắc nhở', 'ky_luat' => 'Kỷ luật'][$x->kind] ?? $x->kind]];
                if ($x->level) {
                    $payload[] = ['label' => 'Cấp', 'value' => $x->level];
                }
                if ($x->period_label) {
                    $payload[] = ['label' => 'Kỳ', 'value' => $x->period_label];
                }
                if ((float) $x->bonus_points > 0) {
                    $payload[] = ['label' => 'Điểm thưởng thi đua', 'value' => '+' . rtrim(rtrim(number_format((float) $x->bonus_points, 1, '.', ''), '0'), '.')];
                }
                $payload[] = ['label' => 'Lý do', 'value' => (string) $x->reason];
                $batch[] = $this->row($types, $isAward ? 'award' : 'discipline', $isAward ? 'KT' : 'KL', 'sm_rw_awards', (int) $x->id, $x->title, $x->reason,
                    'staff', $x->proposed_by_name ?: 'Tổ giám thị', $who, $x->kind === 'ky_luat' ? 'high' : 'normal', $x->created_at, $payload);
            }
        }

        foreach (array_chunk($batch, 100) as $chunk) {
            DB::table('sm_apv_requests')->insertOrIgnore($chunk);
        }

        $this->reconcile();

        // Mốc "đã tạo" cho các yêu cầu chưa có dòng thời gian
        DB::statement("INSERT INTO sm_apv_events (request_id, actor_type, actor_id, actor_name, action, note, created_at)
            SELECT r.id, 'system', NULL, 'Hệ thống', 'create', NULL, r.created_at FROM sm_apv_requests r
            WHERE NOT EXISTS (SELECT 1 FROM sm_apv_events e WHERE e.request_id = r.id)");

        return count($batch);
    }

    /** Nếu yêu cầu đã được xử lý ở màn hình cũ, đưa trạng thái về đúng */
    private function reconcile(): void
    {
        $n = now()->toDateTimeString();
        DB::update("UPDATE sm_apv_requests a JOIN sm_profile_requests r ON a.ref_table = 'sm_profile_requests' AND a.ref_id = r.id
            SET a.status = r.status, a.decided_at = COALESCE(r.reviewed_at, ?), a.decided_by_name = r.reviewed_by, a.decision_note = r.review_note, a.updated_at = ?
            WHERE a.status = 'pending' AND r.status IN ('approved','rejected')", [$n, $n]);
        DB::update("UPDATE sm_apv_requests a JOIN sm_leave_requests l ON a.ref_table = 'sm_leave_requests' AND a.ref_id = l.id
            SET a.status = l.status, a.decided_at = ?, a.decision_note = l.reviewer_note, a.updated_at = ?
            WHERE a.status = 'pending' AND l.status IN ('approved','rejected')", [$n, $n]);
        DB::update("UPDATE sm_apv_requests a JOIN sm_invoice_disputes d ON a.ref_table = 'sm_invoice_disputes' AND a.ref_id = d.id
            SET a.status = 'approved', a.decided_at = COALESCE(d.replied_at, ?), a.decided_by_name = d.replied_by, a.decision_note = d.reply, a.updated_at = ?
            WHERE a.status = 'pending' AND d.status <> 'open'", [$n, $n]);
        if (Schema::hasTable('sm_rw_awards')) {
            DB::update("UPDATE sm_apv_requests a JOIN sm_rw_awards w ON a.ref_table = 'sm_rw_awards' AND a.ref_id = w.id
                SET a.status = w.status, a.decided_at = COALESCE(w.reviewed_at, ?), a.decided_by_name = w.reviewed_by_name, a.decision_note = w.review_note, a.updated_at = ?
                WHERE a.status = 'pending' AND w.status IN ('approved','rejected')", [$n, $n]);
        }
    }

    /* =====================  Mẫu ghi chú, loại phê duyệt  ===================== */

    public function templates(Request $r): JsonResponse
    {
        $this->actor($r);
        $list = [
            ['id' => 1, 'action' => 'approve', 'title' => 'Đồng ý', 'content' => 'Đồng ý phê duyệt.'],
            ['id' => 2, 'action' => 'approve', 'title' => 'Đồng ý, theo dõi', 'content' => 'Đồng ý. Giáo viên chủ nhiệm theo dõi và báo cáo lại nhà trường.'],
            ['id' => 3, 'action' => 'reject', 'title' => 'Chưa đủ căn cứ', 'content' => 'Chưa đủ căn cứ để phê duyệt, đề nghị bổ sung minh chứng.'],
            ['id' => 4, 'action' => 'reject', 'title' => 'Không đúng quy định', 'content' => 'Nội dung đề xuất chưa đúng quy định hiện hành của nhà trường.'],
            ['id' => 5, 'action' => 'return', 'title' => 'Bổ sung hồ sơ', 'content' => 'Đề nghị bổ sung hồ sơ, minh chứng liên quan rồi gửi lại.'],
            ['id' => 6, 'action' => 'return', 'title' => 'Làm rõ nội dung', 'content' => 'Đề nghị làm rõ nội dung đề xuất rồi gửi lại để xem xét.'],
        ];
        $list = array_map(fn ($t) => $t + ['label' => $t['title'], 'name' => $t['title'], 'text' => $t['content'], 'body' => $t['content'], 'note' => $t['content']], $list);
        return response()->json(['success' => true, 'data' => $list]);
    }

    public function types(Request $r): JsonResponse
    {
        $this->actor($r);
        $rows = DB::table('sm_apv_types as t')->leftJoin('sm_apv_requests as r', 'r.type_code', '=', 't.code')
            ->selectRaw("t.code, t.name, t.description, t.icon, t.sla_hours, t.approver_role, t.is_active, COALESCE(SUM(r.status='pending'),0) AS pending, COUNT(r.id) AS total")
            ->groupBy('t.code', 't.name', 't.description', 't.icon', 't.sla_hours', 't.approver_role', 't.is_active', 't.sort_order')
            ->orderBy('t.sort_order')->get()
            ->map(fn ($x) => (array) $x + []);
        $rows = $rows->map(function ($x) {
            $x['sla_hours'] = (int) $x['sla_hours'];
            $x['is_active'] = (int) $x['is_active'];
            $x['pending'] = (int) $x['pending'];
            $x['total'] = (int) $x['total'];
            return $x;
        });
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function updateType(Request $r, string $code): JsonResponse
    {
        $a = $this->actor($r);
        abort_unless($a->rank >= 2, 403, 'Chỉ Hiệu trưởng mới được chỉnh loại phê duyệt.');
        $v = $r->validate(['sla_hours' => 'nullable|integer|min:1|max:720', 'approver_role' => 'nullable|in:vice_principal,principal', 'is_active' => 'nullable|boolean']);
        $upd = [];
        foreach (['sla_hours', 'approver_role'] as $k) {
            if (isset($v[$k])) {
                $upd[$k] = $v[$k];
            }
        }
        if (array_key_exists('is_active', $v)) {
            $upd['is_active'] = $v['is_active'] ? 1 : 0;
        }
        abort_unless($upd && DB::table('sm_apv_types')->where('code', $code)->exists(), 404, 'Không tìm thấy loại phê duyệt.');
        DB::table('sm_apv_types')->where('code', $code)->update($upd);
        return response()->json(['success' => true, 'message' => 'Đã cập nhật loại phê duyệt']);
    }

    /* =====================  Ủy quyền  ===================== */

    public function delegations(Request $r): JsonResponse
    {
        $this->actor($r);
        $today = now()->toDateString();
        $rows = DB::table('sm_approval_delegations as d')
            ->join('sm_staff_accounts as f', 'f.id', '=', 'd.delegator_id')->join('sm_staff_accounts as t', 't.id', '=', 'd.delegate_id')
            ->orderByDesc('d.id')->limit(50)
            ->get(['d.id', 'd.from_date', 'd.to_date', 'd.note as reason', 'd.status', 'f.full_name as from_name', 't.full_name as to_name'])
            ->map(function ($x) use ($today) {
                $active = $x->status === 'active';
                return ['id' => (int) $x->id, 'from_date' => $x->from_date, 'to_date' => $x->to_date, 'reason' => $x->reason,
                    'is_active' => $active ? 1 : 0, 'from_name' => $x->from_name, 'to_name' => $x->to_name,
                    'running' => ($active && $x->from_date <= $today && $x->to_date >= $today) ? 1 : 0];
            });
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function staff(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $rows = DB::table('sm_staff_accounts')->whereNotIn(DB::raw("COALESCE(status,'')"), ['locked', 'disabled', 'inactive', 'blocked'])
            ->when($a->staff_id, fn ($q) => $q->where('id', '<>', $a->staff_id))->orderBy('full_name')->limit(200)
            ->get(['id', 'full_name', 'role'])
            ->map(fn ($x) => ['id' => (int) $x->id, 'full_name' => $x->full_name, 'name' => $x->full_name, 'role' => $x->role, 'role_name' => self::ROLE_VI[strtolower((string) $x->role)] ?? $x->role]);
        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function createDelegation(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate([
            'to_staff_id' => 'required|integer|exists:sm_staff_accounts,id', 'from_date' => 'required|date|after_or_equal:today',
            'to_date' => 'required|date|after_or_equal:from_date', 'reason' => 'nullable|string|max:255',
        ]);
        $me = $this->sid($a);
        abort_if((int) $v['to_staff_id'] === $me, 422, 'Không thể tự ủy quyền cho chính mình.');
        abort_if((strtotime($v['to_date']) - strtotime($v['from_date'])) / 86400 > 90, 422, 'Thời hạn ủy quyền tối đa 90 ngày.');
        $dup = DB::table('sm_approval_delegations')->where('delegator_id', $me)->where('delegate_id', $v['to_staff_id'])->where('status', 'active')
            ->where('from_date', '<=', $v['to_date'])->where('to_date', '>=', $v['from_date'])->exists();
        abort_if($dup, 409, 'Đã có ủy quyền còn hiệu lực trùng thời gian cho người này.');
        $id = DB::table('sm_approval_delegations')->insertGetId([
            'delegator_id' => $me, 'delegate_id' => $v['to_staff_id'], 'from_date' => $v['from_date'], 'to_date' => $v['to_date'], 'note' => $v['reason'] ?? null,
        ]);
        return response()->json(['success' => true, 'data' => ['id' => $id], 'message' => 'Đã ủy quyền phê duyệt'], 201);
    }

    public function revokeDelegation(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $q = DB::table('sm_approval_delegations')->where('id', $id)->where('status', 'active');
        if ($a->rank < 2) {
            $q->where('delegator_id', $this->sid($a));
        }
        abort_unless($q->update(['status' => 'revoked', 'revoked_at' => now()->toDateTimeString()]), 404, 'Không tìm thấy ủy quyền còn hiệu lực.');
        return response()->json(['success' => true, 'message' => 'Đã thu hồi ủy quyền']);
    }

    /* =====================  Báo cáo + xuất CSV  ===================== */

    private function range(Request $r): array
    {
        $ok = fn ($d) => is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d);
        $from = $ok($r->query('from')) ? $r->query('from') : now()->subDays(29)->toDateString();
        $to = $ok($r->query('to')) ? $r->query('to') : now()->toDateString();
        return [$from, $to, "$from 00:00:00", "$to 23:59:59"];
    }

    public function report(Request $r): JsonResponse
    {
        $this->actor($r);
        [$from, $to, $f, $t] = $this->range($r);

        $s = DB::table('sm_apv_requests')->whereBetween('created_at', [$f, $t])->selectRaw("COUNT(*) AS total,
            COALESCE(SUM(status='approved'),0) AS approved, COALESCE(SUM(status='rejected'),0) AS rejected, COALESCE(SUM(status='pending'),0) AS pending,
            COALESCE(SUM(status='pending' AND due_at < ?),0) AS overdue, COALESCE(SUM(CASE WHEN status='approved' THEN amount END),0) AS approved_amount",
            [now()->toDateTimeString()])->first();

        $byType = DB::select("SELECT t.name, COUNT(r.id) AS total, COALESCE(SUM(r.status='approved'),0) AS approved, COALESCE(SUM(r.status='rejected'),0) AS rejected,
                COALESCE(SUM(r.status='returned'),0) AS returned, COALESCE(SUM(r.status='pending'),0) AS pending,
                ROUND(AVG(CASE WHEN r.decided_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, r.created_at, r.decided_at) END) / 60, 1) AS avg_hours
            FROM sm_apv_types t LEFT JOIN sm_apv_requests r ON r.type_code = t.code AND r.created_at BETWEEN ? AND ?
            GROUP BY t.code, t.name, t.sort_order ORDER BY t.sort_order", [$f, $t]);

        $byApprover = DB::select("SELECT actor_name AS name, actor_type AS role, COUNT(*) AS decided, SUM(action='approve') AS approved,
                SUM(action='reject') AS rejected, SUM(action='return') AS returned
            FROM sm_apv_events WHERE action IN ('approve','reject','return') AND created_at BETWEEN ? AND ?
            GROUP BY actor_name, actor_type ORDER BY decided DESC LIMIT 10", [$f, $t]);

        $trend = DB::select("SELECT DATE_FORMAT(created_at, '%Y-%m') AS m, COUNT(*) AS total, SUM(status='approved') AS approved, SUM(status='rejected') AS rejected
            FROM sm_apv_requests WHERE created_at BETWEEN ? AND ? GROUP BY m ORDER BY m", [$f, $t]);

        $num = fn ($o, array $keys) => collect($keys)->mapWithKeys(fn ($k) => [$k => (int) ($o->$k ?? 0)])->all();
        $data = [
            'from' => $from, 'to' => $to,
            'summary' => $num($s, ['total', 'approved', 'rejected', 'pending', 'overdue']) + ['approved_amount' => (float) $s->approved_amount],
            'by_type' => array_map(fn ($x) => ['name' => $x->name, 'avg_hours' => $x->avg_hours !== null ? (float) $x->avg_hours : null] + $num($x, ['total', 'approved', 'rejected', 'returned', 'pending']), $byType),
            'by_approver' => array_map(fn ($x) => ['name' => $x->name, 'role' => self::ROLE_VI[$x->role] ?? $x->role, 'decided' => (int) $x->decided,
                'approved' => (int) $x->approved, 'rejected' => (int) $x->rejected, 'returned' => (int) $x->returned], $byApprover),
            'trend' => array_map(fn ($x) => ['m' => $x->m, 'total' => (int) $x->total, 'approved' => (int) $x->approved, 'rejected' => (int) $x->rejected], $trend),
        ];
        return response()->json(['success' => true, 'data' => $data] + $data);
    }

    public function export(Request $r): Response
    {
        $this->actor($r);
        [$from, $to, $f, $t] = $this->range($r);
        $rows = $this->base()->whereBetween('r.created_at', [$f, $t])->orderBy('r.id')
            ->get(['r.code', 't.name as type_name', 'r.title', 'r.requester_name', 'r.requester_info', 'r.priority', 'r.status', 'r.current_level',
                'r.due_at', 'r.created_at', 'r.decided_at', 'r.decided_by_name', 'r.decision_note']);

        $pri = ['normal' => 'Thường', 'high' => 'Ưu tiên', 'urgent' => 'Khẩn'];
        $st = ['pending' => 'Chờ duyệt', 'approved' => 'Đã duyệt', 'rejected' => 'Từ chối', 'returned' => 'Trả lại', 'cancelled' => 'Đã hủy'];
        $lv = ['vice_principal' => 'Phó hiệu trưởng', 'principal' => 'Hiệu trưởng'];

        $h = fopen('php://temp', 'r+');
        fwrite($h, "\xEF\xBB\xBF");
        fputcsv($h, ['Mã', 'Loại', 'Tiêu đề', 'Người gửi', 'Thông tin', 'Mức độ', 'Trạng thái', 'Cấp xử lý', 'Hạn xử lý', 'Ngày gửi', 'Ngày xử lý', 'Người xử lý', 'Ghi chú']);
        foreach ($rows as $x) {
            fputcsv($h, [$x->code, $x->type_name, $x->title, $x->requester_name, $x->requester_info, $pri[$x->priority] ?? $x->priority, $st[$x->status] ?? $x->status,
                $lv[$x->current_level] ?? $x->current_level, $x->due_at, $x->created_at, $x->decided_at, $x->decided_by_name, $x->decision_note]);
        }
        rewind($h);
        $csv = stream_get_contents($h);
        fclose($h);

        return response($csv, 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => "attachment; filename=\"phe-duyet-$from-$to.csv\""]);
    }
}
