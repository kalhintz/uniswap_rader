// URL 파라미터 파싱
function getURLParams() {
  const params = new URLSearchParams(window.location.search);

  const currencyA = params.get('currencyA');
  const currencyB = params.get('currencyB');
  const chain = params.get('chain') || 'ethereum';
  const feeParam = params.get('fee');

  let fee = 3000; // 기본값
  if (feeParam) {
    try {
      const feeObj = JSON.parse(decodeURIComponent(feeParam));
      fee = feeObj.feeAmount;
    } catch (e) {
      console.error('Failed to parse fee:', e);
    }
  }

  return { currencyA, currencyB, chain, fee };
}

// NATIVE를 WETH 주소로 변환
function normalizeTokenAddress(address, chain) {
  if (address === 'NATIVE' && chain === 'ethereum') {
    return '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
  }
  return address;
}

// 가격을 의미있는 자릿수로 포맷
function formatPrice(price) {
  // 잘못된 값 체크
  if (!price || !isFinite(price)) {
    console.error('[FormatPrice] Invalid price:', price);
    return '0';
  }

  // 가격이 0.9 ~ 1.1 사이면 스테이블코인
  if (price >= 0.9 && price <= 1.1) {
    return parseFloat(price.toFixed(6)).toString();
  }
  // 매우 작은 가격 (< 0.0001) - 유효숫자 4자리
  else if (price < 0.0001) {
    // 유효숫자 4자리로 표시
    return price.toPrecision(4);
  }
  // 작은 가격 (0.0001 ~ 0.01)
  else if (price < 0.01) {
    return parseFloat(price.toFixed(6)).toString();
  }
  // 가격이 0.01 ~ 10 사이
  else if (price < 10) {
    return parseFloat(price.toFixed(5)).toString();
  }
  // 가격이 10 ~ 100
  else if (price < 100) {
    return parseFloat(price.toFixed(3)).toString();
  }
  // 가격이 100 ~ 10000
  else if (price < 10000) {
    return parseFloat(price.toFixed(1)).toString();
  }
  // 매우 큰 가격
  else {
    return parseFloat(price.toFixed(0)).toString();
  }
}

// 추천 range를 UI에 표시
function displayRecommendations(recommendations, feeTier = 3000) {
  console.log('='.repeat(50));
  console.log('[UI] displayRecommendations called');
  console.log('[UI] Fee tier:', feeTier);
  console.log('[UI] Recommendations:', recommendations);

  // 기존 추천 제거
  document.querySelectorAll('.range-recommendation-panel').forEach(el => el.remove());

  if (!recommendations || recommendations.length === 0) {
    console.log('No recommendations found');
    return;
  }

  // Top 3 추천 범위 표시
  const top3 = recommendations.slice(0, 3);

  console.log('[UI] Displaying top 3 recommendations:', top3);
  top3.forEach((rec, i) => {
    console.log(`[UI] #${i+1}: minPrice=${rec.minPrice}, maxPrice=${rec.maxPrice}`);
  });

  // 추천 패널 생성
  const panel = document.createElement('div');
  panel.className = 'range-recommendation-panel';
  panel.innerHTML = `
    <div class="recommendation-header">
      <span class="recommendation-icon">💡</span>
      <span class="recommendation-title">인기 가격 범위</span>
    </div>
    <div class="recommendation-list">
      ${top3.map((rec, index) => {
        console.log(`[UI] Raw rec #${index+1}:`, rec);

        const minPrice = formatPrice(rec.minPrice);
        const maxPrice = formatPrice(rec.maxPrice);
        const width = calculateRangeWidth(rec.minPrice, rec.maxPrice);
        const efficiency = getRangeEfficiency(width);
        const apy = estimateAPYRange(feeTier, width);

        console.log(`[UI] Formatted #${index+1}: ${minPrice} ~ ${maxPrice}`);
        console.log(`[UI] Width: ${width.toFixed(2)}%, Efficiency: ${efficiency.label}`);
        console.log(`[UI] Estimated APY: ${apy.min.toFixed(1)}% ~ ${apy.max.toFixed(1)}%`);

        return `
          <div class="recommendation-item" data-min="${minPrice}" data-max="${maxPrice}">
            <div class="rec-rank">#${index + 1}</div>
            <div class="rec-content">
              <div class="rec-range">
                ${minPrice} ~ ${maxPrice}
              </div>
              <div class="rec-stats">
                👥 ${rec.count}명이 선택한 범위
              </div>
              <div class="rec-efficiency" style="color: ${efficiency.color}">
                📊 범위폭: ${width.toFixed(2)}% | 💰 예상 APY: ${apy.min.toFixed(0)}~${apy.max.toFixed(0)}%
              </div>
            </div>
            <button class="rec-apply-btn">적용</button>
          </div>
        `;
      }).join('')}
    </div>
    <div class="recommendation-footer">
      <span class="recommendation-note">최근 5,000블록 기준 (~17시간)</span>
      <span class="recommendation-note">⚠️ APY는 대략적인 추정치입니다</span>
    </div>
  `;

  // 페이지에 패널 추가 - 가격 범위 섹션 바로 위에 삽입
  console.log('[UI] Trying to find insertion point...');

  // 방법 1: 최저가 입력 필드 직접 찾기
  const minPriceInput = document.querySelector('[data-testid="range-input-0"]');
  console.log('[UI] Found min price input:', minPriceInput);

  if (minPriceInput) {
    // 입력 필드의 최상위 컨테이너 찾기 (여러 레벨 올라가기)
    let container = minPriceInput;
    for (let i = 0; i < 8; i++) {
      container = container.parentElement;
      if (!container) break;
      console.log(`[UI] Parent level ${i}:`, container.tagName, container.className);
    }

    // 8레벨 위의 부모 요소 바로 앞에 삽입
    if (container) {
      container.insertAdjacentElement('beforebegin', panel);
      console.log('[UI] ✓ Panel inserted before price section');
    }
  }

  // 방법 2: main 태그 내 첫 section 뒤에 삽입
  if (!panel.parentElement) {
    const mainElement = document.querySelector('main');
    const firstSection = mainElement?.querySelector('section');
    if (firstSection && firstSection.nextElementSibling) {
      firstSection.nextElementSibling.insertAdjacentElement('beforebegin', panel);
      console.log('[UI] ✓ Panel inserted after first section');
    } else if (mainElement) {
      mainElement.insertAdjacentElement('afterbegin', panel);
      console.log('[UI] ✓ Panel inserted at main start');
    }
  }

  // 방법 3: 최후의 수단 - body에 삽입
  if (!panel.parentElement) {
    document.body.insertAdjacentElement('afterbegin', panel);
    console.log('[UI] ⚠ Panel inserted at body start (fallback)');
  }

  // 최종 확인
  console.log('[UI] ✓✓✓ Panel successfully added to DOM');
  console.log('[UI] Panel parent:', panel.parentElement?.tagName);
  console.log('[UI] Panel visible:', panel.offsetHeight > 0);
  console.log('='.repeat(50));

  // 적용 버튼에 이벤트 리스너 추가
  panel.querySelectorAll('.rec-apply-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.recommendation-item');
      const minPrice = item.dataset.min;
      const maxPrice = item.dataset.max;

      console.log('='.repeat(50));
      console.log('[Apply] Button clicked');
      console.log('[Apply] Min price:', minPrice);
      console.log('[Apply] Max price:', maxPrice);

      // 버튼 상태 변경
      btn.disabled = true;
      btn.textContent = '적용 중...';

      // 입력 필드 찾기
      console.log('[Apply] Finding input fields...');
      const { minPriceInput, maxPriceInput } = findPriceInputs();

      console.log('[Apply] Min input:', minPriceInput);
      console.log('[Apply] Max input:', maxPriceInput);

      if (!minPriceInput || !maxPriceInput) {
        console.error('[Apply] ✗ Could not find input fields');
        btn.textContent = '❌ 실패';
        btn.classList.add('failed');

        // 수동 입력 안내
        setTimeout(() => {
          alert(`입력 필드를 찾을 수 없습니다.\n\n수동으로 입력해주세요:\n최저가: ${minPrice}\n최고가: ${maxPrice}`);
          btn.textContent = '적용';
          btn.disabled = false;
          btn.classList.remove('failed');
        }, 500);
        return;
      }

      // 값 설정 (약간의 딜레이를 두고)
      console.log('[Apply] Setting min price...');
      const minSuccess = setReactInputValue(minPriceInput, minPrice);

      // 최소가 설정 후 약간 대기
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('[Apply] Setting max price...');
      const maxSuccess = setReactInputValue(maxPriceInput, maxPrice);

      console.log('[Apply] Min success:', minSuccess);
      console.log('[Apply] Max success:', maxSuccess);

      // 값이 실제로 설정되었는지 확인 (약간 기다린 후)
      await new Promise(resolve => setTimeout(resolve, 300));

      const actualMinValue = minPriceInput.value;
      const actualMaxValue = maxPriceInput.value;
      console.log('[Apply] Actual min value:', actualMinValue);
      console.log('[Apply] Actual max value:', actualMaxValue);
      console.log('='.repeat(50));

      // 값이 비어있지 않으면 성공으로 간주
      const success = actualMinValue && actualMaxValue && actualMinValue !== '0' && actualMaxValue !== '0';

      if (success) {
        // 성공 표시
        btn.textContent = '✓ 적용됨';
        btn.classList.add('applied');
        btn.disabled = false;

        setTimeout(() => {
          btn.textContent = '적용';
          btn.classList.remove('applied');
        }, 3000);
      } else {
        // 실패 표시
        btn.textContent = '❌ 실패';
        btn.classList.add('failed');
        alert(`값 적용에 실패했습니다.\n\n수동으로 입력해주세요:\n최저가: ${minPrice}\n최고가: ${maxPrice}`);

        setTimeout(() => {
          btn.textContent = '적용';
          btn.disabled = false;
          btn.classList.remove('failed');
        }, 2000);
      }
    });
  });
}

// React input 값 설정 (React는 일반 value 설정으로는 안됨)
function setReactInputValue(input, value) {
  if (!input) {
    console.error('[Input] Input element is null');
    return false;
  }

  try {
    console.log(`[Input] Setting value "${value}" to:`, input);

    // Step 1: Focus 먼저
    input.focus();

    // Step 2: 기존 값 모두 선택
    input.select();

    // Step 3: Native setter로 값 설정
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(input, value);

    // Step 4: React 이벤트들 발생
    const events = [
      new Event('input', { bubbles: true, cancelable: true }),
      new Event('change', { bubbles: true, cancelable: true }),
      new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' })
    ];

    events.forEach(event => input.dispatchEvent(event));

    // Step 5: 짧은 딜레이 후 blur
    setTimeout(() => {
      input.blur();
      console.log('[Input] ✓ Value set:', input.value);
    }, 100);

    return true;
  } catch (error) {
    console.error('[Input] ✗ Failed to set value:', error);
    return false;
  }
}

// 입력 필드 찾기 (더 robust하게)
function findPriceInputs() {
  console.log('[FindInputs] Searching for price input fields...');

  // 방법 1: data-testid로 직접 찾기 (가장 확실)
  const minPriceInput = document.querySelector('input[data-testid="range-input-0"]');
  const maxPriceInput = document.querySelector('input[data-testid="range-input-1"]');

  if (minPriceInput && maxPriceInput) {
    console.log('[FindInputs] ✓ Found via data-testid');
    console.log('[FindInputs] Min input:', minPriceInput);
    console.log('[FindInputs] Max input:', maxPriceInput);
    return { minPriceInput, maxPriceInput };
  }

  console.warn('[FindInputs] Could not find via data-testid, trying other methods...');

  // 방법 2: placeholder로 찾기
  const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
  console.log('[FindInputs] Found', inputs.length, 'text inputs');

  let min = null;
  let max = null;

  for (const input of inputs) {
    const placeholder = input.placeholder?.toLowerCase() || '';
    const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';

    console.log('[FindInputs] Checking input:', { placeholder, ariaLabel });

    if (placeholder.includes('min') || placeholder.includes('low') ||
        ariaLabel.includes('min') || ariaLabel.includes('low')) {
      min = input;
      console.log('[FindInputs] ✓ Found min input via placeholder/aria');
    }

    if (placeholder.includes('max') || placeholder.includes('high') ||
        ariaLabel.includes('max') || ariaLabel.includes('high')) {
      max = input;
      console.log('[FindInputs] ✓ Found max input via placeholder/aria');
    }
  }

  if (min && max) {
    console.log('[FindInputs] ✓ Found both inputs via placeholder/aria');
  } else {
    console.warn('[FindInputs] ✗ Could not find inputs');
  }

  return { minPriceInput: min, maxPriceInput: max };
}

// Liquidity 포맷팅 - 실제 숫자로 표시
function formatLiquidity(liquidity) {
  // Liquidity는 내부 단위이므로 그냥 간단하게 표시
  if (liquidity >= 1e15) {
    return (liquidity / 1e18).toFixed(1) + ' L';
  } else if (liquidity >= 1e12) {
    return (liquidity / 1e15).toFixed(1) + 'K L';
  } else if (liquidity >= 1e9) {
    return (liquidity / 1e12).toFixed(1) + 'M L';
  }
  return liquidity.toFixed(0);
}

// 범위 폭 계산 (%)
function calculateRangeWidth(minPrice, maxPrice) {
  const midPrice = (minPrice + maxPrice) / 2;
  const width = ((maxPrice - minPrice) / midPrice) * 100;
  return width;
}

// 범위 효율성 평가
function getRangeEfficiency(width) {
  if (width < 0.1) return { label: '초집중', risk: '매우높음', color: '#ef4444' };
  if (width < 0.5) return { label: '집중', risk: '높음', color: '#f59e0b' };
  if (width < 2) return { label: '중간', risk: '보통', color: '#10b981' };
  if (width < 10) return { label: '넓음', risk: '낮음', color: '#3b82f6' };
  return { label: '매우넓음', risk: '매우낮음', color: '#6366f1' };
}

// 예상 APY 범위 계산 (매우 대략적)
function estimateAPYRange(fee, width) {
  // Fee tier를 %로 변환
  const feePercent = fee / 10000; // 100 = 0.01%, 3000 = 0.30%

  // 범위가 좁을수록 효율은 높지만 위험도 높음
  let efficiencyMultiplier;
  if (width < 0.1) efficiencyMultiplier = 80; // 초집중
  else if (width < 0.5) efficiencyMultiplier = 40; // 집중
  else if (width < 2) efficiencyMultiplier = 15; // 중간
  else if (width < 10) efficiencyMultiplier = 4; // 넓음
  else efficiencyMultiplier = 1; // 매우넓음

  // 기본 APY 추정 (하루 거래량을 TVL의 3배로 가정)
  const dailyVolume = 3;
  const annualizedFee = feePercent * dailyVolume * 365;
  const estimatedAPY = annualizedFee * efficiencyMultiplier;

  // 범위로 표시 (불확실성 반영)
  const minAPY = estimatedAPY * 0.6;
  const maxAPY = estimatedAPY * 1.4;

  // 너무 크면 제한
  return {
    min: Math.min(minAPY, 300),
    max: Math.min(maxAPY, 500)
  };
}

// 로딩 표시
function showLoading() {
  const loader = document.createElement('div');
  loader.className = 'range-recommendation-loader';
  loader.innerHTML = `
    <div class="loader-spinner"></div>
    <span>인기 범위 분석 중...</span>
  `;

  let insertTarget = document.querySelector('[class*="price"]')?.closest('div');
  if (!insertTarget) {
    insertTarget = document.querySelector('main') || document.body;
  }

  insertTarget.insertAdjacentElement('beforebegin', loader);
}

function hideLoading() {
  document.querySelectorAll('.range-recommendation-loader').forEach(el => el.remove());
}

// 에러 표시
function showError(message) {
  // 기존 에러 제거
  document.querySelectorAll('.range-recommendation-error').forEach(el => el.remove());

  const errorPanel = document.createElement('div');
  errorPanel.className = 'range-recommendation-error';
  errorPanel.innerHTML = `
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <div class="error-message">${message}</div>
      <button class="error-retry-btn">다시 시도</button>
    </div>
  `;

  let insertTarget = document.querySelector('[class*="price"]')?.closest('div');
  if (!insertTarget) {
    insertTarget = document.querySelector('main') || document.body;
  }

  insertTarget.insertAdjacentElement('beforebegin', errorPanel);

  // 다시 시도 버튼
  errorPanel.querySelector('.error-retry-btn')?.addEventListener('click', () => {
    errorPanel.remove();
    main();
  });
}

// 메인 실행
async function main() {
  console.log('Uniswap Range Helper: Initialized');

  // URL 파라미터 추출
  const params = getURLParams();
  console.log('URL Params:', params);

  if (!params.currencyA || !params.currencyB) {
    console.log('No currency pair found in URL');
    return;
  }

  // 토큰 주소 정규화
  const token0 = normalizeTokenAddress(params.currencyA, params.chain);
  const token1 = normalizeTokenAddress(params.currencyB, params.chain);

  console.log('Analyzing pool:', { token0, token1, fee: params.fee });

  // 로딩 표시
  showLoading();

  // Background script에 메시지 전송
  chrome.runtime.sendMessage(
    {
      type: 'GET_POOL_RANGES',
      data: {
        token0,
        token1,
        fee: params.fee,
        chain: params.chain,
        originalToken0: token0, // URL에서 첫 번째 토큰
        originalToken1: token1  // URL에서 두 번째 토큰
      }
    },
    (response) => {
      hideLoading();

      console.log('='.repeat(80));
      console.log('[CONTENT] Response received:', response);

      if (!response) {
        console.error('[CONTENT] ERROR: No response from background script');
        showError('응답을 받지 못했습니다. 페이지를 새로고침해주세요.');
        return;
      }

      console.log('[CONTENT] Response.error:', response.error);
      console.log('[CONTENT] Response.recommendations:', response.recommendations);
      console.log('[CONTENT] Recommendations length:', response.recommendations?.length);

      if (response.error) {
        console.error('[CONTENT] ERROR:', response.error);
        showError(`에러 발생: ${response.error}`);
        return;
      }

      if (!response.recommendations || response.recommendations.length === 0) {
        console.log('[CONTENT] No recommendations found');
        showError('이 풀의 데이터를 찾을 수 없습니다. 다른 토큰을 시도해보세요.');
        return;
      }

      console.log('[CONTENT] Got', response.recommendations.length, 'recommendations');

      // 토큰 순서 확인
      console.log('[CONTENT] Original token0 (from URL):', token0.toLowerCase());
      console.log('[CONTENT] Original token1 (from URL):', token1.toLowerCase());
      console.log('[CONTENT] Pool token0:', response.token0);
      console.log('[CONTENT] Pool token1:', response.token1);

      // URL의 첫 번째 토큰이 풀의 token0과 다르면 가격을 역수로 변환
      // 예: URL=ETH/USDC, Pool=(USDC, ETH) → 풀 가격은 ETH/USDC, 사용자는 USDC/ETH 원함 → 역수 필요
      const shouldInvertPrice = token0.toLowerCase() !== response.token0?.toLowerCase();
      console.log('[CONTENT] Should invert price:', shouldInvertPrice);

      if (shouldInvertPrice) {
        console.log('[CONTENT] Inverting prices...');
        console.log('[CONTENT] Before invert - sample:', response.recommendations[0]);

        response.recommendations = response.recommendations.map(rec => {
          const newMin = 1 / rec.maxPrice;
          const newMax = 1 / rec.minPrice;

          console.log(`[CONTENT] Invert: ${rec.minPrice} ~ ${rec.maxPrice} → ${newMin} ~ ${newMax}`);

          return {
            ...rec,
            minPrice: newMin,
            maxPrice: newMax
          };
        });

        console.log('[CONTENT] After invert - sample:', response.recommendations[0]);
      }

      response.recommendations.forEach((rec, i) => {
        console.log(`[CONTENT] #${i + 1}: ${rec.minPrice.toFixed(2)} ~ ${rec.maxPrice.toFixed(2)} (count: ${rec.count})`);
      });
      console.log('='.repeat(80));

      displayRecommendations(response.recommendations, params.fee);
    }
  );
}

// 페이지 로드 완료 후 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  // 약간 지연 후 실행 (React 렌더링 대기)
  setTimeout(main, 2000);
}

// URL 변경 감지 (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(main, 2000);
  }
}).observe(document, { subtree: true, childList: true });
