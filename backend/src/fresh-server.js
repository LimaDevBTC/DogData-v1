const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Carregar dados frescos se disponíveis
let dogData = null;
let dataSource = 'none';

const loadDogData = () => {
  try {
    // Tentar carregar dados frescos primeiro
    const freshDataPath = path.join(__dirname, '../data/dog_fresh_data.json');
    if (fs.existsSync(freshDataPath)) {
      const data = fs.readFileSync(freshDataPath, 'utf8');
      dogData = JSON.parse(data);
      dataSource = 'fresh_ord_index';
      console.log('✅ Dados DOG frescos carregados do index.redb');
      return true;
    }
    
    // Fallback para dados de backup
    const backupDataPath = path.join(__dirname, '../data/dog_complete_data.json');
    if (fs.existsSync(backupDataPath)) {
      const data = fs.readFileSync(backupDataPath, 'utf8');
      dogData = JSON.parse(data);
      dataSource = 'backup_data';
      console.log('⚠️ Usando dados de backup (dados frescos não disponíveis)');
      return true;
    }
    
    console.log('❌ Nenhum dado DOG disponível');
    return false;
  } catch (error) {
    console.error('❌ Erro ao carregar dados DOG:', error.message);
    return false;
  }
};

// Inicializar dados
loadDogData();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    dataLoaded: dogData !== null,
    dataSource: dataSource,
    message: 'DOG Data Fresh API is running'
  });
});

// Status do Bitcoin Node
app.get('/api/bitcoin/status', (req, res) => {
  exec('bitcoin-cli getblockchaininfo', (error, stdout, stderr) => {
    if (error) {
      return res.json({
        status: 'disconnected',
        error: error.message
      });
    }

    try {
      const info = JSON.parse(stdout);
      res.json({
        status: 'connected',
        blockHeight: info.blocks,
        peerCount: info.connections,
        lastBlockTime: new Date(info.time * 1000).toISOString(),
        chain: info.chain,
        verificationProgress: info.verificationprogress
      });
    } catch (parseError) {
      res.json({
        status: 'error',
        error: 'Erro ao parsear resposta do Bitcoin CLI'
      });
    }
  });
});

// Status do Ord CLI
app.get('/api/ord/status', (req, res) => {
  exec('ord --version', (error, stdout, stderr) => {
    if (error) {
      return res.json({
        status: 'unavailable',
        error: error.message
      });
    }

    const version = stdout.trim();
    
    // Verificar se há index.redb
    const indexPath = '/home/bitmax/Projects/bitcoin-fullstack/ord/data/index.redb';
    const indexExists = fs.existsSync(indexPath);
    const indexSize = indexExists ? fs.statSync(indexPath).size : 0;
    
    res.json({
      status: 'available',
      version: version,
      indexExists: indexExists,
      indexSize: indexSize,
      indexSizeMB: (indexSize / (1024 * 1024)).toFixed(2),
      message: 'Ord CLI is available'
    });
  });
});

// Status do Indexador
app.get('/api/indexer/status', (req, res) => {
  const indexPath = '/home/bitmax/Projects/bitcoin-fullstack/ord/data/index.redb';
  const indexExists = fs.existsSync(indexPath);
  
  if (indexExists) {
    const stats = fs.statSync(indexPath);
    res.json({
      status: 'running',
      lastIndexedBlock: 'Unknown', // Seria necessário consultar o index
      dogEvents: dogData ? dogData.events?.length || 0 : 0,
      indexSize: stats.size,
      indexSizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      lastModified: stats.mtime.toISOString(),
      message: 'Indexer is running with fresh data'
    });
  } else {
    res.json({
      status: 'stopped',
      message: 'Index not found'
    });
  }
});

// Dados da runa DOG
app.get('/api/dog-rune/stats', (req, res) => {
  if (!dogData) {
    return res.status(404).json({ 
      error: 'Dados DOG não disponíveis',
      message: 'Execute a indexação para gerar dados frescos'
    });
  }

  const runeInfo = dogData.runeInfo || {};
  const allHolders = dogData.allHolders || [];
  const events = dogData.events || [];

  const totalSupply = parseInt(runeInfo.premine || '10000000000000000');
  const burned = parseInt(runeInfo.burned || '0');
  const circulatingSupply = totalSupply - burned;

  res.json({
    totalSupply: totalSupply.toString(),
    totalBurned: burned.toString(),
    circulatingSupply: circulatingSupply.toString(),
    totalHolders: allHolders.length.toString(),
    totalTransactions: events.length.toString(),
    divisibility: runeInfo.divisibility || 5,
    symbol: runeInfo.symbol || "🐕",
    spacedRune: runeInfo.spacedRune || "DOG•GO•TO•THE•MOON",
    timestamp: new Date().toISOString(),
    source: dataSource,
    indexSize: dogData.indexSize || 0
  });
});

// Lista de holders
app.get('/api/dog-rune/holders', (req, res) => {
  if (!dogData || !dogData.allHolders) {
    return res.status(404).json({ 
      error: 'Dados de holders não disponíveis' 
    });
  }

  const start = parseInt(req.query.start) || 0;
  const limit = parseInt(req.query.limit) || 50;
  
  const holders = dogData.allHolders
    .slice(start, start + limit)
    .map(holder => ({
      address: holder.address,
      amount: holder.amount,
      divisibility: 5,
      symbol: "🐕"
    }));

  res.json({
    holders: holders,
    totalHolders: dogData.allHolders.length,
    timestamp: new Date().toISOString(),
    source: dataSource
  });
});

// Transações
app.get('/api/dog-rune/transactions', (req, res) => {
  if (!dogData || !dogData.events) {
    return res.status(404).json({ 
      error: 'Dados de transações não disponíveis' 
    });
  }

  const start = parseInt(req.query.start) || 0;
  const limit = parseInt(req.query.limit) || 50;
  
  const transactions = dogData.events
    .slice(start, start + limit)
    .map(event => ({
      txid: event.txid,
      height: event.height,
      timestamp: event.timestamp,
      type: 'transfer',
      fromAddress: event.fromAddress || '',
      toAddress: event.toAddress || '',
      amount: event.amount,
      divisibility: 5
    }));

  res.json({
    transactions: transactions,
    total: dogData.events.length,
    timestamp: new Date().toISOString(),
    source: dataSource
  });
});

// Recarregar dados
app.post('/api/reload-data', (req, res) => {
  const success = loadDogData();
  res.json({
    success: success,
    dataSource: dataSource,
    message: success ? 'Dados recarregados com sucesso' : 'Erro ao recarregar dados'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 DOG Data Fresh API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Bitcoin Status: http://localhost:${PORT}/api/bitcoin/status`);
  console.log(`📋 Ord CLI Status: http://localhost:${PORT}/api/ord/status`);
  console.log(`🗂️ Indexer Status: http://localhost:${PORT}/api/indexer/status`);
  console.log(`🐕 DOG Stats: http://localhost:${PORT}/api/dog-rune/stats`);
  console.log(`👥 DOG Holders: http://localhost:${PORT}/api/dog-rune/holders`);
  console.log(`📈 DOG Transactions: http://localhost:${PORT}/api/dog-rune/transactions`);
  console.log(`🔄 Reload Data: http://localhost:${PORT}/api/reload-data`);
});


