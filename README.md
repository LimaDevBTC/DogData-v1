# 🐕 DOG DATA - Professional Forensic Analysis Platform

> The most complete airdrop analysis database in the DOG community

[![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)]()
[![Recipients](https://img.shields.io/badge/recipients-75,490-blue)]()
[![Holders](https://img.shields.io/badge/holders-92,740-orange)]()
[![Diamond%20Hands](https://img.shields.io/badge/diamond%20hands-24,623-purple)]()

---

## 🎯 What We Built

A **complete forensic analysis system** for the DOG•GO•TO•THE•MOON airdrop with:

- ✅ 75,490 airdrop recipients tracked
- ✅ 92,740 current holders monitored
- ✅ 14 behavioral categories
- ✅ Diamond Score (0-100) for each recipient
- ✅ Hall of Fame ranked by current balance
- ✅ Real-time sell pressure monitoring
- ✅ Personalized insights for each wallet

---

## 📊 Key Statistics

### Airdrop Distribution
- **75,490** unique recipients
- **67.17 billion** DOG distributed
- **889,830 DOG** average per recipient

### Current Behavior
- **39.7%** still holding (29,932)
- **60.3%** sold everything (45,558)
- **32.6%** are Diamond Hands (24,623)
- **5.7%** accumulated more (4,339)
- **4.8%** actively dumping (3,647)

### Top Performers
- **256 Mega Whales** (10x+ accumulation)
- **255 Whales** (5x-10x accumulation)
- **718 Mega Accumulators** (2x-5x)
- **52 Pure Diamond Hands** (exactly 100%)

---

## 🏆 Hall of Fame

**Top 5 by Current Balance:**

1. **#1:** Received 889k → Now holds **85M DOG** (+9,456%!) 🐋
2. **#2:** Received 889k → Now holds **20M DOG** (+2,147%!) 🐋
3. **#3:** Received 889k → Now holds **18.4M DOG** (+1,969%!) 🐋
4. **#4:** Received 889k → Now holds **11.2M DOG** (+1,165%!) 🐋
5. **#5:** Received 889k → Now holds **10.5M DOG** (+1,090%!) 🐋

---

## 🌐 Web Interface

### Pages:
- `/overview` - General statistics
- `/holders` - Current holder list (92k+)
- `/airdrop` - Airdrop dossier
- `/forensic` ⭐ - Forensic analysis & Hall of Fame
- `/bitcoin-network` - Blockchain info
- `/transactions` - Coming soon

### Access:
```
Frontend: http://localhost:3000
Backend API: http://localhost:3001
```

---

## 🚀 Quick Start

### Start Services:
```bash
# 1. Bitcoin Core
bitcoind -daemon

# 2. Backend
cd backend && node src/server.js &

# 3. Frontend
npm run dev
```

### Update Data:
```bash
# Update holders
cd ../ord && python3 efficient_dog_extractor.py

# Update forensic analysis
cd DogData-v1 && python3 scripts/forensic_behavior_analyzer.py

# Reload backend
curl -X POST http://localhost:3001/api/reload-data
```

---

## 📁 Project Structure

```
DogData-v1/
├── app/                    # Next.js pages
│   ├── overview/          # Overview page
│   ├── holders/           # Holders list
│   ├── airdrop/           # Airdrop dossier
│   ├── forensic/          # Forensic analysis ⭐
│   ├── bitcoin-network/   # Network info
│   └── transactions/      # Coming soon
├── backend/
│   └── src/
│       └── server.js      # Express API (18 endpoints)
├── scripts/
│   ├── efficient_dog_extractor.py          # Update holders
│   ├── forensic_airdrop_extractor.py       # Extract recipients
│   └── forensic_behavior_analyzer.py       # Generate analysis
├── data/
│   ├── airdrop_recipients.json             # 75k recipients
│   ├── forensic_airdrop_data.json          # Forensic data
│   └── forensic_behavioral_analysis.json   # Behavioral profiles
└── docs/                   # Documentation
```

---

## 🔬 Behavioral Categories

### 🟢 Elite Performers (Score 90-100)
- 💎 Diamond Hands - Holds exactly 100%
- 🐋 Mega Whale - 10x+ accumulation
- 🐳 Whale - 5x-10x accumulation

### 🔵 Strong Holders (Score 70-89)
- �� Mega Accumulator - 2x-5x
- 💪 Strong Accumulator - 50%+
- 📊 Accumulator - 10%+

### 🟡 Stable Holders (Score 50-69)
- 🤝 Holder - Stable
- 💪 Strong Holder - 90%+
- 😐 Moderate Holder - 75%+

### �� Weak Holders (Score 25-49)
- 😰 Weak Holder - 50%+
- 📉 Heavy Seller - Sold 50%+

### 🔴 Dumpers (Score 0-24)
- 🚨 Active Dumper - Sold 75%+
- ⚠️ Almost Sold - <10% remaining
- 📄 Paper Hands - Sold everything

---

## 🎯 Unique Insights

Every recipient profile includes:

```javascript
{
  airdrop_rank: 1,              // Original airdrop position
  current_rank: 5,              // Current holder position
  airdrop_amount: 889806,       // Received in airdrop
  current_balance: 2500000,     // Current balance
  percentage_change: 181,       // % change since airdrop
  rank_change: -4,              // Moved up 4 positions
  diamond_score: 85,            // Score 0-100
  accumulation_rate: 15000,     // +15k DOG/day
  is_dumping: false,            // Selling pressure flag
  insights: [                   // Personalized insights
    "Accumulated 181% since airdrop",
    "Fast accumulator: +15,000 DOG/day"
  ]
}
```

---

## 💡 Community Value

### What makes this unique:

1. **Complete recipient list** - All 75k addresses
2. **Exact amounts** - What each one received
3. **Behavioral profiling** - 14 categories
4. **Diamond Score** - Unique 0-100 metric
5. **Hall of Fame** - Merit-based ranking
6. **Real-time tracking** - Always updated
7. **Personalized insights** - For each wallet

---

## 📝 License & Credits

Created for the DOG community with ❤️

**Version:** 1.0.0  
**Date:** October 17, 2024  
**Status:** 🚀 Production Ready

---

**Access the system:** http://localhost:3000  
**View Hall of Fame:** http://localhost:3000/forensic
