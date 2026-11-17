# YÊU CẦU: Mini game "Đập Chuột" (Whack-a-Mole)

> Tài liệu mô tả yêu cầu, chưa bao gồm code.
> Phiên bản: 1.0 · Ngày: 12/11/2026

## 1. Tổng quan

- **Mục tiêu:** Một mini game chạy trực tiếp trên trình duyệt. Người chơi bấm vào chuột xuất hiện ngẫu nhiên trên lưới để ghi điểm trong thời gian giới hạn.
- **Nền tảng:** Trình duyệt web trên máy tính và điện thoại (Chrome, Safari, Edge, Firefox bản mới).
- **Công nghệ:** HTML + CSS + JavaScript thuần, không cần server, không cần cài đặt. Mở file `index.html` là chơi được.
- **Phạm vi:** Một người chơi, chơi offline, không có đăng nhập.

## 2. Luật chơi

1. Bàn chơi là **lưới 3×3, tổng 9 ô (9 cái hang)**.
2. Mỗi lượt chơi kéo dài **30 giây**, tính từ lúc người chơi bấm "Bắt đầu".
3. Tại một thời điểm chỉ có **tối đa 1 con chuột** xuất hiện, ở một ô chọn ngẫu nhiên.
4. Chuột ở lại trên ô trong một khoảng ngắn (gợi ý: **0,8 đến 1,2 giây**), rồi tự biến mất.
5. Sau khi chuột biến mất (bị đập trúng hoặc hết giờ hiện), chuột mới sẽ xuất hiện ở một ô ngẫu nhiên khác. Ô mới **không trùng** với ô vừa xuất hiện, để tránh cảm giác chuột "đứng yên".
6. Người chơi bấm (click hoặc chạm) vào ô đang có chuột thì tính là **đập trúng**.
7. Khi hết 30 giây, game dừng ngay: chuột biến mất và không nhận thêm thao tác bấm.

## 3. Cách tính điểm

| Tình huống | Điểm |
|---|---|
| Bấm trúng ô đang có chuột | **+1** |
| Bấm vào ô trống | 0 (không trừ điểm) |
| Chuột tự biến mất mà không bị đập | 0 (không trừ điểm) |

Quy tắc bổ sung:
- Mỗi con chuột chỉ được tính **1 điểm**. Bấm liên tiếp nhiều lần vào cùng một con không cộng thêm.
- Ngay khi bị đập trúng, chuột biến mất (hoặc chuyển sang trạng thái "bị đập") nên không thể bấm trúng lần nữa.
- Điểm bắt đầu từ **0** ở mỗi lượt mới.
- **Điểm cao nhất (kỷ lục):** lưu trên trình duyệt của người chơi (localStorage) và hiển thị ở màn hình bắt đầu và kết thúc. Nếu trình duyệt không cho lưu, game vẫn chạy bình thường, chỉ không hiện kỷ lục.

## 4. Màn hình

### 4.1. Màn hình Bắt đầu
- Tên game: **"Đập Chuột"**
- Hướng dẫn ngắn trong 1 đến 2 dòng, ví dụ: "Bấm trúng chuột để được 1 điểm. Bạn có 30 giây!"
- Hiển thị **Kỷ lục**, nếu đã có.
- Nút **"Bắt đầu"**.

### 4.2. Màn hình Chơi
- **Thanh trên cùng** gồm:
  - **Điểm:** số điểm hiện tại, cập nhật ngay khi đập trúng.
  - **Thời gian:** đếm ngược từ 30 về 0 theo giây. Có thể đổi màu (ví dụ sang đỏ) khi còn dưới 5 giây.
- **Lưới 3×3** nằm giữa màn hình, các ô bằng nhau và đủ lớn để bấm bằng ngón tay trên điện thoại.
- **Phản hồi khi đập trúng:** có hiệu ứng nhìn thấy được, ví dụ ô nháy sáng, chuột đổi hình "bị đập", hoặc hiện chữ "+1".
- Không có nút tạm dừng (giữ game đơn giản ở phiên bản 1.0).

### 4.3. Màn hình Kết thúc
- Thông báo **"Hết giờ!"**
- **Điểm của lượt này**.
- **Kỷ lục**. Nếu lượt này phá kỷ lục, hiện thêm thông báo "Kỷ lục mới!".
- Nút **"Chơi lại"**: bắt đầu ngay một lượt mới (điểm về 0, đồng hồ về 30 giây).

### 4.4. Luồng màn hình

```
[Bắt đầu] --bấm "Bắt đầu"--> [Chơi 30s] --hết giờ--> [Kết thúc]
                                  ^                       |
                                  +-----bấm "Chơi lại"----+
```

## 5. Yêu cầu khác

- **Responsive:** hiển thị gọn trên màn hình từ 360px (điện thoại) đến màn hình máy tính, không phải cuộn ngang.
- **Cảm ứng:** trên điện thoại, chạm vào ô phải được nhận ngay, không bị trễ và không làm phóng to trang.
- **Hình ảnh:** dùng emoji hoặc hình vẽ CSS cho chuột (ví dụ 🐭) để không phụ thuộc file ảnh bên ngoài.
- **Âm thanh:** không bắt buộc ở phiên bản 1.0.

## 6. Tiêu chí hoàn thành (Acceptance Criteria)

Game được coi là xong khi đạt **tất cả** các mục sau:

**Bàn chơi và luồng**
- [ ] Mở `index.html` trên trình duyệt là thấy màn hình Bắt đầu, không có lỗi trong Console.
- [ ] Bấm "Bắt đầu" thì chuyển sang màn hình Chơi, hiện lưới đúng **3×3 = 9 ô**.
- [ ] Hết giờ thì tự chuyển sang màn hình Kết thúc.
- [ ] Bấm "Chơi lại" thì bắt đầu lượt mới, điểm = 0, thời gian = 30.

**Chuột**
- [ ] Mỗi thời điểm có **không quá 1 con chuột** trên lưới.
- [ ] Vị trí chuột ngẫu nhiên và không lặp lại ô ngay trước đó.
- [ ] Chuột tự biến mất nếu không bị đập trong khoảng 0,8 đến 1,2 giây.

**Điểm**
- [ ] Đập trúng chuột thì điểm **+1** và cập nhật ngay trên màn hình.
- [ ] Bấm ô trống thì điểm **không đổi**.
- [ ] Bấm liên tục vào cùng một con chuột chỉ được **1 điểm**.
- [ ] Màn hình Kết thúc hiện đúng điểm cuối của lượt.
- [ ] Kỷ lục được lưu lại sau khi tải lại trang (F5) và chỉ cập nhật khi điểm mới cao hơn.

**Thời gian**
- [ ] Đồng hồ bắt đầu từ **30** và giảm mỗi giây, dừng ở **0**.
- [ ] Một lượt chơi kéo dài đúng khoảng 30 giây (sai số không quá 1 giây).
- [ ] Sau khi hết giờ, bấm vào lưới **không** cộng thêm điểm.

**Thiết bị**
- [ ] Chơi được trên Chrome máy tính và trình duyệt điện thoại (iOS Safari hoặc Android Chrome).
- [ ] Trên màn hình rộng 360px, lưới hiển thị đủ 9 ô, không bị tràn, bấm được bằng ngón tay.

## 7. Ngoài phạm vi (chưa làm ở phiên bản 1.0)

- Nhiều mức độ khó (chuột nhanh dần, nhiều chuột cùng lúc)
- Bom hoặc vật cản gây trừ điểm
- Âm thanh, nhạc nền
- Bảng xếp hạng online, đăng nhập
- Nút tạm dừng
