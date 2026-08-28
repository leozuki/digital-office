# 🚗 Vehicle Distance Safety App

Ứng dụng web đo khoảng cách với xe phía trước bằng camera điện thoại/laptop,
và cảnh báo khi khoảng cách đó nhỏ hơn khoảng cách an toàn tối thiểu theo tốc
độ hiện tại — chạy hoàn toàn trên trình duyệt (client-side), không cần backend.

## Cách hoạt động

1. **Nhận diện xe**: dùng [TensorFlow.js](https://www.tensorflow.org/js) với
   mô hình [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
   để phát hiện `car` / `truck` / `bus` trong khung hình camera theo thời gian thực.
2. **Ước lượng khoảng cách**: dùng phương pháp **triangle similarity** (tam giác
   đồng dạng) — kỹ thuật đo khoảng cách đơn mắt (monocular distance estimation)
   phổ biến trong các repo thị giác máy tính:

   ```
   distance = (real_width_of_object * focal_length) / width_of_object_in_pixels
   ```

   `focal_length` (tiêu cự tính bằng pixel) được suy ra qua bước **hiệu chuẩn**:
   đỗ trước một xe ở khoảng cách đã biết, nhập khoảng cách đó vào ứng dụng.
3. **Tốc độ hiện tại**: lấy từ GPS (Geolocation API, `coords.speed`) hoặc nhập
   tay khi thiết bị không hỗ trợ/không cho phép định vị.
4. **Khoảng cách an toàn tối thiểu**: tính theo quy định Việt Nam
   (Thông tư 31/2019/TT-BGTVT, Điều 11) và quy tắc 2 giây cho tốc độ ≤ 60 km/h:

   | Tốc độ | Khoảng cách an toàn tối thiểu |
   |---|---|
   | ≤ 60 km/h | quy tắc 2 giây (tối thiểu 10 m) |
   | 60–80 km/h | 55 m |
   | 80–100 km/h | 70 m |
   | 100–120 km/h | 100 m |

5. Ứng dụng so sánh khoảng cách đo được với khoảng cách an toàn và hiển thị:
   - 🟢 **An toàn**
   - 🟡 **Cảnh báo** (dưới ngưỡng an toàn)
   - 🔴 **Nguy hiểm** (dưới 70% ngưỡng an toàn) kèm tín hiệu âm thanh

## Chạy thử

Không cần cài đặt gì — chỉ cần phục vụ thư mục này qua HTTP (camera API yêu
cầu HTTPS hoặc `localhost`, không hoạt động khi mở trực tiếp file `file://`):

```bash
cd vehicle-distance-safety
npx serve .
# hoặc
python3 -m http.server 8080
```

Sau đó mở `http://localhost:<port>` trên điện thoại/laptop có camera, cho phép
quyền camera (và vị trí nếu muốn dùng tốc độ từ GPS).

## Hiệu chuẩn (bắt buộc để có số đo chính xác)

1. Mở ⚙️ **Cài đặt**.
2. Đỗ xe/đứng cách một ô tô phía trước một khoảng cách đã biết (đo bằng thước
   dây hoặc máy đo laser), ví dụ 10 m.
3. Đảm bảo camera đang nhận diện được xe đó (khung màu xanh/đỏ hiện trên xe).
4. Nhập khoảng cách thực tế vào ô **Khoảng cách thực tế (m)** và bấm
   **Hiệu chuẩn**. Giá trị tiêu cự (focal length) được lưu vào `localStorage`
   của trình duyệt để dùng cho các lần sau.
5. Có thể chỉnh **chiều rộng xe tham chiếu** (mặc định 1.8 m — chiều rộng
   trung bình của ô tô con) nếu xe hiệu chuẩn có kích thước khác biệt rõ rệt.

## Giới hạn

- Đây là ước lượng đơn mắt (monocular), độ chính xác phụ thuộc vào chất lượng
  hiệu chuẩn, góc đặt camera và việc xe đi cùng làn/hướng thẳng với camera.
  Không dùng để thay thế cảm biến radar/lidar trong các hệ thống ADAS thực tế.
- `coords.speed` từ Geolocation API không phải lúc nào cũng khả dụng trên máy
  tính để bàn hoặc khi tín hiệu GPS yếu — khi đó hãy chuyển sang nhập tốc độ
  bằng tay trong phần Cài đặt.
- Xe "gần nhất" hiện được xác định bằng heuristic đơn giản: khung nhận diện có
  chiều rộng lớn nhất trong khung hình.

## Cấu trúc

```
vehicle-distance-safety/
├── index.html   # Giao diện: camera, overlay canvas, HUD, panel cài đặt
├── app.js       # Nhận diện xe, ước lượng khoảng cách, quy tắc an toàn, cảnh báo
└── style.css    # Giao diện tối (dark UI) tối ưu cho dùng ngoài trời/trong xe
```
