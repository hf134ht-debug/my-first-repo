/* =========================================================
   analysis.js
   AI分析タブ（4つのモード切替 + UI制御）
   規格プリセット対応・ゆめかわ完全版（spec正規化対応）
========================================================= */

/* =========================================================
   ▼ 品目 → 規格プリセット一覧
========================================================= */
window.KIKAKU_PRESETS = window.KIKAKU_PRESETS || {};
Object.assign(window.KIKAKU_PRESETS, {
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

  "はくさい": [
    "1kg以下",
    "1〜1.4kg",
    "1.4〜1.8kg",
    "1.0〜1.8kg",
    "1.8〜3kg",
    "3kg以上",
  ],

  "はくさいカット": [
    "カミサリ不良・普通",
    "カミサリ不良・軽",
  ],

  "とうもろこし": [
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
});

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
  "はくさい",
  "はくさいカット",
  "キャベツ",
  "キャベツカット",
  "とうもろこし"
];

/* =========================================================
   ▼ GAS（AI分析用）URL
========================================================= */
const ANALYSIS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* =========================================================
   ▼ 規格 spec 正規化（A案）
========================================================= */
function normalizeSpec(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")     // 全ての空白を削除
    .replace(/〜/g, "~")     // 全角チルダ
    .replace(/－/g, "-")     // 全角ハイフン
    .replace(/ー/g, "-");    // 長音記号もハイフン扱い
}

/* =========================================================
   ▼ 規格（プリセット＋手入力）をまとめる＋正規化
========================================================= */
function buildSpecValue(presetId, customId) {
  const preset = document.getElementById(presetId)?.value.trim() || "";
  const custom = document.getElementById(customId)?.value.trim() || "";
  return normalizeSpec(custom || preset || "");
}

/* =========================================================
   ▼ メインビュー読み込み
========================================================= */
function loadAnalysisView() {
  fetch("/my-first-repo/analysis_view.html")
    .then(res => res.text())
    .then(html => {
      document.getElementById("tabContent").innerHTML = html;
      requestAnimationFrame(() => setupAnalysisView());
    })
    .catch(err => {
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
  setupSpecPresetLogic();
  setupStoreButtons("allocStoreButtons");
  setupStoreButtons("revStoreButtons");
  setupSimulationSlider();
  setupAnalysisActions();
}

/* =========================================================
   ▼ タブ切替
========================================================= */
function setupModeTabs() {
  document.querySelectorAll(".analysis-mode-card").forEach(card => {
    card.addEventListener("click", () => showAnalysisPage(card.dataset.mode));
  });
  showAnalysisPage("alloc");
}

function showAnalysisPage(mode) {
  document.querySelectorAll(".analysis-page").forEach(p => p.classList.remove("active"));
  document.getElementById(`analysisPage-${mode}`).classList.add("active");

  document.querySelectorAll(".analysis-mode-card").forEach(c => c.classList.remove("active"));
  document.querySelector(`.analysis-mode-card[data-mode="${mode}"]`)?.classList.add("active");

  if (mode === "forecast") runForecast();
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
   ▼ 規格プリセット
========================================================= */
function setupSpecPresetLogic() {
  setupSpecPresetFor("allocItem", "allocSpecPreset");
  setupSpecPresetFor("revItem", "revSpecPreset");
  setupSpecPresetFor("simItem", "simSpecPreset");
}

function setupSpecPresetFor(itemId, presetId) {
  const itemSel = document.getElementById(itemId);
  const presetSel = document.getElementById(presetId);

  function updatePreset() {
    const presets = KIKAKU_PRESETS[itemSel.value] || [];
    presetSel.innerHTML = "";
    presets.forEach(p => {
      let opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      presetSel.appendChild(opt);
    });
  }

  updatePreset();
  itemSel.addEventListener("change", updatePreset);
}

/* =========================================================
   ▼ 店舗 pill ボタン
========================================================= */
function setupStoreButtons(containerId) {
  const container = document.getElementById(containerId);
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
  return [...document.getElementById(containerId).querySelectorAll(".store-pill-on")]
    .map(b => b.dataset.store);
}

/* =========================================================
   ▼ 価格スライダー（AI接続版）
========================================================= */
function setupSimulationSlider() {
  const slider = document.getElementById("simPrice");
  const label  = document.getElementById("simPriceLabel");
  const result = document.getElementById("simResult");

  if (!slider) return;

  const update = (v) => label.textContent = `現在の価格：${v}円`;

  const runSim = async (value) => {
    const item = document.getElementById("simItem").value;
    const spec = buildSpecValue("simSpecPreset", "simSpecCustom");

    result.innerHTML = `<p class="analysis-placeholder">AI計算中…</p>`;

    try {
      const res = await fetch(`${ANALYSIS_SCRIPT_URL}?ai=price&item=${item}&price=${value}&spec=${spec}`);
      const json = await res.json();

      if (!json || json.price == null) {
        result.innerHTML = `<p class="analysis-placeholder">該当データなし</p>`;
        return;
      }

      result.innerHTML = `
        <div class="rev-summary">
          <div><strong>価格：</strong>${json.price}円</div>
          <div><strong>予測販売数：</strong>${json.sales}</div>
          <div><strong>販売率：</strong>${json.rate}%</div>
          <div><strong>ロス率：</strong>${json.loss}%</div>
          <div><strong>利益：</strong>${json.profit}円</div>
        </div>
        ${json.comment ? `<p class="analysis-comment">${json.comment}</p>` : ""}
      `;
    } catch (e) {
      result.innerHTML = `<p class="analysis-placeholder">エラー：${e.message}</p>`;
    }
  };

  update(slider.value);
  slider.addEventListener("input", () => {
    update(slider.value);
    runSim(slider.value);
  });
}

/* =========================================================
   ▼ 実行ボタン紐付け
========================================================= */
function setupAnalysisActions() {
  document.getElementById("allocRunBtn")?.addEventListener("click", runAllocation);
  document.getElementById("revRunBtn")?.addEventListener("click", runReverseEngine);
  document.getElementById("forecastRunBtn")?.addEventListener("click", runForecast);
}

/* =========================================================
   ▼ 店舗配分最適化
========================================================= */
async function runAllocation() {
  const item   = document.getElementById("allocItem").value;
  const qty    = Number(document.getElementById("allocQuantity").value);
  const price  = Number(document.getElementById("allocPrice").value);
  const spec   = buildSpecValue("allocSpecPreset", "allocSpecCustom");
  const stores = getSelectedStores("allocStoreButtons");
  const area   = document.getElementById("allocResult");

  area.innerHTML = `<p class="analysis-placeholder">AI計算中…</p>`;

  try {
    const params = new URLSearchParams({
      ai: "allocation",
      item,
      qty,
      price,
      spec,
      stores: stores.join(",")
    });

    const res = await fetch(`${ANALYSIS_SCRIPT_URL}?${params}`);
    renderAllocationResult(await res.json());
  } catch (e) {
    area.innerHTML = `<p class="analysis-placeholder">エラー：${e.message}</p>`;
  }
}

/* =========================================================
   ▼ 逆算エンジン
========================================================= */
async function runReverseEngine() {
  const item   = document.getElementById("revItem").value;
  const target = Number(document.getElementById("revTarget").value);
  const spec   = buildSpecValue("revSpecPreset","revSpecCustom");
  const stores = getSelectedStores("revStoreButtons");
  const area   = document.getElementById("revResult");

  area.innerHTML = `<p class="analysis-placeholder">AI計算中…</p>`;

  try {
    const params = new URLSearchParams({
      ai: "reverse",
      item,
      target,
      spec,
      stores: stores.join(",")
    });

    const res = await fetch(`${ANALYSIS_SCRIPT_URL}?${params}`);
    renderReverseEngineResult(await res.json());
  } catch (e) {
    area.innerHTML = `<p class="analysis-placeholder">エラー：${e.message}</p>`;
  }
}

/* =========================================================
   ▼ 需要予測
========================================================= */
async function runForecast() {
  const area = document.getElementById("forecastComment");
  area.innerHTML = `<p class="analysis-placeholder">AI計算中…</p>`;

  try {
    const res = await fetch(`${ANALYSIS_SCRIPT_URL}?ai=forecast`);
    renderForecast(await res.json());
  } catch (e) {
    area.innerHTML = `<p class="analysis-placeholder">エラー：${e.message}</p>`;
  }
}

/* =========================================================
   ▼ 結果表示（既存）
========================================================= */
function renderAllocationResult(list) {
  const area = document.getElementById("allocResult");

  if (!list || list.length === 0) {
    area.innerHTML = `<p class="analysis-placeholder">結果がありません。</p>`;
    return;
  }

  let html = `<table class="analysis-table">
    <tr><th>店舗</th><th>個数</th><th>販売率</th></tr>`;

  list.forEach(r => {
    html += `<tr>
      <td>${r.store}</td>
      <td>${r.qty}</td>
      <td>${r.rate}%</td>
    </tr>`;
  });

  html += `</table>`;
  area.innerHTML = html;
}

function renderReverseEngineResult(data) {
  const area = document.getElementById("revResult");

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
    html += `<tr>
      <td>${r.store}</td>
      <td>${r.qty}</td>
      <td>${r.rate}%</td>
    </tr>`;
  });

  html += "</table>";
  area.innerHTML = html;
}

function renderForecast(data) {
  if (data.chart && document.querySelector("#forecastChart")) {
    const op = {
      chart: { type: "line", height: 220 },
      series: [{ name: "売れ行き予測", data: data.chart }],
      xaxis: {
        categories: ["今日","明日","3日後","4日後","5日後","6日後","7日後"]
      }
    };
    const chart = new ApexCharts(document.querySelector("#forecastChart"), op);
    chart.render();
  }

  if (data.stores && document.getElementById("storeDemand")) {
    let html = `<table class="analysis-table">
      <tr><th>店舗</th><th>需要★</th><th>コメント</th></tr>`;

    data.stores.forEach(r => {
      html += `<tr>
        <td>${r.store}</td>
        <td>${r.star}</td>
        <td>${r.comment}</td>
      </tr>`;
    });

    html += "</table>";
    document.getElementById("storeDemand").innerHTML = html;
  }

  if (data.comment && document.getElementById("forecastComment")) {
    document.getElementById("forecastComment").innerHTML =
      `<p>${data.comment}</p>`;
  }
}
