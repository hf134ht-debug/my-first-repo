/* =========================================================
   history.js
   - 履歴画面（更新・削除は専用APIを使用）
========================================================= */

const HISTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 品目統一 */
function normalizeItemName(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  const lower = s.toLowerCase();

  if (/[とうトﾄ][う]?も?ろ?こし/.test(s) ||
      lower.includes("corn") ||
      s.includes("ｺｰﾝ") || s.includes("コーン")) {
    return "トウモロコシ";
  }
  if (s.includes("白菜") || s.includes("はくさい") || s.includes("ﾊｸｻｲ")) {
    if (s.includes("ｶｯﾄ") || s.includes("カット") || lower.includes("cut")) {
      return "白菜カット";
    }
    return "白菜";
  }
  if (s.includes("ｷｬﾍﾞﾂ") || s.includes("キャベツ") || s.includes("きゃべつ")) {
    if (s.includes("ｶｯﾄ") || s.includes("カット") || lower.includes("cut")) {
      return "キャベツカット";
    }
    return "キャベツ";
  }

  return s;
}

/* カード色 */
function getItemClass(item) {
  if (!item) return "history-card";
  if (item.includes("白菜")) return "history-card hakusai";
  if (item.includes("キャベツ")) return "history-card cabbage";
  if (item.includes("トウモロコシ")) return "history-card corn";
  return "history-card";
}

/* 履歴画面 HTML */
function renderHistoryScreen() {
  return `
    <h2>履歴</h2>
    <div id="calendarArea"></div>
    <div id="historyResult"><p>日付を選択してください</p></div>
  `;
}

/* ===============================
   カレンダー部分
=============================== */
let calYear, calMonth;
const historyMonthDaysCache = {};
let currentDate = null;

async function getHistoryDaysWithData(year, month) {
  const ym = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (historyMonthDaysCache[ym]) return historyMonthDaysCache[ym];

  const res = await fetch(`${HISTORY_SCRIPT_URL}?checkHistoryMonth=${ym}`);
  const data = await res.json();
  historyMonthDaysCache[ym] = data.days || [];
  return data.days || [];
}

async function activateHistoryFeatures() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  drawHistoryCalendar();
}

async function drawHistoryCalendar(selectedDate = null) {
  const days = await getHistoryDaysWithData(calYear, calMonth);
  document.getElementById("calendarArea").innerHTML =
    drawCalendar(calYear, calMonth, selectedDate, days);
}

function drawCalendar(year, month, selectedDate = null, daysWithData = []) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
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

  for (let i = 0; i < first.getDay(); i++) html += `<div></div>`;

  for (let d = 1; d <= last.getDate(); d++) {
    const dd = String(d).padStart(2,'0');
    const isSelected = selectedDate &&
      selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === d;

    html += `
      <div class="calendar-date
          ${daysWithData.includes(dd) ? "has-data" : ""}
          ${isSelected ? "selected" : ""}"
        onclick="selectHistoryDate(${year},${month},${d})"
      >${d}</div>`;
  }

  return html + `</div></div>`;
}

async function changeMonth(offset) {
  calMonth += offset;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  drawHistoryCalendar();
}

async function selectHistoryDate(y, m, d) {
  currentDate = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  drawHistoryCalendar(new Date(y, m, d));
  loadHistory(currentDate);
}

/* ===============================
   履歴取得
=============================== */
async function loadHistory(dateStr) {
  const container = document.getElementById("historyResult");
  container.innerHTML = `<p>読み込み中…</p>`;

  const res = await fetch(`${HISTORY_SCRIPT_URL}?date=${dateStr}`);
  const data = await res.json();

  if (!data.found) {
    container.innerHTML = `<p>${dateStr} の出荷履歴はありません。</p>`;
    return;
  }

  container.innerHTML = `<h3>${dateStr} の履歴</h3>`;

  data.items.forEach(itemGroup => {
    const card = createItemCard(itemGroup);
    container.appendChild(card);
  });
}

/* ===============================
   カード生成（行番号を埋め込む）
=============================== */
function createItemCard(group) {
  const card = document.createElement("div");
  card.className = getItemClass(group.item);

  let rowsHTML = "";

  group.stores.forEach((s, index) => {
    const row = s.row;  // ← GAS 側で item.stores[] に row を含める
    rowsHTML += `
      <tr>
        <td>${s.name}</td>
        <td>
          <input type="number" value="${s.quantity}" min="0"
            class="qty-input" id="inp-${group.item}-${s.name}">
        </td>
        <td>
          <button class="btn-edit"
            onclick="updateHistoryRow(${row},'${group.item}',${group.price},'${s.name}')">
            ✏
          </button>
        </td>
        <td>
          <button class="btn-delete"
            onclick="deleteHistoryRow(${row})">
            🗑
          </button>
        </td>
      </tr>
    `;
  });

  card.innerHTML = `
    <div class="history-title">
      <span>${group.item}（${group.price}円）</span>
    </div>
    <table class="store-table">${rowsHTML}</table>
  `;

  return card;
}

/* ===============================
   専用 API 呼び出し
=============================== */
async function updateHistoryRow(row, item, price, store) {
  const id = `inp-${item}-${store}`;
  const qty = Number(document.getElementById(id).value || 0);
  if (!confirm("更新しますか？")) return;

  await fetch(HISTORY_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateHistory",
      date: currentDate,
      row,
      item,
      price,
      store,
      quantity: qty
    })
  });

  loadHistory(currentDate);
}

async function deleteHistoryRow(row) {
  if (!confirm("削除しますか？")) return;

  await fetch(HISTORY_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteHistory",   // ★ ここを deleteHistory に
      date: currentDate,
      row
    })
  });

  loadHistory(currentDate);
}

/* === 公開 === */
window.renderHistoryScreen = renderHistoryScreen;
window.activateHistoryFeatures = activateHistoryFeatures;

