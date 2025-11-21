/* =========================================================
   app.js
   - アプリ全体の管理
   - タブ切替
   - メニュー生成
   - 初期表示
========================================================= */

/* ===== メニュー（初期画面） ===== */
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

/* ===== 下タブ生成 ===== */
function renderBottomTabs() {
  return `
    <button class="tab-btn shipment" onclick="openTab('shipment')">出荷</button>
    <button class="tab-btn history"  onclick="openTab('history')">履歴</button>
    <button class="tab-btn sales"    onclick="openTab('sales')">売上</button>
    <button class="tab-btn summary"  onclick="openTab('summary')">集計</button>
  `;
}

document.getElementById("bottomTabs").innerHTML = renderBottomTabs();

/* ===== タブ切替メイン ===== */
function openTab(tab) {

  // 初期メニューは非表示
  document.getElementById("menuScreen").style.display = "none";

  const tc = document.getElementById("tabContent");
  tc.style.display = "block";

  // タブの色切替
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const targetBtn = document.querySelector(`.tab-btn.${tab}`);
  if (targetBtn) targetBtn.classList.add("active");

  /* ==== 出荷 ==== */
  if (tab === "shipment") {
    tc.innerHTML = renderShipmentScreen();
    activateShipmentFeatures();
    return;
  }

  /* ==== 履歴 ==== */
  if (tab === "history") {
    tc.innerHTML = renderHistoryScreen();
    activateHistoryFeatures();
    return;
  }

  /* ==== 売上・集計（開発中） ==== */
  tc.innerHTML = `<h2>${tab}（開発中）</h2>`;
}

/* ===== 初期表示 ===== */
function initApp() {
  document.getElementById("menuScreen").innerHTML = renderMenuScreen();
  document.getElementById("menuScreen").style.display = "block";
  document.getElementById("tabContent").style.display = "none";
}

/* アプリ起動 */
initApp();
