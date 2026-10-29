# LexAstra Brandkit & Design System

> **Every word is a star. Light up your IELTS.**
> *Một từ một tranh, thắp sáng hành trình IELTS.*

---

## 1. Brand Identity

- **Brandname:** **LexAstra** (`Lex` = Lexicon/Từ vựng, `Astra` = Tinh tú/Chòm sao).
- **Core Positioning:** Hệ sinh thái học từ vựng và rèn luyện kỹ năng IELTS thông qua hình ảnh trực quan, thuật toán giãn cách FSRS, phát âm bản xứ và giải nghĩa tiếng Việt chuẩn văn phong con người (không văn mẫu AI).
- **Tagline:**
  - *EN:* "One word, one canvas. Light up your IELTS."
  - *VI:* "Mỗi từ một bức tranh. Thắp sáng bầu trời IELTS của bạn."
- **Tone of Voice:**
  - **Trực diện, gần gũi, đời thường:** Viết như một người có kinh nghiệm thực tế đang chia sẻ với bạn bè.
  - **Nói không với từ ngữ sáo rỗng AI:** Cấm tuyệt đối các cụm từ rập khuôn: *mở khóa, đào sâu, bức tranh tổng thể, mang tính then chốt, cực kỳ quan trọng, trong thế giới ngày nay, hơn nữa, bên cạnh đó*.
  - **Tập trung vào tính ứng dụng:** Từ này người bản xứ dùng trong hoàn cảnh nào? Đi với giới từ gì? Dùng trong IELTS Writing Task 2 hay Speaking như thế nào để ăn điểm tự nhiên?

---

## 2. Color Palette (Dark-Mode Centric)

| Color Name | Hex Code | Purpose |
|---|---|---|
| **Cosmos Void** | `#0B0F19` | Nền chính (Deep space canvas), tạo chiều sâu tối đa cho các chòm sao |
| **Cosmos Surface** | `#131B2E` | Bề mặt card, panel, modal, khung điều khiển |
| **Cosmos Border** | `rgba(255, 255, 255, 0.08)` | Viền kính mờ tinh tế (Frosted glass divider) |
| **Starlight Gold** | `#F59E0B` | Màu nhấn chủ đạo: Ngôi sao mới thắp sáng, chuỗi ngày streak, huy hiệu nổi bật |
| **Terra Warmth** | `#E07A5F` | Màu đất nung ấm áp: Nút hành động chính (Primary CTA), kim la bàn |
| **Sage Nebula** | `#4EBA87` | Màu xanh dịu: Câu trả lời chính xác, độ ổn định trí nhớ cao (Mastered) |
| **Stardust White** | `#F9FAFB` | Chữ hiển thị chính (High contrast typography) |
| **Muted Stardust** | `#94A3B8` | Chữ phụ, ghi chú, phiên âm IPA |

---

## 3. Typography

- **Headings & Display:** `Fraunces` Variable Serif
  - Ấm áp, cổ điển, mang chiều sâu học thuật của các thư viện phương Tây.
  - Tự động hỗ trợ đầy đủ bộ ký tự tiếng Việt có dấu.
- **Body & UI Elements:** `Plus Jakarta Sans` / `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto`
  - Hiện đại, thoáng, nét chữ sạch sẽ, hiển thị hoàn hảo ở kích thước nhỏ (mobile & web).
- **Phonetics:** `Menlo, Monaco, Consolas` cho các chuỗi ký âm quốc tế (IPA).

---

## 4. Logo & Symbolism

- **The Astrolabe Compass (Thước trắc tinh & La bàn):**
  - Vòng tròn chiêm tinh học với các vạch định vị kinh tuyến.
  - Kim la bàn hướng thẳng lên phương Bắc dẫn đường cho người học.
  - Trọng tâm là ngôi sao tinh tú phát sáng tượng trưng cho tri thức được khai phá.

---

## 5. Product Architecture (4 IELTS Skills)

```
LexAstra
├── 🌌 Lexicon & Atlas (7,298 từ vựng IELTS + Tranh minh hoạ + Audio UK/US + FSRS)
├── 🎧 Listening (Nghe chính tả câu ví dụ thực tế + Điền từ vào chỗ trống)
├── 📖 Reading (Đoạn văn học thuật theo 19 chủ đề IELTS + Click tra từ tức thì)
└── ✍️ Writing (Luyện viết Task 1 / Task 2 với gợi ý từ vựng theo chủ đề + AI feedback)
```

---

## 6. Attribution & Upstream Credits

- **Creator & Maintainer:** `zhugez` (`github.com/zhugez/lexastra`)
- **Upstream Project:** Directly inspired by and built upon **Word Atlas** by Yang Lei (`designfuchen/word-atlas`).
- **Licenses:**
  - Application Code: **MIT License**
  - Dataset & Original Illustrations: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
