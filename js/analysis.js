/* =========================================================
   analysis.js
   AI分析タブ（4つのモード切替 + UI制御）
   規格プリセット対応・ゆめかわ完全版
========================================================= */

/* =========================================================
   ▼ 品目 → 規格プリセット一覧
========================================================= */
const KIKAKU_PRESETS = {
  "キャベツ": [
    "0.7kg以下",
    "0.7kg以下（2,3個入り）",
    "0.7〜1.1kg",
    "1.1〜1.6kg",
    "1.6kg以上",
  ],

  "キャベツカット": [
    "1.1〜1.6kg",
    "1.6kg以上",
  ],

  "白菜": [   /* ※はくさい → 白菜 に統一 */
    "1kg以下",
    "1〜1.4kg",
    "1.4〜1.8kg",
    "1.0〜1.8kg",
    "1.8〜3kg",
    "3kg以上",
  ],

  "白菜カット": [
    "カミサリ不良・普通",
    "カミサリ不良・軽",
  ],

  "トウモロコシ": [
    "A・黄", "B・黄", "C・黄",
    "A・白", "B・白", "C・白",
    "A・ミックス", "B・ミックス", "C・ミックス",
    "A・黄（2本入り）",
    "B・黄（2本入り）",
    "C・黄（2本入り）",
    "A・白（2本入り）",
    "B・白（2本入り）",
    "C・白（2本入り）",
    "A・ミックス（2本入り）",
    "B・ミックス（2本入り）",
    "C・ミックス（2本入り）",
  ],
};

/* =========================================================
   ▼ 店舗一覧
========================================================= */
const ANALYSIS_STORES = [
  "連島店", "津高店", "茶屋町店", "大安寺店",
  "中庄店", "総社南店", "円山店", "児島店"
];

/* =========================================================
   ▼ 品目一覧（analysis 用）
========================================================= */
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
  setupSpecPresetLogic();              // ← 規格プリセットセットアップ追加
  setupStoreButtons("allocStoreButtons");
  setupStoreButtons("revStoreButtons");
  setupSimulationSlider();
}

/* =========================================================
   ▼ 4つの大タブ
========================================================= */
function setupModeTabs() {
  const cards = document.querySelectorAll(".analysis-mode-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      showAnalysisPage(card.dataset.mode);
    });
  });

  showAnalysisPage("alloc");
}

function showAnalysisPage(mode) {
  document.querySelectorAll(".analysis-page").forEach(p => p.classList.remove("active"));
  const page = document.getElementById(`analysisPage-${mode}`);
  if (page) page.classList.add("active");

  document.querySelectorAll(".analysis-mode-card").forEach(c => c.classList.remove("active"));
  const target = document.querySelector(`.analysis-mode-card[data-mode="${mode}"]`);
  if (target) target.classList.add("active");
}

/* =========================================================
   ▼ 品目プルダウン
========================================================= */
function setupItemDropdowns() {
  ["allocItem", "revItem", "simItem"].forEach(id => {
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
   ▼ 規格プリセット ロジック
========================================================= */
function setupSpecPresetLogic() {
  setupSpecPresetFor("allocItem", "allocSpecPreset");
  setupSpecPresetFor("revItem", "revSpecPreset");
  setupSpecPresetFor("simItem", "simSpecPreset");
}

/* 品目の選択に応じてプリセットを更新する */
function setupSpecPresetFor(itemId, presetId) {
  const itemSel = document.getElementById(itemId);
  const presetSel = document.getElementById(presetId);

  if (!itemSel || !presetSel) return;

  function updatePreset() {
    const item = itemSel.value;
    const presets = KIKAKU_PRESETS[item] || [];

    presetSel.innerHTML = "";
    presets.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      presetSel.appendChild(opt);
    });
  }

  // 初期セット
  updatePreset();

  // 品目変更時
  itemSel.addEventListener("change", updatePreset);
}

/* =========================================================
   ▼ 店舗 pill ボタン
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

function getSelectedStores(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  return [...c.querySelectorAll(".store-pill-on")].map(b => b.dataset.store);
}

/* =========================================================
   ▼ 価格スライダー
========================================================= */
function setupSimulationSlider() {
  const slider = document.getElementById("simPrice");
  const label = document.getElementById("simPriceLabel");
  const result = document.getElementById("simResult");

  if (!slider || !label) return;

  label.textContent = `現在の価格：${slider.value}円`;

  slider.addEventListener("input", () => {
    label.textContent = `現在の価格：${slider.value}円`;
    result.innerHTML = `
      <p class="analysis-placeholder">
        価格 ${slider.value} 円での予測結果は、AI接続後にここに表示されます。
      </p>
    `;
  });
}

/* =========================================================
   ▼ 結果表示（今後AIモデルに接続）
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


function renderForecast(data) {
  if (data.chart && document.querySelector("#forecastChart")) {
    const op = {
      chart: { type: "line", height: 220 },
      series: [{ name: "売れ行き予測", data: data.chart }],
      xaxis: { categories: ["今日","明日","3日後","4日後","5日後","6日後","7日後"] }
    };
    const chart = new ApexCharts(
      document.querySelector("#forecastChart"),
      op
    );
    chart.render();
  }

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

  if (data.comment && document.getElementById("forecastComment")) {
    document.getElementById("forecastComment").innerHTML =
      `<p>${data.comment}</p>`;
  }
}
