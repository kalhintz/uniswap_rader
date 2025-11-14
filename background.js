// Token decimals 조회 (ERC20 contract)
async function getTokenDecimals(tokenAddress) {
  const RPC_URLS = ['https://eth.drpc.org', 'https://cloudflare-eth.com'];

  // decimals() 함수 signature: 0x313ce567
  const data = '0x313ce567';

  for (const RPC_URL of RPC_URLS) {
    try {
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_call',
          params: [
            { to: tokenAddress.toLowerCase(), data },
            'latest'
          ]
        })
      });

      const result = await response.json();
      if (result.error) continue;

      return parseInt(result.result, 16);
    } catch (e) {
      continue;
    }
  }

  // Fallback: 일반적인 decimals
  return 18;
}

// Uniswap API
async function findPoolAddress(token0, token1, fee) {
  const response = await fetch('https://interface.gateway.uniswap.org/v2/data.v1.DataApiService/ListPools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chainId: 1,
      token0,
      token1,
      fee,
      protocolVersions: ['PROTOCOL_VERSION_V3'],
      hooks: '0x0000000000000000000000000000000000000000'
    })
  });

  const data = await response.json();
  console.log('[API] Full response:', JSON.stringify(data, null, 2));

  if (!data.pools?.length) throw new Error('Pool not found');

  const pool = data.pools[0];
  console.log('[API] Pool object:', JSON.stringify(pool, null, 2));

  // 풀의 실제 token0, token1 주소 (주소 순서대로 정렬됨)
  const poolToken0 = pool.token0?.address || pool.token0 || pool.protocolVersion0?.address;
  const poolToken1 = pool.token1?.address || pool.token1 || pool.protocolVersion1?.address;

  console.log('[API] Extracted poolToken0:', poolToken0);
  console.log('[API] Extracted poolToken1:', poolToken1);

  // ✅ Decimals를 직접 조회 (풀의 실제 토큰 주소 사용)
  const token0Decimals = await getTokenDecimals(poolToken0 || token0);
  const token1Decimals = await getTokenDecimals(poolToken1 || token1);

  return {
    poolId: pool.poolId,
    tick: pool.tick,
    token0: poolToken0?.toLowerCase(),
    token1: poolToken1?.toLowerCase(),
    token0Decimals,
    token1Decimals
  };
}

// RPC
async function getMintEventsWeb3(poolAddress, blockRange = 5000) {
  const RPC_URLS = ['https://eth.drpc.org', 'https://cloudflare-eth.com', 'https://ethereum-rpc.publicnode.com'];

  for (const RPC_URL of RPC_URLS) {
    try {
      console.log('[RPC] Trying:', RPC_URL);
      const result = await fetchMintEvents(RPC_URL, poolAddress, blockRange);
      console.log('[RPC] ✓ Success:', result.length, 'events');
      return result;
    } catch (e) {
      console.error('[RPC] ✗ Failed:', e.message);
    }
  }
  throw new Error('All RPC failed');
}

async function fetchMintEvents(RPC_URL, poolAddress, blockRange) {
  const blockRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] })
  });

  const blockData = await blockRes.json();
  if (blockData.error) throw new Error(blockData.error.message);

  const latestBlock = parseInt(blockData.result, 16);
  const fromBlock = latestBlock - blockRange;

  console.log('[RPC] Blocks:', fromBlock, '-', latestBlock, `(${blockRange} blocks, ~${Math.floor(blockRange * 12 / 3600)}h)`);

  const logsRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_getLogs',
      params: [{
        address: poolAddress.toLowerCase(),
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + latestBlock.toString(16),
        topics: ['0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde']
      }]
    })
  });

  const logsData = await logsRes.json();
  if (logsData.error) throw new Error(logsData.error.message);

  return parseMintsFromLogs(logsData.result || []);
}

function parseMintsFromLogs(logs) {
  console.log('[Parse] Total logs:', logs.length);

  return logs.map((log, idx) => {
    function hexToInt24(hex) {
      // ✅ 마지막 6자만 가져오기 (3바이트 = 24비트)
      const last6 = hex.slice(-6);
      let v = parseInt(last6, 16);
      // 24비트 signed: 최상위 비트가 1이면 음수
      if (v >= 0x800000) v -= 0x1000000;
      return v;
    }

    const tickLower = hexToInt24(log.topics[2]);
    const tickUpper = hexToInt24(log.topics[3]);

    // 첫 3개만 상세 로그
    if (idx < 3) {
      console.log(`[Parse #${idx + 1}] topics[2]: ${log.topics[2]}`);
      console.log(`[Parse #${idx + 1}] topics[2] last6: ${log.topics[2].slice(-6)}`);
      console.log(`[Parse #${idx + 1}] tickLower: ${tickLower}`);
      console.log(`[Parse #${idx + 1}] topics[3]: ${log.topics[3]}`);
      console.log(`[Parse #${idx + 1}] topics[3] last6: ${log.topics[3].slice(-6)}`);
      console.log(`[Parse #${idx + 1}] tickUpper: ${tickUpper}`);
    }

    const amountHex = log.data.slice(66, 130);
    const amount = BigInt('0x' + amountHex);

    return {
      tickLower: { tickIdx: tickLower.toString() },
      tickUpper: { tickIdx: tickUpper.toString() },
      liquidity: amount.toString()
    };
  });
}

// 분석
function analyzePositions(positions, currentTick, token0Decimals, token1Decimals) {
  const rangeMap = new Map();

  console.log('='.repeat(50));
  console.log('[Analyze] Total positions:', positions.length);
  console.log('[Analyze] Current tick:', currentTick);
  console.log('[Analyze] Token0 decimals:', token0Decimals);
  console.log('[Analyze] Token1 decimals:', token1Decimals);

  // Decimals adjustment 계산
  // price = 1.0001^tick (raw units: token1_raw / token0_raw)
  // To convert to human readable: multiply by 10^(decimals0 - decimals1)
  const decimalsAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  console.log('[Analyze] Decimals adjustment:', decimalsAdjustment);

  let skipped = 0;
  let valid = 0;

  positions.forEach((pos, idx) => {
    const tickLower = parseInt(pos.tickLower.tickIdx);
    const tickUpper = parseInt(pos.tickUpper.tickIdx);
    const liquidity = BigInt(pos.liquidity);

    const tickWidth = tickUpper - tickLower;

    // Full range만 제외
    if (tickWidth > 200000) {
      skipped++;
      return;
    }

    const key = `${tickLower}_${tickUpper}`;

    if (rangeMap.has(key)) {
      const existing = rangeMap.get(key);
      existing.count += 1;
      existing.liquidity += liquidity;
    } else {
      // ✅ Decimals를 고려한 가격 계산
      const minPrice = Math.pow(1.0001, tickLower) * decimalsAdjustment;
      const maxPrice = Math.pow(1.0001, tickUpper) * decimalsAdjustment;

      // 첫 3개만 상세 로그
      if (valid < 3) {
        console.log(`[Analyze #${valid + 1}]`);
        console.log(`  Tick: [${tickLower}, ${tickUpper}]`);
        console.log(`  Raw price (1.0001^tick): [${Math.pow(1.0001, tickLower).toExponential(4)}, ${Math.pow(1.0001, tickUpper).toExponential(4)}]`);
        console.log(`  Decimals adjustment: ${decimalsAdjustment}`);
        console.log(`  Final price: [${minPrice.toExponential(4)}, ${maxPrice.toExponential(4)}]`);
        console.log(`  Final price (fixed): [${minPrice.toFixed(8)}, ${maxPrice.toFixed(8)}]`);
      }

      valid++;

      rangeMap.set(key, {
        tickLower,
        tickUpper,
        count: 1,
        liquidity,
        minPrice,
        maxPrice
      });
    }
  });

  console.log('[Analyze] Valid:', valid, '| Skipped:', skipped);

  const ranges = Array.from(rangeMap.values());
  ranges.sort((a, b) => b.count - a.count);

  console.log('[Analyze] Unique ranges:', ranges.length);
  console.log('[Analyze] Top 3:');
  ranges.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.minPrice.toFixed(8)}, ${r.maxPrice.toFixed(8)}] - count: ${r.count}`);
  });

  return ranges.map(r => ({
    ...r,
    liquidity: Number(r.liquidity)
  }));
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_POOL_RANGES') {
    const { token0, token1, fee } = request.data;

    (async () => {
      try {
        // 저장된 블록 수 가져오기 (기본값: 5000)
        const storage = await chrome.storage.sync.get(['blockRange']);
        const blockRange = storage.blockRange || 5000;

        console.log('='.repeat(80));
        console.log('[BACKGROUND] Starting...');
        console.log('[BACKGROUND] Token0:', token0);
        console.log('[BACKGROUND] Token1:', token1);
        console.log('[BACKGROUND] Fee:', fee);
        console.log('[BACKGROUND] Block Range:', blockRange, `(~${Math.floor(blockRange * 12 / 3600)}h)`);

        console.log('[Step 1] Finding pool...');
        const pool = await findPoolAddress(token0, token1, fee);
        console.log('[Step 1] ✓ Pool:', pool.poolId);
        console.log('[Step 1] ✓ Tick:', pool.tick);
        console.log('[Step 1] ✓ Token0 decimals:', pool.token0Decimals);
        console.log('[Step 1] ✓ Token1 decimals:', pool.token1Decimals);

        console.log('[Step 2] Fetching events...');
        const positions = await getMintEventsWeb3(pool.poolId, blockRange);
        console.log('[Step 2] ✓ Positions:', positions.length);

        if (!positions.length) {
          console.log('[ERROR] No positions');
          sendResponse({ error: '데이터 없음', recommendations: [] });
          return;
        }

        console.log('[Step 3] Analyzing...');
        const recommendations = analyzePositions(positions, pool.tick, pool.token0Decimals, pool.token1Decimals);
        console.log('[Step 3] ✓ Recommendations:', recommendations.length);

        if (!recommendations.length) {
          console.log('[ERROR] No valid recommendations');
          sendResponse({ error: '유효한 범위 없음', recommendations: [] });
          return;
        }

        const response = {
          poolAddress: pool.poolId,
          currentTick: pool.tick,
          token0: pool.token0,
          token1: pool.token1,
          blockRange: blockRange,  // ✅ 블록 범위 추가
          recommendations: recommendations.slice(0, 10)
        };

        console.log('[SUCCESS] Sending', response.recommendations.length, 'recommendations');
        console.log('[SUCCESS] Top:', {
          min: response.recommendations[0].minPrice.toFixed(2),
          max: response.recommendations[0].maxPrice.toFixed(2),
          count: response.recommendations[0].count
        });
        console.log('='.repeat(80));

        sendResponse(response);

      } catch (error) {
        console.error('='.repeat(80));
        console.error('[FATAL ERROR]', error);
        console.error('[FATAL ERROR] Message:', error.message);
        console.error('[FATAL ERROR] Stack:', error.stack);
        console.error('='.repeat(80));
        sendResponse({ error: error.message, recommendations: [] });
      }
    })();

    return true;
  }
});

console.log('✓✓✓ Background script loaded v1.3.0 (with configurable block range) ✓✓✓');
