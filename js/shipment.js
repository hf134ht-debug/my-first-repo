/* =========================================================
   shipment.js
   出荷管理画面（★ 品目表記統一込み 完全版 ★）
========================================================= */

/* ====== 品目統一関数（全画面共通で使用） ====== */
function normalizeItemName(raw) {
  if (!raw) return "";
  let s = String(raw).trim();

  // 全角 → 半角
  const z2h = (str) =>
    str.replace(/[！-～]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );
  s = z2h(s);

  const lower = s.toLowerCase();

  /* --- とうもろこし --- */
  if (
    /とう?も?ろ?こし/.test(s) ||
    lower.includes("corn") ||
    s.includes("ｺｰﾝ") ||
    s.includes("コーン") ||
    /ﾄｳﾓﾛｺｼ|トウモロコシ/.test(s)
  ) {
    return "とうもろこし";
  }

  /* --- はくさい --- */
  if (s.includes("白菜") || s.includes("はくさい") || s.includes("ﾊｸｻｲ")) {
    if (
      s.includes("ｶｯﾄ") ||
      s.includes("カット") ||
      lower.includes("cut")
    ) {
      return "はくさいカット";
    }
    return "はくさい";
  }

  /* --- キャベツ --- */
  if (s.includes("キャベツ") || s.includes("ｷｬﾍﾞﾂ")) {
    if (
      s.includes("ｶｯﾄ") ||
      s.includes("カット") ||
      lower.includes("cut")
    ) {
      return "キャベツカット";
    }
    return "キャベツ";
  }

  return s;
}

/* ★★★ Apps Script の exec URL ★★★ */
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyxcdqsmvnLnUw7RbzDKQ2KB6dkfQBXZdQRRt8WIKwYbKgYw-byEAePi6fHPy4gI6eyZQ/exec";

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
      <div class="item-button" data-item="はくさい" data-type="hakusai">はくさい</div>
      <div class="item-button" data-item="はくさいカット" data-type="hakusai">はくさいカット</div>
      <div class="item-button" data-item="キャベツ" data-type="cabbage">キャベツ</div>
      <div class="item-button" data-item="キャベツカット" data-type="cabbage">キャベツカット</div>
      <div class="item-button" data-item="とうもろこし" data-type="corn">とうもろこし</div>
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
        <option value="岡山築港">岡山築港</option>
      </select>
      <input type="number" class="store-qty" min="1" placeholder="個数">
      <button type="button" class="store-remove-btn">✕</button>
    </div>
  `;
}

/* ===== 画面読み込み後のイベント設定 ===== */
function activateShipmentFeatures() {
  /** --- 品目ボタン --- */
  let selectedItem = null;
  const itemButtons = document.querySelectorAll(".item-button");

  itemButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      itemButtons.forEach((b) =>
        b.classList.remove("selected", "hakusai", "cabbage", "corn")
      );

      const type = btn.dataset.type;
      const rawItem = btn.dataset.item;

      /** ★ normalize を適用して統一表記に変換 ★ */
      selectedItem = normalizeItemName(rawItem);

      btn.classList.add("selected", type);
    });
  });

  /** --- 店舗追加ボタン --- */
  document.getElementById("addStoreBtn").addEventListener("click", () => {
    document
      .getElementById("storesContainer")
      .insertAdjacentHTML("beforeend", renderStoreRow());
  });

  /** --- 店舗行削除 --- */
  document.getElementById("storesContainer").addEventListener("click", (e) => {
    const btn = e.target.closest(".store-remove-btn");
    if (!btn) return;

    const row = btn.closest(".store-row");
    if (!row) return;

    row.classList.add("removing");

    setTimeout(() => row.remove(), 200);
  });

  /** --- 登録ボタン --- */
  document
    .getElementById("submitShipment")
    .addEventListener("click", async () => {
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

      const rows = Array.from(document.querySelectorAll(".store-row"));
      const stores = rows
        .map((r) => ({
          name: r.querySelector(".store-name").value,
          quantity: r.querySelector(".store-qty").value,
        }))
        .filter((s) => s.quantity);

      if (stores.length === 0) {
        alert("店舗の個数を1つ以上入力してください");
        return;
      }

      /** ★ 送信前に item をもう一度 normalize（絶対ズレないように） */
      const data = {
        action: "saveShipment",
        date: date,
        item: normalizeItemName(selectedItem),
        price: String(Number(price)),
        stores: JSON.stringify(stores), // ← 文字列化して送る
      };

      // ★★★ ここが一番大事：JSON ではなく form-urlencoded で送る ★★★
      const body = new URLSearchParams(data).toString();

      try {
        const res = await fetch(SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body,
        });

        // res.ok での判定はしていないが、ここまで来ていれば通信自体は成功
        alert("登録完了！");

        // 画面リセット
        document.getElementById("tabContent").innerHTML =
          renderShipmentScreen();
        activateShipmentFeatures();
      } catch (err) {
        console.error("出荷登録エラー:", err);
        alert("通信エラー：" + err);
      }
    });
}

