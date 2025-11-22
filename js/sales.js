/* =========================================================
   sales.js（売上カレンダー + 売上表示 + 全店計のみ表示）
   ★個別の品目・店舗に「全店計」表示しない修正版
========================================================= */

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

/* ===== 売上画面 HTML ===== */
function renderSalesScreen() {
  return `
    <h2>売上</h2>
    <div id="salesCalendarArea"></div>
    <div id="salesResult"></div>
  `;
}

/* カレンダー状態 */
let salesCalYear;
let salesCalMonth;

/* 売上画面を開いたとき */
function activateSalesFeatures() {
  const now = new Date();
  salesCalYear = now.getFullYear();
  salesCalMonth = now.getMonth();

  document.getElementById("salesCalendarArea").innerHTML =
    drawCalendar(salesCalYear, salesCalMonth, now);

  selectSalesDate(now.getFullYear(), now.getMonth(), now.getDate());
}

/* 日付選択 */
function selectSalesDate(y, m, d) {
  const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  document.getElementById("salesCalendarArea").innerHTML =
    drawCalendar(y, m, new Date(y, m, d));

  loadDailySales(dateStr);
}

/* 月変更 */
function changeSalesMonth(offset) {
  salesCalMonth += offset;
  if (salesCalMonth < 0) { salesCalMonth = 11; salesCalYear--; }
  if (salesCalMonth > 11) { salesCalMonth = 0; salesCalYear++; }

  document.getElementById("salesCalendarArea").innerHTML =
    drawCalendar(salesCalYear, salesCalMonth);
}

/* ===== GASから売上データ取得 ===== */
async function loadDailySales(dateStr) {
  const resultDiv = document.getElementById("salesResult");
  resultDiv.innerHTML = `<p>読み込み中…</p>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?salesDate=${dateStr}`);
    const data = await res.json();

    if (!data.found) {
      resultDiv.innerHTML = `<p>${dateStr} の売上データはありません。</p>`;
      return;
    }

    let html = `<h3>${dateStr} の売上</h3>`;

    /* ===== 全店計（最上表示）===== */
    html += `
      <div class="history-card cabbage">
        <div class="history-title">📊 全店計</div>
        <div>売上合計：<b>${data.totalAmount.toLocaleString()} 円</b></div>
        <div>個数合計：<b>${data.totalQty} 個</b></div>
      </div>
    `;

    /* ===== 店舗ごとの内訳 ===== */
    data.rows.forEach(r => {
      html += `
        <div class="history-card corn">
          <div class="history-title">${r.store}</div>
          <div>売上：${Number(r.amount).toLocaleString()} 円</div>
          <div>個数：${r.qty} 個</div>
        </div>
      `;
    });

    resultDiv.innerHTML = html;

  } catch (err) {
    resultDiv.innerHTML = `<p>エラー：${err}</p>`;
  }
}
