/************************************************************
 * sales.js（完全版）
 * 売上タブ
 * - カレンダー（売上データ有りの日をマーキング）
 * - 品目別売上カード（色分け＆順序固定）
 * - 店舗別内訳（アコーディオン）
 ************************************************************/

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

/* ===== キャッシュ ===== */
const salesMonthDaysCache = {};

/* ===== GAS：月のデータあり日 ===== */
async function getSalesDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (salesMonthDaysCache[ym]) return salesMonthDaysCache[ym];

  const res  = await fetch(`${SALES_SCRIPT_URL}?checkSalesMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];
  salesMonthDaysCache[ym] = days;
  return days;
}

/* ===== 初期起動 ===== */
async function activateSalesFeatures() {
  const now = new Date();
  salesCalYear  = now.getFullYear();
  salesCalMonth = now.getMonth();

  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);
  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, daysWithData);
}

/* ===== カレンダー描画 ===== */
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

  for (let i = 0; i < first.getDay(); i++) html += `<div></div>`;

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,"0");
    const isToday = today.getFullYear()==year && today.getMonth()==month && today.getDate()==d;
    const isSelected = selectedDate && selectedDate.getDate()==d;
    const hasData = daysWithData.includes(dd);

    html += `
      <div class="calendar-date
          ${isToday ? "today" : ""}
          ${isSelected ? "selected" : ""}
          ${hasData ? "has-data" : ""}"
        onclick="selectSalesDate(${year},${month},${d})">
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
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  const daysWithData = await getSalesDaysWithData(salesCalYear, salesCalMonth);
  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(salesCalYear, salesCalMonth, null, daysWithData);
}

/* ===== 日付選択 ===== */
async function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const daysWithData = await getSalesDaysWithData(y, m);

  document.getElementById("salesCalendarArea").innerHTML =
    drawSalesCalendar(y, m, new Date(y,m,d), daysWithData);

  loadSalesData(dateStr);
}

/* ===== 売上取得 ===== */
async function loadSalesData(dateStr) {
  const resultDiv = document.getElementById("salesResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res  = await fetch(`${SALES_SCRIPT_URL}?salesDate=${dateStr}`);
    const data = await res.json();
    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} のデータがありません</p>`;
      return;
    }

    let items = data.items || [];
    const order = ['白菜','白菜カット','キャベツ','キャベツカット','トウモロコシ'];
    items.sort((a,b)=>(order.indexOf(a.item)-order.indexOf(b.item)));

    let html = `
      <h3>${dateStr} の売上</h3>
      <div class="history-card summary-total">
        <div class="history-title">
          <span>💰全体売上</span>
          <span class="item-total-badge summary-badge">
            金額：${data.totalAmount.toLocaleString()}円
          </span>
        </div>
        <div>販売数量：<b>${data.totalQty}</b> 個</div>
      </div>
    `;

    items.forEach(it => {
      let cls="",badgeCls="";
      if(it.item.includes("白菜")){ cls="hakusai"; badgeCls="item-total-hakusai";}
      else if(it.item.includes("キャベツ")){ cls="cabbage"; badgeCls="item-total-cabbage";}
      else{ cls="corn"; badgeCls="item-total-corn"; }

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">
            <span>${it.item}</span>
            <span class="item-total-badge ${badgeCls}">
              ${it.totalAmount.toLocaleString()}円 (${it.totalQty}個)
            </span>
          </div>
          ${renderSalesStoreAccordion(it.stores)}
        </div>
      `;
    });

    resultDiv.innerHTML = html;
    attachStoreAccordionEvents();

  } catch(err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* ===== 店舗別内訳 ===== */
function renderSalesStoreAccordion(stores){
  if(!stores || !stores.length) return "";
  return `
    <div class="store-accordion">
      <button class="store-accordion-toggle">店舗別内訳</button>
      <div class="store-accordion-body">
        ${stores.map(s=>`
          <div class="store-accordion-row">
            <b>${s.name}</b>：${s.qty}個 / ${s.amount.toLocaleString()}円
          </div>`).join("")}
      </div>
    </div>`;
}

/* ===== アコーディオン ===== */
function attachStoreAccordionEvents(){
  document.querySelectorAll(".store-accordion-toggle")
    .forEach(btn=>{
      btn.onclick=()=>{
        const body=btn.nextElementSibling;
        body.classList.toggle("open");
        body.style.maxHeight = body.classList.contains("open") ?
          body.scrollHeight+"px" : "0px";
      };
    });
}
