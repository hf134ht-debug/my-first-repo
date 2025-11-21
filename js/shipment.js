/* =========================================================
   shipment.js
   出荷管理画面
========================================================= */

/* ★★★ あなたの Apps Script の exec URL ★★★ */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";


/* ===== 出荷画面 HTML ===== */
function renderShipmentScreen() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  return `
    <h2>出荷管理</h2>

    <label>日付</label>
    <input type="date" id="shipDate" value="${todayStr}">

    <label>品目</label>
    <div id="itemContainer">
      <div class="item-button" data-item="白菜" data-type="hakusai">白菜</div>
      <div class="item-button" data-item="白菜カット" data-type="hakusai">白菜カット</div>
      <div class="item-button" data-item="キャベツ" data-type="cabbage">キャベツ</div>
      <div class="item-button" data-item="キャベツカット" data-type="cabbage">キャベツカット</div>
      <div class="item-button" data-item="トウモロコシ" data-type="corn">トウモロコシ</div>
    </div>

    <label>値段</label>
    <input type="number" id="priceInput" min="0">

    <label>店舗・個数</label>
    <div id="storesContainer">
      ${renderStoreRow()}
    </div>

    <button class="add-btn" id="addStoreBtn">＋ 店舗追加</button>
    <button class="submit-btn" id="submitShipment">登録</button>
  `;
}


/* ===== 店舗行テンプレ ===== */
function renderStoreRow() {
  return `
    <div class="store-row">
      <select class="store-name">
        <option value="連島">連島</option>
        <option value="津高">津高</option>
        <option value="茶屋町">茶屋町</option>
        <option value="大安寺">大安寺</option>
        <option value="中庄">中庄</option>
        <option value="総社南">総社南</option>
        <option value="円山">円山</option>
        <option value="児島">児島</option>
      </select>
      <input type="number" class="store-qty" min="1" placeholder="個数">
    </div>
  `;
}


/* ===== 画面読み込み後のイベント設定 ===== */
function activateShipmentFeatures() {

  /* --- 品目ボタン --- */
  let selectedItem = null;
  const itemButtons = document.querySelectorAll(".item-button");

  itemButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      // すべてリセット
      itemButtons.forEach(b => b.classList.remove("selected", "hakusai", "cabbage", "corn"));

      const type = btn.dataset.type;
      selectedItem = btn.dataset.item;

      // 選択時の色付け
      btn.classList.add("selected");
      btn.classList.add(type);
    });
  });


  /* --- 店舗追加ボタン --- */
  document.getElementById("addStoreBtn").addEventListener("click", () => {
    document.getElementById("storesContainer").insertAdjacentHTML("beforeend", renderStoreRow());
  });


  /* --- 登録ボタン --- */
  document.getElementById("submitShipment").addEventListener("click", async () => {

    const date = document.getElementById("shipDate").value;
    const price = document.getElementById("priceInput").value;

    if (!selectedItem) {
      alert("品目を選択してください");
      return;
    }
    if (!price) {
      alert("値段を入力してください");
      return;
    }

    // 店舗データ取得
    const rows = Array.from(document.querySelectorAll(".store-row"));
    const stores = rows.map(r => ({
      name: r.querySelector(".store-name").value,
      quantity: r.querySelector(".store-qty").value
    }));

    const payload = {
      date: date,
      item: selectedItem,
      price: Number(price),
      stores: stores
    };

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      alert("登録完了！");

      // リセット
      document.getElementById("tabContent").innerHTML = renderShipmentScreen();
      activateShipmentFeatures();

    } catch (err) {
      alert("通信エラー：" + err);
    }
  });
}
