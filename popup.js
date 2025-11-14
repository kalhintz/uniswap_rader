// 팝업이 열릴 때 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('Uniswap Range Helper popup loaded');
  
  // 현재 탭이 Uniswap 페이지인지 확인
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('app.uniswap.org')) {
      console.log('Currently on Uniswap page');
    }
  });
});
