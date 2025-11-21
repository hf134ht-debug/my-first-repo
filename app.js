let selectedItem = null;
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJwMFqG6a31z-YRBFjVn1EKOk4t5FnjDaaXwWtiCE2/dev";

function goTo(screen){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  const content = document.getElementById('content');
  if(screen==='shipment'){
    content.innerHTML = shipmentHTML;
    initShipmentForm();
  } else {
    content.innerHTML = `<div class="screen-content"><h2>${screen}</h2><p>未実装</p></div>`;
  }
  content.classList.remove('hidden');
  document.getElementById('tabs').classList.remove('hidden');
}

const shipmentHTML = `
<form id="shipmentForm">
  <label>日付</label>
  <input type="date" id="dateInput" required>
  <label>品目</label>
  <div id="itemContainer">
    <div class="item-button" data-value="白菜">白菜</div>
    <div class="item-button" data-value="白菜カット">白菜カット</div>
    <div class="item-button" data-value="キャベツ">キャベツ</div>
    <div class="item-button" data-value="キャベツカット">キャベツカット</div>
    <div class="item-button" data-value="トウモロコシ">トウモロコシ</div>
  </div>
  <label>値段</label>
  <input type="number" name="price" min="0" required>
  <div id="storesContainer">
    <label>店舗・個数</label>
    <div class="store-row">
      <select name="store">
        <option value="連島">連島</option>
        <option value="津高">津高</option>
        <option value="茶屋町">茶屋町</option>
        <option value="大安寺">大安寺</option>
        <option value="中庄">中庄</option>
        <option value="総社南">総社南</option>
        <option value="円山">円山</option>
        <option value="児島">児島</option>
      </select>
      <input type="number" name="quantity" min="1" placeholder="個数" required>
    </div>
  </div>
  <button type="button" onclick="addStore()">+ 店舗追加</button>
  <button type="submit">登録</button>
</form>
`;

function initShipmentForm(){
  const today = new Date();
  document.getElementById('dateInput').value = today.toISOString().substr(0,10);

  document.querySelectorAll('.item-button').forEach(btn=>{
    btn.addEventListener('click', function(){
      document.querySelectorAll('.item-button').forEach(b=>b.classList.remove('selected'));
      this.classList.add('selected');
      selectedItem = this.dataset.value;
    });
  });

  document.getElementById('shipmentForm').addEventListener('submit', async function(e){
    e.preventDefault();
    if(!selectedItem){ alert('品目を選択してください'); return; }

    const form = e.target;
    const data = {
      date: document.getElementById('dateInput').value,
      item: selectedItem,
      price: Number(form.price.value),
      stores: Array.from(form.querySelectorAll('.store-row')).map(r=>({
        name: r.querySelector('select[name="store"]').value,
        quantity: Number(r.querySelector('input[name="quantity"]').value)
      }))
    };

    try {
      await fetch(SCRIPT_URL, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(data),
        mode:'no-cors'
      });
      alert('登録完了！');
      form.reset();
      selectedItem = null;
    } catch(err){
      alert('通信エラー: '+err);
    }
  });
}

function addStore(){
  const container = document.getElementById('storesContainer');
  const div = document.createElement('div');
  div.className='store-row';
  div.innerHTML=`
    <select name="store">
      <option value="連島">連島</option>
      <option value="津高">津高</option>
      <option value="茶屋町">茶屋町</option>
      <option value="大安寺">大安寺</option>
      <option value="中庄">中庄</option>
      <option value="総社南">総社南</option>
      <option value="円山">円山</option>
      <option value="児島">児島</option>
    </select>
    <input type="number" name="quantity" min="1" placeholder="個数" required>
  `;
  container.appendChild(div);
}
