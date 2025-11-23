/* =========================================================
   summary.js
   集計タブ（日／週）
   - 日ビュー：カレンダー（売上データ有りの日をマーキング）
               出荷(2日前) vs 売上(当日) のロス（品目別＋店舗別）
   - 週ビュー：週リスト（データあり週を強調）
               品目別 週ロス集計
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SUMMARY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== グローバル状態 ===== */
let summaryCalYear;
let summaryCalMonth;

/* 月ごとの「データあり日」キャッシュ { "2025-11": ["01","03",...] } */
const summaryMonthDaysCache = {};

/* ビュー状態（日 or 週） */
let currentSummaryView = "day";         // "day" | "week" | "month" | "year"
let selectedSummaryDate = null;        // "YYYY-MM-DD"（日ビュー用）
let selectedWeekStart = null;          // "YYYY-MM-DD"（週ビュー用：その週の月曜日）

/* ===== Util ===== */
function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* =========================================================
   集計画面 HTML
========================================================= */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>

    <div id="summaryTabArea">
      ${renderSummaryTabs()}
    </div>

    <div id="summaryCalendarArea"></div>
    <div id="summaryResult"><p>日または週を選択してください</p></div>
  `;
}

/* ===== タブ（「日・週・月・年」） ===== */
function renderSummaryTabs() {
  return `
    <div class="summary-tabs">
      <button onclick="changeSummaryView('day')"
        class="summary-tab ${currentSummaryView === 'day' ? 'active' : ''}">
        日
      </button>
      <button onclick="changeSummaryView('week')"
        class="summary-tab ${currentSummaryView === 'week' ? 'active' : ''}">
        週
      </button>
      <button onclick="changeSummaryView('month')"
        class="summary-tab ${currentSummaryView === 'month' ? 'active' : ''}">
        月
      </button>
      <button onclick="changeSummaryView('year')"
        class="summary-tab ${currentSummaryView === 'year' ? 'active' : ''}">
        年
      </button>
    </div>
  `;
}

/* タブ切り替え */
function changeSummaryView(view) {
  currentSummaryView = view;

  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) {
    tabArea.innerHTML = renderSummaryTabs();
  }

  const resultDiv = document.getElementById("summaryResult");
  if (!resultDiv) return;

  if (view === "day") {
    resultDiv.innerHTML = `<p>日付を選択してください</p>`;
  } else if (view === "week") {
    resultDiv.innerHTML = `<p>週を選択してください</p>`;
  } else if (view === "month") {
    resultDiv.innerHTML = `<p>月集計ビュー（開発中）</p>`;
  } else if (view === "year") {
    resultDiv.innerHTML = `<p>年集計ビュー（開発中）</p>`;
  }

  // カレンダー／週リストを再描画
  renderSummaryMain();
}

/* 集計タブを開いたときに呼ぶ */
function activateSummaryFeatures() {
  const now = new Date();
  summaryCalYear  = now.getFullYear();
  summaryCalMonth = now.getMonth();
  selectedSummaryDate = formatYMD(now);
  selectedWeekStart = null;

  renderSummaryMain();
}

/* ビュー種別に応じて、日カレンダー or 週リストを描画 */
async function renderSummaryMain() {
  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);
  const area = document.getElementById("summaryCalendarArea");
  if (!area) return;

  if (currentSummaryView === "day") {
    area.innerHTML = drawSummaryCalendar(
      summaryCalYear,
      summaryCalMonth,
      selectedSummaryDate,
      daysWithData
    );
  } else if (currentSummaryView === "week") {
    area.innerHTML = drawSummaryWeekList(
      summaryCalYear,
      summaryCalMonth,
      daysWithData
    );
  } else {
    // 月・年ビューはとりあえず簡易表示
    area.innerHTML = `
      <div class="calendar-wrapper">
        <div class="calendar-header">
          <button class="cal-btn" onclick="changeSummaryMonth(-1)">＜</button>
          <div><b>${summaryCalYear}年 ${summaryCalMonth + 1}月</b></div>
          <button class="cal-btn" onclick="changeSummaryMonth(1)">＞</button>
        </div>
        <p style="padding:8px;">このビューは現在開発中です。</p>
      </div>
    `;
  }
}

/* =========================================================
   月ごとの「データあり日」を取得（GAS）
========================================================= */
async function getSummaryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (summaryMonthDaysCache[ym]) return summaryMonthDaysCache[ym];

  const res  = await fetch(`${SUMMARY_SCRIPT_URL}?checkSummaryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  summaryMonthDaysCache[ym] = days;
  return days;
}

/* =========================================================
   ▼ 日ビュー：カレンダー描画
========================================================= */
function drawSummaryCalendar(year, month, selectedDateStr = null, daysWithData = []) {
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
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${dd}`;

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;

    const isSelected = selectedDateStr === dateStr;
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

/* 月移動（日ビュー／週ビュー共通） */
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

  if (currentSummaryView === "day") {
    selectedSummaryDate = null;
    const resultDiv = document.getElementById("summaryResult");
    if (resultDiv) resultDiv.innerHTML = `<p>日付を選択してください</p>`;
  } else if (currentSummaryView === "week") {
    selectedWeekStart = null;
    const resultDiv = document.getElementById("summaryResult");
    if (resultDiv) resultDiv.innerHTML = `<p>週を選択してください</p>`;
  }

  renderSummaryMain();
}

/* 日付クリック */
async function selectSummaryDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  selectedSummaryDate = dateStr;

  const daysWithData = await getSummaryDaysWithData(y, m);
  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(y, m, dateStr, daysWithData);

  loadDailySummary(dateStr);
}

/* =========================================================
   ▼ 週ビュー：週リスト描画
   - 月曜始まり
   - データあり週を青帯＋「☆データあり」
========================================================= */
function drawSummaryWeekList(year, month, daysWithData = []) {
  // この月の1日と末日
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth  = new Date(year, month + 1, 0);

  // この月の表示開始となる「最初の月曜日」
  const firstDow = firstOfMonth.getDay(); // 0:日〜6:土
  const offsetToMonday = (firstDow + 6) % 7; // 月曜=0 になるよう調整
  const firstMonday = new Date(year, month, 1 - offsetToMonday);

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSummaryMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月 の週</b></div>
        <button class="cal-btn" onclick="changeSummaryMonth(1)">＞</button>
      </div>

      <div class="week-list">
  `;

  let weekIdx = 0;
  let cursor = new Date(firstMonday);

  while (true) {
    const weekStart = new Date(cursor);
    const weekEnd   = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // この週に「この月に属する日」が1日もなければ終了
    let hasAnyInMonth = false;
    for (let i = 0; i < 7; i++) {
      const tmp = new Date(weekStart);
      tmp.setDate(weekStart.getDate() + i);
      if (tmp.getMonth() === month && tmp >= firstOfMonth && tmp <= lastOfMonth) {
        hasAnyInMonth = true;
        break;
      }
    }
    if (!hasAnyInMonth && weekStart > lastOfMonth) {
      break;
    }
    if (!hasAnyInMonth) {
      // この月にかからない週はスキップ
      cursor.setDate(cursor.getDate() + 7);
      continue;
    }

    weekIdx++;
    const weekStartStr = formatYMD(weekStart);
    const rangeLabel = `${weekStart.getMonth()+1}/${weekStart.getDate()}〜${weekEnd.getMonth()+1}/${weekEnd.getDate()}`;

    // この週のうち「この月に属する日」で、データあり日が1つでもあれば hasData=true
    let hasData = false;
    for (let i = 0; i < 7; i++) {
      const tmp = new Date(weekStart);
      tmp.setDate(weekStart.getDate() + i);
      if (tmp.getMonth() !== month) continue;
      const dd = String(tmp.getDate()).padStart(2, "0");
      if (daysWithData.includes(dd)) {
        hasData = true;
        break;
      }
    }

    const isSelected = (selectedWeekStart === weekStartStr && currentSummaryView === "week");

    const rowClasses = [
      "week-row",
      hasData ? "has-data" : "no-data",
      isSelected ? "selected" : ""
    ].join(" ");

    html += `
      <div class="${rowClasses}"
        onclick="selectSummaryWeek('${weekStartStr}')">
        <div class="week-main">
          <span class="week-badge">第${weekIdx}週</span>
          <span class="week-range">${rangeLabel}</span>
        </div>
        <div class="week-meta">
          ${hasData ? "☆ データあり" : "データなし"}
        </div>
      </div>
    `;

    cursor.setDate(cursor.getDate() + 7);
  }

  html += `
      </div>
    </div>
  `;

  return html;
}

/* 週クリック */
async function selectSummaryWeek(weekStartStr) {
  selectedWeekStart = weekStartStr;

  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);
  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryWeekList(summaryCalYear, summaryCalMonth, daysWithData);

  loadWeeklySummary(weekStartStr);
}

/* =========================================================
   ▼ 日別ロスデータ取得 & 表示（既存の「色付きカード＋店舗別」）
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

/* ===== 店舗別アコーディオン HTML（日ビュー用） ===== */
function renderStoreAccordion(stores) {
  // stores: [{ name, shippedQty, soldQty, lossQty, lossRate }, ...] 日次では lossRate 等
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

/* ===== 店舗別アコーディオン動作 ===== */
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

/* =========================================================
   ▼ 週集計 API 呼び出し & 表示
   （GAS 側：?summaryWeek=YYYY-MM-DD に対応している前提）
========================================================= */
async function loadWeeklySummary(weekStartStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryWeek=${weekStartStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>該当週の出荷または売上データがありません。</p>`;
      return;
    }

    const total = data.total || {};
    const items = data.items || [];
    const days  = data.days  || [];

    const rangeText =
      days.length >= 1
        ? `${days[0]} ～ ${days[days.length - 1]}`
        : "";

    let html = `
      <h3>${data.weekStart} 週の集計</h3>
      <p style="font-size:0.9em;color:#555;">
        対象期間：<b>${rangeText}</b>
      </p>
    `;

    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 週合計ロス</span>
          <span class="item-total-badge summary-badge">
            ${
              total.lossRate == null
                ? "ロス率：ー"
                : `ロス率：${total.lossRate}%（${total.lossQty}個）`
            }
          </span>
        </div>
        <div>出荷合計：<b>${total.shippedQty || 0}個</b></div>
        <div>売上合計：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate =
        shippedQty > 0 ? Math.round((lossQty / shippedQty) * 100) : null;

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
                lossRate == null
                  ? "ー"
                  : `${lossRate}%（${lossQty}個）`
              }
            </span>
          </div>
          <div>出荷合計：${shippedQty}個 / 売上合計：${soldQty}個</div>
        </div>
      `;
    });

    resultDiv.innerHTML = html;

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}
