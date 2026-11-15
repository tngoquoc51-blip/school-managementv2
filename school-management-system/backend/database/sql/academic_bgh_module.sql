-- =====================================================================
--  MODULE CHUYÊN MÔN – BAN GIÁM HIỆU  (school_db)
--  Chạy trong phpMyAdmin / HeidiSQL (Laragon) SAU khi đã nạp school_db_tong_hop.sql
--  An toàn chạy lại nhiều lần (CREATE IF NOT EXISTS + seed có kiểm tra).
--  Bảng mới đều dùng tiền tố sm_ để thống nhất với hệ thống hiện tại.
-- =====================================================================
SET NAMES utf8mb4;

-- 1) Tổ chuyên môn ----------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_subject_groups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `head_teacher_id` int unsigned DEFAULT NULL,
  `color` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#6366f1',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sm_sg_code` (`code`),
  KEY `idx_sm_sg_head` (`head_teacher_id`),
  CONSTRAINT `fk_sm_sg_head` FOREIGN KEY (`head_teacher_id`) REFERENCES `sm_teachers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sm_subject_group_subjects` (
  `group_id` int unsigned NOT NULL,
  `subject_id` int unsigned NOT NULL,
  PRIMARY KEY (`group_id`,`subject_id`),
  UNIQUE KEY `uq_sm_sgs_subject` (`subject_id`),
  CONSTRAINT `fk_sm_sgs_group` FOREIGN KEY (`group_id`) REFERENCES `sm_subject_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sm_sgs_subject` FOREIGN KEY (`subject_id`) REFERENCES `sm_subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Giáo án (BGH duyệt) ----------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_lesson_plans` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `teacher_id` int unsigned NOT NULL,
  `subject_id` int unsigned NOT NULL,
  `grade` tinyint NOT NULL,
  `week_no` tinyint NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending|approved|rejected|revision',
  `reviewer_id` bigint unsigned DEFAULT NULL,
  `reviewer_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sm_lp_status` (`status`,`submitted_at`),
  KEY `idx_sm_lp_teacher` (`teacher_id`),
  KEY `idx_sm_lp_subject` (`subject_id`),
  CONSTRAINT `fk_sm_lp_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `sm_teachers` (`id`),
  CONSTRAINT `fk_sm_lp_subject` FOREIGN KEY (`subject_id`) REFERENCES `sm_subjects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Dự giờ -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_class_observations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `teacher_id` int unsigned NOT NULL,
  `class_id` int unsigned NOT NULL,
  `subject_id` int unsigned NOT NULL,
  `observer_id` bigint unsigned DEFAULT NULL,
  `observer_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `observed_on` date NOT NULL,
  `period` tinyint NOT NULL,
  `lesson_title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `score` decimal(4,1) NOT NULL,
  `rating` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tốt|Khá|Đạt|Chưa đạt',
  `strengths` text COLLATE utf8mb4_unicode_ci,
  `improvements` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sm_obs_teacher` (`teacher_id`,`observed_on`),
  KEY `idx_sm_obs_date` (`observed_on`),
  CONSTRAINT `fk_sm_obs_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `sm_teachers` (`id`),
  CONSTRAINT `fk_sm_obs_class` FOREIGN KEY (`class_id`) REFERENCES `sm_classes` (`id`),
  CONSTRAINT `fk_sm_obs_subject` FOREIGN KEY (`subject_id`) REFERENCES `sm_subjects` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Đề xuất / yêu cầu chờ BGH phê duyệt -------------------------------
CREATE TABLE IF NOT EXISTS `sm_academic_requests` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'assignment_change|timetable|exam_schedule|grade_edit|other',
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `detail` text COLLATE utf8mb4_unicode_ci,
  `payload` json DEFAULT NULL,
  `requested_by` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal' COMMENT 'low|normal|high',
  `status` varchar(12) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending' COMMENT 'pending|approved|rejected',
  `decided_by` bigint unsigned DEFAULT NULL,
  `decided_by_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decision_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decided_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sm_ar_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
--  DỮ LIỆU KHỞI TẠO (chỉ chèn khi bảng còn trống)
-- =====================================================================

-- Tổ chuyên môn + môn thuộc tổ (tổ trưởng = giáo viên đầu tiên của môn chính)
INSERT INTO `sm_subject_groups` (`code`,`name`,`head_teacher_id`,`color`,`description`)
SELECT * FROM (
  SELECT 'TOAN_TIN' c,'Tổ Toán – Tin – Công nghệ' n,(SELECT MIN(id) FROM sm_teachers WHERE main_subject_id=1) h,'#6366f1' col,'Toán học, Tin học, Công nghệ' d UNION ALL
  SELECT 'VAN','Tổ Ngữ văn',(SELECT MIN(id) FROM sm_teachers WHERE main_subject_id=2),'#ec4899','Ngữ văn' UNION ALL
  SELECT 'NGOAI_NGU','Tổ Ngoại ngữ',(SELECT MIN(id) FROM sm_teachers WHERE main_subject_id=3),'#0ea5e9','Tiếng Anh' UNION ALL
  SELECT 'KHTN','Tổ Khoa học tự nhiên',(SELECT MIN(id) FROM sm_teachers WHERE main_subject_id=4),'#10b981','Vật lý, Hóa học, Sinh học' UNION ALL
  SELECT 'KHXH','Tổ Khoa học xã hội',(SELECT MIN(id) FROM sm_teachers WHERE main_subject_id=7),'#f59e0b','Lịch sử, Địa lý, GDCD' UNION ALL
  SELECT 'TDQP','Tổ Thể dục – QP-AN – HĐTN',(SELECT MIN(id) FROM sm_teachers WHERE main_subject_id=12),'#ef4444','Thể dục, GDQP-AN, Hoạt động trải nghiệm'
) x WHERE NOT EXISTS (SELECT 1 FROM sm_subject_groups);

INSERT IGNORE INTO `sm_subject_group_subjects` (`group_id`,`subject_id`)
SELECT g.id, s.id FROM sm_subject_groups g
JOIN sm_subjects s ON (
     (g.code='TOAN_TIN'  AND s.code IN ('TOAN','TIN','CN'))
  OR (g.code='VAN'       AND s.code IN ('VAN'))
  OR (g.code='NGOAI_NGU' AND s.code IN ('ANH'))
  OR (g.code='KHTN'      AND s.code IN ('LY','HOA','SINH'))
  OR (g.code='KHXH'      AND s.code IN ('SU','DIA','GDCD'))
  OR (g.code='TDQP'      AND s.code IN ('TD','GDQP','HDTN')));

-- Giáo án mẫu (24 giáo viên đầu)
INSERT INTO `sm_lesson_plans` (`teacher_id`,`subject_id`,`grade`,`week_no`,`title`,`note`,`status`,`reviewer_name`,`review_note`,`submitted_at`,`reviewed_at`)
SELECT t.id, t.main_subject_id, 10 + (t.id % 3), 8 + (t.id % 4),
       CONCAT('Giáo án tuần ', 8 + (t.id % 4), ' – ', s.name, ' khối ', 10 + (t.id % 3)),
       'Soạn theo chương trình GDPT 2018, có phiếu học tập và rubric đánh giá.',
       ELT(1 + (t.id % 4), 'pending', 'approved', 'pending', 'revision'),
       IF(t.id % 4 IN (1,3), NULL, 'Ban Giám hiệu'),
       CASE t.id % 4 WHEN 1 THEN 'Đạt yêu cầu, triển khai theo kế hoạch.' WHEN 3 THEN 'Bổ sung hoạt động vận dụng và phân hóa học sinh.' ELSE NULL END,
       NOW() - INTERVAL (t.id % 9) DAY,
       IF(t.id % 4 IN (1,3), NOW() - INTERVAL (t.id % 5) DAY, NULL)
FROM sm_teachers t JOIN sm_subjects s ON s.id = t.main_subject_id
WHERE t.id <= 24 AND NOT EXISTS (SELECT 1 FROM sm_lesson_plans);

-- Dự giờ mẫu
INSERT INTO `sm_class_observations` (`teacher_id`,`class_id`,`subject_id`,`observer_name`,`observed_on`,`period`,`lesson_title`,`score`,`rating`,`strengths`,`improvements`)
SELECT t.id, cs.class_id, t.main_subject_id, 'Ban Giám hiệu',
       CURDATE() - INTERVAL (t.id * 2) DAY, 1 + (t.id % 5),
       CONCAT('Bài giảng ', s.name, ' – tiết ', 1 + (t.id % 5)),
       6.5 + (t.id % 4) * 0.9,
       CASE WHEN 6.5 + (t.id % 4) * 0.9 >= 8 THEN 'Tốt' WHEN 6.5 + (t.id % 4) * 0.9 >= 6.5 THEN 'Khá' ELSE 'Đạt' END,
       'Tổ chức hoạt động nhóm hiệu quả, học sinh tham gia tích cực.',
       'Cần tăng thời gian luyện tập và phản hồi cá nhân.'
FROM sm_teachers t
JOIN sm_subjects s ON s.id = t.main_subject_id
JOIN sm_class_subjects cs ON cs.id = (SELECT MIN(c2.id) FROM sm_class_subjects c2 WHERE c2.teacher_id = t.id AND c2.class_id >= 19)
WHERE t.id <= 10 AND NOT EXISTS (SELECT 1 FROM sm_class_observations);

-- Đề xuất chờ phê duyệt: đề xuất đầu tiên là đổi giáo viên (có payload) – hệ thống tự chọn
-- một cặp lớp–môn/giáo viên KHÔNG trùng lịch nên khi BGH bấm "Phê duyệt" sẽ áp dụng được ngay.
INSERT INTO `sm_academic_requests` (`type`,`title`,`detail`,`payload`,`requested_by`,`priority`,`created_at`)
SELECT 'assignment_change',
       CONCAT('Đề nghị đổi GV dạy ', s.name, ' lớp ', c.name, ': ', t0.full_name, ' → ', t.full_name),
       'Tổ trưởng đề nghị điều chỉnh phân công để cân đối số tiết giữa các giáo viên cùng bộ môn.',
       JSON_OBJECT('class_subject_id', cs.id, 'new_teacher_id', t.id),
       'Tổ trưởng chuyên môn', 'high', NOW() - INTERVAL 1 DAY
FROM sm_class_subjects cs
JOIN sm_classes c ON c.id = cs.class_id AND c.school_year_id = (SELECT id FROM sm_school_years WHERE is_current = 1 ORDER BY id DESC LIMIT 1)
JOIN sm_subjects s ON s.id = cs.subject_id
JOIN sm_teachers t0 ON t0.id = cs.teacher_id
JOIN sm_teachers t ON t.main_subject_id = cs.subject_id AND t.id <> cs.teacher_id
WHERE NOT EXISTS (SELECT 1 FROM sm_timetable mine
                  JOIN sm_timetable o ON o.weekday = mine.weekday AND o.period = mine.period
                  JOIN sm_class_subjects cs2 ON cs2.id = o.class_subject_id AND cs2.teacher_id = t.id
                  WHERE mine.class_subject_id = cs.id)
  AND NOT EXISTS (SELECT 1 FROM sm_academic_requests)
ORDER BY cs.id, t.id LIMIT 1;

INSERT INTO `sm_academic_requests` (`type`,`title`,`detail`,`requested_by`,`priority`,`created_at`)
SELECT * FROM (
  SELECT 'timetable' t,'Điều chỉnh thời khóa biểu tuần 15' ti,'Hoán đổi tiết 3–4 thứ Năm của khối 11 do lịch họp tổ.' d,'Giáo vụ' r,'normal' p,NOW() - INTERVAL 2 DAY c UNION ALL
  SELECT 'exam_schedule','Đề xuất lịch thi cuối học kỳ 1 khối 12','Lịch thi 5 buổi, bố trí xen kẽ môn tự luận – trắc nghiệm.','Giáo vụ','high',NOW() - INTERVAL 3 DAY UNION ALL
  SELECT 'grade_edit','Đề nghị mở khóa sửa điểm giữa kỳ lớp 11A2','Giáo viên bộ môn nhập sai cột điểm GK, cần mở khóa 24 giờ.','Tổ trưởng Toán','normal',NOW() - INTERVAL 4 HOUR UNION ALL
  SELECT 'other','Đề xuất khen thưởng học sinh giỏi tháng 10','Danh sách 12 học sinh đạt thành tích cao trong kỳ thi HSG cấp trường.','Đoàn trường','low',NOW() - INTERVAL 5 DAY
) x WHERE (SELECT COUNT(*) FROM sm_academic_requests) = 1;

-- Đồng bộ bảng màu tổ chuyên môn với giao diện (chỉ đổi các màu mặc định cũ; chạy lại an toàn)
UPDATE `sm_subject_groups` SET `color` = CASE `code`
  WHEN 'TOAN_TIN' THEN '#2563eb' WHEN 'VAN' THEN '#7c3aed' WHEN 'NGOAI_NGU' THEN '#0891b2'
  WHEN 'KHTN' THEN '#059669' WHEN 'KHXH' THEN '#d97706' WHEN 'TDQP' THEN '#e11d48' ELSE `color` END
WHERE `color` IN ('#6366f1','#ec4899','#0ea5e9','#10b981','#f59e0b','#ef4444');
