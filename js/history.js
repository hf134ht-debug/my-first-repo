/* =========================================================
   history.js
   - 履歴画面
========================================================= */

const HISTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* 品目統一（GASと同仕様） */
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

/* カード色設定 */
function getItemClass(item) {
  if (!item) return "history-card";
  if (item.includes("白菜")) return "history-card hakusai";
  if (item.includes("キャベツ")) return "history-card cabbage";
  if (item.includes("トウモロコシ")) return "history-card corn";
  return "history-card"; // その他
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
   カレンダー（既存のまま）
=============================== */
let calYear, calMonth;
const historyMonthDaysCache = {};

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
  const today = new Date();
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
      >
        ${d}
      </div>
    `;
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
   履歴データ取得＋表示
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

  const order = ["白菜","白菜カット","キャベツ","キャベツカット","トウモロコシ"];

 // ★ normalize & 再グループ化（品目＋値段で分離）
const grouped = {};

data.items.forEach(item => {
  const norm = normalizeItemName(item.item);
  const key = `${norm}__${item.price}`; // ← 品目＋値段の複合キー

  if (!grouped[key]) {
    grouped[key] = {
      item: norm,
      price: item.price,
      total: 0,
      stores: []
    };
  }

  grouped[key].total += item.total;
  grouped[key].stores = grouped[key].stores.concat(item.stores);
});

// ソート順（品目→値段昇順）
const sortedKeys = Object.keys(grouped).sort((a, b) => {
  const [ai, ap] = [normalizeItemName(grouped[a].item), grouped[a].price];
  const [bi, bp] = [normalizeItemName(grouped[b].item), grouped[b].price];

  const order = ["白菜","白菜カット","キャベツ","キャベツカット","トウモロコシ"];
  const aiIdx = order.indexOf(ai);
  const biIdx = order.indexOf(bi);

  if (aiIdx !== biIdx) return aiIdx - biIdx;
  return ap - bp; // ← 同一品目なら値段順に表示
});

// カード生成
sortedKeys.forEach(key => {
  const card = createItemCard(grouped[key]);
  container.appendChild(card);
});

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  sortedKeys.forEach(key => {
    const card = createItemCard(grouped[key]);
    container.appendChild(card);
  });
}

/* ===============================
   カードUI生成（★従来デザイン）
=============================== */

function createItemCard(item) {
  const card = document.createElement("div");
  card.className = getItemClass(item.item);

  card.innerHTML = `
    <div class="history-title">
      <span>${item.item}（${item.price}円）</span>
      <span class="item-total-badge">${item.total}個</span>
    </div>
    <table class="store-table">
      ${item.stores.map(s => `
        <tr>
          <td>${s.name}</td>
          <td><input type="number" value="${s.quantity}" min="0"
              class="qty-input" id="inp-${item.item}-${s.name}">
          </td>
          <td>
            <button class="btn-edit"
              onclick="updateShipment('${item.item}',${item.price},'${s.name}')">
              ✏</button>
          </td>
          <td>
            <button class="btn-delete"
              onclick="deleteShipment('${item.item}',${item.price},'${s.name}')">
              🗑</button>
          </td>
        </tr>
      `).join("")}
    </table>
  `;

  return card;
}

/* ===============================
   更新 & 削除 API
=============================== */

function updateShipment(item, price, store) {
  const id = `inp-${item}-${store}`;
  const qty = Number(document.getElementById(id).value || 0);
  if (!confirm("更新しますか？")) return;

  fetch(HISTORY_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateShipment",
      date: currentDate,
      item, price, store, quantity: qty
    })
  }).then(() => loadHistory(currentDate));
}

function deleteShipment(item, price, store) {
  if (!confirm("削除しますか？")) return;

  fetch(HISTORY_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteShipment",
      date: currentDate,
      item, price, store
    })
  }).then(() => loadHistory(currentDate));
}

