# Marble Run Simulator（離線成品）

Babylon.js 3D 彈珠軌道建造遊戲，原作 **Tiaratum Games / Sven Taton**。本倉庫為 Poki 版本的離線保存包，僅供個人離線遊玩，版權歸原作者所有。

- 線上版本（GitHub Pages）：<https://lisjfixm.github.io/marble-run-simulator/>
- 原始 Poki 來源：<https://poki.com/zh/g/marble-run-simulator>
- 版本：**v1.2.3**（版本常量見 `index.js` 的 `GAME_VERSION`）

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

## 自動解關解答包（建造關）

- 自動模式目前只會重播循環與 Parkour 加重；建造關（教學／解謎）的解答佈局存放在 `marble-fall.js` 的 `ChallengeSolutions`，預設為空。
- 回填流程（需在有 WebGL 的實機環境）：
  1. 打開該關卡，手動把軌道接好並確認能通關。
  2. 瀏覽器 console 執行 `Game.Instance.exportChallengeSolution()`，複製輸出的 JSON（鍵為 `Tutorial:<索引>` 或 `Puzzle:<1..5>`）。
  3. 把零件陣列貼回 `ChallengeSolutions` 對應鍵；之後開啟自動模式會自動擺這套解答再播放。
- 零件規格：`{ name, i, j, k, r, colors? }`；`name` 保留尺寸後綴，`[R]n` 後綴會拆到 `r`；格點必須與軌道端點對齊。
- 官方教學條件可考證的 4 關參考格點寫在 `ChallengeSolutions` 上方註解，尚未實機驗證，回填前請逐一確認尺寸與銜接；5 個 Puzzle 關與其餘教學關需實機錄製。

## 已知缺口

- BB Puzzle 模式相關資源未完整保存：`datas/bb-puzzles/` 關卡 JSON、`datas/demos/`、`datas/icons-bb/pets/` 寵物圖，以及 `play.png`、`stop.png`、`path.png`、`bouncer.png`、`eraser.svg` 等圖示；這些屬未保存的原始素材，離線無法重建。
- 首頁標題拆圖（`work/title_parts/`）為既有資源裁切／重建；星星與預設頭像佔位圖為程式繪製的平滑重繪版，非原作原圖。

## Changelog

### v1.2.3（2026-11-17）

- 自動模式卡住超時兜底改走解答感知的重播流程；解答載入失敗時回退重新開關卡。
- 解答包補上實機匯出→回填說明，並在註解留下 4 個教學關尚未驗證的參考草稿。
- 星星與預設頭像佔位圖重繪為平滑版本；其餘 BB Puzzle 原始素材缺口維持標註，離線無法重建。
- 盤點插屏／回勵廣告路徑：全數由 `USE_POKI_SDK` 旗標守衛隔離，預設不載入遠端 SDK。

### v1.2.2（2026-11-17）

- 建造關自動解答包基礎設施：預留解答佈局登錄與載入鉤子；目前解答包為空，自動模式既有行為不變。
- 新增 console 輔助 `Game.Instance.exportChallengeSolution()`，把當前關卡已放置零件匯出為解答包 JSON，供實機解關後回填。

### v1.2.1（2026-11-17）

- 自動模式下挑戰關若播放中卡住超過 90 秒（未通關也未失敗），自動重置重播，避免畫面停滯。

### v1.2.0（2026-11-16）

- 新增「自動遊玩」模式：工具列循環按鈕或設定選單開關切換，狀態本機保存。
- 挑戰與展示模式下，彈珠跑完或失敗後自動重置並重新播放，循環觀賞；展示模式卡住超時會自動重置。
- Parkour 反應關在自動模式下依彈珠垂直速度自動切換加重，代玩家按壓。

### v1.1.2（2026-11-16）

- 移除廣告牆：編輯器原本需觀看廣告解鎖的零件改為直接開放，移除「解鎖」標籤與回勵廣告解鎖流程。
- 關卡提示不再詢問觀看廣告，按確認直接顯示提示；對話文案移除廣告字眼。
- 遠端 Poki SDK 維持停用，不載入任何廣告腳本。

### v1.1.1（2026-11-16）

- 移除首頁「本週／本月／年度最佳機械」三張其他玩家精選作品卡片，並清除對應的載入、輪播與樣式邏輯。

### v1.1.0（2026-11-16）

- 遊戲內可見介面全面改為繁體中文：i18n 語言檔、選單與按鈕、編輯器零件與材質名稱、關卡提示與教學訊息、分享與匯出選單、載入畫面訊息。
- 語言切換中的英文槽預設顯示中文；法文內容保留。EULA 法律條文僅譯標題與按鈕，本文維持原文。

### v1.0.0（2026-11-15）

- 初始離線包導入：Babylon.js 3D 本體、關卡、貼圖、音效完整保存。
- 加入離線 Poki SDK stub、後端探測逾時降級、空離線資料庫。
- 補建缺失的首頁標題拆圖、星星與頭像佔位圖。
- 新增 README 與 Windows 本機啟動批次檔。
