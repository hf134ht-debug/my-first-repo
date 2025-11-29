/* =========================================================
   history.js（完全版）
   - 履歴画面（更新・削除は専用APIを使用）
   - ★規格入力欄（プリセット＋手入力）を追加
   - ★規格はグループ単位（品目＋値段）で全行更新
========================================================= */

const HISTORY_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* =========================================================
   品目統一
========================================================= */
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

/* =========================================================
   カード色
========================================================= */
function getItemClass(item) {
  if (!item) return "history-card";
  if (item.includes("白菜")) return "history-card hakusai";
  if (item.includes("キャベツ")) return "history-card cabbage";
  if (item.includes("トウモロコシ")) return "history-card corn";
  return "history-card";
}

/* =========================================================
   履歴画面 HTML
========================================================= */
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

/* =========================================================
   履歴取得
========================================================= */
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

  data.items.forEach(group => {
    const card = createItemCard(group);  // ← 表形式カード（A方式）
    container.appendChild(card);
  });
}

/* =========================================================
   ★品目別 規格プリセット
========================================================= */
const KIKAKU_PRESETS = {
  "キャベツ": [
    "0.7kg以下",
    "0.7kg以下（2,3個入り）",
    "0.7〜1.1kg",
    "1.1〜1.6kg",
    "1.6kg以上",
  ],
  "キャベツカット": [
    "1.1〜1.6kg",
    "1.6kg以上",
  ],
  "白菜": [
    "1kg以下",
    "1〜1.4kg",
    "1.4〜1.8kg",
    "1.0〜1.8kg",
    "1.8〜3kg",
    "3kg以上",
  ],
  "白菜カット": [
    "カミサリ不良・普通",
    "カミサリ不良・軽",
  ],
  "トウモロコシ": [
    "A・黄", "B・黄", "C・黄",
    "A・白", "B・白", "C・白",
    "A・ミックス", "B・ミックス", "C・ミックス",
    "A・黄（2本入り）","B・黄（2本入り）","C・黄（2本入り）",
    "A・白（2本入り）","B・白（2本入り）","C・白（2本入り）",
    "A・ミックス（2本入り）","B・ミックス（2本入り）","C・ミックス（2本入り）",
  ],
};

/* =========================================================
   ★ 規格更新 API 呼び出し（全行更新）
========================================================= */
async function updateKikakuForCard(group, newKikaku) {
  if (!newKikaku) return;

  const payload = {
    mode: "updateKikaku",
    date: group.date,
    item: group.item,
    price: group.price,
    kikaku: newKikaku,
  };

  try {
    const res = await fetch(HISTORY_SCRIPT_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.status !== "ok") {
      alert("規格更新に失敗しました: " + (json.message || ""));
      return;
    }
  } catch (err) {
    alert("規格更新時にエラーが発生しました");
    console.error(err);
  }
}

/* =========================================================
   ★ 表形式カード（A方式）＋ 規格欄追加
========================================================= */
function createItemCard(group) {
  const card = document.createElement("div");
  card.className = getItemClass(group.item);

  /* ======== タイトル＋バッジ ======== */
  const header = document.createElement("div");
  header.className = "history-title";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = `${group.item}（${group.price}円）`;

  const badge = document.createElement("span");
  badge.className = "kikaku-badge";

  if (group.kikaku && String(group.kikaku).trim() !== "") {
    badge.textContent = group.kikaku;
  } else {
    badge.style.display = "none";
  }

  header.appendChild(titleSpan);
  header.appendChild(badge);
  card.appendChild(header);

  /* ======== 規格 UI ======== */
  const kikakuUI = document.createElement("div");
  kikakuUI.className = "kikaku-area";

  const labelDiv = document.createElement("div");
  labelDiv.className = "kikaku-label";
  labelDiv.textContent = "規格：";

  const controlsDiv = document.createElement("div");
  controlsDiv.className = "kikaku-controls";

  const normalized = normalizeItemName(group.item);
  const presets = KIKAKU_PRESETS[normalized] || [];

  const sel = document.createElement("select");
  sel.className = "kikaku-select";

  const placeholderOpt = document.createElement("option");
  placeholderOpt.value = "";
  placeholderOpt.textContent = "プリセットから選択";
  sel.appendChild(placeholderOpt);

  presets.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    if (group.kikaku === p) {
      opt.selected = true;
      placeholderOpt.selected = false;
    }
    sel.appendChild(opt);
  });

  const inp = document.createElement("input");
  inp.type = "text";
  inp.className = "kikaku-input";
  inp.placeholder = "例）1.2〜1.6kg / 特大";
  inp.value = group.kikaku || "";

  controlsDiv.appendChild(sel);
  controlsDiv.appendChild(inp);
  kikakuUI.appendChild(labelDiv);
  kikakuUI.appendChild(controlsDiv);

  card.appendChild(kikakuUI);

  /* ======== 店舗テーブル（innerHTMLで一気に作る） ======== */
  const table = document.createElement("table");
  table.className = "store-table";

  let rowsHTML = "";
  group.stores.forEach(s => {
    const row = s.row;
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

  table.innerHTML = rowsHTML;
  card.appendChild(table);

  /* ======== イベント：プリセット変更 ======== */
  sel.addEventListener("change", () => {
    const val = sel.value;
    if (!val) return;

    inp.value = val;

    updateKikakuForCard(group, val).then(() => {
      group.kikaku = val;
      badge.textContent = val;
      badge.style.display = "inline-block";
      badge.classList.add("flash");
      setTimeout(() => badge.classList.remove("flash"), 600);
    });
  });

  /* ======== イベント：手入力 ======== */
  inp.addEventListener("blur", () => {
    const val = inp.value.trim();
    if (!val) return;

    updateKikakuForCard(group, val).then(() => {
      group.kikaku = val;
      badge.textContent = val;
      badge.style.display = "inline-block";
      badge.classList.add("flash");
      setTimeout(() => badge.classList.remove("flash"), 600);
    });
  });

  return card;
}


/* =========================================================
   行単位 更新・削除（既存）
========================================================= */
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
      action: "deleteHistory",
      date: currentDate,
      row
    })
  });

  loadHistory(currentDate);
}

/* =========================================================
   公開
========================================================= */
window.renderHistoryScreen = renderHistoryScreen;
window.activateHistoryFeatures = activateHistoryFeatures;
