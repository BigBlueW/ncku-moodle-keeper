# NCKU Moodle Keeper 🎓

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

這是一個簡單的瀏覽器擴充功能，旨在解決成功大學 (NCKU) Moodle 平台經常自動登出的問題。它會自動點擊「延長連線時間」按鈕，並在背景定期與伺服器通訊以保持連線。

### 核心功能
- **自動續期**：每 9 分鐘自動與 Moodle 通訊，防止連線過期。
- **自動點擊**：若畫面上出現彈出的「延長連線時間」對話框，程式會自動為您點擊。

### 如何啟用
1. 下載此專案的所有檔案。
2. 打開 Chrome，進入 `擴充功能` 頁面 (`chrome://extensions/`)。
3. 開啟右上角的「**開發者模式**」。
4. 點擊「**載入未封裝項目**」，並選擇此專案的文件夾。
5. 登入 NCKU Moodle 後，擴充功能將會自動開始運作。

### 注意事項
- **電腦需保持開啟**：若電腦進入睡眠或休眠狀態，擴充功能將停止運作。
- **需開啟 Moodle 頁面**：您必須在瀏覽器中保持至少一個 Moodle 分頁開啟，擴充功能才能在該頁面執行背景續期。

---

## English

A simple browser extension designed to prevent automatic logout on the NCKU Moodle platform. It automatically clicks the "Extend session" button and periodically pings the server to keep your connection alive.

### Key Features
- **Auto-Renewal**: Automatically communicates with Moodle every 9 minutes to prevent session expiration.
- **Auto-Click**: Automatically clicks the "Extend session" button if the popup dialog appears.

### How to Enable
1. Download all files in this project.
2. Open Chrome or Edge and go to the `Extensions` page (`chrome://extensions/`).
3. Enable "**Developer mode**" in the top right corner.
4. Click "**Load unpacked**" and select the folder containing this project.
5. Once you log in to NCKU Moodle, the extension will activate automatically.

### Important Notes
- **Keep Computer Awake**: The extension will stop working if your computer goes to sleep or hibernate.
- **Keep Moodle Tab Open**: You must keep at least one Moodle tab open in your browser for the extension to perform its background keep-alive tasks.
