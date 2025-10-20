const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// --- Dados DOG em tempo real ---
let dogData = null;
let dogTransactions = [];
let airdropAnalytics = null;
let forensicData = null;
let behavioralAnalysis = null;
const DOG_DATA_PATH = path.join(__dirname, '../data/dog_holders_by_address.json');
const DOG_TRANSACTIONS_PATH = path.join(__dirname, '../data/dog_transactions.json');
const AIRDROP_ANALYTICS_PATH = path.join(__dirname, '../../data/airdrop_analytics.json');
const FORENSIC_DATA_PATH = path.join(__dirname, '../../data/forensic_airdrop_data.json');
const BEHAVIORAL_ANALYSIS_PATH = path.join(__dirname, '../../data/forensic_behavioral_analysis.json');

// --- Server-Sent Events para atualizações em tempo real ---
let sseClients = [];

const loadDogData = () => {
    try {
        const data = fs.readFileSync(DOG_DATA_PATH, 'utf8');
        dogData = JSON.parse(data);
        
        // Adicionar ranking aos holders
        if (dogData.holders) {
            console.log(`📊 Adicionando ranking a ${dogData.holders.length} holders...`);
            dogData.holders = dogData.holders.map((holder, index) => ({
                ...holder,
                rank: index + 1
            }));
            console.log(`✅ Ranking adicionado. Primeiro holder: rank ${dogData.holders[0].rank}`);
        }
        
        console.log('✅ Dados DOG carregados com sucesso');
        console.log(`📊 Total de holders: ${dogData.total_holders || 0}`);
    } catch (error) {
        console.error('❌ Erro ao carregar dados DOG locais:', error.message);
        dogData = null;
    }
};

const loadDogTransactions = () => {
    try {
        if (fs.existsSync(DOG_TRANSACTIONS_PATH)) {
            const data = fs.readFileSync(DOG_TRANSACTIONS_PATH, 'utf8');
            const parsedData = JSON.parse(data);
            // O arquivo tem estrutura: { transactions: [...] }
            dogTransactions = parsedData.transactions || [];
            console.log(`✅ ${dogTransactions.length} transações DOG carregadas`);
        } else {
            dogTransactions = [];
            console.log('📋 Nenhuma transação DOG encontrada ainda');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar transações DOG:', error.message);
        dogTransactions = [];
    }
};

const loadAirdropAnalytics = () => {
    try {
        if (fs.existsSync(AIRDROP_ANALYTICS_PATH)) {
            const data = fs.readFileSync(AIRDROP_ANALYTICS_PATH, 'utf8');
            airdropAnalytics = JSON.parse(data);
            console.log('✅ Analytics do airdrop carregados com sucesso');
            console.log(`📊 Total de recipients: ${airdropAnalytics.analytics?.summary?.total_recipients || 0}`);
        } else {
            console.log('📋 Analytics do airdrop não encontrados ainda');
            airdropAnalytics = null;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar analytics do airdrop:', error.message);
        airdropAnalytics = null;
    }
};

const loadForensicData = () => {
    try {
        if (fs.existsSync(FORENSIC_DATA_PATH)) {
            const data = fs.readFileSync(FORENSIC_DATA_PATH, 'utf8');
            forensicData = JSON.parse(data);
            console.log('✅ Dados forenses do airdrop carregados');
            console.log(`📊 Total de recipients: ${forensicData.statistics?.total_recipients || 0}`);
        } else {
            console.log('📋 Dados forenses não encontrados ainda');
            forensicData = null;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados forenses:', error.message);
        forensicData = null;
    }
};

const loadBehavioralAnalysis = () => {
    try {
        if (fs.existsSync(BEHAVIORAL_ANALYSIS_PATH)) {
            const data = fs.readFileSync(BEHAVIORAL_ANALYSIS_PATH, 'utf8');
            behavioralAnalysis = JSON.parse(data);
            console.log('✅ Análise comportamental carregada');
            console.log(`🔬 Total de perfis: ${behavioralAnalysis.statistics?.total_analyzed || 0}`);
            console.log(`💎 Diamond Hands: ${behavioralAnalysis.statistics?.diamond_hands || 0}`);
        } else {
            console.log('📋 Análise comportamental não encontrada ainda');
            behavioralAnalysis = null;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar análise comportamental:', error.message);
        behavioralAnalysis = null;
    }
};

loadDogData(); // Load data on startup
loadDogTransactions(); // Load transactions on startup
loadAirdropAnalytics(); // Load airdrop analytics on startup
loadForensicData(); // Load forensic data on startup
loadBehavioralAnalysis(); // Load behavioral analysis on startup

// Função para notificar todos os clientes SSE sobre atualizações
const notifyClients = (message, data = null) => {
    const messageData = {
        type: message,
        timestamp: new Date().toISOString(),
        data: data
    };
    
    sseClients.forEach((client, index) => {
        try {
            client.write(`data: ${JSON.stringify(messageData)}\n\n`);
        } catch (error) {
            console.error(`Erro ao enviar para cliente ${index}:`, error.message);
            sseClients.splice(index, 1);
        }
    });
};

// --- Helper to execute shell commands ---
const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return reject(stderr);
            }
            resolve(stdout);
        });
    });
};

// --- API Endpoints ---

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
        message: 'DOG Data API is running',
        dogDataLoaded: !!dogData,
        totalHolders: dogData?.total_holders || 0
    });
});

// Bitcoin Node Status
app.get('/api/bitcoin/status', async (req, res) => {
    try {
        const output = await executeCommand('bitcoin-cli -rpcwallet=dogdata getblockchaininfo');
        const info = JSON.parse(output);
        res.json({
            status: 'connected',
            blockHeight: info.blocks,
            peerCount: info.connections,
            lastBlockTime: new Date(info.mediantime * 1000).toISOString(),
            chain: info.chain
    });
  } catch (error) {
        res.status(500).json({ status: 'error', message: `Failed to get Bitcoin Core status: ${error.message}` });
    }
});

// Ord CLI Status
app.get('/api/ord/status', async (req, res) => {
    try {
        const ordPath = path.join(__dirname, '../../../ord/target/release/ord');
        const dataDir = path.join(__dirname, '../../../ord/data');
        const output = await executeCommand(`${ordPath} --data-dir ${dataDir} --index-runes --index-transactions index info`);
        const info = JSON.parse(output);
        res.json({
            status: 'available',
            version: info.version,
            indexExists: info.index_exists,
            indexSize: info.index_size,
            indexedBlocks: info.indexed_blocks,
            latestBlock: info.latest_block,
            runesIndexed: info.runes_indexed,
            transactionsIndexed: info.transactions_indexed
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: `Failed to get Ord CLI status: ${error.message}` });
    }
});

// DOG Rune Stats
app.get('/api/dog-rune/stats', async (req, res) => {
    if (dogData) {
        // Buscar preço da Kraken (DOGUSD)
        let krakenPrice = 0;
        try {
            const krakenResponse = await fetch('https://api.kraken.com/0/public/Ticker?pair=DOGUSD');
            if (krakenResponse.ok) {
                const krakenData = await krakenResponse.json();
                if (krakenData.result && krakenData.result.DOGUSD) {
                    krakenPrice = parseFloat(krakenData.result.DOGUSD.c[0]);
                }
            }
        } catch (error) {
            console.log('Erro ao buscar preço da Kraken:', error.message);
        }

        const stats = {
            totalHolders: dogData.total_holders,
            totalUtxos: dogData.total_utxos,
            unresolvedUtxos: dogData.unresolved_utxos || 0,
            lastUpdated: dogData.timestamp,
            source: 'realtime_extraction',
            price: krakenPrice, // Preço da Kraken
            // Calcular estatísticas dos holders
            topHolder: dogData.holders && dogData.holders.length > 0 ? {
                address: dogData.holders[0].address,
                amount: dogData.holders[0].total_dog
            } : null,
            totalSupply: dogData.holders ? dogData.holders.reduce((sum, h) => sum + h.total_amount, 0) / 100000 : 0
        };
        res.json(stats);
    } else {
        res.status(404).json({ message: 'Nenhum dado DOG disponível', source: 'none' });
    }
});

// DOG Holders (com paginação)
app.get('/api/dog-rune/holders', (req, res) => {
    const { page = 1, limit = 50, search = '' } = req.query;
    
    if (dogData && dogData.holders) {
        let filteredHolders = dogData.holders;
        
        // Filtrar por busca se fornecida
        if (search) {
            filteredHolders = dogData.holders.filter(holder => 
                holder.address.toLowerCase().includes(search.toLowerCase())
            );
        }
        
        const currentPage = parseInt(page);
        const limitPerPage = parseInt(limit);
        const totalHolders = filteredHolders.length;
        const totalPages = Math.ceil(totalHolders / limitPerPage);
        const startIndex = (currentPage - 1) * limitPerPage;
        const endIndex = startIndex + limitPerPage;
        
        const paginatedHolders = filteredHolders.slice(startIndex, endIndex);
        
        res.json({ 
            holders: paginatedHolders, 
            totalHolders: totalHolders,
            totalPages: totalPages,
            currentPage: currentPage,
            totalUtxos: dogData.total_utxos,
            lastUpdated: dogData.timestamp,
            source: 'realtime_extraction'
        });
    } else {
        res.status(404).json({ message: 'Nenhum holder DOG disponível', source: 'none' });
    }
});

// DOG Holder específico
app.get('/api/dog-rune/holders/:address', (req, res) => {
    const { address } = req.params;
    
    if (dogData && dogData.holders) {
        const holder = dogData.holders.find(h => h.address === address);
        if (holder) {
            res.json({ holder, source: 'realtime_extraction' });
        } else {
            res.status(404).json({ message: 'Holder não encontrado' });
        }
    } else {
        res.status(404).json({ message: 'Nenhum dado DOG disponível' });
    }
});

// Top Holders
app.get('/api/dog-rune/top-holders', (req, res) => {
    const { limit = 100 } = req.query;
    
    if (dogData && dogData.holders) {
        const topHolders = dogData.holders.slice(0, parseInt(limit));
        res.json({ 
            holders: topHolders, 
            totalHolders: dogData.total_holders,
            lastUpdated: dogData.timestamp,
            source: 'realtime_extraction'
        });
    } else {
        res.status(404).json({ message: 'Nenhum holder DOG disponível' });
    }
});

// Server-Sent Events endpoint
app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Adicionar cliente à lista
    sseClients.push(res);
    
    // Enviar dados iniciais
    res.write(`data: ${JSON.stringify({
        type: 'connected',
      timestamp: new Date().toISOString(),
        data: {
            totalHolders: dogData ? dogData.total_holders : 0,
            lastUpdated: dogData ? dogData.timestamp : null
        }
    })}\n\n`);

    // Remover cliente quando desconectar
    req.on('close', () => {
        const index = sseClients.indexOf(res);
        if (index > -1) {
            sseClients.splice(index, 1);
        }
    });
});

// Função para obter o ranking de um holder
const getHolderRank = (address, holders) => {
    if (!holders || !address) return null;
    const holder = holders.find(h => h.address === address);
    return holder ? holder.rank : null;
};

// Função para adicionar ranking às transações
const addRankingToTransactions = (transactions, holders) => {
    if (!holders || !transactions) return transactions;
    
    console.log(`🔍 Enriquecendo ${transactions.length} transações com ranking...`);
    
    return transactions.map(tx => ({
        ...tx,
        dog_inputs: tx.dog_inputs ? tx.dog_inputs.map(input => ({
            ...input,
            holder_rank: getHolderRank(input.address, holders),
            is_new_holder: false // Inputs nunca são novos (já tinham DOG)
        })) : [],
        dog_outputs: tx.dog_outputs ? tx.dog_outputs.map(output => ({
            ...output,
            holder_rank: getHolderRank(output.address, holders),
            is_new_holder: isNewHolder(output.address, holders, output.amount)
        })) : [],
        all_inputs: tx.all_inputs ? tx.all_inputs.map(input => {
            const rank = getHolderRank(input.address, holders);
            // Se tem has_dog, sempre buscar o ranking (DOG não é criado, só transferido)
            return {
                ...input,
                holder_rank: input.has_dog ? rank : null,
                is_new_holder: false, // Inputs nunca são novos (já tinham DOG)
                is_former_holder: false // Simplificar - não vamos marcar como ex-holder
            };
        }) : [],
        dog_inputs: tx.dog_inputs ? tx.dog_inputs.map(input => ({
            ...input,
            holder_rank: getHolderRank(input.address, holders),
            is_new_holder: false // Inputs nunca são novos (já tinham DOG)
        })) : []
    }));
};

const isNewHolder = (address, holders, transactionAmount) => {
    try {
        // Se o endereço não está na lista de holders, é definitivamente novo
        const holder = holders.find(h => h.address === address);
        if (!holder) {
            console.log(`🆕 Endereço ${address} não está na lista de holders = NOVO`);
            return true;
        }
        
        // Se está na lista, verificar se o saldo total é igual ao valor da transação
        // Isso indica que é a primeira transação recebida
        const holderTotalDog = holder.total_dog || 0;
        const transactionAmountInDog = transactionAmount / 100000; // Converter de satoshis para DOG
        
        console.log(`🔍 Verificando se é novo holder: ${address}`);
        console.log(`   Saldo total: ${holderTotalDog} DOG`);
        console.log(`   Valor transação: ${transactionAmountInDog} DOG`);
        console.log(`   Diferença: ${Math.abs(holderTotalDog - transactionAmountInDog)}`);
        
        // Se o saldo total é igual ao valor da transação (com tolerância de 0.00001 DOG)
        const isNew = Math.abs(holderTotalDog - transactionAmountInDog) < 0.00001;
        console.log(`   É novo holder: ${isNew}`);
        
        return isNew;
    } catch (error) {
        console.error(`❌ Erro em isNewHolder para ${address}:`, error);
        return false;
    }
};

// DOG Transactions (com paginação e ranking)
app.get('/api/dog-rune/transactions', (req, res) => {
    const { page = 1, limit = 50, block = '' } = req.query;
    
    let filteredTransactions = dogTransactions;
    
    // Filtrar por bloco se fornecido
    if (block) {
        filteredTransactions = dogTransactions.filter(tx => 
            tx.block_height.toString() === block.toString()
        );
    }
    
    // Ordenar por bloco (mais recente primeiro)
    filteredTransactions.sort((a, b) => b.block_height - a.block_height);
    
    const currentPage = parseInt(page);
    const limitPerPage = parseInt(limit);
    const totalTransactions = filteredTransactions.length;
    const totalPages = Math.ceil(totalTransactions / limitPerPage);
    const startIndex = (currentPage - 1) * limitPerPage;
    const endIndex = startIndex + limitPerPage;
    
    const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    // Adicionar ranking aos holders das transações
    const enrichedTransactions = addRankingToTransactions(paginatedTransactions, dogData?.holders);
    
    res.json({ 
        transactions: enrichedTransactions, 
        totalTransactions: totalTransactions,
        totalPages: totalPages,
        currentPage: currentPage,
        lastUpdated: dogTransactions.length > 0 ? dogTransactions[0].timestamp : null,
        source: 'transaction_detector'
    });
});

// DOG Transaction Stats
app.get('/api/dog-rune/transaction-stats', (req, res) => {
    const totalTransactions = dogTransactions.length;
    
    if (totalTransactions === 0) {
        return res.json({
            totalTransactions: 0,
            latestBlock: 0,
            firstBlock: 0,
            averageTransactionsPerBlock: 0,
            lastUpdated: null,
            source: 'transaction_detector'
        });
    }
    
    // Calcular estatísticas
    const blocks = dogTransactions.map(tx => tx.block);
    const latestBlock = Math.max(...blocks);
    const firstBlock = Math.min(...blocks);
    
    // Agrupar por bloco para calcular média
    const blocksWithTransactions = new Set(blocks);
    const averageTransactionsPerBlock = totalTransactions / blocksWithTransactions.size;
    
    // Últimas 24 horas
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentTransactions = dogTransactions.filter(tx => 
        new Date(tx.timestamp) > yesterday
    );
    
    res.json({
        totalTransactions,
        latestBlock,
        firstBlock,
        averageTransactionsPerBlock: Math.round(averageTransactionsPerBlock * 100) / 100,
        transactionsLast24h: recentTransactions.length,
        lastUpdated: dogTransactions[0].timestamp,
        source: 'transaction_detector'
  });
});

// Airdrop Analytics Endpoints
app.get('/api/airdrop/summary', (req, res) => {
    if (airdropAnalytics && airdropAnalytics.analytics) {
        res.json({
            summary: airdropAnalytics.analytics.summary,
            by_category: airdropAnalytics.analytics.by_category,
            timestamp: airdropAnalytics.timestamp,
            source: 'airdrop_analytics'
        });
    } else {
        res.status(404).json({ message: 'Analytics do airdrop não disponíveis', source: 'none' });
    }
});

app.get('/api/airdrop/recipients', (req, res) => {
    const { page = 1, limit = 50, category = '' } = req.query;
    
    if (airdropAnalytics && airdropAnalytics.analytics && airdropAnalytics.analytics.recipients) {
        let filteredRecipients = airdropAnalytics.analytics.recipients;
        
        // Filtrar por categoria se fornecida
        if (category) {
            filteredRecipients = filteredRecipients.filter(r => r.status === category);
        }
        
        const currentPage = parseInt(page);
        const limitPerPage = parseInt(limit);
        const totalRecipients = filteredRecipients.length;
        const totalPages = Math.ceil(totalRecipients / limitPerPage);
        const startIndex = (currentPage - 1) * limitPerPage;
        const endIndex = startIndex + limitPerPage;
        
        const paginatedRecipients = filteredRecipients.slice(startIndex, endIndex);
        
        res.json({
            recipients: paginatedRecipients,
            totalRecipients: totalRecipients,
            totalPages: totalPages,
            currentPage: currentPage,
            timestamp: airdropAnalytics.timestamp,
            source: 'airdrop_analytics'
        });
    } else {
        res.status(404).json({ message: 'Recipients do airdrop não disponíveis', source: 'none' });
    }
});

app.get('/api/airdrop/recipient/:address', (req, res) => {
    const { address } = req.params;
    
    if (airdropAnalytics && airdropAnalytics.analytics && airdropAnalytics.analytics.recipients) {
        const recipient = airdropAnalytics.analytics.recipients.find(r => r.address === address);
        if (recipient) {
            res.json({ recipient, source: 'airdrop_analytics' });
        } else {
            res.status(404).json({ message: 'Recipient não encontrado' });
        }
    } else {
        res.status(404).json({ message: 'Analytics do airdrop não disponíveis' });
    }
});

// Forensic Analysis Endpoints
app.get('/api/forensic/summary', (req, res) => {
    if (behavioralAnalysis && behavioralAnalysis.statistics) {
        res.json({
            statistics: behavioralAnalysis.statistics,
            timestamp: behavioralAnalysis.timestamp,
            source: 'forensic_behavioral_analysis'
        });
    } else {
        res.status(404).json({ message: 'Forensic analysis not available', source: 'none' });
    }
});

app.get('/api/forensic/top-performers', (req, res) => {
    const { category = 'diamond_hands', limit = 50 } = req.query;
    
    if (behavioralAnalysis && behavioralAnalysis.top_performers) {
        const performers = behavioralAnalysis.top_performers[category] || [];
        res.json({
            category,
            performers: performers.slice(0, parseInt(limit)),
            total: performers.length,
            timestamp: behavioralAnalysis.timestamp,
            source: 'forensic_behavioral_analysis'
        });
    } else {
        res.status(404).json({ message: 'Top performers data not available', source: 'none' });
    }
});

app.get('/api/forensic/profiles', (req, res) => {
    const { page = 1, limit = 50, pattern = '', minScore = 0, maxScore = 100 } = req.query;
    
    if (behavioralAnalysis && behavioralAnalysis.all_profiles) {
        let filteredProfiles = behavioralAnalysis.all_profiles;
        
        // Filtrar por padrão comportamental
        if (pattern) {
            filteredProfiles = filteredProfiles.filter(p => p.behavior_pattern === pattern);
        }
        
        // Filtrar por diamond score
        const minScoreNum = parseInt(minScore);
        const maxScoreNum = parseInt(maxScore);
        filteredProfiles = filteredProfiles.filter(p => 
            p.diamond_score >= minScoreNum && p.diamond_score <= maxScoreNum
        );
        
        const currentPage = parseInt(page);
        const limitPerPage = parseInt(limit);
        const totalProfiles = filteredProfiles.length;
        const totalPages = Math.ceil(totalProfiles / limitPerPage);
        const startIndex = (currentPage - 1) * limitPerPage;
        const endIndex = startIndex + limitPerPage;
        
        const paginatedProfiles = filteredProfiles.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            profiles: paginatedProfiles,
            totalProfiles: totalProfiles,
            totalPages: totalPages,
            totalCount: totalProfiles,
            currentPage: currentPage,
            filters: { pattern, minScore: minScoreNum, maxScore: maxScoreNum },
            timestamp: behavioralAnalysis.timestamp,
            source: 'forensic_behavioral_analysis'
        });
    } else {
        res.status(404).json({ message: 'Behavioral profiles not available', source: 'none' });
    }
});

app.get('/api/forensic/recipient/:address', (req, res) => {
    const { address } = req.params;
    
    if (behavioralAnalysis && behavioralAnalysis.all_profiles) {
        const profile = behavioralAnalysis.all_profiles.find(p => p.address === address);
        if (profile) {
            res.json({ 
                profile, 
                timestamp: behavioralAnalysis.timestamp,
                source: 'forensic_behavioral_analysis' 
            });
        } else {
            res.status(404).json({ message: 'Recipient not found in forensic data' });
        }
    } else {
        res.status(404).json({ message: 'Forensic data not available' });
    }
});

app.get('/api/forensic/leaderboard', (req, res) => {
    const { limit = 100 } = req.query;
    
    if (behavioralAnalysis && behavioralAnalysis.all_profiles) {
        // Já está ordenado por diamond score (desc)
        const leaderboard = behavioralAnalysis.all_profiles.slice(0, parseInt(limit));
        
        res.json({
            leaderboard,
            total: behavioralAnalysis.all_profiles.length,
            timestamp: behavioralAnalysis.timestamp,
            source: 'forensic_behavioral_analysis'
        });
    } else {
        res.status(404).json({ message: 'Leaderboard data not available', source: 'none' });
    }
});

app.get('/api/forensic/patterns', (req, res) => {
    if (behavioralAnalysis && behavioralAnalysis.statistics) {
        const patterns = behavioralAnalysis.statistics.by_pattern || {};
        
        // Converter para array e adicionar percentuais
        const total = behavioralAnalysis.statistics.total_analyzed || 1;
        const patternsArray = Object.entries(patterns).map(([pattern, count]) => ({
            pattern,
            count,
            percentage: (count / total * 100).toFixed(2)
        }));
        
        // Ordenar por count
        patternsArray.sort((a, b) => b.count - a.count);
        
        res.json({
            patterns: patternsArray,
            total: total,
            timestamp: behavioralAnalysis.timestamp,
            source: 'forensic_behavioral_analysis'
        });
    } else {
        res.status(404).json({ message: 'Pattern data not available', source: 'none' });
    }
});

// Price API Proxy Endpoints
app.get('/api/price/mexc', async (req, res) => {
    try {
        const response = await fetch('https://api.mexc.com/api/v3/ticker/24hr?symbol=DOGUSDT');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/price/kraken', async (req, res) => {
    try {
        const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=DOGUSD');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/price/bitget', async (req, res) => {
    try {
        const response = await fetch('https://api.bitget.com/api/v2/spot/market/tickers?symbol=DOGUSDT');
        const data = await response.json();
        // Filtrar apenas DOGUSDT dos dados
        const dogData = data.data.find(item => item.symbol === 'DOGUSDT');
        res.json(dogData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/price/pionex', async (req, res) => {
    try {
        const response = await fetch('https://api.pionex.com/api/v1/market/tickers');
        const data = await response.json();
        // Filtrar apenas DOG_USDT dos dados
        const dogData = data.data.tickers.find(item => item.symbol === 'DOG_USDT');
        res.json(dogData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cache para o preço da Gate.io (extraído do gráfico TradingView)
let gateioPriceCache = {
    lastPrice: "0.001641",
    priceChangePercent: "2.76",
    volume: "716982.69",
    highPrice: "0.001681",
    lowPrice: "0.001567",
    openPrice: "0.001594",
    closePrice: "0.001640",
    timestamp: Date.now(),
    source: "TradingView Chart"
};

// Função para extrair preço real do gráfico TradingView
async function updateGateioPrice() {
    try {
        // Extrair preço real do gráfico TradingView via API
        // Usar a API do TradingView para obter dados reais
        const response = await fetch('https://scanner.tradingview.com/crypto/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "filter": [
                    {
                        "left": "name",
                        "operation": "match",
                        "right": "DOGUSDT.P"
                    }
                ],
                "options": {
                    "lang": "en"
                },
                "markets": ["crypto"],
                "symbols": {
                    "query": {
                        "types": []
                    },
                    "tickers": []
                },
                "columns": [
                    "name",
                    "close",
                    "change",
                    "change_abs",
                    "volume",
                    "high",
                    "low",
                    "open"
                ],
                "sort": {
                    "sortBy": "volume",
                    "sortOrder": "desc"
                },
                "range": [0, 1]
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                const symbolData = data.data[0].d;
                const currentTime = Date.now();
                
                gateioPriceCache = {
                    lastPrice: symbolData[1].toFixed(6), // close
                    priceChangePercent: symbolData[2].toFixed(2), // change
                    volume: symbolData[4].toFixed(2), // volume
                    highPrice: symbolData[5].toFixed(6), // high
                    lowPrice: symbolData[6].toFixed(6), // low
                    openPrice: symbolData[7].toFixed(6), // open
                    closePrice: symbolData[1].toFixed(6), // close
                    timestamp: currentTime,
                    source: "TradingView API (Real-time)"
                };
                
                console.log('✅ Preço Gate.io atualizado via TradingView API:', gateioPriceCache.lastPrice);
            }
        }
    } catch (error) {
        console.error('Erro ao extrair preço real do TradingView:', error);
        // Manter o cache atual se houver erro
    }
}

// Atualizar preço a cada 30 segundos
setInterval(updateGateioPrice, 30000);

app.get('/api/price/gateio', async (req, res) => {
    try {
        // Atualizar preço antes de retornar
        await updateGateioPrice();
        res.json(gateioPriceCache);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DOG Rune Data Endpoint
app.get('/api/dog-rune/data', async (req, res) => {
    try {
        // Buscar dados da API da Hiro
        let burned = 23486991.67; // Valor padrão
        let totalSupply = 100000000000; // 100 bilhões
        let apiSource = "Default";
        
        try {
            const hiroResponse = await fetch('https://api.hiro.so/runes/v1/etchings/840000:3');
            if (hiroResponse.ok) {
                const hiroData = await hiroResponse.json();
                if (hiroData.supply && hiroData.supply.burned && hiroData.supply.premine) {
                    burned = parseFloat(hiroData.supply.burned);
                    totalSupply = parseFloat(hiroData.supply.premine); // 100B fixo
                    apiSource = "Hiro API";
                    console.log(`✅ Dados da rune DOG atualizados: ${burned.toFixed(2)} tokens queimados de ${totalSupply.toFixed(0)}`);
                }
            }
        } catch (apiError) {
            console.log('Hiro API não disponível, usando dados padrão');
        }

        // Circulating Supply = Total Supply - Burned
        const circulatingSupply = totalSupply - burned;
        
        const dogRuneData = {
            name: "DOG•GO•TO•THE•MOON",
            runeId: "840000:3",
            totalSupply: totalSupply,
            burned: burned,
            circulatingSupply: circulatingSupply,
            burnedPercentage: (burned / totalSupply) * 100,
            lastUpdated: new Date().toISOString(),
            source: apiSource
        };
        
        res.json(dogRuneData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reload Data Endpoint
app.post('/api/reload-data', (req, res) => {
    loadDogData();
    loadDogTransactions();
    loadAirdropAnalytics();
    loadForensicData();
    loadBehavioralAnalysis();
    
    // Notificar todos os clientes sobre a atualização
    notifyClients('data_updated', {
        totalHolders: dogData ? dogData.total_holders : 0,
        totalTransactions: dogTransactions.length,
        totalRecipients: airdropAnalytics ? airdropAnalytics.analytics?.summary?.total_recipients : 0,
        forensicProfiles: behavioralAnalysis ? behavioralAnalysis.statistics?.total_analyzed : 0,
        lastUpdated: dogData ? dogData.timestamp : null
    });
    
    if (dogData) {
        res.json({ 
            success: true, 
            message: 'Dados recarregados com sucesso', 
            dataSource: 'realtime_extraction',
            totalHolders: dogData.total_holders,
            totalTransactions: dogTransactions.length,
            totalRecipients: airdropAnalytics ? airdropAnalytics.analytics?.summary?.total_recipients : 0,
            forensicProfiles: behavioralAnalysis ? behavioralAnalysis.statistics?.total_analyzed : 0,
            lastUpdated: dogData.timestamp
        });
    } else {
        res.status(500).json({ success: false, message: 'Falha ao recarregar dados' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 DOG Data API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Bitcoin Status: http://localhost:${PORT}/api/bitcoin/status`);
    console.log(`📋 Ord CLI Status: http://localhost:${PORT}/api/ord/status`);
    console.log(`🐕 DOG Stats: http://localhost:${PORT}/api/dog-rune/stats`);
    console.log(`👥 DOG Holders: http://localhost:${PORT}/api/dog-rune/holders`);
    console.log(`🏆 Top Holders: http://localhost:${PORT}/api/dog-rune/top-holders`);
    console.log(`💸 DOG Transactions: http://localhost:${PORT}/api/dog-rune/transactions`);
    console.log(`📈 Transaction Stats: http://localhost:${PORT}/api/dog-rune/transaction-stats`);
    console.log(`🎁 Airdrop Summary: http://localhost:${PORT}/api/airdrop/summary`);
    console.log(`👥 Airdrop Recipients: http://localhost:${PORT}/api/airdrop/recipients`);
    console.log(`🔬 Forensic Summary: http://localhost:${PORT}/api/forensic/summary`);
    console.log(`🏆 Top Performers: http://localhost:${PORT}/api/forensic/top-performers`);
    console.log(`📊 Behavioral Profiles: http://localhost:${PORT}/api/forensic/profiles`);
    console.log(`👤 Recipient Profile: http://localhost:${PORT}/api/forensic/recipient/:address`);
    console.log(`🎯 Leaderboard: http://localhost:${PORT}/api/forensic/leaderboard`);
    console.log(`📈 Behavior Patterns: http://localhost:${PORT}/api/forensic/patterns`);
    console.log(`🔄 Reload Data: http://localhost:${PORT}/api/reload-data`);
});