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
let summaryWeeks = []; // [{ start:Date, end:Date, hasData:true/false }, ...]
let summarySelectedWeekIndex = 0;

/* ===== 月ビュー用 状態 ===== */
let summaryMonthYear;
let summaryMonthMonth;

/* ===== 店舗順序（週ビューの店舗別ロス用） ===== */
const STORE_ORDER = ["連島", "津高", "茶屋町", "大安寺", "中庄", "総社南", "円山", "児島"];

/* ===== 品目キー & カラー ===== */
/* 内部はすべて はくさい / はくさいカット / キャベツ / キャベツカット / とうもろこし に揃える */
const ITEM_ORDER = ["はくさい", "はくさいカット", "キャベツ", "キャベツカット", "とうもろこし"];
const ITEM_COLOR_MAP = {
  はくさい: "#B5E48C", // 黄緑
  はくさいカット: "#99D98C", // やや濃い黄緑
  キャベツ: "#52B788", // 緑
  キャベツカット: "#168AAD", // 青緑寄り
  とうもろこし: "#FFE66D", // 薄黄色
};

/* 品目名から正規のキーを取得（グラフ・並び順用） */
function getItemKey(name) {
  return normalizeItemName(name);
}

/* =========================================================
   品目表記統一（出荷・履歴・売上・集計すべて共通）
========================================================= */
function normalizeItemName(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  const lower = s.toLowerCase();

  // とうもろこし（表記ゆれ全部→ とうもろこし）
  if (
    /[とうトﾄ][う]?も?ろ?こし/.test(s) ||
    lower.includes("corn") ||
    s.includes("ｺｰﾝ") ||
    s.includes("コーン")
  ) {
    return "とうもろこし";
  }

  // はくさいカット
  if (s.includes("白菜カット") || s.includes("はくさいカット") || s.includes("ﾊｸｻｲ ｶｯﾄ")) {
    return "はくさいカット";
  }

  // はくさい（漢字／ひらがな／半角カナ → はくさい）
  if (s.includes("白菜") || s.includes("はくさい") || s.includes("ﾊｸｻｲ")) {
    return "はくさい";
  }

  // キャベツカット
  if (s.includes("キャベツカット") || s.includes("ｷｬﾍﾞﾂ ｶｯﾄ")) {
    return "キャベツカット";
  }

  // キャベツ
  if (s.includes("キャベツ") || s.includes("ｷｬﾍﾞﾂ")) {
    return "キャベツ";
  }

  return s;
}

/* 集計ビュー用：品目 → CSSクラス変換（ひらがな対応） */
function getItemClassForSummary(name) {
  const n = normalizeItemName(name);
  if (n === "はくさい" || n === "はくさいカット") return "hakusai";
  if (n === "キャベツ" || n === "キャベツカット") return "cabbage";
  if (n === "とうもろこし") return "corn";
  return "";
}

function normalizeStoreName(raw){
  if (!raw) return "";
  let s = String(raw);

  // 前後空白（全角含む）
  s = s.replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
  // 全角スペースを半角へ
  s = s.replace(/\u3000/g, " ");
  // タブ/改行除去
  s = s.replace(/[\t\r\n]/g, "");

  // ★ 最終形は「店なし」
  s = s.replace(/店$/, "");

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
  if (rate >= 50) return "#d32f2f"; // 赤：かなり高い
  if (rate >= 20) return "#f57c00"; // オレンジ：要注意
  return "#388e3c"; // 緑：良好〜許容
}

/* 販売率に応じた色（販売率高いほど良） */
function getSalesRateColor(rate) {
  if (rate === null || typeof rate === "undefined" || isNaN(rate)) return "";
  if (rate >= 80) return "#388e3c"; // 緑：優秀
  if (rate >= 50) return "#f57c00"; // オレンジ：改善余地
  return "#d32f2f"; // 赤：要改善
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
      <button onclick="changeSummaryView('day')" class="summary-tab ${
        currentSummaryView === "day" ? "active" : ""
      }">
        日
      </button>
      <button onclick="changeSummaryView('week')" class="summary-tab ${
        currentSummaryView === "week" ? "active" : ""
      }">
        週
      </button>
      <button onclick="changeSummaryView('month')" class="summary-tab ${
        currentSummaryView === "month" ? "active" : ""
      }">
        月
      </button>
      <button onclick="changeSummaryView('year')" class="summary-tab ${
        currentSummaryView === "year" ? "active" : ""
      }">
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

  const res = await fetch(`${SUMMARY_SCRIPT_URL}?checkSummaryMonth=${ym}`);
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
  summaryCalYear = now.getFullYear();
  summaryCalMonth = now.getMonth();

  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);
  document.getElementById("summaryCalendarArea").innerHTML = drawSummaryCalendar(
    summaryCalYear,
    summaryCalMonth,
    null,
    daysWithData
  );
  document.getElementById("summaryResult").innerHTML = `<p>日付を選択してください</p>`;
}

/* カレンダー描画（日ビュー用） */
function drawSummaryCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSummaryMonth(-1)">＜</button>
        <div><b>${year}年 ${month + 1}月</b></div>
        <button class="cal-btn" onclick="changeSummaryMonth(1)">＞</button>
      </div>
      <div class="calendar-grid">
        ${daysOfWeek.map((d) => `<div class="calendar-day">${d}</div>`).join("")}
      </div>
      <div class="calendar-grid">
  `;

  // 最初の空白
  for (let i = 0; i < first.getDay(); i++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2, "0");
    const day = new Date(year, month, d);
    const wd = day.getDay();

    const isToday =
      today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

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
      <div class="calendar-date ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${
      hasData ? "has-data" : ""
    }"
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
  document.getElementById("summaryCalendarArea").innerHTML = drawSummaryCalendar(
    summaryCalYear,
    summaryCalMonth,
    null,
    daysWithData
  );
  document.getElementById("summaryResult").innerHTML = `<p>日付を選択してください</p>`;
}

/* 日付クリック（日ビュー） */
async function selectSummaryDate(y, m, d) {
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const daysWithData = await getSummaryDaysWithData(y, m);
  document.getElementById("summaryCalendarArea").innerHTML = drawSummaryCalendar(
    y,
    m,
    new Date(y, m, d),
    daysWithData
  );
  loadDailySummary(dateStr);
}

/* ===== 日別ロスデータ取得 & 表示（元のまま） ===== */
async function loadDailySummary(dateStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の出荷または売上データがありません。</p>`;
      return;
    }

    const shipDate = data.shipDate; // 2日前の出荷日
    const total = data.total || {};
    const items = data.items || [];

    const totalLossColor = getLossRateColor(total.lossRate);
    const totalLossStyle = totalLossColor ? `style="color:${totalLossColor};"` : "";

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
          <span class="item-total-badge summary-badge" ${totalLossStyle}>
            ${
              total.lossRate === null
                ? "ロス率：ー"
                : `ロス率：${total.lossRate}%（${total.lossQty}個）`
            }
          </span>
        </div>
        <div>出荷：<b>${total.shippedQty || 0}個</b></div>
        <div>売上：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // ▼ 品目別カード
    items.forEach((it) => {
      const itemName = normalizeItemName(it.item);
      const shippedQty = it.shippedQty || 0;
      const soldQty = it.soldQty || 0;
      const lossQty = it.lossQty || 0;
      const lossRate = it.lossRate;

      const cls = getItemClassForSummary(itemName);
      const badgeCls =
        cls === "hakusai"
          ? "item-total-hakusai"
          : cls === "cabbage"
          ? "item-total-cabbage"
          : "item-total-corn";

      const lossColor = getLossRateColor(lossRate);
      const lossStyle = lossColor ? `style="color:${lossColor};"` : "";

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}" ${lossStyle}>
              ロス率：
              ${
                lossRate === null ? "ー" : `${lossRate}%（${lossQty}個）`
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
        ${stores
          .map((s) => {
            const color = getLossRateColor(s.lossRate);
            const style = color ? `style="color:${color};"` : "";
            return `
              <div class="store-accordion-row">
                <b>${formatStoreLabel(s.name)}</b><br>
                出荷：${s.shippedQty}個 / 売上：${s.soldQty}個 / ロス：
                <span ${style}>
                  ${
                    s.lossRate === null || typeof s.lossRate === "undefined"
                      ? `${s.lossQty}個`
                      : `${s.lossQty}個（${s.lossRate}%）`
                  }
                </span>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

/* 店舗別アコーディオン動作 */
function attachStoreAccordionEvents() {
  const toggles = document.querySelectorAll(".store-accordion-toggle");
  toggles.forEach((btn) => {
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
  summaryWeekYear = today.getFullYear();
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
      const endLabel = `${w.end.getMonth() + 1}/${w.end.getDate()}`;

      const hasDataClass = w.hasData ? "has-data" : "no-data";
      const activeClass = idx === summarySelectedWeekIndex ? "active" : "";

      return `
        <button class="week-pill ${hasDataClass} ${activeClass}" onclick="selectSummaryWeek(${idx})">
          <div class="week-pill-title">第${idx + 1}週</div>
          <div class="week-pill-range">${startLabel}〜${endLabel}</div>
          <div class="week-pill-dot-row">
            <span class="week-pill-dot"></span>
          </div>
        </button>
      `;
    })
    .join("");

  const weekStart = summaryWeeks[summarySelectedWeekIndex].start;
  const weekStartStr = formatDateYmd(weekStart);
  await loadWeeklySummary(weekStartStr);
}

/* 指定月の「月曜始まり」週を計算して配列にする（データ有無対応版） */
function buildWeeksForMonth(year, month, daysWithData) {
  const weeks = [];
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=日,1=月,...

  // 月曜始まり
  const diffToMonday = (firstDayOfWeek + 6) % 7;
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setDate(firstOfMonth.getDate() - diffToMonday);

  let current = new Date(firstMonday);

  for (let w = 0; w < 6; w++) {
    const start = new Date(current);
    const end = new Date(current);
    end.setDate(start.getDate() + 6);

    const overlapsMonth = start.getMonth() === month || end.getMonth() === month;
    if (!overlapsMonth && start.getMonth() > month && start.getFullYear() === year) break;

    // ▼ この週に1日でもデータがあるか？
    const hasData = [...Array(7).keys()].some((i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = formatDateYmd(d);
      return daysWithData.includes(ds.slice(8));
    });

    weeks.push({ start, end, hasData });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
}

/* 週チップ選択 */
async function selectSummaryWeek(index) {
  summarySelectedWeekIndex = index;
  await refreshSummaryWeekChips(); // 自分で再描画＋loadWeeklySummary 呼び出し
}

/* 週集計データ取得 & 表示（＋店舗別週合算・分析5種・AIコメント＋気象分析） */
async function loadWeeklySummary(weekStartStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    // ① 週集計（品目別合計 & 日別）を取得
    const res = await fetch(`${SUMMARY_SCRIPT_URL}?summaryWeek=${weekStartStr}`);
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
    const itemsRaw = data.items || [];
    let days = data.days || [];

    // ★ 品目名をすべて統一
    const dailySummaries = data.dailySummaries || [];
    itemsRaw.forEach((it) => (it.item = normalizeItemName(it.item)));
    dailySummaries.forEach((d) => d.items?.forEach((it) => (it.item = normalizeItemName(it.item))));

    // 品目を固定順（白菜→白菜カット→キャベツ→キャベツカット→トウモロコシ）にソート
    const items = [...itemsRaw].sort((a, b) => {
      const ka = getItemKey(a.item);
      const kb = getItemKey(b.item);
      const ia = ITEM_ORDER.indexOf(ka);
      const ib = ITEM_ORDER.indexOf(kb);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    // ② 日別ロス合計を dailySummaries から作成（fetch 廃止）
    const dailyLossMap = {};
    dailySummaries.forEach((d) => {
      if (!d || !d.found || !d.items) return;
      let dayLoss = 0;
      d.items.forEach((it) => {
        dayLoss += it.lossQty || 0;
      });
      dailyLossMap[d.summaryDate] = dayLoss;
    });

    // ③ 店舗別週合算（店舗×品目）と店舗別トータル＆気象データ
    const storeItemMap = {}; // { itemName: { storeName: { shippedQty, soldQty, lossQty } } }
    const storeTotalMap = {}; // { storeName: { shippedQty, soldQty, lossQty, lossRate, salesRate } }
    const weatherInfo = []; // [{ date, tempMax, tempMin, weather, itemごとの shipped/sold }, ...]

    dailySummaries.forEach((daily) => {
      if (!daily || !daily.found || !daily.items) return;

      // 店舗別集計
      daily.items.forEach((it) => {
        const itemName = it.item;

        (it.stores || []).forEach((s) => {
          const storeName = normalizeStoreName(s.name);
          const shipped = s.shippedQty || 0;
          const sold = s.soldQty || 0;
          const loss = s.lossQty || 0;

          if (!storeItemMap[itemName]) storeItemMap[itemName] = {};
          if (!storeItemMap[itemName][storeName]) {
            storeItemMap[itemName][storeName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
          }
          storeItemMap[itemName][storeName].shippedQty += shipped;
          storeItemMap[itemName][storeName].soldQty += sold;
          storeItemMap[itemName][storeName].lossQty += loss;

          if (!storeTotalMap[storeName]) {
            storeTotalMap[storeName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };
          }
          storeTotalMap[storeName].shippedQty += shipped;
          storeTotalMap[storeName].soldQty += sold;
          storeTotalMap[storeName].lossQty += loss;
        });
      });

      // 気象＋品目別販売率用
      const w = daily.weather || {};
      const dayObj = {
        date: daily.summaryDate,
        tempMax: w.tempMax ?? null,
        tempMin: w.tempMin ?? null,
        weather: w.type || "不明",
      };

      daily.items.forEach((it) => {
        const name = it.item;
        const shipped = it.shippedQty || 0;
        const sold = it.soldQty || 0;
        if (shipped === 0 && sold === 0) return;
        dayObj[name] = { shipped, sold };
      });

      weatherInfo.push(dayObj);
    });

    // 店舗別トータルの lossRate / salesRate を付与
    Object.keys(storeTotalMap).forEach((name) => {
      const st = storeTotalMap[name];
      st.lossRate = st.shippedQty > 0 ? Math.round((st.lossQty / st.shippedQty) * 100) : null;
      st.salesRate = st.shippedQty > 0 ? Math.round((st.soldQty / st.shippedQty) * 100) : null;
    });

    // ④ AIコメント（ロス観点）
    const aiCommentHtml = buildWeeklyAiComment(total, items, storeTotalMap);

    const totalLossColor = getLossRateColor(total.lossRate);
    const totalLossStyle = totalLossColor ? `style="color:${totalLossColor};"` : "";

    // ⑤ HTML構築
    const weekStart = days[0];
    const weekEnd = days[days.length - 1];

    let html = `
      <h3>${weekStart}〜${weekEnd} の週集計</h3>
      ${aiCommentHtml}
    `;

    // ▼ 全体サマリーカード
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📅 週合計ロス</span>
          <span class="item-total-badge summary-badge" ${totalLossStyle}>
            ${
              total.lossRate === null
                ? "ロス率：ー"
                : `ロス率：${total.lossRate}%（${total.lossQty}個）`
            }
          </span>
        </div>
        <div>出荷：<b>${total.shippedQty || 0}個</b></div>
        <div>売上：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // ▼ 品目別カード（店舗別アコーディオン付き）
    items.forEach((it) => {
      const itemName = it.item; // すでに normalize 済み
      const shippedQty = it.shippedQty || 0;
      const soldQty = it.soldQty || 0;
      const lossQty = it.lossQty || 0;
      const lossRate = shippedQty > 0 ? Math.round((lossQty / shippedQty) * 100) : null;

      const cls = getItemClassForSummary(itemName);
      const badgeCls =
        cls === "hakusai"
          ? "item-total-hakusai"
          : cls === "cabbage"
          ? "item-total-cabbage"
          : "item-total-corn";

      const lossColor = getLossRateColor(lossRate);
      const lossStyle = lossColor ? `style="color:${lossColor};"` : "";

      // 店舗別週合算（この品目のみ）
      const perStoreMap = storeItemMap[itemName] || {};
      let storeRows = Object.keys(perStoreMap).map((name) => {
        const st = perStoreMap[name];
        const rate = st.shippedQty > 0 ? Math.round((st.lossQty / st.shippedQty) * 100) : null;
        return {
          name,
          shippedQty: st.shippedQty,
          soldQty: st.soldQty,
          lossQty: st.lossQty,
          lossRate: rate,
        };
      });

      // 店舗順で並べ替え
      storeRows.sort((a, b) => {
        const ka = STORE_ORDER.indexOf(getStoreKey(a.name));
        const kb = STORE_ORDER.indexOf(getStoreKey(b.name));
        return (ka === -1 ? 999 : ka) - (kb === -1 ? 999 : kb);
      });

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}" ${lossStyle}>
              ${lossRate === null ? `ロス：${lossQty}個` : `ロス：${lossQty}個（${lossRate}%）`}
            </span>
          </div>
          <div>出荷合計：${shippedQty}個 / 売上合計：${soldQty}個</div>
          ${
            storeRows.length
              ? renderStoreAccordion(storeRows)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">店舗別内訳なし</div>`
          }
        </div>
      `;
    });

    // ▼ 店舗別ロス情報（週合計）
    html += renderWeeklyStoreTotalSection(storeTotalMap);

    // ▼ 既存の分析3種 + 気象分析 + 販売予測
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
          <h4>☀ 気温 × 売上 効果</h4>
          <div id="weekWeatherCorrelation"></div>
        </div>
        <div class="analysis-card">
          <h4>🤖 販売予測（AI提案）</h4>
          <div id="weekSalesForecast"></div>
        </div>
      </div>
    `;

    resultDiv.innerHTML = html;

    // アコーディオン
    attachStoreAccordionEvents();

    // 既存グラフ3種
    renderWeekAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap);

    // 気象ヒートマップ＋クロス表＋AIコメント
    renderWeekWeatherHeatmap(items, weatherInfo);
    renderWeekWeatherCrossTable(items, weatherInfo);
    renderWeekWeatherAI(items, weatherInfo);
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

  const rows = names.map((name) => {
    const st = storeTotalMap[name];
    return {
      name,
      base: getStoreKey(name),
      shippedQty: st.shippedQty,
      soldQty: st.soldQty,
      lossQty: st.lossQty,
      lossRate: st.lossRate,
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

  rows.forEach((r) => {
    const label = formatStoreLabel(r.name);
    const color = getLossRateColor(r.lossRate);
    const style = color ? `style="color:${color};"` : "";

    html += `
      <div class="store-week-total-row">
        <div class="store-week-total-name">${label}</div>
        <div class="store-week-total-body">
          出荷：${r.shippedQty}個 / 売上：${r.soldQty}個 / ロス：
          <span ${style}>
            ${r.lossRate === null ? `${r.lossQty}個` : `${r.lossQty}個（${r.lossRate}%）`}
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
  const lossQty = total.lossQty || 0;

  // 一番ロスが大きい品目
  let maxItem = null;
  items.forEach((it) => {
    if (!maxItem || (it.lossQty || 0) > (maxItem.lossQty || 0)) {
      maxItem = it;
    }
  });

  // 一番ロス率が高い店舗
  let maxStore = null;
  Object.keys(storeTotalMap).forEach((name) => {
    const st = storeTotalMap[name];
    if (typeof st.lossRate !== "number") return;
    if (!maxStore || st.lossRate > maxStore.lossRate) {
      maxStore = { name, ...st };
    }
  });

  const lines = [];

  // 全体所感
  if (lossRate === null) {
    lines.push(
      "今週は、出荷と売上を比較できる十分なデータが揃っていない日が含まれています。今後、出荷登録と売上データの両方が揃っている日を継続的に増やすことで、より安定した分析が可能になります。"
    );
  } else if (lossRate <= 10) {
    lines.push(
      `今週の全体ロス率は約${lossRate}%（${lossQty}個）で、比較的良好な水準です。この調子で「出荷量の精度」を維持できると、ロスはさらに安定して抑えられそうです。`
    );
  } else if (lossRate <= 20) {
    lines.push(
      `今週の全体ロス率は約${lossRate}%（${lossQty}個）で、ややロスが目立つ週でした。出荷量の微調整や、曜日ごとの売れ行きパターンを意識した出荷が有効になりそうです。`
    );
  } else {
    lines.push(
      `今週の全体ロス率は約${lossRate}%（${lossQty}個）と高めです。特に出荷量の見直しや、店舗別の売れ方に合わせた配分調整を検討する価値がありそうです。`
    );
  }

  // 品目のポイント
  if (maxItem && (maxItem.lossQty || 0) > 0) {
    const key = getItemKey(maxItem.item);
    lines.push(
      `品目別では「${key}」のロスが最も大きくなっています。出荷量を少しだけ絞る、もしくは他の動きが良い店舗へ振り分けるなど、週単位での配分調整を検討してみてください。`
    );
  }

  // 店舗のポイント
  if (maxStore && typeof maxStore.lossRate === "number") {
    const label = formatStoreLabel(maxStore.name);
    lines.push(
      `店舗別では「${label}」のロス率が相対的に高めです。出荷する品目や数量を1〜2割ほど抑えて様子を見る、他店舗との売れ行きの違いを確認する、といった対応が有効かもしれません。`
    );
  }

  // アクション提案（本社視点）
  lines.push(
    "本社側で調整できるのは「いつ・どの店舗に・どれだけ出荷するか」です。特にロスが目立つ品目については、①売れ行きが安定している店舗へ寄せる、②曜日ごとの売上傾向を意識して出荷日をずらす、といった工夫が効果的です。"
  );

  return `
    <div class="ai-comment-card">
      <div class="ai-comment-title">🤖 今週のAIコメント</div>
      ${lines.map((t) => `<p>${t}</p>`).join("")}
    </div>
  `;
}

/* 週ビュー：分析3種（販売率ランキング／日別ロス／ロス率ランキング） */
function renderWeekAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap) {
  // ApexCharts がなければ諦める（テキスト分析だけでもOK）
  const hasApex = typeof ApexCharts !== "undefined";

  /* ▼ 1) 店舗別販売率ランキング（上位5） */
  const elRate = document.getElementById("weekStoreSalesRate");
  if (elRate) {
    const storeEntries = Object.keys(storeTotalMap)
      .map((name) => {
        const st = storeTotalMap[name];
        return {
          name,
          label: formatStoreLabel(name),
          shipped: st.shippedQty || 0,
          sold: st.soldQty || 0,
          rate: st.salesRate,
        };
      })
      .filter((e) => e.shipped > 0 && e.rate !== null);

    storeEntries.sort((a, b) => (b.rate || 0) - (a.rate || 0));
    const top5 = storeEntries.slice(0, 5);

    if (top5.length === 0) {
      elRate.innerHTML = `<p style="font-size:0.85em;color:#666;">販売率を計算できる店舗がありません。</p>`;
    } else if (hasApex) {
      const labels = top5.map((e) => e.label);
      const data = top5.map((e) => e.rate);

      const options = {
        chart: { type: "bar", height: 260 },
        series: [{ name: "販売率(%)", data }],
        xaxis: { categories: labels },
        dataLabels: { enabled: true, formatter: (v) => `${v}%` },
        plotOptions: { bar: { horizontal: true } },
        tooltip: { y: { formatter: (v) => `${v}%` } },
      };

      const chart = new ApexCharts(elRate, options);
      chart.render();
    } else {
      // テキスト版
      elRate.innerHTML = `
        <ol style="font-size:0.9em;padding-left:1.2em;">
          ${top5
            .map((e) => {
              const color = getSalesRateColor(e.rate);
              const style = color ? `style="color:${color};"` : "";
              return `<li ${style}>${e.label}：${e.rate}%（出荷${e.shipped}／売上${e.sold}）</li>`;
            })
            .join("")}
        </ol>
      `;
    }
  }

  /* ▼ 2) 日別ロス推移（週） */
  const elDaily = document.getElementById("weekDailyLossTrend");
  if (elDaily) {
    const xCats = days.map((ds) => {
      const d = new Date(ds);
      const wd = d.getDay();
      const dd = d.getDate();
      if (wd === 0) return `${dd}(日)`;
      if (wd === 6) return `${dd}(土)`;
      return `${dd}`;
    });

    const yData = days.map((ds) => dailyLossMap[ds] || 0);

    if (hasApex) {
      const options = {
        chart: { type: "line", height: 260 },
        series: [{ name: "ロス個数", data: yData }],
        xaxis: { categories: xCats },
        dataLabels: { enabled: true },
        stroke: { width: 3, curve: "smooth" },
        markers: {
          size: 6,
          colors: days.map((ds) => {
            const wd = new Date(ds).getDay();
            if (wd === 0) return "#d32f2f"; // 日曜 赤
            if (wd === 6) return "#1976d2"; // 土曜 青
            return "#555555"; // 平日 グレー
          }),
          strokeColors: "#ffffff",
        },
        tooltip: { y: { formatter: (v) => `${v}個` } },
      };

      const chart = new ApexCharts(elDaily, options);
      chart.render();
    } else {
      elDaily.innerHTML = `
        <table class="simple-table">
          <tr><th>日付</th><th>ロス個数</th></tr>
          ${days
            .map((ds) => {
              const d = new Date(ds);
              const label = `${ds} (${["日", "月", "火", "水", "木", "金", "土"][d.getDay()]})`;
              return `<tr><td>${label}</td><td>${dailyLossMap[ds] || 0}</td></tr>`;
            })
            .join("")}
        </table>
      `;
    }
  }

  /* ▼ 3) 品目×店舗 ロス率ランキング（上位5） */
  const elLossRank = document.getElementById("weekItemStoreLossRanking");
  if (elLossRank) {
    const rows = [];

    Object.keys(storeItemMap || {}).forEach((itemName) => {
      const perStore = storeItemMap[itemName];
      Object.keys(perStore || {}).forEach((storeName) => {
        const st = perStore[storeName];
        if (!st || !st.shippedQty) return;
        const rate = Math.round((st.lossQty / st.shippedQty) * 100);
        rows.push({
          item: getItemKey(itemName),
          store: formatStoreLabel(storeName),
          shipped: st.shippedQty,
          lossQty: st.lossQty,
          rate,
        });
      });
    });

    if (!rows.length) {
      elLossRank.innerHTML = `<p style="font-size:0.85em;color:#666;">ロス率を計算できる組み合わせがありません。</p>`;
    } else {
      rows.sort((a, b) => b.rate - a.rate);
      const top5 = rows.slice(0, 5);

      elLossRank.innerHTML = `
        <table class="simple-table">
          <tr>
            <th>順位</th>
            <th>店舗</th>
            <th>品目</th>
            <th>ロス個数</th>
            <th>ロス率</th>
          </tr>
          ${top5
            .map((r, idx) => {
              const color = getLossRateColor(r.rate);
              const style = color ? `style="color:${color};font-weight:bold;"` : "";
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${r.store}</td>
                  <td>${r.item}</td>
                  <td>${r.lossQty}</td>
                  <td ${style}>${r.rate}%</td>
                </tr>
              `;
            })
            .join("")}
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
  summaryMonthYear = today.getFullYear();
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

/* 月集計データ取得 & 表示（週ビュー同等構成＋気象分析） */
async function loadMonthlySummary(ym) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SUMMARY_SCRIPT_URL}?summaryMonth=${ym}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `
        <div class="history-card summary-total" style="opacity:0.7;">
          <div class="history-title">この月のデータはありません</div>
          <div style="font-size:0.9em;color:#555;">月を切り替えて確認してください。</div>
        </div>
      `;
      return;
    }

    const total = data.total || {};
    const itemsRaw = data.items || [];
    let days = data.days || [];
    const dailyAll = data.dailySummaries || [];

    // ★ 日別集計（GAS側で計算済）
    // ★ 品目名統一
    itemsRaw.forEach((it) => (it.item = normalizeItemName(it.item)));
    dailyAll.forEach((d) => d.items?.forEach((it) => (it.item = normalizeItemName(it.item))));

    // 品目を固定順にソート
    const items = [...itemsRaw].sort((a, b) => {
      const ka = getItemKey(a.item);
      const kb = getItemKey(b.item);
      return ITEM_ORDER.indexOf(ka) - ITEM_ORDER.indexOf(kb);
    });

    // 未来日は除外（念のため）
    const todayStr = formatDateYmd(new Date());
    days = days.filter((ds) => ds <= todayStr);

    // ① 日別ロス合計（dailyAll から作成）
    const dailyLossMap = {};
    dailyAll.forEach((d) => {
      if (!d || !d.items) return;
      dailyLossMap[d.summaryDate] = d.items.reduce((sum, it) => sum + (it.lossQty || 0), 0);
    });

    // ② 店舗×品目と気象データ集約
    const storeItemMap = {};
    const storeTotalMap = {};
    const weatherInfo = [];

    dailyAll.forEach((d) => {
      if (!d || !d.items) return;

      d.items.forEach((it) => {
        const name = it.item;

        (it.stores || []).forEach((s) => {
          const stName = normalizeStoreName(s.name);
          const shipped = s.shippedQty || 0;
          const sold = s.soldQty || 0;
          const loss = s.lossQty || 0;

          if (!storeItemMap[name]) storeItemMap[name] = {};
          if (!storeItemMap[name][stName]) storeItemMap[name][stName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };

          storeItemMap[name][stName].shippedQty += shipped;
          storeItemMap[name][stName].soldQty += sold;
          storeItemMap[name][stName].lossQty += loss;

          if (!storeTotalMap[stName]) storeTotalMap[stName] = { shippedQty: 0, soldQty: 0, lossQty: 0 };

          storeTotalMap[stName].shippedQty += shipped;
          storeTotalMap[stName].soldQty += sold;
          storeTotalMap[stName].lossQty += loss;
        });
      });

      // 気象データ
      const w = d.weather || {};
      const obj = {
        date: d.summaryDate,
        tempMax: w.tempMax ?? null,
        tempMin: w.tempMin ?? null,
        weather: w.type || "不明",
      };

      d.items.forEach((it) => {
        if ((it.shippedQty || 0) + (it.soldQty || 0) === 0) return;
        obj[it.item] = { shipped: it.shippedQty || 0, sold: it.soldQty || 0 };
      });

      weatherInfo.push(obj);
    });

    // 店舗別率
    Object.keys(storeTotalMap).forEach((k) => {
      const s = storeTotalMap[k];
      s.lossRate = s.shippedQty > 0 ? Math.round((s.lossQty / s.shippedQty) * 100) : null;
      s.salesRate = s.shippedQty > 0 ? Math.round((s.soldQty / s.shippedQty) * 100) : null;
    });

    // UI 描画
    const monthLabel = ym.replace(/-(\d{2})$/, "年 $1月");
    let html = `
      <h3>${monthLabel} の月集計</h3>
      ${buildMonthlyAiComment(total, items, storeTotalMap, ym)}
    `;

    // 全体サマリー
    const tlColor = getLossRateColor(total.lossRate);
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>🗓 月合計ロス</span>
          <span class="item-total-badge summary-badge" style="color:${tlColor};">
            ロス率：${total.lossRate ?? "ー"}%（${total.lossQty || 0}個）
          </span>
        </div>
        <div>出荷：<b>${total.shippedQty || 0}個</b></div>
        <div>売上：<b>${total.soldQty || 0}個</b></div>
      </div>
    `;

    // 品目別カード（週ビューと同じ）
    items.forEach((it) => {
      const itemName = it.item;
      const shipped = it.shippedQty || 0;
      const sold = it.soldQty || 0;
      const loss = it.lossQty || 0;
      const lossRate = shipped > 0 ? Math.round((loss / shipped) * 100) : null;

      const cls = getItemClassForSummary(itemName);
      const badge =
        cls === "hakusai"
          ? "item-total-hakusai"
          : cls === "cabbage"
          ? "item-total-cabbage"
          : "item-total-corn";

      const per = storeItemMap[itemName] || {};
      const rows = Object.keys(per)
        .map((st) => ({
          name: st,
          shippedQty: per[st].shippedQty,
          soldQty: per[st].soldQty,
          lossQty: per[st].lossQty,
          lossRate: per[st].shippedQty > 0 ? Math.round((per[st].lossQty / per[st].shippedQty) * 100) : null,
        }))
        .sort((a, b) => {
          return STORE_ORDER.indexOf(getStoreKey(a.name)) - STORE_ORDER.indexOf(getStoreKey(b.name));
        });

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badge}">
              ロス：${loss}個（${lossRate ?? "ー"}%）
            </span>
          </div>
          <div>出荷合計：${shipped}個 / 売上合計：${sold}個</div>
          ${
            rows.length
              ? renderStoreAccordion(rows)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">内訳なし</div>`
          }
        </div>
      `;
    });

    html += renderMonthlyStoreTotalSection(storeTotalMap);

    // 分析 UI
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
          <h4>☀ 気温 × 売上 効果（ヒートマップ）</h4>
          <div id="monthWeatherHeatmap"></div>
        </div>
        <div class="analysis-card">
          <h4>🌡 シーン別（寒い/普通/暑い）売上傾向</h4>
          <div id="monthWeatherCrossTable"></div>
        </div>
        <div class="analysis-card">
          <h4>🧠 気象分析コメント</h4>
          <div id="monthWeatherAI"></div>
        </div>
        <div class="analysis-card">
          <h4>🤖 販売予測（AI提案）</h4>
          <div id="monthSalesForecast"></div>
        </div>
      </div>
    `;

    resultDiv.innerHTML = html;
    attachStoreAccordionEvents();

    // （旧）月分析グラフ描画
    setTimeout(() => {
      renderMonthAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap);
      renderMonthWeatherHeatmap(items, weatherInfo);
      renderMonthWeatherCrossTable(items, weatherInfo);
      renderMonthWeatherAI(items, weatherInfo);
    }, 100);
  } catch (err) {
    resultDiv.innerHTML = `<p>月ビュー取得エラー：${err}</p>`;
  }
}

/* 月ビュー：店舗別トータルセクション（月合計） */
function renderMonthlyStoreTotalSection(storeTotalMap) {
  const names = Object.keys(storeTotalMap);
  if (!names.length) return "";

  const rows = names.map((name) => {
    const st = storeTotalMap[name];
    return {
      name,
      base: getStoreKey(name),
      shippedQty: st.shippedQty,
      soldQty: st.soldQty,
      lossQty: st.lossQty,
      lossRate: st.lossRate,
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

  rows.forEach((r) => {
    const label = formatStoreLabel(r.name);
    const color = getLossRateColor(r.lossRate);
    const style = color ? `style="color:${color};"` : "";

    html += `
      <div class="store-week-total-row">
        <div class="store-week-total-name">${label}</div>
        <div class="store-week-total-body">
          出荷：${r.shippedQty}個 / 売上：${r.soldQty}個 / ロス：
          <span ${style}>
            ${r.lossRate === null ? `${r.lossQty}個` : `${r.lossQty}個（${r.lossRate}%）`}
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
  const lossQty = total.lossQty || 0;

  // 表示用の「YYYY年MM月」
  let monthLabel = ym;
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    monthLabel = `${m[1]}年 ${parseInt(m[2], 10)}月`;
  }

  // 一番ロスが大きい品目
  let maxItem = null;
  items.forEach((it) => {
    if (!maxItem || (it.lossQty || 0) > (maxItem.lossQty || 0)) {
      maxItem = it;
    }
  });

  // 一番ロス率が高い店舗
  let maxStore = null;
  Object.keys(storeTotalMap).forEach((name) => {
    const st = storeTotalMap[name];
    if (typeof st.lossRate !== "number") return;
    if (!maxStore || st.lossRate > maxStore.lossRate) {
      maxStore = { name, ...st };
    }
  });

  const lines = [];

  // 全体所感（月版）
  if (lossRate === null) {
    lines.push(
      `${monthLabel}は、出荷と売上を比較できる日が十分に揃っていないため、ロス状況を厳密に評価するのが難しい月でした。今後、毎日の出荷登録と売上データを安定して蓄積することで、月ごとの傾向がよりはっきり見えてきます。`
    );
  } else if (lossRate <= 10) {
    lines.push(
      `${monthLabel}の全体ロス率は約${lossRate}%（${lossQty}個）で、月単位としてはかなり良好な水準です。この水準を維持できれば、年間を通してもロスをしっかりコントロールできていると言えそうです。`
    );
  } else if (lossRate <= 20) {
    lines.push(
      `${monthLabel}の全体ロス率は約${lossRate}%（${lossQty}個）で、ややロスが気になる水準です。特に売れ行きが読みにくい曜日や店舗では、出荷量を少し絞る・他店舗に振り分けるといった工夫が有効になりそうです。`
    );
  } else {
    lines.push(
      `${monthLabel}の全体ロス率は約${lossRate}%（${lossQty}個）と高めでした。週ごとの動きを振り返り、「どの週・どの店舗・どの品目」でロスが膨らみやすかったかを確認し、出荷量や配分のルールを見直すタイミングかもしれません。`
    );
  }

  // 品目のポイント
  if (maxItem && (maxItem.lossQty || 0) > 0) {
    const key = getItemKey(maxItem.item);
    lines.push(
      `品目別では「${key}」のロスが最も大きくなっています。月単位で見ると、特定の週にロスが集中している場合もあるため、その週だけ出荷量を抑える・販促を強めるなど、ピンポイントの対策が効果的です。`
    );
  }

  // 店舗のポイント
  if (maxStore && typeof maxStore.lossRate === "number") {
    const label = formatStoreLabel(maxStore.name);
    lines.push(
      `店舗別では「${label}」のロス率が相対的に高めです。この店舗は「売れ行きが弱い曜日」や「動きが鈍い品目」が偏っていないかを確認し、出荷量の見直しや他店舗との分担調整を検討してみてください。`
    );
  }

  // アクション提案（年間運用を意識したコメント）
  lines.push(
    "月単位で見ると、出荷量の微調整だけでなく「どの月にどの品目をどれだけ強化するか」といった年間の出荷戦略も立てやすくなります。ロスが目立つ品目については、出荷ピークを作りすぎないように分散する・売れ行きの良い店舗へ重点的に回す、などの工夫が有効です。"
  );

  return `
    <div class="ai-comment-card">
      <div class="ai-comment-title">🤖 今月のAIコメント</div>
      ${lines.map((t) => `<p>${t}</p>`).join("")}
    </div>
  `;
}

/* 月ビュー：分析3種（月版） */
function renderMonthAnalysisCharts(items, days, dailyLossMap, storeTotalMap, storeItemMap) {
  const hasApex = typeof ApexCharts !== "undefined";

  /* ▼ 1) 店舗別販売率ランキング（上位5） */
  const elRate = document.getElementById("monthStoreSalesRate");
  if (elRate) {
    const storeEntries = Object.keys(storeTotalMap)
      .map((name) => {
        const st = storeTotalMap[name];
        return {
          name,
          label: formatStoreLabel(name),
          shipped: st.shippedQty || 0,
          sold: st.soldQty || 0,
          rate: st.salesRate,
        };
      })
      .filter((e) => e.shipped > 0 && e.rate !== null);

    storeEntries.sort((a, b) => (b.rate || 0) - (a.rate || 0));
    const top5 = storeEntries.slice(0, 5);

    if (top5.length === 0) {
      elRate.innerHTML = `<p style="font-size:0.85em;color:#666;">販売率を計算できる店舗がありません。</p>`;
    } else if (hasApex) {
      const labels = top5.map((e) => e.label);
      const data = top5.map((e) => e.rate);

      const options = {
        chart: { type: "bar", height: 260 },
        series: [{ name: "販売率(%)", data }],
        xaxis: { categories: labels },
        dataLabels: { enabled: true, formatter: (v) => `${v}%` },
        plotOptions: { bar: { horizontal: true } },
        tooltip: { y: { formatter: (v) => `${v}%` } },
      };

      const chart = new ApexCharts(elRate, options);
      chart.render();
    } else {
      elRate.innerHTML = `
        <ol style="font-size:0.9em;padding-left:1.2em;">
          ${top5
            .map((e) => {
              const color = getSalesRateColor(e.rate);
              const style = color ? `style="color:${color};"` : "";
              return `<li ${style}>${e.label}：${e.rate}%（出荷${e.shipped}／売上${e.sold}）</li>`;
            })
            .join("")}
        </ol>
      `;
    }
  }

  /* ▼ 2) 日別ロス推移（月） */
  const elDaily = document.getElementById("monthDailyLossTrend");
  if (elDaily) {
    const xCats = days.map((ds) => {
      const d = new Date(ds);
      const wd = d.getDay();
      const dd = ds.slice(5); // "MM-DD"
      if (wd === 0) return `${dd}(日)`;
      if (wd === 6) return `${dd}(土)`;
      return dd;
    });

    const yData = days.map((ds) => dailyLossMap[ds] || 0);

    if (hasApex) {
      const options = {
        chart: { type: "line", height: 260 },
        series: [{ name: "ロス個数", data: yData }],
        xaxis: { categories: xCats },
        dataLabels: { enabled: true },
        stroke: { width: 3, curve: "smooth" },
        markers: {
          size: 6,
          colors: days.map((ds) => {
            const wd = new Date(ds).getDay();
            if (wd === 0) return "#d32f2f"; // 日曜 赤
            if (wd === 6) return "#1976d2"; // 土曜 青
            return "#555555"; // 平日
          }),
          strokeColors: "#ffffff",
        },
        tooltip: { y: { formatter: (v) => `${v}個` } },
      };

      const chart = new ApexCharts(elDaily, options);
      chart.render();
    } else {
      elDaily.innerHTML = `
        <table class="simple-table">
          <tr><th>日付</th><th>ロス個数</th></tr>
          ${days.map((ds) => `<tr><td>${ds}</td><td>${dailyLossMap[ds] || 0}</td></tr>`).join("")}
        </table>
      `;
    }
  }

  /* ▼ 3) 品目×店舗 ロス率ランキング（上位5） */
  const elLossRank = document.getElementById("monthItemStoreLossRanking");
  if (elLossRank) {
    const rows = [];

    Object.keys(storeItemMap || {}).forEach((itemName) => {
      const perStore = storeItemMap[itemName];
      Object.keys(perStore || {}).forEach((storeName) => {
        const st = perStore[storeName];
        if (!st || !st.shippedQty) return;
        const rate = Math.round((st.lossQty / st.shippedQty) * 100);
        rows.push({
          item: getItemKey(itemName),
          store: formatStoreLabel(storeName),
          shipped: st.shippedQty,
          lossQty: st.lossQty,
          rate,
        });
      });
    });

    if (!rows.length) {
      elLossRank.innerHTML = `<p style="font-size:0.85em;color:#666;">ロス率を計算できる組み合わせがありません。</p>`;
    } else {
      rows.sort((a, b) => b.rate - a.rate);
      const top5 = rows.slice(0, 5);

      elLossRank.innerHTML = `
        <table class="simple-table">
          <tr>
            <th>順位</th>
            <th>店舗</th>
            <th>品目</th>
            <th>ロス個数</th>
            <th>ロス率</th>
          </tr>
          ${top5
            .map((r, idx) => {
              const color = getLossRateColor(r.rate);
              const style = color ? `style="color:${color};font-weight:bold;"` : "";
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${r.store}</td>
                  <td>${r.item}</td>
                  <td>${r.lossQty}</td>
                  <td ${style}>${r.rate}%</td>
                </tr>
              `;
            })
            .join("")}
        </table>
      `;
    }
  }
}

/* =========================================================
   Util
========================================================= */

/* =========================================================
   ▼ 気象データ処理共通
========================================================= */
function classifyTemp(temp, cold, hot) {
  if (temp <= cold) return "cold"; // 寒い
  if (temp >= hot) return "hot"; // 暑い
  return "mid"; // 普通
}
function calcEffectArrow(v) {
  if (v > 5) return "↑";
  if (v < -5) return "↓";
  return "→";
}
function calcEffectColor(v) {
  if (v > 5) return "#2e7d32"; // 緑（売れる）
  if (v < -5) return "#c62828"; // 赤（売れない）
  return "#616161"; // グレー（中立）
}

/* =========================================================
   ▼ 週ビュー：気温ヒートマップ + クロス表 + AIコメント
========================================================= */
async function renderWeekWeatherAnalysis(days, items) {
  const area = document.getElementById("weekWeatherCorrelation");
  if (!area) return;

  const weatherRes = await fetch(`${SUMMARY_SCRIPT_URL}?weather=${days.join(",")}`);
  const weather = await weatherRes.json();

  if (!weather.success || !weather.data.length) {
    area.innerHTML = `<p>※気象データがありません</p>`;
    return;
  }

  const temps = weather.data
    .map((w) => w.tempMax)
    .filter((v) => v != null)
    .sort((a, b) => a - b);

  const cold = temps[Math.floor(temps.length * 0.33)];
  const hot = temps[Math.floor(temps.length * 0.66)];

  area.innerHTML = `
    <h5>🌡 気温帯別ヒートマップ</h5>
    <table class="simple-table">
      <tr><th>品目</th><th>寒い</th><th>普通</th><th>暑い</th></tr>
      ${items
        .map((it) => {
          const key = getItemKey(it.item);
          const eff = { cold: [], mid: [], hot: [] };

          weather.data.forEach((w) => {
            const v = w.sales[key];
            if (!v || v.shipped === 0) return;
            const r = Math.round((v.sold / v.shipped - it.soldQty / it.shippedQty) * 100);
            const c = classifyTemp(w.tempMax, cold, hot);
            eff[c].push(r);
          });

          function avg(a) {
            return a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
          }

          const C = avg(eff.cold);
          const M = avg(eff.mid);
          const H = avg(eff.hot);

          return `
            <tr>
              <td>${key}</td>
              <td style="color:${calcEffectColor(C)};">${calcEffectArrow(C)} ${C}%</td>
              <td style="color:${calcEffectColor(M)};">${calcEffectArrow(M)} ${M}%</td>
              <td style="color:${calcEffectColor(H)};">${calcEffectArrow(H)} ${H}%</td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;

  // 天候×気温帯クロス比較表
  area.innerHTML += `
    <h5 style="margin-top:12px;">⛅ 天候 × 気温帯 効果量比較</h5>
    <table class="simple-table">
      <tr><th>天候</th><th>寒い</th><th>普通</th><th>暑い</th></tr>
      ${Object.entries(weather.group)
        .map(([w, g]) => {
          function fmt(x) {
            return x.count ? `${Math.round((x.sum / x.count) * 100)}%` : "ー";
          }
          return `
            <tr>
              <td>${w}</td>
              <td>${fmt(g.cold)}</td>
              <td>${fmt(g.mid)}</td>
              <td>${fmt(g.hot)}</td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;

  // AIコメント
  const msg = [];
  items.forEach((it) => {
    const key = getItemKey(it.item);
    const diff = weather.effect[key] || 0;
    if (diff > 8) msg.push(`${key}は暖かいと売れやすい傾向です🔥`);
    if (diff < -8) msg.push(`${key}は冷えると売れやすい傾向です❄`);
  });
  if (!msg.length) msg.push("気温との明確な傾向はまだ少ないです。");

  document.getElementById("weekSalesForecast").innerHTML = `
    <div class="ai-comment-card">
      ${msg.map((m) => `<p>${m}</p>`).join("")}
    </div>
  `;
}

/* =========================================================
   ▼ 月ビュー：同じ仕様
========================================================= */
async function renderMonthWeatherAnalysis(days, items) {
  const area = document.getElementById("monthWeatherCorrelation");
  if (!area) return;

  const weatherRes = await fetch(`${SUMMARY_SCRIPT_URL}?weather=${days.join(",")}`);
  const weather = await weatherRes.json();

  if (!weather.success || !weather.data.length) {
    area.innerHTML = `<p>※気象データがありません</p>`;
    return;
  }

  // 同処理（週ビューと共通で呼び回し可）
  await renderWeekWeatherAnalysis(days, items);
}

function formatDateYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* =============================================
   ▼ 気温ヒートマップ表示（週）
============================================= */
function renderWeekWeatherHeatmap(items, weatherInfo) {
  const el = document.getElementById("weekWeatherCorrelation");
  if (!el) return;

  if (!weatherInfo || weatherInfo.length === 0) {
    el.innerHTML += `<p>気象データが不足しています。</p>`;
    return;
  }

  const temps = weatherInfo.map((w) => w.tempMax).filter((v) => v !== null);
  if (!temps.length) return;

  // 中央値で３分割（冷/普/暑）
  temps.sort((a, b) => a - b);
  const n = temps.length;
  const tCold = temps[Math.floor(n * 0.33)];
  const tHot = temps[Math.floor(n * 0.66)];

  // 商品ごとの差（販売率差）
  const rows = items.map((it) => {
    const item = it.item;
    const baseRate = it.shippedQty > 0 ? it.soldQty / it.shippedQty : 0;

    const effect = { cold: 0, mid: 0, hot: 0, cN: 0, mN: 0, hN: 0 };

    weatherInfo.forEach((w) => {
      const daily = w[item] || null;
      if (!daily) return;
      if (!daily.shipped) return;

      const r = daily.sold / daily.shipped - baseRate;

      if (w.tempMax <= tCold) {
        effect.cold += r;
        effect.cN++;
      } else if (w.tempMax >= tHot) {
        effect.hot += r;
        effect.hN++;
      } else {
        effect.mid += r;
        effect.mN++;
      }
    });

    function avg(v, c) {
      return c > 0 ? Math.round((v / c) * 100) : 0;
    }

    return {
      item,
      cold: avg(effect.cold, effect.cN),
      mid: avg(effect.mid, effect.mN),
      hot: avg(effect.hot, effect.hN),
    };
  });

  const cell = (v) => {
    let arrow = "→";
    if (v > 5) arrow = "↑";
    if (v < -5) arrow = "↓";

    const perc = v > 0 ? `+${v}%` : `${v}%`;

    const red = Math.min(255, Math.max(0, 128 + v * 3));
    const blue = Math.min(255, Math.max(0, 128 - v * 3));
    const bg = `rgb(${red},${Math.max(200 - blue, 0)},${blue})`;

    return `
      <td style="background:${bg};color:#000;font-weight:600">
        ${arrow} ${perc}
      </td>
    `;
  };

  el.innerHTML += `
    <h5 style="margin-top:12px;">🌡 気温帯別 効果量ヒートマップ</h5>
    <table class="simple-table">
      <tr><th>品目</th><th>寒い</th><th>普通</th><th>暑い</th></tr>
      ${rows
        .map((r) => {
          return `
            <tr>
              <td>${r.item}</td>
              ${cell(r.cold)}
              ${cell(r.mid)}
              ${cell(r.hot)}
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
}

/* =============================================
   ▼ 天候×気温帯のクロス比較（週）
============================================= */
function renderWeekWeatherCrossTable(items, weatherInfo) {
  const el = document.getElementById("weekWeatherCorrelation");
  if (!el) return;
  if (!weatherInfo || !weatherInfo.length) return;

  const temps = weatherInfo.map((w) => w.tempMax).filter((v) => v !== null);
  temps.sort((a, b) => a - b);
  const n = temps.length;
  const tCold = temps[Math.floor(n * 0.33)];
  const tHot = temps[Math.floor(n * 0.66)];

  const groups = {}; // {weather:{cold:{sum,cnt},mid:{},hot:{}}}

  weatherInfo.forEach((w) => {
    const wt = w.weather;
    if (!groups[wt]) groups[wt] = { cold: { sum: 0, cnt: 0 }, mid: { sum: 0, cnt: 0 }, hot: { sum: 0, cnt: 0 } };

    items.forEach((it) => {
      const v = w[it.item];
      if (!v || !v.shipped) return;

      const r = v.sold / v.shipped;

      if (w.tempMax <= tCold) {
        groups[wt].cold.sum += r;
        groups[wt].cold.cnt++;
      } else if (w.tempMax >= tHot) {
        groups[wt].hot.sum += r;
        groups[wt].hot.cnt++;
      } else {
        groups[wt].mid.sum += r;
        groups[wt].mid.cnt++;
      }
    });
  });

  const avg = (x) => (x.cnt ? Math.round((x.sum / x.cnt) * 100) : 0);
  const wKeys = Object.keys(groups);

  let html = `
    <h5 style="margin-top:12px;">⛅ 天候 × 気温帯 効果量</h5>
    <table class="simple-table">
      <tr><th>天候</th><th>寒い</th><th>普通</th><th>暑い</th></tr>
  `;

  wKeys.forEach((wt) => {
    const g = groups[wt];
    html += `
      <tr>
        <td>${wt}</td>
        <td>${avg(g.cold)}%</td>
        <td>${avg(g.mid)}%</td>
        <td>${avg(g.hot)}%</td>
      </tr>
    `;
  });

  html += `</table>`;
  el.innerHTML += html;
}

/* =============================================
   ▼ AIコメント（週）気象観点 ＋ 販売予測（過去10日）
============================================= */
function renderWeekWeatherAI(items, weatherInfo, overrideEl) {
  console.log("🔥週AI呼ばれた", items, weatherInfo);

  const area = overrideEl || document.getElementById("weekSalesForecast");
  if (!area) return;

  if (!weatherInfo || !weatherInfo.length) {
    area.innerHTML = `
      <div class="ai-comment-card">
        <p>気象データが不足しているため、この週の気象分析と販売予測は作成できません。</p>
      </div>
    `;
    return;
  }

  // ---- 直近10日分に絞り込む ----
  const parsed = weatherInfo
    .filter((w) => w.date && w.tempMax != null)
    .map((w) => ({ ...w, _d: new Date(w.date) }));

  if (!parsed.length) {
    area.innerHTML = `
      <div class="ai-comment-card">
        <p>気象データが不足しているため、この週の気象分析と販売予測は作成できません。</p>
      </div>
    `;
    return;
  }

  const maxTime = Math.max(...parsed.map((w) => w._d.getTime()));
  const endDate = new Date(maxTime);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 9); // 直近10日間（end を含めて10日）

  const target = parsed.filter((w) => w._d >= startDate && w._d <= endDate);

  if (!target.length) {
    area.innerHTML = `
      <div class="ai-comment-card">
        <p>直近10日間に気象データがほとんどないため、この週の分析は行えません。</p>
      </div>
    `;
    return;
  }

  const temps = target.map((w) => w.tempMax).filter((v) => v != null);
  if (!temps.length) {
    area.innerHTML = `
      <div class="ai-comment-card">
        <p>最高気温データが取得できなかったため、この週の気象分析と販売予測は作成できません。</p>
      </div>
    `;
    return;
  }

  const tAvg = temps.reduce((a, b) => a + b, 0) / temps.length;

  const analysisLines = [];
  const forecastLines = [];

  items.forEach((it) => {
    const itemName = it.item;

    // 対象期間内の販売率を「暑い日」「寒い日」に分けて集計
    let hotSum = 0,
      hotN = 0;
    let coldSum = 0,
      coldN = 0;

    target.forEach((w) => {
      const rec = w[itemName];
      if (!rec || !rec.shipped) return;

      const rate = (rec.sold / rec.shipped) * 100; // 販売率[%]
      if (w.tempMax >= tAvg) {
        hotSum += rate;
        hotN++;
      } else {
        coldSum += rate;
        coldN++;
      }
    });

    if (hotN + coldN < 3) {
      // 日数が少なすぎる品目はコメント出さない（サイレントスキップ）
      return;
    }

    const hotAvg = hotN ? Math.round(hotSum / hotN) : null;
    const coldAvg = coldN ? Math.round(coldSum / coldN) : null;

    if (hotAvg == null || coldAvg == null) return;

    const diff = hotAvg - coldAvg; // 正なら「暑い日＞寒い日」

    // 解析コメント（気象分析）
    if (Math.abs(diff) >= 5) {
      const dir = diff > 0 ? "気温が高い日" : "気温が低い日";
      const sign = diff > 0 ? `+${diff}` : `${diff}`;

      analysisLines.push(
        `・${itemName}は直近10日間では、${dir}における販売率が平均より約${sign}% 高い傾向があります（高温日${hotN}日／低温日${coldN}日ベース）。`
      );

      // 販売予測（出荷量調整提案）
      const absDiff = Math.abs(diff);
      let up = 0,
        down = 0;

      if (absDiff >= 20) {
        up = 15;
        down = 10;
      } else if (absDiff >= 12) {
        up = 10;
        down = 5;
      } else {
        up = 5;
        down = 3;
      }

      if (diff > 0) {
        // 暑い日に強い
        forecastLines.push(
          `・${itemName}は気温が高めに推移する日には、通常出荷に対しておおよそ +${up}% まで増量しても許容範囲と考えられます。一方で気温が低い日には、-${down}% 程度抑えて様子を見るとロス抑制に繋がりやすくなります。`
        );
      } else {
        // 寒い日に強い
        forecastLines.push(
          `・${itemName}は気温が低めに推移する日には、通常出荷に対しておおよそ +${up}% まで増量しても許容範囲と考えられます。逆に気温が高い日には、-${down}% 程度抑えて出荷することでロスを抑えやすくなります。`
        );
      }
    }
  });

  if (!analysisLines.length) {
    analysisLines.push(
      "直近10日間のデータでは、気温高低による明確な販売率の差はまだ大きくありません。今後もデータを蓄積しながら、寒暖差が大きい週に改めて確認するのがおすすめです。"
    );
  }

  if (!forecastLines.length) {
    forecastLines.push(
      "現時点では、気温を理由に出荷量を大きく振るよりも、曜日別・店舗別の売れ行きパターンを優先して調整する段階と考えられます。極端に暑い／寒い日のみ、1〜2割の微調整から試すと安全です。"
    );
  }

  area.innerHTML = `
    <div class="ai-comment-card">
      <p style="font-weight:bold;">【気象分析（直近10日間）】</p>
      ${analysisLines.map((t) => `<p>${t}</p>`).join("")}
      <hr style="border:none;border-top:1px solid #ddd;margin:8px 0;">
      <p style="font-weight:bold;">【販売予測（直近10日間）】</p>
      ${forecastLines.map((t) => `<p>${t}</p>`).join("")}
    </div>
  `;
}

/* =============================================
   ▼ 月ビュー：気象ヒートマップ（カラー適用版）
============================================= */
function renderMonthWeatherHeatmap(items, weatherInfo) {
  console.log("🔥月ヒート呼ばれた", items, weatherInfo);

  const el = document.getElementById("monthWeatherHeatmap");
  if (!el) return;

  let html = `
    <h5 style="margin-top:12px;">🌡 気温帯別 効果量ヒートマップ</h5>
    <table class="simple-table">
      <tr><th>品目</th><th>寒い</th><th>普通</th><th>暑い</th></tr>
  `;

  const temps = weatherInfo.map((w) => w.tempMax).filter((v) => v !== null);
  temps.sort((a, b) => a - b);
  const n = temps.length;
  const tCold = temps[Math.floor(n * 0.33)];
  const tHot = temps[Math.floor(n * 0.66)];

  /** 週ビューと同じ背景色ロジック */
  const cell = (v) => {
    let arrow = "→";
    if (v > 5) arrow = "↑";
    if (v < -5) arrow = "↓";

    const perc = v > 0 ? `+${v}%` : `${v}%`;

    /* 背景グラデーション：青(売れにくい)〜赤(売れやすい) */
    const red = Math.min(255, Math.max(0, 128 + v * 3));
    const blue = Math.min(255, Math.max(0, 128 - v * 3));
    const green = Math.max(180 - Math.abs(v * 2), 0);
    const bg = `rgb(${red},${green},${blue})`;

    return `
      <td style="background:${bg};color:#000;font-weight:600;">
        ${arrow} ${perc}
      </td>
    `;
  };

  items.forEach((it) => {
    const item = it.item;
    const baseRate = it.shippedQty > 0 ? it.soldQty / it.shippedQty : 0;

    let cold = 0,
      mid = 0,
      hot = 0,
      cN = 0,
      mN = 0,
      hN = 0;

    weatherInfo.forEach((w) => {
      const daily = w[item];
      if (!daily || !daily.shipped) return;

      const r = daily.sold / daily.shipped - baseRate;

      if (w.tempMax <= tCold) {
        cold += r * 100;
        cN++;
      } else if (w.tempMax >= tHot) {
        hot += r * 100;
        hN++;
      } else {
        mid += r * 100;
        mN++;
      }
    });

    const avg = (v, c) => (c > 0 ? Math.round(v / c) : 0);

    html += `
      <tr>
        <td>${item}</td>
        ${cell(avg(cold, cN))}
        ${cell(avg(mid, mN))}
        ${cell(avg(hot, hN))}
      </tr>
    `;
  });

  html += `</table>`;
  el.innerHTML = html;
}

/* =============================================
   ▼ 月ビュー：効果量クロステーブル
============================================= */
function renderMonthWeatherCrossTable(items, weatherInfo) {
  console.log("🔥月クロステーブル", items, weatherInfo);

  const el = document.getElementById("monthWeatherCrossTable");
  if (!el) return;

  const temps = weatherInfo.map((w) => w.tempMax).filter((v) => v !== null);
  temps.sort((a, b) => a - b);
  const n = temps.length;
  const tCold = temps[Math.floor(n * 0.33)];
  const tHot = temps[Math.floor(n * 0.66)];

  const groups = {}; // {weather:{cold:{sum,cnt},mid:{},hot:{}}}

  weatherInfo.forEach((w) => {
    const wt = w.weather;
    if (!groups[wt]) groups[wt] = { cold: { sum: 0, cnt: 0 }, mid: { sum: 0, cnt: 0 }, hot: { sum: 0, cnt: 0 } };

    items.forEach((it) => {
      const v = w[it.item];
      if (!v || !v.shipped) return;

      const r = v.sold / v.shipped;

      if (w.tempMax <= tCold) {
        groups[wt].cold.sum += r;
        groups[wt].cold.cnt++;
      } else if (w.tempMax >= tHot) {
        groups[wt].hot.sum += r;
        groups[wt].hot.cnt++;
      } else {
        groups[wt].mid.sum += r;
        groups[wt].mid.cnt++;
      }
    });
  });

  const avg = (x) => (x.cnt ? Math.round((x.sum / x.cnt) * 100) : 0);
  const wKeys = Object.keys(groups);

  let html = `
    <h5 style="margin-top:12px;">⛅ 天候 × 気温帯 効果量</h5>
    <table class="simple-table">
      <tr><th>天候</th><th>寒い</th><th>普通</th><th>暑い</th></tr>
  `;

  wKeys.forEach((wt) => {
    const g = groups[wt];
    html += `
      <tr>
        <td>${wt}</td>
        <td>${avg(g.cold)}%</td>
        <td>${avg(g.mid)}%</td>
        <td>${avg(g.hot)}%</td>
      </tr>
    `;
  });

  html += `</table>`;
  el.innerHTML += html;
}

/* =============================================
   ▼ AIコメント（月）気象観点 ＋ 販売予測（過去30日）
============================================= */
function renderMonthWeatherAI(items, weatherInfo) {
  console.log("🔥月AI呼ばれた", items, weatherInfo);

  const analysisEl = document.getElementById("monthWeatherAI");
  const forecastEl = document.getElementById("monthSalesForecast");
  if (!analysisEl && !forecastEl) return;

  if (!weatherInfo || !weatherInfo.length) {
    if (analysisEl) {
      analysisEl.innerHTML = `
        <div class="ai-comment-card">
          <p>気象データが不足しているため、この月の気象分析コメントは作成できません。</p>
        </div>
      `;
    }
    if (forecastEl) {
      forecastEl.innerHTML = `
        <div class="ai-comment-card">
          <p>販売予測を行うだけの気象データが揃っていません。</p>
        </div>
      `;
    }
    return;
  }

  // ---- 直近30日分に絞り込む ----
  const parsed = weatherInfo
    .filter((w) => w.date && w.tempMax != null)
    .map((w) => ({ ...w, _d: new Date(w.date) }));

  if (!parsed.length) {
    if (analysisEl) {
      analysisEl.innerHTML = `
        <div class="ai-comment-card">
          <p>気象データが不足しているため、この月の気象分析コメントは作成できません。</p>
        </div>
      `;
    }
    if (forecastEl) {
      forecastEl.innerHTML = `
        <div class="ai-comment-card">
          <p>販売予測を行うだけの気象データが揃っていません。</p>
        </div>
      `;
    }
    return;
  }

  const maxTime = Math.max(...parsed.map((w) => w._d.getTime()));
  const endDate = new Date(maxTime);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 29); // 直近30日

  const target = parsed.filter((w) => w._d >= startDate && w._d <= endDate);

  if (!target.length) {
    if (analysisEl) {
      analysisEl.innerHTML = `
        <div class="ai-comment-card">
          <p>直近30日間に気象データがほとんどないため、この月の分析は行えません。</p>
        </div>
      `;
    }
    if (forecastEl) {
      forecastEl.innerHTML = `
        <div class="ai-comment-card">
          <p>販売予測を行うだけのデータが不足しています。</p>
        </div>
      `;
    }
    return;
  }

  const temps = target.map((w) => w.tempMax).filter((v) => v != null);
  if (!temps.length) {
    if (analysisEl) {
      analysisEl.innerHTML = `
        <div class="ai-comment-card">
          <p>最高気温データが取得できなかったため、この月の気象分析コメントは作成できません。</p>
        </div>
      `;
    }
    if (forecastEl) {
      forecastEl.innerHTML = `
        <div class="ai-comment-card">
          <p>販売予測を行うだけの気象データが揃っていません。</p>
        </div>
      `;
    }
    return;
  }

  const tAvg = temps.reduce((a, b) => a + b, 0) / temps.length;

  const analysisLines = [];
  const forecastLines = [];

  items.forEach((it) => {
    const itemName = it.item;

    let hotSum = 0,
      hotN = 0;
    let coldSum = 0,
      coldN = 0;

    target.forEach((w) => {
      const rec = w[itemName];
      if (!rec || !rec.shipped) return;

      const rate = (rec.sold / rec.shipped) * 100;

      if (w.tempMax >= tAvg) {
        hotSum += rate;
        hotN++;
      } else {
        coldSum += rate;
        coldN++;
      }
    });

    if (hotN + coldN < 4) {
      // 月は少し厳しめに、4日未満ならスキップ
      return;
    }

    const hotAvg = hotN ? Math.round(hotSum / hotN) : null;
    const coldAvg = coldN ? Math.round(coldSum / coldN) : null;

    if (hotAvg == null || coldAvg == null) return;

    const diff = hotAvg - coldAvg;

    if (Math.abs(diff) >= 5) {
      const dir = diff > 0 ? "気温が高い日" : "気温が低い日";
      const sign = diff > 0 ? `+${diff}` : `${diff}`;

      analysisLines.push(
        `・${itemName}は直近30日間の集計では、${dir}における販売率が平均より約${sign}% 高い傾向があります（高温日${hotN}日／低温日${coldN}日ベース）。`
      );

      const absDiff = Math.abs(diff);
      let up = 0,
        down = 0;

      if (absDiff >= 20) {
        up = 15;
        down = 10;
      } else if (absDiff >= 12) {
        up = 10;
        down = 5;
      } else {
        up = 5;
        down = 3;
      }

      if (diff > 0) {
        forecastLines.push(
          `・${itemName}は暖かい時期にやや強い動きが見られます。今後も同程度の気温が続く局面では、平常時に比べて +${up}% 程度の増量を上限に出荷量を試験的に引き上げる余地があります。一方で気温が低めに推移する期間は、-${down}% 程度抑えてロスの様子を見る運用が無難です。`
        );
      } else {
        forecastLines.push(
          `・${itemName}は冷え込む局面で販売率が高くなる傾向があります。寒い日が続く月は、平常時に比べて +${up}% 程度の増量を検討できます。逆に暖かい日が多い月は、-${down}% 程度抑えた出荷にしておくとロスリスクを抑えられます。`
        );
      }
    }
  });

  if (analysisEl) {
    if (!analysisLines.length) {
      analysisEl.innerHTML = `
        <div class="ai-comment-card">
          <p>直近30日間のデータでは、気温高低による販売率の差はまだ大きくありません。月単位では、まずは曜日別・店舗別の動きを基準にしつつ、極端に暑い／寒い日の傾向を少しずつ確認していく段階と考えられます。</p>
        </div>
      `;
    } else {
      analysisEl.innerHTML = `
        <div class="ai-comment-card">
          ${analysisLines.map((t) => `<p>${t}</p>`).join("")}
        </div>
      `;
    }
  }

  if (forecastEl) {
    if (!forecastLines.length) {
      forecastLines.push(
        "現時点の30日集計では、気温要因だけで大きな出荷変更を行うほどの明確な差は見られていません。通常は曜日・店舗の実績を優先しつつ、特に気温が大きく振れた月に限って1〜2割の微調整から試すのがおすすめです。"
      );
    }

    forecastEl.innerHTML = `
      <div class="ai-comment-card">
        ${forecastLines.map((t) => `<p>${t}</p>`).join("")}
      </div>
    `;
  }
}


