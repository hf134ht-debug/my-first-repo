/* =========================================================
   summary.js
   集計タブ（日別ロス＋週ロス）
   - カレンダー（売上データ有りの日をマーキング）
   - 日別：出荷(2日前) vs 売上（カード＋店舗別アコーディオン）
   - 週別：1週間分を品目別カード＋日別内訳アコーディオン
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SUMMARY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== ビュー状態 ===== */
let summaryCalYear;
let summaryCalMonth;
let summarySelectedDate = null;   // Date オブジェクト
let currentSummaryView  = "day";  // "day" / "week"

/* 月ごとの「データあり日」キャッシュ { "2025-11": ["01","03",...] } */
const summaryMonthDaysCache = {};

/* ===== 集計画面 HTML ===== */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>

    <div id="summaryTabArea">
      ${renderSummaryTabs()}
    </div>

    <div id="summaryCalendarArea"></div>
    <div id="summaryResult"><p>日付を選択してください</p></div>
  `;
}

/* ===== 日／週タブ ===== */
function renderSummaryTabs() {
  return `
    <div class="summary-tabs">
      <button class="summary-tab ${currentSummaryView==='day' ? 'active' : ''}"
        onclick="changeSummaryView('day')">日</button>
      <button class="summary-tab ${currentSummaryView==='week' ? 'active' : ''}"
        onclick="changeSummaryView('week')">週</button>
      <button class="summary-tab" disabled>月</button>
      <button class="summary-tab" disabled>年</button>
    </div>
  `;
}

/* ===== タブ切り替え ===== */
function changeSummaryView(view) {
  currentSummaryView = view;
  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) tabArea.innerHTML = renderSummaryTabs();

  // 日付が選ばれていれば、その単位で再表示
  if (summarySelectedDate) {
    const dateStr = formatYmd(summarySelectedDate);
    loadCurrentSummary(dateStr);
  } else {
    document.getElementById("summaryResult").innerHTML =
      `<p>日付を選択してください</p>`;
  }
}

/* ===== 月ごとのデータあり日を取得（GAS） ===== */
async function getSummaryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (summaryMonthDaysCache[ym]) return summaryMonthDaysCache[ym];

  const res  = await fetch(`${SUMMARY_SCRIPT_URL}?checkSummaryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  summaryMonthDaysCache[ym] = days;
  return days;
}

/* ===== 集計タブを開いたときに呼ぶ ===== */
async function activateSummaryFeatures() {
  const now = new Date();
  summaryCalYear  = now.getFullYear();
  summaryCalMonth = now.getMonth();
  summarySelectedDate = null;
  currentSummaryView = "day";

  document.getElementById("summaryTabArea").innerHTML = renderSummaryTabs();

  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, null, daysWithData);

  document.getElementById("summaryResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* ===== カレンダー描画（集計用：日＆週共通） ===== */
function drawSummaryCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const daysOfWeek = ["日","月","火","水","木","金","土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSummaryMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月</b></div>
        <button class="cal-btn" onclick="changeSummaryMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${daysOfWeek.map(d => `<div class="calendar-day">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
  `;

  // 最初の空白（1日が何曜日か）
  for (let i = 0; i < first.getDay(); i++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,"0");

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

/* ===== 月移動 ===== */
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

  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);

  // 選択日は一旦クリア（別月へ移動したため）
  summarySelectedDate = null;

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, null, daysWithData);

  document.getElementById("summaryResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* ===== 日付クリック ===== */
async function selectSummaryDate(y, m, d) {
  summarySelectedDate = new Date(y, m, d);
  const dateStr = formatYmd(summarySelectedDate);

  const daysWithData = await getSummaryDaysWithData(y, m);
  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(y, m, summarySelectedDate, daysWithData);

  loadCurrentSummary(dateStr);
}

/* ===== 現在ビュー（日 or 週）に合わせて読み込み ===== */
function loadCurrentSummary(dateStr) {
  if (currentSummaryView === "day") {
    loadDailySummary(dateStr);
  } else if (currentSummaryView === "week") {
    loadWeeklySummary(dateStr);
  } else {
    document.getElementById("summaryResult").innerHTML =
      `<p>このビューはまだ開発中です。</p>`;
  }
}

/* ユーティリティ：Date → YYYY-MM-DD */
function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/* =========================================================
   ▼ 日別ロスデータ取得 & 表示（カード＋店舗別）
========================================================= */
async function loadDailySummary(dateStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の出荷または売上データがありません。</p>`;
      return;
    }

    const shipDate = data.shipDate;   // 2日前の出荷日
    const total    = data.total || {};
    const items    = data.items || [];

    let html = `
      <h3>${dateStr} の集計</h3>
      <p style="font-size:0.9em;color:#555;">
        ※ 出荷日は <b>${shipDate}</b>（2日前の出荷と比較）
      </p>
    `;

    // ===== 全体サマリーカード =====
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 全体ロス</span>
          <span class="item-total-badge summary-badge">
            ${total.lossRate === null
              ? 'ロス率：ー'
              : `ロス率：${total.lossRate}%（${total.lossQty}個）`}
          </span>
        </div>
        <div>出荷：<b>${total.shippedQty || 0}個</b></div>
        <div>売上：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // ===== 品目別カード =====
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = it.lossRate;

      // 色分け（履歴と同じルール）
      let cls = "corn";   // デフォルト：トウモロコシ色
      let badgeCls = "item-total-corn";

      if (itemName.indexOf("白菜") !== -1) {
        cls = "hakusai";
        badgeCls = "item-total-hakusai";
      } else if (itemName.indexOf("キャベツ") !== -1) {
        cls = "cabbage";
        badgeCls = "item-total-cabbage";
      }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}">
              ロス率：
              ${
                lossRate === null
                  ? "ー"
                  : `${lossRate}%（${lossQty}個）`
              }
            </span>
          </div>
          <div>出荷：${shippedQty}個 / 売上：${soldQty}個</div>
          ${
            it.stores && it.stores.length
              ? renderStoreAccordion(it.stores)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">
                   店舗別内訳なし
                 </div>`
          }
        </div>
      `;
    });

    resultDiv.innerHTML = html;

    // アコーディオン用イベントを付与
    attachStoreAccordionEvents();

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* =========================================================
   ▼ 週ロスデータ取得 & 表示（カード＋日別内訳）
   GAS 側：?summaryWeek=YYYY-MM-DD → getWeeklySummary()
========================================================= */
async function loadWeeklySummary(dateStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryWeek=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} を含む週のデータがありません。</p>`;
      return;
    }

    const weekStart = data.weekStart;   // 週の月曜日
    const total     = data.total || {};
    const items     = data.items || [];

    let html = `
      <h3>${weekStart} 週の集計</h3>
      <p style="font-size:0.9em;color:#555;">
        ※ 月曜日（${weekStart}）から日曜日までの 1 週間を集計
      </p>
    `;

    // ===== 週 全体サマリーカード =====
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 週全体ロス</span>
          <span class="item-total-badge summary-badge">
            ${total.lossRate === null
              ? 'ロス率：ー'
              : `ロス率：${total.lossRate}%（${total.lossQty}個）`}
          </span>
        </div>
        <div>出荷合計：<b>${total.shippedQty || 0}個</b></div>
        <div>売上合計：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // ===== 品目別カード（週合計＋日別内訳アコーディオン） =====
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = shippedQty > 0
        ? Math.round((lossQty / shippedQty) * 100)
        : null;

      let cls = "corn";
      let badgeCls = "item-total-corn";
      if (itemName.indexOf("白菜") !== -1) {
        cls = "hakusai";
        badgeCls = "item-total-hakusai";
      } else if (itemName.indexOf("キャベツ") !== -1) {
        cls = "cabbage";
        badgeCls = "item-total-cabbage";
      }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}">
              ロス率：
              ${
                lossRate === null
                  ? "ー"
                  : `${lossRate}%（${lossQty}個）`
              }
            </span>
          </div>
          <div>週合計：出荷 ${shippedQty}個 / 売上 ${soldQty}個</div>
          ${
            it.daily && it.daily.length
              ? renderWeekDailyAccordion(it.daily)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">
                   日別内訳なし
                 </div>`
          }
        </div>
      `;
    });

    resultDiv.innerHTML = html;

    attachStoreAccordionEvents();

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* ===== 店舗別アコーディオン（日ビュー用） ===== */
function renderStoreAccordion(stores) {
  // stores: [{ name, shippedQty, soldQty, lossQty, lossRate }, ...]
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
              ロス：
                ${s.lossRate === null
                  ? `${s.lossQty}個`
                  : `${s.lossQty}個（${s.lossRate}%）`}
            </div>
          `).join("")
        }
      </div>
    </div>
  `;
}

/* ===== 週ビュー用 日別内訳アコーディオン ===== */
function renderWeekDailyAccordion(dailyList) {
  // dailyList: [{ date, shippedQty, soldQty, lossQty, lossRate }, ...]
  return `
    <div class="store-accordion">
      <button class="store-accordion-toggle">
        日別内訳を表示
      </button>
      <div class="store-accordion-body">
        ${
          dailyList.map(d => `
            <div class="store-accordion-row">
              <b>${d.date}</b><br>
              出荷：${d.shippedQty}個 /
              売上：${d.soldQty}個 /
              ロス：
                ${d.lossRate === null
                  ? `${d.lossQty}個`
                  : `${d.lossQty}個（${d.lossRate}%）`}
            </div>
          `).join("")
        }
      </div>
    </div>
  `;
}

/* ===== アコーディオン動作（売上側と共通実装） ===== */
function attachStoreAccordionEvents() {
  const toggles = document.querySelectorAll(".store-accordion-toggle");

  toggles.forEach(btn => {
    btn.onclick = () => {
      const body = btn.nextElementSibling;
      if (!body) return;

      const isOpen = body.classList.contains("open");
      if (isOpen) {
        // 閉じる（バネ感を少しだけ）
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
