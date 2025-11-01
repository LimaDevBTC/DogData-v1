// Helper para fazer fetch de JSON com retry (arquivos servidos como estáticos)
const fetchJSON = async (fileName, req, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      // Usar o host da requisição para garantir URL correta
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_URL;
      const baseUrl = `${protocol}://${host}`;
      
      const url = `${baseUrl}/data/${fileName}`;
      
      if (i === 0) {
        console.log(`📥 Attempting to fetch: ${url}`);
      } else {
        console.log(`🔄 Retry ${i}/${retries - 1} for: ${fileName}`);
      }
      
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(15000) // 15s timeout
      });
      
      console.log(`   Response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`❌ Fetch failed: ${response.status} ${response.statusText}`);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          continue;
        }
        return null;
      }
      
      const data = await response.json();
      console.log(`✅ Successfully loaded: ${fileName} (${JSON.stringify(data).length} bytes)`);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching ${fileName} (attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        console.error(`   Stack:`, error.stack);
        return null;
      }
    }
  }
  return null;
};

// Cache robusto com fallback
let cache = {
  dogData: null,
  airdropAnalytics: null,
  forensicData: null,
  behavioralAnalysis: null,
  lastLoad: 0,
  lastSuccessfulLoad: 0,
  isLoading: false
};

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos (arquivos grandes)
const STALE_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas - arquivos estáticos não mudam tanto

const loadAllData = async (req) => {
  const now = Date.now();
  
  // Se está carregando, aguardar um pouco e retornar cache
  if (cache.isLoading) {
    console.log('⏳ Already loading data, using current cache');
    return cache;
  }
  
  // Se cache ainda é fresco, retornar
  if (now - cache.lastLoad < CACHE_DURATION) {
    console.log('📦 Using fresh cached data (age:', Math.floor((now - cache.lastLoad) / 1000), 'seconds)');
    return cache;
  }
  
  // Se cache é muito antigo MAS temos dados, tentar recarregar em background
  if (cache.dogData && now - cache.lastSuccessfulLoad < STALE_CACHE_MAX_AGE) {
    console.log('📦 Using stale cache while reloading (age:', Math.floor((now - cache.lastLoad) / 1000), 'seconds)');
    
    // Recarregar em background (não aguardar)
    (async () => {
      cache.isLoading = true;
      try {
        await reloadCache(req);
      } finally {
        cache.isLoading = false;
      }
    })();
    
    return cache;
  }
  
  // Cache expirou ou não existe - recarregar agora
  console.log('🔄 Cache expired or empty, reloading now...');
  cache.isLoading = true;
  
  try {
    await reloadCache(req);
  } finally {
    cache.isLoading = false;
  }
  
  return cache;
};

const reloadCache = async (req) => {
  console.log('🔄 Starting data reload...');
  const now = Date.now();
  
  try {
    // PRIORIDADE 1: Dados essenciais (holders e airdrop analytics)
    // Carregar em paralelo mas com timeout individual
    const [newDogData, newAirdropAnalytics] = await Promise.all([
      fetchJSON('dog_holders_by_address.json', req, 2), // 2 retries (arquivo grande)
      fetchJSON('airdrop_analytics.json', req, 2)
    ]);
    
    if (newDogData) {
      // Adicionar ranking aos holders
      if (newDogData.holders) {
        newDogData.holders = newDogData.holders.map((holder, index) => ({
          ...holder,
          rank: index + 1
        }));
      }
      cache.dogData = newDogData;
      cache.lastSuccessfulLoad = now;
      console.log('   ✅ dogData reloaded (16 MB)');
    } else {
      console.log('   ⚠️ dogData reload failed, keeping old cache');
    }
    
    if (newAirdropAnalytics) {
      cache.airdropAnalytics = newAirdropAnalytics;
      console.log('   ✅ airdropAnalytics reloaded (18 MB)');
    } else {
      console.log('   ⚠️ airdropAnalytics reload failed, keeping old cache');
    }
    
    // PRIORIDADE 2: Dados forenses (muito grandes, carregar depois)
    // Carregar de forma lazy, não bloquear se falhar
    setTimeout(async () => {
      console.log('🔄 Loading forensic data in background...');
      
      const [newForensicData, newBehavioralAnalysis] = await Promise.all([
        fetchJSON('forensic_airdrop_data.json', req, 1), // 1 retry apenas (59 MB!)
        fetchJSON('forensic_behavioral_analysis.json', req, 1) // 1 retry apenas (49 MB!)
      ]);
      
      if (newForensicData) {
        cache.forensicData = newForensicData;
        console.log('   ✅ forensicData loaded (59 MB)');
      }
      
      if (newBehavioralAnalysis) {
        cache.behavioralAnalysis = newBehavioralAnalysis;
        console.log('   ✅ behavioralAnalysis loaded (49 MB)');
      }
      
      console.log('✅ Background forensic data load completed');
    }, 100); // Delay mínimo para não bloquear
    
    cache.lastLoad = now;
    console.log('✅ Essential data reload completed (forensic data loading in background)');
  } catch (error) {
    console.error('❌ Error in reloadCache:', error.message);
    // Não limpar cache em caso de erro - manter dados antigos
  }
};

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const data = await loadAllData(req);
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  
  // Helper para extrair query params
  const url = new URL(req.url, `http://${req.headers.host}`);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  
  try {
    // ============ DOG RUNE ENDPOINTS ============
    
    if (pathname === '/api/dog-rune/stats') {
      if (!data.dogData) {
        return res.status(404).json({ message: 'DOG data not available' });
      }
      
      return res.json({
        totalHolders: data.dogData.total_holders || 0,
        total_holders: data.dogData.total_holders || 0,
        totalUtxos: data.dogData.total_utxos || 0,
        total_supply: data.dogData.total_supply || 0,
        lastUpdated: data.dogData.last_updated || new Date().toISOString(),
        last_updated: data.dogData.last_updated || new Date().toISOString()
      });
    }
    
    if (pathname === '/api/dog-rune/holders') {
      if (!data.dogData || !data.dogData.holders) {
        return res.status(404).json({ message: 'Holders data not available' });
      }
      
      const holders = data.dogData.holders;
      const totalHolders = holders.length;
      const totalPages = Math.ceil(totalHolders / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedHolders = holders.slice(startIndex, endIndex);
      
      return res.json({
        holders: paginatedHolders,
        currentPage: page,
        totalPages: totalPages,
        totalHolders: totalHolders,
        itemsPerPage: limit
      });
    }
    
    if (pathname === '/api/dog-rune/top-holders') {
      if (!data.dogData || !data.dogData.holders) {
        return res.status(404).json({ message: 'Holders data not available' });
      }
      
      const topLimit = parseInt(url.searchParams.get('limit') || '10');
      return res.json({
        topHolders: data.dogData.holders.slice(0, topLimit)
      });
    }
    
    // ============ AIRDROP ENDPOINTS ============
    
    if (pathname === '/api/airdrop/summary') {
      if (!data.airdropAnalytics || !data.airdropAnalytics.analytics) {
        return res.status(404).json({ message: 'Airdrop analytics not available' });
      }
      
      return res.json({
        summary: data.airdropAnalytics.analytics.summary,
        by_category: data.airdropAnalytics.analytics.by_category,
        timestamp: data.airdropAnalytics.timestamp
      });
    }
    
    if (pathname === '/api/airdrop/recipients') {
      if (!data.airdropAnalytics || !data.airdropAnalytics.analytics) {
        return res.status(404).json({ message: 'Airdrop recipients not available' });
      }
      
      const recipients = data.airdropAnalytics.analytics.recipients;
      const totalRecipients = recipients.length;
      const totalPages = Math.ceil(totalRecipients / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRecipients = recipients.slice(startIndex, endIndex);
      
      return res.json({
        recipients: paginatedRecipients,
        currentPage: page,
        totalPages: totalPages,
        totalRecipients: totalRecipients
      });
    }
    
    // ============ FORENSIC ENDPOINTS ============
    
    if (pathname === '/api/forensic/summary') {
      if (!data.behavioralAnalysis) {
        return res.status(404).json({ message: 'Behavioral analysis not available' });
      }
      
      return res.json({
        statistics: data.behavioralAnalysis.statistics,
        timestamp: data.behavioralAnalysis.timestamp
      });
    }
    
    if (pathname === '/api/forensic/profiles') {
      if (!data.behavioralAnalysis || !data.behavioralAnalysis.all_profiles) {
        return res.status(404).json({ message: 'Behavioral profiles not available' });
      }
      
      let profiles = data.behavioralAnalysis.all_profiles;
      const pattern = url.searchParams.get('pattern');
      const minScore = parseInt(url.searchParams.get('minScore') || '0');
      const maxScore = parseInt(url.searchParams.get('maxScore') || '100');
      
      // Filtrar por padrão
      if (pattern) {
        profiles = profiles.filter(p => p.behavior_pattern === pattern);
      }
      
      // Filtrar por score
      profiles = profiles.filter(p => 
        p.diamond_score >= minScore && p.diamond_score <= maxScore
      );
      
      // Já vem ordenado do arquivo, mas garantir ordem
      profiles.sort((a, b) => {
        if (b.receive_count !== a.receive_count) {
          return b.receive_count - a.receive_count;
        }
        return b.airdrop_amount - a.airdrop_amount;
      });
      
      const totalProfiles = profiles.length;
      const totalPages = Math.ceil(totalProfiles / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProfiles = profiles.slice(startIndex, endIndex);
      
      return res.json({
        success: true,
        profiles: paginatedProfiles,
        totalProfiles: totalProfiles,
        totalPages: totalPages,
        totalCount: totalProfiles,
        currentPage: page,
        timestamp: data.behavioralAnalysis.timestamp
      });
    }
    
    if (pathname === '/api/forensic/top-performers') {
      if (!data.behavioralAnalysis) {
        return res.status(404).json({ message: 'Top performers not available' });
      }
      
      return res.json({
        top_performers: data.behavioralAnalysis.top_performers,
        timestamp: data.behavioralAnalysis.timestamp
      });
    }
    
    // ============ PRICE ENDPOINTS ============
    
    if (pathname === '/api/price/mexc') {
      const response = await fetch('https://api.mexc.com/api/v3/ticker/24hr?symbol=DOGUSDT');
      const priceData = await response.json();
      return res.json(priceData);
    }
    
    if (pathname === '/api/price/kraken') {
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=DOGUSD');
      const priceData = await response.json();
      return res.json(priceData);
    }
    
    if (pathname === '/api/price/bitget') {
      const response = await fetch('https://api.bitget.com/api/v2/spot/market/tickers?symbol=DOGUSDT');
      const priceData = await response.json();
      const dogData = priceData.data?.find(item => item.symbol === 'DOGUSDT');
      return res.json(dogData || {});
    }
    
    if (pathname === '/api/price/pionex') {
      const response = await fetch('https://api.pionex.com/api/v1/market/tickers');
      const priceData = await response.json();
      const dogData = priceData.data?.tickers?.find(item => item.symbol === 'DOG_USDT');
      return res.json(dogData || {});
    }
    
    if (pathname === '/api/price/gateio') {
      // Usar API direta da Gate.io (mais confiável)
      try {
        const gateResponse = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=DOG_USDT');
        const gateData = await gateResponse.json();
        
        if (gateData && gateData.length > 0) {
          const ticker = gateData[0];
          const gateioData = {
            lastPrice: ticker.last,
            priceChangePercent: ticker.change_percentage,
            volume: ticker.quote_volume,
            highPrice: ticker.high_24h,
            lowPrice: ticker.low_24h,
            openPrice: ticker.last, // Gate.io API não fornece open, usar last
            closePrice: ticker.last,
            timestamp: Date.now(),
            source: "Gate.io API"
          };
          return res.json(gateioData);
        }
        
        return res.status(404).json({
          lastPrice: "0",
          priceChangePercent: "0",
          source: "No data"
        });
      } catch (error) {
        console.error('❌ Error fetching Gate.io price:', error.message);
        return res.status(500).json({ error: error.message });
      }
    }
    
    if (pathname === '/api/dog-rune/data') {
      // Dados da rune DOG
      const burned = 23486991.67;
      const totalSupply = 100000000000;
      const circulatingSupply = totalSupply - burned;
      
      return res.json({
        name: "DOG•GO•TO•THE•MOON",
        runeId: "840000:3",
        totalSupply: totalSupply,
        burned: burned,
        circulatingSupply: circulatingSupply,
        burnedPercentage: (burned / totalSupply) * 100,
        lastUpdated: new Date().toISOString(),
        source: "api"
      });
    }
    
    // ============ HEALTH CHECK ============
    
    if (pathname === '/api/health') {
      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        dataLoaded: {
          dogData: !!data.dogData,
          airdropAnalytics: !!data.airdropAnalytics,
          forensicData: !!data.forensicData,
          behavioralAnalysis: !!data.behavioralAnalysis
        }
      });
    }
    
    // Rota não encontrada
    return res.status(404).json({ 
      error: 'Route not found',
      path: pathname,
      availableRoutes: [
        '/api/health',
        '/api/dog-rune/stats',
        '/api/dog-rune/holders',
        '/api/dog-rune/top-holders',
        '/api/airdrop/summary',
        '/api/airdrop/recipients',
        '/api/forensic/summary',
        '/api/forensic/profiles',
        '/api/forensic/top-performers'
      ]
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

