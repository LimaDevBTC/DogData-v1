#!/usr/bin/env python3
"""Leitura do índice do ord pelo servidor HTTP, no lugar do binário `ord`.

Por quê: o índice (redb) tem UM escritor só. Com o `ord server` de mainnet ligado
o tempo todo, qualquer `ord --data-dir ... balances` falha pela trava. Tudo que os
scripts liam pela linha de comando passa a vir do servidor.

Configuração (ambiente):
    ORD_HTTP_URL          padrão http://127.0.0.1:8080
    ORD_HTTP_BATCH        outpoints por POST /outputs (padrão 500)
    ORD_BALANCES_SOURCE   http (padrão) | cli. `cli` é a volta atrás: só funciona
                          com o servidor DESLIGADO (o redb tem um escritor só).
    ORD_CANDIDATES_FILE   set do scanner, candidatos extras (padrão data/dog_utxo_set.json).
    ORD_STATE_FILE        estado: outpoints de DOG + altura (padrão ~/.local/share/dogdata/).
    ORD_BINARY / ORD_DATA_DIR   só para a forma `cli` e para o modo de comparação.

O que a API do ord 0.23.2 NÃO dá: não existe rota que liste os holders de uma
runa (`/runes/balances` só aparece em versões posteriores) e `/address` e
`/outputs/<endereço>` exigem `--index-addresses`. Então o dicionário de UTXOs de
DOG que o `ord balances` devolvia é montado assim:

    1. ESTADO: os outpoints de DOG da última leitura confirmada pelo ord, com a
       altura em que valeram (ORD_STATE_FILE, fora do repositório). Nasce de UM
       `ord balances` com o servidor parado (`ord_http_compare.py seed`).
    2. EXPANSÃO: para cada bloco depois dessa altura, até a altura que o servidor
       indexou, toda transação que gasta um outpoint do conjunto tem TODAS as
       saídas adicionadas como candidatas (o DOG já foi todo cunhado; só nasce
       outpoint de DOG numa tx que gasta outpoint de DOG). Os blocos vêm do
       bitcoind (`getblock <hash> 2`). O set do scanner entra como candidato extra.
    3. Cada candidato é lido do servidor (POST /outputs): gasto ou não, quanto DOG.
    4. TRAVA DE COMPLETUDE: a soma do que o servidor confirma tem de ser IGUAL a
       premine + mints * amount - burned da runa (GET /rune/<DOG>). Se for igual,
       não existe outpoint de DOG fora do conjunto (a soma não deixa folga); se
       não for, levanta OrdHttpIncomplete em vez de devolver dado parcial.
    5. Confirmado, o estado é regravado na altura lida.

O set do scanner NÃO serve sozinho como lista: medido em 20/10, altura 972.254,
ele diverge do ord em 12,68 milhões de DOG (0,013% do supply). O ord é quem diz
quanto cada outpoint tem; o scanner só sugere onde olhar.

Quem precisar enumerar do zero (primeira vez, depois de reorg que invalide o
estado) usa `ord_http_compare.py seed` com o servidor parado, ou o
`/runes/balances` de um ord mais novo.
"""
import json
import mmap
import os
import random
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_URL = 'http://127.0.0.1:8080'
DOG_RUNE_NAME = 'DOG•GO•TO•THE•MOON'
DOG_RUNE_PLAIN = 'DOGGOTOTHEMOON'

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# ORD_CANDIDATES_FILE: set do scanner em outro lugar (testes, worktree com data/ velho)
UTXO_SET_FILE = Path(os.environ.get('ORD_CANDIDATES_FILE', PROJECT_ROOT / 'data' / 'dog_utxo_set.json'))
SCANNER_STATE_FILE = PROJECT_ROOT / 'data' / 'scanner_state.json'

STATE_FILE = Path(os.environ.get(
    'ORD_STATE_FILE', Path.home() / '.local' / 'share' / 'dogdata' / 'ord_http_dog_outpoints.json'))
BITCOIN_CLI = os.environ.get('BITCOIN_CLI', 'bitcoin-cli')

ORD_BINARY = os.environ.get(
    'ORD_BINARY', '/home/bitmax/Projects/bitcoin-fullstack/ord/target/release/ord')
ORD_DATA_DIR = os.environ.get(
    'ORD_DATA_DIR', '/home/bitmax/Projects/bitcoin-fullstack/ord/data')

# urllib respeita http_proxy do ambiente; o servidor é local, nunca por proxy.
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class OrdHttpError(RuntimeError):
    def __init__(self, msg, status=None):
        super().__init__(msg)
        self.status = status


class OrdHttpIncomplete(OrdHttpError):
    """O servidor respondeu, mas o conjunto de DOG não fecha com o supply."""


def base_url():
    return os.environ.get('ORD_HTTP_URL', DEFAULT_URL).rstrip('/')


def _request(method, path, payload=None, timeout=120):
    data = None
    headers = {'Accept': 'application/json'}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(base_url() + path, data=data, method=method, headers=headers)
    try:
        with _OPENER.open(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise OrdHttpError(f'{method} {path}: HTTP {e.code}', status=e.code) from e
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise OrdHttpError(f'{method} {path}: {e}') from e


# ── leituras simples ─────────────────────────────────────────────────────────

def status():
    """GET /status (altura indexada, índices ligados, uptime...)."""
    return _request('GET', '/status', timeout=10)


def block_height():
    """Última altura indexada pelo servidor (equivale ao `blockheight` do ord)."""
    h = status().get('height')
    if h is None:
        raise OrdHttpError('servidor sem altura indexada ainda')
    return int(h)


def server_up():
    try:
        status()
        return True
    except OrdHttpError:
        return False


def rune_entry(name=DOG_RUNE_PLAIN):
    """GET /rune/<nome>: {entry, id, mintable, parent}. Exige --index-runes."""
    return _request('GET', '/rune/' + urllib.parse.quote(name), timeout=30)


def rune_total_in_outputs(rune):
    """O que tem de estar somado nos outputs: premine + mints*amount - burned."""
    e = rune['entry']
    amount = (e.get('terms') or {}).get('amount') or 0
    return int(e['premine']) + int(e['mints']) * int(amount) - int(e['burned'])


def decode(txid):
    """GET /decode/<txid>: mesmo JSON do `ord decode --txid` (modo bruto)."""
    return _request('GET', f'/decode/{txid}', timeout=30)


def outputs(outpoints, batch=None):
    """POST /outputs em lotes. Devolve {outpoint: info}; outpoint que o servidor
    não conhece (404 no lote) fica fora do dicionário."""
    batch = batch or int(os.environ.get('ORD_HTTP_BATCH', '500'))
    outpoints = list(outpoints)
    result = {}

    def fetch(chunk):
        try:
            for info in _request('POST', '/outputs', chunk, timeout=300):
                result[info['outpoint']] = info
        except OrdHttpError as e:
            if e.status != 404:
                raise
            if len(chunk) == 1:
                return  # desconhecido: fica de fora
            mid = len(chunk) // 2
            fetch(chunk[:mid])
            fetch(chunk[mid:])

    for i in range(0, len(outpoints), batch):
        fetch(outpoints[i:i + batch])
    return result


# ── balances de DOG ──────────────────────────────────────────────────────────

def _load_json_retry(path, tries=5):
    """O scanner grava o arquivo sem rename atômico; JSON truncado -> tenta de novo."""
    for i in range(tries):
        try:
            with open(path) as fh:
                return json.load(fh)
        except (json.JSONDecodeError, FileNotFoundError):
            if i == tries - 1:
                raise
            time.sleep(2)


def load_scanner_set():
    try:
        return list(_load_json_retry(UTXO_SET_FILE).keys())
    except (OSError, ValueError):
        return []


def load_state():
    """{'height': int, 'outpoints': [...]} da última leitura confirmada, ou None."""
    try:
        with open(STATE_FILE) as fh:
            st = json.load(fh)
        return {'height': int(st['height']), 'outpoints': list(st['outpoints'])}
    except (OSError, ValueError, KeyError):
        return None


def save_state(height, outpoints):
    """Grava o estado de forma atômica (arquivo temporário + rename)."""
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix('.tmp')
    with open(tmp, 'w') as fh:
        json.dump({'height': int(height), 'outpoints': sorted(outpoints),
                   'saved_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, fh)
    os.replace(tmp, STATE_FILE)


def _bitcoin_cli(*args, timeout=300):
    r = subprocess.run([BITCOIN_CLI, *map(str, args)], capture_output=True, text=True,
                       timeout=timeout)
    if r.returncode != 0:
        raise OrdHttpError(f'bitcoin-cli {args[:2]}: {r.stderr.strip()[:200]}')
    return r.stdout


def expand_candidates(known, from_height, to_height, log=print):
    """Soma a `known` (set, alterado no lugar) as saídas de toda tx dos blocos
    from_height..to_height que gasta um outpoint de `known`. Devolve quantas somou."""
    added = 0
    for height in range(from_height, to_height + 1):
        block = json.loads(_bitcoin_cli('getblock', _bitcoin_cli('getblockhash', height).strip(), 2))
        for tx in block['tx']:
            if any(f"{v['txid']}:{v['vout']}" in known for v in tx['vin'] if 'txid' in v):
                for o in tx['vout']:
                    if o['scriptPubKey'].get('type') != 'nulldata':
                        known.add(f"{tx['txid']}:{o['n']}")
                        added += 1
    if added:
        log(f'ord http: +{added} candidatos nos blocos {from_height}..{to_height}')
    return added


def build_candidates(height, log=print):
    """Candidatos para a altura `height` do servidor: estado + scanner + expansão."""
    known = set(load_scanner_set())
    state = load_state()
    if state:
        known.update(state['outpoints'])
        if state['height'] < height:
            expand_candidates(known, state['height'] + 1, height, log)
    else:
        log('ord http: sem estado (rode `ord_http_compare.py seed` uma vez); so o scanner como candidato')
    return sorted(known)


def _is_dog(pile_map):
    return DOG_RUNE_NAME in (pile_map or {})


def dog_balances_http(candidates=None, max_wait=None, log=print, info_out=None,
                      persist=None):
    """UTXOs de DOG no mesmo formato de `ord balances`['runes'][DOG]:
    {'txid:vout': {'amount': int, 'divisibility': int, 'symbol': str}}.

    Levanta OrdHttpError se o servidor não responde e OrdHttpIncomplete se, depois
    de esperar o scanner e o servidor chegarem na mesma altura (padrão 300 s,
    ORD_HTTP_WAIT), a soma não fechar com o supply da runa. `info_out` (dict),
    se dado, recebe a resposta crua de /outputs (endereço, valor) dos candidatos.
    Sem `candidates`, usa estado + expansão e regrava o estado ao fechar (`persist`)."""
    max_wait = float(os.environ.get('ORD_HTTP_WAIT', '300')) if max_wait is None else max_wait
    deadline = time.time() + max_wait
    last = ''
    while True:
        h0 = block_height()
        cands = candidates if candidates is not None else build_candidates(h0, log)
        info = outputs(cands)
        rune = rune_entry()
        h1 = block_height()
        got = {}
        for op, o in info.items():
            if o.get('spent'):
                continue
            pile = (o.get('runes') or {}).get(DOG_RUNE_NAME)
            if pile and pile['amount'] > 0:
                got[op] = {'amount': pile['amount'],
                           'divisibility': pile['divisibility'],
                           'symbol': pile['symbol']}
        total = sum(v['amount'] for v in got.values())
        expected = rune_total_in_outputs(rune)
        if h0 == h1 and total == expected:
            if info_out is not None:
                info_out.update(info)
            if persist if persist is not None else candidates is None:
                save_state(h1, list(got))
            log(f'ord http: {len(got)} UTXOs de DOG, soma {total} = supply-burned, altura {h1}')
            return got
        last = (f'altura {h0}->{h1}, soma dos {len(cands)} candidatos = {total}, '
                f'esperado {expected} (falta {expected - total}), '
                f'{len(cands) - len(info)} candidatos desconhecidos do servidor')
        if time.time() >= deadline:
            raise OrdHttpIncomplete('conjunto de DOG nao fecha com o supply: ' + last)
        log('ord http: aguardando scanner e servidor na mesma altura: ' + last)
        time.sleep(15)


def _dog_section_from_file(path):
    """Extrai só o dict de DOG de um dump de `ord balances` (1,2 GB) sem
    carregá-lo em objetos Python."""
    key = (json.dumps(DOG_RUNE_NAME, ensure_ascii=False) + ':').encode()
    dec = json.JSONDecoder()
    with open(path, 'rb') as fh, mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        at = mm.find(key)
        if at < 0:
            return {}
        start = at + len(key)
        size = 8 << 20
        while True:
            chunk = mm[start:start + size].decode('utf-8', errors='ignore').lstrip()
            try:
                obj, _ = dec.raw_decode(chunk)
                return obj
            except json.JSONDecodeError:
                if start + size >= len(mm):
                    raise
                size *= 2


def dog_balances_cli(dump_path=None, log=print):
    """A forma antiga: `ord balances`. SÓ com o servidor desligado (trava do redb).
    Grava o dump em arquivo (não em memória) e devolve a seção de DOG."""
    if server_up():
        raise OrdHttpError('ord server esta no ar: `ord balances` nao abre o indice. '
                           'Use a forma http ou pare o servico antes.')
    out = dump_path or tempfile.mktemp(prefix='ord-balances-', suffix='.json')
    log(f'ord balances (CLI) -> {out}')
    with open(out, 'wb') as fh:
        r = subprocess.run([ORD_BINARY, '--data-dir', ORD_DATA_DIR, 'balances'],
                           stdout=fh, stderr=subprocess.PIPE)
    if r.returncode != 0:
        raise OrdHttpError(f'ord balances falhou: {r.stderr.decode()[-500:]}')
    dog = _dog_section_from_file(out)
    if dump_path is None:
        os.unlink(out)
    return dog


def get_dog_balances(log=print):
    """Ponto de entrada dos scripts. ORD_BALANCES_SOURCE=cli volta à forma antiga."""
    if os.environ.get('ORD_BALANCES_SOURCE', 'http').lower() == 'cli':
        return dog_balances_cli(log=log)
    return dog_balances_http(log=log)


# ── comparação ───────────────────────────────────────────────────────────────

def diff_balances(cli, http):
    """Compara dois dicionários de UTXOs de DOG. Vazio = idênticos."""
    only_cli = sorted(set(cli) - set(http))
    only_http = sorted(set(http) - set(cli))
    amount = {k: (cli[k]['amount'], http[k]['amount'])
              for k in set(cli) & set(http) if cli[k]['amount'] != http[k]['amount']}
    meta = {k: ((cli[k].get('divisibility'), cli[k].get('symbol')),
                (http[k].get('divisibility'), http[k].get('symbol')))
            for k in set(cli) & set(http)
            if 'divisibility' in cli[k] and
               (cli[k].get('divisibility'), cli[k].get('symbol')) !=
               (http[k].get('divisibility'), http[k].get('symbol'))}
    return {'so_no_cli': only_cli, 'so_no_http': only_http,
            'amount_diferente': amount, 'divisibilidade_ou_simbolo': meta}


def sample(seq, n, seed=966670):
    seq = list(seq)
    return random.Random(seed).sample(seq, min(n, len(seq)))
