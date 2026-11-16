-- =====================================================================
-- Chuẩn hóa học liệu, lộ trình, ngân hàng câu hỏi, phân tách bài kiểm tra
-- của bài học với bài kiểm tra ngoài, lưu chi tiết câu trả lời và ôn tập SRS
-- (Không bao gồm bài thi thử - trial exam).
--
-- Thiết kế tương thích ngược (non-breaking) với 3 migration trước và code C#
-- hiện tại (ProgressService, ApplicationDbContext):
--   * Các bảng hiện có vẫn hoạt động bình thường khi chưa seed dữ liệu vào
--     lessons/lesson_contents; các FK trỏ từ progress -> catalog được ghi
--     chú thích rõ để bật sau khi đồng bộ dữ liệu JSON vào DB.
--   * user_quiz_attempts giữ nguyên FK (user_id, lesson_id) với MATCH SIMPLE
--     nên khi lesson_id IS NULL (standalone_quiz) Postgres tự bỏ qua FK tới
--     user_lesson_progress, đồng thời vẫn kiểm tra user_id -> profiles(id).
--
-- Chạy sau 20261026120000_learning_paths.sql, trong SQL Editor hoặc `supabase db push`.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Học liệu bài học & nội dung (ánh xạ LessonConfig + LessonContent)
-- ---------------------------------------------------------------------
create table public.lessons (
  id                 varchar(100) primary key,
  name               varchar(200) not null,
  description        text         not null,
  category           varchar(20)  not null,
  topic              varchar(100) not null,
  cefr_level         varchar(2)   not null,
  sort_order         integer      not null,
  estimated_minutes  smallint     not null,
  image_path         varchar(255),
  content_settings   jsonb        not null default '{}'::jsonb,
  quiz_settings      jsonb        not null default '{}'::jsonb,
  is_published       boolean      not null default true,
  version            integer      not null default 1,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  constraint ck_lessons_id               check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_lessons_name             check (btrim(name) <> ''),
  constraint ck_lessons_description      check (btrim(description) <> ''),
  constraint ck_lessons_category         check (category in ('vocabulary', 'grammar', 'listening', 'speaking')),
  constraint ck_lessons_topic            check (btrim(topic) <> ''),
  constraint ck_lessons_cefr             check (cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  constraint ck_lessons_order            check (sort_order >= 1),
  constraint ck_lessons_minutes          check (estimated_minutes between 1 and 120),
  constraint ck_lessons_content_settings check (jsonb_typeof(content_settings) = 'object'),
  constraint ck_lessons_quiz_settings    check (jsonb_typeof(quiz_settings) = 'object'),
  constraint ck_lessons_version          check (version >= 1)
);

create index idx_lessons_catalog
  on public.lessons (category, cefr_level, sort_order)
  where is_published = true;

create index idx_lessons_topic
  on public.lessons (topic, sort_order)
  where is_published = true;

create trigger trg_lessons_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create table public.lesson_contents (
  lesson_id          varchar(100) not null references public.lessons (id) on delete cascade,
  id                 varchar(64)  not null,
  sort_order         integer      not null,
  content            text         not null,
  pronunciation_bre  varchar(120),
  pronunciation_name varchar(120),
  definition_en      text         not null,
  definition_vi      text         not null,
  oxford_link        varchar(512),
  external_sources   jsonb        not null default '[]'::jsonb,
  image_path         varchar(255),
  audio_path         varchar(255),
  examples           jsonb        not null default '[]'::jsonb,
  synonyms           jsonb        not null default '[]'::jsonb,
  antonyms           jsonb        not null default '[]'::jsonb,
  is_active          boolean      not null default true,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  primary key (lesson_id, id),
  constraint ck_lesson_contents_id       check (id ~ '^[a-zA-Z0-9]+([_-][a-zA-Z0-9]+)*$'),
  constraint ck_lesson_contents_order    check (sort_order >= 1),
  constraint ck_lesson_contents_text     check (btrim(content) <> '' and btrim(definition_en) <> '' and btrim(definition_vi) <> ''),
  constraint ck_lesson_contents_arrays   check (
    jsonb_typeof(external_sources) = 'array'
    and jsonb_typeof(examples) = 'array'
    and jsonb_typeof(synonyms) = 'array'
    and jsonb_typeof(antonyms) = 'array'
  )
);

create index idx_lesson_contents_order
  on public.lesson_contents (lesson_id, sort_order)
  where is_active = true;

create trigger trg_lesson_contents_updated_at
before update on public.lesson_contents
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. Cấu trúc lộ trình học & quan hệ nhiều-nhiều / điều kiện tiên quyết
--    (ánh xạ LearningPath.schema.json)
-- ---------------------------------------------------------------------
create table public.learning_paths (
  id            varchar(100) primary key,
  title         varchar(200) not null,
  description   text         not null,
  version       integer      not null default 1,
  is_published  boolean      not null default true,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),

  constraint ck_learning_paths_id      check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_learning_paths_title   check (btrim(title) <> ''),
  constraint ck_learning_paths_version check (version >= 1)
);

create trigger trg_learning_paths_updated_at
before update on public.learning_paths
for each row execute function public.set_updated_at();

create table public.learning_path_branches (
  learning_path_id  varchar(100) not null references public.learning_paths (id) on delete cascade,
  branch_id         varchar(100) not null,
  item_id           varchar(120) not null,
  title             varchar(200) not null,
  is_required       boolean      not null default true,
  after_lesson_id   varchar(100) references public.lessons (id) on delete set null,
  sort_order        integer      not null default 1,

  primary key (learning_path_id, branch_id),
  constraint uq_path_branches_item_id   unique (learning_path_id, item_id),
  constraint ck_path_branches_branch_id check (branch_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_path_branches_item_id   check (item_id ~ '^branch-[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_path_branches_title     check (btrim(title) <> ''),
  constraint ck_path_branches_order     check (sort_order >= 1)
);

-- Một bài học có thể xuất hiện ở nhiều lộ trình khác nhau (quan hệ M-N).
create table public.learning_path_items (
  learning_path_id  varchar(100) not null references public.learning_paths (id) on delete cascade,
  item_id           varchar(120) not null,
  lesson_id         varchar(100) not null references public.lessons (id) on delete restrict,
  branch_id         varchar(100),
  sort_order        integer      not null,

  primary key (learning_path_id, item_id),
  constraint uq_path_items_lesson   unique (learning_path_id, lesson_id),
  constraint ck_path_items_item_id  check (item_id ~ '^lesson-[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_path_items_order    check (sort_order >= 1),
  constraint fk_path_items_branch   foreign key (learning_path_id, branch_id)
    references public.learning_path_branches (learning_path_id, branch_id) on delete cascade
);

create index idx_path_items_lesson
  on public.learning_path_items (lesson_id);

-- Đồ thị điều kiện tiên quyết (DAG nhiều-nhiều) giữa các bài trong cùng lộ trình.
create table public.lesson_prerequisites (
  learning_path_id        varchar(100) not null,
  lesson_id               varchar(100) not null,
  prerequisite_lesson_id  varchar(100) not null,

  primary key (learning_path_id, lesson_id, prerequisite_lesson_id),
  constraint ck_lesson_prereq_no_self check (lesson_id <> prerequisite_lesson_id),
  constraint fk_lesson_prereq_target foreign key (learning_path_id, lesson_id)
    references public.learning_path_items (learning_path_id, lesson_id) on delete cascade,
  constraint fk_lesson_prereq_source foreign key (learning_path_id, prerequisite_lesson_id)
    references public.learning_path_items (learning_path_id, lesson_id) on delete cascade
);

create index idx_lesson_prereq_source
  on public.lesson_prerequisites (learning_path_id, prerequisite_lesson_id);

-- ---------------------------------------------------------------------
-- 3. Ngân hàng câu hỏi & phân biệt: Bài kiểm tra bài học vs Bài kiểm tra ngoài
--    (ánh xạ QuizConfig.schema.json + QuizContent.schema.json)
-- ---------------------------------------------------------------------
create table public.quizzes (
  id                        uuid         primary key default gen_random_uuid(),
  slug                      varchar(100) unique,
  quiz_scope                varchar(20)  not null,
  lesson_id                 varchar(100) references public.lessons (id) on delete cascade,
  creator_id                uuid         references public.profiles (id) on delete set null,
  title                     varchar(200) not null,
  description               text         not null default '',
  category                  varchar(20),
  topic                     varchar(100),
  cefr_level                varchar(2),
  visibility                varchar(12)  not null default 'public',
  time_limit_seconds        integer,
  pass_score                smallint     not null default 60,
  xp_reward                 integer      not null default 0,
  shuffle_questions         boolean      not null default false,
  shuffle_answers           boolean      not null default true,
  mix_with_lesson           boolean      not null default false,
  show_results_immediately  boolean      not null default true,
  allow_retake              boolean      not null default true,
  show_explanations         boolean      not null default true,
  is_published              boolean      not null default true,
  version                   integer      not null default 1,
  created_at                timestamptz  not null default now(),
  updated_at                timestamptz  not null default now(),

  constraint ck_quizzes_slug       check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_quizzes_scope      check (quiz_scope in ('lesson', 'standalone')),
  constraint ck_quizzes_title      check (btrim(title) <> ''),
  constraint ck_quizzes_category   check (category is null or category in ('vocabulary', 'grammar', 'listening', 'speaking')),
  constraint ck_quizzes_cefr       check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  constraint ck_quizzes_visibility check (visibility in ('private', 'unlisted', 'public')),
  constraint ck_quizzes_time_limit check (time_limit_seconds is null or time_limit_seconds >= 1),
  constraint ck_quizzes_pass_score check (pass_score between 0 and 100),
  constraint ck_quizzes_xp_reward  check (xp_reward >= 0),
  constraint ck_quizzes_version    check (version >= 1),
  -- Bài kiểm tra của bài học bắt buộc gắn lesson_id; bài kiểm tra ngoài không gắn lesson_id.
  constraint ck_quizzes_scope_target check (
    (quiz_scope = 'lesson' and lesson_id is not null and creator_id is null)
    or (quiz_scope = 'standalone' and lesson_id is null)
  )
);

create index idx_quizzes_lesson
  on public.quizzes (lesson_id)
  where lesson_id is not null;

create index idx_quizzes_standalone_public
  on public.quizzes (visibility, category, cefr_level, created_at desc)
  where quiz_scope = 'standalone' and is_published = true;

create index idx_quizzes_creator
  on public.quizzes (creator_id, created_at desc)
  where creator_id is not null;

create trigger trg_quizzes_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

create table public.questions (
  id               uuid         primary key default gen_random_uuid(),
  creator_id       uuid         references public.profiles (id) on delete set null,
  question_type    varchar(24)  not null,
  prompt           text         not null,
  options          jsonb,
  correct_answers  jsonb        not null,
  explanation      text         not null default '',
  translation      text         not null default '',
  audio_path       varchar(255),
  image_path       varchar(255),
  text_path        varchar(255),
  cefr_level       varchar(2),
  topic            varchar(100),
  is_public        boolean      not null default false,
  version          integer      not null default 1,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),

  constraint ck_questions_type    check (question_type in ('fill-in-the-blank', 'multiple-choice', 'single-choice', 'true-false')),
  constraint ck_questions_prompt  check (btrim(prompt) <> ''),
  constraint ck_questions_cefr    check (cefr_level is null or cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  constraint ck_questions_answers check (jsonb_typeof(correct_answers) = 'array' and jsonb_array_length(correct_answers) >= 1),
  constraint ck_questions_options_by_type check (
    case
      when question_type in ('single-choice', 'multiple-choice') then
        options is not null and jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2
      when question_type = 'true-false' then
        options is null
        and jsonb_array_length(correct_answers) = 1
        and (correct_answers ->> 0) in ('true', 'false')
      else
        options is null or jsonb_typeof(options) = 'array'
    end
  ),
  constraint ck_questions_single_choice check (
    question_type <> 'single-choice' or jsonb_array_length(correct_answers) = 1
  ),
  constraint ck_questions_version check (version >= 1)
);

create index idx_questions_creator
  on public.questions (creator_id, created_at desc)
  where creator_id is not null;

create index idx_questions_topic_level
  on public.questions (topic, cefr_level)
  where is_public = true;

create trigger trg_questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- Quan hệ M-N: một câu hỏi có thể dùng ở nhiều bài kiểm tra (trong bài học hoặc ngoài).
create table public.quiz_questions (
  quiz_id      uuid        not null references public.quizzes (id) on delete cascade,
  question_id  uuid        not null references public.questions (id) on delete restrict,
  question_no  integer     not null,
  question_key varchar(64) not null,
  points       smallint    not null default 1,

  primary key (quiz_id, question_id),
  constraint uq_quiz_questions_no  unique (quiz_id, question_no),
  constraint uq_quiz_questions_key unique (quiz_id, question_key),
  constraint ck_quiz_questions_no  check (question_no >= 1),
  constraint ck_quiz_questions_key check (btrim(question_key) <> ''),
  constraint ck_quiz_questions_pts check (points >= 1)
);

-- Quan hệ M-N: gắn câu hỏi với mục kiến thức (từ vựng / ngữ pháp) để phân tích điểm yếu.
create table public.question_content_links (
  question_id  uuid         not null references public.questions (id) on delete cascade,
  lesson_id    varchar(100) not null,
  content_id   varchar(64)  not null,

  primary key (question_id, lesson_id, content_id),
  constraint fk_qcl_content foreign key (lesson_id, content_id)
    references public.lesson_contents (lesson_id, id) on delete cascade
);

-- ---------------------------------------------------------------------
-- 4. Mở rộng bảng tiến độ & lịch sử làm bài hiện có (tương thích ngược)
-- ---------------------------------------------------------------------

-- Nới lỏng độ dài & định dạng content_id để hỗ trợ thêm slug/ID tổng quát.
alter table public.user_content_progress
  alter column content_id type varchar(64);

alter table public.user_content_progress
  drop constraint if exists ck_content_progress_id;

alter table public.user_content_progress
  add constraint ck_content_progress_id
  check (content_id ~ '^[a-zA-Z0-9]+([_-][a-zA-Z0-9]+)*$');

-- Bổ sung liên kết optional tới lần tham gia lộ trình & index lọc theo status.
alter table public.user_lesson_progress
  add column if not exists path_record_id uuid references public.learning_path_records (id) on delete set null;

create index if not exists idx_lesson_progress_user_status
  on public.user_lesson_progress (user_id, status);

alter table public.learning_path_progress
  add column if not exists lesson_id varchar(100);

alter table public.learning_path_progress
  drop constraint if exists ck_path_progress_lesson_id;

alter table public.learning_path_progress
  add constraint ck_path_progress_lesson_id
  check (lesson_id is null or lesson_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

create index if not exists idx_path_progress_record_status
  on public.learning_path_progress (record_id, status);

-- Nâng cấp user_quiz_attempts để phân biệt rõ 'lesson_quiz' vs 'standalone_quiz'.
alter table public.user_quiz_attempts
  alter column lesson_id drop not null;

alter table public.user_quiz_attempts
  add column if not exists quiz_id          uuid        references public.quizzes (id) on delete set null,
  add column if not exists attempt_type     varchar(20) not null default 'lesson_quiz',
  add column if not exists status           varchar(16) not null default 'submitted',
  add column if not exists started_at       timestamptz not null default now(),
  add column if not exists duration_seconds integer,
  add column if not exists quiz_version     integer     not null default 1;

alter table public.user_quiz_attempts
  drop constraint if exists fk_quiz_attempts_user;

alter table public.user_quiz_attempts
  add constraint fk_quiz_attempts_user
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.user_quiz_attempts
  drop constraint if exists ck_quiz_attempts_type,
  drop constraint if exists ck_quiz_attempts_status,
  drop constraint if exists ck_quiz_attempts_duration,
  drop constraint if exists ck_quiz_attempts_version,
  drop constraint if exists ck_quiz_attempts_type_target;

alter table public.user_quiz_attempts
  add constraint ck_quiz_attempts_type        check (attempt_type in ('lesson_quiz', 'standalone_quiz')),
  add constraint ck_quiz_attempts_status      check (status in ('in_progress', 'submitted', 'abandoned')),
  add constraint ck_quiz_attempts_duration    check (duration_seconds is null or duration_seconds >= 0),
  add constraint ck_quiz_attempts_version     check (quiz_version >= 1),
  add constraint ck_quiz_attempts_type_target check (
    (attempt_type = 'lesson_quiz' and lesson_id is not null)
    or (attempt_type = 'standalone_quiz' and lesson_id is null and quiz_id is not null)
  );

create index if not exists idx_quiz_attempts_quiz
  on public.user_quiz_attempts (user_id, quiz_id, submitted_at desc)
  where quiz_id is not null;

-- Chi tiết câu trả lời từng câu hỏi trong mỗi lượt làm bài (ánh xạ QuizRecord.schema.json).
create table public.user_quiz_attempt_answers (
  id                 bigint      generated always as identity primary key,
  attempt_id         bigint      not null references public.user_quiz_attempts (id) on delete cascade,
  question_id        uuid        references public.questions (id) on delete set null,
  question_key       varchar(64) not null,
  user_answer        jsonb       not null default '[]'::jsonb,
  is_correct         boolean     not null,
  time_spent_ms      integer,
  question_snapshot  jsonb,
  answered_at        timestamptz not null default now(),

  constraint uq_attempt_answers_key      unique (attempt_id, question_key),
  constraint ck_attempt_answers_user_ans check (jsonb_typeof(user_answer) = 'array'),
  constraint ck_attempt_answers_time     check (time_spent_ms is null or time_spent_ms >= 0),
  constraint ck_attempt_answers_snapshot check (question_snapshot is null or jsonb_typeof(question_snapshot) = 'object')
);

create index idx_attempt_answers_question
  on public.user_quiz_attempt_answers (question_id, is_correct)
  where question_id is not null;

-- Trạng thái ôn tập Flashcard / SRS (tách riêng khỏi user_content_progress để giữ nguyên logic hoàn thành bài).
create table public.user_content_reviews (
  user_id           uuid         not null references public.profiles (id) on delete cascade,
  lesson_id         varchar(100) not null,
  content_id        varchar(64)  not null,
  last_rating       varchar(10)  not null,
  repetitions       integer      not null default 0,
  lapses            integer      not null default 0,
  ease_factor       numeric(4,2) not null default 2.50,
  interval_days     integer      not null default 0,
  last_reviewed_at  timestamptz  not null default now(),
  next_review_at    timestamptz  not null default now(),

  primary key (user_id, lesson_id, content_id),
  constraint ck_content_reviews_lesson   check (lesson_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_content_reviews_content  check (content_id ~ '^[a-zA-Z0-9]+([_-][a-zA-Z0-9]+)*$'),
  constraint ck_content_reviews_rating   check (last_rating in ('know', 'again')),
  constraint ck_content_reviews_counts   check (repetitions >= 0 and lapses >= 0 and interval_days >= 0),
  constraint ck_content_reviews_ease     check (ease_factor >= 1.30),
  constraint ck_content_reviews_schedule check (next_review_at >= last_reviewed_at)
);

create index idx_content_reviews_due
  on public.user_content_reviews (user_id, next_review_at);

-- ---------------------------------------------------------------------
-- 5. Index bổ sung cho bảng xếp hạng (Ranking)
-- ---------------------------------------------------------------------
create index if not exists idx_user_stats_leaderboard
  on public.user_stats (total_xp desc, updated_at asc);

create index if not exists idx_daily_activity_leaderboard
  on public.user_daily_activity (activity_date, user_id)
  include (xp_earned);

-- ---------------------------------------------------------------------
-- 6. RLS & phân quyền Data API
--    Lưu ý bảo mật: correct_answers/explanation trong public.questions
--    chỉ cho chủ sở hữu bài tự tạo đọc trực tiếp; câu hỏi hệ thống do
--    backend C# (role postgres) phục vụ qua DTO đã lược bỏ đáp án.
-- ---------------------------------------------------------------------
alter table public.lessons                  enable row level security;
alter table public.lesson_contents          enable row level security;
alter table public.learning_paths           enable row level security;
alter table public.learning_path_branches   enable row level security;
alter table public.learning_path_items      enable row level security;
alter table public.lesson_prerequisites     enable row level security;
alter table public.quizzes                  enable row level security;
alter table public.questions                enable row level security;
alter table public.quiz_questions           enable row level security;
alter table public.question_content_links   enable row level security;
alter table public.user_quiz_attempt_answers enable row level security;
alter table public.user_content_reviews     enable row level security;

revoke all on public.lessons, public.lesson_contents, public.learning_paths,
              public.learning_path_branches, public.learning_path_items,
              public.lesson_prerequisites, public.quizzes, public.questions,
              public.quiz_questions, public.question_content_links,
              public.user_quiz_attempt_answers, public.user_content_reviews
  from anon, authenticated;

-- Học liệu & cấu trúc lộ trình: chỉ đọc các mục đã phát hành
grant select on public.lessons, public.lesson_contents, public.learning_paths,
                public.learning_path_branches, public.learning_path_items,
                public.lesson_prerequisites, public.quizzes, public.quiz_questions,
                public.question_content_links, public.user_quiz_attempt_answers,
                public.user_content_reviews
  to authenticated;

create policy "lessons: read published" on public.lessons
  for select to authenticated
  using (is_published = true);

create policy "lesson_contents: read published" on public.lesson_contents
  for select to authenticated
  using (is_active = true and exists (
    select 1 from public.lessons l where l.id = lesson_id and l.is_published = true
  ));

create policy "learning_paths: read published" on public.learning_paths
  for select to authenticated
  using (is_published = true);

create policy "path_branches: read published" on public.learning_path_branches
  for select to authenticated
  using (exists (
    select 1 from public.learning_paths p where p.id = learning_path_id and p.is_published = true
  ));

create policy "path_items: read published" on public.learning_path_items
  for select to authenticated
  using (exists (
    select 1 from public.learning_paths p where p.id = learning_path_id and p.is_published = true
  ));

create policy "lesson_prereq: read published" on public.lesson_prerequisites
  for select to authenticated
  using (exists (
    select 1 from public.learning_paths p where p.id = learning_path_id and p.is_published = true
  ));

-- Quizzes: đọc được quiz của bài học đang mở, quiz ngoài công khai hoặc do chính mình tạo
create policy "quizzes: read visible or own" on public.quizzes
  for select to authenticated
  using (
    (is_published = true and (quiz_scope = 'lesson' or visibility = 'public'))
    or creator_id = (select auth.uid())
  );

-- Questions: chỉ đọc trực tiếp câu hỏi do chính user tạo (tránh lộ đáp án câu hỏi hệ thống)
grant select on public.questions to authenticated;
create policy "questions: read own" on public.questions
  for select to authenticated
  using (creator_id = (select auth.uid()));

create policy "quiz_questions: read visible or own" on public.quiz_questions
  for select to authenticated
  using (exists (
    select 1 from public.quizzes q
    where q.id = quiz_id
      and ((q.is_published = true and (q.quiz_scope = 'lesson' or q.visibility = 'public'))
           or q.creator_id = (select auth.uid()))
  ));

create policy "question_content_links: read own or published" on public.question_content_links
  for select to authenticated
  using (exists (
    select 1 from public.lessons l where l.id = lesson_id and l.is_published = true
  ));

-- Lịch sử chi tiết đáp án & SRS flashcard: chỉ user tự đọc dữ liệu của mình (backend C# ghi)
create policy "attempt_answers: read own" on public.user_quiz_attempt_answers
  for select to authenticated
  using (exists (
    select 1 from public.user_quiz_attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid())
  ));

create policy "content_reviews: read own" on public.user_content_reviews
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 7. Ghi chú kích hoạt FK cứng sau khi đã seed dữ liệu từ Storage/LessonTemplate
--    vào các bảng public.lessons / public.lesson_contents / public.learning_paths:
--
--   alter table public.user_lesson_progress
--     add constraint fk_lesson_progress_lesson
--     foreign key (lesson_id) references public.lessons (id) on delete restrict;
--
--   alter table public.user_content_progress
--     add constraint fk_content_progress_item
--     foreign key (lesson_id, content_id) references public.lesson_contents (lesson_id, id) on delete cascade;
--
--   alter table public.user_content_reviews
--     add constraint fk_content_reviews_item
--     foreign key (lesson_id, content_id) references public.lesson_contents (lesson_id, id) on delete cascade;
--
--   alter table public.learning_path_progress
--     add constraint fk_path_progress_lesson
--     foreign key (lesson_id) references public.lessons (id) on delete set null;
-- ---------------------------------------------------------------------

commit;
