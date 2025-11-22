/* =========================================================
   app.js（出荷・履歴・売上のタブ連動 完全版）
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

/* ==== タブ遷移 ==== */
function openTab(tab) {
  document.getElementById("menuScreen").style.display = "none";
  const tc = document.getElementById("tabContent");
  tc.style.display = "block";

  // Active 色
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const targetBtn = document.querySelector(`.tab-btn.${tab}`);
  if (targetBtn) targetBtn.classList.add("active");

  // 出荷
  if (tab === "shipment") {
    tc.innerHTML = renderShipmentScreen();
    activateShipmentFeatures();
    return;
  }

  // 履歴
  if (tab === "history") {
    tc.innerHTML = renderHistoryScreen();
    activateHistoryFeatures();
    return;
  }

  // 売上
  if (tab === "sales") {
    tc.innerHTML = renderSalesScreen();
    activateSalesFeatures();
    return;
  }

  // 未実装タブ
  tc.innerHTML = `<h2>${tab}（開発中）</h2>`;
}

/* ==== 初期画面 ==== */
function initApp() {
  document.getElementById("menuScreen").innerHTML = renderMenuScreen();
  document.getElementById("menuScreen").style.display = "block";
  document.getElementById("tabContent").style.display = "none";
}

initApp();
