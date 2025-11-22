/* =========================================================
   sales.js
   - 売上画面（カレンダー + 売上表示）
   - 全店計（画面上部）＋ 品目ごと合計バッジ（右上）
========================================================= */

const SALES_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 売上画面 HTML */
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

/* 月ごとのデータ有日キャッシュ { "2025-11": ["01","03",...] } */
const salesMonthDaysCache = {};

/* 月ごとのデータ有日を取得（キャッシュ） */
async function getSalesDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (salesMonthDaysCache[ym]) return salesMonthDaysCache[ym];

  const res = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  salesMonthDaysCache[ym] = days;
  return days;
}

/* 売上タブを開いたとき */
async function activateSalesFeatures() {
  const now = new Date();
  salesCalYear = now.getFullYear();
  salesCalMonth = now.getMonth();

  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, daysWithData);

  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* カレンダー描画（売上用） */
function drawSalesCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const days = ["日","月","火","水","木","金","土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSalesMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月</b></div>
        <button class="cal-btn" onclick="changeSalesMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${days.map(d => `<div class="calendar-day">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
  `;

  // 最初の空白
  for (let i = 0; i < first.getDay(); i++) {
    html += `<div></div>`;
  }

  // 日付
  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,'0');

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

/* 月移動 */
async function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, daysWithData);

  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* 日付クリック → 売上読み込み */
async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const daysWithData = await getSalesDaysWithData(y, m);
  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y,m,d), daysWithData);

  loadDailySales(dateStr);
}

/* 売上データ取得 */
async function loadDailySales(dateStr) {
  const resultDiv = document.getElementById("salesResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SALES_SCRIPT_URL}?salesDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    let html = `<h3>${dateStr} の売上</h3>`;

    /* ▼ 画面上部の全店計カード */
    html += `
      <div class="history-card cabbage">
        <div class="history-title">
          <span>📊 全店計</span>
          <span class="item-total-badge item-total-cabbage">
            ${Number(data.totalQty || 0)}個 /
            ${Number(data.totalAmount || 0).toLocaleString()}円
          </span>
        </div>
      </div>
    `;

    /* ▼ 品目ごとのカード（右上に合計：個数＋金額） */
    (data.items || []).forEach(item => {
      let cls = "corn";
      let badgeCls = "item-total-corn";
      const name = item.item || "";

      if (name.includes("白菜") || name.includes("はくさい")) {
        cls = "hakusai";
        badgeCls = "item-total-hakusai";
      } else if (name.includes("キャベツ")) {
        cls = "cabbage";
        badgeCls = "item-total-cabbage";
      }

      const totalQty    = Number(item.totalQty || 0);
      const totalAmount = Number(item.totalAmount || 0);

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${name}</span>
            <span class="item-total-badge ${badgeCls}">
              合計：${totalQty}個 / ${totalAmount.toLocaleString()}円
            </span>
          </div>
          ${
            (item.stores || []).map(s => `
              <div>
                ・${s.name}：
                  ${Number(s.qty || 0)}個
                  （${Number(s.amount || 0).toLocaleString()}円）
              </div>
            `).join("")
          }
        </div>
      `;
    });

    resultDiv.innerHTML = html;

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}
