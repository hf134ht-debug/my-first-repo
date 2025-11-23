/* =========================================================
   sales.js : 売上データ表示（REST API fetch版 完全）
========================================================= */

/* ★ あなたの GAS Web API URL ★ */
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 売上画面HTML */
function renderSalesScreen() {
  return `
    <h2>売上</h2>
    <div id="salesCalendar"></div>
    <div id="salesResult"><p>日付を選択してください</p></div>
  `;
}

/* 初期ロード */
async function activateSalesFeatures() {
  const today = new Date();
  salesCalYear = today.getFullYear();
  salesCalMonth = today.getMonth();

  const days = await fetchSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendar").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, days);
}

/* 取得した「データあり日」キャッシュ */
const salesDaysCache = {};

async function fetchSalesDaysWithData(year, month) {
  const ym = `${year}-${String(month+1).padStart(2,'0')}`;
  if (salesDaysCache[ym]) return salesDaysCache[ym];

  const res = await fetch(`${GAS_URL}?checkSalesMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];
  salesDaysCache[ym] = days;
  return days;
}

function drawSalesCalendar(year, month, selectedDate=null, daysWithData=[]) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month+1, 0);

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button onclick="changeSalesMonth(-1)">＜</button>
        <span>${year}年 ${month+1}月</span>
        <button onclick="changeSalesMonth(1)">＞</button>
      </div>
      <div class="calendar-grid">
  `;

  ["日","月","火","水","木","金","土"].forEach(d => {
    html += `<div class="calendar-day">${d}</div>`;
  });

  for (let i = 0; i < first.getDay(); i++) html += `<div></div>`;

  for (let d=1; d<=last.getDate(); d++) {
    const dd = String(d).padStart(2,"0");
    const has = daysWithData.includes(dd);
    const isSel = selectedDate &&
      selectedDate.getDate() === d &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year;

    html += `
      <div class="calendar-date ${has?'has-data':''} ${isSel?'selected':''}"
        onclick="selectSalesDate(${year},${month},${d})">
        ${d}
      </div>`;
  }

  html += `</div></div>`;
  return html;
}

/* 月移動時 */
async function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  const days = await fetchSalesDaysWithData(salesCalYear, salesCalMonth);

  document.getElementById("salesCalendar").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, days);

  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* 日付クリック */
async function selectSalesDate(y,m,d) {
  const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const days = await fetchSalesDaysWithData(y, m);
  document.getElementById("salesCalendar").innerHTML =
    drawSalesCalendar(y,m,new Date(y,m,d), days);

  loadSalesData(dateStr);
}

/* API fetch 売上データ取得 */
async function loadSalesData(dateStr) {
  document.getElementById("salesResult").innerHTML = `<p>読み込み中...</p>`;

  try {
    const res = await fetch(`${GAS_URL}?salesDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      document.getElementById("salesResult").innerHTML = `<p>データなし</p>`;
      return;
    }

    let html = `
      <h3>${dateStr} 売上</h3>
      <table class="sales-table">
        <tr>
          <th>品目</th><th>数量</th><th>金額</th>
        </tr>
    `;

    data.items.forEach(i => {
      html += `<tr>
          <td>${i.item}</td>
          <td>${i.totalQty}</td>
          <td>${i.totalAmount.toLocaleString()} 円</td>
        </tr>`;
    });

    html += `</table>
      <p><b>総数量:</b> ${data.totalQty} / <b>総額:</b> ${data.totalAmount.toLocaleString()} 円</p>
    `;

    document.getElementById("salesResult").innerHTML = html;
  } catch(e) {
    document.getElementById("salesResult").innerHTML = `<p>エラー: ${e}</p>`;
  }
}
