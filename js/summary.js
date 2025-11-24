/* =========================================================
   summary.js
   集計タブ（日／週／月）
   - 日：カレンダー（データあり日ハイライト）＋日別ロスカード
   - 週：横並び「週チップ」＋週ロスカード＋店舗別内訳＋分析5種＋AIコメント
   - 月：週ビューと同じ構成（期間だけ1ヶ月）
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SUMMARY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== ビュー状態 ===== */
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
let summaryMonthYear;
let summaryMonthMonth;

/* ===== 店舗順序（週ビューの店舗別ロス用） ===== */
const STORE_ORDER = [
  "連島", "津高", "茶屋町", "大安寺",
  "中庄", "総社南", "円山", "児島"
];

/* ===== 品目キー & カラー ===== */
const ITEM_ORDER = ["白菜", "白菜カット", "キャベツ", "キャベツカット", "トウモロコシ"];
const ITEM_COLOR_MAP = {
  "白菜":          "#B5E48C", // 黄緑
  "白菜カット":    "#99D98C", // 少し濃い黄緑
  "キャベツ":      "#52B788", // 緑
  "キャベツカット": "#168AAD", // 青緑寄り
  "トウモロコシ":   "#FFE66D"  // 薄黄色
};

/* 品目名から正規のキーを取得（グラフ・並び順用） */
function getItemKey(name) {
  if (!name) return "";
  const s = String(name);
  if (s.indexOf("白菜カット") !== -1) return "白菜カット";
  if (s.indexOf("白菜") !== -1)       return "白菜";
  if (s.indexOf("キャベツカット") !== -1) return "キャベツカット";
  if (s.indexOf("キャベツ") !== -1)       return "キャベツ";
  if (s.indexOf("トウモロコシ") !== -1 || s.indexOf("とうもろこし") !== -1) return "トウモロコシ";
  return s;
}

/* 店舗名の基底キー（最後の「店」を取る） */
function getStoreKey(name) {
  if (!name) return "";
  let s = String(name).trim();
  return s.replace(/店$/, "");
}

/* 表示用：必ず「店」を付けて表示 */
function formatStoreLabel(name) {
  if (!name) return "";
  const s = String(name).trim();
  return s.endsWith("店") ? s : `${s}店`;
}

/* ロス率に応じた色（text-color 用） */
function getLossRateColor(rate) {
  if (rate === null || typeof rate === "undefined" || isNaN(rate)) return "";
  if (rate >= 50) return "#d32f2f";  // 赤：かなり高い
  if (rate >= 20) return "#f57c00";  // オレンジ：要注意
  return "#388e3c";                  // 緑：良好〜許容
}

/* 販売率に応じた色（販売率高いほど良） */
function getSalesRateColor(rate) {
  if (rate === null || typeof rate === "undefined" || isNaN(rate)) return "";
  if (rate >= 80) return "#388e3c";  // 緑：優秀
  if (rate >= 50) return "#f57c00";  // オレンジ：改善余地
  return "#d32f2f";                  // 赤：要改善
}

/* =========================================================
   画面描画
========================================================= */

/* 集計タブ HTML 全体 */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>
    <div id="summaryTabArea">${renderSummaryTabs()}</div>

    <!-- 日 or 週 or 月 のコントロール領域 -->
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
  let days = data.days || [];

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
    const day = new Date(year, month, d);
    const wd = day.getDay();

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

    // 土日色分け
    let style = "";
    if (wd === 0) style = `style="color:red"`;
    if (wd === 6) style = `style="color:blue"`;

    html += `
      <div
        class="calendar-date
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasData ? "has-data" : ""}"
        onclick="selectSummaryDate(${year},${month},${d})"
        ${style}
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

/* ===== 日別ロスデータ取得 & 表示（元のまま） ===== */
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

    const totalLossColor = getLossRateColor(total.lossRate);
    const totalLossStyle = totalLossColor ? ` style="color:${totalLossColor};"` : "";

    let html = `
      <h3>${dateStr} の集計</h3>
      <p style="font-size:0.9em;color:#555;">
        ※ 出荷日は <b>${shipDate}</b>（2日前の出荷と比較）</p>
    `;

    // ▼ 全体サマリーカード（青系）
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 全体ロス</span>
          <span class="item-total-badge summary-badge"${totalLossStyle}>
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

      const lossColor = getLossRateColor(lossRate);
      const lossStyle = lossColor ? ` style="color:${lossColor};"` : "";

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}"${lossStyle}>
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
    resultDiv.innerHTML = `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>⚠ データ取得エラー</span>
        </div>
        <div style="font-size:0.9em;color:#555;">
          日別集計の取得中にエラーが発生しました。<br>
          ネットワーク状況を確認して、もう一度お試しください。<br>
          <span style="font-size:0.8em;color:#999;">詳細: ${err}</span>
        </div>
      </div>
    `;
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
          stores.map(s => {
            const color = getLossRateColor(s.lossRate);
            const style = color ? ` style="color:${color};"` : "";
            return `
            <div class="store-accordion-row">
              <b>${formatStoreLabel(s.name)}</b><br>
              出荷：${s.shippedQty}個 /
              売上：${s.soldQty}個 /
              ロス：
              <span${style}>
                ${
                  s.lossRate === null || typeof s.lossRate === "undefined"
                    ? `${s.lossQty}個`
                    : `${s.lossQty}個（${s.lossRate}%）`
                }
              </span>
            </div>
            `;
          }).join("")
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
   ▼ 週ビュー（横並び「週チップ」＋分析5種＋AIコメント）
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
      const activeClass    = idx === summarySelectedWeekIndex ? "active" : "";

      return `
        <button
          class="week-pill ${activeClass}"
          onclick="selectSummaryWeek(${idx})"
        >
          <div class="week-pill-title">第${idx + 1}週</div>
          <div class="week-pill-range">${startLabel}〜${endLabel}</div>
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

    // 同じ年で、完全に翌月以降に飛んでいたら打ち切り
    if (!overlapsMonth && start.getMonth() > month && start.getFullYear() === year) {
      break;
    }

    weeks.push({ start, end });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

/* 週チップ選択 */
async function selectSummaryWeek(index) {
  summarySelectedWeekIndex = index;
  await refreshSummaryWeekChips(); // 自分で再描画＋loadWeeklySummary 呼び出し
}

/* 週集計データ取得 & 表示（＋店舗別週合算・分析5種・AIコメント） */
async function loadWeeklySummary(weekStartStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    // ① 週集計（品目別合計 & 日別）を取得
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

    const total   = data.total || {};
    const itemsRaw = data.items || [];
    let days      = data.days || [];

    // 品目を決まった順（白菜→白菜カット→キャベツ→キャベツカット→トウモロコシ）にソート
    const items = [...itemsRaw].sort((a, b) => {
      const ka = getItemKey(a.item);
      const kb = getItemKey(b.item);
      const ia = ITEM_ORDER.indexOf(ka);
      const ib = ITEM_ORDER.indexOf(kb);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    // ② 日別ロス合計（折れ線グラフ用）
    const dailyLossMap = {};
    items.forEach(it => {
      (it.daily || []).forEach(d => {
        const ds = d.date;
        const loss = d.lossQty || 0;
        dailyLossMap[ds] = (dailyLossMap[ds] || 0) + loss;
      });
    });

    // ③ 週中の各日について、日別API（summaryDate）を呼び出し、
    //    店舗別週合算（店舗×品目）と店舗別トータルを作る
    const dailyPromises = days.map(ds =>
      fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${ds}`)
        .then(r => r.json())
        .catch(() => null)
    );
    const dailySummaries = await Promise.all(dailyPromises);

    const storeItemMap = {}; // { itemName: { storeName: { shippedQty, soldQty, lossQty } } }
    const storeTotalMap = {}; // { storeName: { shippedQty, soldQty, lossQty } }

    dailySummaries.forEach(daily => {
      if (!daily || !daily.found || !daily.items) return;
      daily.items.forEach(it => {
        const itemName = it.item;
        (it.stores || []).forEach(s => {
          const storeName = s.name;
          const shipped = s.shippedQty || 0;
          const sold    = s.soldQty    || 0;
          const loss    = s.lossQty    || 0;

          if (!storeItemMap[itemName]) storeItemMap[itemName] = {};
          if (!storeItemMap[itemName][storeName]) {
            storeItemMap[itemName][storeName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
          }
          storeItemMap[itemName][storeName].shippedQty += shipped;
          storeItemMap[itemName][storeName].soldQty    += sold;
          storeItemMap[itemName][storeName].lossQty    += loss;

          if (!storeTotalMap[storeName]) {
            storeTotalMap[storeName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
          }
          storeTotalMap[storeName].shippedQty += shipped;
          storeTotalMap[storeName].soldQty    += sold;
          storeTotalMap[storeName].lossQty    += loss;
        });
      });
    });

    // 店舗別トータルの lossRate / salesRate を付与
    Object.keys(storeTotalMap).forEach(name => {
      const st = storeTotalMap[name];
      st.lossRate = st.shippedQty > 0
        ? Math.round((st.lossQty / st.shippedQty) * 100)
        : null;
      st.salesRate = st.shippedQty > 0
        ? Math.round((st.soldQty / st.shippedQty) * 100)
        : null;
    });

    // ④ AIコメント生成
    const aiCommentHtml = buildWeeklyAiComment(total, items, storeTotalMap);

    const totalLossColor = getLossRateColor(total.lossRate);
    const totalLossStyle = totalLossColor ? ` style="color:${totalLossColor};"` : "";

    // ⑤ HTML構築
    const weekStart = days[0];
    const weekEnd   = days[days.length - 1];

    let html = `
      <h3>${weekStart}〜${weekEnd} の週集計</h3>
      ${aiCommentHtml}
    `;

    // ▼ 全体サマリーカード
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📅 週合計ロス</span>
          <span class="item-total-badge summary-badge"${totalLossStyle}>
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

    // ▼ 品目別カード（店舗別アコーディオン付き）
    items.forEach(it => {
      const itemName   = it.item;
      const shippedQty = it.shippedQty || 0;
      const soldQty    = it.soldQty    || 0;
      const lossQty    = it.lossQty    || 0;
      const lossRate   = shippedQty > 0
        ? Math.round((lossQty / shippedQty) * 100)
        : null;

      // 色分け：日ビューと同じ（カード用）
      let cls = "corn";
      let badgeCls = "item-total-corn";

      if (itemName.indexOf("白菜") !== -1) {
        cls = "hakusai";
        badgeCls = "item-total-hakusai";
      } else if (itemName.indexOf("キャベツ") !== -1) {
        cls = "cabbage";
        badgeCls = "item-total-cabbage";
      }

      const lossColor = getLossRateColor(lossRate);
      const lossStyle = lossColor ? ` style="color:${lossColor};"` : "";

      // 店舗別週合算（この品目のみ）
      const perStoreMap = storeItemMap[itemName] || {};
      let storeRows = Object.keys(perStoreMap).map(name => {
        const st = perStoreMap[name];
        const rate = st.shippedQty > 0
          ? Math.round((st.lossQty / st.shippedQty) * 100)
          : null;
        return {
          name,
          shippedQty: st.shippedQty,
          soldQty: st.soldQty,
          lossQty: st.lossQty,
          lossRate: rate
        };
      });

      // 店舗順序で並べ替え
      storeRows.sort((a, b) => {
        const ka = STORE_ORDER.indexOf(getStoreKey(a.name));
        const kb = STORE_ORDER.indexOf(getStoreKey(b.name));
        return (ka === -1 ? 999 : ka) - (kb === -1 ? 999 : kb);
      });

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}"${lossStyle}>
              ${
                lossRate === null
                  ? `ロス：${lossQty}個`
                  : `ロス：${lossQty}個（${lossRate}%）`
              }
            </span>
          </div>
          <div>出荷合計：${shippedQty}個 / 売上合計：${soldQty}個</div>
          ${
            storeRows.length
              ? renderStoreAccordion(storeRows)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">
                   店舗別内訳なし
                 </div>`
          }
        </div>
      `;
    });

    // ▼ 店舗別ロス情報（週合計）※既存そのまま
    html += renderWeeklyStoreTotalSection(storeTotalMap);

    // ▼ 新しい分析エリア（5つの分析枠）
    html += `
      <div class="analysis-wrapper">

        <div class="analysis-card">
          <h4>🏆 店舗別販売率ランキング（上位5店舗）</h4>
          <div id="weekStoreSalesRate"></div>
        </div>

        <div class="analysis-card">
          <h4>📉 日別ロス推移（週）</h4>
          <div id="weekDailyLossTrend"></div>
        </div>

        <div class="analysis-card">
          <h4>🔥 品目×店舗 ロス率ランキング（上位5件）</h4>
          <div id="weekItemStoreLossRanking"></div>
        </div>

        <div class="analysis-card">
          <h4>☀ 天候 × 売上 相関（岡山市）</h4>
          <div id="weekWeatherCorrelation">
            <p style="font-size:0.85em;color:#666;">
              ※ 天気データ取得（GAS 側）が整い次第、ここに散布図やコメントを表示します。
            </p>
          </div>
        </div>

        <div class="analysis-card">
          <h4>🤖 販売予測（AI提案）</h4>
          <div id="weekSalesForecast">
            <p style="font-size:0.85em;color:#666;">
              ※ AI による出荷数提案は、今後の拡張で追加予定です。
            </p>
          </div>
        </div>

      </div>
    `;

    resultDiv.innerHTML = html;

    // アコーディオンにイベント付与
    attachStoreAccordionEvents();

    // 新分析の描画（販売率ランキング・日別ロス推移・ロス率ランキング）
    renderWeekAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap);

  } catch (err) {
    resultDiv.innerHTML = `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>⚠ データ取得エラー</span>
        </div>
        <div style="font-size:0.9em;color:#555;">
          週集計の取得中にエラーが発生しました。<br>
          ネットワーク状況を確認して、もう一度お試しください。<br>
          <span style="font-size:0.8em;color:#999;">詳細: ${err}</span>
        </div>
      </div>
    `;
  }
}

/* 週ビュー：店舗別トータルセクション（既存） */
function renderWeeklyStoreTotalSection(storeTotalMap) {
  const names = Object.keys(storeTotalMap);
  if (!names.length) return "";

  const rows = names.map(name => {
    const st = storeTotalMap[name];
    return {
      name,
      base: getStoreKey(name),
      shippedQty: st.shippedQty,
      soldQty: st.soldQty,
      lossQty: st.lossQty,
      lossRate: st.lossRate
    };
  });

  rows.sort((a, b) => {
    const ia = STORE_ORDER.indexOf(a.base);
    const ib = STORE_ORDER.indexOf(b.base);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  let html = `
    <div class="history-card summary-total" style="margin-top:16px;">
      <div class="history-title">
        <span>🏪 店舗別ロス状況（週合計）</span>
      </div>
      <div class="store-week-total-list">
  `;

  rows.forEach(r => {
    const label = formatStoreLabel(r.name);
    const color = getLossRateColor(r.lossRate);
    const style = color ? ` style="color:${color};"` : "";
    html += `
      <div class="store-week-total-row">
        <div class="store-week-total-name">${label}</div>
        <div class="store-week-total-body">
          出荷：${r.shippedQty}個 /
          売上：${r.soldQty}個 /
          ロス：
          <span${style}>
          ${
            r.lossRate === null
              ? `${r.lossQty}個`
              : `${r.lossQty}個（${r.lossRate}%）`
          }
          </span>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/* 週ビュー：AIコメント生成（既存ロジック） */
function buildWeeklyAiComment(total, items, storeTotalMap) {
  const lossRate = total.lossRate;
  const lossQty  = total.lossQty || 0;

  // 一番ロスが大きい品目
  let maxItem = null;
  items.forEach(it => {
    if (!maxItem || (it.lossQty || 0) > (maxItem.lossQty || 0)) {
      maxItem = it;
    }
  });

  // 一番ロス率が高い店舗
  let maxStore = null;
  Object.keys(storeTotalMap).forEach(name => {
    const st = storeTotalMap[name];
    if (typeof st.lossRate !== "number") return;
    if (!maxStore || st.lossRate > maxStore.lossRate) {
      maxStore = { name, ...st };
    }
  });

  const lines = [];

  // 全体所感
  if (lossRate === null) {
    lines.push("今週は、出荷と売上を比較できる十分なデータが揃っていない日が含まれています。今後、出荷登録と売上データの両方が揃っている日を継続的に増やすことで、より安定した分析が可能になります。");
  } else if (lossRate <= 10) {
    lines.push(`今週の全体ロス率は約${lossRate}%（${lossQty}個）で、比較的良好な水準です。この調子で「出荷量の精度」を維持できると、ロスはさらに安定して抑えられそうです。`);
  } else if (lossRate <= 20) {
    lines.push(`今週の全体ロス率は約${lossRate}%（${lossQty}個）で、ややロスが目立つ週でした。出荷量の微調整や、曜日ごとの売れ行きパターンを意識した出荷が有効になりそうです。`);
  } else {
    lines.push(`今週の全体ロス率は約${lossRate}%（${lossQty}個）と高めです。特に出荷量の見直しや、店舗別の売れ方に合わせた配分調整を検討する価値がありそうです。`);
  }

  // 品目のポイント
  if (maxItem && (maxItem.lossQty || 0) > 0) {
    const key = getItemKey(maxItem.item);
    lines.push(`品目別では「${key}」のロスが最も大きくなっています。出荷量を少しだけ絞る、もしくは他の動きが良い店舗へ振り分けるなど、週単位での配分調整を検討してみてください。`);
  }

  // 店舗のポイント
  if (maxStore && typeof maxStore.lossRate === "number") {
    const label = formatStoreLabel(maxStore.name);
    lines.push(`店舗別では「${label}」のロス率が相対的に高めです。出荷する品目や数量を1〜2割ほど抑えて様子を見る、他店舗との売れ行きの違いを確認する、といった対応が有効かもしれません。`);
  }

  // アクション提案（本社視点）
  lines.push("本社側で調整できるのは「いつ・どの店舗に・どれだけ出荷するか」です。特にロスが目立つ品目については、①売れ行きが安定している店舗へ寄せる、②曜日ごとの売上傾向を意識して出荷日をずらす、といった工夫が効果的です。");

  return `
    <div class="ai-comment-card">
      <div class="ai-comment-title">🤖 今週のAIコメント</div>
      ${lines.map(t => `<p>${t}</p>`).join("")}
    </div>
  `;
}

/* 週ビュー：分析3種（販売率ランキング／日別ロス／ロス率ランキング） */
function renderWeekAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap) {
  // ApexCharts がなければ諦める（テキスト分析だけでもOK）
  const hasApex = (typeof ApexCharts !== "undefined");

  /* ▼ 1) 店舗別販売率ランキング（上位5） */
  const elRate = document.getElementById("weekStoreSalesRate");
  if (elRate) {
    const storeEntries = Object.keys(storeTotalMap).map(name => {
      const st = storeTotalMap[name];
      return {
        name,
        label: formatStoreLabel(name),
        shipped: st.shippedQty || 0,
        sold: st.soldQty || 0,
        rate: st.salesRate
      };
    }).filter(e => e.shipped > 0 && e.rate !== null);

    storeEntries.sort((a,b) => (b.rate || 0) - (a.rate || 0));
    const top5 = storeEntries.slice(0,5);

    if (top5.length === 0) {
      elRate.innerHTML = `<p style="font-size:0.85em;color:#666;">販売率を計算できる店舗がありません。</p>`;
    } else if (hasApex) {
      const labels = top5.map(e => e.label);
      const data   = top5.map(e => e.rate);

      const options = {
        chart: { type: "bar", height: 260 },
        series: [{ name: "販売率(%)", data }],
        xaxis: { categories: labels },
        dataLabels: {
          enabled: true,
          formatter: v => `${v}%`
        },
        plotOptions: {
          bar: { horizontal: true }
        },
        tooltip: { y: { formatter: v => `${v}%` } }
      };
      const chart = new ApexCharts(elRate, options);
      chart.render();
    } else {
      // テキスト版
      elRate.innerHTML = `
        <ol style="font-size:0.9em;padding-left:1.2em;">
          ${top5.map(e => {
            const color = getSalesRateColor(e.rate);
            const style = color ? ` style="color:${color};"` : "";
            return `<li${style}>${e.label}：${e.rate}%（出荷${e.shipped}／売上${e.sold}）</li>`;
          }).join("")}
        </ol>
      `;
    }
  }

  /* ▼ 2) 日別ロス推移（週） */
  const elDaily = document.getElementById("weekDailyLossTrend");
  if (elDaily) {
    const xCats = days.map(ds => {
      const d = new Date(ds);
      const wd = d.getDay();
      const dd = d.getDate();
      if (wd === 0) return `${dd}(日)`;
      if (wd === 6) return `${dd}(土)`;
      return `${dd}`;
    });
    const yData = days.map(ds => dailyLossMap[ds] || 0);

    if (hasApex) {
      const options = {
        chart: { type: "line", height: 260 },
        series: [{ name: "ロス個数", data: yData }],
        xaxis: { categories: xCats },
        dataLabels: { enabled: true },
        stroke: { width: 3, curve: "smooth" },
        markers: {
          size: 6,
          colors: days.map(ds => {
            const wd = new Date(ds).getDay();
            if (wd === 0) return "#d32f2f"; // 日曜 赤
            if (wd === 6) return "#1976d2"; // 土曜 青
            return "#555555";               // 平日 グレー
          }),
          strokeColors: "#ffffff",
        },
        tooltip: {
          y: { formatter: v => `${v}個` }
        }
      };
      const chart = new ApexCharts(elDaily, options);
      chart.render();
    } else {
      elDaily.innerHTML = `
        <table class="simple-table">
          <tr><th>日付</th><th>ロス個数</th></tr>
          ${
            days.map(ds => {
              const d = new Date(ds);
              const label = `${ds} (${["日","月","火","水","木","金","土"][d.getDay()]})`;
              return `<tr><td>${label}</td><td>${dailyLossMap[ds] || 0}</td></tr>`;
            }).join("")
          }
        </table>
      `;
    }
  }

  /* ▼ 3) 品目×店舗 ロス率ランキング（上位5） */
  const elLossRank = document.getElementById("weekItemStoreLossRanking");
  if (elLossRank) {
    const rows = [];

    Object.keys(storeItemMap || {}).forEach(itemName => {
      const perStore = storeItemMap[itemName];
      Object.keys(perStore || {}).forEach(storeName => {
        const st = perStore[storeName];
        if (!st || !st.shippedQty) return;
        const rate = Math.round((st.lossQty / st.shippedQty) * 100);
        rows.push({
          item: getItemKey(itemName),
          store: formatStoreLabel(storeName),
          shipped: st.shippedQty,
          lossQty: st.lossQty,
          rate
        });
      });
    });

    if (!rows.length) {
      elLossRank.innerHTML = `<p style="font-size:0.85em;color:#666;">ロス率を計算できる組み合わせがありません。</p>`;
    } else {
      rows.sort((a,b) => b.rate - a.rate);
      const top5 = rows.slice(0,5);

      elLossRank.innerHTML = `
        <table class="simple-table">
          <tr>
            <th>順位</th>
            <th>店舗</th>
            <th>品目</th>
            <th>ロス個数</th>
            <th>ロス率</th>
          </tr>
          ${
            top5.map((r,idx) => {
              const color = getLossRateColor(r.rate);
              const style = color ? ` style="color:${color};font-weight:bold;"` : "";
              return `
                <tr>
                  <td>${idx+1}</td>
                  <td>${r.store}</td>
                  <td>${r.item}</td>
                  <td>${r.lossQty}</td>
                  <td${style}>${r.rate}%</td>
                </tr>`;
            }).join("")
          }
        </table>
      `;
    }
  }
}

/* =========================================================
   ▼ 月ビュー（週ビューと同じ構成：期間だけ1ヶ月）
========================================================= */

/* 月ビュー 初期セットアップ */
async function setupSummaryMonthView() {
  const ctrl = document.getElementById("summaryControlArea");
  if (!ctrl) return;

  const today = new Date();
  summaryMonthYear  = today.getFullYear();
  summaryMonthMonth = today.getMonth(); // 0-11

  ctrl.innerHTML = `
    <div class="summary-week-wrapper">
      <div class="summary-week-header">
        <button class="week-nav-btn" onclick="changeSummaryMonthView(-1)">＜</button>
        <div class="summary-week-month-label" id="summaryMonthLabel"></div>
        <button class="week-nav-btn" onclick="changeSummaryMonthView(1)">＞</button>
      </div>
    </div>
  `;

  await refreshSummaryMonthView();
}

/* 月ビュー：月移動 */
async function changeSummaryMonthView(offset) {
  summaryMonthMonth += offset;
  if (summaryMonthMonth < 0) {
    summaryMonthMonth = 11;
    summaryMonthYear--;
  }
  if (summaryMonthMonth > 11) {
    summaryMonthMonth = 0;
    summaryMonthYear++;
  }
  await refreshSummaryMonthView();
}

/* 月ビュー：ラベル更新＋集計読み込み */
async function refreshSummaryMonthView() {
  const labelEl = document.getElementById("summaryMonthLabel");
  if (labelEl) {
    labelEl.textContent = `${summaryMonthYear}年 ${summaryMonthMonth + 1}月`;
  }
  const ym = `${summaryMonthYear}-${String(summaryMonthMonth + 1).padStart(2, "0")}`;
  await loadMonthlySummary(ym);
}

/* 月集計データ取得 & 表示（週ビューと同じ構成） */
async function loadMonthlySummary(ym) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    // ① 月集計（品目別合計 & 日別）を取得
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryMonth=${ym}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `
        <div class="history-card summary-total" style="opacity:0.7;">
          <div class="history-title">
            <span>この月のデータはありません</span>
          </div>
          <div style="font-size:0.9em;color:#555;">
            月を切り替えて確認してください。
          </div>
        </div>
      `;
      return;
    }

    const total    = data.total || {};
    const itemsRaw = data.items || [];
    let days       = data.days || []; // "YYYY-MM-DD" 一覧

    // 品目を決まった順にソート
    const items = [...itemsRaw].sort((a, b) => {
      const ka = getItemKey(a.item);
      const kb = getItemKey(b.item);
      const ia = ITEM_ORDER.indexOf(ka);
      const ib = ITEM_ORDER.indexOf(kb);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    // ② 日別ロス合計（折れ線グラフ用）
    const dailyLossMap = {};
    items.forEach(it => {
      (it.daily || []).forEach(d => {
        const ds = d.date;
        const loss = d.lossQty || 0;
        dailyLossMap[ds] = (dailyLossMap[ds] || 0) + loss;
      });
    });

    // ▼ 未来日のデータは集計対象外にする
    const todayStr = formatDateYmd(new Date());
    days = days.filter(ds => ds <= todayStr);

    // ③ 各日について summaryDate を呼び出し、
    //    店舗別月合算（店舗×品目）と店舗別トータルを作る
    const dailyPromises = days.map(ds =>
      fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${ds}`)
        .then(r => r.json())
        .catch(() => null)
    );
    const dailySummaries = await Promise.all(dailyPromises);

    const storeItemMap = {}; // { itemName: { storeName: { shippedQty, soldQty, lossQty } } }
    const storeTotalMap = {}; // { storeName: { shippedQty, soldQty, lossQty } }

    dailySummaries.forEach(daily => {
      if (!daily || !daily.found || !daily.items) return;
      daily.items.forEach(it => {
        const itemName = it.item;
        (it.stores || []).forEach(s => {
          const storeName = s.name;
          const shipped = s.shippedQty || 0;
          const sold    = s.soldQty    || 0;
          const loss    = s.lossQty    || 0;

          if (!storeItemMap[itemName]) storeItemMap[itemName] = {};
          if (!storeItemMap[itemName][storeName]) {
            storeItemMap[itemName][storeName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
          }
          storeItemMap[itemName][storeName].shippedQty += shipped;
          storeItemMap[itemName][storeName].soldQty    += sold;
          storeItemMap[itemName][storeName].lossQty    += loss;

          if (!storeTotalMap[storeName]) {
            storeTotalMap[storeName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
          }
          storeTotalMap[storeName].shippedQty += shipped;
          storeTotalMap[storeName].soldQty    += sold;
          storeTotalMap[storeName].lossQty    += loss;
        });
      });
    });

    // 店舗別トータルの lossRate / salesRate を付与
    Object.keys(storeTotalMap).forEach(name => {
      const st = storeTotalMap[name];
      st.lossRate = st.shippedQty > 0
        ? Math.round((st.lossQty / st.shippedQty) * 100)
        : null;
      st.salesRate = st.shippedQty > 0
        ? Math.round((st.soldQty / st.shippedQty) * 100)
        : null;
    });

    // ④ AIコメント生成（月版）
    const aiCommentHtml = buildMonthlyAiComment(total, items, storeTotalMap, ym);

    const totalLossColor = getLossRateColor(total.lossRate);
    const totalLossStyle = totalLossColor ? ` style="color:${totalLossColor};"` : "";

    // ⑤ HTML構築
    const monthLabel = ym.replace(/-(\d{2})$/, "年 $1月");
    let html = `
      <h3>${monthLabel} の月集計</h3>
      ${aiCommentHtml}
    `;

    // ▼ 全体サマリーカード（🗓 月合計ロス）
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>🗓 月合計ロス</span>
          <span class="item-total-badge summary-badge"${totalLossStyle}>
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

    // ▼ 品目別カード（店舗別アコーディオン付き）※週ビューと同じ構成
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

      const lossColor = getLossRateColor(lossRate);
      const lossStyle = lossColor ? ` style="color:${lossColor};"` : "";

      const perStoreMap = storeItemMap[itemName] || {};
      let storeRows = Object.keys(perStoreMap).map(name => {
        const st = perStoreMap[name];
        const rate = st.shippedQty > 0
          ? Math.round((st.lossQty / st.shippedQty) * 100)
          : null;
        return {
          name,
          shippedQty: st.shippedQty,
          soldQty: st.soldQty,
          lossQty: st.lossQty,
          lossRate: rate
        };
      });

      // 店舗順序で並べ替え
      storeRows.sort((a, b) => {
        const ka = STORE_ORDER.indexOf(getStoreKey(a.name));
        const kb = STORE_ORDER.indexOf(getStoreKey(b.name));
        return (ka === -1 ? 999 : ka) - (kb === -1 ? 999 : kb);
      });

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}"${lossStyle}>
              ${
                lossRate === null
                  ? `ロス：${lossQty}個`
                  : `ロス：${lossQty}個（${lossRate}%）`
              }
            </span>
          </div>
          <div>出荷合計：${shippedQty}個 / 売上合計：${soldQty}個</div>
          ${
            storeRows.length
              ? renderStoreAccordion(storeRows)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">
                   店舗別内訳なし
                 </div>`
          }
        </div>
      `;
    });

    // ▼ 店舗別ロス情報（月合計）
    html += renderMonthlyStoreTotalSection(storeTotalMap);

    // ▼ 新分析エリア（月版）
    html += `
      <div class="analysis-wrapper">

        <div class="analysis-card">
          <h4>🏆 店舗別販売率ランキング（上位5店舗）</h4>
          <div id="monthStoreSalesRate"></div>
        </div>

        <div class="analysis-card">
          <h4>📉 日別ロス推移（月）</h4>
          <div id="monthDailyLossTrend"></div>
        </div>

        <div class="analysis-card">
          <h4>🔥 品目×店舗 ロス率ランキング（上位5件）</h4>
          <div id="monthItemStoreLossRanking"></div>
        </div>

        <div class="analysis-card">
          <h4>☀ 天候 × 売上 相関（岡山市）</h4>
          <div id="monthWeatherCorrelation">
            <p style="font-size:0.85em;color:#666;">
              ※ 天気データ取得（GAS 側）が整い次第、ここに散布図やコメントを表示します。
            </p>
          </div>
        </div>

        <div class="analysis-card">
          <h4>🤖 販売予測（AI提案）</h4>
          <div id="monthSalesForecast">
            <p style="font-size:0.85em;color:#666;">
              ※ AI による出荷数提案は、今後の拡張で追加予定です。
            </p>
          </div>
        </div>

      </div>
    `;

    resultDiv.innerHTML = html;

    // アコーディオンにイベント付与
    attachStoreAccordionEvents();

    // 分析3種描画（月版）
    renderMonthAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap);

  } catch (err) {
    resultDiv.innerHTML = `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>⚠ データ取得エラー</span>
        </div>
        <div style="font-size:0.9em;color:#555;">
          月集計の取得中にエラーが発生しました。<br>
          ネットワーク状況を確認して、もう一度お試しください。<br>
          <span style="font-size:0.8em;color:#999;">詳細: ${err}</span>
        </div>
      </div>
    `;
  }
}

/* 月ビュー：店舗別トータルセクション（月合計） */
function renderMonthlyStoreTotalSection(storeTotalMap) {
  const names = Object.keys(storeTotalMap);
  if (!names.length) return "";

  const rows = names.map(name => {
    const st = storeTotalMap[name];
    return {
      name,
      base: getStoreKey(name),
      shippedQty: st.shippedQty,
      soldQty: st.soldQty,
      lossQty: st.lossQty,
      lossRate: st.lossRate
    };
  });

  rows.sort((a, b) => {
    const ia = STORE_ORDER.indexOf(a.base);
    const ib = STORE_ORDER.indexOf(b.base);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  let html = `
    <div class="history-card summary-total" style="margin-top:16px;">
      <div class="history-title">
        <span>🏪 店舗別ロス状況（月合計）</span>
      </div>
      <div class="store-week-total-list">
  `;

  rows.forEach(r => {
    const label = formatStoreLabel(r.name);
    const color = getLossRateColor(r.lossRate);
    const style = color ? ` style="color:${color};"` : "";
    html += `
      <div class="store-week-total-row">
        <div class="store-week-total-name">${label}</div>
        <div class="store-week-total-body">
          出荷：${r.shippedQty}個 /
          売上：${r.soldQty}個 /
          ロス：
          <span${style}>
          ${
            r.lossRate === null
              ? `${r.lossQty}個`
              : `${r.lossQty}個（${r.lossRate}%）`
          }
          </span>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/* 月ビュー：AIコメント生成（月全体の振り返り） */
function buildMonthlyAiComment(total, items, storeTotalMap, ym) {
  const lossRate = total.lossRate;
  const lossQty  = total.lossQty || 0;

  // 表示用の「YYYY年MM月」
  let monthLabel = ym;
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    monthLabel = `${m[1]}年 ${parseInt(m[2], 10)}月`;
  }

  // 一番ロスが大きい品目
  let maxItem = null;
  items.forEach(it => {
    if (!maxItem || (it.lossQty || 0) > (maxItem.lossQty || 0)) {
      maxItem = it;
    }
  });

  // 一番ロス率が高い店舗
  let maxStore = null;
  Object.keys(storeTotalMap).forEach(name => {
    const st = storeTotalMap[name];
    if (typeof st.lossRate !== "number") return;
    if (!maxStore || st.lossRate > maxStore.lossRate) {
      maxStore = { name, ...st };
    }
  });

  const lines = [];

  // 全体所感（月版）
  if (lossRate === null) {
    lines.push(`${monthLabel}は、出荷と売上を比較できる日が十分に揃っていないため、ロス状況を厳密に評価するのが難しい月でした。今後、毎日の出荷登録と売上データを安定して蓄積することで、月ごとの傾向がよりはっきり見えてきます。`);
  } else if (lossRate <= 10) {
    lines.push(`${monthLabel}の全体ロス率は約${lossRate}%（${lossQty}個）で、月単位としてはかなり良好な水準です。この水準を維持できれば、年間を通してもロスをしっかりコントロールできていると言えそうです。`);
  } else if (lossRate <= 20) {
    lines.push(`${monthLabel}の全体ロス率は約${lossRate}%（${lossQty}個）で、ややロスが気になる水準です。特に売れ行きが読みにくい曜日や店舗では、出荷量を少し絞る・他店舗に振り分けるといった工夫が有効になりそうです。`);
  } else {
    lines.push(`${monthLabel}の全体ロス率は約${lossRate}%（${lossQty}個）と高めでした。週ごとの動きを振り返り、「どの週・どの店舗・どの品目」でロスが膨らみやすかったかを確認し、出荷量や配分のルールを見直すタイミングかもしれません。`);
  }

  // 品目のポイント
  if (maxItem && (maxItem.lossQty || 0) > 0) {
    const key = getItemKey(maxItem.item);
    lines.push(`品目別では「${key}」のロスが最も大きくなっています。月単位で見ると、特定の週にロスが集中している場合もあるため、その週だけ出荷量を抑える・販促を強めるなど、ピンポイントの対策が効果的です。`);
  }

  // 店舗のポイント
  if (maxStore && typeof maxStore.lossRate === "number") {
    const label = formatStoreLabel(maxStore.name);
    lines.push(`店舗別では「${label}」のロス率が相対的に高めです。この店舗は「売れ行きが弱い曜日」や「動きが鈍い品目」が偏っていないかを確認し、出荷量の見直しや他店舗との分担調整を検討してみてください。`);
  }

  // アクション提案（年間運用を意識したコメント）
  lines.push("月単位で見ると、出荷量の微調整だけでなく「どの月にどの品目をどれだけ強化するか」といった年間の出荷戦略も立てやすくなります。ロスが目立つ品目については、出荷ピークを作りすぎないように分散する・売れ行きの良い店舗へ重点的に回す、などの工夫が有効です。");

  return `
    <div class="ai-comment-card">
      <div class="ai-comment-title">🤖 今月のAIコメント</div>
      ${lines.map(t => `<p>${t}</p>`).join("")}
    </div>
  `;
}

/* 月ビュー：分析3種（月版） */
function renderMonthAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap) {
  const hasApex = (typeof ApexCharts !== "undefined");

  /* ▼ 1) 店舗別販売率ランキング（上位5） */
  const elRate = document.getElementById("monthStoreSalesRate");
  if (elRate) {
    const storeEntries = Object.keys(storeTotalMap).map(name => {
      const st = storeTotalMap[name];
      return {
        name,
        label: formatStoreLabel(name),
        shipped: st.shippedQty || 0,
        sold: st.soldQty || 0,
        rate: st.salesRate
      };
    }).filter(e => e.shipped > 0 && e.rate !== null);

    storeEntries.sort((a,b) => (b.rate || 0) - (a.rate || 0));
    const top5 = storeEntries.slice(0,5);

    if (top5.length === 0) {
      elRate.innerHTML = `<p style="font-size:0.85em;color:#666;">販売率を計算できる店舗がありません。</p>`;
    } else if (hasApex) {
      const labels = top5.map(e => e.label);
      const data   = top5.map(e => e.rate);

      const options = {
        chart: { type: "bar", height: 260 },
        series: [{ name: "販売率(%)", data }],
        xaxis: { categories: labels },
        dataLabels: {
          enabled: true,
          formatter: v => `${v}%`
        },
        plotOptions: {
          bar: { horizontal: true }
        },
        tooltip: { y: { formatter: v => `${v}%` } }
      };
      const chart = new ApexCharts(elRate, options);
      chart.render();
    } else {
      elRate.innerHTML = `
        <ol style="font-size:0.9em;padding-left:1.2em;">
          ${top5.map(e => {
            const color = getSalesRateColor(e.rate);
            const style = color ? ` style="color:${color};"` : "";
            return `<li${style}>${e.label}：${e.rate}%（出荷${e.shipped}／売上${e.sold}）</li>`;
          }).join("")}
        </ol>
      `;
    }
  }

  /* ▼ 2) 日別ロス推移（月） */
  const elDaily = document.getElementById("monthDailyLossTrend");
  if (elDaily) {
    const xCats = days.map(ds => ds.slice(5)); // "MM-DD"
    const yData = days.map(ds => dailyLossMap[ds] || 0);

    if (hasApex) {
      const options = {
        chart: { type: "line", height: 260 },
        series: [{ name: "ロス個数", data: yData }],
        xaxis: { categories: xCats },
        dataLabels: { enabled: true },
        stroke: { width: 3, curve: "smooth" },
        tooltip: { y: { formatter: v => `${v}個` } }
      };
      const chart = new ApexCharts(elDaily, options);
      chart.render();
    } else {
      elDaily.innerHTML = `
        <table class="simple-table">
          <tr><th>日付</th><th>ロス個数</th></tr>
          ${
            days.map(ds => `<tr><td>${ds}</td><td>${dailyLossMap[ds] || 0}</td></tr>`).join("")
          }
        </table>
      `;
    }
  }

  /* ▼ 3) 品目×店舗 ロス率ランキング（上位5） */
  const elLossRank = document.getElementById("monthItemStoreLossRanking");
  if (elLossRank) {
    const rows = [];

    Object.keys(storeItemMap || {}).forEach(itemName => {
      const perStore = storeItemMap[itemName];
      Object.keys(perStore || {}).forEach(storeName => {
        const st = perStore[storeName];
        if (!st || !st.shippedQty) return;
        const rate = Math.round((st.lossQty / st.shippedQty) * 100);
        rows.push({
          item: getItemKey(itemName),
          store: formatStoreLabel(storeName),
          shipped: st.shippedQty,
          lossQty: st.lossQty,
          rate
        });
      });
    });

    if (!rows.length) {
      elLossRank.innerHTML = `<p style="font-size:0.85em;color:#666;">ロス率を計算できる組み合わせがありません。</p>`;
    } else {
      rows.sort((a,b) => b.rate - a.rate);
      const top5 = rows.slice(0,5);

      elLossRank.innerHTML = `
        <table class="simple-table">
          <tr>
            <th>順位</th>
            <th>店舗</th>
            <th>品目</th>
            <th>ロス個数</th>
            <th>ロス率</th>
          </tr>
          ${
            top5.map((r,idx) => {
              const color = getLossRateColor(r.rate);
              const style = color ? ` style="color:${color};font-weight:bold;"` : "";
              return `
                <tr>
                  <td>${idx+1}</td>
                  <td>${r.store}</td>
                  <td>${r.item}</td>
                  <td>${r.lossQty}</td>
                  <td${style}>${r.rate}%</td>
                </tr>`;
            }).join("")
          }
        </table>
      `;
    }
  }
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
