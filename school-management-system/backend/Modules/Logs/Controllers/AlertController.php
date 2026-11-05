<?php

namespace Modules\Logs\Controllers;

use App\Core\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Modules\Logs\Repositories\LogRepository;
use Modules\Logs\Requests\AlertActionRequest;
use Modules\Logs\Requests\UpdateRuleRequest;
use Modules\Logs\Support\AuditLogger;
use Modules\Logs\Support\Clock;

class AlertController extends Controller
{
    use ApiResponse;

    public function __construct(private LogRepository $repo) {}

    public function index(Request $r)
    {
        return $this->success($this->repo->alerts($r->query('status', 'open'), max(1, (int) $r->query('page', 1)), min((int) $r->query('per_page', 20), 100)));
    }

    public function acknowledge(AlertActionRequest $r, int $id)
    {
        return $this->transition($r, $id, 'ack');
    }

    public function resolve(AlertActionRequest $r, int $id)
    {
        return $this->transition($r, $id, 'resolved');
    }

    private function transition(AlertActionRequest $r, int $id, string $to)
    {
        $me = $r->attributes->get('log_actor');
        $alert = DB::table('sm_log_alerts')->where('id', $id)->first();
        if (! $alert) return $this->error('Không tìm thấy cảnh báo', 404);
        if ($alert->status === 'resolved') return $this->error('Cảnh báo đã được xử lý', 422);

        $now = Clock::nowSql();
        $upd = $to === 'ack'
            ? ['status' => 'ack', 'ack_by' => $me['full_name'], 'ack_at' => $now]
            : ['status' => 'resolved', 'resolved_by' => $me['full_name'], 'resolved_at' => $now, 'resolve_note' => $r->input('note'),
               'ack_by' => $alert->ack_by ?? $me['full_name'], 'ack_at' => $alert->ack_at ?? $now];
        DB::table('sm_log_alerts')->where('id', $id)->update($upd);

        AuditLogger::log(['module' => 'security', 'action' => $to === 'ack' ? 'alert.ack' : 'alert.resolve',
            'entity_type' => 'alert', 'entity_id' => $id, 'entity_label' => $alert->title,
            'summary' => "{$me['full_name']} " . ($to === 'ack' ? 'đã tiếp nhận' : 'đã xử lý') . " cảnh báo: {$alert->title}"]);

        return $this->success(null, 'Đã cập nhật');
    }

    public function rules()
    {
        return $this->success($this->repo->rules());
    }

    public function updateRule(UpdateRuleRequest $r, int $id)
    {
        $me = $r->attributes->get('log_actor');
        if (! $me['can_admin']) return $this->error('Chỉ Hiệu trưởng / Quản trị mới được sửa luật', 403);

        $rule = DB::table('sm_log_alert_rules')->where('id', $id)->first();
        if (! $rule) return $this->error('Không tìm thấy luật', 404);

        $data = $r->validated();
        if (array_key_exists('enabled', $data)) $data['enabled'] = $data['enabled'] ? 1 : 0;
        DB::table('sm_log_alert_rules')->where('id', $id)->update($data + ['updated_by' => $me['full_name'], 'updated_at' => Clock::nowSql()]);

        AuditLogger::log(['module' => 'security', 'action' => 'alert_rule.update', 'severity' => 'notice',
            'entity_type' => 'alert_rule', 'entity_id' => $id, 'entity_label' => $rule->name,
            'old_values' => array_intersect_key((array) $rule, $data), 'new_values' => $data,
            'summary' => "{$me['full_name']} sửa luật cảnh báo {$rule->code}"]);

        return $this->success(DB::table('sm_log_alert_rules')->where('id', $id)->first(), 'Đã lưu');
    }
}
