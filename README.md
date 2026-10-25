# NCKU Moodle Keeper 🎓

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

這是一個簡單的瀏覽器擴充功能，旨在解決成功大學 (NCKU) Moodle 平台自動登出的問題。現在同時支援 Moodle 的自動延長連線，還支援全校多個系統（如 Moodle、選課系統、futureplus 等）的驗證碼自動辨識功能。

### 快速上手

- **Chrome 使用者**：您可以直接至 [Chrome Web Store](https://chromewebstore.google.com/detail/ncku-moodle-keeper/npnhndaifpmkbolbkplmclenjejjfloo) 安裝正式版。若想搶先體驗最新版本，請參考下方的 [如何手動安裝](#如何手動安裝)。
- **Firefox 使用者**：請參考[給開發者](#給開發者從原始碼安裝)段落，使用 `build_xpi.sh` 自行打包 `.xpi` 檔使用。

### 核心功能
- **自動續期**：每 9 分鐘自動與 Moodle 通訊，防止連線過期。
- **自定義輕量級驗證碼辨識**：
  - **全校系統支援**：不僅支援 Moodle，也支援成功大學選課系統 (`course.ncku.edu.tw`)、FuturePlus (`futureplus.ncku.edu.tw`)、暑修報名 (`course-query.acad.ncku.edu.tw/sum`)、通識體驗課程選課 (`exptnsel.liberal.ncku.edu.tw`)、成績查詢 (`score.ncku.edu.tw`) 等 NCKU 入口網站。
  - **極速辨識**：使用樣板匹配演算法，體積小，辨識速度快。
  - **全本地執行**：完全在瀏覽器內完成，不需額外設定、不需 API key。
- **Moodle 便利貼**：
  - **隨手貼上**：在 Moodle 任一頁面按右鍵 →「在這裡新增便利貼」，便利貼會黏在點的位置（例如某份作業旁邊），版面變動也會跟著移動。
  - **支援 Markdown**：粗體、清單、連結、程式碼，以及可直接打勾的 `- [ ]` 勾選清單。
  - **跨裝置同步**：登入同一個瀏覽器帳號並開啟同步，便利貼會自動出現在你的其他電腦上。
  - **集中管理**：Moodle 首頁的「便利貼」按鈕可以瀏覽、搜尋、刪除所有便利貼，並一鍵跳到所在頁面。

### 如何手動安裝
1. 在 GitHub 的 [Releases](https://github.com/bigbluew/ncku-moodle-keeper/releases) 頁面下載最新版 `ncku-moodle-keeper.zip`。
2. 解壓縮該檔案。
3. 打開 Chrome，進入 `擴充功能` 頁面 (`chrome://extensions/`)。
4. 開啟右上角的「**開發者模式**」。
5. 點擊「**載入未封裝項目**」，並選擇剛剛解壓縮的文件夾。
6. 登入 NCKU Moodle 或其他成大系統時，擴充功能將會自動幫您填入驗證碼。

### 給開發者（從原始碼安裝）
如果你要修改程式碼或使用訓練工具 (如 `trainer.html`)：
1. 透過 `git clone` 或直接下載 Source ZIP 取得完整專案。
2. 進行修改後，可執行 `./package.sh` 自動打包出純淨的 `ncku-moodle-keeper.zip` 供正式發布使用。
3. 若要打包 Firefox 安裝檔，先安裝 `web-ext`（例如：`npm i -g web-ext`），再執行 `./build_xpi.sh` 產生 `.zip` 與 `.xpi`（輸出於 `web-ext-artifacts/`）。

### 注意事項
- **電腦需保持開啟**：若電腦進入睡眠或休眠狀態，擴充功能將停止運作。
- **需開啟 Moodle 頁面**：您必須在瀏覽器中保持至少一個 Moodle 分頁開啟，擴充功能才能在該頁面執行背景續期。

---

## English

A simple browser extension designed to prevent automatic logout on the NCKU Moodle platform. It has now been upgraded to support captcha auto-solving across multiple NCKU systems (including Moodle, Course Registration, and FuturePlus).

### Quick Start

- **Chrome Users**: Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/ncku-moodle-keeper/npnhndaifpmkbolbkplmclenjejjfloo). To test the latest unreleased updates, see [How to Install Manually](#how-to-install-manually) below.
- **Firefox Users**: Please refer to the [For Developers](#for-developers-from-source) section to build and side-load an `.xpi` file using `build_xpi.sh`.

### Key Features
- **Auto-Renewal**: Automatically communicates with Moodle every 9 minutes to prevent session expiration.
- **Customized Lightweight Captcha Solver**:
  - **Campus-Wide Support**: Works not only on Moodle but also on other NCKU portals like the Course Registration system (`course.ncku.edu.tw`), FuturePlus (`futureplus.ncku.edu.tw`), Summer Course Signup (`course-query.acad.ncku.edu.tw/sum`), Liberal Education course selection (`exptnsel.liberal.ncku.edu.tw`) and Score Inquiry (`score.ncku.edu.tw`).
  - **Extremely Fast**: Uses a template matching algorithm, small size, fast recognition.
  - **All Local Execution**: Runs entirely within the browser, no extra setup, no API keys required.
- **Moodle Sticky Notes**:
  - **Pin Anywhere**: Right-click anywhere on Moodle → "Add sticky note here". The note sticks to that spot (e.g. next to an assignment) and follows it when the layout changes.
  - **Markdown**: Bold, lists, links, code, and clickable `- [ ]` checklists.
  - **Synced Across Devices**: With browser sync enabled, your notes show up on your other computers automatically.
  - **Manage in One Place**: The "Sticky Notes" button on the Moodle front page lets you browse, search and delete all notes, and jump straight to each one.

### How to Install Manually
1. Go to the project's [Releases](https://github.com/bigbluew/ncku-moodle-keeper/releases) page and download the latest `ncku-moodle-keeper.zip`.
2. Unzip the file.
3. Open Chrome and go to the `Extensions` page (`chrome://extensions/`).
4. Enable "**Developer mode**" in the top right corner.
5. Click "**Load unpacked**" and select the unzipped folder.
6. When you log in to NCKU Moodle or other supported systems, the captcha will be solved automatically.

### For Developers (From Source)
If you want to modify the code or use the training tools (like `trainer.html`):
1. `git clone` or download the full source code.
2. After making changes, you can run `./package.sh` to automatically generate a clean `ncku-moodle-keeper.zip` for release.
3. To package a Firefox build, install `web-ext` first (for example: `npm i -g web-ext`), then run `./build_xpi.sh` to generate both `.zip` and `.xpi` artifacts in `web-ext-artifacts/`.

### Important Notes
- **Keep Computer Awake**: The extension will stop working if your computer goes to sleep or hibernate.
- **Keep Moodle Tab Open**: You must keep at least one Moodle tab open in your browser for the extension to perform its background keep-alive tasks.
