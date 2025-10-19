# 🚀 Quick Start Guide

## Start All Services

```bash
# 1. Start Bitcoin Core (if not running)
bitcoind -daemon

# 2. Start Backend
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1/backend
node src/server.js &

# 3. Start Frontend
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
npm run dev
```

## Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Forensic Analysis: http://localhost:3000/forensic

## Update Data

```bash
# Update holders
cd /home/bitmax/Projects/bitcoin-fullstack/ord
python3 efficient_dog_extractor.py

# Update forensic analysis
cd /home/bitmax/Projects/bitcoin-fullstack/DogData-v1
python3 scripts/forensic_behavior_analyzer.py

# Reload backend
curl -X POST http://localhost:3001/api/reload-data
```

## First Time Setup

```bash
# Extract airdrop recipients (once, ~15min)
python3 scripts/forensic_airdrop_extractor.py
```

---

**Status:** ✅ All systems ready!
