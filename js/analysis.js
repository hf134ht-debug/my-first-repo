/* =========================================================
   analysis.js
   AI分析タブ（UI制御用）
   - 店舗ボタンの生成とON/OFF制御
   - 各ブロックの初期表示
   - 後でGAS/Pythonからデータを入れられる構造
========================================================= */

/* ===== 店舗一覧 ===== */
const ANALYSIS_STORES = [
  "連島店", "津高店", "茶屋町店", "大安寺店",
  "中庄店", "総社南店", "円山店", "児島店"
];

/* ===== 品目一覧（後でGASからも取得できるように） ===== */
const ANALYSIS_ITEMS = [
  "白菜",
  "白菜カット",
  "キャベツ",
  "キャベツカット",
  "トウモロコシ"
];

/* =========================================================
   ▼ AI分析タブの初期化
========================================================= */
function loadAnalysisView() {
  fetch("/my-first-repo/analysis_view.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("tabContent").innerHTML = html;

      // 各ブロックの初期UIセット
      setupItemDropdowns();
      setupStoreButtons("allocStoreButtons");
      setupStoreButtons("revStoreButtons");
      setupSimulationSlider();
    });
}

/* =========================================================
   ▼ 品目プルダウン生成
========================================================= */
function setupItemDropdowns() {
  const targets = ["allocItem", "revItem", "simItem"];

  targets.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    ANALYSIS_ITEMS.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
  });
}

/* =========================================================
   ▼ pill型 店舗ボタン生成
========================================================= */
function setupStoreButtons(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  ANALYSIS_STORES.forEach(store => {
    const btn = document.createElement("button");
    btn.className = "store-pill-btn store-pill-on"; // デフォルトON
    btn.textContent = store;
    btn.dataset.store = store;

    btn.addEventListener("click", () => {
      btn.classList.toggle("store-pill-on");
      btn.classList.toggle("store-pill-off");
    });

    container.appendChild(btn);
  });
}

/* =========================================================
   ▼ 選択された店舗を取得する関数（後でGAS/Python連携で使用）
========================================================= */
function getSelectedStores(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];

  return [...container.querySelectorAll(".store-pill-on")].map(btn => btn.dataset.store);
}

/* =========================================================
   ▼ 価格スライダー（ブロック③）
========================================================= */
function setupSimulationSlider() {
  const slider = document.getElementById("simPrice");
  const label = document.getElementById("simPriceLabel");
  const resultArea = document.getElementById("simResult");

  if (!slider || !label) return;

  slider.addEventListener("input", () => {
    label.textContent = `現在の価格：${slider.value}円`;

    // 仮の表示（後でAI予測結果が入る）
    resultArea.innerHTML = `
      <p class="analysis-placeholder">
        価格 ${slider.value} 円での予測計算は後でAIが表示します
      </p>
    `;
  });
}

/* =========================================================
   ▼ 店舗配分（ブロック①）データ反映（後でAI接続）
========================================================= */
function renderAllocationResult(data) {
  const area = document.getElementById("allocResult");
  if (!area) return;

  // data例：
  // [{ store: "連島店", qty: 10, rate: 92 }, ...]

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
   ▼ リバースエンジン（ブロック②）データ反映
========================================================= */
function renderReverseEngineResult(data) {
  const area = document.getElementById("revResult");
  if (!area) return;

  // data例：
  // { price: 130, rate: 95, loss: 5, alloc: [...] }

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

  data.alloc.forEach(row => {
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
   ▼ 需要予測（ブロック④）データ反映
========================================================= */
function renderForecast(data) {
  // data = { chart: [...], stores: [...], comment: "..." }

  // ★ グラフ部分（後で本物の予測を差し込む）
  if (data.chart) {
    const options = {
      chart: { type: 'line', height: 200 },
      series: [{ name: "売れ行き予測", data: data.chart }],
      xaxis: { categories: ["今日","明日","3日後","4日後","5日後","6日後","7日後"] }
    };
    new ApexCharts(document.querySelector("#forecastChart"), options).render();
  }

  // ★ 店舗需要強度（★評価）
  if (data.stores) {
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
    document.getElementById("storeDemand").innerHTML = html;
  }

  // ★ AIコメント
  if (data.comment) {
    document.getElementById("forecastComment").innerHTML = `
      <p>${data.comment}</p>
    `;
  }
}
