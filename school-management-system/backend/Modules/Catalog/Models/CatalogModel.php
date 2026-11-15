<?php

namespace Modules\Catalog\Models;

use Illuminate\Database\Eloquent\Model;

/** Model gốc của module. Danh mục dùng xóa thật + nhật ký (cho phép khôi phục), không dùng SoftDeletes
 *  để mã (code) có thể được tạo lại sau khi xóa. */
abstract class CatalogModel extends Model
{
    protected $guarded = ['id'];

    public function label(): string
    {
        $code = $this->getAttribute('code');
        return $code ? $code . ' — ' . $this->getAttribute('name') : (string) $this->getAttribute('name');
    }
}
