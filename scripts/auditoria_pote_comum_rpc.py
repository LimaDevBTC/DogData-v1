import json, base64, http.client, os, time
COOKIE = open(os.path.expanduser('~/.bitcoin/.cookie')).read().strip()
AUTH = 'Basic ' + base64.b64encode(COOKIE.encode()).decode()
MEU = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/potecomum/cache'
VELHO = '/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/txcache'
os.makedirs(MEU, exist_ok=True)

def _p(base, txid):
    d = os.path.join(base, txid[:2]); return d, os.path.join(d, txid + '.json')

def normaliza(d):
    """aceita formato cru do getrawtransaction v2 OU meu formato reduzido"""
    if d is None or 'erro' in d: return None
    if 'n_in' in d and 'vin' in d and (not d['vin'] or 'a' in d['vin'][0]):
        return d
    if 'vin' not in d or 'vout' not in d: return None
    red = {'vin': [], 'vout': [], 'n_in': len(d['vin'])}
    for v in d['vin']:
        po = v.get('prevout') or {}
        red['vin'].append({'a': (po.get('scriptPubKey') or {}).get('address'), 'v': po.get('value')})
    for o in d['vout']:
        spk = o.get('scriptPubKey') or {}
        red['vout'].append({'a': spk.get('address'), 'v': o.get('value'), 'op': spk.get('type') == 'nulldata'})
    return red

def load(txid):
    for base in (MEU, VELHO):
        _, p = _p(base, txid)
        if os.path.exists(p):
            try: d = json.load(open(p))
            except Exception: continue
            r = normaliza(d)
            if r is not None:
                if base is VELHO:
                    dd, pp = _p(MEU, txid); os.makedirs(dd, exist_ok=True); json.dump(r, open(pp, 'w'))
                return r
    return None

def fetch(txids, lote=200, pausa=0.35):
    faltam = [t for t in dict.fromkeys(txids) if load(t) is None]
    for i in range(0, len(faltam), lote):
        pedaco = faltam[i:i+lote]
        body = json.dumps([{"jsonrpc":"1.0","id":t,"method":"getrawtransaction","params":[t,2]} for t in pedaco])
        for k in range(4):
            try:
                c = http.client.HTTPConnection('127.0.0.1', 8332, timeout=300)
                c.request('POST','/',body,{'Authorization':AUTH,'Content-Type':'application/json'})
                res = json.loads(c.getresponse().read()); c.close(); break
            except Exception:
                if k==3: raise
                time.sleep(2+k*3)
        for item in res:
            t=item['id']; d=item.get('result')
            dd,pp=_p(MEU,t); os.makedirs(dd,exist_ok=True)
            json.dump(normaliza(d) or {'erro':1}, open(pp,'w'))
        time.sleep(pausa)
    return len(faltam)
