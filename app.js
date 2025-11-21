// 品目選択・店舗追加・日付セットの処理は先ほどのHTMLのスクリプトをそのまま使用

function goTo(screen) {
  // 他の画面を非表示
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  // 選択画面を表示
  document.getElementById(screen + 'Screen').classList.remove('hidden');
  // タブ表示
  document.getElementById('tabs').classList.remove('hidden');
}

// フォーム送信
document.getElementById('shipmentForm').addEventListener('submit', async function(e){
  e.preventDefault();
  if (!selectedItem) { alert('品目を選択してください'); return; }

  const form = e.target;
  const data = {
    date: form.date.value,
    item: selectedItem,
    price: Number(form.price.value),
    stores: Array.from(form.querySelectorAll('.store-row')).map(row => ({
      name: row.querySelector('select[name="store"]').value,
      quantity: Number(row.querySelector('input[name="quantity"]').value)
    }))
  };

  try {
    // Firestoreに保存（例）
    await firebase.firestore().collection('shipments').add(data);
    alert('登録完了！');
    form.reset();
    document.getElementById('storesContainer').innerHTML = `
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
    `;
    itemButtons.forEach(b => b.classList.remove('selected'));
    selectedItem = null;
    document.getElementById('dateInput').value = `${yyyy}-${mm}-${dd}`;
  } catch (err) {
    console.error(err);
    alert('登録に失敗しました');
  }
});
