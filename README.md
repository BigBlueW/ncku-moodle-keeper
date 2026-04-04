# NCKU Moodle Keeper 🎓

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

這是一個簡單的瀏覽器擴充功能，旨在解決成功大學 (NCKU) Moodle 平台自動登出的問題。現在同時支援 Moodle 的自動延長連線，還支援全校多個系統（如 Moodle、選課系統、futureplus 等）的驗證碼自動辨識功能。

### 核心功能
- **自動續期**：每 9 分鐘自動與 Moodle 通訊，防止連線過期。
- **自定義輕量級驗證碼辨識**：
  - **全校系統支援**：不僅支援 Moodle，也支援成功大學選課系統 (`course.ncku.edu.tw`)、FuturePlus (`futureplus.ncku.edu.tw`) 等其他具有類似驗證碼機制的 NCKU 入口網站。
  - **極速辨識**：使用樣板匹配演算法，體積小，辨識速度快。
  - **全本地執行**：完全在瀏覽器內完成，不需額外設定、不需 API key。

### 如何啟用（一般使用者）
1. 在 GitHub 的 **Releases** 頁面下載最新版 `ncku-moodle-keeper.zip`。
2. 解壓縮該檔案。
3. 打開 Chrome，進入 `擴充功能` 頁面 (`chrome://extensions/`)。
4. 開啟右上角的「**開發者模式**」。
5. 點擊「**載入未封裝項目**」，並選擇剛剛解壓縮的文件夾。
6. 登入 NCKU Moodle 或其他成大系統時，擴充功能將會自動幫您填入驗證碼。

### 給開發者（從原始碼安裝）
如果你要修改程式碼或使用訓練工具 (`trainer.html`)：
1. 透過 `git clone` 或直接下載 Source ZIP 取得完整專案。
2. 進行修改後，可執行 `./package.sh` 自動打包出純淨的 `ncku-moodle-keeper.zip` 供正式發布使用。

### 注意事項
- **電腦需保持開啟**：若電腦進入睡眠或休眠狀態，擴充功能將停止運作。
- **需開啟 Moodle 頁面**：您必須在瀏覽器中保持至少一個 Moodle 分頁開啟，擴充功能才能在該頁面執行背景續期。

---

## English

A simple browser extension designed to prevent automatic logout on the NCKU Moodle platform. It has now been upgraded to support captcha auto-solving across multiple NCKU systems (including Moodle, Course Registration, and FuturePlus).

### Key Features
- **Auto-Renewal**: Automatically communicates with Moodle every 9 minutes to prevent session expiration.
- **Customized Lightweight Captcha Solver**:
  - **Campus-Wide Support**: Works not only on Moodle but also on other NCKU portals like the Course Registration system (`course.ncku.edu.tw`) and FuturePlus (`futureplus.ncku.edu.tw`).
  - **Extremely Fast**: Uses a template matching algorithm, small size, fast recognition.
  - **All Local Execution**: Runs entirely within the browser, no extra setup, no API keys required.

### How to Enable (For Users)
1. Go to the project's **Releases** page and download the latest `ncku-moodle-keeper.zip`.
2. Unzip the file.
3. Open Chrome and go to the `Extensions` page (`chrome://extensions/`).
4. Enable "**Developer mode**" in the top right corner.
5. Click "**Load unpacked**" and select the unzipped folder.
6. When you log in to NCKU Moodle or other supported systems, the captcha will be solved automatically.

### For Developers (From Source)
If you want to modify the code or use the training tools (like `trainer.html`):
1. `git clone` or download the full source code.
2. After making changes, you can run `./package.sh` to automatically generate a clean `ncku-moodle-keeper.zip` for release.

### Important Notes
- **Keep Computer Awake**: The extension will stop working if your computer goes to sleep or hibernate.
- **Keep Moodle Tab Open**: You must keep at least one Moodle tab open in your browser for the extension to perform its background keep-alive tasks.
