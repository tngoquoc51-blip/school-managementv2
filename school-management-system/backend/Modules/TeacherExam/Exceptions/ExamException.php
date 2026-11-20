<?php

namespace Modules\TeacherExam\Exceptions;

use RuntimeException;

/** Lỗi nghiệp vụ có mã HTTP (403, 404, 409, 422...). */
class ExamException extends RuntimeException
{
    public function __construct(string $message, public int $status = 422)
    {
        parent::__construct($message);
    }
}
