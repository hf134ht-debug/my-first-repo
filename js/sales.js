function renderSalesScreen() {
  const container = document.getElementById("tabContent");
  const today = new Date().toISOString().split("T")[0];

  container.innerHTML = `
    <div class="calendar-container">
      <h2>売上データ</h2>
      <input type="date" id="salesDate" value="${today}">
      <button id="loadSalesBtn">読込</button>
    </div>
    <div id="salesResult"></div>
  `;

  document.getElementById("loadSalesBtn").addEventListener("click", () => {
    const date = document.getElementById("salesDate").value;
    loadSales(date);
  });

  loadSales(today);
}

async function loadSales(dateStr) {
  const resultDiv = document.getElementById("salesResult");
  resultDiv.innerHTML = "💬 読み込み中…";

  try {
    const res = await fetch(
      `https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec?salesDate=${dateStr}`
    );

    const data = await res.json();
    if (!data.found) {
      resultDiv.innerHTML = "⚠ データがありません";
      return;
    }

    let html = `<h3>${dateStr} の売上</h3>`;
    html += `<table><tr><th>品目</th><th>数量</th><th>金額</th></tr>`;

    data.items.forEach(item => {
      html += `
        <tr>
          <td>${item.item}</td>
          <td>${item.totalQty}</td>
          <td>${Number(item.totalAmount).toLocaleString()} 円</td>
        </tr>
      `;
    });

    html += `</table>`;
    html += `<p><b>合計数量：</b> ${data.totalQty}</p>`;
    html += `<p><b>合計金額：</b> ${Number(data.totalAmount).toLocaleString()} 円</p>`;

    resultDiv.innerHTML = html;

  } catch (err) {
    resultDiv.innerHTML = "❌ エラー: " + err;
  }
}
