-- =====================================================================
-- Tiến độ học theo user (lesson đã mở, nội dung đã học, điểm quiz)
-- Jira: SCRUM-54 (S2-BE-04)
--
--   * lesson_id = tên folder bài học trong Storage/LessonTemplate (slug kebab-case,
--     SCRUM-52). Bài học nằm ở file JSON, không có bảng lessons -> không có FK,
--     backend kiểm tra lesson tồn tại trước khi ghi.
--   * XP và streak dùng bảng có sẵn user_stats + user_daily_activity
--     (20261005090000_user_schema.sql).
--   * User chưa học bài nào = không có dòng nào -> API trả trạng thái rỗng.
--   * Frontend chỉ được đọc dữ liệu của mình; chỉ backend C# (role postgres) ghi.
--
-- Chạy sau 20261005090000_user_schema.sql, trong SQL Editor hoặc `supabase db push`.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. user_lesson_progress — mỗi (user, lesson) đã mở 1 dòng
-- ---------------------------------------------------------------------
create table public.user_lesson_progress (
  user_id          uuid         not null references public.profiles (id) on delete cascade,
  lesson_id        varchar(100) not null,
  status           varchar(12)  not null default 'in_progress',
  first_opened_at  timestamptz  not null default now(),
  last_studied_at  timestamptz  not null default now(),
  completed_at     timestamptz,
  quiz_attempts    integer      not null default 0,
  best_quiz_score  smallint,                          -- % đúng (0–100) cao nhất
  last_quiz_score  smallint,                          -- % đúng (0–100) lần gần nhất
  xp_earned        integer      not null default 0,   -- tổng XP nhận được từ bài này

  primary key (user_id, lesson_id),
  constraint ck_lesson_progress_lesson_id check (lesson_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_lesson_progress_status    check (status in ('in_progress', 'completed')),
  constraint ck_lesson_progress_completed check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint ck_lesson_progress_scores check (
    (best_quiz_score is null or best_quiz_score between 0 and 100)
    and (last_quiz_score is null or last_quiz_score between 0 and 100)
    and (quiz_attempts = 0) = (last_quiz_score is null)
  ),
  constraint ck_lesson_progress_non_negative check (quiz_attempts >= 0 and xp_earned >= 0),
  constraint ck_lesson_progress_timestamps   check (last_studied_at >= first_opened_at)
);

-- "Tiếp tục học": bài học gần nhất của user.
create index idx_lesson_progress_recent on public.user_lesson_progress (user_id, last_studied_at desc);

-- ---------------------------------------------------------------------
-- 2. user_content_progress — mục nội dung (content.json -> id) đã hoàn thành
-- ---------------------------------------------------------------------
create table public.user_content_progress (
  user_id       uuid         not null,
  lesson_id     varchar(100) not null,
  content_id    varchar(20)  not null,
  completed_at  timestamptz  not null default now(),

  primary key (user_id, lesson_id, content_id),
  foreign key (user_id, lesson_id)
    references public.user_lesson_progress (user_id, lesson_id) on delete cascade,
  constraint ck_content_progress_id check (content_id ~ '^[1-9][0-9]*$')
);

-- ---------------------------------------------------------------------
-- 3. user_quiz_attempts — lịch sử mỗi lần nộp quiz (điểm do backend chấm)
-- ---------------------------------------------------------------------
create table public.user_quiz_attempts (
  id             bigint       generated always as identity primary key,
  user_id        uuid         not null,
  lesson_id      varchar(100) not null,
  correct_count  smallint     not null,
  total_count    smallint     not null,
  score          smallint     not null,               -- % đúng (0–100)
  xp_awarded     integer      not null default 0,
  submitted_at   timestamptz  not null default now(),

  foreign key (user_id, lesson_id)
    references public.user_lesson_progress (user_id, lesson_id) on delete cascade,
  constraint ck_quiz_attempt_counts check (total_count > 0 and correct_count between 0 and total_count),
  constraint ck_quiz_attempt_score  check (score between 0 and 100),
  constraint ck_quiz_attempt_xp     check (xp_awarded >= 0)
);

create index idx_quiz_attempts_lesson on public.user_quiz_attempts (user_id, lesson_id, submitted_at desc);

-- ---------------------------------------------------------------------
-- 4. RLS — frontend chỉ đọc dữ liệu của mình, backend ghi
-- ---------------------------------------------------------------------
alter table public.user_lesson_progress  enable row level security;
alter table public.user_content_progress enable row level security;
alter table public.user_quiz_attempts    enable row level security;

revoke all on public.user_lesson_progress, public.user_content_progress, public.user_quiz_attempts
  from anon, authenticated;

grant select on public.user_lesson_progress, public.user_content_progress, public.user_quiz_attempts
  to authenticated;

create policy "lesson_progress: read own" on public.user_lesson_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "content_progress: read own" on public.user_content_progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "quiz_attempts: read own" on public.user_quiz_attempts
  for select to authenticated
  using ((select auth.uid()) = user_id);

commit;
