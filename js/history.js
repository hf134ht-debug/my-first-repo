/* =========================================================
   history.js
   - 履歴（和紙カレンダー）
   - 日付クリック → GASからデータ取得
========================================================= */

/* ===== デプロイ URL ===== */
const HISTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";


/* ===== 履歴画面 HTML ===== */
function renderHistoryScreen() {
  return `
    <h2>履歴</h2>
    <div id="calendarArea"></div>
    <div id="historyResult"></div>
  `;
}


/* ===== カレンダー生成 ===== */
function drawCalendar(year, month, selectedDate = null) {
  const today = new Date();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

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

  const days = ["日", "月", "火", "水", "木", "金", "土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeMonth(-1)">＜</button>
        <div><b>${year}年 ${month + 1}月</b></div>
        <button class="cal-btn" onclick="changeMonth(1)">＞</button>
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
          onclick="selectHistoryDate(${day.getFullYear()},${day.getMonth()},${day.getDate()})"
        >
          ${day.getDate()}
        </div>
      `;
    });
  });

  html += `</div></div>`;
  return html;
}


/* ===== カレンダーの状態 ===== */
let calYear;
let calMonth;


/* ===== 履歴画面を表示したタイミングで初期化 ===== */
function activateHistoryFeatures() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  document.getElementById("calendarArea").innerHTML =
    drawCalendar(calYear, calMonth, now);

  selectHistoryDate(now.getFullYear(), now.getMonth(), now.getDate());
}


/* ===== 月移動 ===== */
function changeMonth(offset) {
  calMonth += offset;

  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }

  document.getElementById("calendarArea").innerHTML =
    drawCalendar(calYear, calMonth);
}


/* ===== 日付クリック → 履歴を読み込む ===== */
function selectHistoryDate(y, m, d) {
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  document.getElementById("calendarArea").innerHTML =
    drawCalendar(y, m, new Date(y, m, d));

  loadHistory(dateStr);
}


/* ===== GAS から履歴を取得 ===== */
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
