/* =========================================================
   analysis.js
   AI分析タブ（4つのモード切替 + UI制御）
========================================================= */

/* ===== 店舗一覧 ===== */
const ANALYSIS_STORES = [
  "連島店", "津高店", "茶屋町店", "大安寺店",
  "中庄店", "総社南店", "円山店", "児島店"
];

/* ===== 品目一覧（必要に応じて後でGASから差し替えOK） ===== */
const ANALYSIS_ITEMS = [
  "白菜",
  "白菜カット",
  "キャベツ",
  "キャベツカット",
  "トウモロコシ"
];

/* =========================================================
   ▼ AI分析タブの読み込み（app.js の openTab から呼ばれる）
========================================================= */
function loadAnalysisView() {
  fetch("/my-first-repo/analysis_view.html")
    .then(res => res.text())
    .then(html => {
      const tc = document.getElementById("tabContent");
      tc.innerHTML = html;

      // HTML挿入後に各種セットアップ
      setupAnalysisView();
    })
    .catch(err => {
      console.error("AI分析ビュー読み込みエラー", err);
      document.getElementById("tabContent").innerHTML =
        "<p>AI分析画面の読み込みに失敗しました。</p>";
    });
}

/* =========================================================
   ▼ 画面全体の初期設定
========================================================= */
function setupAnalysisView() {
  setupModeTabs();          // 4つの大きなタブ
  setupItemDropdowns();     // 品目プルダウン
  setupStoreButtons("allocStoreButtons");
  setupStoreButtons("revStoreButtons");
  setupSimulationSlider();  // 価格スライダー
}

/* =========================================================
   ▼ 4つのモードタブ（大きな長方形カード）
========================================================= */
function setupModeTabs() {
  const cards = document.querySelectorAll(".analysis-mode-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      showAnalysisPage(mode);
    });
  });

  // デフォルトは 店舗配分最適化
  showAnalysisPage("alloc");
}

function showAnalysisPage(mode) {
  // ページ切替
  document.querySelectorAll(".analysis-page").forEach(p => {
    p.classList.remove("active");
  });
  const page = document.getElementById(`analysisPage-${mode}`);
  if (page) page.classList.add("active");

  // タブカードの見た目切替
  document.querySelectorAll(".analysis-mode-card").forEach(card => {
    card.classList.remove("active");
  });
  const activeCard = document.querySelector(`.analysis-mode-card[data-mode="${mode}"]`);
  if (activeCard) activeCard.classList.add("active");
}

/* =========================================================
   ▼ 品目プルダウン
========================================================= */
function setupItemDropdowns() {
  const ids = ["allocItem", "revItem", "simItem"];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = "";
    ANALYSIS_ITEMS.forEach(item => {
      const opt = document.createElement("option");
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
    const btn = document.createElement("button");
    btn.className = "store-pill-btn store-pill-on";  // デフォルトON
    btn.textContent = store;
    btn.dataset.store = store;

    btn.addEventListener("click", () => {
      btn.classList.toggle("store-pill-on");
      btn.classList.toggle("store-pill-off");
    });

    container.appendChild(btn);
  });
}

/* 選択中店舗一覧を取得（後でGAS/Python連携で使う） */
function getSelectedStores(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return [...container.querySelectorAll(".store-pill-on")].map(b => b.dataset.store);
}

/* =========================================================
   ▼ 価格スライダー（ブロック③）
========================================================= */
function setupSimulationSlider() {
  const slider = document.getElementById("simPrice");
  const label  = document.getElementById("simPriceLabel");
  const result = document.getElementById("simResult");

  if (!slider || !label || !result) return;

  label.textContent = `現在の価格：${slider.value}円`;

  slider.addEventListener("input", () => {
    label.textContent = `現在の価格：${slider.value}円`;
    result.innerHTML = `
      <p class="analysis-placeholder">
        価格 ${slider.value} 円での予測結果は、今後AI予測を組み込んだときにここに表示されます。
      </p>
    `;
  });
}

/* =========================================================
   ▼ ブロック①：店舗配分結果を表示（AI接続後に使用）
========================================================= */
function renderAllocationResult(data) {
  const area = document.getElementById("allocResult");
  if (!area) return;

  if (!data || data.length === 0) {
    area.innerHTML = `<p class="analysis-placeholder">結果がありません</p>`;
    return;
  }

  let html = `
    <table class="analysis-table">
      <tr><th>店舗</th><th>配分個数</th><th>販売率</th></tr>
  `;
  data.forEach(row => {
    html += `
      <tr>
        <td>${row.store}</td>
        <td>${row.qty}</td>
        <td>${row.rate}%</td>
      </tr>
    `;
  });
  html += `</table>`;
  area.innerHTML = html;
}

/* =========================================================
   ▼ ブロック②：リバースエンジン結果を表示
========================================================= */
function renderReverseEngineResult(data) {
  const area = document.getElementById("revResult");
  if (!area) return;

  if (!data) {
    area.innerHTML = `<p class="analysis-placeholder">結果がありません</p>`;
    return;
  }

  let html = `
    <div>最適価格：<strong>${data.price}円</strong></div>
    <div>販売率：${data.rate}%</div>
    <div>ロス率：${data.loss}%</div>
    <hr>
    <h4>店舗配分</h4>
    <table class="analysis-table">
      <tr><th>店舗</th><th>配分</th><th>販売率</th></tr>
  `;
  (data.alloc || []).forEach(row => {
    html += `
      <tr>
        <td>${row.store}</td>
        <td>${row.qty}</td>
        <td>${row.rate}%</td>
      </tr>
    `;
  });
  html += `</table>`;
  area.innerHTML = html;
}

/* =========================================================
   ▼ ブロック④：需要予測表示（簡易版）
========================================================= */
function renderForecast(data) {
  // グラフ
  if (data.chart && document.querySelector("#forecastChart")) {
    const options = {
      chart: { type: "line", height: 220 },
      series: [{ name: "売れ行き予測", data: data.chart }],
      xaxis: { categories: ["今日","明日","3日後","4日後","5日後","6日後","7日後"] }
    };
    const chart = new ApexCharts(document.querySelector("#forecastChart"), options);
    chart.render();
  }

  // 店舗別需要★
  if (data.stores && document.getElementById("storeDemand")) {
    let html = `
      <table class="analysis-table">
        <tr><th>店舗</th><th>需要強度</th><th>コメント</th></tr>
    `;
    data.stores.forEach(row => {
      html += `
        <tr>
          <td>${row.store}</td>
          <td>${row.star}</td>
          <td>${row.comment}</td>
        </tr>
      `;
    });
    html += `</table>`;
    document.getElementById("storeDemand").innerHTML = html;
  }

  // コメント
  if (data.comment && document.getElementById("forecastComment")) {
    document.getElementById("forecastComment").innerHTML =
      `<p>${data.comment}</p>`;
  }
}
