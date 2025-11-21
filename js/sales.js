/* =========================================================
   history.js（履歴画面 + カレンダーのデータ判定）
========================================================= */

const HISTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ------- 履歴画面 HTML ------- */
function renderHistoryScreen() {
  return `
    <h2>履歴</h2>
    <div id="calendarArea"></div>
    <div id="historyResult"></div>
  `;
}

/* ===== カレンダー状態 ===== */
let calYear;
let calMonth;

/* =========================================================
   履歴画面を開くと「未選択のカレンダー」を表示する
========================================================= */
async function activateHistoryFeatures() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  await renderCalendarWithData(calYear, calMonth, null);
  document.getElementById("historyResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* =========================================================
   月のデータを GAS に問い合わせてカレンダーに反映
========================================================= */
async function renderCalendarWithData(year, month, selectedDate) {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;

  // GAS から「データがある日一覧」を取得
  const res = await fetch(`${HISTORY_SCRIPT_URL}?checkMonth=${ym}`);
  const monthInfo = await res.json();
  const daysWithData = monthInfo.days || [];

  // カレンダー描画
  document.getElementById("calendarArea").innerHTML =
    drawCalendar(year, month, selectedDate, daysWithData);
}

/* =========================================================
   カレンダー生成
   ※ daysWithData[] = ["01","05","22"] のようにデータあり日
========================================================= */
function drawCalendar(year, month, selectedDate = null, daysWithData = []) {
  const today = new Date();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const days = ["日", "月", "火", "水", "木", "金", "土"];

  let html = `
    <div class="calendar-wrapper">
      <div class="calendar-header">
        <button class="cal-btn" onclick="changeMonth(-1)">＜</button>
        <div><b>${year}年 ${month+1}月</b></div>
        <button class="cal-btn" onclick="changeMonth(1)">＞</button>
      </div>

      <div class="calendar-grid">
        ${days.map(d => `<div class="calendar-day">${d}</div>`).join('')}
      </div>

      <div class="calendar-grid">
  `;

  // 最初の空白
  for (let i = 0; i < first.getDay(); i++) {
    html += `<div></div>`;
  }

  // 日付
  for (let d = 1; d <= last.getDate(); d++) {
    const dateObj = new Date(year, month, d);
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
        onclick="selectHistoryDate(${year},${month},${d})"
      >
        ${d}
      </div>
    `;
  }

  html += `</div></div>`;
  return html;
}

/* =========================================================
   月移動
========================================================= */
async function changeMonth(offset) {
  calMonth += offset;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }

  await renderCalendarWithData(calYear, calMonth, null);
  document.getElementById("historyResult").innerHTML =
    `<p>日付を選択してください</p>`;
}

/* =========================================================
   日付クリック → 履歴データ読み込み
========================================================= */
async function selectHistoryDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  await renderCalendarWithData(y, m, new Date(y, m, d));
  loadHistory(dateStr);
}

/* =========================================================
   履歴データ取得
========================================================= */
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
