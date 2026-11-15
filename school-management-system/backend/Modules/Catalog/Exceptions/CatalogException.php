<?php

namespace Modules\Catalog\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** Lỗi nghiệp vụ của module Danh mục — tự render thành JSON cùng định dạng ApiResponse. */
class CatalogException extends RuntimeException
{
    public function __construct(string $message, private int $status = 422, private ?array $errors = null)
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
            'errors' => $this->errors,
        ], $this->status);
    }
}
