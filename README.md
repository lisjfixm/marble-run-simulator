# Marble Run Simulator（離線成品）

Babylon.js 3D 彈珠軌道建造遊戲，原作 **Tiaratum Games / Sven Taton**。本倉庫為 Poki 版本的離線保存包，僅供個人離線遊玩，版權歸原作者所有。

- 線上版本（GitHub Pages）：<https://lisjfixm.github.io/marble-run-simulator/>
- 原始 Poki 來源：<https://poki.com/zh/g/marble-run-simulator>
- 版本：**v1.1.0**（版本常量見 `index.js` 的 `GAME_VERSION`）

## 本機啟動

不能用 `file://` 直接開 `index.html`（相對路徑資源與模組會被瀏覽器擋住），需跑靜態伺服器：

```bat
:: Windows（py 啟動器）
start-server.bat
```

或手動執行：

```bash
py -m http.server 8775
# 瀏覽器開 http://127.0.0.1:8775/
```

## 目錄結構

| 路徑 | 內容 |
|---|---|
| `index.html` | 入口頁面與離線 Poki SDK stub |
| `index.js` | 載入順序、進度條、版本常量 |
| `marble-fall.js` | 遊戲主邏輯（Game、選單、編輯器、分享） |
| `lib/` | Babylon.js 引擎、core、mummu、nabu 套件 |
| `datas/` | 關卡 JSON、網格 `.babylon`、貼圖、音效、圖示、i18n |
| `styles/` | 樣式與 Roboto 字型 |
| `work/` | 標題拆圖等暫存資源 |

## 離線限制

- 社群展示、按讚、線上發布依賴 `marble.tiaratum.com` 後端；離線時自動進入 `OFFLINE_MODE`：首頁社群入口與分享選單的網路發布按鈕會隱藏，僅保留本機匯出 JSON 存檔。
- `datas/offline_db.json` 為空的離線展示資料庫（無玩家作品）。
- Poki SDK 已停用（`USE_POKI_SDK = false`），廣告與回勵廣告不會載入。

## 已知缺口

- BB Puzzle 模式相關資源未完整保存：`datas/bb-puzzles/` 關卡 JSON、`datas/demos/`、`datas/icons-bb/pets/` 寵物圖，以及 `play.png`、`stop.png`、`path.png`、`bouncer.png`、`eraser.svg` 等圖示。
- 首頁標題拆圖（`work/title_parts/`）與星星、頭像佔位圖為由既有資源裁切或以 PIL 重建，非原作原圖。

## Changelog

### v1.1.0（2026-11-16）

- 遊戲內可見介面全面改為繁體中文：i18n 語言檔、選單與按鈕、編輯器零件與材質名稱、關卡提示與教學訊息、分享與匯出選單、載入畫面訊息。
- 語言切換中的英文槽預設顯示中文；法文內容保留。EULA 法律條文僅譯標題與按鈕，本文維持原文。

### v1.0.0（2026-11-15）

- 初始離線包導入：Babylon.js 3D 本體、關卡、貼圖、音效完整保存。
- 加入離線 Poki SDK stub、後端探測逾時降級、空離線資料庫。
- 補建缺失的首頁標題拆圖、星星與頭像佔位圖。
- 新增 README 與 Windows 本機啟動批次檔。
