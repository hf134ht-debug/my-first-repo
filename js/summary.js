/* =========================================================
   summary.js（日／週 集計 UI & API 連携 完全版）
========================================================= */

let currentSummaryView = "day"; // 初期ビュー：日
let selectedSummaryDate = null; // カレンダーで選択された日

/* ==== HTML レンダリング ==== */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>
    <div id="summaryTabArea">${renderSummaryTabs()}</div>
    <div id="summaryCalendar"></div>
    <div id="summaryResult"></div>
  `;
}

/* ==== タブ切替ボタン ==== */
function renderSummaryTabs() {
  return `
    <div class="summary-tabs">
      <button onclick="changeSummaryView('day')" 
        class="summary-tab ${currentSummaryView==='day'?'active':''}">日</button>

      <button onclick="changeSummaryView('week')" 
        class="summary-tab ${currentSummaryView==='week'?'active':''}">週</button>

      <button onclick="changeSummaryView('month')" 
        class="summary-tab ${currentSummaryView==='month'?'active':''}">月</button>

      <button onclick="changeSummaryView('year')" 
        class="summary-tab ${currentSummaryView==='year'?'active':''}">年</button>
    </div>
  `;
}

/* ==== ビュー変更 ==== */
function changeSummaryView(view) {
  currentSummaryView = view;
  document.getElementById("summaryTabArea").innerHTML = renderSummaryTabs();
  renderSummaryCalendar();
}

/* ==== 初期呼び出し ==== */
function activateSummaryFeatures() {
  const today = new Date();
  selectedSummaryDate = formatDate(today);
  renderSummaryCalendar();
}

/* ==== カレンダー表示（day & week 共有） ==== */
function renderSummaryCalendar() {
  const y = selectedSummaryDate.slice(0, 4);
  const m = selectedSummaryDate.slice(5, 7);
  const ym = `${y}-${m}`;

  document.getElementById("summaryCalendar").innerHTML = `<p>読み込み中...</p>`;

  google.script.run
    .withSuccessHandler(days => {
      drawCalendar(days.days);
    })
    .withFailureHandler(err => console.error(err))
    .doGet({ checkSummaryMonth: ym });
}

/* ==== カレンダー描画 ==== */
function drawCalendar(daysWithData) {
  const d = new Date(selectedSummaryDate + "T00:00:00+09:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();

  let html = `<table class="cal"><tr>`;
  const week = ["日","月","火","水","木","金","土"];
  week.forEach(w => html += `<th>${w}</th>`);
  html += `</tr><tr>`;

  let firstDay = new Date(y, m, 1).getDay();
  for (let i = 0; i < firstDay; i++) html += `<td></td>`;

  for (let day = 1; day <= lastDay; day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const has = daysWithData.includes(String(day).padStart(2,'0'));

    if (ds === selectedSummaryDate)
      html += `<td class="selected" onclick="selectSummaryDate('${ds}')">${day}</td>`;
    else if (has)
      html += `<td class="has-data" onclick="selectSummaryDate('${ds}')">${day}</td>`;
    else
      html += `<td onclick="selectSummaryDate('${ds}')">${day}</td>`;

    if (new Date(y, m, day).getDay() === 6) html += `</tr><tr>`;
  }

  html += `</tr></table>`;
  document.getElementById("summaryCalendar").innerHTML = html;

  loadSummaryResult();
}

/* ==== 日付選択 ==== */
function selectSummaryDate(ds) {
  selectedSummaryDate = ds;
  renderSummaryCalendar();
}

/* ==== 集計結果読み込み ==== */
function loadSummaryResult() {
  if (currentSummaryView === "day") {
    loadDailySummary();
  } else if (currentSummaryView === "week") {
    loadWeeklySummary();
  }
}

/* =========================================================
   ▼ 日集計 API 呼び出し
========================================================= */
function loadDailySummary() {
  document.getElementById("summaryResult").innerHTML = `<p>取得中...</p>`;

  google.script.run
    .withSuccessHandler(showDailySummary)
    .getDailySummary(selectedSummaryDate);
}

/* 日集計 表示 */
function showDailySummary(data) {
  if (!data.found) {
    document.getElementById("summaryResult").innerHTML = "<p>データなし</p>";
    return;
  }

  let html = `
    <h3>${data.summaryDate}（出荷：${data.shipDate}）</h3>
    <table class="summary-table">
      <tr><th>品目</th><th>出荷</th><th>売上</th><th>ロス</th><th>率</th></tr>
  `;

  data.items.forEach(x => {
    html += `
      <tr>
        <td>${x.item}</td>
        <td>${x.shippedQty}</td>
        <td>${x.soldQty}</td>
        <td>${x.lossQty}</td>
        <td>${x.lossRate ?? "-"}%</td>
      </tr>`;
  });

  html += `</table>`;
  document.getElementById("summaryResult").innerHTML = html;
}

/* =========================================================
   ▼ 週集計 API 呼び出し
========================================================= */
function loadWeeklySummary() {
  document.getElementById("summaryResult").innerHTML = `<p>取得中...</p>`;

  google.script.run
    .withSuccessHandler(showWeeklySummary)
    .getWeeklySummary(selectedSummaryDate);
}

/* 週集計 表示 */
function showWeeklySummary(data) {
  if (!data.found) {
    document.getElementById("summaryResult").innerHTML = "<p>週データなし</p>";
    return;
  }

  let html = `
    <h3>${data.weekStart}週</h3>
    <table class="summary-table">
      <tr><th>品目</th><th>出荷</th><th>売上</th><th>ロス</th><th>率</th></tr>
  `;

  data.items.forEach(x => {
    const rate = x.shippedQty > 0 ? Math.round((x.lossQty / x.shippedQty) * 100) : "-";
    html += `
      <tr>
        <td>${x.item}</td>
        <td>${x.shippedQty}</td>
        <td>${x.soldQty}</td>
        <td>${x.lossQty}</td>
        <td>${rate}%</td>
      </tr>`;
  });

  html += `</table>`;
  document.getElementById("summaryResult").innerHTML = html;
}

/* ==== Util ==== */
function formatDate(d) {
  return d.toISOString().slice(0,10);
}
