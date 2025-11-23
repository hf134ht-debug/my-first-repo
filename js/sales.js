/* =========================================================
   sales.js（売上表示 完全版）
========================================================= */

let selectedSalesDate = null;

function renderSalesScreen() {
  const today = new Date();
  selectedSalesDate = formatDate(today);
  renderSalesCalendar();

  return `
    <h2>売上</h2>
    <div id="salesCalendar"></div>
    <div id="salesResult"></div>
  `;
}

/* カレンダー描画 */
function renderSalesCalendar() {
  const y = selectedSalesDate.slice(0,4);
  const m = selectedSalesDate.slice(5,7);
  const ym = `${y}-${m}`;

  document.getElementById("salesCalendar").innerHTML = `<p>読み込み中...</p>`;

  google.script.run
    .withSuccessHandler(data => drawSalesCalendar(data.days))
    .checkSalesMonth(ym);
}

/* カレンダーUI */
function drawSalesCalendar(daysWithData) {
  const d = new Date(selectedSalesDate + "T00:00:00+09:00");
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();

  let html = `<table class="cal"><tr>`;
  const week = ["日","月","火","水","木","金","土"];
  week.forEach(w => html += `<th>${w}</th>`);
  html += `</tr><tr>`;

  let firstDay = new Date(y, m, 1).getDay();
  for (let i = 0; i < firstDay; i++) html += `<td></td>`;

  for (let day = 1; day <= lastDay; day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const has = daysWithData.includes(String(day).padStart(2,'0'));

    let cls = has ? "has-data" : "";
    let mark = has ? `onclick="selectSalesDate('${ds}')"` : "";

    if (ds === selectedSalesDate)
      cls = "selected";

    html += `<td class="${cls}" ${mark}>${day}</td>`;

    if (new Date(y, m, day).getDay() === 6) html += `</tr><tr>`;
  }

  html += `</tr></table>`;
  document.getElementById("salesCalendar").innerHTML = html;

  loadSalesResult();
}

/* 日付選択 */
function selectSalesDate(ds) {
  selectedSalesDate = ds;
  renderSalesCalendar();
}

/* API取得 */
function loadSalesResult() {
  document.getElementById("salesResult").innerHTML = `<p>取得中...</p>`;

  google.script.run
    .withSuccessHandler(showSalesResult)
    .getSalesData(selectedSalesDate);
}

/* 表示処理 */
function showSalesResult(data) {
  if (!data.found) {
    document.getElementById("salesResult").innerHTML = "<p>データなし</p>";
    return;
  }

  let html = `
    <h3>${selectedSalesDate} 売上</h3>
    <table class="summary-table">
      <tr><th>品目</th><th>数量</th><th>金額</th></tr>
  `;

  data.items.forEach(x => {
    html += `
      <tr>
        <td>${x.item}</td>
        <td>${x.totalQty}</td>
        <td>${x.totalAmount.toLocaleString()} 円</td>
      </tr>`;
  });

  html += `
    <tr class="total">
      <td>合計</td>
      <td>${data.totalQty}</td>
      <td>${data.totalAmount.toLocaleString()} 円</td>
    </tr>
    </table>
  `;

  document.getElementById("salesResult").innerHTML = html;
}

/* Util */
function formatDate(d) {
  return d.toISOString().slice(0,10);
}
