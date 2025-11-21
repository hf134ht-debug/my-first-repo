/* =========================================================
   sales.js
   売上画面（カレンダー + 売上カード + 全店計）
========================================================= */

/* ★ あなたの GAS の exec URL ★ */
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

/* =========================================================
   売上用カレンダー（history.js とは別に独立）
========================================================= */

let salesCalYear;
let salesCalMonth;

/* カレンダー描画 */
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

/* 売上タブを開いたときに実行 */
function activateSalesFeatures() {
  const now = new Date();
  salesCalYear  = now.getFullYear();
  salesCalMonth = now.getMonth();

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, now);

  selectSalesDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/* 月移動 */
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

/* 日付クリック */
function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y,m,d));

  loadSales(dateStr);
}

/* =========================================================
   GAS から売上データ取得
   doGet 側で ?sales=YYYY-MM-DD を受ける想定
   （items / summary を返す形）
========================================================= */

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

    /* ===== 上部：全店計（GAS の summary から） ===== */
    const totalAmount = data.summary?.totalAmount || 0;
    const totalQty    = data.summary?.totalQuantity || 0;

    summaryDiv.innerHTML = `
      <div class="history-card cabbage">
        <div class="history-title">📊 全店計</div>
        <div>売上合計：<b>${totalAmount.toLocaleString()} 円</b></div>
        <div>個数合計：<b>${totalQty.toLocaleString()} 個</b></div>
      </div>
    `;

    /* ===== 品目ごとのカード ===== */
    const items = data.items || [];

    // 表示順固定
    const order = ["白菜","白菜カット","キャベツ","キャベツカット","トウモロコシ"];
    items.sort((a, b) => {
      const ai = order.findIndex(o => a.item.includes(o));
      const bi = order.findIndex(o => b.item.includes(o));
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

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
              合計：${item.itemTotalAmount.toLocaleString()}円 / ${item.itemTotalQuantity}個
            </span>
          </div>
          ${item.stores.map(s => `
            <div>・${s.name}：${s.quantity}個（${s.amount.toLocaleString()}円）</div>
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
