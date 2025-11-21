/* =========================================================
   sales.js（売上カレンダー + 売上表示 + データあり日強調）
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

/* ===== カレンダー状態 ===== */
let salesCalYear;
let salesCalMonth;

/* =========================================================
   売上画面を開いた時点では「未選択」
========================================================= */
async function activateSalesFeatures() {
  const now = new Date();
  salesCalYear  = now.getFullYear();
  salesCalMonth = now.getMonth();

  await renderSalesCalendarWithData(salesCalYear, salesCalMonth, null);

  document.getElementById("salesSummary").innerHTML = "";
  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* =========================================================
   月のデータを GAS に問い合わせる
========================================================= */
async function renderSalesCalendarWithData(year, month, selectedDate) {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;

  // GAS: "?checkSalesMonth=YYYY-MM"
  const res = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
  const monthInfo = await res.json();
  const daysWithData = monthInfo.days || [];

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(year, month, selectedDate, daysWithData);
}

/* =========================================================
   カレンダー描画
========================================================= */
function drawSalesCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();

  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const days = ["日","月","火","水","木","金","土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSalesMonth(-1)">＜</button>
        <div><b>${year}年 ${month + 1}月</b></div>
        <button class="cal-btn" onclick="changeSalesMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${days.map(d => `<div class="calendar-day">${d}</div>`).join('')}
      </div>

      <div class="calendar-grid">
  `;

  /* 空白 */
  for (let i = 0; i < first.getDay(); i++) {
    html += `<div></div>`;
  }

  /* 日付 */
  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2, '0');

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
      >${d}</div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* =========================================================
   月移動
========================================================= */
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

  await renderSalesCalendarWithData(salesCalYear, salesCalMonth, null);

  document.getElementById("salesSummary").innerHTML = "";
  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* =========================================================
   日付選択 → 売上読み込み
========================================================= */
async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  await renderSalesCalendarWithData(y, m, new Date(y, m, d));

  loadDailySales(dateStr);
}

/* =========================================================
   GAS から売上データ取得
========================================================= */
async function loadDailySales(dateStr) {
  const summaryDiv = document.getElementById("salesSummary");
  const resultDiv  = document.getElementById("salesResult");

  summaryDiv.innerHTML = "";
  resultDiv.innerHTML  = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SALES_SCRIPT_URL}?sales=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      summaryDiv.innerHTML = "";
      resultDiv.innerHTML  = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    /* ====== 全店計 ====== */
    const totalAmount = data.summary.totalAmount || 0;
    const totalQty    = data.summary.totalQuantity || 0;

    summaryDiv.innerHTML = `
      <div class="history-card cabbage">
        <div class="history-title">📊 全店計</div>
        <div>売上合計：<b>${totalAmount.toLocaleString()} 円</b></div>
        <div>個数合計：<b>${totalQty.toLocaleString()} 個</b></div>
      </div>
    `;

    /* ===== 品目ごと ===== */
    const items = data.items || [];

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

    resultDiv.innerHTML = html;

  } catch (err) {
    summaryDiv.innerHTML = "";
    resultDiv.innerHTML  = `<p>エラー：${err}</p>`;
  }
}
