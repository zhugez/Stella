<div align="center">

<img src="docs/assets/cover-v3.jpg" alt="Stella — học từ vựng IELTS qua tranh" width="100%">

# Stella

Ứng dụng học và luyện từ vựng IELTS bằng tranh minh hoạ. Mỗi từ có một bức tranh riêng, audio bản ngữ UK/US, và lịch ôn tập FSRS.

[**Bản chạy thử**](https://stella.zhugez.workers.dev) · [**Bộ dữ liệu**](data/) · [**Brandkit**](BRANDKIT.md) · [**Lộ trình**](#lộ-trình)

[![Code: MIT](https://img.shields.io/badge/code-MIT-17283B?style=flat-square)](LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/dataset-CC%20BY%204.0-AD5038?style=flat-square)](CONTENT_LICENSE.md)

<sub>[English](README.md)</sub>

</div>

---

Stella là web app chạy cục bộ, không cần đăng ký, dùng để xây vốn từ vựng IELTS. Bộ dữ liệu gồm 7.298 từ trải đều sáu bậc CEFR. Mỗi từ có tranh minh hoạ, câu ví dụ theo ngữ cảnh, bản ghi âm giọng bản ngữ UK và US, cụm từ thường đi kèm (collocation), và phần giải nghĩa kèm ghi chú dùng từ bằng tiếng Việt.

Không có tài khoản, không có dữ liệu trên server. Toàn bộ tiến độ học nằm trong trình duyệt và xuất ra được thành file JSON.

<table>
  <tr>
    <td width="50%"><img src="docs/assets/atlas-desktop.jpg" alt="Atlas từ vựng" width="100%"></td>
    <td width="50%"><img src="docs/assets/galaxy.jpg" alt="Dải ngân hà 3D" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><sub>Atlas — duyệt và lọc toàn bộ 7.298 từ</sub></td>
    <td align="center"><sub>Galaxy — cùng số từ đó, hiển thị như một bản đồ sao</sub></td>
  </tr>
</table>

## Tính năng

**Atlas.** Mỗi bức tranh vẽ đúng tình huống trong câu ví dụ của từ đó, nên tranh và câu nói về cùng một sự việc. Lọc theo bậc CEFR hoặc theo một trong 19 nhóm chủ đề IELTS.

**Thẻ học.** Nghĩa, câu ví dụ, họ từ, từ đồng nghĩa, từ trái nghĩa, collocation, kèm ghi chú về sắc thái và giới từ mà người Việt hay dùng sai.

**Thẻ đa ngữ.** Cả 7.298 mục từ và 24.722 collocation đều có phần giải nghĩa tiếng Việt, tiếng Trung và tiếng Pháp bên cạnh tiếng Anh. Bộ chọn cặp ngôn ngữ lật thẻ giữa EN→VI, VI→EN, ZH→VI, VI→ZH, FR→VI và VI→FR.

**Lịch ôn tập FSRS.** Thời điểm ôn do [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs) quyết định — thuật toán đứng sau các bản Anki hiện đại. Với mỗi thẻ, nó ước lượng độ bền trí nhớ và mức độ còn nhớ được, rồi xếp lịch ôn ngay trước lúc bắt đầu quên.

**Galaxy.** Toàn bộ 7.298 từ trải thành các ngôi sao trong một trường hạt WebGL2. Kích thước và màu của mỗi sao lấy từ trạng thái ôn tập của thẻ: từ chưa gặp là bụi sao mờ, từ đã học sáng và to dần, từ đã thuộc chuyển vàng và có quầng. Thẻ đến hạn hôm nay được vẽ quầng rộng để vẫn thấy khi thu nhỏ.

**Luyện gõ.** Ba chế độ gõ để nhớ chủ động: nhìn tranh gõ lại từ, chép lại cả câu, hoặc nghe audio bản ngữ rồi viết ra.

**Âm nền.** Có thể bật âm nền (mưa, quán cà phê, bờ biển, rừng, lò sưởi); âm nền tự nhỏ lại khi phát audio phát âm.

**Chạy offline.** Service worker cache phần khung app và audio, nên vẫn dùng được khi mất mạng.

## Bộ dữ liệu

| | |
|---|---|
| Số từ | 7.298 |
| Bậc CEFR | A1 (785) · A2 (1.039) · B1 (1.465) · B2 (2.127) · C1 (1.608) · C2 (274) |
| Nhóm chủ đề | 19 |
| Collocation | 24.722 |
| Audio | 22.905 clip giọng bản ngữ UK và US |
| Ngôn ngữ giải nghĩa | Anh, Việt, Trung, Pháp (đủ 100%) |
| Tệp | [`public/atlas/entries/`](public/atlas/entries/) (73 phần) · [`data/word-atlas.json`](data/word-atlas.json) |

## Công nghệ

React 19 · TypeScript 5.9 · Vite 6 · pnpm · `ts-fsrs` · WebGL2 · Cloudflare Workers

Lint chạy bằng [Oxc](https://oxc.rs/).

Cloudflare nhận tối đa 20.000 file mỗi lần deploy, trong khi bộ audio có 22.905 clip, nên audio không nằm trong bản build. `src/worker.ts` chặn `/atlas/audio/*`, lấy file từ repository qua endpoint raw của GitHub rồi cache ở edge. Bước build cũng xoá `dist/atlas/audio` trước khi upload.

## Chạy thử

Cần Node.js 20+ và pnpm 10+.

```bash
git clone https://github.com/zhugez/stella.git
cd stella
pnpm install
pnpm dev          # http://localhost:5188
```

Các lệnh khác:

```bash
pnpm build        # kiểm tra kiểu rồi build ra dist/
pnpm preview      # chạy thử bản production
pnpm test         # unit test (node:test + tsx)
pnpm oxlint       # lint
pnpm check:atlas  # kiểm tra tính toàn vẹn của bộ dữ liệu
```

Deploy cần tài khoản Cloudflare và `pnpm dlx wrangler login`:

```bash
pnpm deploy
```

## Lộ trình

Phần từ vựng, tranh minh hoạ, audio và ôn tập ngắt quãng đã xong. Các kỹ năng IELTS còn lại chưa làm.

- [x] Atlas — 7.298 từ có tranh và audio UK/US
- [x] Lịch ôn tập FSRS
- [x] Luyện gõ và nghe chép
- [x] PWA và deploy lên edge
- [ ] Listening — bài điền khuyết theo ngữ cảnh, chỉnh tốc độ audio, có transcript
- [ ] Reading — bài đọc học thuật, bấm vào từ để tra ngay
- [ ] Writing — đề Task 1 và Task 2 kèm kho collocation theo chủ đề

## Ghi công

Tác giả và người duy trì: [zhugez](https://github.com/zhugez).

Stella là bản fork của [Word Atlas](https://github.com/designfuchen/word-atlas) do [Yang Lei (@designfuchen)](https://github.com/designfuchen) viết. Toàn bộ phần ứng dụng — atlas, galaxy WebGL, bộ lập lịch FSRS, công cụ luyện gõ và âm nền — là công trình gốc từ upstream, được dùng lại theo giấy phép của nó.

Phần bản fork này thêm vào:

- Giải nghĩa tiếng Việt, tiếng Trung và tiếng Pháp cho cả 7.298 mục từ và 24.722 collocation
- Bộ chọn cặp ngôn ngữ hai chiều, áp dụng cho thẻ, bộ lọc và phần luyện tập
- Chuyển sang pnpm và Oxc thay cho npm và ESLint
- Deploy Cloudflare Workers kèm proxy audio ở edge, và service worker cho PWA

## Giấy phép

- Mã nguồn: [MIT](LICENSE)
- Bộ dữ liệu và tranh minh hoạ: [CC BY 4.0](CONTENT_LICENSE.md)
