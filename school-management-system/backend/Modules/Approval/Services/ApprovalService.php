<?php

namespace Modules\Approval\Services;

use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Quy trình phê duyệt của Ban giám hiệu.
 * Quy tắc: Hiệu trưởng (và quản trị) duyệt mọi yêu cầu; Phó hiệu trưởng duyệt yêu cầu cấp "vice_principal",
 * hoặc cả cấp Hiệu trưởng khi đang được ủy quyền. Mọi thời điểm dùng NOW() của MySQL để thống nhất múi giờ.
 */
class ApprovalService
{
    private function isTop(array $me): bool
    {
        return in_array($me['role'], ['principal', 'super_admin'], true);
    }

    /** [điều kiện SQL, tham số] cho "người này được phép duyệt" (bảng bí danh r) */
    private function canSql(array $me): array
    {
        if ($this->isTop($me)) return ['1 = 1', []];
        return ["(r.current_level = 'vice_principal' OR EXISTS (SELECT 1 FROM sm_approval_delegations d WHERE d.to_staff_id = ? AND d.is_active = 1 AND CURDATE() BETWEEN d.from_date AND d.to_date))", [$me['id']]];
    }

    private function canDecide(array $me, object $r): bool
    {
        if ($this->isTop($me) || $r->current_level === 'vice_principal') return true;
        return DB::table('sm_approval_delegations')->where('to_staff_id', $me['id'])->where('is_active', 1)
            ->whereRaw('CURDATE() BETWEEN from_date AND to_date')->exists();
    }

    private function event(int $requestId, array $me, string $action, ?string $note): void
    {
        DB::table('sm_approval_events')->insert([
            'request_id' => $requestId, 'actor_type' => 'staff', 'actor_id' => $me['id'], 'actor_name' => $me['name'],
            'action' => $action, 'note' => $note !== null && $note !== '' ? $note : null, 'created_at' => DB::raw('NOW()'),
        ]);
    }

    public function counts(array $me): array
    {
        [$can, $b] = $this->canSql($me);
        $x = DB::selectOne(
            "SELECT COALESCE(SUM(r.status = 'pending' AND $can), 0) AS todo,
                    COALESCE(SUM(r.status = 'pending' AND NOT ($can)), 0) AS waiting,
                    COALESCE(SUM(r.status = 'approved'), 0) AS approved, COALESCE(SUM(r.status = 'rejected'), 0) AS rejected,
                    COALESCE(SUM(r.status = 'returned'), 0) AS returned, COUNT(*) AS total,
                    COALESCE(SUM(r.status = 'pending' AND r.due_at < NOW() AND $can), 0) AS overdue
               FROM sm_approval_requests r",
            array_merge($b, $b, $b)
        );
        return array_map('intval', (array) $x);
    }

    public function overview(array $me): array
    {
        $m = DB::selectOne("SELECT COALESCE(SUM(status = 'approved'), 0) AS ap, COALESCE(SUM(status = 'rejected'), 0) AS rj,
                                   AVG(CASE WHEN status IN ('approved', 'rejected') THEN TIMESTAMPDIFF(MINUTE, created_at, decided_at) END) AS avg_min
                              FROM sm_approval_requests WHERE decided_at >= NOW() - INTERVAL 30 DAY");
        $decided = (int) $m->ap + (int) $m->rj;
        $byType = DB::select("SELECT t.code, t.name, t.icon, COALESCE(SUM(r.status = 'pending'), 0) AS pending, COUNT(r.id) AS total
                                FROM sm_approval_types t LEFT JOIN sm_approval_requests r ON r.type_code = t.code
                               GROUP BY t.code, t.name, t.icon, t.sort_order ORDER BY t.sort_order");
        $recent = DB::select("SELECT e.id, e.action, e.actor_name, e.note, e.created_at, r.id AS request_id, r.code, r.title
                                FROM sm_approval_events e JOIN sm_approval_requests r ON r.id = e.request_id
                               ORDER BY e.id DESC LIMIT 8");
        return [
            'me' => $me,
            'counts' => $this->counts($me),
            'approved_today' => DB::table('sm_approval_requests')->where('status', 'approved')->whereRaw('DATE(decided_at) = CURDATE()')->count(),
            'approval_rate' => $decided ? (int) round((int) $m->ap / $decided * 100) : null,
            'avg_hours' => $m->avg_min === null ? null : round((float) $m->avg_min / 60, 1),
            'by_type' => array_map(fn ($t) => ['code' => $t->code, 'name' => $t->name, 'icon' => $t->icon, 'pending' => (int) $t->pending, 'total' => (int) $t->total], $byType),
            'recent' => array_map(fn ($e) => (array) $e, $recent),
        ];
    }

    private function row(object $r): array
    {
        return [
            'id' => (int) $r->id, 'code' => $r->code, 'type_code' => $r->type_code, 'type_name' => $r->type_name, 'icon' => $r->icon,
            'title' => $r->title, 'requester_kind' => $r->requester_kind, 'requester_name' => $r->requester_name,
            'requester_info' => $r->requester_info, 'priority' => $r->priority, 'status' => $r->status,
            'current_level' => $r->current_level, 'due_at' => $r->due_at, 'due_min' => (int) $r->due_min,
            'created_at' => $r->created_at, 'decided_at' => $r->decided_at, 'amount' => $r->amount === null ? null : (float) $r->amount,
        ];
    }

    private function selectRow()
    {
        return DB::table('sm_approval_requests as r')->join('sm_approval_types as t', 't.code', '=', 'r.type_code')
            ->select('r.id', 'r.code', 'r.type_code', 't.name as type_name', 't.icon', 'r.title', 'r.requester_kind', 'r.requester_name',
                'r.requester_info', 'r.priority', 'r.status', 'r.current_level', 'r.due_at', 'r.created_at', 'r.decided_at', 'r.amount',
                DB::raw('TIMESTAMPDIFF(MINUTE, NOW(), r.due_at) AS due_min'));
    }

    public function list(array $me, array $f, int $page, int $per): array
    {
        [$can, $b] = $this->canSql($me);
        $q = $this->selectRow();
        $tab = $f['tab'] ?? 'todo';
        if ($tab === 'todo') $q->where('r.status', 'pending')->whereRaw($can, $b);
        elseif ($tab === 'waiting') $q->where('r.status', 'pending')->whereRaw("NOT ($can)", $b);
        elseif (in_array($tab, ['approved', 'rejected', 'returned', 'cancelled'], true)) $q->where('r.status', $tab);

        if (!empty($f['type_code'])) $q->where('r.type_code', $f['type_code']);
        if (!empty($f['priority']) && in_array($f['priority'], ['normal', 'high', 'urgent'], true)) $q->where('r.priority', $f['priority']);
        if (!empty($f['overdue'])) $q->where('r.status', 'pending')->whereRaw('r.due_at < NOW()');
        if (!empty($f['q'])) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], trim($f['q'])) . '%';
            $q->where(function ($w) use ($like) {
                $w->where('r.title', 'like', $like)->orWhere('r.code', 'like', $like)->orWhere('r.requester_name', 'like', $like);
            });
        }
        if ($tab === 'todo' || $tab === 'waiting') $q->orderByRaw("FIELD(r.priority, 'urgent', 'high', 'normal')")->orderBy('r.due_at');
        else $q->orderByRaw('COALESCE(r.decided_at, r.created_at) DESC');

        $p = $q->paginate($per, ['*'], 'page', $page);
        return [
            'items' => collect($p->items())->map(fn ($r) => $this->row($r))->all(),
            'meta' => ['current_page' => $p->currentPage(), 'last_page' => $p->lastPage(), 'total' => $p->total(), 'counts' => $this->counts($me)],
        ];
    }

    public function detail(array $me, int $id): ?array
    {
        $r = $this->selectRow()->addSelect('r.description', 'r.payload', 'r.ref_table', 'r.ref_id', 'r.decision_note', 'r.decided_by')->where('r.id', $id)->first();
        if (!$r) return null;
        $events = DB::table('sm_approval_events')->where('request_id', $id)->orderBy('id')
            ->get(['id', 'actor_type', 'actor_name', 'action', 'note', 'created_at'])->map(fn ($e) => (array) $e)->all();
        $attach = DB::table('sm_approval_attachments')->where('request_id', $id)->get(['id', 'name', 'url', 'size_kb'])->map(fn ($a) => (array) $a)->all();
        $can = $r->status === 'pending' && $this->canDecide($me, $r);
        $actions = $can ? ['approve', 'return', 'reject'] : [];
        if ($can && $r->current_level === 'vice_principal' && !$this->isTop($me)) $actions[] = 'forward';
        $payload = $r->payload ? json_decode($r->payload, true) : [];
        $decider = $r->decided_by ? DB::table('sm_staff_accounts')->where('id', $r->decided_by)->value('full_name') : null;

        return $this->row($r) + [
            'description' => $r->description,
            'payload' => array_values(array_filter(is_array($payload) ? $payload : [], fn ($x) => !empty($x['label']) && isset($x['value']))),
            'ref_table' => $r->ref_table, 'ref_id' => $r->ref_id ? (int) $r->ref_id : null,
            'decision_note' => $r->decision_note, 'decided_by_name' => $decider,
            'events' => $events, 'attachments' => $attach, 'can_decide' => $can, 'actions' => $actions,
        ];
    }

    /** approve | reject | return | forward */
    public function decide(array $me, int $id, string $action, ?string $note): array
    {
        $note = $note !== null ? trim($note) : null;
        return DB::transaction(function () use ($me, $id, $action, $note) {
            $r = DB::table('sm_approval_requests')->where('id', $id)->lockForUpdate()->first();
            if (!$r) throw new DomainException('Không tìm thấy yêu cầu.');
            if ($r->status !== 'pending') throw new DomainException('Yêu cầu này đã được xử lý.');
            if (!$this->canDecide($me, $r)) throw new DomainException('Yêu cầu này thuộc cấp Hiệu trưởng. Hãy chuyển Hiệu trưởng hoặc nhờ ủy quyền.');
            if (in_array($action, ['reject', 'return'], true) && mb_strlen((string) $note) < 5) throw new DomainException('Hãy ghi rõ lý do (ít nhất 5 ký tự).');

            if ($action === 'forward') {
                if ($r->current_level === 'principal') throw new DomainException('Yêu cầu đã ở cấp Hiệu trưởng.');
                DB::table('sm_approval_requests')->where('id', $id)->update(['current_level' => 'principal', 'updated_at' => DB::raw('NOW()')]);
                $this->event($id, $me, 'forward', $note ?: 'Chuyển Hiệu trưởng phê duyệt');
                return ['status' => 'pending', 'current_level' => 'principal'];
            }

            $status = ['approve' => 'approved', 'reject' => 'rejected', 'return' => 'returned'][$action];
            DB::table('sm_approval_requests')->where('id', $id)->update([
                'status' => $status, 'decided_by' => $me['id'], 'decided_at' => DB::raw('NOW()'),
                'decision_note' => $note !== '' ? $note : null, 'updated_at' => DB::raw('NOW()'),
            ]);
            $this->event($id, $me, $action, $note);
            $this->apply($r, $me, $status, $note);
            return ['status' => $status];
        });
    }

    /** Liên kết nghiệp vụ: khi duyệt đơn nghỉ dài ngày thì cập nhật luôn đơn gốc và chuyên cần */
    private function apply(object $r, array $me, string $status, ?string $note): void
    {
        if ($r->ref_table !== 'sm_att_leaves' || !$r->ref_id || !in_array($status, ['approved', 'rejected'], true)) return;
        try {
            $lv = DB::table('sm_att_leaves')->where('id', $r->ref_id)->where('status', 'pending')->first();
            if (!$lv) return;
            DB::table('sm_att_leaves')->where('id', $lv->id)->update([
                'status' => $status, 'reviewer_note' => $note, 'reviewed_by' => $me['id'],
                'reviewed_at' => DB::raw('NOW()'), 'updated_at' => DB::raw('NOW()'),
            ]);
            if ($status === 'approved') {
                foreach (['sm_att_records', 'sm_att_lessons'] as $tb) {
                    DB::table($tb)->where('student_id', $lv->student_id)->whereBetween('att_date', [$lv->from_date, $lv->to_date])
                        ->where('status', 'unexcused')->update(['status' => 'excused', 'updated_at' => DB::raw('NOW()')]);
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function bulk(array $me, array $ids, string $action, ?string $note): array
    {
        $done = 0; $failed = [];
        foreach (array_slice(array_unique(array_map('intval', $ids)), 0, 50) as $id) {
            try { $this->decide($me, $id, $action, $note); $done++; }
            catch (DomainException $e) { $failed[] = ['id' => $id, 'message' => $e->getMessage()]; }
        }
        return ['done' => $done, 'failed' => $failed];
    }

    public function comment(array $me, int $id, string $note): bool
    {
        if (!DB::table('sm_approval_requests')->where('id', $id)->exists()) return false;
        $this->event($id, $me, 'comment', trim($note));
        return true;
    }

    /** Đồng bộ các đơn nghỉ học trên 3 ngày đang chờ từ cổng học sinh về hộp phê duyệt. */
    public function sync(): array
    {
        try {
            $added = DB::affectingStatement(
                "INSERT INTO sm_approval_requests (code, type_code, title, description, requester_kind, requester_id, requester_name, requester_info,
                        priority, status, current_level, due_at, ref_table, ref_id, payload, created_at, updated_at)
                 SELECT CONCAT('TMP', lv.id), 'leave_long', CONCAT('Xin nghỉ ', DATEDIFF(lv.to_date, lv.from_date) + 1, ' ngày: ', st.full_name),
                        lv.reason, 'student', st.id, st.full_name, c.name, 'normal', 'pending', 'vice_principal',
                        DATE_ADD(NOW(), INTERVAL ty.sla_hours HOUR), 'sm_att_leaves', lv.id,
                        JSON_ARRAY(JSON_OBJECT('label', 'Từ ngày', 'value', DATE_FORMAT(lv.from_date, '%d/%m/%Y')),
                                   JSON_OBJECT('label', 'Đến ngày', 'value', DATE_FORMAT(lv.to_date, '%d/%m/%Y')),
                                   JSON_OBJECT('label', 'Số ngày nghỉ', 'value', CONCAT(DATEDIFF(lv.to_date, lv.from_date) + 1, ' ngày')),
                                   JSON_OBJECT('label', 'Lý do', 'value', lv.reason)), NOW(), NOW()
                   FROM sm_att_leaves lv
                   JOIN sm_students st ON st.id = lv.student_id
                   JOIN sm_enrollments e ON e.student_id = st.id
                   JOIN sm_school_years y ON y.id = e.school_year_id AND y.is_current = 1
                   JOIN sm_classes c ON c.id = e.class_id
                   JOIN sm_approval_types ty ON ty.code = 'leave_long' AND ty.is_active = 1
                  WHERE lv.status = 'pending' AND DATEDIFF(lv.to_date, lv.from_date) + 1 > 3
                    AND NOT EXISTS (SELECT 1 FROM sm_approval_requests r WHERE r.ref_table = 'sm_att_leaves' AND r.ref_id = lv.id)"
            );
            DB::update("UPDATE sm_approval_requests SET code = CONCAT('PD-', YEAR(created_at), '-', LPAD(id, 5, '0')) WHERE code LIKE 'TMP%'");
            // Đơn đã được giáo viên chủ nhiệm xử lý ở nơi khác thì đóng luôn yêu cầu tương ứng
            $closed = DB::update(
                "UPDATE sm_approval_requests r JOIN sm_att_leaves lv ON r.ref_table = 'sm_att_leaves' AND lv.id = r.ref_id
                    SET r.status = CASE lv.status WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'cancelled' END,
                        r.decided_at = COALESCE(lv.reviewed_at, NOW()), r.decision_note = lv.reviewer_note, r.updated_at = NOW()
                  WHERE r.status = 'pending' AND lv.status <> 'pending'"
            );
            DB::insert("INSERT INTO sm_approval_events (request_id, actor_type, actor_id, actor_name, action, note, created_at)
                        SELECT r.id, 'requester', r.requester_id, r.requester_name, 'submit', NULL, r.created_at
                          FROM sm_approval_requests r WHERE NOT EXISTS (SELECT 1 FROM sm_approval_events e WHERE e.request_id = r.id AND e.action = 'submit')");
            return ['added' => (int) $added, 'closed' => (int) $closed, 'ok' => true];
        } catch (\Throwable $e) {
            report($e);
            return ['added' => 0, 'closed' => 0, 'ok' => false];
        }
    }

    // ---------- Các bộ phận khác gửi đề nghị lên Ban giám hiệu ----------
    public function submit(array $me, array $d): int
    {
        $type = DB::table('sm_approval_types')->where('code', $d['type_code'])->where('is_active', 1)->first();
        if (!$type) throw new DomainException('Loại phê duyệt không tồn tại hoặc đã tắt.');
        return DB::transaction(function () use ($me, $d, $type) {
            $id = DB::table('sm_approval_requests')->insertGetId([
                'code' => 'TMP' . substr(uniqid(), -10), 'type_code' => $type->code, 'title' => trim($d['title']),
                'description' => $d['description'] ?? null, 'requester_kind' => 'staff', 'requester_id' => $me['id'],
                'requester_name' => $me['name'], 'requester_info' => $d['requester_info'] ?? null,
                'priority' => $d['priority'] ?? 'normal', 'status' => 'pending',
                'current_level' => $type->approver_role === 'principal' ? 'principal' : 'vice_principal',
                'due_at' => DB::raw('DATE_ADD(NOW(), INTERVAL ' . (int) $type->sla_hours . ' HOUR)'),
                'amount' => $d['amount'] ?? null, 'ref_table' => $d['ref_table'] ?? null, 'ref_id' => $d['ref_id'] ?? null,
                'payload' => isset($d['payload']) ? json_encode(array_values($d['payload']), JSON_UNESCAPED_UNICODE) : null,
                'created_at' => DB::raw('NOW()'), 'updated_at' => DB::raw('NOW()'),
            ]);
            DB::update("UPDATE sm_approval_requests SET code = CONCAT('PD-', YEAR(created_at), '-', LPAD(id, 5, '0')) WHERE id = ?", [$id]);
            DB::table('sm_approval_events')->insert(['request_id' => $id, 'actor_type' => 'requester', 'actor_id' => $me['id'],
                'actor_name' => $me['name'], 'action' => 'submit', 'note' => null, 'created_at' => DB::raw('NOW()')]);
            return $id;
        });
    }

    public function mine(array $me): array
    {
        return DB::table('sm_approval_requests as r')->join('sm_approval_types as t', 't.code', '=', 'r.type_code')
            ->where('r.requester_kind', 'staff')->where('r.requester_id', $me['id'])->orderByDesc('r.id')->limit(50)
            ->get(['r.id', 'r.code', 'r.title', 't.name as type_name', 'r.status', 'r.decision_note', 'r.created_at', 'r.decided_at'])
            ->map(fn ($x) => (array) $x)->all();
    }

    // ---------- Báo cáo ----------
    public function report(string $from, string $to): array
    {
        $byType = DB::select(
            "SELECT t.name, COUNT(r.id) AS total, COALESCE(SUM(r.status = 'approved'), 0) AS approved, COALESCE(SUM(r.status = 'rejected'), 0) AS rejected,
                    COALESCE(SUM(r.status = 'returned'), 0) AS returned, COALESCE(SUM(r.status = 'pending'), 0) AS pending,
                    AVG(CASE WHEN r.decided_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, r.created_at, r.decided_at) END) AS avg_min
               FROM sm_approval_types t
               LEFT JOIN sm_approval_requests r ON r.type_code = t.code AND r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY t.code, t.name, t.sort_order ORDER BY t.sort_order", [$from, $to]);
        $byApprover = DB::select(
            "SELECT s.full_name AS name, s.role, COUNT(*) AS decided, SUM(r.status = 'approved') AS approved,
                    SUM(r.status = 'rejected') AS rejected, SUM(r.status = 'returned') AS returned
               FROM sm_approval_requests r JOIN sm_staff_accounts s ON s.id = r.decided_by
              WHERE r.decided_at >= ? AND r.decided_at < DATE_ADD(?, INTERVAL 1 DAY)
              GROUP BY s.id, s.full_name, s.role ORDER BY decided DESC", [$from, $to]);
        $trend = DB::select(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS m, COUNT(*) AS total, SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected
               FROM sm_approval_requests WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
              GROUP BY m ORDER BY m");
        $sum = DB::selectOne(
            "SELECT COUNT(*) AS total, COALESCE(SUM(status = 'approved'), 0) AS approved, COALESCE(SUM(status = 'rejected'), 0) AS rejected,
                    COALESCE(SUM(status = 'pending'), 0) AS pending, COALESCE(SUM(status = 'pending' AND due_at < NOW()), 0) AS overdue,
                    COALESCE(SUM(CASE WHEN status = 'approved' THEN amount END), 0) AS approved_amount
               FROM sm_approval_requests WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)", [$from, $to]);
        $n = fn ($rows, $int) => array_map(function ($r) use ($int) {
            $a = (array) $r;
            foreach ($int as $k) if (array_key_exists($k, $a)) $a[$k] = $a[$k] === null ? null : (int) $a[$k];
            return $a;
        }, $rows);
        return [
            'from' => $from, 'to' => $to, 'summary' => array_map('intval', (array) $sum),
            'by_type' => array_map(function ($r) { $r = (array) $r; $r['avg_hours'] = $r['avg_min'] === null ? null : round($r['avg_min'] / 60, 1); unset($r['avg_min']);
                foreach (['total', 'approved', 'rejected', 'returned', 'pending'] as $k) $r[$k] = (int) $r[$k]; return $r; }, $byType),
            'by_approver' => $n($byApprover, ['decided', 'approved', 'rejected', 'returned']),
            'trend' => $n($trend, ['total', 'approved', 'rejected']),
        ];
    }

    public function exportRows(string $from, string $to): array
    {
        return DB::select(
            "SELECT r.code, t.name AS type_name, r.title, r.requester_name, r.requester_info, r.priority, r.status, r.amount,
                    r.created_at, r.decided_at, COALESCE(CONVERT(s.full_name USING utf8mb4) COLLATE utf8mb4_unicode_ci, '') AS decided_by_name, r.decision_note
               FROM sm_approval_requests r JOIN sm_approval_types t ON t.code = r.type_code LEFT JOIN sm_staff_accounts s ON s.id = r.decided_by
              WHERE r.created_at >= ? AND r.created_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY r.id", [$from, $to]);
    }

    // ---------- Cấu hình ----------
    public function types(): array
    {
        return DB::select("SELECT t.code, t.name, t.description, t.icon, t.sla_hours, t.approver_role, t.is_active,
                                  COALESCE(SUM(r.status = 'pending'), 0) AS pending, COUNT(r.id) AS total
                             FROM sm_approval_types t LEFT JOIN sm_approval_requests r ON r.type_code = t.code
                            GROUP BY t.code, t.name, t.description, t.icon, t.sla_hours, t.approver_role, t.is_active, t.sort_order ORDER BY t.sort_order");
    }

    public function updateType(string $code, array $d): bool
    {
        $upd = array_intersect_key($d, array_flip(['sla_hours', 'approver_role', 'is_active']));
        if (isset($upd['is_active'])) $upd['is_active'] = (int) $upd['is_active'];
        return $upd && DB::table('sm_approval_types')->where('code', $code)->update($upd) >= 0 && DB::table('sm_approval_types')->where('code', $code)->exists();
    }

    public function delegations(): array
    {
        return DB::table('sm_approval_delegations as d')
            ->join('sm_staff_accounts as f', 'f.id', '=', 'd.from_staff_id')->join('sm_staff_accounts as t', 't.id', '=', 'd.to_staff_id')
            ->orderByDesc('d.id')->limit(50)
            ->get(['d.id', 'd.from_date', 'd.to_date', 'd.reason', 'd.is_active', 'f.full_name as from_name', 't.full_name as to_name',
                DB::raw('(d.is_active = 1 AND CURDATE() BETWEEN d.from_date AND d.to_date) AS running')])
            ->map(fn ($x) => (array) $x)->all();
    }

    public function createDelegation(array $me, int $toStaffId, string $from, string $to, ?string $reason): int
    {
        if (!$this->isTop($me)) throw new DomainException('Chỉ Hiệu trưởng mới được ủy quyền.');
        $ok = DB::table('sm_staff_accounts')->where('id', $toStaffId)->where('role', 'vice_principal')->where('status', 'active')->exists();
        if (!$ok) throw new DomainException('Chỉ ủy quyền được cho Phó hiệu trưởng đang hoạt động.');
        if ($to < $from) throw new DomainException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
        return DB::table('sm_approval_delegations')->insertGetId([
            'from_staff_id' => $me['id'], 'to_staff_id' => $toStaffId, 'from_date' => $from, 'to_date' => $to,
            'reason' => $reason ? trim($reason) : null, 'is_active' => 1, 'created_at' => DB::raw('NOW()'),
        ]);
    }

    public function revokeDelegation(array $me, int $id): bool
    {
        if (!$this->isTop($me)) throw new DomainException('Chỉ Hiệu trưởng mới được thu hồi ủy quyền.');
        return DB::table('sm_approval_delegations')->where('id', $id)->update(['is_active' => 0]) >= 0;
    }

    public function viceStaff(): array
    {
        return DB::table('sm_staff_accounts')->where('role', 'vice_principal')->where('status', 'active')->orderBy('id')
            ->get(['id', 'full_name'])->map(fn ($x) => ['id' => (int) $x->id, 'name' => $x->full_name])->all();
    }

    public function templates(): array
    {
        $out = [];
        foreach (DB::table('sm_approval_templates')->orderBy('kind')->orderBy('sort_order')->get(['kind', 'content']) as $t) $out[$t->kind][] = $t->content;
        return $out;
    }
}
