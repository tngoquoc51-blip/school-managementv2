<?php

namespace Modules\Academic\Exceptions;

use RuntimeException;

/** Lỗi nghiệp vụ của module Lớp học (trả về cho client dưới dạng 4xx + message tiếng Việt). */
class ClassException extends RuntimeException
{
    public function __construct(string $message, int $code = 422, public readonly mixed $errors = null)
    {
        parent::__construct($message, $code);
    }
}
