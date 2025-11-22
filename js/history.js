/* =========================================================
   history.js
   - 履歴画面
   - カレンダー：データがある日だけ色付け (#fdf5cc)
   - 初期表示は日付未選択
========================================================= */

const HISTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 履歴画面 HTML */
function renderHistoryScreen() {
  return `
    <h2>履歴</h2>
    <div id="calendarArea"></div>
    <div id="historyResult"><p>日付を選択してください</p></div>
  `;
}

/* カレンダー状態 */
let calYear;
let calMonth;

/* 月ごとのデータ有日キャッシュ { "2025-11": ["01","03",...] } */
const historyMonthDaysCache = {};

/* 月ごとのデータ有日を取得（キャッシュ付き） */
async function getHistoryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (historyMonthDaysCache[ym]) return historyMonthDaysCache[ym];

  const res = await fetch(`${HISTORY_SCRIPT_URL}?checkHistoryMonth=${ym}`);
  const data = await res.json();
  const days = data.days || [];

  historyMonthDaysCache[ym] = days;
  return days;
}

/* 履歴タブを開いたとき */
async function activateHistoryFeatures() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  const daysWithData = await getHistoryDaysWithData(calYear, calMonth);

  document.getElementById("calendarArea").innerHTML =
    drawCalendar(calYear, calMonth, null, daysWithData);

  document.getElementById("historyResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* カレンダー描画 */
function drawCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);

  const days = ["日","月","火","水","木","金","土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月</b></div>
        <button class="cal-btn" onclick="changeMonth(1)">＞</button>
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
        onclick="selectHistoryDate(${year},${month},${d})"
      >
        ${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* 月移動 */
async function changeMonth(offset) {
  calMonth += offset;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }

  const daysWithData = await getHistoryDaysWithData(calYear, calMonth);

  document.getElementById("calendarArea").innerHTML =
    drawCalendar(calYear, calMonth, null, daysWithData);

  document.getElementById("historyResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* 日付クリック → 履歴読み込み */
async function selectHistoryDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const daysWithData = await getHistoryDaysWithData(y, m);
  document.getElementById("calendarArea").innerHTML =
    drawCalendar(y, m, new Date(y,m,d), daysWithData);

  loadHistory(dateStr);
}

/* 履歴データ取得 */
async function loadHistory(dateStr) {
  const resultDiv = document.getElementById("historyResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${HISTORY_SCRIPT_URL}?date=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の記録はありません。</p>`;
      return;
    }

    let html = `<h3>${dateStr} の履歴</h3>`;

    data.items.forEach(item => {
      let cls = "";
      if (item.item.includes("白菜")) cls = "hakusai";
      else if (item.item.includes("キャベツ")) cls = "cabbage";
      else cls = "corn";

      html += `
        <div class="history-card ${cls}">
          <div class="history-title">${item.item}（${item.price}円）</div>
          ${item.stores.map(s => `<div>・${s.name}：${s.quantity}</div>`).join("")}
          <div class="history-total">合計：${item.total}個</div>
        </div>
      `;
    });

    resultDiv.innerHTML = html;

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}
