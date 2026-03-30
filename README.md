# NCKU Moodle Keeper 🎓

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

這是一個簡單的瀏覽器擴充功能，旨在解決成功大學 (NCKU) Moodle 平台經常自動登出的問題。它支援自動延長連線，並具備本地 OCR 驗證碼辨識功能。

### 核心功能
- **自動續期**：每 9 分鐘自動與 Moodle 通訊，防止連線過期。
- **本地 OCR 驗證碼辨識**：
  - **全本地執行**：使用 Tesseract.js 在瀏覽器內完成辨識，不需配置 API key。
  - **開關控制**：在驗證碼圖片旁設有「AutoCaptcha」開關，可切換是否自動輸入（狀態會持久儲存）。

### 如何啟用
1. 下載此專案的所有檔案。
2. 打開 Chrome，進入 `擴充功能` 頁面 (`chrome://extensions/`)。
3. 開啟右上角的「**開發者模式**」。
4. 點擊「**載入未封裝項目**」，並選擇此專案的文件夾。
5. 登入 NCKU Moodle 後，擴充功能將會自動開始運作。

### 注意事項
- **權限**：需要 `storage` 權限以儲存您的 Auto-fill 開關狀態。

---

## English

A simple browser extension designed to prevent automatic logout on the NCKU Moodle platform, now with built-in Local OCR for captcha solving.

### Key Features
- **Auto-Renewal**: Automatically communicates with Moodle every 9 minutes to prevent session expiration.
- **Local OCR Captcha Solver**:
  - **Privacy First**: Recognizes captchas locally using Tesseract.js. No external APIs used.
  - **Persistence Toggle**: Includes an "AutoCaptcha" switch next to the captcha to enable/disable the feature, with the state saved across sessions.

### How to Enable
1. Download all files in this project.
2. Open Chrome or Edge and go to the `Extensions` page (`chrome://extensions/`).
3. Enable "**Developer mode**" in the top right corner.
4. Click "**Load unpacked**" and select the folder containing this project.
5. Once you log in to NCKU Moodle, the extension will activate automatically.

### Important Notes
- **Permissions**: Requires the `storage` permission to save your Auto-fill preference.
