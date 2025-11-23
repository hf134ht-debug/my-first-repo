/* =========================================================
   summary.js
   集計タブ（日／週ロス）
   - カレンダー（売上データ有りの日をマーキング）
   - 日別：出荷(2日前) vs 売上(当日)
   - 週別：指定日を含む週の合計（月〜日）
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SUMMARY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== 状態 ===== */
let summaryCalYear;
let summaryCalMonth;
const summaryMonthDaysCache = {}; // { "2025-11": ["01","03",...] }

let currentSummaryView = "day";           // "day" | "week" | "month" | "year"
let selectedSummaryDate = null;           // "YYYY-MM-DD"
let currentWeekDates = [];                // ["YYYY-MM-DD", ... 7日分]

/* ===== 集計画面 HTML ===== */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>
    <div id="summaryTabArea">${renderSummaryTabs()}</div>
    <div id="summaryCalendarArea"></div>
    <div id="summaryResult"><p>日付を選択してください</p></div>
  `;
}

/* タブ部分 */
function renderSummaryTabs() {
  return `
    <div class="summary-tabs">
      <button class="summary-tab ${currentSummaryView === "day" ? "active" : ""}"
        onclick="changeSummaryView('day')">
        日
      </button>
      <button class="summary-tab ${currentSummaryView === "week" ? "active" : ""}"
        onclick="changeSummaryView('week')">
        週
      </button>
      <button class="summary-tab ${currentSummaryView === "month" ? "active" : ""}"
        onclick="changeSummaryView('month')">
        月
      </button>
      <button class="summary-tab ${currentSummaryView === "year" ? "active" : ""}"
        onclick="changeSummaryView('year')">
        年
      </button>
    </div>
  `;
}

/* ビュー変更（日／週／月／年） */
async function changeSummaryView(view) {
  currentSummaryView = view;
  document.getElementById("summaryTabArea").innerHTML = renderSummaryTabs();

  if (view === "day") {
    currentWeekDates = [];
    await redrawSummaryCalendar();
    if (selectedSummaryDate) {
      await loadDailySummary(selectedSummaryDate);
    } else {
      document.getElementById("summaryResult").innerHTML =
        `<p>日付を選択してください</p>`;
    }
  } else if (view === "week") {
    if (!selectedSummaryDate) {
      const today = new Date();
      selectedSummaryDate = formatDateYYYYMMDD(today);
    }
    await loadWeeklySummary(selectedSummaryDate);
  } else {
    // 月・年ビューは今はメッセージのみ
    currentWeekDates = [];
    await redrawSummaryCalendar();
    document.getElementById("summaryResult").innerHTML =
      `<p>${view === "month" ? "月別集計" : "年別集計"}は今後追加予定です。</p>`;
  }
}

/* ===== 集計タブを開いたときに呼ぶ ===== */
async function activateSummaryFeatures() {
  const now = new Date();
  summaryCalYear  = now.getFullYear();
  summaryCalMonth = now.getMonth();

  currentSummaryView = "day";
  selectedSummaryDate = null;
  currentWeekDates = [];

  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);
  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, null, daysWithData, []);

  document.getElementById("summaryResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* ===== 月ごとの「データあり日」取得 ===== */
async function getSummaryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (summaryMonthDaysCache[ym]) return summaryMonthDaysCache[ym];

  const res  = await fetch(`${SUMMARY_SCRIPT_URL}?checkSummaryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  summaryMonthDaysCache[ym] = days;
  return days;
}

/* ===== カレンダー描画（集計用） ===== */
function drawSummaryCalendar(
  year,
  month,
  selectedDate = null,
  daysWithData = [],
  weekDates = []
) {
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

  for (let day = 1; day <= last.getDate(); day++) {
    const dd = String(day).padStart(2,"0");
    const mm = String(month + 1).padStart(2,"0");
    const ds = `${year}-${mm}-${dd}`;

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day;

    const isSelected =
      selectedDate &&
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day;

    const hasData = daysWithData.includes(dd);
    const inWeek  = weekDates && weekDates.includes(ds);

    html += `
      <div
        class="calendar-date
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasData ? "has-data" : ""}
          ${inWeek ? "week-selected" : ""}"
        onclick="selectSummaryDate(${year},${month},${day})"
      >
        ${day}
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

  await redrawSummaryCalendar();

  // 月を変えたら結果は一旦クリア
  document.getElementById("summaryResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* カレンダー再描画（現在の状態を反映） */
async function redrawSummaryCalendar() {
  const daysWithData = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);

  let selectedDateObj = null;
  if (selectedSummaryDate) {
    const d = new Date(selectedSummaryDate + "T00:00:00+09:00");
    if (d.getFullYear() === summaryCalYear && d.getMonth() === summaryCalMonth) {
      selectedDateObj = d;
    }
  }

  const weekDates = currentSummaryView === "week" ? currentWeekDates : [];

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, selectedDateObj, daysWithData, weekDates);
}

/* ===== 日付クリック ===== */
async function selectSummaryDate(y, m, d) {
  const dateStr =
    `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  selectedSummaryDate = dateStr;
  summaryCalYear  = y;
  summaryCalMonth = m;

  if (currentSummaryView === "week") {
    await loadWeeklySummary(dateStr);
  } else {
    currentWeekDates = [];
    await redrawSummaryCalendar();
    await loadDailySummary(dateStr);
  }
}

/* ===== 日別ロスデータ取得 & 表示 ===== */
async function loadDailySummary(dateStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の集計データがありません。</p>`;
      return;
    }

    const items = data.items || [];
    const total = data.total || {};

    let html = `
      <h3>${data.summaryDate} のロス（出荷：${data.shipDate} 分）</h3>
    `;

    // 全体サマリーカード
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 全体ロス</span>
          <span class="item-total-badge summary-badge">
            出荷 ${total.shippedQty || 0}個 / 売上 ${total.soldQty || 0}個
          </span>
        </div>
        <div>ロス：<b>${total.lossQty || 0}個</b>
          （${total.lossRate != null ? total.lossRate + "%" : "-"}）</div>
      </div>
    `;

    // 品目別カード
    items.forEach(it => {
      const clsInfo = getItemCssClass(it.item);

      html += `
        <div class="history-card ${clsInfo.card}">
          <div class="history-title">
            <span>${it.item}</span>
            <span class="item-total-badge ${clsInfo.badge}">
              出荷 ${it.shippedQty}個 / 売上 ${it.soldQty}個
            </span>
          </div>
          <div style="margin-top:4px;">
            ロス：<b>${it.lossQty}個</b>
            （${it.lossRate != null ? it.lossRate + "%" : "-"}）
          </div>
          ${renderSummaryStoreAccordion(it.stores || [])}
        </div>
      `;
    });

    resultDiv.innerHTML = html;
    attachStoreAccordionEvents();

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* ===== 週別ロスデータ取得 & 表示 ===== */
async function loadWeeklySummary(baseDateStr) {
  const resultDiv = document.getElementById("summaryResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SUMMARY_SCRIPT_URL}?summaryWeek=${baseDateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>この週の集計データがありません。</p>`;
      return;
    }

    const items = data.items || [];
    const total = data.total || {};
    const days  = data.days  || [];

    // カレンダー用：この週の7日分をハイライト
    currentWeekDates = days;
    if (days.length > 0) {
      selectedSummaryDate = days[0];
      const d0 = new Date(days[0] + "T00:00:00+09:00");
      summaryCalYear  = d0.getFullYear();
      summaryCalMonth = d0.getMonth();
    }

    await redrawSummaryCalendar();

    // 週ラベル用（例：2025年2月 第3週（2/17〜2/23））
    let weekLabel = "週別ロス";
    if (days.length > 0) {
      const start = new Date(days[0] + "T00:00:00+09:00");
      const end   = new Date(days[days.length - 1] + "T00:00:00+09:00");

      const year  = start.getFullYear();
      const month = start.getMonth() + 1;
      const nth   = Math.floor((start.getDate() - 1) / 7) + 1;

      const startMD = `${start.getMonth()+1}/${start.getDate()}`;
      const endMD   = `${end.getMonth()+1}/${end.getDate()}`;

      weekLabel = `${year}年${month}月 第${nth}週（${startMD}〜${endMD}）`;
    }

    let html = `
      <h3>${weekLabel}</h3>
    `;

    // 全体サマリーカード
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>📊 全体ロス（週）</span>
          <span class="item-total-badge summary-badge">
            出荷 ${total.shippedQty || 0}個 / 売上 ${total.soldQty || 0}個
          </span>
        </div>
        <div>ロス：<b>${total.lossQty || 0}個</b>
          （${total.lossRate != null ? total.lossRate + "%" : "-"}）</div>
      </div>
    `;

    // 品目別カード（週合計）
    items.forEach(it => {
      const clsInfo = getItemCssClass(it.item);

      html += `
        <div class="history-card ${clsInfo.card}">
          <div class="history-title">
            <span>${it.item}</span>
            <span class="item-total-badge ${clsInfo.badge}">
              出荷 ${it.shippedQty}個 / 売上 ${it.soldQty}個
            </span>
          </div>
          <div style="margin-top:4px;">
            ロス：<b>${it.lossQty}個</b>
            （${
              it.shippedQty > 0
                ? Math.round((it.lossQty / it.shippedQty) * 100) + "%"
                : "-"
            }）
          </div>
        </div>
      `;
    });

    resultDiv.innerHTML = html;

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* ===== 品目ごとのカード色（履歴／売上と合わせる） ===== */
function getItemCssClass(itemName) {
  const name = itemName || "";
  if (name.indexOf("白菜") !== -1) {
    // 白菜・白菜カット → hakusai
    return { card: "hakusai", badge: "item-total-hakusai" };
  }
  if (name.indexOf("キャベツ") !== -1 || name.indexOf("ｷｬﾍﾞﾂ") !== -1) {
    // キャベツ・キャベツカット → cabbage
    return { card: "cabbage", badge: "item-total-cabbage" };
  }
  if (name.indexOf("トウモロコシ") !== -1 ||
      name.indexOf("ﾄｳﾓﾛｺｼ") !== -1 ||
      name.indexOf("ｺｰﾝ") !== -1) {
    return { card: "corn", badge: "item-total-corn" };
  }
  // その他はとりあえず corn と同じ色
  return { card: "corn", badge: "item-total-corn" };
}

/* ===== 店舗別アコーディオン（日別用） ===== */
function renderSummaryStoreAccordion(stores) {
  if (!stores || !stores.length) {
    return `<div style="font-size:0.85em;color:#555;margin-top:4px;">
      店舗別内訳なし
    </div>`;
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
              ロス：${s.lossQty}個
              ${
                s.lossRate != null
                  ? `（${s.lossRate}%）`
                  : ""
              }
            </div>
          `).join("")
        }
      </div>
    </div>
  `;
}

/* ===== アコーディオン動作（履歴・売上・集計共通） ===== */
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

/* ==== Util ==== */
function formatDateYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
