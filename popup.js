// 시간 추정 계산 (이더리움은 약 12초당 1블록)
function estimateTime(blocks) {
  const seconds = blocks * 12;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `약 ${hours}시간${minutes > 0 ? ` ${minutes}분` : ''}`;
  } else {
    return `약 ${minutes}분`;
  }
}

// 블록 값 포맷팅
function formatBlockValue(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 팝업이 열릴 때 실행
document.addEventListener('DOMContentLoaded', () => {
  console.log('Uniswap Range Helper popup loaded');

  const blockRange = document.getElementById('blockRange');
  const blockValue = document.getElementById('blockValue');
  const timeEstimate = document.getElementById('timeEstimate');
  const saveBtn = document.getElementById('saveSettings');
  const saveStatus = document.getElementById('saveStatus');

  // 저장된 설정 로드
  chrome.storage.sync.get(['blockRange'], (result) => {
    const savedBlocks = result.blockRange || 5000;
    blockRange.value = savedBlocks;
    blockValue.textContent = formatBlockValue(savedBlocks);
    timeEstimate.textContent = `(${estimateTime(savedBlocks)})`;
  });

  // 슬라이더 변경 시 실시간 업데이트
  blockRange.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    blockValue.textContent = formatBlockValue(value);
    timeEstimate.textContent = `(${estimateTime(value)})`;
  });

  // 설정 저장
  saveBtn.addEventListener('click', () => {
    const blocks = parseInt(blockRange.value);

    chrome.storage.sync.set({ blockRange: blocks }, () => {
      saveStatus.textContent = '✓ 설정이 저장되었습니다';
      saveStatus.classList.add('show');

      setTimeout(() => {
        saveStatus.classList.remove('show');
      }, 2000);
    });
  });

  // 현재 탭이 Uniswap 페이지인지 확인
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('app.uniswap.org')) {
      console.log('Currently on Uniswap page');
    }
  });
});
