<?php

namespace Modules\Logs\Repositories;

use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Modules\Logs\Support\Clock;

/** Truy vấn dữ liệu nhật ký. Toàn bộ dùng Query Builder (không phụ thuộc Eloquent). */
class LogRepository
{
    private const SORTABLE = ['occurred_at', 'id', 'severity', 'module', 'action', 'actor_name', 'status'];

    /* ------------------------------------------------------------------ lọc */

    public function applyFilters(Builder $q, array $f): Builder
    {
        if (! empty($f['q'])) {
            $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $f['q']) . '%';
            $q->where(function ($w) use ($like) {
                $w->where('summary', 'like', $like)->orWhere('actor_name', 'like', $like)
                    ->orWhere('entity_label', 'like', $like)->orWhere('action', 'like', $like)
                    ->orWhere('ip', 'like', $like)->orWhere('entity_id', 'like', $like);
            });
        }
        foreach (['module', 'severity', 'status', 'actor_type'] as $col) {
            if (! empty($f[$col])) {
                $q->whereIn($col, array_filter(array_map('trim', explode(',', $f[$col]))));
            }
        }
        if (! empty($f['action']))      $q->where('action', 'like', $f['action'] . '%');
        if (! empty($f['actor_id']))    $q->where('actor_id', (int) $f['actor_id']);
        if (! empty($f['actor_role']))  $q->where('actor_role', $f['actor_role']);
        if (! empty($f['ip']))          $q->where('ip', $f['ip']);
        if (! empty($f['entity_type'])) $q->where('entity_type', $f['entity_type']);
        if (! empty($f['entity_id']))   $q->where('entity_id', $f['entity_id']);
        if (! empty($f['request_id']))  $q->where('request_id', $f['request_id']);
        if (! empty($f['from']))        $q->where('occurred_at', '>=', Carbon::parse($f['from'])->startOfDay()->format('Y-m-d H:i:s'));
        if (! empty($f['to']))          $q->where('occurred_at', '<=', Carbon::parse($f['to'])->endOfDay()->format('Y-m-d H:i:s'));

        return $q;
    }

    public function paginate(array $f, int $page, int $per): array
    {
        $q = $this->applyFilters(DB::table('sm_audit_logs'), $f);
        $total = (clone $q)->count();

        $sort = in_array($f['sort'] ?? '', self::SORTABLE, true) ? $f['sort'] : 'occurred_at';
        $dir  = strtolower($f['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $items = $q->orderBy($sort, $dir)->orderBy('id', $dir)
            ->forPage($page, $per)
            ->get(['id', 'occurred_at', 'actor_type', 'actor_id', 'actor_name', 'actor_role', 'module', 'action',
                'entity_type', 'entity_id', 'entity_label', 'severity', 'status', 'summary', 'ip', 'method', 'path']);

        return [
            'items' => $items,
            'meta'  => ['page' => $page, 'per_page' => $per, 'total' => $total, 'last_page' => max(1, (int) ceil($total / $per))],
        ];
    }

    public function find(int $id): ?object
    {
        $row = DB::table('sm_audit_logs')->where('id', $id)->first();
        if ($row) {
            $row->old_values = $row->old_values ? json_decode($row->old_values, true) : null;
            $row->new_values = $row->new_values ? json_decode($row->new_values, true) : null;
            $row->meta       = $row->meta ? json_decode($row->meta, true) : null;
        }
        return $row;
    }

    public function related(object $row): array
    {
        $cols = ['id', 'occurred_at', 'actor_name', 'module', 'action', 'severity', 'status', 'summary'];
        $out = ['same_request' => [], 'same_entity' => [], 'same_actor' => []];

        if ($row->request_id) {
            $out['same_request'] = DB::table('sm_audit_logs')->where('request_id', $row->request_id)
                ->where('id', '<>', $row->id)->orderBy('id')->limit(15)->get($cols);
        }
        if ($row->entity_type && $row->entity_id) {
            $out['same_entity'] = DB::table('sm_audit_logs')->where('entity_type', $row->entity_type)
                ->where('entity_id', $row->entity_id)->where('id', '<>', $row->id)
                ->orderByDesc('occurred_at')->limit(10)->get($cols);
        }
        if ($row->actor_id) {
            $t = Carbon::parse($row->occurred_at);
            $out['same_actor'] = DB::table('sm_audit_logs')->where('actor_type', $row->actor_type)
                ->where('actor_id', $row->actor_id)->where('id', '<>', $row->id)
                ->whereBetween('occurred_at', [$t->copy()->subMinutes(30)->format('Y-m-d H:i:s'), $t->copy()->addMinutes(30)->format('Y-m-d H:i:s')])
                ->orderBy('occurred_at')->limit(12)->get($cols);
        }
        return $out;
    }

    /** Giá trị cho các ô lọc (module, hành động phổ biến, người dùng hoạt động). */
    public function facets(): array
    {
        return [
            'modules'  => DB::table('sm_audit_logs')->select('module', DB::raw('COUNT(*) c'))->groupBy('module')->orderByDesc('c')->get(),
            'actions'  => DB::table('sm_audit_logs')->select('action', DB::raw('COUNT(*) c'))->groupBy('action')->orderByDesc('c')->limit(40)->get(),
            'roles'    => DB::table('sm_audit_logs')->whereNotNull('actor_role')->select('actor_role', DB::raw('COUNT(*) c'))->groupBy('actor_role')->orderByDesc('c')->get(),
        ];
    }

    /* ------------------------------------------------------------- tổng quan */

    public function rangeStart(string $range): Carbon
    {
        $now = Clock::now();
        return match ($range) {
            'today' => $now->copy()->startOfDay(),
            '30d'   => $now->copy()->subDays(29)->startOfDay(),
            '90d'   => $now->copy()->subDays(89)->startOfDay(),
            default => $now->copy()->subDays(6)->startOfDay(),
        };
    }

    public function overview(string $range): array
    {
        $now   = Clock::now();
        $from  = $this->rangeStart($range);
        $fromS = $from->format('Y-m-d H:i:s');
        $span  = max(1, $from->diffInSeconds($now));
        $prevFrom = $from->copy()->subSeconds($span)->format('Y-m-d H:i:s');

        $base = fn () => DB::table('sm_audit_logs')->where('occurred_at', '>=', $fromS);

        $k = $base()->selectRaw("COUNT(*) total,
              SUM(status <> 'success') failed,
              SUM(severity = 'warning') warnings,
              SUM(severity = 'critical') criticals,
              COUNT(DISTINCT CASE WHEN actor_id IS NOT NULL THEN CONCAT(actor_type, ':', actor_id) END) actors,
              COUNT(DISTINCT ip) ips")->first();

        $prevTotal = DB::table('sm_audit_logs')->where('occurred_at', '>=', $prevFrom)->where('occurred_at', '<', $fromS)->count();

        // chuỗi theo ngày (hoặc theo giờ nếu chọn "hôm nay")
        $byHour = $range === 'today';
        $expr = $byHour ? "DATE_FORMAT(occurred_at, '%Y-%m-%d %H:00')" : 'DATE(occurred_at)';
        $rows = $base()->selectRaw("$expr AS bucket, COUNT(*) total, SUM(status <> 'success') failed,
                SUM(severity IN ('warning','critical')) risky")
            ->groupBy('bucket')->orderBy('bucket')->get()->keyBy('bucket');

        $series = [];
        if ($byHour) {
            for ($h = 0; $h <= (int) $now->format('G'); $h++) {
                $key = $now->format('Y-m-d') . sprintf(' %02d:00', $h);
                $r = $rows[$key] ?? null;
                $series[] = ['label' => sprintf('%02d:00', $h), 'total' => (int) ($r->total ?? 0), 'failed' => (int) ($r->failed ?? 0), 'risky' => (int) ($r->risky ?? 0)];
            }
        } else {
            for ($d = $from->copy(); $d->lte($now); $d->addDay()) {
                $key = $d->format('Y-m-d');
                $r = $rows[$key] ?? null;
                $series[] = ['label' => $d->format('d/m'), 'date' => $key, 'total' => (int) ($r->total ?? 0), 'failed' => (int) ($r->failed ?? 0), 'risky' => (int) ($r->risky ?? 0)];
            }
        }

        $heat = $base()->selectRaw('DAYOFWEEK(occurred_at) dow, HOUR(occurred_at) hr, COUNT(*) c')
            ->groupBy('dow', 'hr')->get();

        return [
            'range'  => $range,
            'from'   => $fromS,
            'kpi'    => [
                'total' => (int) $k->total, 'prev_total' => $prevTotal,
                'failed' => (int) $k->failed, 'warnings' => (int) $k->warnings, 'criticals' => (int) $k->criticals,
                'actors' => (int) $k->actors, 'ips' => (int) $k->ips,
                'open_alerts' => DB::table('sm_log_alerts')->where('status', 'open')->count(),
                'active_sessions' => DB::table('sm_staff_tokens')->where('expires_at', '>', Clock::nowSql())->count()
                    + DB::table('sm_api_tokens')->where('expires_at', '>', Clock::nowSql())->count(),
            ],
            'series'      => $series,
            'by_module'   => $base()->select('module', DB::raw('COUNT(*) c'))->groupBy('module')->orderByDesc('c')->get(),
            'by_severity' => $base()->select('severity', DB::raw('COUNT(*) c'))->groupBy('severity')->get(),
            'by_status'   => $base()->select('status', DB::raw('COUNT(*) c'))->groupBy('status')->get(),
            'top_actors'  => $base()->whereNotNull('actor_id')
                ->selectRaw("actor_type, actor_id, MAX(actor_name) actor_name, MAX(actor_role) actor_role, COUNT(*) c, SUM(status <> 'success') failed")
                ->groupBy('actor_type', 'actor_id')->orderByDesc('c')->limit(8)->get(),
            'top_ips'     => $base()->whereNotNull('ip')
                ->selectRaw("ip, COUNT(*) c, SUM(status <> 'success') failed, COUNT(DISTINCT actor_id) actors")
                ->groupBy('ip')->orderByDesc('c')->limit(8)->get(),
            'heatmap'     => $heat,
            'latest_critical' => DB::table('sm_audit_logs')->whereIn('severity', ['critical', 'warning'])
                ->orderByDesc('occurred_at')->limit(6)
                ->get(['id', 'occurred_at', 'actor_name', 'module', 'action', 'severity', 'status', 'summary']),
        ];
    }

    /* -------------------------------------------------------------- bảo mật */

    public function security(): array
    {
        $now = Clock::nowSql();
        $d14 = Clock::now()->subDays(13)->startOfDay();
        $d7  = Clock::now()->subDays(6)->startOfDay()->format('Y-m-d H:i:s');

        $rows = DB::table('sm_audit_logs')->where('action', 'login_failed')->where('occurred_at', '>=', $d14->format('Y-m-d H:i:s'))
            ->selectRaw('DATE(occurred_at) d, COUNT(*) c')->groupBy('d')->get()->keyBy('d');
        $failedSeries = [];
        for ($d = $d14->copy(); $d->lte(Clock::now()); $d->addDay()) {
            $failedSeries[] = ['label' => $d->format('d/m'), 'count' => (int) ($rows[$d->format('Y-m-d')]->c ?? 0)];
        }

        $lockedStaff = DB::table('sm_staff_accounts')
            ->where(fn ($w) => $w->where('locked_until', '>', $now)->orWhere('failed_attempts', '>=', 3))
            ->get(['id', 'username', 'full_name', 'role', 'failed_attempts', 'locked_until', 'last_login_at'])
            ->map(function ($r) { $r->account_type = 'staff'; return $r; });

        $lockedStudents = DB::table('sm_accounts as a')->join('sm_students as s', 's.id', '=', 'a.student_id')
            ->where(fn ($w) => $w->where('a.locked_until', '>', $now)->orWhere('a.failed_attempts', '>=', 3))
            ->get(['a.id', 'a.username', 's.full_name', 'a.failed_attempts', 'a.locked_until', 'a.last_login_at'])
            ->map(function ($r) { $r->role = 'student'; $r->account_type = 'student'; return $r; });

        return [
            'summary' => [
                'failed_24h'  => DB::table('sm_audit_logs')->where('action', 'login_failed')->where('occurred_at', '>=', Clock::now()->subDay()->format('Y-m-d H:i:s'))->count(),
                'denied_7d'   => DB::table('sm_audit_logs')->where('status', 'denied')->where('occurred_at', '>=', $d7)->count(),
                'pii_access_7d' => DB::table('sm_audit_logs')->where('occurred_at', '>=', $d7)
                    ->where(fn ($w) => $w->where('action', 'like', 'export%')->orWhere('action', 'view_profile')->orWhere('action', 'encrypt_pii'))->count(),
                'locked'      => $lockedStaff->count() + $lockedStudents->count(),
            ],
            'failed_series' => $failedSeries,
            'suspicious_ips' => DB::table('sm_audit_logs')->where('occurred_at', '>=', $d7)->whereNotNull('ip')
                ->where(fn ($w) => $w->where('action', 'login_failed')->orWhere('status', 'denied'))
                ->selectRaw('ip, COUNT(*) c, COUNT(DISTINCT actor_name) accounts, MAX(occurred_at) last_seen')
                ->groupBy('ip')->orderByDesc('c')->limit(10)->get(),
            'locked_accounts' => $lockedStaff->concat($lockedStudents)->values(),
            'recent_events' => DB::table('sm_audit_logs')
                ->where(fn ($w) => $w->where('module', 'security')->orWhere('module', 'auth')->orWhere('status', 'denied'))
                ->orderByDesc('occurred_at')->limit(15)
                ->get(['id', 'occurred_at', 'actor_name', 'module', 'action', 'severity', 'status', 'summary', 'ip']),
        ];
    }

    public function unlockAccount(string $type, int $id): ?object
    {
        if ($type === 'staff') {
            $acc = DB::table('sm_staff_accounts')->where('id', $id)->first(['id', 'username', 'full_name']);
            if ($acc) DB::table('sm_staff_accounts')->where('id', $id)->update(['failed_attempts' => 0, 'locked_until' => null]);
        } else {
            $acc = DB::table('sm_accounts as a')->join('sm_students as s', 's.id', '=', 'a.student_id')
                ->where('a.id', $id)->first(['a.id', 'a.username', 's.full_name']);
            if ($acc) DB::table('sm_accounts')->where('id', $id)->update(['failed_attempts' => 0, 'locked_until' => null]);
        }
        return $acc;
    }

    /* -------------------------------------------------------------- phiên */

    public function sessions(): array
    {
        $now = Clock::nowSql();

        $staff = DB::table('sm_staff_tokens as t')->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
            ->where('t.expires_at', '>', $now)->orderByDesc('t.created_at')
            ->get(['t.id', 'a.id as user_id', 'a.username', 'a.full_name', 'a.role', 't.created_at', 't.expires_at'])
            ->map(function ($r) { $r->account_type = 'staff'; return $r; });

        $students = DB::table('sm_api_tokens as t')->join('sm_accounts as a', 'a.id', '=', 't.account_id')
            ->join('sm_students as s', 's.id', '=', 'a.student_id')
            ->where('t.expires_at', '>', $now)->orderByDesc('t.created_at')->limit(200)
            ->get(['t.id', 'a.id as user_id', 'a.username', 's.full_name', 't.created_at', 't.expires_at'])
            ->map(function ($r) { $r->role = 'student'; $r->account_type = 'student'; return $r; });

        // Tài khoản đăng nhập qua /auth/login (Sanctum + vai trò Spatie)
        $users = collect();
        try {
            $users = DB::table('personal_access_tokens as t')->join('users as u', 'u.id', '=', 't.tokenable_id')
                ->where('t.tokenable_type', 'like', '%User')
                ->where(fn ($q) => $q->whereNull('t.expires_at')->orWhere('t.expires_at', '>', $now))
                ->orderByDesc('t.created_at')->limit(200)
                ->get(['t.id', 'u.id as user_id', 'u.username', 'u.name as full_name', 't.created_at', 't.expires_at']);
            $roleOf = DB::table('model_has_roles as m')->join('roles as r', 'r.id', '=', 'm.role_id')
                ->where('m.model_type', 'like', '%User')->whereIn('m.model_id', $users->pluck('user_id')->unique()->all())
                ->pluck('r.name', 'm.model_id');
            $users = $users->map(function ($r) use ($roleOf) {
                $r->role = $roleOf[$r->user_id] ?? 'user'; $r->account_type = 'user'; return $r;
            });
        } catch (\Throwable $e) {
            $users = collect();
        }
        $staff = $users->concat($staff)->values();

        return [
            'staff' => $staff->values(),
            'students' => $students->values(),
            'totals' => [
                'staff' => $staff->count(),
                'students' => DB::table('sm_api_tokens')->where('expires_at', '>', $now)->count(),
                'expired_staff' => DB::table('sm_staff_tokens')->where('expires_at', '<=', $now)->count(),
                'expired_students' => DB::table('sm_api_tokens')->where('expires_at', '<=', $now)->count(),
            ],
        ];
    }

    public function revokeSession(string $type, int $tokenId): ?object
    {
        if ($type === 'user') {
            $row = DB::table('personal_access_tokens as t')->join('users as u', 'u.id', '=', 't.tokenable_id')
                ->where('t.id', $tokenId)->first(['t.id', 'u.username', 'u.name as full_name']);
            if ($row) DB::table('personal_access_tokens')->where('id', $tokenId)->delete();
        } elseif ($type === 'staff') {
            $row = DB::table('sm_staff_tokens as t')->join('sm_staff_accounts as a', 'a.id', '=', 't.staff_id')
                ->where('t.id', $tokenId)->first(['t.id', 'a.username', 'a.full_name']);
            if ($row) DB::table('sm_staff_tokens')->where('id', $tokenId)->delete();
        } else {
            $row = DB::table('sm_api_tokens as t')->join('sm_accounts as a', 'a.id', '=', 't.account_id')
                ->join('sm_students as s', 's.id', '=', 'a.student_id')
                ->where('t.id', $tokenId)->first(['t.id', 'a.username', 's.full_name']);
            if ($row) DB::table('sm_api_tokens')->where('id', $tokenId)->delete();
        }
        return $row;
    }

    public function purgeExpiredSessions(): int
    {
        $now = Clock::nowSql();
        return DB::table('sm_staff_tokens')->where('expires_at', '<=', $now)->delete()
            + DB::table('sm_api_tokens')->where('expires_at', '<=', $now)->delete();
    }

    /* ------------------------------------------------------------- tài chính */

    public function finance(array $f): array
    {
        $from = Clock::now()->subDays(29)->startOfDay()->format('Y-m-d H:i:s');

        $pay = DB::table('sm_payments')->selectRaw("
            COUNT(*) total,
            SUM(status = 'confirmed') confirmed,
            SUM(status = 'pending') pending,
            SUM(status = 'rejected') rejected,
            SUM(status = 'cancelled') cancelled,
            COALESCE(SUM(CASE WHEN status = 'confirmed' THEN amount END), 0) amount_confirmed,
            COALESCE(SUM(CASE WHEN status IN ('rejected','cancelled') THEN amount END), 0) amount_voided")->first();

        $q = $this->applyFilters(DB::table('sm_audit_logs')->where('module', 'finance'), $f);

        return [
            'payments' => $pay,
            'events_30d' => DB::table('sm_audit_logs')->where('module', 'finance')->where('occurred_at', '>=', $from)->count(),
            'by_action' => DB::table('sm_audit_logs')->where('module', 'finance')->where('occurred_at', '>=', $from)
                ->select('action', DB::raw('COUNT(*) c'))->groupBy('action')->orderByDesc('c')->limit(10)->get(),
            'by_actor' => DB::table('sm_audit_logs')->where('module', 'finance')->where('occurred_at', '>=', $from)
                ->selectRaw('MAX(actor_name) actor_name, COUNT(*) c')->groupBy('actor_id', 'actor_name')->orderByDesc('c')->limit(6)->get(),
            'recent' => $q->orderByDesc('occurred_at')->limit(30)
                ->get(['id', 'occurred_at', 'actor_name', 'actor_role', 'action', 'entity_label', 'severity', 'status', 'summary', 'ip']),
            'periods' => DB::table('sm_fee_periods')->orderByDesc('id')->limit(6)->get(),
        ];
    }

    /* ------------------------------------------------------------ cảnh báo */

    public function alerts(?string $status, int $page, int $per): array
    {
        $q = DB::table('sm_log_alerts as a')->leftJoin('sm_log_alert_rules as r', 'r.id', '=', 'a.rule_id');
        if ($status && $status !== 'all') $q->where('a.status', $status);
        $total = (clone $q)->count();

        $items = $q->orderByRaw("FIELD(a.status,'open','ack','resolved')")->orderByDesc('a.created_at')
            ->forPage($page, $per)->get(['a.*', 'r.code as rule_code', 'r.name as rule_name']);

        return [
            'items' => $items,
            'meta'  => ['page' => $page, 'per_page' => $per, 'total' => $total, 'last_page' => max(1, (int) ceil($total / $per))],
            'counts' => DB::table('sm_log_alerts')->select('status', DB::raw('COUNT(*) c'))->groupBy('status')->pluck('c', 'status'),
        ];
    }

    public function rules(): \Illuminate\Support\Collection
    {
        return DB::table('sm_log_alert_rules')->orderBy('id')->get();
    }

    /* ----------------------------------------------------------- cấu hình */

    public function settings(): array
    {
        return DB::table('sm_log_settings')->pluck('v', 'k')->all();
    }

    public function stats(): array
    {
        $r = DB::table('sm_audit_logs')->selectRaw('COUNT(*) total, MIN(occurred_at) first_at, MAX(occurred_at) last_at')->first();
        return ['total' => (int) $r->total, 'first_at' => $r->first_at, 'last_at' => $r->last_at];
    }

    public function purgeOlderThan(int $days): int
    {
        $cut = Clock::now()->subDays($days)->format('Y-m-d H:i:s');
        return DB::table('sm_audit_logs')->where('occurred_at', '<', $cut)->delete();
    }
}
