<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Phê duyệt của Ban giám hiệu: hồ sơ HS, đơn xin nghỉ, khiếu nại hóa đơn. */
class BghApprovalController extends Controller
{
    private const ROLES = ['principal', 'vice_principal', 'super_admin', 'bgh', 'hieu_truong', 'pho_hieu_truong'];

    private const UNION = "
      SELECT 'profile' AS type, r.id, r.student_id, s.full_name AS student_name, s.code AS student_code,
             CONCAT('Đổi ', CASE r.field_key WHEN 'phone' THEN 'số điện thoại' WHEN 'address' THEN 'địa chỉ' WHEN 'birth_place' THEN 'nơi sinh' WHEN 'hometown' THEN 'quê quán' WHEN 'full_name' THEN 'họ và tên' WHEN 'email' THEN 'email' ELSE r.field_key END) AS title,
             CONCAT(COALESCE(r.old_value,'—'),' → ',r.new_value,' · ',r.reason) AS detail,
             r.status, r.review_note AS note, r.created_at
        FROM sm_profile_requests r JOIN sm_students s ON s.id = r.student_id
      UNION ALL
      SELECT 'leave', l.id, l.student_id, s.full_name, s.code,
             CONCAT('Xin nghỉ ', DATE_FORMAT(l.from_date,'%d/%m'), ' – ', DATE_FORMAT(l.to_date,'%d/%m')),
             l.reason, l.status, l.reviewer_note, l.created_at
        FROM sm_leave_requests l JOIN sm_students s ON s.id = l.student_id
      UNION ALL
      SELECT 'dispute', d.id, d.student_id, s.full_name, s.code,
             CONCAT('Khiếu nại hóa đơn #', d.invoice_id), d.message,
             IF(d.status='open','pending','approved'), d.reply, d.created_at
        FROM sm_invoice_disputes d JOIN sm_students s ON s.id = d.student_id";

    /** Nhận diện người dùng: middleware có sẵn → token nhân sự (sm_staff_tokens) → token Sanctum. */
    private function actor(Request $r): object
    {
        $pre = $r->attributes->get('staff') ?? $r->attributes->get('sm_staff');
        if ($pre) {
            $p = (array) $pre;
            $o = $this->make($p['id'] ?? 0, $p['id'] ?? null, $p['full_name'] ?? $p['name'] ?? 'Nhân viên', [strtolower((string) ($p['role'] ?? ''))]);
        } else {
            $o = $this->viaDemo($r) ?? $this->viaStaffToken($r) ?? $this->viaSanctum($r);
        }
        abort_unless($o, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn');

        $ok = count(array_intersect($o->roles, self::ROLES)) > 0;
        if (!$ok && $o->staff_id) { // người được ủy quyền còn hiệu lực cũng được phép
            $ok = DB::table('sm_approval_delegations')->where('delegate_id', $o->staff_id)->where('status', 'active')
                ->whereDate('from_date', '<=', now())->whereDate('to_date', '>=', now())->exists();
        }
        abort_unless($ok, 403, 'Vai trò hiện tại (' . implode(', ', $o->roles ?: ['không xác định']) . ') không có quyền phê duyệt.');
        return $o;
    }

    private function make($id, $staffId, string $name, array $roles): object
    {
        return (object) ['id' => (int) $id, 'staff_id' => $staffId ? (int) $staffId : null, 'full_name' => $name,
            'roles' => array_values(array_filter(array_unique($roles))), 'role' => $roles[0] ?? ''];
    }

    /** Cổng demo (cùng quy ước với MonitorAccess): CHỈ khi APP_ENV=local, 'demo-token' được coi là Hiệu trưởng. */
    private function viaDemo(Request $r): ?object
    {
        if (!app()->environment('local') || $r->bearerToken() !== 'demo-token') return null;
        $row = DB::selectOne("SELECT id, full_name FROM sm_staff_accounts WHERE role = 'principal' ORDER BY id LIMIT 1")
            ?? DB::selectOne('SELECT id, full_name FROM sm_staff_accounts ORDER BY id LIMIT 1');
        return $this->make($row->id ?? 0, $row->id ?? null, $row->full_name ?? 'Hiệu trưởng (demo)', ['principal']);
    }

    private function viaStaffToken(Request $r): ?object
    {
        $tk = $r->bearerToken();
        if (!$tk) return null;
        $row = DB::selectOne('SELECT a.id, a.full_name, a.role FROM sm_staff_tokens t JOIN sm_staff_accounts a ON a.id = t.staff_id
            WHERE t.token_hash = ? AND t.expires_at > NOW() LIMIT 1', [hash('sha256', $tk)]);
        return $row ? $this->make($row->id, $row->id, $row->full_name, [strtolower((string) $row->role)]) : null;
    }

    private function viaSanctum(Request $r): ?object
    {
        $tk = $r->bearerToken();
        if (!$tk || !class_exists(\Laravel\Sanctum\PersonalAccessToken::class)) return null;
        $u = \Laravel\Sanctum\PersonalAccessToken::findToken($tk)?->tokenable;
        if (!$u) return null;
        $roles = [];
        if (method_exists($u, 'getRoleNames')) $roles = $u->getRoleNames()->map(fn ($x) => strtolower((string) $x))->all();
        if (is_string($u->role ?? null)) $roles[] = strtolower($u->role);
        $login = $u->username ?? $u->email ?? null;
        $sid = $login ? DB::table('sm_staff_accounts')->where('username', $login)->value('id') : null;
        return $this->make($u->id, $sid, (string) ($u->name ?? $u->email ?? 'Người dùng'), $roles);
    }

    /** Ủy quyền cần tài khoản nhân sự (sm_staff_accounts). */
    private function sid(object $a): int
    {
        abort_unless($a->staff_id, 422, 'Tài khoản đăng nhập chưa gắn với tài khoản nhân sự nên chưa dùng được ủy quyền.');
        return $a->staff_id;
    }

    public function index(Request $r): JsonResponse
    {
        $this->actor($r);
        $status = $r->query('status', 'pending');
        $type = $r->query('type', 'all');
        $q = trim((string) $r->query('q', ''));
        $page = max(1, (int) $r->query('page', 1));
        $rows = DB::select('SELECT * FROM (' . self::UNION . ') x
            WHERE (? = "all" OR status = ?) AND (? = "all" OR type = ?)
              AND (? = "" OR student_name LIKE ? OR student_code LIKE ?)
            ORDER BY (status = "pending") DESC, created_at DESC LIMIT 31 OFFSET ?',
            [$status, $status, $type, $type, $q, "%$q%", "%$q%", ($page - 1) * 30]);
        $more = count($rows) > 30;
        return response()->json(['data' => array_slice($rows, 0, 30), 'has_more' => $more]);
    }

    public function stats(Request $r): JsonResponse
    {
        $this->actor($r);
        $pending = DB::select('SELECT type, COUNT(*) c FROM (' . self::UNION . ') x WHERE status="pending" GROUP BY type');
        $today = DB::select('SELECT action, COUNT(*) c FROM sm_approval_logs WHERE DATE(created_at)=CURDATE() GROUP BY action');
        $map = ['profile' => 0, 'leave' => 0, 'dispute' => 0];
        foreach ($pending as $p) $map[$p->type] = (int) $p->c;
        $t = ['approve' => 0, 'reject' => 0];
        foreach ($today as $x) $t[$x->action] = (int) $x->c;
        return response()->json(['data' => ['pending' => $map, 'approved_today' => $t['approve'], 'rejected_today' => $t['reject']]]);
    }

    public function history(Request $r): JsonResponse
    {
        $this->actor($r);
        return response()->json(['data' => DB::select('SELECT l.id, l.type, l.ref_id, l.action, l.note, l.actor_name, l.created_at, s.full_name AS student_name
            FROM sm_approval_logs l LEFT JOIN sm_students s ON s.id = l.student_id ORDER BY l.id DESC LIMIT 50')]);
    }

    public function delegations(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $sel = "SELECT d.id, d.from_date, d.to_date, d.note, s.full_name AS other_name, s.role AS other_role,
                IF(d.status='revoked','revoked',IF(CURDATE()<d.from_date,'scheduled',IF(CURDATE()>d.to_date,'expired','active'))) AS state
                FROM sm_approval_delegations d JOIN sm_staff_accounts s ON s.id = d.%s WHERE d.%s = ? ORDER BY d.id DESC LIMIT 30";
        return response()->json(['data' => [
            'given' => DB::select(sprintf($sel, 'delegate_id', 'delegator_id'), [$this->sid($a)]),
            'received' => DB::select(sprintf($sel, 'delegator_id', 'delegate_id'), [$this->sid($a)]),
            'staff' => DB::select("SELECT id, full_name, role FROM sm_staff_accounts
                WHERE id <> ? AND COALESCE(status,'') NOT IN ('locked','disabled','inactive','blocked') ORDER BY full_name LIMIT 200", [$this->sid($a)]),
        ]]);
    }

    public function storeDelegation(Request $r): JsonResponse
    {
        $a = $this->actor($r);
        $v = $r->validate([
            'delegate_id' => 'required|integer|exists:sm_staff_accounts,id',
            'from_date' => 'required|date|after_or_equal:today',
            'to_date' => 'required|date|after_or_equal:from_date',
            'note' => 'nullable|string|max:255',
        ] , [], []);
        abort_if((int) $v['delegate_id'] === $this->sid($a), 422, 'Không thể tự ủy quyền cho chính mình.');
        abort_if((strtotime($v['to_date']) - strtotime($v['from_date'])) / 86400 > 90, 422, 'Thời hạn ủy quyền tối đa 90 ngày.');
        $dup = DB::table('sm_approval_delegations')->where('delegator_id', $this->sid($a))->where('delegate_id', $v['delegate_id'])
            ->where('status', 'active')->where('from_date', '<=', $v['to_date'])->where('to_date', '>=', $v['from_date'])->exists();
        abort_if($dup, 409, 'Đã có ủy quyền còn hiệu lực trùng thời gian cho người này.');
        $id = DB::table('sm_approval_delegations')->insertGetId([
            'delegator_id' => $this->sid($a), 'delegate_id' => $v['delegate_id'], 'from_date' => $v['from_date'],
            'to_date' => $v['to_date'], 'note' => $v['note'] ?? null,
        ]);
        return response()->json(['data' => ['id' => $id], 'message' => 'Đã ủy quyền phê duyệt'], 201);
    }

    public function revokeDelegation(Request $r, int $id): JsonResponse
    {
        $a = $this->actor($r);
        $n = DB::table('sm_approval_delegations')->where('id', $id)->where('delegator_id', $this->sid($a))->where('status', 'active')
            ->update(['status' => 'revoked', 'revoked_at' => now()]);
        abort_unless($n, 404, 'Không tìm thấy ủy quyền còn hiệu lực.');
        return response()->json(['message' => 'Đã thu hồi ủy quyền']);
    }

    public function report(Request $r): JsonResponse
    {
        $this->actor($r);
        $days = in_array((int) $r->query('days', 30), [7, 30, 90], true) ? (int) $r->query('days', 30) : 30;
        $from = now()->subDays($days - 1)->toDateString();
        return response()->json(['data' => [
            'days' => $days,
            'daily' => DB::select("SELECT DATE(created_at) AS d, SUM(action='approve') AS ok, SUM(action='reject') AS bad
                FROM sm_approval_logs WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY d", [$from]),
            'by_type' => DB::select("SELECT type, SUM(action='approve') AS ok, SUM(action='reject') AS bad
                FROM sm_approval_logs WHERE created_at >= ? GROUP BY type", [$from]),
            'top' => DB::select("SELECT actor_name, COUNT(*) AS c FROM sm_approval_logs WHERE created_at >= ?
                GROUP BY actor_name ORDER BY c DESC LIMIT 5", [$from]),
            'avg_hours' => DB::selectOne("SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, COALESCE(p.created_at, lv.created_at, d.created_at), l.created_at)) / 60, 1) AS h
                FROM sm_approval_logs l
                LEFT JOIN sm_profile_requests p ON l.type='profile' AND p.id = l.ref_id
                LEFT JOIN sm_leave_requests lv ON l.type='leave' AND lv.id = l.ref_id
                LEFT JOIN sm_invoice_disputes d ON l.type='dispute' AND d.id = l.ref_id
                WHERE l.created_at >= ?", [$from])->h ?? null,
        ]]);
    }

    public function decide(Request $r, string $type, int $id): JsonResponse
    {
        $actor = $this->actor($r);
        $v = $r->validate(['action' => 'required|in:approve,reject', 'note' => 'nullable|string|max:500']);
        $msg = $this->apply($actor, $type, $id, $v['action'], trim($v['note'] ?? ''));
        return response()->json(['message' => $msg]);
    }

    public function bulk(Request $r): JsonResponse
    {
        $actor = $this->actor($r);
        $v = $r->validate([
            'items' => 'required|array|min:1|max:50', 'items.*.type' => 'required|in:profile,leave', 'items.*.id' => 'required|integer',
            'action' => 'required|in:approve,reject', 'note' => 'nullable|string|max:500',
        ]);
        $ok = 0; $fail = 0;
        foreach ($v['items'] as $it) {
            try { $this->apply($actor, $it['type'], (int) $it['id'], $v['action'], trim($v['note'] ?? '')); $ok++; }
            catch (\Throwable $e) { $fail++; }
        }
        return response()->json(['message' => "Đã xử lý $ok đơn" . ($fail ? ", $fail đơn lỗi hoặc đã được xử lý" : '')]);
    }

    private function apply(object $actor, string $type, int $id, string $action, string $note): string
    {
        abort_unless(in_array($type, ['profile', 'leave', 'dispute'], true), 404);
        if (($action === 'reject' || $type === 'dispute') && mb_strlen($note) < 5) {
            abort(422, $type === 'dispute' ? 'Nhập nội dung phản hồi (tối thiểu 5 ký tự).' : 'Nhập lý do từ chối (tối thiểu 5 ký tự).');
        }
        $st = $action === 'approve' ? 'approved' : 'rejected';

        return DB::transaction(function () use ($actor, $type, $id, $action, $note, $st) {
            $now = now();
            if ($type === 'profile') {
                $n = DB::table('sm_profile_requests')->where('id', $id)->where('status', 'pending')
                    ->update(['status' => $st, 'review_note' => $note ?: null, 'reviewed_at' => $now, 'reviewed_by' => $actor->full_name]);
                $sid = DB::table('sm_profile_requests')->where('id', $id)->value('student_id');
                $msg = 'Đã ' . ($action === 'approve' ? 'duyệt' : 'từ chối') . ' yêu cầu chỉnh sửa hồ sơ';
            } elseif ($type === 'leave') {
                $n = DB::table('sm_leave_requests')->where('id', $id)->where('status', 'pending')
                    ->update(['status' => $st, 'reviewer_note' => $note ?: null]);
                $l = DB::table('sm_leave_requests')->where('id', $id)->first();
                $sid = $l->student_id ?? null;
                $msg = 'Đã ' . ($action === 'approve' ? 'duyệt' : 'từ chối') . ' đơn xin nghỉ';
                if ($n && $action === 'approve' && Schema::hasTable('sm_attendance_records')) { // liên kết chuyên cần: vắng không phép → có phép
                    $c = DB::table('sm_attendance_records')->where('student_id', $sid)->whereBetween('att_date', [$l->from_date, $l->to_date])
                        ->where('status', 'absent_unexcused')->update(['status' => 'absent_excused', 'note' => "Đơn xin nghỉ #$id"]);
                    if ($c) $msg .= ", chuyển $c tiết vắng thành có phép";
                }
            } else {
                $n = DB::table('sm_invoice_disputes')->where('id', $id)->where('status', 'open')
                    ->update(['status' => 'answered', 'reply' => $note, 'replied_by' => $actor->full_name, 'replied_at' => $now]);
                $sid = DB::table('sm_invoice_disputes')->where('id', $id)->value('student_id');
                $msg = 'Đã phản hồi khiếu nại hóa đơn';
            }
            abort_unless($n, 409, 'Yêu cầu này đã được xử lý hoặc không tồn tại.');
            DB::table('sm_approval_logs')->insert([
                'type' => $type, 'ref_id' => $id, 'student_id' => $sid, 'action' => $action, 'note' => $note ?: null,
                'actor_id' => $actor->id, 'actor_name' => $actor->full_name, 'created_at' => $now,
            ]);
            return $msg;
        });
    }
}
