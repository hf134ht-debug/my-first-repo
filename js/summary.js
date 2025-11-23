/* =========================================================
   summary.js
   集計タブ（日 / 週）
   - カレンダー（売上データ有りの日をマーキング）
   - 日別ロスカード
   - 週別ロスカード
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SUMMARY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== 状態管理 ===== */
let summaryCalYear;
let summaryCalMonth;
let currentSummaryView = "day";   // "day" | "week" | "month" | "year"
let selectedSummaryDate = null;   // Date or null

// 月ごとの「データあり日」キャッシュ { "2025-11": ["01","03",...] }
const summaryMonthDaysCache = {};

/* =========================================================
   画面描画
========================================================= */

/** 集計タブを開いたときに app.js から呼ばれる */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>

    <div id="summaryTabArea">
      ${renderSummaryTabs()}
    </div>

    <div id="summaryWeekLabel" class="summary-week-label"></div>

    <div id="summaryCalendarArea"></div>

    <div id="summaryResult">
      <p>日付を選択してください</p>
    </div>
  `;
}

/** タブボタン */
function renderSummaryTabs() {
  return `
    <div class="summary-tabs">
      <button
        class="summary-tab ${currentSummaryView === "day" ? "active" : ""}"
        onclick="changeSummaryView('day')"
      >日</button>

      <button
        class="summary-tab ${currentSummaryView === "week" ? "active" : ""}"
        onclick="changeSummaryView('week')"
      >週</button>

      <button
        class="summary-tab ${currentSummaryView === "month" ? "active" : ""}"
        onclick="changeSummaryView('month')"
      >月</button>

      <button
        class="summary-tab ${currentSummaryView === "year" ? "active" : ""}"
        onclick="changeSummaryView('year')"
      >年</button>
    </div>
  `;
}

/** タブ切り替え */
function changeSummaryView(view) {
  currentSummaryView = view;

  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) {
    tabArea.innerHTML = renderSummaryTabs();
  }

  const resultDiv = document.getElementById("summaryResult");
  const labelDiv  = document.getElementById("summaryWeekLabel");

  if (!resultDiv || !labelDiv) return;

  if (view === "day") {
    resultDiv.innerHTML = `<p>日付を選択してください</p>`;
    labelDiv.innerHTML  = "";
  } else if (view === "week") {
    resultDiv.innerHTML = `<p>週の中の任意の日付を選択してください</p>`;
    labelDiv.innerHTML  =
      `<p class="summary-week-hint">※ カレンダーで週の中のどれか1日をタップすると、その週（月〜日）の集計を表示します。</p>`;
  } else {
    // 月・年ビューは今は未実装（壊さないためのメッセージ）
    resultDiv.innerHTML = `<p>このビューは現在準備中です。</p>`;
    labelDiv.innerHTML  = "";
  }

  // カレンダーは共通なのでそのまま再描画
  renderSummaryCalendar();
}

/** 集計タブが開かれたときに app.js から呼ばれる初期化 */
async function activateSummaryFeatures() {
  const now = new Date();
  summaryCalYear  = now.getFullYear();
  summaryCalMonth = now.getMonth();
  selectedSummaryDate = null;

  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) {
    tabArea.innerHTML = renderSummaryTabs();
  }

  await renderSummaryCalendar();
}

/* =========================================================
   カレンダー（共通・月曜始まり）
========================================================= */

/** 月ごとの「データあり日」を GAS から取得 */
async function getSummaryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (summaryMonthDaysCache[ym]) return summaryMonthDaysCache[ym];

  const res  = await fetch(`${SUMMARY_SCRIPT_URL}?checkSummaryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  summaryMonthDaysCache[ym] = days;
  return days;
}

/** カレンダー全体を再描画 */
async function renderSummaryCalendar(selectedDate = selectedSummaryDate) {
  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, selectedDate, daysWithData);
}

/** 月移動 */
async function changeSummaryMonth(offset) {
  summaryCalMonth += offset;
  if (summaryCalMonth < 0) {
    summaryCalMonth = 11;
    summaryCalYear--;
  }
  if (summaryCalMonth > 11) {
    summaryCalMonth = 0;
    summaryCalYear++;
  }

  selectedSummaryDate = null;
  await renderSummaryCalendar();

  const resultDiv = document.getElementById("summaryResult");
  if (!resultDiv) return;

  if (currentSummaryView === "week") {
    resultDiv.innerHTML = `<p>週の中の任意の日付を選択してください</p>`;
  } else {
    resultDiv.innerHTML = `<p>日付を選択してください</p>`;
  }
}

/** 月曜始まりカレンダー HTML を作成 */
function drawSummaryCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const daysOfWeek = ["月","火","水","木","金","土","日"];

  // JS は日(0)〜土(6)なので、月曜(1)を先頭に調整
  let startIndex = (first.getDay() + 6) % 7; // 月曜=0 になるようずらす

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSummaryMonth(-1)">＜</button>
        <div><b>${year}年 ${month + 1}月</b></div>
        <button class="cal-btn" onclick="changeSummaryMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${daysOfWeek.map(d => `<div class="calendar-day">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
  `;

  // 最初の空きマス
  for (let i = 0; i < startIndex; i++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2, "0");

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;

    const isSelected =
      selectedDate &&
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === d;

    const hasData = daysWithData.includes(dd);

    html += `
      <div
        class="calendar-date
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasData ? "has-data" : ""}"
        onclick="selectSummaryDate(${year},${month},${d})"
      >
        ${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/** 日付クリック */
async function selectSummaryDate(y, m, d) {
  const dateObj = new Date(y, m, d);
  selectedSummaryDate = dateObj;
  summaryCalYear  = y;
  summaryCalMonth = m;

  const daysWithData = await getSummaryDaysWithData(y, m);
  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(y, m, dateObj, daysWithData);

  await loadSummaryForCurrentView();
}

/** 現在ビューに応じて日 or 週の集計をロード */
async function loadSummaryForCurrentView() {
  const resultDiv = document.getElementById("summaryResult");
  if (!resultDiv) return;

  if (!selectedSummaryDate) {
    if (currentSummaryView === "week") {
      resultDiv.innerHTML = `<p>週の中の任意の日付を選択してください</p>`;
    } else {
      resultDiv.innerHTML = `<p>日付を選択してください</p>`;
    }
    return;
  }

  const dateStr = formatDate(selectedSummaryDate);

  if (currentSummaryView === "week") {
    await loadWeeklySummary(dateStr);
  } else if (currentSummaryView === "day") {
    await loadDailySummary(dateStr);
  } else {
    resultDiv.innerHTML = `<p>このビューは現在準備中です。</p>`;
  }
}

/* =========================================================
   ▼ 日別ロス：API 呼び出し & 表示
========================================================= */

async function loadDailySummary(dateStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中...</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${dateStr}`);
    const data = await res.json();
    showDailySummary(data);
  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

function showDailySummary(data) {
  const resultDiv = document.getElementById("summaryResult");

  if (!data || !data.found) {
    resultDiv.innerHTML = `<p>データがありません。</p>`;
    const labelDiv = document.getElementById("summaryWeekLabel");
    if (labelDiv && currentSummaryView === "week") labelDiv.innerHTML = "";
    return;
  }

  const items = data.items || [];
  const total = data.total || {};

  let html = `
    <h3>${data.summaryDate} の集計（出荷：${data.shipDate}）</h3>

    <div class="history-card summary-total">
      <div class="history-title">
        <span>📦 出荷 vs 売上</span>
      </div>
      <div>出荷：<b>${total.shippedQty}</b> 個</div>
      <div>売上：<b>${total.soldQty}</b> 個</div>
      <div>ロス：<b>${total.lossQty}</b> 個（${total.lossRate ?? "-"}%）</div>
    </div>
  `;

  items.forEach(x => {
    const itemName = x.item;
    const shipped  = x.shippedQty || 0;
    const sold     = x.soldQty || 0;
    const loss     = x.lossQty || 0;
    const rate     = x.lossRate;

    // 色分け（履歴と同じ）
    let cls = "corn";
    if (itemName.indexOf("白菜") !== -1) {
      cls = "hakusai";
    } else if (itemName.indexOf("キャベツ") !== -1) {
      cls = "cabbage";
    }

    html += `
      <div class="history-card ${cls}">
        <div class="history-title">
          <span>${itemName}</span>
        </div>
        <div class="summary-row"><span>出荷</span><span>${shipped} 個</span></div>
        <div class="summary-row"><span>売上</span><span>${sold} 個</span></div>
        <div class="summary-row">
          <span>ロス</span><span>${loss} 個（${rate ?? "-"}%）</span>
        </div>
        ${renderStoreAccordion(x.stores || [])}
      </div>
    `;
  });

  resultDiv.innerHTML = html;
  attachStoreAccordionEvents();
}

/* =========================================================
   ▼ 週別ロス：API 呼び出し & 表示
========================================================= */

async function loadWeeklySummary(dateStr) {
  const resultDiv = document.getElementById("summaryResult");
  const labelDiv  = document.getElementById("summaryWeekLabel");

  resultDiv.innerHTML = `<p>週集計を取得中...</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryWeek=${dateStr}`);
    const data = await res.json();

    if (!data || !data.found) {
      resultDiv.innerHTML = `<p>この週のデータがありません。</p>`;
      if (labelDiv) labelDiv.innerHTML = "";
      return;
    }

    // 週のラベル（例：2025-11-17 〜 2025-11-23 の週）
    if (labelDiv) {
      const days = data.days || [];
      if (days.length >= 2) {
        labelDiv.innerHTML =
          `<p class="summary-week-range">${days[0]} 〜 ${days[days.length - 1]} の週</p>`;
      } else {
        labelDiv.innerHTML = `<p class="summary-week-range">${data.weekStart} の週</p>`;
      }
    }

    const items = data.items || [];
    const total = data.total || {};

    let html = `
      <h3>${data.weekStart} 週の集計</h3>

      <div class="history-card summary-total">
        <div class="history-title">
          <span>📦 週合計 出荷 vs 売上</span>
        </div>
        <div>出荷：<b>${total.shippedQty}</b> 個</div>
        <div>売上：<b>${total.soldQty}</b> 個</div>
        <div>ロス：<b>${total.lossQty}</b> 個（${total.lossRate ?? "-"}%）</div>
      </div>
    `;

    items.forEach(x => {
      const itemName = x.item;
      const shipped  = x.shippedQty || 0;
      const sold     = x.soldQty || 0;
      const loss     = x.lossQty || 0;
      const rate     = x.lossRate;

      let cls = "corn";
      if (itemName.indexOf("白菜") !== -1) {
        cls = "hakusai";
      } else if (itemName.indexOf("キャベツ") !== -1) {
        cls = "cabbage";
      }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
          </div>
          <div class="summary-row"><span>出荷</span><span>${shipped} 個</span></div>
          <div class="summary-row"><span>売上</span><span>${sold} 個</span></div>
          <div class="summary-row">
            <span>ロス</span><span>${loss} 個（${rate ?? "-"}%）</span>
          </div>
        </div>
      `;
    });

    resultDiv.innerHTML = html;
  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
    if (labelDiv) labelDiv.innerHTML = "";
  }
}

/* =========================================================
   店舗別アコーディオン（日別用）
========================================================= */

function renderStoreAccordion(stores) {
  // stores: [{ name, shippedQty, soldQty, lossQty, lossRate }, ...]
  if (!stores || !stores.length) {
    return `<div style="font-size:0.85em;color:#555;margin-top:4px;">店舗別内訳なし</div>`;
  }

  return `
    <div class="store-accordion">
      <button class="store-accordion-toggle">
        店舗別内訳を表示
      </button>
      <div class="store-accordion-body">
        ${
          stores.map(s => `
            <div class="store-accordion-row">
              <b>${s.name}</b><br>
              出荷：${s.shippedQty}個 /
              売上：${s.soldQty}個 /
              ロス：${s.lossQty}個（${s.lossRate ?? "-"}%）
            </div>
          `).join("")
        }
      </div>
    </div>
  `;
}

function attachStoreAccordionEvents() {
  const toggles = document.querySelectorAll(".store-accordion-toggle");

  toggles.forEach(btn => {
    btn.onclick = () => {
      const body = btn.nextElementSibling;
      if (!body) return;

      const isOpen = body.classList.contains("open");
      if (isOpen) {
        // 閉じる
        body.style.maxHeight = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
          body.classList.remove("open");
        });
      } else {
        // 開く
        body.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    };
  });
}

/* =========================================================
   Util
========================================================= */

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
