const fs = require('fs');
const path = require('path');

// Helper para ler JSON
const readJSON = (filePath) => {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    const data = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
};

// Cache simples
let cache = {
  dogData: null,
  airdropAnalytics: null,
  forensicData: null,
  behavioralAnalysis: null,
  lastLoad: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const loadAllData = () => {
  const now = Date.now();
  
  // Recarregar se cache expirou
  if (now - cache.lastLoad > CACHE_DURATION) {
    console.log('🔄 Reloading data...');
    
    cache.dogData = readJSON('public/data/dog_holders_by_address.json');
    cache.airdropAnalytics = readJSON('public/data/airdrop_analytics.json');
    cache.forensicData = readJSON('public/data/forensic_airdrop_data.json');
    cache.behavioralAnalysis = readJSON('public/data/forensic_behavioral_analysis.json');
    cache.lastLoad = now;
    
    // Adicionar ranking aos holders
    if (cache.dogData && cache.dogData.holders) {
      cache.dogData.holders = cache.dogData.holders.map((holder, index) => ({
        ...holder,
        rank: index + 1
      }));
    }
    
    console.log('✅ Data loaded successfully');
  }
  
  return cache;
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

  const data = loadAllData();
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
        total_holders: data.dogData.total_holders || 0,
        total_supply: data.dogData.total_supply || 0,
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

