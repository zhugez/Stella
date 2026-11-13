# Đánh giá thiết kế học tập (2026-11-14)

- Người đánh giá: model `claude-fable-5-2`, chỉ đọc code, không sửa file.
- Phạm vi: commit `804b86f2` (`src/store`, `src/pages`, `public/atlas`).
- Phần 1–7 là nguyên văn bản đánh giá. Phần "Kiểm chứng" ở cuối là số liệu đo lại trên toàn bộ dữ liệu.
- Các số dòng (file:dòng) ứng với commit `804b86f2`. Code sau đó đã thay đổi.

## 1. Kết luận

Phần lập lịch của Stella vững, nhưng thứ được chấm điểm chưa đo đúng "biết từ". Điểm mạnh nhất là FSRS chỉ nhận lần trả lời đầu, và thẻ đã ổn định chủ yếu được hỏi bằng gõ chính tả (productive recall). Rủi ro lớn nhất là một thẻ FSRS gộp bốn dạng bài rất khác nhau, trong đó có dạng trả lời đúng mà không cần biết nghĩa. Từ mới chỉ được truy hồi một lần, ngay sau khi xem, rồi app mời học thêm. Nghĩa tiếng Việt từ A2 trở lên là định nghĩa dịch máy chứ không phải từ tương đương. Vì vậy "Đã thuộc" hiện có nghĩa gần với "nhận ra hoặc gõ lại được khi có đúng hình và câu ví dụ đó", chưa phải "dùng được trong IELTS".

## 2. Điểm làm tốt

1. **Tín hiệu chấm sạch.** Chỉ lần đầu trong phiên cập nhật FSRS; từ sai được luyện lại sau 4 bước bằng dạng khác, tối đa 2 lần, không chấm lại (session.ts:125-145; session.test.ts, test "retry feedback…").
2. **Thứ tự và giới hạn hợp lý.** Ôn trước, từ mới sau theo nhóm 5, tối đa 120 thẻ ôn mỗi phiên, mặc định 10 từ mới (session.ts:89, 97-104; store.ts:79-97).
3. **Productive recall cho thẻ ổn định.** Khi `s ≥ 4` và bật spell, 75% lượt ôn là gõ chính tả (session.ts:48). Phản hồi hiện từng chữ đúng/sai (Learn.tsx:309-318).
4. **Nhóm từ mới không cùng trường nghĩa.** Thứ tự học trộn chủ đề, ví dụ [trick, advise, identity, reality, lecturer] (entries/20.json), nên tránh được nhiễu giữa các từ gần nghĩa (Tinkham 1993; Waring 1997).
5. **Phản hồi sau mỗi câu đầy đủ.** Từ, IPA, hai nghĩa, câu ví dụ có tô đậm và audio (Learn.tsx:156, 348-381).
6. **Phạm vi trung thực.** Reading ghi rõ là bản nháp, tra từ thì đánh dấu "có hỗ trợ", nộp xong mới xem đáp án (Reading.tsx:84-87; vi.ts:336-337). Onboarding nói mức xuất phát không phải chứng nhận (vi.ts:156).

## 3. Vấn đề (theo mức ảnh hưởng)

**1. Từ mới được mã hoá quá mỏng, rồi app mời học thêm. (M)**
- Hiện tại: xem 5 thẻ, sau đó mỗi từ có một câu hỏi ngay lập tức (session.ts:100-104). Từ mới chỉ nhận dạng nhận diện: 45% picture, 35% meaning, 20% listen (session.ts:44-46). Trả lời đúng là Good.
- Từ trả lời đúng không được hỏi lại trong phiên. Các bước học là 1 phút và 10 phút (srs.ts:27), nhưng chỉ có tác dụng nếu người học tự quay lại.
- Đúng lúc các thẻ này chưa đến hạn, Today hiện nút "Học thêm 5 từ", bấm bao nhiêu lần cũng được (Today.tsx:60, 146).
- Vì sao hạn chế: truy hồi sau vài chục giây chủ yếu đo trí nhớ ngắn hạn. Nhiều lần truy hồi thành công, cách quãng, trong buổi đầu mới tạo trí nhớ bền (Rawson & Dunlosky 2011).
- Đổi: cuối phiên hỏi lại mọi từ mới bằng dạng recall và lấy lần này làm điểm FSRS. Ẩn nút "Học thêm" khi còn thẻ ở trạng thái learning.

**2. Một thẻ gộp bốn dạng bài, và có ba lỗ hổng chấm điểm. (S)**
- Listen chỉ là nghe rồi chọn chữ; các lựa chọn cùng chữ cái đầu và cùng độ dài (session.ts:64-66). Trả lời đúng không cần biết nghĩa nhưng vẫn được Good. Nếu tắt spell, 50% lượt ôn thẻ ổn định là listen (session.ts:49).
- Gợi ý chữ cái mở được đến `n−1` chữ mà vẫn là Hard, tức vẫn tính nhớ được và giãn lịch (Learn.tsx:231; session.ts:110).
- Màn spell có nút phát âm chính từ đó và không tính là gợi ý (Learn.tsx:284). Bài "nhớ từ theo nghĩa" thành bài chép chính tả.
- Chính tả phải khớp tuyệt đối (Learn.tsx:231). `organize` và `organise`, `kilometer` và `kilometre` là các mục riêng (8.json:1811 và 5125; 11.json:64; 16.json:1233), nên gõ biến thể kia là Again. Mục `cheque/check` (20.json:3806) buộc gõ cả dấu "/".
- Đổi: listen không cập nhật FSRS, hoặc thêm bước chọn nghĩa. Gợi ý từ 2 chữ trở lên, hoặc bấm nghe, thì chấm Again hoặc không chấm. Chấp nhận biến thể UK/US.

**3. Nghĩa tiếng Việt là định nghĩa dịch máy. (M–L)**
- Tôi xem 27 mục đầu của 5 chunk A2–C1 (entries 11, 20, 33, 48, 66). Cả 27 nghĩa đầu đều là định nghĩa dịch: `death` → "kết thúc cuộc đời của một người hoặc động vật", `democracy` → "Một hệ thống chính phủ trong đó người dân chọn ra lãnh đạo của mình", `identity` → "một người là ai".
- Ngược lại, 40/40 mục A1 đầu của chunk 0 là từ tương đương gọn ("thư viện, phòng đọc sách").
- Onboarding mặc định B1 (Onboarding.tsx:19), nên đa số người học gặp phần dịch máy.
- Lựa chọn của bài meaning là cả chuỗi định nghĩa này (data.ts:46-57; Learn.tsx:243; đã kiểm tra dòng `trick` trong index.json). Ngưỡng 9 giây (session.ts:111) dễ biến câu đúng thành Hard (suy luận).
- `tip_vi` hỏng ở 13/23 mục tôi đọc, vì từ tiếng Anh đang được bàn bị dịch luôn: "Lời khuyên là một động từ; lời khuyên là một danh từ không đếm được" (advise), "cũng được viết là cụ thể hóa bằng tiếng Anh Anh" (materialize).
- Collocation cũng có lỗi: "advise against｜khuyên chống lại".
- Vì sao hạn chế: nối form với meaning nhanh nhất qua từ L1 ngắn và chính xác (Nation 2013).
- Đổi: thêm trường từ tương đương 1–3 từ, dùng cho lựa chọn và đề spell. Tự động ẩn `tip_vi` nào không còn chứa từ tiếng Anh gốc. Đọc soát theo thứ tự học, bắt đầu từ B1.

**4. Không bao giờ hỏi "thấy hoặc nghe từ → nhớ ra nghĩa". (M)**
- Hiện tại: khi `s ≥ 2`, bài meaning biến mất (mọi từ đều có hình; session.ts:48-49). Trước đó nó chỉ là nhận diện 4 lựa chọn, với distractor cùng từ loại và cấp độ, chọn ngẫu nhiên về nghĩa (session.ts:68-69).
- Vì sao hạn chế: Reading và Listening của IELTS cần đúng chiều này. Recall khó hơn recognition và là hai mức kiến thức khác nhau (Laufer & Goldstein 2004).
- Đổi: với `s ≥ 4`, xen kẽ spell với bài "nghe hoặc thấy từ → tự nhớ nghĩa → lật thẻ → tự chấm", hoặc chọn nghĩa giữa các từ cùng chủ đề.

**5. Gợi ý cố định: luôn cùng một hình và cùng câu `ex[0]`. (S–M)**
- Hiện tại: picture và spell luôn dùng `ex[0]` (Learn.tsx:180, 268). Câu ngữ cảnh IELTS `ex[1]` chỉ xuất hiện ở thẻ giới thiệu.
- Distractor của cloze chọn theo chữ cái đầu và độ dài, không theo từ loại hay nghĩa (session.ts:64-66). Với "A white ___ glided silently across the lake", ngữ pháp và hình đã đủ để loại trừ.
- Với từ trừu tượng (reality, considerably), hình dễ thành cặp ghi nhớ hình–chữ thay cho nghĩa (suy luận; tôi chưa xem ảnh).
- Đổi: luân phiên `ex[0]` và `ex[1]`. Distractor cùng từ loại và cùng chủ đề. Bỏ hình ở cloze khi `s ≥ 4`.

**6. Practice và Reading không nối với lịch học. (S–M)**
- Practice chỉ ghi `typing` (Practice.tsx:191).
- Chế độ word và sentence hiện sẵn đáp án để chép (typing.ts:13), nên WPM đo tốc độ gõ, không đo việc nhớ.
- Bài collocation: 48/48 collocation của 14 mục tôi xem đều chứa chính headword đang hiện ở đề (Practice.tsx:387; drills.ts:25-36). Chỉ cần so chuỗi là đúng.
- Từ gặp trong Reading chỉ mở thẻ hoặc bookmark (Reading.tsx:82-89). Hàng chờ từ mới chỉ đi theo thứ tự index (session.ts:19-31).
- Đổi: thêm nút "Thêm vào hàng chờ" để `nextNew` ưu tiên. Collocation thì che headword hoặc bắt gõ collocate. Hạ ưu tiên chế độ chép câu. Đưa dictation và cloze-nghe vào lịch.

**7. Câu hỏi Reading có thể đoán theo vị trí. (S)**
- Đo trên passages.json: 18/19 câu MCQ có đáp án ở vị trí B; 0/19 câu TFNG có đáp án NOT GIVEN (11 FALSE, 8 TRUE). Lựa chọn không được xáo (Reading.tsx:109).
- docs/reading-implementation.md đã ghi nhận phân bố lệch; đây là con số cụ thể.
- Bài gắn nhãn B1 có "suprachiasmatic nucleus", "endogenous". Mỗi bài chỉ làm được một lần.
- Đổi: xáo lựa chọn khi hiển thị. Viết lại khoảng một phần ba câu TFNG thành NOT GIVEN. Gắn lại nhãn cấp độ.

**8. Chỉ số thưởng cho việc thêm từ mới. (S)**
- "Sao đã sáng" là số thẻ tồn tại, kể cả từ vừa trả lời sai (Today.tsx:75; Galaxy.tsx:280; Learn.tsx:390, 407).
- "Đã thuộc" là `st=2` và `s ≥ 21`, không xét thẻ đã quá hạn bao lâu (srs.ts:83-84).
- Streak chỉ cần một câu trả lời mỗi ngày (Today.tsx:25-34).
- "Đúng lần đầu" tính Hard là đúng, gộp mọi dạng bài, và MCQ có 25% đoán mò (session.ts:165; Me.tsx:53).
- Đổi: số chính là "từ đang nhớ được" theo retrievability (đã có hàm ở srs.ts:78). Đổi tên "Đã thuộc" thành mô tả đúng điều nó đo.

## 4. Còn thiếu cho mục tiêu IELTS

1. **Sản sinh ngôn ngữ.** Không có bài nào bắt viết câu hay điền collocate. Writing và Speaking cần "use", không chỉ form và meaning (Nation 2013).
2. **Paraphrase.** Dữ liệu `syn` và `ant` có sẵn (EntryView.tsx) nhưng không được hỏi, trong khi đây là cơ chế chính của Reading và Listening.
3. **Reading đúng quy mô.** Bài 140–198 từ với 2 câu đóng, so với bài thi khoảng 700–900 từ mỗi passage với matching headings, summary và sentence completion.
4. **Nghe trong lời nói liên tục.** Lịch học chỉ có từ đơn lẻ. Dictation và cloze-nghe (Practice.tsx:151) gần form completion nhất nhưng không được lên lịch.
5. **Word family.** Dữ liệu `fam` có sẵn nhưng không được kiểm tra, dù cần cho completion và độ chính xác khi viết.

## 5. Cách đo hiệu quả

App không lưu nhật ký từng lượt ôn, chỉ lưu trạng thái thẻ (srs.ts:5-18) và tổng theo ngày (store.ts:23-28). Bốn chỉ số đầu tính được từ file backup.

1. **Tỷ lệ quên.** Σ`lapses` / số thẻ có `st=2`, cùng phân bố `lapses` theo CEFR. Nguồn: `cards`.
2. **Chi phí mỗi từ.** Σ`days.t` / số thẻ có `s ≥ 21`; và Σ`days.r` / Σ`days.n` (số lượt ôn cho mỗi từ mới).
3. **Tồn đọng.** Số thẻ có `due < now − 1 ngày`, theo tuần. Tăng đều nghĩa là "Học thêm" đang vượt sức.
4. **Kiểm tra trễ ngoài app (quan trọng nhất).** Lấy ngẫu nhiên 30 thẻ có `s ≥ 21` và `last` cách ít nhất 14 ngày. Trên giấy, không hình, không câu mẫu: nói nghĩa; nghe rồi viết; đặt một câu. So tỷ lệ đúng với mức 90% FSRS dự đoán.
5. **Thêm nhật ký ôn** `{id, t, kind, grade, ms, state trước}` (S). Từ đó tính được retention thật theo dạng bài và theo khoảng cách ôn.

## 6. Ba việc nên làm trước

1. **Sửa chấm điểm** (vấn đề 2, cộng ẩn "Học thêm" khi còn thẻ learning). Ít code nhất, và mọi lịch ôn về sau phụ thuộc vào nó.
2. **Hỏi lại từ mới cuối phiên bằng recall, và thêm bài nhớ nghĩa cho thẻ ổn định** (vấn đề 1 và 4).
3. **Thêm từ tương đương tiếng Việt ngắn và lọc `tip_vi` hỏng**, bắt đầu từ B1 (vấn đề 3).

## 7. Giả định và điểm chưa chắc

- **Phương pháp đo.** Không có shell nên không chạy được script hay `npm test`. Mẫu nhỏ và không ngẫu nhiên (các mục đầu chunk). Tỷ lệ 27/27, 13/23, 48/48 là của mẫu, không phải của toàn bộ 7.298 từ. Reading thì đếm đủ 19 bài.
- **index.json** là một dòng 1,3 MB nên không đọc hết được. Tôi chỉ xác nhận dòng `trick` chứa định nghĩa tiếng Việt, và suy ra cả file theo scripts/sync_index_vi.py (suy luận).
- **FSRS.** Với ts-fsrs 5.4.2, Good đầu tiên cho thẻ mới dẫn đến bước 10 phút; số lần Good để đạt `s ≥ 21` khoảng 3–5 (chưa chắc; srs.test.ts chỉ bảo đảm không quá 8).
- **Chưa đo:** headword lọt vào lựa chọn tiếng Việt, và câu `ex[0]` lặp headword. Thử một số mẫu regex thì không thấy trường hợp `gap` che nhầm từ.
- **Kiểm tra toàn bộ entries:** không có chữ Hán trong `vi` hay `tip_vi` (0 kết quả).
- Ảnh hưởng thật của ngưỡng 9 giây và của hình minh hoạ từ trừu tượng cần dữ liệu người học (chưa chắc).
## Kiểm chứng (2026-11-14, đo trên toàn bộ dữ liệu)

Người đánh giá không chạy được lệnh, nên các số ở trên là đếm tay trên mẫu nhỏ. Các số dưới đây đo bằng script trên toàn bộ 7.298 mục từ tại commit `804b86f2`. Script chỉ đọc dữ liệu và đã được xóa sau khi chạy.

| Nhận định | Kết quả đo | Cách đo |
|---|---|---|
| Bài collocation chọn đúng được chỉ bằng cách so chuỗi (vấn đề 6) | Đúng. 29.946/30.000 câu (99,8%) chỉ có đáp án đúng chứa từ đang hỏi. 24.692/24.722 collocation (99,9%) chứa chính headword. | Mô phỏng 3.000 lượt, mỗi lượt 10 mục ngẫu nhiên, gọi `collocationQuestion` thật. |
| Nghĩa tiếng Việt là định nghĩa dịch máy (vấn đề 3) | Đúng, và không chỉ từ A2. Nghĩa đầu tiên trông như định nghĩa: A1 52,1%, A2 81,7%, B1 96,7%, B2 97,0%, C1 97,6%, C2 96,4%. | Ước lượng tự động: hơn 6 chữ, hoặc mở đầu bằng "một/người/để/sự/việc…", hoặc kết thúc bằng dấu chấm. |
| Lựa chọn của bài chọn nghĩa quá dài (vấn đề 3) | Mỗi lựa chọn dài trung vị 19 chữ (p75: 25, p90: 29). | Đếm chữ trong cột nghĩa của `index.json`. |
| `tip_vi` hỏng vì từ tiếng Anh bị dịch luôn (vấn đề 3) | Đúng. 5.421/5.908 mẹo có trích từ tiếng Anh (91,8%) đã mất ít nhất một từ đó. Ví dụ `library`: "Thư viện là thư viện mượn sách, hiệu sách là hiệu sách bán sách." | So các từ chữ Latinh trong `tip` (bản gốc tiếng Trung) với `tip_vi`. Đây là ước lượng tự động. |
| Trang Giới thiệu nói phần tiếng Việt do người biên soạn | Đúng là trang nói vậy (`about_lede_1`, `about_f4_title`). `CONTENT_LICENSE.md` lại nói nội dung do AI tạo và không soát từng mục. | Đọc `src/i18n/vi.ts`, `src/i18n/en.ts`. |
| Đáp án Reading đoán được theo vị trí (vấn đề 7) | Đúng. 18/19 câu trắc nghiệm có đáp án ở vị trí B (1 câu ở A). Câu True/False/Not Given: 11 FALSE, 8 TRUE, 0 NOT GIVEN. `reading-daily-01` gắn nhãn B1 có "suprachiasmatic nucleus". | Đếm toàn bộ `public/atlas/reading/passages.json`. |
| Biến thể UK/US là các mục riêng (vấn đề 2) | Đúng. Có 15 cặp, ví dụ organise/organize, behaviour/behavior, kilometre/kilometer, litre/liter, favour/favor, apologise/apologize. Mục `cheque/check` có dấu "/" trong headword. | Áp quy tắc -ise/-ize, -our/-or, -tre/-ter, -ogue/-og lên các headword, rồi loại cặp sai (our/or). |
| Onboarding mặc định B1 | Đúng: `Onboarding.tsx` khởi tạo mức 2 (B1). Cài đặt gốc trong `store.ts` là A1, nhưng chỉ dùng trước khi onboarding. | Đọc code. |
| Đường dẫn `data.ts:46-57` | Sai đường dẫn. File đúng là `src/atlas/data.ts`. Nội dung nhận định vẫn đúng: cột nghĩa của `index.json` là chuỗi định nghĩa. | Đọc code. |

Hai điểm tốt mà bản đánh giá chưa đo:

- Bài chọn nghĩa không lộ đáp án qua từ loại hay độ dài. Đáp án là lựa chọn duy nhất có từ loại đó ở 7/4.000 câu (0,2%). Đáp án là lựa chọn dài nhất ở 25,6% câu, gần bằng mức đoán ngẫu nhiên 25%.
- Nhóm 5 từ mới gần như không chứa cặp đồng nghĩa hoặc trái nghĩa: 1/1.457 nhóm.
