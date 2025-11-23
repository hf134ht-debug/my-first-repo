/* =========================================================
   週集計ビュー（基礎 UI版）
========================================================= */

/* 週範囲を管理 */
let currentWeekDate = new Date(); // 今日を含む週

/* UI生成 */
function renderWeekView() {
  return `
    <h3 id="weekTitle"></h3>

    <div class="week-nav-area">
      <button class="week-btn" onclick="changeWeek(-1)">＜ 前週</button>
      <button class="week-btn" onclick="changeWeek(1)">次週 ＞</button>
    </div>

    <div id="weekSummaryResult">
      <p>読み込み中...</p>
    </div>
  `;
}

/* 週タイトルなど更新 */
function updateWeekTitle() {
  const monday = getMonday(currentWeekDate);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const title = `${formatMD(monday)} ~ ${formatMD(sunday)}（週）`;
  document.getElementById("weekTitle").innerText = title;
}

/* YYYY-MM-DD → MM/DD 形式 */
function formatMD(date) {
  return `${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}`;
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=日
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/* 週移動 */
function changeWeek(offset) {
  currentWeekDate.setDate(currentWeekDate.getDate() + offset * 7);
  loadWeekSummary();
}

/* データ読み込み（仮表示） */
async function loadWeekSummary() {
  updateWeekTitle();

  const resultDiv = document.getElementById("weekSummaryResult");
  resultDiv.innerHTML = `
    <div class="history-card">
      <p>※ データ読み込み準備中（次ステップで実装）</p>
    </div>
  `;
}
