/* =========================================================
   sales.js
   売上画面（カレンダー + 売上表示）
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

/* データあり日キャッシュ */
const salesMonthDaysCache = {};

/* データあり日チェック */
async function getSalesDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2,'0')}`;
  if (salesMonthDaysCache[ym]) return salesMonthDaysCache[ym];

  const res = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  salesMonthDaysCache[ym] = days;
  return days;
}

/* 売上タブ起動時 */
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

/* カード色判定（白菜・キャベツ対応） */
function getItemColor(name = "") {
  const n = name.replace(/\s/g, "");

  const HAKUSAI = ["白菜","はくさい","ハクサイ","白菜カット","はくさいカット"];
  const CABBAGE = ["キャベツ","きゃべつ","ｷｬﾍﾞﾂ","キャベツカット"];

  if (HAKUSAI.some(k => n.includes(k))) return "hakusai";
  if (CABBAGE.some(k => n.includes(k))) return "cabbage";
  return "corn";
}

/* カレンダー生成 */
function drawSalesCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeSalesMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月</b></div>
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

    const dateObj = new Date(year, month, d);
    const isToday =
      today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === d;
    const isSelected =
      selectedDate &&
      selectedDate.getTime() === dateObj.getTime();
    const hasData = daysWithData.includes(dd);

    html += `
      <div class="calendar-date
        ${isToday ? "today" : ""}
        ${isSelected ? "selected" : ""}
        ${hasData ? "has-data" : ""}"
        onclick="selectSalesDate(${year},${month},${d})"
      >
        ${d}
      </div>`;
  }

  html += `</div></div>`;
  return html;
}

/* 月移動 */
async function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  const days = await getSalesDaysWithData(salesCalYear, salesCalMonth);
  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, days);

  document.getElementById("salesResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* 日選択 */
async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const days = await getSalesDaysWithData(y, m);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y,m,d), days);

  loadDailySales(dateStr);
}

/* 売上取得 */
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

    /* 全店計 */
    html += `
      <div class="history-card cabbage">
        <div class="history-title">
          <span>📊 全店計</span>
          <span class="item-total-badge item-total-cabbage">
            ${Number(data.totalQty)}個 / ${Number(data.totalAmount).toLocaleString()}円
          </span>
        </div>
      </div>
    `;

    /* 品目ごとのカード */
    (data.items || []).forEach(item => {
      const cls = getItemColor(item.item);
      const badgeCls = "item-total-" + cls;

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${item.item}</span>
            <span class="item-total-badge ${badgeCls}">
              合計：${item.totalQty}個 / ${item.totalAmount.toLocaleString()}円
            </span>
          </div>
          ${
            (item.stores || []).map(s => `
              <div>・${s.name}：${s.qty}個（${Number(s.amount).toLocaleString()}円）</div>
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
