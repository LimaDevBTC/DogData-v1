const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'DOG Data Debug API is running'
  });
});

// Bitcoin Node Status
app.get('/api/bitcoin/status', (req, res) => {
  console.log('Bitcoin status requested');
  res.json({
    status: 'connected',
    blockHeight: 916236,
    peerCount: 8,
    lastBlockTime: new Date().toISOString(),
    chain: 'main',
    message: 'Bitcoin Node is connected'
  });
});

// Ord CLI Status
app.get('/api/ord/status', (req, res) => {
  console.log('Ord CLI status requested');
  res.json({
    status: 'available',
    version: '0.18.1',
    message: 'Ord CLI is available'
  });
});

// Indexer Status
app.get('/api/indexer/status', (req, res) => {
  console.log('Indexer status requested');
  res.json({
    status: 'running',
    lastIndexedBlock: 916236,
    dogEvents: 15000,
    message: 'Indexer is running'
  });
});

// DOG Rune Stats
app.get('/api/dog-rune/stats', (req, res) => {
  console.log('DOG stats requested');
  res.json({
    totalSupply: '10000000000000000',
    totalBurned: '2348699167000',
    circulatingSupply: '9997651300830000',
    totalHolders: '93994',
    totalTransactions: '15000',
    divisibility: 5,
    symbol: '🐕',
    spacedRune: 'DOG•GO•TO•THE•MOON',
    timestamp: new Date().toISOString(),
    source: 'mock_data'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 DOG Data Debug API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});


