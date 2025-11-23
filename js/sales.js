/* =========================================================
   sales.js
   売上タブ
   - カレンダー（売上データ有りの日をマーキング）
   - 品目別売上カード（色分け）
   - 店舗別内訳（アコーディオン）
========================================================= */

/* ★ あなたの GAS exec URL ★ */
const SALES_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== 売上画面 HTML ===== */
function renderSalesScreen() {
  return `
    <h2>売上</h2>
    <div id="salesCalendarArea"></div>
    <div id="salesResult"><p>日付を選択してください</p></div>
  `;
}

/* ===== カレンダー状態 ===== */
let salesCalYear;
let salesCalMonth;

/* 月ごとの「データあり日」キャッシュ { "2025-11": ["01","03",...] } */
const salesMonthDaysCache = {};

/* ===== 月ごとのデータあり日を取得（GAS） ===== */
async function getSalesDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (salesMonthDaysCache[ym]) return salesMonthDaysCache[ym];

  const res  = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  salesMonthDaysCache[ym] = days;
  return days;
}

/* ===== 売上タブを開いたときに呼ぶ ===== */
async function activateSalesFeatures() {
  const now = new Date();
  salesCalYear  = now.getFullYear();
  salesCalMonth = now.getMonth();

  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, daysWithData);

  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* ===== カレンダー描画（売上用） ===== */
function drawSalesCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const daysOfWeek = ["日","月","火","水","木","金","土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSalesMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月</b></div>
        <button class="cal-btn" onclick="changeSalesMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${daysOfWeek.map(d => `<div class="calendar-day">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
  `;

  // 最初の空白（1日が何曜日か）
  for (let i = 0; i < first.getDay(); i++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,"0");

    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;

    const isSelected =
      selectedDate &&
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === d;

    const hasData = daysWithData.includes(dd);

    html += `
      <div
        class="calendar-date
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasData ? "has-data" : ""}"
        onclick="selectSalesDate(${year},${month},${d})"
      >
        ${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* ===== 月移動 ===== */
async function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) {
    salesCalMonth = 11;
    salesCalYear--;
  }
  if (salesCalMonth > 11) {
    salesCalMonth = 0;
    salesCalYear++;
  }

  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, daysWithData);

  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* ===== 日付クリック ===== */
async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const daysWithData = await getSalesDaysWithData(y, m);
  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y,m,d), daysWithData);

  loadSalesData(dateStr);
}

/* =========================================================
   売上データ取得 & 表示
========================================================= */
async function loadSalesData(dateStr) {
  const resultDiv = document.getElementById("salesResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SALES_SCRIPT_URL}?salesDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の売上データがありません。</p>`;
      return;
    }

    const totalQty    = data.totalQty    || 0;
    const totalAmount = data.totalAmount || 0;
    const items       = data.items       || [];

    let html = `
      <h3>${dateStr} の売上</h3>
    `;

    // ===== 全体サマリーカード =====
    html += `
      <div class="history-card summary-total">
        <div class="history-title">
          <span>💰 全体売上</span>
          <span class="item-total-badge summary-badge">
            合計金額：${totalAmount.toLocaleString()}円
          </span>
        </div>
        <div>販売数量：<b>${totalQty}個</b></div>
      </div>
    `;

    // ===== 品目別カード =====
    items.forEach(it => {
      const itemName    = it.item;
      const itemQty     = it.totalQty    || 0;
      const itemAmount  = it.totalAmount || 0;
      const stores      = it.stores      || [];

      // 品目ごとに色分け（白菜 / キャベツ / トウモロコシ）
      let cls = "corn";   // デフォルト：トウモロコシ色
      let badgeCls = "item-total-corn";

      if (itemName.indexOf("白菜") !== -1) {
        cls = "hakusai";
        badgeCls = "item-total-hakusai";
      } else if (itemName.indexOf("キャベツ") !== -1) {
        cls = "cabbage";
        badgeCls = "item-total-cabbage";
      }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${itemName}</span>
            <span class="item-total-badge ${badgeCls}">
              売上：${itemAmount.toLocaleString()}円（${itemQty}個）
            </span>
          </div>
          ${
            stores && stores.length
              ? renderSalesStoreAccordion(stores)
              : `<div style="font-size:0.85em;color:#555;margin-top:4px;">
                   店舗別内訳なし
                 </div>`
          }
        </div>
      `;
    });

    resultDiv.innerHTML = html;

    // アコーディオンにイベント付与
    attachStoreAccordionEvents();

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* ===== 店舗別アコーディオン（売上用） ===== */
function renderSalesStoreAccordion(stores) {
  // stores: [{ name, qty, amount }, ...]
  return `
    <div class="store-accordion">
      <button class="store-accordion-toggle">
        店舗別内訳を表示
      </button>
      <div class="store-accordion-body">
        ${
          stores.map(s => `
            <div class="store-accordion-row">
              <b>${s.name}</b><br>
              個数：${s.qty}個 /
              金額：${s.amount.toLocaleString()}円
            </div>
          `).join("")
        }
      </div>
    </div>
  `;
}

/* ===== アコーディオン動作（共通） ===== */
function attachStoreAccordionEvents() {
  const toggles = document.querySelectorAll(".store-accordion-toggle");

  toggles.forEach(btn => {
    btn.onclick = () => {
      const body = btn.nextElementSibling;
      if (!body) return;

      const isOpen = body.classList.contains("open");
      if (isOpen) {
        // 閉じる（バネ感を少しだけ）
        body.style.maxHeight = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
          body.classList.remove("open");
        });
      } else {
        // 開く
        body.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    };
  });
}
