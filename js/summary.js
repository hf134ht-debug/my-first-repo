/* =========================================================
   summary.js
   集計タブ（日／週）
   - 日：カレンダー（データあり日ハイライト）＋日別ロスカード
   - 週：横並び「週チップ」＋週別ロス
        + グラフ3種（棒・折れ線・ドーナツ）
        + 店舗別アコーディオン
        + AIコメント
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

/* ===== ApexCharts インスタンス（週ビュー用） ===== */
let weekBarChartObj = null;
let weekLineChartObj = null;
let weekDonutChartObj = null;

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
   ▼ 週ビュー（横並び「週チップ」）
   - 月単位で「第1週〜第n週」のチップを表示
   - データあり週はポップなハイライト
   - データなし週も選択可能（淡く表示）
   - グラフ3種 + 店舗別アコーディオン + AIコメント
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

/* 週集計用：週内の店舗別情報をまとめる（summaryDate API を日別に叩く） */
async function fetchWeeklyStoreDetails(daysArray) {
  const storeMap = {}; // itemName -> storeName -> {shippedQty, soldQty, lossQty}

  if (!Array.isArray(daysArray)) return storeMap;

  const tasks = daysArray.map(async (ds) => {
    try {
      const res = await fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${ds}`);
      const daily = await res.json();
      if (!daily.found || !daily.items) return;

      daily.items.forEach(item => {
        const itemName = item.item;
        if (!storeMap[itemName]) storeMap[itemName] = {};

        if (Array.isArray(item.stores)) {
          item.stores.forEach(st => {
            const name = st.name;
            if (!storeMap[itemName][name]) {
              storeMap[itemName][name] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
            }
            storeMap[itemName][name].shippedQty += st.shippedQty || 0;
            storeMap[itemName][name].soldQty    += st.soldQty    || 0;
            storeMap[itemName][name].lossQty    += st.lossQty    || 0;
          });
        }
      });
    } catch (e) {
      console.warn("fetchWeeklyStoreDetails error:", e);
    }
  });

  await Promise.all(tasks);

  // lossRate 付与
  Object.values(storeMap).forEach(itemStores => {
    Object.values(itemStores).forEach(s => {
      s.lossRate = s.shippedQty > 0
        ? Math.round((s.lossQty / s.shippedQty) * 100)
        : null;
    });
  });

  return storeMap;
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

    // 週内の店舗別情報を別途日別APIから集計
    const weeklyStoreMap = await fetchWeeklyStoreDetails(data.days || []);

    // グラフ用データを整形
    const chartData = buildWeekChartData(data);

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

    // ▼ グラフ3種（順番：棒 → 折れ線 → ドーナツ）
    html += `
      <div class="week-charts">
        <div class="week-chart-card">
          <h4>品目別ロス（個数）</h4>
          <div id="weekBarChart"></div>
        </div>
        <div class="week-chart-card">
          <h4>日別ロス推移</h4>
          <div id="weekLineChart"></div>
        </div>
        <div class="week-chart-card">
          <h4>品目別ロス構成比</h4>
          <div id="weekDonutChart"></div>
        </div>
      </div>
    `;

    // ▼ 品目別カード（週トータル）＋ 店舗別アコーディオン
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = shippedQty > 0 ? Math.round((lossQty / shippedQty) * 100) : null;

      // 色分け：日ビューと同じ（白菜系：黄緑／キャベツ系：緑／トウモロコシ系：薄黄色）
      let cls = "corn";
      let badgeCls = "item-total-corn";

      if (itemName.indexOf("白菜") !== -1) {
        cls = "hakusai";
        badgeCls = "item-total-hakusai";
      } else if (itemName.indexOf("キャベツ") !== -1) {
        cls = "cabbage";
        badgeCls = "item-total-cabbage";
      }

      // この品目の店舗別（週トータル）
      let storeAccordionHtml = `<div style="font-size:0.85em;color:#555;margin-top:4px;">
        店舗別内訳なし
      </div>`;

      const storeMapForItem = weeklyStoreMap[itemName];
      if (storeMapForItem) {
        const storesArr = Object.keys(storeMapForItem).map(name => {
          const s = weeklyStoreMap[itemName][name];
          return {
            name,
            shippedQty: s.shippedQty,
            soldQty: s.soldQty,
            lossQty: s.lossQty,
            lossRate: s.lossRate
          };
        });
        if (storesArr.length > 0) {
          storeAccordionHtml = renderStoreAccordion(storesArr);
        }
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
          ${storeAccordionHtml}
        </div>
      `;
    });

    // ▼ AIコメント（画面の一番下）
    const aiComment = generateWeeklyAiComment(data);
    html += `
      <div class="history-card ai-comment-card">
        <div class="history-title">
          <span>🤖 今週のAIコメント</span>
        </div>
        <div class="ai-comment-body">
          ${escapeHtml(aiComment).replace(/\n/g, "<br>")}
        </div>
      </div>
    `;

    resultDiv.innerHTML = html;

    // 店舗アコーディオンを有効化
    attachStoreAccordionEvents();

    // グラフ描画
    renderWeekCharts(chartData);

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* グラフ用データの整形 */
function buildWeekChartData(weekData) {
  const items = weekData.items || [];
  const days  = weekData.days  || [];

  // 品目別ロス（棒 & ドーナツ）
  const itemLabels = [];
  const itemLoss   = [];

  items.forEach(it => {
    itemLabels.push(it.item);
    itemLoss.push(it.lossQty || 0);
  });

  // 日別ロス合計（折れ線）
  const dailyLossMap = {}; // dateStr -> totalLoss
  days.forEach(ds => {
    dailyLossMap[ds] = 0;
  });

  items.forEach(it => {
    if (!Array.isArray(it.daily)) return;
    it.daily.forEach(d => {
      if (dailyLossMap[d.date] === undefined) {
        dailyLossMap[d.date] = 0;
      }
      dailyLossMap[d.date] += d.lossQty || 0;
    });
  });

  const dayLabels = Object.keys(dailyLossMap).sort();
  const dayLoss   = dayLabels.map(ds => dailyLossMap[ds]);

  return {
    itemLabels,
    itemLoss,
    dayLabels,
    dayLoss
  };
}

/* グラフ描画本体（ApexCharts） */
function renderWeekCharts(chartData) {
  if (typeof ApexCharts === "undefined") {
    console.warn("ApexCharts が読み込まれていません");
    return;
  }

  // 既存チャートがあれば破棄
  if (weekBarChartObj) {
    weekBarChartObj.destroy();
    weekBarChartObj = null;
  }
  if (weekLineChartObj) {
    weekLineChartObj.destroy();
    weekLineChartObj = null;
  }
  if (weekDonutChartObj) {
    weekDonutChartObj.destroy();
    weekDonutChartObj = null;
  }

  const { itemLabels, itemLoss, dayLabels, dayLoss } = chartData;

  // 品目ごとの色（履歴のカード色に合わせたイメージ）
  const barColors = itemLabels.map(name => getItemColor(name));

  /* --- ① 横棒グラフ：品目別ロス --- */
  const barEl = document.querySelector("#weekBarChart");
  if (barEl && itemLabels.length > 0) {
    const barOptions = {
      chart: {
        type: "bar",
        height: 260
      },
      plotOptions: {
        bar: {
          horizontal: true,
          distributed: true,
          borderRadius: 6,
          barHeight: "60%"
        }
      },
      series: [
        {
          name: "ロス個数",
          data: itemLoss
        }
      ],
      xaxis: {
        categories: itemLabels
      },
      colors: barColors,
      dataLabels: {
        enabled: true,
        formatter: val => `${val}個`
      },
      legend: {
        show: false
      }
    };
    weekBarChartObj = new ApexCharts(barEl, barOptions);
    weekBarChartObj.render();
  }

  /* --- ② 折れ線グラフ：日別ロス推移 --- */
  const lineEl = document.querySelector("#weekLineChart");
  if (lineEl && dayLabels.length > 0) {
    const lineOptions = {
      chart: {
        type: "line",
        height: 260
      },
      series: [
        {
          name: "ロス個数",
          data: dayLoss
        }
      ],
      xaxis: {
        categories: dayLabels.map(ds => ds.slice(5)), // "MM-DD" 部分だけ表示
        labels: {
          rotate: -45
        }
      },
      stroke: {
        curve: "smooth",
        width: 3
      },
      markers: {
        size: 4
      },
      colors: ["#ff9f7a"],
      dataLabels: {
        enabled: true,
        formatter: val => `${val}個`
      }
    };
    weekLineChartObj = new ApexCharts(lineEl, lineOptions);
    weekLineChartObj.render();
  }

  /* --- ③ ドーナツグラフ：品目別ロス構成比 --- */
  const donutEl = document.querySelector("#weekDonutChart");
  if (donutEl && itemLabels.length > 0) {
    const donutOptions = {
      chart: {
        type: "donut",
        height: 260
      },
      series: itemLoss,
      labels: itemLabels,
      colors: barColors,
      legend: {
        position: "bottom"
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Math.round(val)}%`
      }
    };
    weekDonutChartObj = new ApexCharts(donutEl, donutOptions);
    weekDonutChartObj.render();
  }
}

/* 品目名から色を決める（白菜系：黄緑／キャベツ系：緑／トウモロコシ系：薄黄色） */
function getItemColor(name) {
  const s = String(name);
  if (s.indexOf("白菜") !== -1) {
    return "#b6e36b"; // 黄緑
  }
  if (s.indexOf("キャベツ") !== -1) {
    return "#5ac18e"; // 緑寄り
  }
  if (s.indexOf("トウモロコシ") !== -1) {
    return "#ffe08a"; // 薄黄色
  }
  return "#cccccc";
}

/* =========================================================
   AIコメント生成（週ビュー用・スタイルC＋位置A）
========================================================= */
function generateWeeklyAiComment(weekData) {
  if (!weekData || !weekData.total || !Array.isArray(weekData.items)) {
    return "今週のデータが少ないため、コメントの生成は見送りました。";
  }

  const total = weekData.total;
  const items = weekData.items;

  const totalLoss = total.lossQty || 0;
  if (totalLoss <= 0) {
    return [
      "今週は全体としてロスがほとんど発生していません。",
      "売り切り傾向なので、人気が高い品目の出荷を少し増やしても良さそうです。",
      "来週も同様の出荷バランスで様子を見て、売上の伸び方を確認してみてください。"
    ].join("\n");
  }

  // ① ロスが大きい品目
  let worstItem = null;
  items.forEach(it => {
    if (!worstItem || (it.lossQty || 0) > (worstItem.lossQty || 0)) {
      worstItem = it;
    }
  });

  // ② 日別ロス最大の日
  const dayLossMap = {};
  (weekData.days || []).forEach(ds => {
    dayLossMap[ds] = 0;
  });
  items.forEach(it => {
    if (!Array.isArray(it.daily)) return;
    it.daily.forEach(d => {
      if (dayLossMap[d.date] === undefined) dayLossMap[d.date] = 0;
      dayLossMap[d.date] += d.lossQty || 0;
    });
  });

  let worstDay = null;
  let worstDayLoss = 0;
  Object.keys(dayLossMap).forEach(ds => {
    const v = dayLossMap[ds];
    if (v > worstDayLoss) {
      worstDayLoss = v;
      worstDay = ds;
    }
  });

  // ③ ロス率が低い優等生品目
  let bestItem = null;
  items.forEach(it => {
    const shipped = it.shippedQty || 0;
    const loss    = it.lossQty    || 0;
    if (shipped <= 0) return;
    const rate = loss / shipped;
    if (!bestItem || rate < bestItem.rate) {
      bestItem = {
        name: it.item,
        rate,
        shipped
      };
    }
  });

  const lines = [];

  if (worstItem) {
    const shipped = worstItem.shippedQty || 0;
    const loss    = worstItem.lossQty    || 0;
    const rate    = shipped > 0 ? Math.round((loss / shipped) * 100) : null;
    lines.push(
      `・今週もっともロスが大きかったのは「${worstItem.item}」（${loss}個${rate !== null ? `／ロス率：${rate}%` : ""}）です。`
    );
  }

  if (worstDay) {
    lines.push(
      `・ロスが集中した日は「${worstDay}」（合計ロス：${worstDayLoss}個）です。特にこの日の出荷量を見直すと効果が出やすいです。`
    );
  }

  if (bestItem && bestItem.rate < 0.1) {
    lines.push(
      `・ロス率が低い優等生は「${bestItem.name}」（ロス率：約${Math.round(bestItem.rate * 100)}%）です。出荷を少し増やしてもリスクは小さそうです。`
    );
  }

  lines.push(
    "・来週はロスの多かった品目の出荷を少し控えめにしつつ、ロスの少ない品目に振り替えることで全体ロスの圧縮が期待できます。"
  );

  return lines.join("\n");
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

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
