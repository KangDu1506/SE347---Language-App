-- =====================================================================
-- Sprint 3 (S3-01 · SCRUM-90): làm bài thi thử bất đồng bộ, bảng xếp hạng
-- và chặn username cấm ở cấp bảng.
--
--   1. user_quiz_attempts: expires_at, question_order, submitted_at chỉ bắt
--      buộc khi đã nộp; tối đa 1 lượt in_progress / user / đề; index BXH đề.
--   2. profiles: index user active + public cho BXH; trigger kiểm tra
--      username bằng is_valid_username (gồm danh sách tên cấm).
--
-- Tương thích ngược: lượt quiz của bài học (ProgressService) vẫn insert
-- không truyền submitted_at/status -> nhận default now() / 'submitted'.
-- Lượt in_progress phải truyền rõ submitted_at = null.
--
-- Chạy sau 20261111141500_learning_catalog_and_quizzes.sql, trong SQL Editor
-- hoặc `supabase db push`. Hoàn tác: supabase/undo/undo-20261124090000_...sql
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. user_quiz_attempts: vòng đời làm bài bất đồng bộ
-- ---------------------------------------------------------------------
alter table public.user_quiz_attempts
  add column if not exists expires_at     timestamptz,
  add column if not exists question_order jsonb;

-- Lượt in_progress chưa có thời điểm nộp. Giữ default now() cho luồng cũ.
alter table public.user_quiz_attempts
  alter column submitted_at drop not null;

alter table public.user_quiz_attempts
  drop constraint if exists ck_quiz_attempts_submitted_at,
  drop constraint if exists ck_quiz_attempts_expires_at,
  drop constraint if exists ck_quiz_attempts_question_order;

alter table public.user_quiz_attempts
  -- Đã nộp thì bắt buộc có submitted_at
  add constraint ck_quiz_attempts_submitted_at
    check (status <> 'submitted' or submitted_at is not null),
  -- expires_at = started_at + time_limit_seconds (null nếu đề không giới hạn thời gian)
  add constraint ck_quiz_attempts_expires_at
    check (expires_at is null or expires_at > started_at),
  -- Thứ tự question_id / option chốt lúc tạo lượt để F5 vẫn giữ nguyên
  add constraint ck_quiz_attempts_question_order
    check (question_order is null or jsonb_typeof(question_order) = 'array');

-- Mỗi user tối đa 1 lượt đang làm dở cho 1 đề
create unique index if not exists uq_quiz_attempts_in_progress
  on public.user_quiz_attempts (user_id, quiz_id)
  where status = 'in_progress' and quiz_id is not null;

-- BXH riêng của từng đề: điểm cao -> làm nhanh -> nộp sớm
create index if not exists idx_quiz_attempts_ranking
  on public.user_quiz_attempts (quiz_id, user_id, score desc, duration_seconds asc, submitted_at asc)
  where status = 'submitted' and quiz_id is not null;

-- ---------------------------------------------------------------------
-- 2. profiles: bảng xếp hạng & username cấm
-- ---------------------------------------------------------------------

-- Join nhanh khi dựng BXH tổng / BXH đề (chỉ user active + public)
create index if not exists idx_profiles_public_active
  on public.profiles (id)
  where status = 'active' and profile_visibility = 'public';

-- ck_profiles_username chỉ kiểm tra định dạng; user được grant update(username)
-- nên phải chặn tên cấm (admin, support, ...) ngay ở bảng.
create or replace function public.check_profile_username()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_username(new.username) then
    raise exception 'Username "%" không hợp lệ hoặc nằm trong danh sách tên cấm.', new.username
      using errcode = 'check_violation',
            constraint = 'ck_profiles_username_reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_check_username on public.profiles;
create trigger trg_profiles_check_username
before insert or update of username on public.profiles
for each row execute function public.check_profile_username();

commit;
