/* =========================================================
   app.js（出荷・履歴・売上・集計タブ連動 完全版）
========================================================= */

/* ==== メニュー画面 ==== */
function renderMenuScreen() {
  return `
    <h2>メニュー</h2>
    <div class="menu-grid">
      <div class="menu-btn btn-shipment" onclick="openTab('shipment')">出荷管理</div>
      <div class="menu-btn btn-history"  onclick="openTab('history')">履歴</div>
      <div class="menu-btn btn-sales"    onclick="openTab('sales')">売上</div>
      <div class="menu-btn btn-summary"  onclick="openTab('summary')">集計</div>
    </div>
  `;
}

/* ==== 下タブ ==== */
function renderBottomTabs() {
  return `
    <button class="tab-btn shipment" onclick="openTab('shipment')">出荷</button>
    <button class="tab-btn history"  onclick="openTab('history')">履歴</button>
    <button class="tab-btn sales"    onclick="openTab('sales')">売上</button>
    <button class="tab-btn summary"  onclick="openTab('summary')">集計</button>
  `;
}
document.getElementById("bottomTabs").innerHTML = renderBottomTabs();

/* ==== タブ切替 ==== */
function openTab(tab) {
  document.getElementById("menuScreen").style.display = "none";
  const tc = document.getElementById("tabContent");
  tc.style.display = "block";

  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const targetBtn = document.querySelector(`.tab-btn.${tab}`);
  if (targetBtn) targetBtn.classList.add("active");

  if (tab === "shipment") {
    tc.innerHTML = renderShipmentScreen();
    activateShipmentFeatures();
    return;
  }
  if (tab === "history") {
    tc.innerHTML = renderHistoryScreen();
    activateHistoryFeatures();
    return;
  }
  if (tab === "sales") {
    tc.innerHTML = renderSalesScreen();
    activateSalesFeatures();
    return;
  }
  if (tab === "summary") {
    tc.innerHTML = renderSummaryScreen();
    activateSummaryFeatures();
    return;
  }

  tc.innerHTML = `<h2>${tab}（開発中）</h2>`;
}

/* =========================================================
   集計ビュー共通部分
========================================================= */
let currentSummaryView = "day";

/* Summary タブ上部の切り替えボタン */
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

/* ==== Summary タブ切替 ==== */
function changeSummaryView(view) {
  currentSummaryView = view;
  const tabArea = document.getElementById("summaryTabArea");
  if (tabArea) tabArea.innerHTML = renderSummaryTabs();

  if (view === "day") {
    activateSummaryFeatures();
  }
  else if (view === "week") {
    renderWeekSelector();  // 👈B案週UI表示
    loadWeekSummary();     // 👈API読み込み
  }
  else if (view === "month") {
    document.getElementById("summaryCalendar").innerHTML = "";
    document.getElementById("summaryResult").innerHTML = `<p>月集計（準備中）</p>`;
  }
  else if (view === "year") {
    document.getElementById("summaryCalendar").innerHTML = "";
    document.getElementById("summaryResult").innerHTML = `<p>年集計（準備中）</p>`;
  }
}

/* ==== 週選択 UI（B案） ==== */
function renderWeekSelector() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  // 月ごとの最大週を 6週までと仮定（一般的）
  let weekButtons = "";
  for (let w = 1; w <= 6; w++) {
    weekButtons += `
      <div class="week-chip" onclick="selectWeek(${y},${m},${w})">
        第${w}週
      </div>
    `;
  }

  document.getElementById("summaryCalendar").innerHTML = `
    <div class="week-selector">
      <div class="week-title">📅 ${y}年${m}月の週を選択</div>
      <div class="week-chip-container">${weekButtons}</div>
    </div>
  `;

  document.getElementById("summaryResult").innerHTML = `<p>週を選択してください</p>`;
}

/* ==== 週がタップされたとき ==== */
function selectWeek(y, m, w) {
  const first = new Date(y, m - 1, 1);
  const day = first.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(first.setDate(diff + (w - 1) * 7));

  const ds = monday.toISOString().slice(0, 10);

  document.getElementById("summaryResult").innerHTML = `<p>読み込み中...</p>`;
  loadWeekSummary(ds);
}

/* ==== 初期画面 ==== */
function initApp() {
  document.getElementById("menuScreen").innerHTML = renderMenuScreen();
  document.getElementById("menuScreen").style.display = "block";
  document.getElementById("tabContent").style.display = "none";
}
initApp();
