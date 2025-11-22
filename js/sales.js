/* =========================================================
   sales.js（売上カレンダー + 売上表示）
   修正版：全店計 正常化 / データあり日強調 / 初期未選択
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

/* 月データキャッシュ（高速化） */
const salesMonthCache = {};  // {"2025-11": ["01","03",...]}

/* 売上タブを開いたとき */
async function activateSalesFeatures() {
  const now = new Date();
  salesCalYear = now.getFullYear();
  salesCalMonth = now.getMonth();

  await updateSalesCalendar();
  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
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

/* カレンダー更新 */
async function updateSalesCalendar(selectedDate=null) {
  const ym = `${salesCalYear}-${String(salesCalMonth+1).padStart(2,'0')}`;

  if (!salesMonthCache[ym]) {
    const res = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
    const data = await res.json();
    salesMonthCache[ym] = data.days || [];
  }

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, selectedDate, salesMonthCache[ym]);
}

/* カレンダー生成 */
function drawSalesCalendar(year, month, selectedDate=null, daysWithData=[]) {
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
        ${days.map(d=>`<div class="calendar-day">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
  `;

  for (let i = 0; i < first.getDay(); i++) html += `<div></div>`;

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,'0');
    const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
    const isSelected = selectedDate &&
                       selectedDate.getFullYear()===year &&
                       selectedDate.getMonth()===month &&
                       selectedDate.getDate()===d;

    const hasData = daysWithData.includes(dd);

    html += `
      <div class="calendar-date
        ${isToday ? 'today':''}
        ${isSelected ? 'selected':''}
        ${hasData ? 'has-data':''}"
      onclick="selectSalesDate(${year},${month},${d})">${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* 日付クリック */
async function selectSalesDate(y,m,d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  await updateSalesCalendar(new Date(y,m,d));
  loadDailySales(dateStr);
}

/* 売上データ取得 */
async function loadDailySales(dateStr) {
  const resultDiv = document.getElementById("salesResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SALES_SCRIPT_URL}?salesDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    const { totalQty=0, totalAmount=0, items=[] } = data;

    let html = `
      <h3>${dateStr} の売上</h3>
      <div class="history-card cabbage">
        <div class="history-title">
          📊 全店計
          <span class="item-total-badge item-total-cabbage">
            ${totalQty}個 / ${totalAmount.toLocaleString()}円
          </span>
        </div>
      </div>
    `;

    items.forEach(item => {
      const name = item.item || "";
      let cls = "corn", badgeCls="item-total-corn";
      if (name.includes("白菜")) { cls="hakusai"; badgeCls="item-total-hakusai"; }
      else if (name.includes("キャベツ")) { cls="cabbage"; badgeCls="item-total-cabbage"; }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            ${name}
            <span class="item-total-badge ${badgeCls}">
              合計：${item.totalQty}個 / ${item.totalAmount.toLocaleString()}円
            </span>
          </div>
          ${(item.stores||[]).map(s => `
            <div>・${s.name}：${s.qty}個（${s.amount.toLocaleString()}円）</div>
          `).join("")}
        </div>
      `;
    });

    resultDiv.innerHTML = html;

  } catch(err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}
