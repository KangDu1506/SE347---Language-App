-- =====================================================================
-- UNDO migration cho: 20261111141500_learning_catalog_and_quizzes.sql
-- Lưu ý:
--   * Bỏ qua mục 7 (các FK từ progress -> lessons/lesson_contents) theo yêu cầu.
--   * Chạy thủ công trong Supabase SQL Editor khi cần rollback migration trên.
--   * KHÔNG đặt file này trong supabase/migrations/ để tránh `supabase db push`
--     tự động chạy nhầm khi deploy.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Gỡ index bổ sung ở mục 5
-- ---------------------------------------------------------------------
drop index if exists public.idx_daily_activity_leaderboard;
drop index if exists public.idx_user_stats_leaderboard;

-- ---------------------------------------------------------------------
-- 2. Xóa các bảng chi tiết câu trả lời & ôn tập SRS mới tạo ở mục 4
-- ---------------------------------------------------------------------
drop table if exists public.user_content_reviews;
drop table if exists public.user_quiz_attempt_answers;

-- ---------------------------------------------------------------------
-- 3. Hoàn tác các thay đổi trên bảng cũ ở mục 4
-- ---------------------------------------------------------------------

-- user_quiz_attempts
drop index if exists public.idx_quiz_attempts_quiz;

alter table public.user_quiz_attempts
  drop constraint if exists ck_quiz_attempts_type_target,
  drop constraint if exists ck_quiz_attempts_version,
  drop constraint if exists ck_quiz_attempts_duration,
  drop constraint if exists ck_quiz_attempts_status,
  drop constraint if exists ck_quiz_attempts_type,
  drop constraint if exists fk_quiz_attempts_user;

-- Nếu đã từng phát sinh lượt làm standalone_quiz (lesson_id IS NULL) thì xóa trước khi bật lại NOT NULL.
delete from public.user_quiz_attempts
where lesson_id is null;

alter table public.user_quiz_attempts
  drop column if exists quiz_version,
  drop column if exists duration_seconds,
  drop column if exists started_at,
  drop column if exists status,
  drop column if exists attempt_type,
  drop column if exists quiz_id;

alter table public.user_quiz_attempts
  alter column lesson_id set not null;

-- learning_path_progress
drop index if exists public.idx_path_progress_record_status;

alter table public.learning_path_progress
  drop constraint if exists ck_path_progress_lesson_id;

alter table public.learning_path_progress
  drop column if exists lesson_id;

-- user_lesson_progress
drop index if exists public.idx_lesson_progress_user_status;

alter table public.user_lesson_progress
  drop column if exists path_record_id;

-- user_content_progress
alter table public.user_content_progress
  drop constraint if exists ck_content_progress_id;

alter table public.user_content_progress
  alter column content_id type varchar(20);

alter table public.user_content_progress
  add constraint ck_content_progress_id
  check (content_id ~ '^[1-9][0-9]*$');

-- ---------------------------------------------------------------------
-- 4. Xóa cụm bảng quiz & ngân hàng câu hỏi ở mục 3 (ngược thứ tự phụ thuộc)
-- ---------------------------------------------------------------------
drop table if exists public.question_content_links;
drop table if exists public.quiz_questions;
drop table if exists public.questions;
drop table if exists public.quizzes;

-- ---------------------------------------------------------------------
-- 5. Xóa cụm bảng lộ trình & học liệu ở mục 2 và mục 1
-- ---------------------------------------------------------------------
drop table if exists public.lesson_prerequisites;
drop table if exists public.learning_path_items;
drop table if exists public.learning_path_branches;
drop table if exists public.learning_paths;
drop table if exists public.lesson_contents;
drop table if exists public.lessons;

commit;
