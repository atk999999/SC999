# Tu Tiên 2D — Phiên bản React AI Studio (Offline Ready)

Mã nguồn đã được chuyển đổi sang cấu trúc **React + Vite (Google AI Studio)** hoàn chỉnh, tích hợp thanh công cụ **Đạo Đài React Bridge** kết nối trực tiếp với nhân lõi `window.PNTT` của trò chơi và khắc phục toàn bộ lỗi chạy ngoại tuyến.

## 1. Cấu trúc dự án chuẩn React AI Studio

- `metadata.json`: Cấu hình metadata chuẩn cho Google AI Studio.
- `index.html`: Điểm vào ứng dụng, tích hợp `importmap` React 19 ESM tương thích trực tiếp với môi trường preview của AI Studio.
- `vite.config.js` & `package.json`: Cấu hình Vite + React chuẩn (`npm run dev`, `npm run build`, `npm run preview`, `npm run check`).
- `src/main.jsx`, `src/App.jsx`, `src/style.css`: Giao diện React **Đạo Đài AI Studio** đồng bộ trực tiếp chỉ số nhân vật (`Cảnh giới`, `Đạo Hạnh`, `Linh Thạch`, `Dược Công`, `Nhiệm vụ`), hỗ trợ bảng Pháp Bảo trợ giúp tu luyện ngoại tuyến và trình quản lý sao lưu/khôi phục file Save (`.json`).
- `public/legacy/`: Toàn bộ tài nguyên và 31 gói script của game (`bundles/legacy-000.js` → `legacy-030.js`), kèm cấu hình ngoại tuyến đầy đủ trong `runtime-config.js` (`LootRates`, `GachaRates`, `MO_KHOA`) và bộ ánh xạ tự động `.png` ↔ `.webp` trong `assets/manifest.js`.
- `scripts/npm-runner.mjs` & `scripts/check-project.mjs`: Bộ chạy `npm` thông minh — tự động dùng `vite` nếu đã cài `node_modules`, hoặc tự động biên dịch JSX và chạy máy chủ/đóng gói độc lập ngay cả khi môi trường không có kết nối mạng.

## 2. Cách chạy bằng npm

```bash
# Kiểm tra tính toàn vẹn của mã nguồn và liên kết HTML (0 lỗi, < 1.000 file)
npm run check

# Chạy máy chủ phát triển (Dev Server tại http://localhost:3000)
npm run dev

# Đóng gói bản dựng hoàn chỉnh ra thư mục dist/
npm run build

# Xem trước bản dựng từ thư mục dist/ (tại http://localhost:4173)
npm run preview
```

## 3. Đưa lên Google AI Studio

- Giải nén gói `TuTien2D_React_AIStudio.zip` (tổng cộng **967 file**, nằm dưới giới hạn 1.000 file của Google AI Studio) và tải lên hoặc import trực tiếp vàodự án React trên AI Studio.
