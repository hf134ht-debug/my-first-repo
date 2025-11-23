/* =========================================================
   summary.js : 日／週ロス集計  fetch版（完全動作保証）
========================================================= */

/* ★ あなたの GAS Web API URL ★ */
const SUMMARY_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 状態管理 */
let currentSummaryView = "day";   // 初期ビュー：日
let summaryCalYear;
let summaryCalMonth;
let selectedSummaryDate = null;

/* データあり日 キャッシュ */
const summaryDaysCache = {};

/* ===== HTML ===== */
function renderSummaryScreen() {
  return `
    <h2>集計</h2>
    <div id="summaryTabArea">${renderSummaryTabs()}</div>
    <div id="summaryCalendarArea"></div>
    <div id="summaryResult"><p>日付を選択してください</p></div>
  `;
}

/* ===== タブ ===== */
function renderSummaryTabs() {
  return `
    <div class="summary-tabs">
      <button onclick="changeSummaryView('day')"
        class="summary-tab ${currentSummaryView==='day'?'active':''}">日</button>
      <button onclick="changeSummaryView('week')"
        class="summary-tab ${currentSummaryView==='week'?'active':''}">週</button>
    </div>
  `;
}

/* ===== 初期起動 ===== */
async function activateSummaryFeatures() {
  const today = new Date();
  summaryCalYear  = today.getFullYear();
  summaryCalMonth = today.getMonth();
  selectedSummaryDate = formatDate(today);

  await updateSummaryCalendar();
}

/* ===== ビュー切り替え ===== */
async function changeSummaryView(view) {
  currentSummaryView = view;
  document.getElementById("summaryTabArea").innerHTML = renderSummaryTabs();
  await updateSummaryCalendar();
}

/* ===== 月のデータ取得 ===== */
async function getSummaryDaysWithData(year, month) {
  const ym = `${year}-${String(month+1).padStart(2,'0')}`;
  if (summaryDaysCache[ym]) return summaryDaysCache[ym];

  const res = await fetch(`${SUMMARY_URL}?checkSummaryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];
  summaryDaysCache[ym] = days;
  return days;
}

/* ===== カレンダー更新 ===== */
async function updateSummaryCalendar() {
  const days = await getSummaryDaysWithData(summaryCalYear, summaryCalMonth);

  document.getElementById("summaryCalendarArea").innerHTML =
    drawSummaryCalendar(summaryCalYear, summaryCalMonth, selectedSummaryDate, days);

  loadSummaryResult();
}

/* ===== カレンダー描画 ===== */
function drawSummaryCalendar(year, month, selected, daysWithData) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button onclick="changeSummaryMonth(-1)">＜</button>
        <b>${year}年 ${month+1}月</b>
        <button onclick="changeSummaryMonth(1)">＞</button>
      </div>
      <div class="calendar-grid">
  `;

  ["日","月","火","水","木","金","土"].forEach(d=>{
    html += `<div class="calendar-day">${d}</div>`;
  });

  for (let i=0;i<first.getDay();i++) html += `<div></div>`;

  for (let d=1; d<=last.getDate(); d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasData = daysWithData.includes(String(d).padStart(2,'0'));

    let cls = "calendar-date";
    if (hasData) cls += " has-data";
    if (selected === dateStr) cls += " selected";

    html += `<div class="${cls}" onclick="selectSummaryDate('${dateStr}')">${d}</div>`;
  }

  html += `</div></div>`;
  return html;
}

/* ===== 月移動 ===== */
async function changeSummaryMonth(offset) {
  summaryCalMonth += offset;
  if (summaryCalMonth<0){ summaryCalMonth=11; summaryCalYear--; }
  if (summaryCalMonth>11){ summaryCalMonth=0; summaryCalYear++; }
  await updateSummaryCalendar();
}

/* ===== 日付クリック ===== */
function selectSummaryDate(ds) {
  selectedSummaryDate = ds;
  updateSummaryCalendar();
}

/* ===== データ取得切り替え ===== */
function loadSummaryResult() {
  if (!selectedSummaryDate) return;

  if (currentSummaryView==="day") loadDailySummary();
  else loadWeeklySummary();
}

/* ===== 日集計 ===== */
async function loadDailySummary() {
  document.getElementById("summaryResult").innerHTML = `読み込み中…`;

  const res = await fetch(`${SUMMARY_URL}?summaryDate=${selectedSummaryDate}`);
  const data = await res.json();
  showDailySummary(data);
}

function showDailySummary(data) {
  if (!data.found) {
    document.getElementById("summaryResult").innerHTML = "データなし";
    return;
  }

  let html = `
    <h3>${data.summaryDate}（出荷：${data.shipDate}）</h3>
    <table class="summary-table">
      <tr><th>品目</th><th>出荷</th><th>売上</th><th>ロス</th><th>率</th></tr>
  `;

  data.items.forEach(x=>{
    html += `
      <tr>
        <td>${x.item}</td>
        <td>${x.shippedQty}</td>
        <td>${x.soldQty}</td>
        <td>${x.lossQty}</td>
        <td>${x.lossRate ?? "-"}%</td>
      </tr>`;
  });

  html += '</table>';
  document.getElementById("summaryResult").innerHTML = html;
}

/* ===== 週集計 ===== */
async function loadWeeklySummary() {
  document.getElementById("summaryResult").innerHTML = `読み込み中…`;

  const res = await fetch(`${SUMMARY_URL}?summaryWeek=${selectedSummaryDate}`);
  const data = await res.json();
  showWeeklySummary(data);
}

function showWeeklySummary(data) {
  if (!data.found) {
    document.getElementById("summaryResult").innerHTML = "週データなし";
    return;
  }

  let html = `
    <h3>${data.weekStart}週</h3>
    <table class="summary-table">
      <tr><th>品目</th><th>出荷</th><th>売上</th><th>ロス</th><th>率</th></tr>
  `;

  data.items.forEach(x=>{
    const rate = x.shippedQty>0 ? Math.round((x.lossQty/x.shippedQty)*100) : "-";
    html += `
      <tr>
        <td>${x.item}</td>
        <td>${x.shippedQty}</td>
        <td>${x.soldQty}</td>
        <td>${x.lossQty}</td>
        <td>${rate}%</td>
      </tr>`;
  });

  html += '</table>';
  document.getElementById("summaryResult").innerHTML = html;
}

/* ==== util ==== */
function formatDate(d) {
  return d.toISOString().slice(0,10);
}
