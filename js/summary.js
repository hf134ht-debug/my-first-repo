/* =========================================================
   summary.js
   集計タブ（日／週）
   - 日：カレンダー（データあり日ハイライト）＋日別ロスカード
   - 週：横並び「週チップ」＋週別ロス＋横棒グラフ＋AI考察
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

/* =========================================================
   画面描画
========================================================= */

/* 集計タブ HTML 全体 */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>
    <div id="summaryTabArea">${renderSummaryTabs()}</div>

    <!-- 日 or 週 のコントロール（カレンダー／週チップ） -->
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
    const ctrl = document.getElementById("summaryControlArea");
    if (ctrl) ctrl.innerHTML = `<p>月集計は開発中です。</p>`;
    document.getElementById("summaryResult").innerHTML = "";
  } else if (view === "year") {
    const ctrl = document.getElementById("summaryControlArea");
    if (ctrl) ctrl.innerHTML = `<p>年集計は開発中です。</p>`;
    document.getElementById("summaryResult").innerHTML = "";
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
   ▼ 日ビュー（今までのカレンダー＋日別ロス）
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

/* カレンダー描画（summary 用） */
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

/* 店舗別アコーディオン HTML（日ビュー／週ビュー共通で使用） */
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
   ▼ 週ビュー（横並び「週チップ」＋グラフ＋AI考察）
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

/* 週集計データ取得 & 表示（＋グラフ＋AI考察） */
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

      <!-- AI考察（最上部） -->
      <div id="weeklyAiComment" class="ai-comment-card"></div>

      <!-- 全体サマリー -->
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

      <!-- ロス横棒グラフ -->
      <div id="weeklyLossChart" class="summary-chart-box"></div>
    `;

    // ▼ 品目別カード
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

    // グラフ描画
    renderWeeklyLossChart(items);

    // AI考察描画
    renderWeeklyAiComment(data);

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* =========================================================
   ▼ 週ビュー用：グラフ＆AI考察
========================================================= */

/* 品目ごとのカラー（履歴の色に寄せた単色） */
function getItemColorForChart(itemName) {
  if (!itemName) return "#ccc";

  if (itemName.indexOf("白菜") !== -1) {
    // 黄緑（白菜系）
    return "#a5d66a";
  }
  if (itemName.indexOf("キャベツ") !== -1) {
    // 緑（キャベツ系）
    return "#66bb6a";
  }
  if (itemName.indexOf("トウモロコシ") !== -1) {
    // 薄黄色（トウモロコシ系）
    return "#fbc02d";
  }
  return "#90caf9"; // その他（めったに来ない想定）
}

/* ロス個数の横棒グラフ（A案） */
function renderWeeklyLossChart(items) {
  const el = document.getElementById("weeklyLossChart");
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = "";
    return;
  }

  const labels = [];
  const data = [];
  const colors = [];

  items.forEach(it => {
    labels.push(it.item);
    data.push(it.lossQty || 0);
    colors.push(getItemColorForChart(it.item));
  });

  const options = {
    chart: {
      type: "bar",
      height: 280,
      toolbar: { show: false }
    },
    series: [
      {
        name: "ロス個数",
        data: data
      }
    ],
    xaxis: {
      categories: labels
    },
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        borderRadius: 8
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val + "個";
      }
    },
    colors: colors,
    tooltip: {
      y: {
        formatter: function (val) {
          return val + "個";
        }
      }
    }
  };

  el.innerHTML = "";
  const chart = new ApexCharts(el, options);
  chart.render();
}

/* AI考察（Cレベル・出荷側アクション提案） */
function renderWeeklyAiComment(data) {
  const box = document.getElementById("weeklyAiComment");
  if (!box) return;

  const total = data.total || {};
  const items = data.items || [];

  if (!items.length) {
    box.innerHTML = "";
    return;
  }

  // 最悪ロス品目・優等生品目を計算
  let worst = null;
  let best  = null;

  items.forEach(it => {
    const shipped = it.shippedQty || 0;
    const loss    = it.lossQty    || 0;
    if (shipped <= 0) return;

    const rate = Math.round((loss / shipped) * 100);
    const info = { name: it.item, loss, rate };

    if (!worst || info.rate > worst.rate) worst = info;
    if (!best  || info.rate < best.rate)  best  = info;
  });

  const totalRate = total.lossRate;

  const lines = [];

  // 全体コメント
  if (totalRate === null) {
    lines.push("今週の全体ロス率は算出できませんでしたが、品目別の傾向から出荷バランスを見直す余地があります。");
  } else {
    lines.push(`今週の全体ロス率は約${totalRate}%です。前週や平常時と比較して高い場合は、出荷量の見直しを優先してください。`);
  }

  // ロスが重い品目
  if (worst) {
    lines.push(`ロスが最も大きかったのは「${worst.name}」（ロス率 約${worst.rate}%、ロス ${worst.loss}個）です。この品目は次週以降、同じ週の出荷量を目安として<strong>5〜10%程度抑える</strong>ことを検討してください。`);
  }

  // ロスが少ない＝需要が安定している品目
  if (best && worst && best.name !== worst.name) {
    lines.push(`一方で「${best.name}」は相対的にロス率が低く、需要が安定している可能性があります。ロスが大きい品目を減らした分を、こうした<strong>安定品目に少し振り替える</strong>と全体ロスの改善につながります。`);
  }

  // 出荷側として取れる具体的アクション
  lines.push("出荷側としては、店舗からのフィードバックや天候・イベントを踏まえつつ、ロス率の高い品目は保守的に、ロス率の低い品目はやや積極的に出荷する「メリハリ」を付ける運用がおすすめです。");

  box.innerHTML = `
    <div class="ai-comment-title">🤖 AI考察（出荷側アクションの提案）</div>
    <div class="ai-comment-body">
      ${lines.map(t => `<p>${t}</p>`).join("")}
    </div>
  `;
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
