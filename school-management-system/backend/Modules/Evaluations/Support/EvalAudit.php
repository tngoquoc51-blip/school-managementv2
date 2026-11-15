<?php

namespace Modules\Evaluations\Support;

use Modules\Logs\Support\AuditLogger;

/**
 * Ghi mọi thao tác của module Dự giờ & Đánh giá vào Nhật ký trung tâm (sm_audit_logs, phân hệ "teacher").
 * Xem lại ở: BGH → Nhật ký → Nhật ký hoạt động (lọc theo đối tượng ev_observation / ev_plan ...).
 */
class EvalAudit
{
    public static function log(string $action, string $entityType, $entityId, ?string $label, string $summary,
                               ?array $old = null, ?array $new = null, string $severity = 'info'): void
    {
        AuditLogger::log([
            'module'       => 'teacher',
            'action'       => 'eval.' . $action,
            'entity_type'  => $entityType,
            'entity_id'    => $entityId,
            'entity_label' => $label,
            'summary'      => $summary,
            'old_values'   => $old,
            'new_values'   => $new,
            'severity'     => $severity,
        ]);
    }
}
