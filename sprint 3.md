# Sprint 3 Backlog & Audit — Wordfox (Language App)

> Tài liệu này gồm hai phần chính:
> 1. **Ghi chú rà soát toàn trang thuộc Sprint 2** (giữ nguyên hiện trạng kiểm tra của Sprint 2, đồng thời bổ sung rà soát chi tiết trang **Hồ sơ / tự sửa thông tin người dùng**, **nội dung bài học Speaking** và bảng tổng hợp **các API còn thiếu**).
> 2. **Kế hoạch & Backlog Sprint 3** cho các trọng tâm: **Bảng xếp hạng (Rankings)**, **Thi thử / Test rời bất đồng bộ (không phải host)** với đầy đủ các trang trung gian (Danh sách/Tìm kiếm → Thông tin bài → BXH của bài → Làm bài → Kết quả → Xem lại + Tạo/Sửa đề), **Chỉnh sửa thông tin hồ sơ người dùng**, **Nâng cấp loại nội dung bài học Speaking** (Gemini BYOK xử lý đầu vào → text, suy luận trả lời, đánh giá + Gradium phía web chỉ đọc lại đoạn text Gemini tạo ra), và **xử lý các điểm gãy/API còn thiếu từ Sprint 2**, với **1 bảng task gộp chung 3 nhóm BE / FE / OT**.

---

## Phần 1 (Của Sprint 2): Ghi chú hiện trạng & các điểm chưa hợp lý / chưa gọi API

Qua rà soát toàn bộ mã nguồn (`Pages/`, `wwwroot/js/`, `Endpoints/`, `Services/`, `Data/`, `supabase/`), hiện trạng các màn hình và luồng xử lý sau Sprint 2 còn các vấn đề cần lưu ý sau:

### 1. Các trang còn tĩnh / placeholder hoặc thiếu luồng chỉnh sửa của chính user

| Trang / Khu vực | Bằng chứng trong mã nguồn | Vấn đề hiện tại |
|---|---|---|
| **Hồ sơ & Tự chỉnh sửa thông tin user (`/Account/Profile`)** | [Pages/Account/Profile.cshtml](Pages/Account/Profile.cshtml), [wwwroot/js/profile.js](wwwroot/js/profile.js#L53-L55), [Endpoints/UserEndpoints.cs](Endpoints/UserEndpoints.cs), [Services/IUserService.cs](Services/IUserService.cs), [wwwroot/js/Shared/i18n.js](wwwroot/js/Shared/i18n.js#L52-L67) | Trang đã gọi thật `/api/users/me`, `/api/progress`, `/api/lessons` (có tự fallback gọi `POST /api/progress/init` nếu thiếu bản ghi), nhưng **chưa có tính năng sửa đổi thông tin của chính user**: nút `Chỉnh sửa hồ sơ` (`.profile-edit-button`) mới chỉ hiện toast `"Tính năng chỉnh sửa hồ sơ đang được hoàn thiện."`. Backend `UserEndpoints` mới chỉ có 3 endpoint `GET` (`username-available`, `me`, `{username}`), **chưa có API cập nhật** (`PATCH/PUT /api/users/me`) cho các trường schema đã cho phép (`username`, `display_name`, `bio`, `avatar_path` qua bucket `avatars`, `ui_locale`, `timezone`, `profile_visibility`, `user_settings`, `learning_reason`), chưa có luồng đổi mật khẩu/vô hiệu hóa tài khoản, và nút đổi giao diện/ngôn ngữ ở header mới lưu `localStorage`, chưa đồng bộ về server. |
| **Xếp hạng (`/Ranking`)** | [Pages/Ranking.cshtml](Pages/Ranking.cshtml), [wwwroot/js/ranking.js](wwwroot/js/ranking.js) | Không nằm trong phạm vi Sprint 2 (`docs/test/Sprint2.md#L42-L44`). `ranking.js` mới chỉ thêm class `page-ready`; HTML hard-code 4 dòng mẫu (`Mai Linh - 4,820`, `Trần Nam - 4,360`, `Hà Phương - 3,940`, `Nguyễn An (Bạn) - 2,840`), 3 tab `Tuần này`/`Tháng này`/`Tất cả` chưa gọi API; chưa kiểm tra `profile_visibility` hay cho phép bấm xem hồ sơ công khai (`/api/users/{username}`). |
| **Thi thử (`/TrialTest`)** | [Pages/TrialTest.cshtml](Pages/TrialTest.cshtml), [wwwroot/js/trialtest.js](wwwroot/js/trialtest.js) | Không nằm trong phạm vi Sprint 2. Hiện mới có 1 trang làm bài tĩnh (`"I usually ______ breakfast..."`, `"04 / 20"`, `"12:45"`, lưới 12 nút chết), **chưa có các trang trung gian cần thiết** (danh sách/tìm kiếm đề, trang thông tin đề, BXH của bài, trang làm bài thật, trang kết quả lưu DB, trang xem lại chi tiết). |
| **Tạo bài kiểm tra (`/CreateQuiz`)** | [Pages/CreateQuiz.cshtml](Pages/CreateQuiz.cshtml), [wwwroot/js/createquiz.js](wwwroot/js/createquiz.js) | `createquiz.js` mới chỉ thêm class `page-ready`. Form dùng `action="#"`, nhãn `"1 / 10"` và `"Chưa lưu"` là tĩnh; nút `Xóa`, `+ Thêm câu hỏi`, `Lưu bài kiểm tra` chưa có xử lý JS/API. Giao diện mới chỉ có mẫu 4 lựa chọn A/B/C/D, chưa hỗ trợ đủ 4 dạng câu hỏi, thời gian, hay quyền `private`/`unlisted`/`public`. |
| **Đăng nhập Google & Ghi nhớ đăng nhập** | [Pages/Account/Login.cshtml](Pages/Account/Login.cshtml#L60-L81), [wwwroot/js/login.js](wwwroot/js/login.js) | Nút `Google` (`.google-login`) và checkbox `Ghi nhớ đăng nhập` (`#rememberLogin`) có trên UI nhưng chưa gắn xử lý trong `login.js`. |

### 2. Các màn hình Sprint 2 đã chạy nhưng còn dữ liệu giả, sai logic thực tế hoặc đứt luồng

1. **Tồn tại hai trang chi tiết bài học song song & trang cũ sinh dữ liệu giả:**
   - Hệ thống đang có cả `/Lesson/{lessonId}` ([Pages/Lesson.cshtml](Pages/Lesson.cshtml), [wwwroot/js/lesson.js](wwwroot/js/lesson.js)) gọi API thật lẫn trang cũ `/LessonDetail/{id}` ([Pages/LessonDetail.cshtml](Pages/LessonDetail.cshtml), [wwwroot/js/lesson-detail.js](wwwroot/js/lesson-detail.js)).
   - `LessonDetail.cshtml` đọc thẳng file JSON trên server, không kiểm tra prerequisite qua `ILessonAccessService`, không ghi nhận `/api/progress/*`; nếu không tìm thấy bài thì tự sinh dữ liệu fallback giả (`IsFallback = true`, `PronunciationBre: "sample"`).
   - `LessonDetail.cshtml` (dòng 170, 311, 317) hiển thị phần thưởng giả **`+Math.Max(10, Contents.Count * 2) XP`** và **`3 Sao vàng cho bảng xếp hạng tuần`** — không khớp rule XP thật trong [Services/LearningResultService.cs](Services/LearningResultService.cs) (`+5 XP/mục`, `+10 XP/câu quiz đúng` ở lần đầu đạt ≥ 60%, `+20 XP` cho bài không có quiz) và hệ thống không có "Sao vàng".
2. **Đường dẫn `/MiniGame/{lessonId}` bị gãy (404) & chưa nối `/Lesson` với `/Result`:**
   - [Pages/Result.cshtml](Pages/Result.cshtml) và [wwwroot/js/result.js](wwwroot/js/result.js#L19) trỏ nút **Làm lại / Mini-game** về `/MiniGame/{lessonId}`, nhưng trong `Pages/` **không tồn tại `MiniGame.cshtml`** nên bấm sẽ gặp 404.
   - Bài quiz củng cố thực tế nằm cuối [Pages/Lesson.cshtml](Pages/Lesson.cshtml) (`#lesson-quiz`), còn `lesson.js` chấm xong lại render kết quả inline thay vì dùng `QuizResult.save()` điều hướng sang `/Result/{lessonId}`. Ngoài ra `Result.cshtml` / [quiz-result.js](wwwroot/js/Shared/quiz-result.js#L7-L8) chỉ giữ chi tiết bài làm trong `sessionStorage`, đóng tab là mất (chưa có API lấy lại lịch sử bài làm từ DB).
3. **Trang Học tập (`/Study`) còn dữ liệu hard-code lúc SSR và nuốt lỗi tiến độ:**
   - [Pages/Study.cshtml](Pages/Study.cshtml#L38-L41) hard-code nhãn **`A2`**, **`Lộ trình Sơ cấp`** và **`1.247 từ Oxford`**.
   - `LoadBoardNodes()` ([Study.cshtml](Pages/Study.cshtml#L373-L379), dòng 449) hard-code bài `order 1, 2` là `"done"`, `order 3` là `"current"`, còn lại `"locked"`. Trước khi JS gọi `/api/progress` xong (hoặc khi lỗi mạng vì `loadBoardProgress()` ở [study.js](wwwroot/js/study.js#L541-L543) có `catch {}` rỗng), người dùng vẫn thấy `"2/26 bài đã học"`.
   - `branchCoords` ([Study.cshtml](Pages/Study.cshtml#L399-L406)) hard-code vị trí và tên tiếng Việt cho 5 `lessonId` nhánh cụ thể; khối **"Gợi ý bài học ngoài lộ trình"** ([Study.cshtml](Pages/Study.cshtml#L225-L283)) hard-code 3 bài tĩnh với XP lệch backend (`+16 XP`, `+30 XP`, `+20 XP`).
4. **Lệch danh mục `"speaking"` & thiếu phần thực hành nói cho bài Speaking:**
   - [LessonConfig.schema.json](Storage/LessonTemplate/schemas/LessonConfig.schema.json#L29), [sync-templates.js](supabase/sync-templates.js#L36) và nhiều bài trong `ProgressiveLearning-A` (`simple-greetings-1`, `advanced-greetings-1`, ...) đã khai báo `"category": "speaking"`.
   - Tuy nhiên [LessonConstants.cs](DTOs/Lesson/LessonConstants.cs#L6-L13) chỉ khai báo `LessonCategories.All = ["vocabulary", "grammar", "listening"]`, dẫn tới `GET /api/lessons?category=speaking` bị `400 Bad Request`; [lesson.js](wwwroot/js/lesson.js#L10) cũng thiếu `speaking` trong `CATEGORY_KEYS`.
   - Về mặt trải nghiệm học: trên `/Lesson/{lessonId}` và `LessonContent.schema.json`, các bài `speaking` hiện mới hiển thị thụ động như thẻ từ vựng/câu đọc nghĩa + nút `speechSynthesis` của trình duyệt, **chưa có luồng luyện nói tương tác** (thu âm giọng nói người học, chuyển audio → text, phản hồi hội thoại, đánh giá câu nói và đọc lại câu trả lời bằng giọng đọc chất lượng).
5. **Lệch quy tắc khóa bài học (prerequisites) giữa UI và Backend:**
   - UI `Study.cshtml` / `study.js` coi mạch chính 21 bài là chuỗi tiên quyết liên tiếp (`bài i` khóa bởi `bài i-1`) và hiện icon 🔒.
   - Backend `LessonService.LoadPrerequisites()` ([LessonService.cs](Services/LessonService.cs#L324-L331)) chỉ đọc trường `"prerequisites"` trong `LearningPath.json`, mà 21 bài mạch chính không khai báo trường này — dẫn tới `ILessonAccessService` thực tế chỉ khóa 5 bài nhánh, còn các bài mạch chính vẫn truy cập thẳng qua URL/API được.
6. **Flashcard (`/Flashcard`) chưa đồng bộ 2 chiều và chưa hỗ trợ audio:**
   - [wwwroot/js/flashcard.js](wwwroot/js/flashcard.js) lưu `"Nhớ"` / `"Chưa nhớ"` vào `localStorage`; chỉ gửi 1 chiều `POST .../contents/{contentId}/complete` khi bấm `"Nhớ"`, chưa tải lại các mục đã học từ server lúc mở thẻ, chưa ghi nhận `"again"` hay dùng bảng SRS `user_content_reviews`, chưa gắn phát audio.
7. **Dashboard (`/Index`) gọi dư request xác thực gợi ý:**
   - Do `GET /api/lessons` chưa trả cờ `isLocked` theo user, [dashboard-data.js](wwwroot/js/dashboard-data.js#L188-L214) phải gọi thêm tới 4 request `GET /api/lessons/{lessonId}` mỗi lần tải trang chủ để tự lọc bài khóa/thiếu.

### 3. Bất hợp lý về bảo vệ trang, dữ liệu DB & nghiệp vụ nền

1. **Bảo vệ trang phía client chưa đồng nhất:**
   - [wwwroot/js/auth-guard.js](wwwroot/js/auth-guard.js#L5-L17) vẫn chấp nhận `sessionStorage.getItem('userToken') === 'authenticated'` để mở trang; `Lesson.cshtml`, `Flashcard.cshtml`, `Result.cshtml` chưa nạp `auth-guard.js`; `Study.cshtml` và `LessonDetail.cshtml` vẫn xuất HTML SSR nội dung bài trước khi kiểm tra phiên.
2. **Khoảng trống giữa migration DB và code C# hiện tại:**
   - Migration [20261111141500_learning_catalog_and_quizzes.sql](supabase/migrations/20261111141500_learning_catalog_and_quizzes.sql) và `20261026120000_learning_paths.sql` đã có bảng cho catalog, lộ trình, `quizzes`, `questions`, `quiz_questions`, `user_quiz_attempt_answers`, `user_content_reviews`, index leaderboard; nhưng [ApplicationDbContext.cs](Data/ApplicationDbContext.cs) chưa ánh xạ các bảng này, `LessonService` vẫn đọc JSON ổ đĩa và `ProgressService.RecordQuizAttemptAsync` chưa ghi `user_quiz_attempt_answers` hay `quiz_id`/`attempt_type`.
3. **Thiếu luồng trao huy hiệu, ghi nhận thời gian học & trang lỗi:**
   - Bảng `achievements` đã seed 10 huy hiệu ở [20261005090000_user_schema.sql](supabase/migrations/20261005090000_user_schema.sql#L254-L266) nhưng chưa có service tự xét thưởng; cột `user_daily_activity.practice_seconds` luôn bằng `0` vì chưa ghi nhận thời lượng học.
   - `UserService.IsUsernameAvailableAsync` dùng SQL thô `public.is_username_available(...)` (không chạy trên EF InMemory); quyền `grant update(username)` ở `20261005090000_user_schema.sql` chưa có trigger/check chặn từ cấm ở cấp bảng ([README.md](README.md#L27)); chưa có `Pages/Error.cshtml` / `UseStatusCodePages` / `UseExceptionHandler`.

### 4. Tổng hợp các API còn thiếu trên hệ thống hiện tại

Đối chiếu các file trong `Endpoints/` (`UserEndpoints`, `AuthEndpoints`, `ProgressEndpoints`, `LessonEndpoints`, `HealthEndpoints`), `appsettings.json` và `wwwroot/js/Shared/api.js`:

| Nhóm chức năng | API / Client method đang thiếu | Ảnh hưởng thực tế |
|---|---|---|
| **Hồ sơ & Tự sửa thông tin user** | • `PATCH /api/users/me` (sửa `displayName`, `username`, `bio`, `uiLocale`, `timezone`, `profileVisibility`, `user_settings`, `learningReason`)<br>• `POST /api/users/me/avatar` & `DELETE /api/users/me/avatar` (lưu vào bucket `avatars`)<br>• Luồng đổi mật khẩu / vô hiệu hóa hoặc xóa mềm tài khoản (`DELETE /api/users/me`) | User không thể tự đổi tên, bio, avatar, mục tiêu ngày, nhắc học hay chuyển `profile_visibility` từ `private` sang `public`; đổi ngôn ngữ/theme ở header chỉ lưu `localStorage`, không lưu lên DB; nút sửa hồ sơ ở `/Account/Profile` là placeholder. |
| **Nội dung bài học Speaking (Gemini BYOK + Gradium TTS)** | • `POST /api/speaking/tts` (endpoint phía server dùng API key **Gradium** của web để đọc lại đoạn text phản hồi do Gemini sinh ra)<br>• Luồng xử lý Speaking qua **Gemini BYOK** (nhận audio người học → text transcript, suy luận trả lời, đánh giá; key Gemini do user tự cung cấp) | Bài `speaking` trên `/Lesson` hiện chỉ hiển thị thụ động, chưa luyện nói/ghi âm, chưa có đánh giá AI hay đọc phản hồi bằng Gradium; chưa có cấu hình `Gradium` phía server trong `appsettings.json` / `Program.cs`. |
| **Client HTTP wrapper (`api.js`)** | • `AppApi.put`, `AppApi.patch`, `AppApi.delete` (và helper trả `Blob`/audio stream cho TTS) | [wwwroot/js/Shared/api.js](wwwroot/js/Shared/api.js#L65-L69) mới có `get` và `post`, chỉ parse text/JSON, chưa hỗ trợ cập nhật/xóa REST hay nhận binary audio stream. |
| **Bảng xếp hạng (Rankings)** | • `GET /api/rankings?period=week\|month\|all&limit=...` | `/Ranking` đang hiển thị dữ liệu HTML giả 100%. |
| **Thi thử / Test rời bất đồng bộ** | • `GET /api/quizzes` (danh sách, tìm kiếm, lọc)<br>• `GET /api/quizzes/{idOrSlug}` (thông tin đề + lịch sử cá nhân)<br>• `GET /api/quizzes/{idOrSlug}/ranking` (BXH riêng từng bài)<br>• `POST /api/quizzes/{idOrSlug}/attempts` (tạo mới / resume bài làm)<br>• `PUT /api/quiz-attempts/{attemptId}/answers` (lưu nháp khi làm)<br>• `POST /api/quiz-attempts/{attemptId}/submit` (nộp & chấm server)<br>• `GET /api/quiz-attempts/{attemptId}` (kết quả & xem lại chi tiết từ DB)<br>• `POST /api/quizzes`, `PUT /api/quizzes/{id}`, `DELETE /api/quizzes/{id}` | `/TrialTest` và `/CreateQuiz` hoàn toàn tĩnh; chưa có API lưu nháp, chống gian lận thời gian, xem kết quả/xem lại bền vững từ DB hay BXH riêng cho từng bài test. |
| **Học tập & Tiến độ (nợ Sprint 2)** | • `GET /api/learning-paths` / `.../board` (lộ trình & trạng thái từng node)<br>• `GET /api/progress/lessons/{lessonId}/quiz/attempts` (lịch sử làm quiz bài học)<br>• API lưu SRS Flashcard (`user_content_reviews`), ghi nhận `practice_seconds`, dùng `streak_freezes`, xét thưởng `user_achievements` | `Study.cshtml` còn SSR/hard-code; `Result.cshtml` mất dữ liệu chi tiết khi đóng tab (`sessionStorage`); `practice_seconds = 0`; 10 huy hiệu đã seed nhưng không tự trao. |

---

## Phần 2: Kế hoạch & Backlog Sprint 3

### 1. Phạm vi và mục tiêu Sprint 3

Sprint 3 tập trung triển khai hoàn chỉnh **Bảng xếp hạng (Rankings)**, **Thi thử / Test rời bất đồng bộ (không phải host)** với đầy đủ các màn hình trung gian, **Chỉnh sửa thông tin hồ sơ của chính người dùng**, **Nội dung bài học Speaking (Gemini BYOK + Gradium TTS)**, đồng thời xử lý các tồn đọng API/UI từ Sprint 2 có liên kết trực tiếp:

1. **Quản lý & Tự chỉnh sửa Hồ sơ người dùng (`/Account/Profile`):**
   - Cho phép user `active` tự chỉnh sửa thông tin cá nhân (`displayName`, `username`, `bio`, `avatar`, `uiLocale`, `timezone`), cài đặt học tập (`dailyGoalXp`, `theme`, `soundEnabled`, `reminderEnabled`, `reminderTime`, `learningReason`) và quyền hiển thị (`profile_visibility`: `public` ↔ `private`) để tham gia Bảng xếp hạng.
   - Cho phép xem hồ sơ công khai người khác qua `/api/users/{username}` (khi bấm vào người học trên Bảng xếp hạng) và hỗ trợ đổi mật khẩu / vô hiệu hóa tài khoản an toàn.
2. **Bảng xếp hạng tổng (Rankings — `/Ranking`):**
   - Triển khai API + UI cho 3 kỳ: **Tuần này**, **Tháng này**, **Tất cả**, dựa trên `user_stats` và `user_daily_activity` (cùng `idx_user_stats_leaderboard`, `idx_daily_activity_leaderboard`).
   - Chỉ công khai người dùng `status = 'active'` và `profile_visibility = 'public'`; luôn trả kèm thứ hạng cá nhân của người đang đăng nhập và nhắc bật `public` nếu đang để `private`.
3. **Thi thử — Test rời bất đồng bộ (Standalone Asynchronous Quiz — không phải host):**
   - Người học tự tìm, xem thông tin, bắt đầu làm bài, lưu nháp, nộp bài theo nhịp độ cá nhân (không có chủ phòng/host điều phối hay WebSocket realtime); đồng hồ đếm ngược căn cứ theo `started_at` + `time_limit_seconds` trên server.
   - Đầy đủ **luồng 6 màn hình + trang biên soạn đề**:
     1. **Trang Danh sách & Tìm kiếm** (`/TrialTest`): tìm kiếm theo từ khóa, lọc theo chủ đề (`vocabulary`/`grammar`/`listening`/`speaking`), trình độ CEFR, phạm vi (`Hệ thống` / `Cộng đồng` / `Đề của tôi`), trạng thái làm bài.
     2. **Trang Thông tin bài thi** (`/TrialTest/{idOrSlug}`): mô tả đề, tác giả, số câu, giới hạn thời gian, điểm đạt, XP thưởng, cấu hình cho làm lại/xem giải thích, trạng thái lượt làm dở (nút **Tiếp tục** hoặc **Bắt đầu làm bài**), lịch sử làm bài của cá nhân, liên kết tới **BXH của bài**.
     3. **Trang Bảng xếp hạng của bài** (`/TrialTest/{idOrSlug}/Ranking`): top thí sinh công khai đạt điểm cao nhất (tie-break theo thời gian làm ngắn hơn và nộp sớm hơn) + vị trí của bản thân.
     4. **Trang Làm bài** (`/TrialTest/{idOrSlug}/Take`, ẩn header/footer): hỗ trợ 4 loại câu hỏi (`single-choice`, `multiple-choice`, `true-false`, `fill-in-the-blank`), bản đồ câu hỏi + đánh dấu xem lại, auto-save nháp lên server để F5/đổi thiết bị vẫn làm tiếp được, đồng hồ theo `expiresAt` server.
     5. **Trang Kết quả** (`/TrialTest/Result/{attemptId}`): đọc bền vững từ DB, hiển thị điểm, đạt/chưa đạt, thời gian làm, XP nhận được, hạng trên BXH của bài, CTA đi **Xem lại**, **BXH của bài**, **Làm lại**.
     6. **Trang Xem lại chi tiết bài làm** (`/TrialTest/Review/{attemptId}`): xem lại từng câu theo đúng thứ tự lúc làm (`question_order`), lọc `Tất cả / Đúng / Sai / Bỏ trống`, đối chiếu đáp án chọn vs đáp án đúng + giải thích/dịch nghĩa.
     7. **Trang Tạo & Sửa đề** (`/CreateQuiz` & `/CreateQuiz/{id?}`): biên soạn đề `private` / `unlisted` (chia sẻ link) / `public` với đủ 4 dạng câu hỏi.
4. **Nội dung bài học Speaking (`/Lesson/{lessonId}` — Gemini BYOK + Gradium TTS):**
   - **Speaking là một loại nội dung bài học** (áp dụng cho bài học `category = "speaking"` hoặc các mục thực hành nói trong bài học, tích hợp trực tiếp trên trang `/Lesson/{lessonId}`).
   - **Gemini (BYOK — Bring Your Own Key):** người dùng tự nhập Gemini API Key cá nhân (chỉ lưu cục bộ ở trình duyệt `localStorage`/`sessionStorage`, không lưu lên DB server). Khi người học thu âm giọng nói qua micro ở một mục/tình huống Speaking, Gemini thực hiện trọn 3 tác vụ theo ngữ cảnh bài học:
     1. **Xử lý đầu vào thành text** (`transcript` từ audio người học nói).
     2. **Suy luận trả lời** (`replyText` — phản hồi/đối đáp tự nhiên phù hợp chủ đề và trình độ CEFR của bài học).
     3. **Đánh giá cho người dùng** (`evaluation` — nhận xét phát âm, ngữ pháp, từ vựng, độ tự nhiên, điểm gợi ý và câu diễn đạt mẫu tốt hơn).
   - **Gradium (dùng key của Web):** cấu hình API key Gradium ở backend web, **CHỈ dùng để tổng hợp giọng nói (TTS) đọc lại chính đoạn text phản hồi mà Gemini vừa tạo ra (`replyText`)**, không dùng Gradium cho các bước khác và không lộ key Gradium xuống trình duyệt.
5. **Dọn nợ chặn đường từ Sprint 2:**
   - Mở rộng `AppApi` (`put`, `patch`, `delete`, audio blob), gỡ link chết `/MiniGame/{id}` (nối thống nhất `/Lesson#lesson-quiz` ↔ `/Result` và thêm API đọc lại lịch sử kết quả bài học từ DB), gỡ số liệu/XP/sao giả trên `Study.cshtml` & `LessonDetail.cshtml`, đồng nhất `auth-guard.js`.

---

### 2. Kiến trúc dữ liệu, Route & API Sprint 3

#### 2.1. Dữ liệu, Schema & Migration bổ sung
Tận dụng schema đã có ở [20261111141500_learning_catalog_and_quizzes.sql](supabase/migrations/20261111141500_learning_catalog_and_quizzes.sql) (`lessons`, `lesson_contents`, `quizzes`, `questions`, `quiz_questions`, `user_quiz_attempts`, `user_quiz_attempt_answers`) và bổ sung EF Core entities vào `Models/` + `Data/ApplicationDbContext.cs` (đặt `ExcludeFromMigrations()`).

Migration SQL & chuẩn hóa cấu hình bổ sung cho Sprint 3:
- Trên `public.user_quiz_attempts`:
  - Thêm `expires_at timestamptz` (tính từ `started_at + time_limit_seconds` khi đề có giới hạn thời gian) và `question_order jsonb` (lưu thứ tự `question_id`/option khi khởi tạo để F5 vẫn giữ đúng thứ tự câu).
  - Cho phép `submitted_at` nhận `NULL` khi `status = 'in_progress'` (chỉ ghi `submitted_at` khi nộp bài, thêm check `(status <> 'submitted') or (submitted_at is not null)`).
  - Tạo partial unique index `uq_quiz_attempts_in_progress on public.user_quiz_attempts (user_id, quiz_id) where status = 'in_progress' and quiz_id is not null` để mỗi người chỉ có tối đa 1 lượt làm dở cho 1 đề tại một thời điểm.
  - Tạo partial index `idx_quiz_attempts_ranking on public.user_quiz_attempts (quiz_id, user_id, score desc, duration_seconds asc, submitted_at asc) where status = 'submitted' and quiz_id is not null` phục vụ truy vấn **BXH riêng của từng bài thi**.
- Trên `public.profiles`:
  - Đồng bộ trigger kiểm tra từ cấm từ `is_valid_username` khi cập nhật `username` ở bảng `profiles`.
  - Tạo partial index `idx_profiles_public_active on public.profiles (id) where status = 'active' and profile_visibility = 'public'` phục vụ join nhanh khi dựng Bảng xếp hạng tổng và Bảng xếp hạng từng bài.
- Trên dữ liệu & cấu hình Speaking:
  - Chuẩn hóa [DTOs/Lesson/LessonConstants.cs](DTOs/Lesson/LessonConstants.cs) bổ sung `"speaking"`; tận dụng trường `content-settings` trong [LessonConfig.schema.json](Storage/LessonTemplate/schemas/LessonConfig.schema.json) (hoặc trường mở rộng optional trong `LessonContent.schema.json`) để khai báo ngữ cảnh hội thoại speaking (`aiRole`, `scenario`, `evaluationFocus`, `samplePrompt`) cho bài `speaking` mà không phá các bài cũ.
  - Thêm section cấu hình `Gradium` trong [appsettings.json](appsettings.json) (`BaseUrl`, `VoiceId`, `OutputFormat`), còn `Gradium:ApiKey` lưu qua User Secrets / biến môi trường server.

#### 2.2. Sơ đồ Route các trang Sprint 3
| Màn hình | Route đề xuất | Bố cục (`_Layout`) | Ghi chú chuyển đổi |
|---|---|---|---|
| **Bài học & Nội dung Speaking** | `/Lesson/{lessonId}` (`Pages/Lesson.cshtml`) | Có Header & Footer | Giữ nguyên route; bổ sung module luyện nói tương tác (ghi âm → Gemini BYOK → Gradium TTS đọc phản hồi) khi bài có `category = "speaking"` hoặc nội dung speaking. |
| **Danh sách & Tìm kiếm Thi thử** | `/TrialTest` (`Pages/TrialTest/Index.cshtml`) | Có Header & Footer | Thay thế/chuyển [Pages/TrialTest.cshtml](Pages/TrialTest.cshtml) cũ thành `Pages/TrialTest/Index.cshtml` để tránh đụng route khi bấm menu **Thi thử** trên `_Header.cshtml`. |
| **Thông tin bài thi** | `/TrialTest/{idOrSlug}` (`Pages/TrialTest/Detail.cshtml`) | Có Header & Footer | Hiển thị metadata, lịch sử làm bài của mình, CTA làm/tiếp tục bài, nút Sửa (nếu là creator) và link sang BXH bài. |
| **BXH riêng của bài thi** | `/TrialTest/{idOrSlug}/Ranking` (`Pages/TrialTest/Ranking.cshtml`) | Có Header & Footer | Top điểm cao & thời gian nhanh của đề + vị trí hiện tại của bạn. |
| **Làm bài bất đồng bộ** | `/TrialTest/{idOrSlug}/Take` (`Pages/TrialTest/Take.cshtml`) | Ẩn Header & Footer | Giao diện tập trung làm bài, nhận thêm `?attemptId=` nếu resume. |
| **Kết quả bài thi** | `/TrialTest/Result/{attemptId}` (`Pages/TrialTest/Result.cshtml`) | Có Header & Footer | Hiển thị tổng quan kết quả lưu bền vững từ DB. |
| **Xem lại bài làm** | `/TrialTest/Review/{attemptId}` (`Pages/TrialTest/Review.cshtml`) | Có Header & Footer | Chi tiết từng câu hỏi, đáp án đã chọn, đáp án đúng và giải thích. |
| **Tạo / Sửa bài thi** | `/CreateQuiz/{id?}` (`Pages/CreateQuiz.cshtml`) | Có Header & Footer | Dùng chung form biên soạn cho tạo mới và sửa đề của tác giả. |
| **Bảng xếp hạng tổng** | `/Ranking` (`Pages/Ranking.cshtml`) | Có Header & Footer | Tab `Tuần này` / `Tháng này` / `Tất cả`, có thể mở xem hồ sơ công khai của user. |
| **Hồ sơ & Chỉnh sửa** | `/Account/Profile` (`Pages/Account/Profile.cshtml`) | Có Header & Footer | Modal/tab chỉnh sửa thông tin cá nhân, avatar, cài đặt, bảo mật tài khoản và quản lý Gemini BYOK key cục bộ (tùy chọn). |

#### 2.3. Nhóm API & Luồng AI Sprint 3
1. **Hồ sơ & Tự chỉnh sửa thông tin user (`/api/users/*`):**
   - `PATCH /api/users/me` (`RequireAuthorization`): cập nhật thông tin của chính user (`displayName`, `username`, `bio`, `uiLocale`, `timezone`, `profileVisibility`, `dailyGoalXp`, `theme`, `soundEnabled`, `reminderEnabled`, `reminderTime`, `learningReason`) kèm validate đầy đủ như constraint DB.
   - `POST /api/users/me/avatar` & `DELETE /api/users/me/avatar`: tải lên / thay đổi / gỡ ảnh đại diện (giới hạn ≤ 2MB, MIME `png/jpeg/webp`, lưu trong bucket `avatars/{userId}/...`, cập nhật `profiles.avatar_path`).
   - `POST /api/users/me/deactivate` hoặc `DELETE /api/users/me`: vô hiệu hóa / xóa mềm tài khoản (`status = 'deactivated'`/`'deleted'`, đưa `profile_visibility = 'private'`), kèm đổi mật khẩu qua Supabase Auth `updateUser` trên trang Hồ sơ.
2. **Nội dung bài học Speaking — Gemini BYOK & Gradium TTS (`/api/speaking/*`):**
   - **Bước 1 — Gemini BYOK (Frontend gọi trực tiếp với API key của user, hoặc qua endpoint stateless không lưu key):**
     - Người học tự cung cấp Gemini API Key (BYOK), lưu cục bộ trong trình duyệt (`localStorage`/`sessionStorage`, có nút xóa key ngay lập tức), **không lưu lên database server**.
     - Client gửi audio ghi âm (`audio/webm`/`mp4`/`wav`) kèm prompt ngữ cảnh lấy từ nội dung bài Speaking (`lesson.topic`, `lesson.level`, `item.content`, `item.examples`, lịch sử thoại) lên Gemini API (`generateContent` với structured JSON schema) → nhận về `{ transcript, replyText, evaluation }` (gồm: văn bản đã nhận diện từ giọng nói người học, câu trả lời/đối đáp của AI, và phần đánh giá chi tiết + gợi ý sửa).
     - Khi người học hoàn thành lượt nói hợp lệ, client gọi `POST /api/progress/lessons/{lessonId}/contents/{contentId}/complete` để lưu tiến độ mục bài học như các mục nội dung khác (trước mắt có thể hiển thị nội dung bài bình thường nếu người học chưa nhập BYOK key).
   - **Bước 2 — Gradium TTS của Web (`POST /api/speaking/tts`, `RequireAuthorization`):**
     - Nhận `{ text, lessonId?, voice? }`, trong đó `text` **chỉ là đoạn `replyText` do Gemini vừa tạo ra** (không dùng để đọc tràn lan nội dung khác).
     - Backend dùng `Gradium:ApiKey` cấu hình phía server gọi Gradium TTS API, kiểm tra độ dài text hợp lệ (vd `1..1000` ký tự), áp rate-limit theo `userId` để bảo vệ quota web, rồi stream file audio (`audio/mpeg` / `audio/wav`) về trình duyệt phát lại (nếu Gradium lỗi/chưa cấu hình thì trả mã lỗi rõ ràng để frontend fallback đọc nhẹ bằng Web Speech API hoặc hiển thị text).
3. **Bảng xếp hạng tổng (`/api/rankings`):**
   - `GET /api/rankings?period=week|month|all&limit=50` (`RequireAuthorization`):
     - `all`: xếp theo `user_stats.total_xp desc, user_stats.updated_at asc, profiles.id asc`.
     - `week` / `month`: tổng `user_daily_activity.xp_earned` từ thứ Hai đầu tuần hoặc ngày 01 tháng hiện tại đến hôm nay theo `Asia/Ho_Chi_Minh`.
     - Chỉ công khai các tài khoản `status = 'active'` và `profile_visibility = 'public'`; luôn trả kèm block `currentUser` (hạng cá nhân, tổng XP kỳ, trạng thái hiển thị).
4. **Thi thử / Test rời bất đồng bộ (`/api/quizzes/*`, `/api/quiz-attempts/*`):**
   - `GET /api/quizzes?q=&category=&level=&scope=all|system|public|mine&status=&page=&pageSize=`: tìm kiếm theo từ khóa (`title`/`description`/`topic`) và lọc danh sách đề `quiz_scope = 'standalone'` mà user có quyền thấy, trả kèm trạng thái lượt làm gần nhất của user (`none` / `in_progress` / `submitted`) và điểm cao nhất.
   - `GET /api/quizzes/{idOrSlug}`: trả metadata đầy đủ của đề (tôn trọng quyền `public`/`unlisted`/`private`), trạng thái lượt `'in_progress'` (nếu có), danh sách các lần nộp trước của user (`attemptsMe`), và top 3 tóm tắt BXH — **không trả danh sách câu hỏi/đáp án**.
   - `GET /api/quizzes/{idOrSlug}/ranking?limit=50`: xếp hạng thành tích tốt nhất mỗi thí sinh (`best score desc, best duration_seconds asc, earliest submitted_at asc`) trong số user `active` + `public`, kèm thứ hạng của `currentUser`.
   - `POST /api/quizzes/{idOrSlug}/attempts`: tạo mới hoặc trả về lượt `'in_progress'` đang mở; kiểm tra `allow_retake` và hết giờ; trả `attemptId`, `startedAt`, `expiresAt`, `remainingSeconds`, `questionOrder`, danh sách câu hỏi đã bỏ `correct_answers`/`explanation`/`translation`, cùng đáp án nháp đã lưu.
   - `PUT /api/quiz-attempts/{attemptId}/answers`: lưu nháp từng câu hoặc cả bài vào `user_quiz_attempt_answers` khi lượt đang `'in_progress'` và chưa quá `expires_at` (server clock).
   - `POST /api/quiz-attempts/{attemptId}/submit`: nhận đáp án cuối (hoặc lấy nháp mới nhất), kiểm tra thời gian hết hạn (nếu quá hạn cho phép grace ngắn vài giây hoặc tự chốt từ nháp hiện có), chấm điểm bằng `LearningResultService.Grade`, tính `duration_seconds`, cập nhật `user_stats` + `user_daily_activity` (nếu `xp_reward > 0` và chưa nhận trước đó) trong 1 transaction có row lock chống cộng trùng.
   - `GET /api/quiz-attempts/{attemptId}`: trả dữ liệu cho cả **Trang Kết quả** và **Trang Xem lại** từ DB (`attempt`, điểm, thời gian, XP, thứ hạng trên đề, và danh sách câu hỏi + đáp án chọn + đáp án đúng + giải thích tôn trọng `show_results_immediately` / `show_explanations`).
   - `POST /api/quizzes`, `PUT /api/quizzes/{id}`, `DELETE /api/quizzes/{id}`: tạo/cập nhật/xóa đề standalone của `creator_id` (nếu đã có người làm thì ưu tiên chuyển `is_published = false` để bảo toàn lịch sử `attempt`).
5. **Hỗ trợ nợ Sprint 2 liên quan:**
   - Thêm `"speaking"` vào `LessonCategories.All` ([LessonConstants.cs](DTOs/Lesson/LessonConstants.cs)) và thêm `GET /api/progress/lessons/{lessonId}/quiz/latest` để `Result.cshtml` của bài học đọc lại được từ DB khi đóng tab.

---

### 3. Backlog Sprint 3 (Gộp chung FE / BE / OT)

| ID | Nhóm | Ưu tiên | Nhiệm vụ | Tiêu chí hoàn thành | Phụ thuộc |
|---|---|---|---|---|---|
| **S3-01** | BE | P0 | Ánh xạ Entity EF Core & Migration SQL Sprint 3 | Map thêm `Quiz`, `Question`, `QuizQuestion`, `UserQuizAttemptAnswer` (với `ExcludeFromMigrations()`) vào [ApplicationDbContext.cs](Data/ApplicationDbContext.cs); viết migration thêm `expires_at`, `question_order`, nullable `submitted_at`, partial unique index lượt `in_progress`, `idx_quiz_attempts_ranking`, `idx_profiles_public_active` và trigger username cấm. | `20261111141500` |
| **S3-02** | FE | P0 | Nâng cấp `AppApi` hỗ trợ đủ HTTP methods & chuẩn hóa `auth-guard.js` | Bổ sung `put`, `patch`, `delete` và helper nhận binary audio (`postBlob` / `fetchBlob`) vào [wwwroot/js/Shared/api.js](wwwroot/js/Shared/api.js); nạp `auth-guard.js` đồng nhất cho các trang mới và bỏ bypass `sessionStorage.userToken` ngoài dev. | - |
| **S3-03** | BE | P0 | API tự chỉnh sửa hồ sơ, cài đặt & avatar (`PATCH /api/users/me`) | Xây dựng endpoint cập nhật thông tin cá nhân của chính user (`displayName`, `username` kiểm tra trùng/từ cấm, `bio`, `uiLocale`, `timezone`, `profileVisibility`), `user_settings` (`theme`, `dailyGoalXp`, `soundEnabled`, `reminderEnabled`, `reminderTime`), `learningReason`, và `POST/DELETE /api/users/me/avatar` + vô hiệu hóa tài khoản (`DELETE /api/users/me`). | - |
| **S3-04** | FE | P0 | Hoàn thiện UI chỉnh sửa thông tin cá nhân & đồng bộ cài đặt ở `/Account/Profile` | Nối nút `Chỉnh sửa hồ sơ` (`profile.js`) sang modal/form sửa tên, username (check availability), bio, upload/xóa avatar, cài đặt mục tiêu ngày/nhắc học/ngôn ngữ/theme, bật/tắt `profile_visibility`, đổi mật khẩu (qua Supabase Auth), vô hiệu hóa tài khoản và chỗ quản lý Gemini BYOK key cục bộ; đồng bộ nút đổi ngôn ngữ/theme ở header về `PATCH /api/users/me`. | S3-02, S3-03 |
| **S3-05** | BE | P0 | Service & Endpoint Bảng xếp hạng tổng (`/api/rankings`) | Tạo `IRankingService` + `RankingEndpoints`: `GET /api/rankings?period=week\|month\|all` lọc `active` + `public`, tính thứ hạng ổn định (tie-break), trả block `currentUser` (dù đang `private`). | S3-01 |
| **S3-06** | FE | P0 | Kết nối trang `/Ranking` với API thật & xem hồ sơ công khai | Xóa 4 dòng HTML mẫu ở [Ranking.cshtml](Pages/Ranking.cshtml); render động theo 3 tab `Tuần này`/`Tháng này`/`Tất cả`; thẻ hạng của bạn, thanh tỉ lệ XP, loading/empty/error + Thử lại, banner nhắc bật `public` kèm link nhanh `/Account/Profile`; click vào user `public` mở modal/drawer xem `GET /api/users/{username}`. | S3-04, S3-05 |
| **S3-07** | BE | P0 | Service & Endpoint danh mục, tìm kiếm, chi tiết & BXH riêng của đề thi | Xây dựng `IStandaloneQuizService` + `QuizEndpoints`: `GET /api/quizzes` (search `q`, filter `category`/`level`/`scope`/`status`, phân trang), `GET /api/quizzes/{idOrSlug}` (metadata + lịch sử của mình, không lộ câu hỏi), và `GET /api/quizzes/{idOrSlug}/ranking` (top best score mỗi user `active` + `public` + hạng của bạn). | S3-01 |
| **S3-08** | BE | P0 | Service & Endpoint vòng đời làm bài bất đồng bộ & xem lại (`attempts`) | Triển khai `POST /api/quizzes/{idOrSlug}/attempts` (tạo/resume `in_progress`, kiểm tra `allow_retake`, tính `expires_at`, bỏ `correct_answers`), `PUT /api/quiz-attempts/{attemptId}/answers` (auto-save nháp), `POST .../submit` (kiểm tra quá giờ server, chấm điểm qua `LearningResultService.Grade`, transaction row lock chống cộng XP trùng), và `GET /api/quiz-attempts/{attemptId}`. | S3-01, S3-07 |
| **S3-09** | BE | P0 | Service & Endpoint tạo / sửa / xóa bài thi cá nhân (`/api/quizzes`) | Triển khai `POST/PUT/DELETE /api/quizzes` cho `creator_id`; validate chặt 4 loại câu hỏi tương tự `QuizContent.schema.json`, thời gian, điểm đạt, `visibility` (`private`/`unlisted`/`public`); xóa mềm (`is_published = false`) nếu đã có người làm để giữ lịch sử attempt. | S3-01 |
| **S3-10** | FE | P0 | Xây dựng trang **Danh sách & Tìm kiếm Thi thử** (`/TrialTest`) | Chuyển [Pages/TrialTest.cshtml](Pages/TrialTest.cshtml) thành `Pages/TrialTest/Index.cshtml` (có Header/Footer, cập nhật `LAYOUT.md`): thanh tìm kiếm từ khóa, bộ lọc chủ đề/CEFR/nguồn đề (`Hệ thống`/`Cộng đồng`/`Của tôi`)/trạng thái, thẻ đề hiển thị số câu/thời gian/điểm đạt/trạng thái làm dở, nút `+ Tạo bài kiểm tra` (`/CreateQuiz`). | S3-02, S3-07 |
| **S3-11** | FE | P0 | Xây dựng trang **Thông tin bài thi** (`/TrialTest/{idOrSlug}`) | Tạo `Pages/TrialTest/Detail.cshtml`: hiển thị đầy đủ metadata, tác giả, quy chế đề (`allow_retake`, `time_limit`, `pass_score`), trạng thái lượt làm dở (nút **Tiếp tục làm bài** hoặc **Bắt đầu làm bài**), bảng lịch sử các lần nộp của bản thân (link tới Kết quả/Xem lại), nút **Sửa đề** (nếu là creator) và khối/nút sang **BXH bài thi**. | S3-07 |
| **S3-12** | FE | P0 | Xây dựng trang **BXH riêng của bài thi** (`/TrialTest/{idOrSlug}/Ranking`) | Tạo `Pages/TrialTest/Ranking.cshtml`: hiển thị top thí sinh công khai theo điểm cao nhất → thời gian làm ngắn nhất, highlight thứ hạng cá nhân của user đang đăng nhập, breadcrumb quay lại Thông tin bài / Danh sách, xử lý trạng thái rỗng/lỗi. | S3-07, S3-11 |
| **S3-13** | FE | P0 | Xây dựng trang **Làm bài bất đồng bộ** (`/TrialTest/{idOrSlug}/Take`) | Tạo `Pages/TrialTest/Take.cshtml` (ẩn Header/Footer): render đủ 4 dạng câu hỏi (`single-choice`, `multiple-choice`, `true-false`, `fill-in-the-blank`), đồng hồ đếm ngược theo `expiresAt` server, lưới câu hỏi + đánh dấu xem lại, auto-save nháp khi chọn/chuyển câu (`PUT .../answers`), F5 resume giữ nguyên tiến trình, modal xác nhận nộp & xử lý hết giờ tự chốt. | S3-02, S3-08 |
| **S3-14** | FE | P0 | Xây dựng trang **Kết quả bài thi** (`/TrialTest/Result/{attemptId}`) | Tạo `Pages/TrialTest/Result.cshtml`: đọc hoàn toàn từ DB (`GET /api/quiz-attempts/{attemptId}`), hiển thị điểm %, đúng/sai/bỏ trống, đạt/chưa đạt, thời gian làm thực tế, XP thưởng, hạng trên BXH đề; CTA điều hướng sang **Xem lại bài làm**, **BXH của bài**, **Làm lại** (nếu `allowRetake`) hoặc **Về danh sách**. | S3-08, S3-13 |
| **S3-15** | FE | P0 | Xây dựng trang **Xem lại chi tiết bài làm** (`/TrialTest/Review/{attemptId}`) | Tạo `Pages/TrialTest/Review.cshtml`: đọc `user_quiz_attempt_answers` + `question_snapshot` theo đúng `question_order` lúc làm, bộ lọc `Tất cả / Đúng / Sai / Bỏ trống`, đối chiếu đáp án chọn vs đáp án đúng + giải thích/dịch nghĩa (tôn trọng cờ `showResultsImmediately` / `showExplanations`). | S3-08, S3-14 |
| **S3-16** | FE | P0 | Nối trang `/CreateQuiz` với API tạo & sửa bài thi | Nâng cấp [CreateQuiz.cshtml](Pages/CreateQuiz.cshtml) + `createquiz.js`: hỗ trợ chế độ tạo mới & chỉnh sửa (`/CreateQuiz/{id?}`), thêm/xóa/sắp xếp câu hỏi, đủ 4 loại câu hỏi, cấu hình `category`/`level`/`timeLimitSeconds`/`passScore`/`visibility`/`allowRetake`/`showExplanations`, sao chép link `/TrialTest/{slug}` để chia sẻ bài `unlisted`/`public`. | S3-02, S3-09 |
| **S3-17** | BE | P0 | Endpoint **Gradium TTS** cho Speaking (`POST /api/speaking/tts`) & chuẩn hóa danh mục `speaking` | Bổ sung `"speaking"` vào `LessonCategories.All` ([LessonConstants.cs](DTOs/Lesson/LessonConstants.cs)); thêm `IGradiumTtsService` + `SpeakingEndpoints`: cấu hình `Gradium:ApiKey` ở backend web, nhận `{ text }` là **đoạn text do Gemini tạo ra**, validate độ dài (`≤ 1000` ký tự), áp rate-limit theo `userId`, trả stream audio từ Gradium và không bao giờ lộ key ra client. | - |
| **S3-18** | FE | P0 | Nội dung bài học **Speaking** trên `/Lesson/{lessonId}` (**Gemini BYOK** + phát **Gradium TTS**) | Trên [Pages/Lesson.cshtml](Pages/Lesson.cshtml) + [wwwroot/js/lesson.js](wwwroot/js/lesson.js): khi bài có `category = "speaking"` (hoặc mục speaking), hiển thị khung nhập/lưu **Gemini API Key (BYOK)** cục bộ trên trình duyệt (`localStorage`/`sessionStorage`, có nút test/xóa key); ghi âm micro → gọi Gemini xử lý audio thành `transcript`, suy luận tạo `replyText` và trả đánh giá chi tiết (`evaluation`: phát âm/ngữ pháp/từ vựng/gợi ý sửa); sau đó gửi duy nhất `replyText` lên `POST /api/speaking/tts` để phát giọng đọc **Gradium** và cho đánh dấu hoàn thành mục học. | S3-02, S3-17 |
| **S3-19** | BE | P1 | Xử lý các tồn đọng Sprint 2 khác phía Backend | Trả cờ `isLocked` ở `GET /api/lessons` (giảm 4 request dư ở Dashboard); thêm `GET /api/progress/lessons/{lessonId}/quiz/latest` để lưu bền vững trang `/Result/{lessonId}`; dùng chung `LearningResultService.Grade` và lưu `user_quiz_attempt_answers` cho cả lesson quiz. | S3-01 |
| **S3-20** | FE | P1 | Khắc phục lỗi & dữ liệu giả Sprint 2 trên Frontend | Sửa/gỡ link chết `/MiniGame/{id}` trong [result.js](wwwroot/js/result.js) (nối `/Lesson#lesson-quiz` ↔ `/Result/{lessonId}` đọc fallback từ DB); gỡ số liệu/XP/sao giả trên [Study.cshtml](Pages/Study.cshtml) & xử lý hợp nhất/gỡ trang thừa [LessonDetail.cshtml](Pages/LessonDetail.cshtml). | S3-19 |
| **S3-21** | FE | P1 | Responsive, Dark/Light mode & i18n cho tất cả màn hình mới | Bổ sung đầy đủ key `vi.json` / `en.json` cho Hồ sơ chỉnh sửa, `/Ranking`, 6 trang `/TrialTest/*`, `/CreateQuiz` và khung luyện nói Speaking (BYOK + đánh giá + phát TTS); kiểm tra tương phản 2 palette Sáng/Tối theo `STYLE_GUIDE.md` và mobile `≤ 760px`. | S3-04, S3-06, S3-10..S3-18 |
| **S3-22** | OT | P0 | Bộ đề mẫu Test rời (`Storage/QuizTemplate`) & kiểm thử `sync-templates.js` | Tạo tối thiểu 3 bộ đề standalone mẫu đúng `QuizConfig.schema.json` & `QuizContent.schema.json` (gồm đề có giới hạn thời gian và không giới hạn, đủ 4 dạng câu hỏi), chạy kiểm chứng `node supabase/sync-templates.js` idempotent lên DB. | S3-01 |
| **S3-23** | OT | P1 | Kiểm thử Backend, Frontend E2E & kịch bản nghiệm thu ca biên | Viết xUnit test (`dotnet test`) + browser test (`node --check`, `docs/test/*-browser.cjs`): sửa profile & đổi `profile_visibility` → `/Ranking` 3 kỳ; tạo đề → xem thông tin đề → làm bài bất đồng bộ → F5 → hết giờ/submit song song → kết quả → xem lại → BXH đề; luồng **Speaking**: chưa nhập BYOK key/key sai, ghi âm → Gemini (mock) trả `transcript`/`replyText`/`evaluation` → `POST /api/speaking/tts` (mock Gradium) chỉ đọc `replyText`, xác nhận key Gemini không gửi lên DB và key Gradium không lộ ra client; hồi quy `category=speaking`. | S3-04..S3-22 |
| **S3-24** | OT | P1 | Cập nhật tài liệu kiến trúc, API contract & cấu hình AI | Cập nhật `docs/frontend/API_CLIENT.md` (`PATCH /api/users/me`, `/api/speaking/tts`, `/api/rankings`, `/api/quizzes/*`, `/api/quiz-attempts/*`), `docs/frontend/LAYOUT.md` (route `/TrialTest/*`), `README.md` (hướng dẫn cấu hình `Gradium:ApiKey` ở backend & cơ chế Gemini BYOK ở frontend), và `supabase/README.md`. | S3-03..S3-18 |

---

### 4. Thứ tự thực hiện đề xuất

1. **Giai đoạn 1 — Nền tảng & Hồ sơ người dùng (`S3-01` → `S3-04`):** Migration + Entity EF Core, nâng cấp `AppApi`, hoàn thành sửa thông tin cá nhân `/Account/Profile` (`PATCH /api/users/me` + avatar + bật `public`).
2. **Giai đoạn 2 — Bảng xếp hạng tổng (`S3-05`, `S3-06`):** Triển khai `/api/rankings` và trang `/Ranking` hoàn chỉnh (kèm xem hồ sơ công khai).
3. **Giai đoạn 3 — Thi thử bất đồng bộ end-to-end (`S3-22`, `S3-07` → `S3-15`):** Chuẩn bị seed `QuizTemplate`, dựng API & 6 màn hình theo đúng luồng: Danh sách/Tìm kiếm → Thông tin bài → BXH bài → Làm bài → Kết quả → Xem lại.
4. **Giai đoạn 4 — Speaking (Gemini BYOK + Gradium TTS), Tạo đề & Nợ Sprint 2 (`S3-17`, `S3-18`, `S3-09`, `S3-16`, `S3-19`, `S3-20`):** Dựng `POST /api/speaking/tts` + giao diện luyện nói Speaking trên `/Lesson`, nối `/CreateQuiz`, gỡ link `/MiniGame` 404 và dọn số liệu giả trên `Study`/`LessonDetail`.
5. **Giai đoạn 5 — Hoàn thiện UI, kiểm thử & bàn giao (`S3-21`, `S3-23`, `S3-24`):** i18n, Dark/Light mode, xUnit + E2E browser tests và cập nhật tài liệu.

### 5. Definition of Done cho Sprint 3

- Người dùng tự chỉnh sửa được thông tin cá nhân trên `/Account/Profile` (`displayName`, `username`, `bio`, avatar, cài đặt mục tiêu/ngôn ngữ/theme và `profile_visibility`), thay đổi lưu bền vững lên DB.
- Trang `/Ranking` hiển thị số liệu thật theo 3 kỳ `Tuần này` / `Tháng này` / `Tất cả`, tôn trọng `profile_visibility = 'public'`, luôn hiển thị thứ hạng cá nhân và không còn dữ liệu mẫu.
- Luồng **Thi thử bất đồng bộ (không cần host)** chạy thông suốt qua đủ 6 màn hình (**Danh sách & Tìm kiếm → Thông tin bài → BXH của bài → Làm bài → Kết quả → Xem lại**) + **Tạo/Sửa đề (`/CreateQuiz`)**: lưu nháp khi F5, server chấm điểm & khóa nộp khi hết giờ, không lộ đáp án trước khi nộp, xem lại kết quả bền vững từ DB.
- **Nội dung bài học Speaking** trên `/Lesson/{lessonId}` hoạt động đúng vai trò: người học nhập **Gemini API Key (BYOK)** lưu cục bộ tại trình duyệt (không lưu lên server), thu âm nói → Gemini xử lý thành text, suy luận trả lời và đánh giá người dùng; backend web dùng **Gradium** đọc lại **duy nhất đoạn text phản hồi do Gemini tạo ra** qua `POST /api/speaking/tts`.
- Các API còn thiếu trọng tâm và các điểm gãy từ Sprint 2 (`AppApi.put/patch/delete`, danh mục `speaking`, link `/MiniGame` 404, số liệu/sao giả) đã được xử lý gọn.
- Pass `dotnet build`, `dotnet test`, `node --check` các script JS mới và checklist nghiệm thu E2E trên desktop/mobile ở cả 2 palette Sáng và Tối.

### 6. Ngoài phạm vi Sprint 3

- Phòng thi đấu thời gian thực có **host** điều khiển đồng bộ (SignalR / WebSocket, đếm ngược tập trung theo phòng).
- Kỳ thi chuẩn CEFR nhiều phần kỹ năng ghép (`trial_exams`, placement test xếp trình độ đầu vào tự động).
- Chấm phát âm theo âm vị chuyên sâu bằng engine rời bên ngoài (chỉ dùng đánh giá tổng quan từ Gemini BYOK và đọc phản hồi qua Gradium TTS).
- Hệ thống tự xét thưởng toàn phần 10 huy hiệu (`achievements`), thuật toán SRS đầy đủ trên Flashcard (`user_content_reviews`), thanh toán và push notification.
