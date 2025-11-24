/* =========================================================
   history.js
   - 履歴画面
   - カレンダー：データがある日だけ色付け
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
  // updateShipment / deleteShipment 用に保持
  window.currentDate = dateStr;

  const resultDiv = document.getElementById("historyResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${HISTORY_SCRIPT_URL}?date=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の記録はありません。</p>`;
      return;
    }

    resultDiv.innerHTML = `<h3>${dateStr} の履歴</h3>`;

    data.items.forEach(item => {
      const card = createItemCard(item);
      resultDiv.appendChild(card);
    });

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}

/* =========================================================
   店舗リスト付きの履歴カード表示（色・レイアウトは従来のまま）
   ＋ 店舗ごとの ✏ / 🗑 ボタン（①：常に表示）
========================================================= */
function createItemCard(itemData) {
  const card = document.createElement('div');

  // 品目名からカード色クラスを決定（CSS の .history-card.hakusai 等に対応）
  let cls = "";
  if (itemData.item.includes("白菜")) cls = "hakusai";
  else if (itemData.item.includes("キャベツ")) cls = "cabbage";
  else if (itemData.item.includes("トウモロコシ") || itemData.item.includes("とうもろこし")) cls = "corn";

  card.className = `history-card ${cls}`;

  // タイトル行（品目＋値段、右側に合計バッジ）
  const title = document.createElement('div');
  title.className = 'history-title';

  const titleLeft = document.createElement('span');
  titleLeft.textContent = `${itemData.item}（${itemData.price}円）`;

  const totalBadge = document.createElement('span');
  let badgeClass = "";
  if (cls === "hakusai") badgeClass = "item-total-hakusai";
  else if (cls === "cabbage") badgeClass = "item-total-cabbage";
  else if (cls === "corn") badgeClass = "item-total-corn";

  totalBadge.className = `item-total-badge ${badgeClass}`;
  totalBadge.textContent = `合計 ${itemData.total} 個`;

  title.appendChild(titleLeft);
  title.appendChild(totalBadge);
  card.appendChild(title);

  // アコーディオン本体
  const accordion = document.createElement('div');
  accordion.className = 'store-accordion';

  const toggle = document.createElement('button');
  toggle.className = 'store-accordion-toggle';
  toggle.textContent = '店舗別を表示';

  const body = document.createElement('div');
  body.className = 'store-accordion-body';

  // 開閉処理（高さアニメーション）
  toggle.onclick = () => {
    const isOpen = body.classList.toggle('open');
    if (isOpen) {
      body.style.maxHeight = body.scrollHeight + 'px';
      toggle.textContent = '店舗別を閉じる';
    } else {
      body.style.maxHeight = 0;
      toggle.textContent = '店舗別を表示';
    }
  };

  // 店舗ごとのテーブル（数量＋編集＋削除）
  const table = document.createElement('table');
  table.className = 'store-table';

  itemData.stores.forEach(s => {
    const tr = document.createElement('tr');

    // 店舗名
    const tdStore = document.createElement('td');
    tdStore.textContent = s.name;
    tr.appendChild(tdStore);

    // 現在数量の表示（「◯個」）
    const tdQtyLabel = document.createElement('td');
    tdQtyLabel.textContent = `${s.quantity} 個`;
    tr.appendChild(tdQtyLabel);

    // 数量入力欄
    const tdInput = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 0;
    input.value = s.quantity;
    input.className = 'qty-input';
    tdInput.appendChild(input);
    tr.appendChild(tdInput);

    // ✏ 更新ボタン（①：常に表示）
    const tdUpdate = document.createElement('td');
    const btnUpdate = document.createElement('button');
    btnUpdate.textContent = '✏';
    btnUpdate.className = 'btn-edit';
    btnUpdate.onclick = () => {
      updateShipment(itemData, s.name, input.value);
    };
    tdUpdate.appendChild(btnUpdate);
    tr.appendChild(tdUpdate);

    // 🗑 削除ボタン（①：常に表示）
    const tdDelete = document.createElement('td');
    const btnDelete = document.createElement('button');
    btnDelete.textContent = '🗑';
    btnDelete.className = 'btn-delete';
    btnDelete.onclick = () => {
      deleteShipment(itemData, s.name);
    };
    tdDelete.appendChild(btnDelete);
    tr.appendChild(tdDelete);

    table.appendChild(tr);
  });

  body.appendChild(table);
  accordion.appendChild(toggle);
  accordion.appendChild(body);
  card.appendChild(accordion);

  return card;
}

/* =========================================================
   数量更新（updateShipment）
========================================================= */
function updateShipment(itemData, store, qty) {
  if (!confirm("更新しますか？")) return;

  fetch(HISTORY_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "updateShipment",
      date: currentDate,
      item: itemData.item,
      price: itemData.price,
      store: store,
      quantity: Number(qty)
    })
  }).then(() => {
    alert("更新しました");
    loadHistory(currentDate); // 再読込
  }).catch(err => {
    alert("エラー: " + err);
  });
}

/* =========================================================
   削除（deleteShipment）
========================================================= */
function deleteShipment(itemData, store) {
  if (!confirm("削除しますか？")) return;

  fetch(HISTORY_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "deleteShipment",
      date: currentDate,
      item: itemData.item,
      price: itemData.price,
      store: store
    })
  }).then(() => {
    alert("削除しました");
    loadHistory(currentDate);
  }).catch(err => {
    alert("エラー: " + err);
  });
}
