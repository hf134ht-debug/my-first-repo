/* ===============================
   sales.js（売上画面 完全版）
=============================== */

const SALES_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 売上メイン画面 */
function renderSalesScreen() {
  return `
    <h2>売上</h2>
    <div id="salesCalendarArea"></div>
    <div id="salesResult"><p>日付を選択してください</p></div>
  `;
}

/* カレンダー状態 */
let salesCalYear;
let salesCalMonth;

/* 月ごとのデータ有日キャッシュ */
const salesMonthDaysCache = {};

/* 月データ有日取得 */
async function getSalesDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2,'0')}`;

  if (salesMonthDaysCache[ym]) return salesMonthDaysCache[ym];

  const res = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  salesMonthDaysCache[ym] = days;
  return days;
}

/* 売上タブ初期化 */
async function activateSalesFeatures() {
  const now = new Date();
  salesCalYear  = now.getFullYear();
  salesCalMonth = now.getMonth();

  await updateSalesCalendar();
}

/* カレンダー更新 */
async function updateSalesCalendar(selectedDate = null) {
  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, selectedDate, daysWithData);
}

/* カレンダー描画 */
function drawSalesCalendar(year, month, selectedDate, daysWithData) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSalesMonth(-1)">＜</button>
        <b>${year}年 ${month+1}月</b>
        <button class="cal-btn" onclick="changeSalesMonth(1)">＞</button>
      </div>
      <div class="calendar-grid">
        ${["日","月","火","水","木","金","土"].map(d => `<div class="calendar-day">${d}</div>`).join("")}
      </div>
      <div class="calendar-grid">
  `;

  for (let i = 0; i < first.getDay(); i++) html += `<div></div>`;

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,'0');
    const day = new Date(year, month, d);

    const isToday =
      day.getFullYear() === today.getFullYear() &&
      day.getMonth() === today.getMonth() &&
      day.getDate() === today.getDate();

    const isSelected = selectedDate &&
      day.getFullYear() === selectedDate.getFullYear() &&
      day.getMonth() === selectedDate.getMonth() &&
      day.getDate() === selectedDate.getDate();

    const hasData = daysWithData.includes(dd);

    html += `
      <div
        class="calendar-date
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasData ? "has-data" : ""}"
        onclick="selectSalesDate(${year},${month},${d})"
      >${d}</div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* 月移動 */
async function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  await updateSalesCalendar();
  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* 日付選択 */
async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  await updateSalesCalendar(new Date(y, m, d));
  loadDailySales(dateStr);
}

/* 売上取得 */
async function loadDailySales(dateStr) {
  const r = document.getElementById("salesResult");
  r.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SALES_SCRIPT_URL}?salesDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      r.innerHTML = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    let html = `<h3>${dateStr} の売上</h3>`;

    /* ▼全店計カード */
    html += `
      <div class="history-card total-all">
        <div class="history-title">
          📊 全店計
          <span class="item-total-badge item-total-all">
            ${data.totalQty}個 / ${data.totalAmount.toLocaleString()}円
          </span>
        </div>
      </div>
    `;

    /* ▼品目ごとのカード */
    (data.items || []).forEach(item => {
      const nm = item.item || "";
      let cls = "corn";
      let badge = "item-total-corn";

      if (nm.includes("白菜") || nm.includes("はくさい")) {
        cls = "hakusai"; badge = "item-total-hakusai";
      } else if (nm.includes("キャベツ")) {
        cls = "cabbage"; badge = "item-total-cabbage";
      }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            ${nm}
            <span class="item-total-badge ${badge}">
              ${item.totalQty}個 / ${item.totalAmount.toLocaleString()}円
            </span>
          </div>
          ${
            item.stores.map(s =>
              `<div>・${s.name}：${s.qty}個（${s.amount.toLocaleString()}円）</div>`
            ).join("")
          }
        </div>
      `;
    });

    r.innerHTML = html;

  } catch (err) {
    r.innerHTML = `<p>エラー：${err}</p>`;
  }
}
