/* =========================================================
   summary.js（日 & 週 集計 完全版）
========================================================= */

let currentSummaryView = "day";
let selectedSummaryDate = null;

function renderSummaryScreen() {
  const today = new Date();
  selectedSummaryDate = formatDate(today);
  renderSummaryTabButtons();
  renderSummaryCalendar();

  return `
    <h2>集計</h2>
    <div id="summaryTabs"></div>
    <div id="summaryCalendar"></div>
    <div id="summaryResult"></div>
  `;
}

/* ==== タブ ==== */
function renderSummaryTabButtons() {
  document.getElementById("summaryTabs").innerHTML = `
    <div class="summary-tabs">
      <button onclick="changeSummaryView('day')" class="summary-tab ${currentSummaryView==='day'?'active':''}">日</button>
      <button onclick="changeSummaryView('week')" class="summary-tab ${currentSummaryView==='week'?'active':''}">週</button>
    </div>
  `;
}

/* タブ切替 */
function changeSummaryView(view) {
  currentSummaryView = view;
  renderSummaryTabButtons();
  renderSummaryCalendar();
}

/* ==== カレンダー ==== */
function renderSummaryCalendar() {
  const y = selectedSummaryDate.slice(0,4);
  const m = selectedSummaryDate.slice(5,7);
  const ym = `${y}-${m}`;

  document.getElementById("summaryCalendar").innerHTML = `<p>読み込み中...</p>`;

  google.script.run
    .withSuccessHandler(days => drawSummaryCalendar(days.days))
    .checkSummaryMonth(ym);
}

function drawSummaryCalendar(daysWithData) {
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

    let cls = has ? "has-data" : "";
    let mark = has ? `onclick="selectSummaryDate('${ds}')"` : "";

    if (ds === selectedSummaryDate)
      cls = "selected";

    html += `<td class="${cls}" ${mark}>${day}</td>`;

    if (new Date(y, m, day).getDay() === 6) html += `</tr><tr>`;
  }

  html += `</tr></table>`;
  document.getElementById("summaryCalendar").innerHTML = html;

  loadSummaryResult();
}

function selectSummaryDate(ds) {
  selectedSummaryDate = ds;
  renderSummaryCalendar();
}

/* ==== 集計API ==== */
function loadSummaryResult() {
  if (currentSummaryView === "day") {
    loadDailySummary();
  } else {
    loadWeeklySummary();
  }
}

/* 日集計 */
function loadDailySummary() {
  document.getElementById("summaryResult").innerHTML = `<p>取得中...</p>`;

  google.script.run
    .withSuccessHandler(showDailySummary)
    .getDailySummary(selectedSummaryDate);
}

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

/* 週集計 */
function loadWeeklySummary() {
  document.getElementById("summaryResult").innerHTML = `<p>取得中...</p>`;

  google.script.run
    .withSuccessHandler(showWeeklySummary)
    .getWeeklySummary(selectedSummaryDate);
}

function showWeeklySummary(data) {
  if (!data.found) {
    document.getElementById("summaryResult").innerHTML = "<p>週データなし</p>";
    return;
  }

  let html = `
    <h3>${data.weekStart} 週</h3>
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

/* Util */
function formatDate(d) {
  return d.toISOString().slice(0,10);
}
