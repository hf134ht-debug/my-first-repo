/* =========================================================
   sales.js（完全修正版）
========================================================= */

const SALES_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

function renderSalesScreen() {
  return `
    <h2>売上</h2>
    <div id="salesCalendarArea"></div>
    <div id="salesSummary"></div>
    <div id="salesResult"></div>
  `;
}

let salesCalYear, salesCalMonth;

function drawSalesCalendar(year, month, selectedDate = null) {
  return drawCalendar(year, month, selectedDate, "sales");
}

function activateSalesFeatures() {
  const now = new Date();
  salesCalYear = now.getFullYear();
  salesCalMonth = now.getMonth();

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null);

  document.getElementById("salesSummary").innerHTML = "";
  document.getElementById("salesResult").innerHTML = "";
}

function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null);

  document.getElementById("salesSummary").innerHTML = "";
  document.getElementById("salesResult").innerHTML = "";
}

function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y,m,d));

  loadSales(dateStr);
}

async function loadSales(dateStr) {
  const summaryDiv = document.getElementById("salesSummary");
  const resultDiv  = document.getElementById("salesResult");

  summaryDiv.innerHTML = "";
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SALES_SCRIPT_URL}?sales=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      summaryDiv.innerHTML = "";
      resultDiv.innerHTML = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    const { summary, items } = data;
    const totalAmount = summary.totalAmount ?? 0;
    const totalQty = summary.totalQuantity ?? 0;

    summaryDiv.innerHTML = `
      <div class="history-card cabbage">
        <b>📊 全店計</b><br>
        売上合計：<b>${totalAmount.toLocaleString()} 円</b><br>
        個数合計：<b>${totalQty.toLocaleString()} 個</b>
      </div>
    `;

    const order = ['白菜','白菜カット','キャベツ','キャベツカット','トウモロコシ'];
    items.sort((a,b)=>
      order.findIndex(o=>a.item.includes(o)) - order.findIndex(o=>b.item.includes(o))
    );

    let html = "";

    items.forEach(item => {
      let cls = item.item.includes("白菜") ? "hakusai"
              : item.item.includes("キャベツ") ? "cabbage"
              : "corn";

      html += `
        <div class="history-card ${cls}">
          <b>${item.item}</b><br>
          ${item.stores.map(s=>`
            ・${s.name}：${s.quantity}個（${s.amount.toLocaleString()}円）
          `).join("")}
          <div style="text-align:right;margin-top:6px;">
            小計：<b>${item.itemTotalQuantity}個 ／ ${item.itemTotalAmount.toLocaleString()}円</b>
          </div>
        </div>
      `;
    });

    resultDiv.innerHTML = html || `<p>データがありません。</p>`;

  } catch(e) {
    summaryDiv.innerHTML = "";
    resultDiv.innerHTML = `<p>エラー：${e}</p>`;
  }
}
