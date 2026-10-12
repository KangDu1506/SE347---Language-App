# Sprint 2 Backlog - Language App

## Phạm vi sprint

Sprint 2 tập trung vào luồng sử dụng sau khi người học đã đăng nhập, bắt đầu từ
trang **Index/Dashboard** và đi qua các chức năng học tập chính:

`Index/Dashboard -> Study -> Lesson -> Flashcard/Mini-game -> Kết quả -> Progress`

Các trang đăng nhập, đăng ký, xác thực, quên mật khẩu và các chức năng tài
khoản/người dùng được xem là đã hoàn thiện. Trong sprint này chỉ xử lý liên kết
đến **Profile** khi cần hiển thị thông tin hoặc điều hướng, không mở rộng các
chức năng tài khoản khác.

## Hiện trạng làm cơ sở

- [Index.cshtml](./Pages/Index.cshtml) đã có bố cục dashboard, CTA bắt đầu học,
  thống kê tiến độ, streak và các thẻ lộ trình; dữ liệu hiện đang
  hard-code.
- [Study.cshtml](./Pages/Study.cshtml) đã có bộ lọc chủ đề và các thẻ khóa học
  (từ vựng, ngữ pháp, nghe hiểu), nhưng bộ lọc và tiến độ chưa có hành vi thật.
- [CreateQuiz.cshtml](./Pages/CreateQuiz.cshtml) đã có form tạo quiz một câu hỏi
  mẫu; chưa thêm/xóa động, lưu dữ liệu hoặc dùng lại quiz.
- Các DTO bài học trong [DTOs/LessonDTOs](./DTOs/LessonDTOs), schema và dữ liệu
  mẫu trong [Data/LessonTemplate](./Data/LessonTemplate) là nền tảng để xây
  dựng việc đọc bài học từ JSON.
- Các file JavaScript hiện mới xử lý trạng thái hiển thị trang; chưa có API,
  state quản lý bài làm hoặc lưu tiến độ.

## Backlog nhiệm vụ dự kiến

| ID | Ưu tiên | Nhiệm vụ | Mô tả và tiêu chí hoàn thành | Phụ thuộc |
|---|---|---|---|---|
| S2-01 | P0 | Chuẩn hóa mô hình dữ liệu bài học và quiz | Hoàn thiện model/DTO cho chủ đề, bài học, nội dung từ vựng/câu giao tiếp, câu hỏi và đáp án; thống nhất `LessonId`, `Category`, `Level`, nội dung và quiz. Dữ liệu mẫu phải đọc/validate được theo schema hiện có. | - |
| S2-02 | P0 | Xây dựng lớp đọc dữ liệu bài học | Tạo service đọc các file JSON trong `Data/LessonTemplate`, xử lý lỗi file/JSON rõ ràng, trả về danh sách và chi tiết bài học; đăng ký service trong `Program.cs`. | S2-01 |
| S2-03 | P0 | Kết nối dashboard với dữ liệu thật | Thay các số liệu và thẻ hard-code trên `Index.cshtml` bằng dữ liệu tiến độ/lộ trình; hiển thị trạng thái tiếp tục học và khóa học đề xuất. Khi chưa có dữ liệu phải có trạng thái rỗng hợp lệ, không hiển thị số liệu giả gây hiểu nhầm. | S2-02, S2-06 |
| S2-04 | P0 | Hoàn thiện danh sách và bộ lọc bài học | Kết nối `Study.cshtml` với danh sách bài học; triển khai lọc Tất cả/Từ vựng/Ngữ pháp/Nghe hiểu, hiển thị cấp độ, thời lượng, số bài và tiến độ; thêm trạng thái loading, rỗng và lỗi. | S2-02, S2-06 |
| S2-05 | P0 | Xây dựng trang chi tiết bài học | Bổ sung luồng từ thẻ bài học đến trang chi tiết; hiển thị từ/cụm từ, nghĩa, mô tả, ví dụ/câu giao tiếp và hình ảnh nếu có. Có điều hướng bài trước/bài tiếp theo và nút bắt đầu ôn tập. | S2-02, S2-04 |
| S2-06 | P0 | Thiết kế cơ chế lưu tiến độ học | Xác định dữ liệu tối thiểu gồm bài học đã mở, nội dung đã hoàn thành, điểm quiz, XP, streak và thời điểm học; tạo API/service lưu và truy vấn theo người dùng hiện tại. Không làm lại các luồng xác thực đã hoàn thiện. | S2-01 |
| S2-07 | P1 | Triển khai flashcard từ vựng | Cho phép xem mặt trước/mặt sau, lật thẻ, chuyển thẻ, đánh dấu Nhớ/Chưa nhớ và cập nhật tiến độ; hỗ trợ nội dung lấy từ bài học thay vì dữ liệu hard-code. | S2-05, S2-06 |
| S2-08 | P1 | Triển khai các mini-game ôn tập | Ưu tiên các dạng: chọn đáp án đúng, điền từ vào chỗ trống và nối từ với nghĩa. Mỗi dạng phải có kiểm tra đáp án, phản hồi đúng/sai, điểm và kết quả cuối lượt. | S2-05, S2-06 |
| S2-09 | P1 | Xây dựng trang kết quả và ôn lại | Hiển thị điểm, số câu đúng/sai, thời gian, đáp án đúng, giải thích nếu có và các mục cần ôn; cung cấp nút làm lại, quay về bài học và cập nhật tiến độ sau khi hoàn thành mini-game. | S2-08 |
| S2-11 | P1 | Đồng bộ dashboard với tiến độ cá nhân | Tính và hiển thị phần trăm hoàn thành, streak, XP, bài đang học và hoạt động gần đây từ dữ liệu đã lưu; CTA phải dẫn đúng bài học còn dang dở. | S2-06, S2-09 |
| S2-13 | P1 | Chuẩn hóa điều hướng và trải nghiệm responsive | Kiểm tra toàn bộ liên kết Dashboard/Học tập/Bài học/Flashcard/Mini-game/Kết quả/Profile; bổ sung focus state, nhãn accessible, thông báo lỗi và hiển thị tốt trên mobile cho các luồng chính. | S2-03, S2-04, S2-08 |
| S2-14 | P0 | Kiểm thử tích hợp luồng học tập | Viết và chạy test cho đọc dữ liệu, lọc bài học, chấm điểm mini-game, lưu tiến độ, trạng thái rỗng/lỗi và quyền truy cập sau đăng nhập. Kiểm tra hồi quy các trang account đã hoàn thiện, không thay đổi hành vi ngoài phạm vi sprint. | S2-03, S2-04, S2-08, S2-11 |

## Thứ tự thực hiện đề xuất

1. **Nền tảng dữ liệu:** S2-01, S2-02, S2-06.
2. **Dashboard và danh sách học:** S2-03, S2-04, S2-05.
3. **Học và ôn tập:** S2-07, S2-08, S2-09.
4. **Cá nhân hóa:** S2-11.
5. **Hoàn thiện và kiểm thử:** S2-13, S2-14.

## Definition of Done cho Sprint 2

- Người dùng đã đăng nhập có thể đi từ Dashboard đến một bài học, học nội dung,
  làm flashcard/mini-game và xem kết quả mà không gặp liên kết giả hoặc dữ liệu
  hard-code trong luồng chính.
- Tiến độ, điểm và streak được lưu và dùng lại khi tải lại Dashboard.
- Dữ liệu sai hoặc thiếu có thông báo rõ ràng; không có lỗi bị nuốt hoặc trạng
  thái thành công giả.
- Giao diện chính hoạt động trên desktop/mobile và có các trạng thái loading,
  rỗng, lỗi, focus và phản hồi thao tác cơ bản.
- Các test tích hợp của luồng học tập đạt, build/type-check không lỗi và các
  chức năng tài khoản ngoài phạm vi không bị hồi quy.

## Ngoài phạm vi Sprint 2

- Đăng nhập, đăng ký, xác thực, quên mật khẩu và quản lý tài khoản/người dùng,
  ngoại trừ liên kết hoặc dữ liệu cần hiển thị ở Profile.
- Bài kiểm tra thử (`TrialTest`) và bảng xếp hạng (`Ranking`).
- Hệ thống thanh toán, thông báo push, mạng xã hội, chat và quản trị nội dung.
- Thuật toán đề xuất nâng cao hoặc hệ thống chấm phát âm tự động; chỉ chuẩn bị
  cấu trúc nội dung nghe và các dạng luyện tập đã nêu trong backlog.
