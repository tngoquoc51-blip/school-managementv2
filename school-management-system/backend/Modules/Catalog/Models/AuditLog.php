<?php

namespace Modules\Catalog\Models;

use Illuminate\Database\Eloquent\Model;

/** Nhật ký thay đổi danh mục (tạo / sửa / xóa / khôi phục / nhập). */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'cat_audit_logs';

    protected $guarded = ['id'];

    protected $casts = ['before' => 'array', 'after' => 'array', 'restored_at' => 'datetime', 'entity_id' => 'integer'];
}
