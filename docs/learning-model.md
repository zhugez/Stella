# Mô hình học tập của Stella

Tài liệu này mô tả cách Stella lên lịch ôn tập, thiết kế câu hỏi và tính toán chỉ số ghi nhớ, sau đợt cập nhật dựa trên báo cáo [docs/learning-review-2026-11.md](learning-review-2026-11.md).

## 1. Hành trình học mỗi ngày

Mỗi buổi học được tạo bởi hàm `buildSession` (`src/store/session.ts`):

- **Ôn tập trước**: Các từ đến hạn (`due <= now`) được ôn trước khi học từ mới, tối đa 120 thẻ mỗi buổi.
- **Học từ mới theo nhóm 5 từ**:
  - Hàng chờ từ mới (`nextNew`) ưu tiên các từ người học đã lưu (`bookmarks`, từ cũ nhất trước), sau đó đi theo lộ trình CEFR (`startLevel`). Các từ là biến thể Anh/Mỹ (`twinOf`) của từ đã học sẽ tự động được bỏ qua.
  - Mỗi nhóm 5 từ gồm 3 bước:
    1. **Làm quen (`intro`)**: Xem tranh, nghĩa, phát âm, 2 câu ví dụ và mẹo dùng.
    2. **Kiểm tra nhanh (`practice: true`)**: Câu hỏi nhận diện ngay sau khi xem, dùng để củng cố trí nhớ ngắn hạn. Lượt này **không chấm điểm FSRS**.
    3. **Nhớ lại cuối buổi (`recall`)**: Ở cuối toàn bộ buổi học, người học gặp lại tất cả từ mới bằng dạng tự nhớ nghĩa. Lần này mới ghi nhận điểm FSRS đầu tiên.

## 2. Dạng bài theo độ ổn định trí nhớ (`quizKind`)

Dạng bài thay đổi theo độ ổn định FSRS của từ (`card.s`, tính bằng ngày):

| Độ ổn định (`c.s`) | Dạng bài được chọn | Mục đích học tập |
|---|---|---|
| Chưa học hoặc `< 2` ngày | `picture` (nhìn tranh điền câu), `meaning` (chọn nghĩa), `listen` (nghe từ chọn nghĩa) | Nhận diện nghĩa và âm thanh (recognition) |
| `2 <= c.s < 4` hoặc tắt chính tả | `recall` (tự nhớ nghĩa), `listen` (nghe chọn nghĩa), `picture`/`cloze` | Bắt đầu chuyển sang tự nhớ (retrieval practice) |
| `>= 4` ngày và bật chính tả | `spell` (gõ chính tả), `recall` (tự nhớ), `dictation` (nghe câu gõ từ), `listen` | Sản sinh ngôn ngữ (productive recall) |

Khi từ đã ổn định (`s >= 4`) hoặc khi chuyển sang câu ví dụ thứ hai (`ex = 1`), tranh minh họa sẽ được ẩn (`plain: true`) để tránh việc người học ghi nhớ mẹo dựa vào tranh thay vì từ vựng.

### Từ ghi chú của người học

- Khi đọc, người học bấm vào một từ chưa có trong atlas và tự gõ nghĩa tiếng Việt, câu chứa từ và từ loại (không bắt buộc). Dữ liệu này nằm trong `Progress.notes` (id dạng `u:từ`), đi cùng bản sao lưu và không có hình, không có AI, không gọi mạng.
- Từ ghi chú chưa học luôn được xếp trước tiên trong `nextNew` (cũ nhất trước), rồi mới đến từ đã lưu và lộ trình CEFR. Chúng được tính vào `dailyNew` của ngày.
- Âm thanh dùng giọng đọc của thiết bị (`speechSynthesis`), vì không có bản ghi sẵn.
- Dạng bài bị giới hạn vì không có đáp án nhiễu và không có audio câu: luôn có `recall`; từ `c.s >= 2` thêm `spell` (nếu bật chính tả) và `picture` dạng điền câu (nếu có câu chứa từ, không hình). Không bao giờ dùng `meaning`, `listen`, `dictation`.
- Dự kiến sau này: gợi ý nghĩa bằng AI, người học vẫn là người xác nhận.

## 3. Quy tắc chấm điểm và FSRS (`gradeFor`)

Stella sử dụng thuật toán FSRS (`ts-fsrs`, mục tiêu mặc định 90%):

- **Điểm số dựa trên nỗ lực và thời gian**:
  - Trả lời sai hoặc dùng từ 2 gợi ý chữ cái trở lên: `Rating.Again`.
  - Dùng 1 gợi ý chữ cái hoặc trả lời chậm: `Rating.Hard`.
  - Trả lời đúng trong thời gian chuẩn: `Rating.Good`.
  - Gõ chính tả hoặc nghe chép đúng và nhanh (`< 6s`): `Rating.Easy`.
  - Tự nhớ (`recall`): Người học bấm "Xem nghĩa" rồi tự đánh giá trung thực: "Chưa nhớ" (`Again`) hoặc "Nhớ được" (`Good`).
- **Chỉ tính điểm lần đầu (`answer`)**: Các câu kiểm tra nhanh và các câu làm lại không bao giờ cập nhật FSRS hay đếm lại vào thống kê.
- **Luyện lại ngay khi sai (`retry`)**: Từ trả lời sai sẽ xuất hiện lại sau 4 bước bằng một dạng bài khác (tối đa 2 lần).
- **Chấp nhận chính tả Anh/Mỹ (`accepts`)**: Chấp nhận cả cách viết Anh và Mỹ (ví dụ `colour`/`color`, `organise`/`organize`, `cheque/check`).

## 4. Nhật ký và chỉ số đánh giá

- **Nhật ký ôn tập (`ReviewLog`)**: Mỗi lượt trả lời tính điểm ghi lại `{ id, t, k, g, ms, st }` vào `progress.log` (tối đa 5.000 lượt gần nhất).
- **Chỉ số trung thực**:
  - **Đang nhớ (`rememberedCount`)**: Tổng xác suất nhớ được ước tính theo công thức FSRS của toàn bộ thẻ tại thời điểm hiện tại.
  - **Nhớ bền (`isMastered`)**: Thẻ ở trạng thái Review và có độ ổn định `s >= 21` ngày (khoảng 3 tuần sau lần ôn gần nhất).
  - **Nhớ khi ôn (30 ngày) (`retentionStats`)**: Tỷ lệ nhớ thực tế trong các lượt ôn cách quãng 30 ngày qua, tách riêng giữa dạng tự nhớ (`recall`, `spell`, `dictation`) và trắc nghiệm (`meaning`, `picture`, `listen`).
  - **Chuỗi ngày học (`streakOf`)**: Chỉ tính các ngày có hoàn thành trọn vẹn ít nhất một buổi học (`day.s > 0`).
  - **Chặn dồn từ mới (`waiting_note`)**: Nút "Học thêm 5 từ" sẽ bị ẩn khi người học còn từ đang trong giai đoạn học dở (`Learning` hoặc `Relearning`) chưa đến hạn ôn lại.

## 5. Luyện tập bổ trợ (`Practice` & `Reading`)

Các chế độ này giúp rèn luyện bổ trợ và **không làm thay đổi lịch ôn FSRS**:

- **Cụm từ đi kèm (`Collocations`)**: Từ chính trong câu hỏi và đáp án được che thành `___`. Các phương án nhiễu mượn từ các từ khác có cùng từ loại và loại trừ từ đồng nghĩa/trái nghĩa, loại bỏ khả năng nhận biết đáp án bằng mắt thường.
- **Đồng nghĩa (`Paraphrase`)**: Câu IELTS (`ex[1]`, nếu không có thì `ex[0]`) hiện từ chính được tô sáng. Người học chọn từ đồng nghĩa (`syn`); chỉ khi từ không có đồng nghĩa mới hỏi từ trái nghĩa (`ant`). Phương án nhiễu lấy từ đồng/trái nghĩa và từ chính của các từ khác trong lượt, ưu tiên cùng từ loại, loại trừ mọi từ liên quan đến từ đang hỏi.
- **Họ từ (`Family`)**: Hỏi dạng từ loại khác của cùng một từ (ví dụ danh từ của `advise`) dựa trên `fam`. Phương án nhiễu ưu tiên các dạng khác từ loại trong cùng họ từ, rồi đến họ từ của các từ khác, nên chỉ có một đáp án đúng về từ loại.
- **Đặt câu (`Write`)**: Người học tự viết câu có dùng từ. `sentenceCheck` chỉ kiểm tra câu quá ngắn (< 5 từ), thiếu từ chính, hoặc chép lại câu mẫu; không kiểm tra ngữ pháp. Sau đó hiện câu mẫu và cụm từ đi kèm để người học tự đánh giá "đúng" hoặc "chưa chắc".
- Cả ba chế độ chỉ là luyện tập: không ghi vào `progress.cards`, `progress.log`, `progress.typing` hay số liệu theo ngày.
- **Gõ từ vựng (`Word`)**: Mặc định che chữ cái để người học tự nhớ lại từ trước khi gõ; có nút "Hiện đáp án" khi cần.
- **Đọc hiểu (`Reading`)**: Thứ tự hiển thị của 4 lựa chọn trắc nghiệm được xáo ngẫu nhiên theo thuật toán ổn định (`optionOrder`), tránh việc đáp án tập trung vào một vị trí cố định.
  - **Bài đọc dài (`reading-<chủ đề>-02`)**: 650–950 từ, 13 câu hỏi (4 trắc nghiệm, 5 Đúng/Sai/Không có thông tin, 4 hoàn thành câu). Mỗi câu có trường `evidence` là số đoạn chứa đáp án; bài `-01` vẫn dùng bảng dẫn chứng cũ.
  - **Hoàn thành câu (`gap`)**: Người học gõ vào chỗ trống, tối đa HAI TỪ lấy từ bài. `gapCorrect` bỏ qua hoa/thường và một mạo từ đứng đầu (a/an/the) ở cả hai phía, so với từng đáp án trong `accept`; trả lời quá hai từ luôn bị tính sai. Câu trả lời lưu như chữ, câu trắc nghiệm vẫn lưu theo chỉ số lựa chọn.

## 6. Giới hạn đã biết

- Bước tự nhớ nghĩa (`recall`) phụ thuộc vào sự tự giác của người học.
- Các bài trắc nghiệm nhận diện vẫn có xác suất đoán đúng ngẫu nhiên.
- 25 bài đọc hiểu hiện tại (19 bài ngắn, 6 bài dài) là các bài luyện tập mẫu, điểm số dùng để tham khảo kỹ năng đọc, không phải chứng chỉ hay điểm số quy đổi IELTS chính thức.
