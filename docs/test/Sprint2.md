# Sprint 2 Backlog - Language App

## Phạm vi sprint

Sprint 2 hoàn thiện luồng học tập sau khi người học đã đăng nhập:

`Dashboard -> Danh sách bài học -> Chi tiết bài học -> Flashcard/Mini-game -> Kết quả -> Tiến độ`

Các chức năng đăng nhập, đăng ký, xác thực, quên mật khẩu và tài khoản người
dùng được xem là nền tảng của Sprint 1. Sprint 2 chỉ sử dụng thông tin Profile
khi cần hiển thị hoặc điều hướng, không mở rộng các chức năng tài khoản.

## Hiện trạng cập nhật

### Backend và dữ liệu

- [Program.cs](../../Program.cs) đã có Razor Pages, xác thực JWT, EF Core và
  đăng ký `IUserService`; chưa đăng ký service đọc lesson hoặc service tiến độ.
- [ApplicationDbContext.cs](../../Data/ApplicationDbContext.cs) đã map các bảng
  profile, setting, learning profile, stat, daily activity và achievement; chưa
  có bảng/Entity dành cho lesson, quiz attempt hoặc tiến độ từng bài.
- Các DTO lesson trong [DTOs/Lesson](../../DTOs/Lesson) và schema trong
  [Storage/LessonTemplate/schemas](../../Storage/LessonTemplate/schemas) đã có
  khung ban đầu.
- [Storage/LessonTemplate](../../Storage/LessonTemplate) mới có một bộ dữ liệu
  mẫu gồm `config.json`, `content.json` và `quiz.json`. Chưa có code đọc,
  validate, lập chỉ mục hoặc cung cấp dữ liệu này cho giao diện.
- [UserEndpoints.cs](../../Endpoints/UserEndpoints.cs) mới phục vụ user/profile;
  chưa có endpoint lesson, quiz, kết quả hoặc progress.

### Frontend

- [Index.cshtml](../../Pages/Index.cshtml) và [Study.cshtml](../../Pages/Study.cshtml)
  đã có bố cục dashboard, bộ lọc và thẻ bài học nhưng nội dung, số liệu,
  phần trăm tiến độ và liên kết học tập còn hard-code.
- [index.js](../../wwwroot/js/index.js) và [study.js](../../wwwroot/js/study.js)
  hiện chỉ thêm trạng thái hiển thị; chưa gọi API, lọc dữ liệu hoặc quản lý
  state bài học.
- Chưa có trang chi tiết lesson, flashcard, mini-game hoặc trang kết quả trong
  luồng Sprint 2. [CreateQuiz.cshtml](../../Pages/CreateQuiz.cshtml) mới là
  form mẫu tạo một câu hỏi, chưa phải luồng quiz học tập hoàn chỉnh.
- Các trang [TrialTest.cshtml](../../Pages/TrialTest.cshtml) và
  [Ranking.cshtml](../../Pages/Ranking.cshtml) tồn tại nhưng không thuộc phạm vi
  triển khai Sprint 2.

### Other

- Nội dung lesson (từ vựng, câu giao tiếp, ví dụ, giải thích, đáp án và media
  nếu có) cần được nhập và rà soát theo schema. Các file JSON lesson không
  được xếp vào nhóm Other; chúng thuộc Backend và dữ liệu.
- Chưa có checklist nghiệm thu end-to-end cho luồng học tập sau khi các phần
  Backend và Frontend hoàn thành.

## Backlog Sprint 2

### 1. Backend và dữ liệu

| ID | Ưu tiên | Trạng thái hiện tại | Nhiệm vụ | Tiêu chí hoàn thành | Phụ thuộc |
|---|---|---|---|---|---|
| S2-BE-01 | P0 | Đã có một phần | Chuẩn hóa DTO, schema và JSON lesson/quiz | Thống nhất `LessonId`, `Category`, `Level`, nội dung, câu hỏi và đáp án; toàn bộ JSON trong [Storage/LessonTemplate](../../Storage/LessonTemplate) validate được theo schema; lỗi dữ liệu chỉ ra rõ file và trường sai. | - |
| S2-BE-02 | P0 | Chưa làm | Xây dựng service đọc dữ liệu lesson | Đọc danh sách và chi tiết lesson từ JSON, không trả dữ liệu hard-code; xử lý rõ lỗi thiếu file, JSON không hợp lệ và lesson không tồn tại; đăng ký service trong [Program.cs](../../Program.cs). | S2-BE-01 |
| S2-BE-03 | P0 | Chưa làm | Cung cấp API lesson và quiz | Có endpoint lấy danh sách, lọc theo category/level và lấy chi tiết lesson; response dùng DTO hiện có, không trả đường dẫn nội bộ; endpoint kiểm tra quyền truy cập theo người dùng đã đăng nhập. | S2-BE-02 |
| S2-BE-04 | P0 | Chưa làm | Thiết kế và triển khai lưu tiến độ | Lưu/truy vấn lesson đã mở, nội dung đã hoàn thành, điểm quiz, XP, streak và thời điểm học theo user; xử lý user chưa có dữ liệu bằng trạng thái rỗng hợp lệ. | S2-BE-01 |
| S2-BE-05 | P1 | Chưa làm | API ghi nhận kết quả học tập | Nhận kết quả flashcard/mini-game, kiểm tra dữ liệu đầu vào, tính hoặc xác nhận điểm ở server và cập nhật progress; lỗi phải trả response rõ ràng, không thành công giả. | S2-BE-04 |
| S2-BE-06 | P1 | Chưa làm | Kiểm thử Backend và tích hợp dữ liệu | Có test cho validate JSON, đọc/lọc lesson, lesson không tồn tại, quyền truy cập, lưu/truy vấn progress và chấm điểm; build/type-check không lỗi. | S2-BE-02, S2-BE-03, S2-BE-05 |

### 2. Frontend

| ID | Ưu tiên | Trạng thái hiện tại | Nhiệm vụ | Tiêu chí hoàn thành | Phụ thuộc |
|---|---|---|---|---|---|
| S2-FE-01 | P0 | Có giao diện tĩnh | Kết nối Dashboard với dữ liệu thật | [Index.cshtml](../../Pages/Index.cshtml) gọi dữ liệu progress/lesson; hiển thị phần trăm, streak, XP, bài đang học và khóa học đề xuất; có loading, rỗng và lỗi, không còn số liệu giả trong luồng chính. | S2-BE-03, S2-BE-04 |
| S2-FE-02 | P0 | Có giao diện tĩnh | Kết nối Study với danh sách và bộ lọc lesson | [Study.cshtml](../../Pages/Study.cshtml) lấy danh sách từ API; bộ lọc Tất cả/Từ vựng/Ngữ pháp/Nghe hiểu hoạt động; hiển thị level, thời lượng, số bài và progress; thẻ lesson dẫn tới đúng chi tiết. | S2-BE-03, S2-BE-04 |
| S2-FE-03 | P0 | Chưa làm | Xây dựng trang chi tiết lesson | Hiển thị từ/cụm từ, nghĩa, mô tả, ví dụ/câu giao tiếp và hình ảnh nếu có; có điều hướng bài trước/bài tiếp theo, nút bắt đầu ôn tập và trạng thái loading/rỗng/lỗi. | S2-FE-02 |
| S2-FE-04 | P1 | Chưa làm | Triển khai flashcard | Có mặt trước/mặt sau, lật thẻ, chuyển thẻ, Nhớ/Chưa nhớ; dữ liệu lấy từ lesson và gửi trạng thái hoàn thành/progress, không dùng bộ thẻ hard-code. | S2-FE-03, S2-BE-05 |
| S2-FE-05 | P1 | Chưa làm | Triển khai mini-game ôn tập | Tối thiểu chọn đáp án đúng và điền từ; kiểm tra đáp án, phản hồi đúng/sai, điểm, kết quả cuối lượt và xử lý thao tác tải lại/đi tiếp hợp lệ. | S2-FE-03, S2-BE-05 |
| S2-FE-06 | P1 | Chưa làm | Xây dựng trang kết quả và ôn lại | Hiển thị điểm, số đúng/sai, thời gian, đáp án đúng, giải thích nếu có và mục cần ôn; có làm lại, quay về lesson và cập nhật progress sau khi hoàn thành. | S2-FE-05, S2-BE-05 |
| S2-FE-07 | P1 | Có khung điều hướng | Hoàn thiện UX, responsive và accessibility | Kiểm tra liên kết Dashboard/Học tập/Lesson/Flashcard/Mini-game/Kết quả/Profile; bổ sung focus state, nhãn accessible, thông báo lỗi và hiển thị tốt trên mobile cho luồng chính. | S2-FE-01, S2-FE-02, S2-FE-06 |
| S2-FE-08 | P1 | Chưa làm | Kiểm thử Frontend và luồng end-to-end | Kiểm tra gọi API, lọc, điều hướng, chấm điểm, trạng thái loading/rỗng/lỗi, refresh và hiển thị progress; hồi quy các trang account không bị ảnh hưởng. | S2-FE-01, S2-FE-02, S2-FE-06, S2-FE-07 |

### 3. Other

Nhóm này chỉ gồm nội dung nhập liệu, rà soát và công việc ngoài code. Các file
`config.json`, `content.json`, `quiz.json` của lesson thuộc S2-BE-01, không
đưa vào nhóm Other.

| ID | Ưu tiên | Trạng thái hiện tại | Nhiệm vụ | Tiêu chí hoàn thành | Phụ thuộc |
|---|---|---|---|---|---|
| S2-OT-01 | P0 | Đang có 1 bộ mẫu | Nhập nội dung lesson theo danh mục | Bổ sung các lesson cần cho luồng demo: từ vựng, ngữ pháp và nghe hiểu; mỗi lesson có nội dung, level, thời lượng, ví dụ và quiz đủ để Frontend kiểm thử. | S2-BE-01 |
| S2-OT-02 | P0 | Chưa làm | Rà soát chất lượng nội dung | Kiểm tra chính tả, nghĩa, ví dụ, đáp án, giải thích, category/level và tính nhất quán giữa nội dung với quiz; xác nhận các media có đường dẫn hợp lệ nếu được dùng. | S2-OT-01 |
| S2-OT-03 | P1 | Chưa làm | Chuẩn bị kịch bản nghiệm thu Sprint 2 | Có checklist cho luồng đăng nhập -> Dashboard -> lesson -> flashcard/mini-game -> kết quả -> progress, gồm dữ liệu hợp lệ, rỗng, lỗi và reload; ghi nhận kết quả nghiệm thu. | S2-BE-06, S2-FE-08 |
| S2-OT-04 | P1 | Chưa làm | Chuẩn bị dữ liệu demo và phân công vận hành | Chốt bộ lesson dùng khi demo, tài khoản test, expected result và người chịu trách nhiệm cập nhật nội dung; không đưa mật khẩu hoặc secret vào repository. | S2-OT-01, S2-OT-02 |

## Thứ tự thực hiện đề xuất

1. **Chuẩn bị dữ liệu và Backend nền tảng:** S2-BE-01, S2-OT-01, S2-OT-02,
   S2-BE-02, S2-BE-03, S2-BE-04.
2. **Dashboard và danh sách lesson:** S2-FE-01, S2-FE-02.
3. **Học và ôn tập:** S2-FE-03, S2-FE-04, S2-FE-05, S2-BE-05.
4. **Kết quả và hoàn thiện giao diện:** S2-FE-06, S2-FE-07.
5. **Kiểm thử và nghiệm thu:** S2-BE-06, S2-FE-08, S2-OT-03, S2-OT-04.

## Definition of Done cho Sprint 2

- Người dùng đã đăng nhập đi được từ Dashboard đến lesson, học nội dung,
  flashcard/mini-game và xem kết quả mà không dùng dữ liệu giả trong luồng
  chính.
- Lesson và quiz được đọc từ JSON hợp lệ; Backend trả lỗi rõ ràng khi dữ liệu
  sai, thiếu hoặc không tồn tại.
- Tiến độ, điểm, XP và streak được lưu theo người dùng và dùng lại khi tải lại
  Dashboard.
- Giao diện có loading, rỗng, lỗi, focus và phản hồi thao tác cơ bản; hoạt
  động trên desktop/mobile.
- Test Backend, Frontend và checklist nghiệm thu đạt; build/type-check không
  lỗi; các chức năng account ngoài phạm vi không bị hồi quy.

## Ngoài phạm vi Sprint 2

- Đăng nhập, đăng ký, xác thực, quên mật khẩu và quản lý tài khoản/người dùng,
  ngoại trừ dữ liệu cần hiển thị hoặc liên kết tới Profile.
- [TrialTest.cshtml](../../Pages/TrialTest.cshtml), bảng xếp hạng và các tính
  năng Ranking độc lập với luồng lesson.
- Thanh toán, push notification, mạng xã hội, chat và quản trị nội dung.
- Thuật toán đề xuất nâng cao, chấm phát âm tự động và hệ thống CMS; Sprint 2
  chỉ nhập nội dung theo schema và phục vụ nội dung đó cho luồng học tập.
