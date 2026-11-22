// 광고 연결부: 게임은 Ads.showRewarded() 만 부르고, 끝까지 봤으면 true 를 받습니다.
// 지금은 진짜 광고가 없어서 3초짜리 "광고 자리" 화면을 대신 보여 줍니다.
// 나중에 안드로이드 앱(Capacitor + AdMob)으로 감싸면 아래 provider 부분만
// AdMob 보상형 광고 호출로 바꾸면 됩니다. 게임 코드는 바꿀 필요가 없습니다.
(() => {
  'use strict';

  const PLACEHOLDER_SECONDS = 3;

  function placeholderAd() {
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'ad-screen';
      box.innerHTML = `
        <div class="ad-card">
          <div class="ad-tag">AD</div>
          <p class="ad-title">광고 자리</p>
          <p class="ad-sub">스토어 버전에서는 여기에 광고가 나옵니다</p>
          <p class="ad-count"></p>
          <button type="button" class="primary ad-close hidden">보상 받고 이어하기</button>
        </div>`;
      document.body.appendChild(box);
      const count = box.querySelector('.ad-count');
      const close = box.querySelector('.ad-close');
      let left = PLACEHOLDER_SECONDS;
      const tick = () => {
        if (left > 0) { count.textContent = `${left}초 후 보상`; left--; setTimeout(tick, 1000); }
        else { count.textContent = ''; close.classList.remove('hidden'); }
      };
      tick();
      close.addEventListener('click', () => { box.remove(); resolve(true); }, { once: true });
    });
  }

  let busy = false;
  window.Ads = {
    async showRewarded() {
      if (busy) return false;
      busy = true;
      try {
        // TODO(스토어 버전): AdMob 보상형 광고로 교체
        return await placeholderAd();
      } catch (err) {
        console.warn('광고 실패:', err);
        return false;
      } finally {
        busy = false;
      }
    },
  };
})();
