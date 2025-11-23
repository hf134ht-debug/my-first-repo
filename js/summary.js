/* =========================================================
   summary.js
   集計タブ（日／週／月）
   - 日：カレンダー（データあり日ハイライト）＋日別ロスカード
   - 週：横並び「週チップ」＋週別ロスカード
   - 月：横並び「月チップ」＋月別ロスカード＋店舗別内訳＋AIコメント
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SUMMARY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== タブ状態 ===== */
let currentSummaryView = "day"; // "day" | "week" | "month" | "year"

/* ===== 日ビュー用 状態 ===== */
let summaryCalYear;
let summaryCalMonth;
const summaryMonthDaysCache = {}; // { "2025-11": ["01","03",...] }

/* ===== 週ビュー用 状態 ===== */
let summaryWeekYear;
let summaryWeekMonth;
let summaryWeeks = [];           // [{ start:Date, end:Date, hasData:true/false }, ...]
let summarySelectedWeekIndex = 0;

/* ===== 月ビュー用 状態 ===== */
let summaryMonthViewYear;
let summarySelectedMonthIndex = 0; // 0〜11（1〜12月に対応）


/* =========================================================
   画面描画
========================================================= */

/* 集計タブ HTML 全体 */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>
    <div id="summaryTabArea">${renderSummaryTabs()}</div>

    <!-- 日／週／月 のコントロール（カレンダー／週チップ／月チップ） -->
    <div id="summaryControlArea"></div>

    <!-- 結果表示 -->
    <div id="summaryResult">
      <p>表示する期間を選択してください</p>
    </div>
  `;
}

/* タブ（「日・週・月・年」） */
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

/* タブ切替 */
function changeSummaryView(view) {
  currentSummaryView = view;

  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) tabArea.innerHTML = renderSummaryTabs();

  if (view === "day") {
    setupSummaryDayView();
  } else if (view === "week") {
    setupSummaryWeekView();
  } else if (view === "month") {
    setupSummaryMonthView();
  } else if (view === "year") {
    const ctrl = document.getElementById("summaryControlArea");
    if (ctrl) ctrl.innerHTML = `<p>年集計は開発中です。</p>`;
    const result = document.getElementById("summaryResult");
    if (result) result.innerHTML = "";
  }
}

/* 集計タブが開かれたときに app.js から呼ばれる入口 */
async function activateSummaryFeatures() {
  currentSummaryView = "day";
  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) tabArea.innerHTML = renderSummaryTabs();
  await setupSummaryDayView();
}


/* =========================================================
   ▼ 日ビュー（カレンダー＋日別ロス）
========================================================= */

/* 月ごとの「データあり日」を取得（GAS） */
async function getSummaryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (summaryMonthDaysCache[ym]) return summaryMonthDaysCache[ym];

  const res  = await fetch(`${SUMMARY_SCRIPT_URL}?checkSummaryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  summaryMonthDaysCache[ym] = days;
  return days;
}

/* 日ビュー 初期セットアップ */
async function setupSummaryDayView() {
  const ctrl = document.getElementById("summaryControlArea");
  if (!ctrl) return;

  ctrl.innerHTML = `<div id="summaryCalendarArea"></div>`;

  const now = new Date();
  summaryCalYear  = now.getFullYear();
  summaryCalMonth = now.getMonth();

  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, null, daysWithData);

  document.getElementById("summaryResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* カレンダー描画（日ビュー用） */
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

  // 最初の空白
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

/* 月移動（日ビュー用） */
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

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, null, daysWithData);

  document.getElementById("summaryResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* 日付クリック（日ビュー） */
async function selectSummaryDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const daysWithData = await getSummaryDaysWithData(y, m);
  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(y, m, new Date(y,m,d), daysWithData);

  loadDailySummary(dateStr);
}

/* ===== 日別ロスデータ取得 & 表示 ===== */
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

    // ▼ 全体サマリーカード（青系）
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 全体ロス</span>
          <span class="item-total-badge summary-badge">
            ${
              total.lossRate === null
                ? 'ロス率：ー'
                : `ロス率：${total.lossRate}%（${total.lossQty}個）`
            }
          </span>
        </div>
        <div>出荷：<b>${total.shippedQty || 0}個</b></div>
        <div>売上：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // ▼ 品目別カード
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = it.lossRate;

      // 色分け（履歴と同じ）
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
    attachStoreAccordionEvents();

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* 店舗別アコーディオン HTML */
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

/* 店舗別アコーディオン動作 */
function attachStoreAccordionEvents() {
  const toggles = document.querySelectorAll(".store-accordion-toggle");

  toggles.forEach(btn => {
    btn.onclick = () => {
      const body = btn.nextElementSibling;
      if (!body) return;

      const isOpen = body.classList.contains("open");
      if (isOpen) {
        body.style.maxHeight = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
          body.classList.remove("open");
        });
      } else {
        body.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    };
  });
}


/* =========================================================
   ▼ 週ビュー（横並び「週チップ」）
========================================================= */

/* 週ビュー 初期セットアップ */
async function setupSummaryWeekView() {
  const ctrl = document.getElementById("summaryControlArea");
  if (!ctrl) return;

  const today = new Date();
  summaryWeekYear  = today.getFullYear();
  summaryWeekMonth = today.getMonth();
  summarySelectedWeekIndex = 0;

  ctrl.innerHTML = `
    <div class="summary-week-wrapper">
      <div class="summary-week-header">
        <button class="week-nav-btn" onclick="changeSummaryWeekMonth(-1)">＜</button>
        <div class="summary-week-month-label"></div>
        <button class="week-nav-btn" onclick="changeSummaryWeekMonth(1)">＞</button>
      </div>
      <div id="summaryWeekChips" class="summary-week-chips"></div>
    </div>
  `;

  await refreshSummaryWeekChips();
}

/* 月移動（週ビュー） */
async function changeSummaryWeekMonth(offset) {
  summaryWeekMonth += offset;
  if (summaryWeekMonth < 0) {
    summaryWeekMonth = 11;
    summaryWeekYear--;
  }
  if (summaryWeekMonth > 11) {
    summaryWeekMonth = 0;
    summaryWeekYear++;
  }
  summarySelectedWeekIndex = 0;
  await refreshSummaryWeekChips();
}

/* 指定月の週チップを再描画 */
async function refreshSummaryWeekChips() {
  const monthLabel = document.querySelector(".summary-week-month-label");
  if (monthLabel) {
    monthLabel.textContent = `${summaryWeekYear}年 ${summaryWeekMonth + 1}月`;
  }

  const chipsDiv = document.getElementById("summaryWeekChips");
  if (!chipsDiv) return;

  const daysWithData = await getSummaryDaysWithData(summaryWeekYear, summaryWeekMonth);
  summaryWeeks = buildWeeksForMonth(summaryWeekYear, summaryWeekMonth, daysWithData);

  if (summaryWeeks.length === 0) {
    chipsDiv.innerHTML = `<p style="font-size:0.9em;color:#666;">この月の週データはありません。</p>`;
    document.getElementById("summaryResult").innerHTML = "";
    return;
  }

  if (summarySelectedWeekIndex >= summaryWeeks.length) {
    summarySelectedWeekIndex = 0;
  }

  chipsDiv.innerHTML = summaryWeeks
    .map((w, idx) => {
      const startLabel = `${w.start.getMonth() + 1}/${w.start.getDate()}`;
      const endLabel   = `${w.end.getMonth() + 1}/${w.end.getDate()}`;
      const hasDataClass   = w.hasData ? "has-data" : "no-data";
      const activeClass    = idx === summarySelectedWeekIndex ? "active" : "";

      return `
        <button
          class="week-pill ${hasDataClass} ${activeClass}"
          onclick="selectSummaryWeek(${idx})"
        >
          <div class="week-pill-title">第${idx + 1}週</div>
          <div class="week-pill-range">${startLabel}〜${endLabel}</div>
          ${
            w.hasData
              ? `<div class="week-pill-dot-row">
                   <span class="week-pill-dot"></span>
                   データあり
                 </div>`
              : `<div class="week-pill-dot-row week-pill-dot-row--muted">
                   <span class="week-pill-dot week-pill-dot--empty"></span>
                   データなし
                 </div>`
          }
        </button>
      `;
    })
    .join("");

  // 選択中の週の集計を表示
  const weekStart = summaryWeeks[summarySelectedWeekIndex].start;
  const weekStartStr = formatDateYmd(weekStart);
  await loadWeeklySummary(weekStartStr);
}

/* 指定月の「月曜始まり」週を計算して配列にする */
function buildWeeksForMonth(year, month, daysWithData) {
  const weeks = [];

  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=日,1=月,...

  // 月曜始まりに合わせて、その月のカレンダーの先頭（月曜日）を求める
  const diffToMonday = (firstDayOfWeek + 6) % 7; // 日(0)→6, 月(1)→0 ...
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setDate(firstOfMonth.getDate() - diffToMonday);

  let current = new Date(firstMonday);

  for (let w = 0; w < 6; w++) {  // 最大6週分
    const start = new Date(current);
    const end   = new Date(current);
    end.setDate(start.getDate() + 6);

    // この週が対象の月と重なっているか
    const overlapsMonth =
      start.getMonth() === month ||
      end.getMonth() === month;

    if (!overlapsMonth && start.getMonth() > month && start.getFullYear() === year) {
      break;
    }

    // この週に「データあり日」が含まれるか
    let hasData = false;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayStr = String(d.getDate()).padStart(2,"0");
        if (daysWithData.includes(dayStr)) {
          hasData = true;
          break;
        }
      }
    }

    if (overlapsMonth) {
      weeks.push({
        start,
        end,
        hasData
      });
    }

    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

/* 週チップ選択 */
async function selectSummaryWeek(index) {
  summarySelectedWeekIndex = index;
  await refreshSummaryWeekChips(); // 自分で再描画＋loadWeeklySummary 呼び出し
}

/* 週集計データ取得 & 表示 */
async function loadWeeklySummary(weekStartStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryWeek=${weekStartStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `
        <div class="history-card summary-total" style="opacity:0.7;">
          <div class="history-title">
            <span>この週のデータはありません</span>
          </div>
          <div style="font-size:0.9em;color:#555;">
            週を選び直すか、別の月を表示してください。
          </div>
        </div>
      `;
      return;
    }

    const total = data.total || {};
    const items = data.items || [];

    const weekStart = data.days[0];
    const weekEnd   = data.days[data.days.length - 1];

    let html = `
      <h3>${weekStart}〜${weekEnd} の週集計</h3>
    `;

    // ▼ 全体サマリー
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📅 週合計ロス</span>
          <span class="item-total-badge summary-badge">
            ${
              total.lossRate === null
                ? 'ロス率：ー'
                : `ロス率：${total.lossRate}%（${total.lossQty}個）`
            }
          </span>
        </div>
        <div>出荷：<b>${total.shippedQty || 0}個</b></div>
        <div>売上：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // ▼ 品目別
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = shippedQty > 0 ? Math.round((lossQty / shippedQty) * 100) : null;

      // 色分け：日ビューと同じ
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
              ${
                lossRate === null
                  ? `ロス：${lossQty}個`
                  : `ロス：${lossQty}個（${lossRate}%）`
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


/* =========================================================
   ▼ 月ビュー（横並び「月チップ」＋AIコメント）
========================================================= */

/* 月ビュー 初期セットアップ */
async function setupSummaryMonthView() {
  const ctrl = document.getElementById("summaryControlArea");
  if (!ctrl) return;

  const today = new Date();
  summaryMonthViewYear   = today.getFullYear();
  summarySelectedMonthIndex = today.getMonth(); // 0〜11

  ctrl.innerHTML = `
    <div class="summary-week-wrapper">
      <div class="summary-week-header">
        <button class="week-nav-btn" onclick="changeSummaryMonthYear(-1)">＜</button>
        <div class="summary-week-month-label summary-month-year-label"></div>
        <button class="week-nav-btn" onclick="changeSummaryMonthYear(1)">＞</button>
      </div>
      <div id="summaryMonthChips" class="summary-week-chips summary-month-chips"></div>
    </div>
  `;

  await refreshSummaryMonthChips();
}

/* 年移動（月ビュー） */
async function changeSummaryMonthYear(offset) {
  summaryMonthViewYear += offset;
  if (summaryMonthViewYear < 2000) summaryMonthViewYear = 2000; // 下限ガード（お好みで）
  if (summaryMonthViewYear > 2100) summaryMonthViewYear = 2100; // 上限ガード（お好みで）

  // 年が変わったらとりあえず1月を選択
  summarySelectedMonthIndex = 0;
  await refreshSummaryMonthChips();
}

/* 月チップ再描画 */
async function refreshSummaryMonthChips() {
  const yearLabel = document.querySelector(".summary-month-year-label");
  if (yearLabel) {
    yearLabel.textContent = `${summaryMonthViewYear}年`;
  }

  const chipsDiv = document.getElementById("summaryMonthChips");
  if (!chipsDiv) return;

  // 12ヶ月分まとめて「データあり日」を取得
  const promises = [];
  for (let m = 0; m < 12; m++) {
    promises.push(getSummaryDaysWithData(summaryMonthViewYear, m));
  }
  const daysByMonth = await Promise.all(promises); // [ ["01","03"], [], ... ]

  chipsDiv.innerHTML = daysByMonth
    .map((days, idx) => {
      const hasData = days.length > 0;
      const hasDataClass = hasData ? "has-data" : "no-data";
      const activeClass  = idx === summarySelectedMonthIndex ? "active" : "";

      return `
        <button
          class="week-pill month-pill ${hasDataClass} ${activeClass}"
          onclick="selectSummaryMonth(${idx})"
        >
          <div class="week-pill-title">${idx + 1}月</div>
          ${
            hasData
              ? `<div class="week-pill-dot-row">
                   <span class="week-pill-dot"></span>
                   データあり
                 </div>`
              : `<div class="week-pill-dot-row week-pill-dot-row--muted">
                   <span class="week-pill-dot week-pill-dot--empty"></span>
                   データなし
                 </div>`
          }
        </button>
      `;
    })
    .join("");

  // 選択中の月の月集計を表示
  await loadMonthlySummary(summaryMonthViewYear, summarySelectedMonthIndex, daysByMonth[summarySelectedMonthIndex]);
}

/* 月チップ選択 */
async function selectSummaryMonth(monthIndex) {
  summarySelectedMonthIndex = monthIndex;
  // daysByMonth を再度計算しても良いが、簡単のために chips 再描画からやり直す
  await refreshSummaryMonthChips();
}

/* 月集計データ取得 & 表示
   - GAS に新しいAPIを作らず、
   - その月の各日について ?summaryDate=YYYY-MM-DD を呼び出し JS 側で合算
*/
async function loadMonthlySummary(year, monthIndex, daysInMonth) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    // daysInMonth が未指定のときは再取得
    let dayList = daysInMonth;
    if (!dayList) {
      dayList = await getSummaryDaysWithData(year, monthIndex);
    }

    if (!dayList || dayList.length === 0) {
      resultDiv.innerHTML = `
        <div class="history-card summary-total" style="opacity:0.7;">
          <div class="history-title">
            <span>この月のデータはありません</span>
          </div>
          <div style="font-size:0.9em;color:#555;">
            別の月を選択してください。
          </div>
        </div>
      `;
      return;
    }

    const ym = `${year}-${String(monthIndex + 1).padStart(2,"0")}`;

    // 月集計用の変数
    let totalShipped = 0;
    let totalSold    = 0;

    const itemMap = {}; // key: itemName

    // 日ごとに summaryDate を叩いて合算
    for (const day of dayList) {
      const dateStr = `${ym}-${day}`;
      const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${dateStr}`);
      const data = await res.json();

      if (!data.found) continue;

      const dailyTotal = data.total || {};
      totalShipped += dailyTotal.shippedQty || 0;
      totalSold    += dailyTotal.soldQty    || 0;

      const dailyItems = data.items || [];
      dailyItems.forEach(it => {
        const itemName = it.item;
        if (!itemMap[itemName]) {
          itemMap[itemName] = {
            item: itemName,
            shippedQty: 0,
            soldQty: 0,
            lossQty: 0,
            storesMap: {} // { storeName: {shippedQty, soldQty, lossQty} }
          };
        }
        const target = itemMap[itemName];
        target.shippedQty += it.shippedQty || 0;
        target.soldQty    += it.soldQty    || 0;
        target.lossQty    += it.lossQty    || 0;

        // 店舗別サマリ
        (it.stores || []).forEach(s => {
          const name = s.name;
          if (!target.storesMap[name]) {
            target.storesMap[name] = {
              name,
              shippedQty: 0,
              soldQty: 0,
              lossQty: 0
            };
          }
          const st = target.storesMap[name];
          st.shippedQty += s.shippedQty || 0;
          st.soldQty    += s.soldQty    || 0;
          st.lossQty    += s.lossQty    || 0;
        });
      });
    }

    const totalLoss = totalShipped - totalSold;
    const totalLossRate = totalShipped > 0
      ? Math.round((totalLoss / totalShipped) * 100)
      : null;

    // 品目リスト整形（表示順固定 & 店舗配列）
    const order = ["白菜", "白菜カット", "キャベツ", "キャベツカット", "トウモロコシ"];

    const items = Object.values(itemMap).map(it => {
      const shippedQty = it.shippedQty;
      const soldQty    = it.soldQty;
      const lossQty    = it.lossQty;
      const lossRate   = shippedQty > 0
        ? Math.round((lossQty / shippedQty) * 100)
        : null;

      const storesArr = Object.values(it.storesMap).map(s => {
        const sLossRate = s.shippedQty > 0
          ? Math.round((s.lossQty / s.shippedQty) * 100)
          : null;
        return {
          name: s.name,
          shippedQty: s.shippedQty,
          soldQty: s.soldQty,
          lossQty: s.lossQty,
          lossRate: sLossRate
        };
      });

      return {
        item: it.item,
        shippedQty,
        soldQty,
        lossQty,
        lossRate,
        stores: storesArr
      };
    });

    items.sort((a, b) => {
      const ia = order.indexOf(a.item);
      const ib = order.indexOf(b.item);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    // タイトル・期間
    const sortedDays = [...dayList].sort((a, b) => Number(a) - Number(b));
    const firstDay = sortedDays[0];
    const lastDay  = sortedDays[sortedDays.length - 1];

    let html = `
      <h3>${year}年${monthIndex + 1}月の月別集計</h3>
      <p style="font-size:0.9em;color:#555;">
        集計対象日：${ym}-${firstDay} 〜 ${ym}-${lastDay}
      </p>
    `;

    // ▼ 全体サマリーカード
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📅 月合計ロス</span>
          <span class="item-total-badge summary-badge">
            ${
              totalLossRate === null
                ? 'ロス率：ー'
                : `ロス率：${totalLossRate}%（${totalLoss}個）`
            }
          </span>
        </div>
        <div>出荷合計：<b>${totalShipped || 0}個</b></div>
        <div>売上合計：<b>${totalSold || 0}個</b></div>
      </div>
    `;

    // ▼ AIコメント（改善アドバイス）
    const aiComment = generateMonthlyAiComment(items, {
      shippedQty: totalShipped,
      soldQty: totalSold,
      lossQty: totalLoss,
      lossRate: totalLossRate
    });

    html += `
      <div class="history-card summary-total" style="background:#f0f4ff;">
        <div class="history-title">
          <span>🤖 AIコメント（月レビュー）</span>
        </div>
        <div style="font-size:0.9em; line-height:1.6;">
          ${aiComment}
        </div>
      </div>
    `;

    // ▼ 品目別カード
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = it.lossRate;

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
              ${
                lossRate === null
                  ? `ロス：${lossQty}個`
                  : `ロス：${lossQty}個（${lossRate}%）`
              }
            </span>
          </div>
          <div>出荷合計：${shippedQty}個 / 売上合計：${soldQty}個</div>
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
    attachStoreAccordionEvents();

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* 月ビュー用 AIコメント生成（A：前向き改善） */
function generateMonthlyAiComment(items, total) {
  if (!items || items.length === 0 || !total) {
    return "今月のロスデータがほとんどありません。まずは対象商品の取り扱い日を増やして、傾向を見ていきましょう。";
  }

  // ロス率が高い順に並べる（出荷10個未満はノイズとして除外）
  const candidates = items
    .filter(it => it.shippedQty >= 10)
    .map(it => ({
      name: it.item,
      lossRate: it.lossRate ?? 0,
      lossQty: it.lossQty,
      shippedQty: it.shippedQty,
      soldQty: it.soldQty
    }))
    .sort((a, b) => (b.lossRate || 0) - (a.lossRate || 0));

  const bestSellers = [...items]
    .filter(it => it.soldQty >= 10)
    .sort((a, b) => (b.soldQty || 0) - (a.soldQty || 0));

  const worst = candidates[0];
  const best  = bestSellers[0];

  let lines = [];

  // 1. 全体のコメント
  if (total.lossRate === null) {
    lines.push("今月は全体としてロス率が計算できない日も多く、データが安定していません。まずは出荷と売上の両方が揃う日を増やしていきましょう。");
  } else if (total.lossRate <= 10) {
    lines.push(`全体のロス率は約${total.lossRate}% と、比較的コントロールされています。今の出荷バランスを維持しつつ、品目ごとの微調整でさらに改善が狙えます。`);
  } else if (total.lossRate <= 20) {
    lines.push(`全体のロス率は約${total.lossRate}% です。少し高めなので、ロスが大きい品目を中心に出荷量の見直しをすると効果が出やすそうです。`);
  } else {
    lines.push(`全体のロス率は約${total.lossRate}% と高めです。特にロスが集中している品目・店舗を絞り込んで、出荷量を一段階落としてみるのがおすすめです。`);
  }

  // 2. 悪い方のピックアップ
  if (worst && worst.lossRate > 0) {
    lines.push(
      `今月もっともロス率が高かったのは「${worst.name}」です（ロス率：約${worst.lossRate}%、ロス個数：${worst.lossQty}個）。`
      + " 出荷数に対して売上が追いついていない可能性があるので、次月はまずこの品目の出荷を少し抑えて様子を見ると良さそうです。"
    );
  }

  // 3. 良い方のピックアップ
  if (best && best.lossRate !== null && best.lossRate <= 10) {
    lines.push(
      `一方で「${best.item}」は売上がしっかり出ており（${best.soldQty}個）、ロス率も${best.lossRate ?? 0}%台と安定しています。`
      + " この品目は今の出荷量でも問題なさそうなので、他品目のロス調整とセットで全体のバランスを整えていけます。"
    );
  }

  // 4. 店舗観点（ざっくり）
  const storeLossMap = {};
  items.forEach(it => {
    (it.stores || []).forEach(s => {
      if (!storeLossMap[s.name]) {
        storeLossMap[s.name] = { name: s.name, lossQty: 0, shippedQty: 0 };
      }
      storeLossMap[s.name].lossQty   += s.lossQty   || 0;
      storeLossMap[s.name].shippedQty += s.shippedQty || 0;
    });
  });

  const storeList = Object.values(storeLossMap).map(s => ({
    name: s.name,
    lossQty: s.lossQty,
    lossRate: s.shippedQty > 0 ? Math.round((s.lossQty / s.shippedQty) * 100) : null
  })).sort((a, b) => (b.lossRate || 0) - (a.lossRate || 0));

  const worstStore = storeList[0];
  if (worstStore && worstStore.lossRate !== null && worstStore.lossRate > 0) {
    lines.push(
      `店舗別では「${worstStore.name}」のロス率がやや高め（約${worstStore.lossRate}%）です。`
      + " この店舗向けの出荷を一段階抑えて、他店舗に振り分けられないか検討してみる価値があります。"
    );
  }

  if (lines.length === 0) {
    return "今月のデータでは大きな偏りは見られません。今の出荷バランスを維持しつつ、週次の推移を見ながら細かく調整していきましょう。";
  }

  return lines.join("<br>");
}


/* =========================================================
   Util
========================================================= */
function formatDateYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
