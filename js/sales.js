/* =========================================================
   sales.js
   売上画面（カレンダー＋売上カード）
========================================================= */

const SALES_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== 売上画面 HTML ===== */
function renderSalesScreen() {
  return `
    <h2>売上</h2>
    <div id="salesCalendarArea"></div>
    <div id="salesSummary"></div>
    <div id="salesResult"></div>
  `;
}

/* ===== カレンダー（履歴と同じ見た目） ===== */

let salesCalYear;
let salesCalMonth;

function drawSalesCalendar(year, month, selectedDate = null) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const weeks = [];
  let row = [];

  for (let i = 0; i < first.getDay(); i++) row.push(null);

  for (let d = 1; d <= last.getDate(); d++) {
    row.push(new Date(year, month, d));
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }

  const days = ["日","月","火","水","木","金","土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSalesMonth(-1)">＜</button>
        <div><b>${year}年 ${month + 1}月</b></div>
        <button class="cal-btn" onclick="changeSalesMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${days.map(d => `<div class="calendar-day">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
  `;

  weeks.forEach(week => {
    week.forEach(day => {
      if (!day) {
        html += `<div></div>`;
        return;
      }

      const isToday =
        today.getFullYear() === day.getFullYear() &&
        today.getMonth() === day.getMonth() &&
        today.getDate() === day.getDate();

      const isSelected =
        selectedDate &&
        selectedDate.getFullYear() === day.getFullYear() &&
        selectedDate.getMonth() === day.getMonth() &&
        selectedDate.getDate() === day.getDate();

      html += `
        <div
          class="calendar-date ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}"
          onclick="selectSalesDate(${day.getFullYear()},${day.getMonth()},${day.getDate()})"
        >
          ${day.getDate()}
        </div>
      `;
    });
  });

  html += `</div></div>`;
  return html;
}

function activateSalesFeatures() {
  const now = new Date();
  salesCalYear = now.getFullYear();
  salesCalMonth = now.getMonth();

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, now);

  selectSalesDate(now.getFullYear(), now.getMonth(), now.getDate());
}

function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) {
    salesCalMonth = 11;
    salesCalYear--;
  }
  if (salesCalMonth > 11) {
    salesCalMonth = 0;
    salesCalYear++;
  }

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth);
}

/* ===== 日付クリック → 売上読み込み ===== */

async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y, m, d));

  loadSales(dateStr);
}

/* ===== 売上データ取得＆描画 ===== */

async function loadSales(dateStr) {
  const summaryDiv = document.getElementById("salesSummary");
  const resultDiv  = document.getElementById("salesResult");

  summaryDiv.innerHTML = "";
  resultDiv.innerHTML  = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SALES_SCRIPT_URL}?sales=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      summaryDiv.innerHTML = "";
      resultDiv.innerHTML  = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    // ▼ 上部サマリー（総売上・総個数）
    summaryDiv.innerHTML = `
      <div class="history-card">
        <div class="history-title">${dateStr} の売上</div>
        <div>総売上金額：${data.summary.totalAmount} 円</div>
        <div>総販売個数：${data.summary.totalQuantity} 個</div>
      </div>
    `;

    // ▼ 商品ごとのカード
    const items = data.items || [];

    // 表示順固定
    const order = ["白菜","白菜カット","キャベツ","キャベツカット","トウモロコシ"];
    items.sort((a, b) => order.indexOf(a.item) - order.indexOf(b.item));

    let html = "";

    items.forEach(item => {
      let cls = "";
      if (item.item.includes("白菜")) cls = "hakusai";
      else if (item.item.includes("キャベツ")) cls = "cabbage";
      else cls = "corn";

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            ${item.item}
            <span style="float:right;">
              合計：${item.itemTotalAmount}円 / ${item.itemTotalQuantity}個
            </span>
          </div>
          ${item.stores.map(s => `
            <div>・${s.name}：${s.quantity}個（${s.amount}円）</div>
          `).join("")}
        </div>
      `;
    });

    resultDiv.innerHTML = html || `<p>データがありません。</p>`;
  } catch (err) {
    summaryDiv.innerHTML = "";
    resultDiv.innerHTML  = `<p>エラー：${err}</p>`;
  }
}
