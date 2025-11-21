// 各画面モックコンテンツ
const screens = {
  shipment: `
    <div class="screen-content">
      <h2>出荷管理</h2>
      <p>ここに出荷フォームを設置</p>
    </div>
  `,
  history: `
    <div class="screen-content">
      <h2>履歴</h2>
      <p>過去出荷データ一覧</p>
    </div>
  `,
  summary: `
    <div class="screen-content">
      <h2>集計</h2>
      <p>店舗別・品目別・日別の集計グラフ</p>
    </div>
  `,
  sales: `
    <div class="screen-content">
      <h2>売上</h2>
      <p>本日の売上合計など表示</p>
    </div>
  `
};

// 画面切替
function goTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const content = document.getElementById('content');
  content.innerHTML = screens[screen];
  content.classList.remove('hidden');
  document.getElementById('tabs').classList.remove('hidden');
}
