-- =====================================================================
-- UNDO migration cho: 20261124090000_sprint3_quiz_attempts_and_ranking.sql
-- Lưu ý:
--   * Chạy thủ công trong Supabase SQL Editor khi cần rollback migration trên.
--   * KHÔNG đặt file này trong supabase/migrations/ để tránh `supabase db push`
--     tự động chạy nhầm khi deploy.
--   * Bước khôi phục submitted_at NOT NULL sẽ lỗi nếu còn lượt chưa nộp
--     (in_progress / abandoned có submitted_at = null): xóa hoặc chốt các lượt đó trước.
-- =====================================================================

begin;

-- 2. profiles
drop trigger if exists trg_profiles_check_username on public.profiles;
drop function if exists public.check_profile_username();
drop index if exists public.idx_profiles_public_active;

-- 1. user_quiz_attempts
drop index if exists public.idx_quiz_attempts_ranking;
drop index if exists public.uq_quiz_attempts_in_progress;

alter table public.user_quiz_attempts
  drop constraint if exists ck_quiz_attempts_question_order,
  drop constraint if exists ck_quiz_attempts_expires_at,
  drop constraint if exists ck_quiz_attempts_submitted_at;

alter table public.user_quiz_attempts
  alter column submitted_at set not null;

alter table public.user_quiz_attempts
  drop column if exists question_order,
  drop column if exists expires_at;

commit;
