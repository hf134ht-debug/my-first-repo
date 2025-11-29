/* =========================================================
   analysis.js
   AI分析タブ（4つのモード切替 + UI制御）
   ゆめかわ完全対応版
========================================================= */

/* ===== 店舗一覧 ===== */
const ANALYSIS_STORES = [
  "連島店", "津高店", "茶屋町店", "大安寺店",
  "中庄店", "総社南店", "円山店", "児島店"
];

/* ===== 品目一覧 ===== */
const ANALYSIS_ITEMS = [
  "白菜",
  "白菜カット",
  "キャベツ",
  "キャベツカット",
  "トウモロコシ"
];

/* =========================================================
   ▼ メイン呼び出し（openTab('analysis') から）
========================================================= */
function loadAnalysisView() {
  fetch("/my-first-repo/analysis_view.html")
    .then(res => res.text())
    .then(html => {
      const tc = document.getElementById("tabContent");
      tc.innerHTML = html;

      // セットアップ
      setupAnalysisView();
    })
    .catch(err => {
      console.error("AI分析の読み込みエラー:", err);
      document.getElementById("tabContent").innerHTML =
        "<p>AI分析画面の読み込みに失敗しました。</p>";
    });
}

/* =========================================================
   ▼ 初期セットアップ
========================================================= */
function setupAnalysisView() {
  setupModeTabs();
  setupItemDropdowns();
  setupStoreButtons("allocStoreButtons");
  setupStoreButtons("revStoreButtons");
  setupSimulationSlider();
}

/* =========================================================
   ▼ 4種類の大タブ（店舗配分 / リバース / 価格 / 予測）
========================================================= */
function setupModeTabs() {
  const cards = document.querySelectorAll(".analysis-mode-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      showAnalysisPage(card.dataset.mode);
    });
  });

  // デフォルトは店舗配分最適化
  showAnalysisPage("alloc");
}

function showAnalysisPage(mode) {
  // 全ページ非表示
  document.querySelectorAll(".analysis-page").forEach(p => p.classList.remove("active"));

  // 対象だけ表示
  let page = document.getElementById(`analysisPage-${mode}`);
  if (page) page.classList.add("active");

  // タブの見た目変更
  document.querySelectorAll(".analysis-mode-card").forEach(c => c.classList.remove("active"));
  let target = document.querySelector(`.analysis-mode-card[data-mode="${mode}"]`);
  if (target) target.classList.add("active");
}

/* =========================================================
   ▼ プルダウン生成（品目）
========================================================= */
function setupItemDropdowns() {
  ["allocItem", "revItem", "simItem"].forEach(id => {
    let sel = document.getElementById(id);
    if (!sel) return;

    sel.innerHTML = "";
    ANALYSIS_ITEMS.forEach(item => {
      let opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      sel.appendChild(opt);
    });
  });
}

/* =========================================================
   ▼ pill型 店舗ボタン生成
========================================================= */
function setupStoreButtons(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  ANALYSIS_STORES.forEach(store => {
    let btn = document.createElement("button");
    btn.className = "store-pill-btn store-pill-on";
    btn.textContent = store;
    btn.dataset.store = store;

    btn.addEventListener("click", () => {
      btn.classList.toggle("store-pill-on");
      btn.classList.toggle("store-pill-off");
    });

    container.appendChild(btn);
  });
}

/* 店舗取得（ONだけ） */
function getSelectedStores(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  return [...c.querySelectorAll(".store-pill-on")].map(b => b.dataset.store);
}

/* =========================================================
   ▼ 価格スライダー（ゆめかわ対応）
========================================================= */
function setupSimulationSlider() {
  const slider = document.getElementById("simPrice");
  const label  = document.getElementById("simPriceLabel");
  const result = document.getElementById("simResult");

  if (!slider || !label) return;

  label.textContent = `現在の価格：${slider.value}円`;

  slider.addEventListener("input", () => {
    label.textContent = `現在の価格：${slider.value}円`;

    result.innerHTML = `
      <p class="analysis-placeholder">
        価格 ${slider.value} 円での予測結果は、AIモデル接続後にここへ表示されます。
      </p>
    `;
  });
}

/* =========================================================
   ▼ ① 店舗配分最適化：表示
========================================================= */
function renderAllocationResult(list) {
  const area = document.getElementById("allocResult");
  if (!area) return;

  if (!list || list.length === 0) {
    area.innerHTML = `<p class="analysis-placeholder">結果がありません。</p>`;
    return;
  }

  let html = `
    <table class="analysis-table">
      <tr><th>店舗</th><th>個数</th><th>販売率</th></tr>
  `;
  list.forEach(r => {
    html += `
      <tr>
        <td>${r.store}</td>
        <td>${r.qty}</td>
        <td>${r.rate}%</td>
      </tr>
    `;
  });
  html += "</table>";

  area.innerHTML = html;
}

/* =========================================================
   ▼ ② リバースエンジン：表示
========================================================= */
function renderReverseEngineResult(data) {
  const area = document.getElementById("revResult");
  if (!area) return;

  if (!data) {
    area.innerHTML = `<p class="analysis-placeholder">結果がありません。</p>`;
    return;
  }

  let html = `
    <div class="rev-summary">
      <div><strong>最適価格：</strong>${data.price}円</div>
      <div><strong>販売率：</strong>${data.rate}%</div>
      <div><strong>ロス率：</strong>${data.loss}%</div>
    </div>
    <hr>
    <h4>店舗配分結果</h4>
    <table class="analysis-table">
      <tr><th>店舗</th><th>個数</th><th>販売率</th></tr>
  `;
  (data.alloc || []).forEach(r => {
    html += `
      <tr>
        <td>${r.store}</td>
        <td>${r.qty}</td>
        <td>${r.rate}%</td>
      </tr>
    `;
  });
  html += "</table>";

  area.innerHTML = html;
}

/* =========================================================
   ▼ ③ 需要予測：表示
========================================================= */
function renderForecast(data) {
  // グラフ
  if (data.chart && document.querySelector("#forecastChart")) {
    const op = {
      chart: { type: "line", height: 220 },
      series: [{ name: "売れ行き予測", data: data.chart }],
      xaxis: { categories: ["今日","明日","3日後","4日後","5日後","6日後","7日後"] }
    };
    const chart = new ApexCharts(document.querySelector("#forecastChart"), op);
    chart.render();
  }

  // 店舗別
  if (data.stores && document.getElementById("storeDemand")) {
    let html = `
      <table class="analysis-table">
        <tr><th>店舗</th><th>需要★</th><th>コメント</th></tr>
    `;
    data.stores.forEach(r => {
      html += `
        <tr>
          <td>${r.store}</td>
          <td>${r.star}</td>
          <td>${r.comment}</td>
        </tr>
      `;
    });
    html += "</table>";
    document.getElementById("storeDemand").innerHTML = html;
  }

  // コメント
  if (data.comment && document.getElementById("forecastComment")) {
    document.getElementById("forecastComment").innerHTML =
      `<p>${data.comment}</p>`;
  }
}
