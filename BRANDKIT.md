# Stella Brandkit & Design System

> **Every word is a star. Light up your IELTS.**  
> *Mỗi từ một bức tranh. Thắp sáng hành trình IELTS.*

---

## 1. Brand Essence & Story

- **Brandname:** **Stella** (Tiếng Latinh: *Ngôi sao / Tinh tú*).
- **Core Positioning:** Hệ sinh thái học từ vựng và rèn luyện 4 kỹ năng IELTS thông qua tranh vẽ ngữ cảnh, phát âm bản xứ, thuật toán giãn cách FSRS và hệ thống giải nghĩa tiếng Việt chuẩn văn phong con người (nói không với văn mẫu AI).
- **Core Metaphor:** Người học là một nhà thám hiểm (explorer). Mỗi từ vựng học được là một ngôi sao được thắp sáng trên bầu trời tri thức 3D Galaxy.
- **Tagline:**
  - *EN:* "One word, one canvas. Light up your stars."
  - *VI:* "Mỗi từ một bức tranh. Thắp sáng những vì sao IELTS."

---

## 2. Voice & Tone Standards (CHẾ ĐỘ BIÊN TẬP VIÊN CON NGƯỜI)

1. **Trực diện, gần gũi, chia sẻ kinh nghiệm:**
   - Viết như một người đi trước giàu kinh nghiệm thực tế đang ngồi chỉ bài cho một người bạn.
   - Nhịp điệu câu tự nhiên: kết hợp câu ngắn, dứt khoát với các câu dài ngắt nghỉ hợp lý.
2. **Tuyệt đối cấm các sáo ngữ của AI:**
   - ❌ *Cấm:* "mở khóa" (unlock), "đào sâu" (delve), "bức tranh tổng thể" (tapestry), "điều đáng lưu ý là", "cực kỳ quan trọng" (crucial), "mang tính then chốt" (pivotal), "trong thế giới ngày nay", "hơn nữa", "ngoài ra", "bên cạnh đó".
3. **Thực tế trong phòng thi IELTS:**
   - Tập trung giải thích: Từ này dùng trong ngữ cảnh nào? Dùng trong Speaking hay Writing? Dễ nhầm với từ nào? Đi với giới từ gì? Giám khảo đánh giá cao cụm collocation nào?

---

## 3. Color Tokens (Cosmos Dark System)

| Token Name | Hex Code | Visual Role |
|---|---|---|
| **Cosmos Void** | `#0B0F19` | Nền chính sâu thẳm, tạo chiều sâu thị giác tối đa cho chòm sao 3D |
| **Cosmos Surface** | `#131B2E` | Bề mặt thẻ từ, modal, panel điều khiển |
| **Cosmos Border** | `rgba(255, 255, 255, 0.08)` | Viền kính mờ tinh tế (Frosted glass divider) |
| **Starlight Gold** | `#F59E0B` | Màu nhấn đặc trưng: Sao mới thắp sáng, chuỗi streak, huy hiệu xuất sắc |
| **Terra Warmth** | `#E07A5F` | Màu đất nung ấm áp: Nút hành động chính (Primary CTA), kim la bàn |
| **Sage Nebula** | `#4EBA87` | Màu xanh ngọc: Câu trả lời chính xác, độ ổn định trí nhớ cao (Mastered) |
| **Stardust White** | `#F9FAFB` | Chữ hiển thị chính (High contrast typography) |
| **Muted Stardust** | `#94A3B8` | Chữ phụ, ghi chú, phiên âm IPA |

---

## 4. Typography

- **Headings & Display:** `Fraunces` Variable Serif (Serif ấm áp, cổ điển, mang chiều sâu của thư viện Oxford, hỗ trợ đầy đủ tiếng Việt).
- **Interface & Body:** `Plus Jakarta Sans` / `-apple-system, BlinkMacSystemFont, Segoe UI` (Hiện đại, nét chữ thoáng đãng, sắc nét trên màn hình Retina).
- **Phonetics & Code:** `Consolas, Menlo, Monaco` (Hiển thị chính xác các ký hiệu phiên âm IPA).

---

## 5. Technology Standards

- **Package Manager:** `pnpm` (nhanh, tiết kiệm đĩa, cô lập dependency sạch sẽ).
- **Linter & Formatter:** `oxlint` từ [Oxc](https://oxc.rs/) (tốc độ Rust sub-20ms, loại bỏ hoàn toàn gánh nặng ESLint/Prettier cồng kềnh).
- **Edge Deployment:** Cloudflare Workers với static asset caching và audio edge-proxy.

---

## 6. Attribution & Upstream Credits

- **Author & Maintainer:** `zhugez` (`github.com/zhugez/stella`)
- **Upstream Foundation:** Directly inspired by and built upon **Word Atlas** by Yang Lei (`designfuchen/word-atlas`).
- **Licenses:**
  - Application Code: **MIT License**
  - Dataset & Original Illustrations: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
