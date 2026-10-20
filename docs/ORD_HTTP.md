# ord mainnet sempre ligado: os scripts leem o servidor HTTP

O `ord server` de mainnet passa a ficar no ar o tempo todo (o worker do mint da
DogCity precisa dele por semanas). O índice
(`ord/data/index.redb`, 195 GB, redb) tem UM escritor só, então qualquer
`ord --data-dir ... balances` falha pela trava. Os scripts do DogData deixaram de
abrir o índice pela linha de comando: leem `http://127.0.0.1:8080` (variável
`ORD_HTTP_URL`). Código em `scripts/ord_http.py`; comparação em
`scripts/ord_http_compare.py`.

## 1. Chamadas ao binário `ord` que existiam

| Onde | Chamada | O que lia | Quem roda | Agora |
|---|---|---|---|---|
| `update_holders_and_fees.py` | `ord --data-dir data balances` (cwd `ord/`) | todos os UTXOs de DOG com quantidade (só a seção `DOG•GO•TO•THE•MOON` era usada) | cron `0 * * * *` via `automated_update.py` | `ord_http.get_dog_balances()` |
| `update_holders_and_fees.py` | `pgrep/pkill -f 'ord.*server'` e `nohup ord ... server` | parava e religava o servidor em volta do `balances` | idem | **removido** |
| `dog_block_scanner.py` | `ord balances` em `ord_balances()` / `bootstrap_utxo_set()` (só `--bootstrap` ou sem `dog_utxo_set.json`) | idem | `dog-scanner.service` | `ord_http` |
| `dog_block_scanner.py` | `pkill`/`Popen` do `ord server` no bootstrap | parava e religava o servidor | idem | **removido** |
| `dog_block_scanner.py` | `ord decode --txid` em `ord_decode()` (só referência; o caminho quente usa o decoder local) | runestone da tx | nada no caminho quente | `GET /decode/<txid>` |
| `export_holders_by_age.py` | `ord balances` + `pkill` do servidor | UTXOs de DOG | manual | `ord_http` |
| `backfill_dog_history.py` | `ord decode --txid` | runestone da tx | manual | `GET /decode/<txid>` |
| `backend/src/server.js` (`/api/ord/status`, backend legado parado) | `ord index info` | estado do índice | manual | `GET /status` |
| `resolve-rune-inputs.py` | já era HTTP (`ORD_URL`) | `/output/<outpoint>` | manual | aceita `ORD_HTTP_URL` |
| `compare-utxo-vs-ord.py`, `reseed-utxo-from-ord.py` | liam um dump de `ord balances` | arquivo | manual | o dump sai de `ord_http_compare.py dump` |

Não usam o binário: `automated_update.py` e os demais scripts que ele chama
(`build_price_history`, `build_surviving_cohort_history`, `append_metrics_snapshot`,
`update_airdrop_analytics`, `update_forensic_analysis`, `update_diamond_paws_lost`,
`collect_metrics_history.ts`), `sync_genealogy_balances.py`,
`dog_genealogy_updater.py`, `tx_class_scanner.py`, `dog_mempool_watcher.py` e o
`refresh_owners.py` do runestone. O `ord decode` nunca abriu o índice (fala com o
bitcoind), então só o `balances` quebrava com o servidor ligado.

⚠️ Antes desta mudança o `pkill -f 'ord.*server'` do `update_holders_and_fees.py`
derrubava QUALQUER processo com `ord` e `server` na linha de comando, inclusive o
`ord-signet.service` (`--chain signet ... server --http-port 38080`), e o servidor
de mainnet religado por ele ficava fora do systemd. Por isso a ordem da virada
(seção 4) importa.

## 2. Como o `ord balances` virou HTTP

O ord 0.23.2 NÃO tem rota que liste os holders de uma runa, e `/address/<a>` e
`/outputs/<a>` exigem `--index-addresses` (o índice de mainnet não tem). O que
existe: `GET /status`, `GET /rune/<nome>`, `POST /outputs` (lote de outpoints) e
`GET /decode/<txid>`, todos com `Accept: application/json`. Então a lista de
UTXOs de DOG é mantida por nós e CONFERIDA pelo ord a cada leitura:

1. **Estado**: os outpoints de DOG da última leitura confirmada pelo ord e a
   altura dela, em `~/.local/share/dogdata/ord_http_dog_outpoints.json`
   (`ORD_STATE_FILE`; fora do repositório para o bot de commit não subir 17 MB por
   hora). Nasce de UM `ord balances` com o servidor parado
   (`ord_http_compare.py seed --run-cli`, seção 4).
2. **Expansão por blocos**: para cada bloco depois da altura do estado, até a
   altura que o servidor indexou, toda transação que gasta um outpoint do conjunto
   tem todas as saídas (menos OP_RETURN) somadas como candidatas. O DOG já foi todo
   cunhado, então só nasce outpoint de DOG numa tx que gasta outpoint de DOG. Os
   blocos vêm do bitcoind (`getblock <hash> 2`). O set do scanner entra como
   candidato extra.
3. Cada candidato é lido do servidor em lotes de 500 (`POST /outputs`): gasto ou
   não, e quanto DOG carrega (`runes["DOG•GO•TO•THE•MOON"]`, o mesmo `Pile`
   `{amount, divisibility, symbol}` do `ord balances`). Só o campo `runes` vale: o
   `spent` da resposta vem do bitcoind (ponta da cadeia) e o `runes` vem do índice
   do ord (altura indexada); com um bloco de diferença entre os dois, descartar por
   `spent` perderia DOG que o índice ainda conta.
4. **Trava de completude**: a soma tem de ser IGUAL a
   `premine + mints * terms.amount - burned` da runa (`GET /rune/DOGGOTOTHEMOON`).
   Se bate, não existe outpoint de DOG fora do conjunto (a soma não deixa folga).
   Se não bate, a leitura espera (até `ORD_HTTP_WAIT`, 300 s) o servidor e o
   bitcoind chegarem à mesma altura e, esgotado o prazo, levanta
   `OrdHttpIncomplete`: o script devolve falha e NÃO publica dado parcial (o cron
   já tolera falha do holders e segue com o resto).
5. Confirmado, o estado é regravado (atômico) na altura lida.

Resultado: o mesmo dicionário `{outpoint: {amount, divisibility, symbol}}`.

⚠️ O set do scanner (`data/dog_utxo_set.json`) NÃO serve sozinho como lista: em
20/10, altura 972.254, ele tinha 240.339 outpoints e somava 12,68 milhões de DOG a
menos que o ord (0,013% do supply; o ord tem 240.330 outpoints). É por isso que o
`update_holders_and_fees.py` sempre usou o `ord balances` como verdade. O ord diz
quanto cada outpoint tem; o scanner só sugere onde olhar.

### O que a API não dá igual

- **Enumeração do zero** (primeira vez, estado perdido, reorg que invalide o
  estado): sem rota de holders, a leitura HTTP só acompanha e confere um conjunto
  que já existe; um outpoint fora dele é acusado pela trava, não descoberto. Nesses
  casos: parar `ord-mainnet`, `ord_http_compare.py seed --run-cli`, religar.
  Proposta de longo prazo: um ord com `/runes/balances` (não existe na 0.23.2) ou
  esse patch de rota no fork local; aí o conjunto sai inteiro por HTTP e o estado
  some.
- `ord balances` rodava `index.update()` até a ponta antes de despejar; o servidor
  se atualiza sozinho, então a leitura é "até a altura indexada agora".
- O dump do `ord balances` trazia TODAS as runas (1,2 GB); a leitura HTTP traz só
  o DOG (sem os 1,2 GB em memória). Em contrapartida o cron depende do bitcoind
  (`getblock`) para a expansão, como o resto dos scripts.

## 3. Modo de comparação

`scripts/ord_http_compare.py` roda as duas formas e acusa diferença (código de
saída 1):

```bash
# balances: o `ord balances` não abre o índice com o servidor ligado, então a forma
# CLI roda antes (servidor desligado) e grava o dump; a HTTP é comparada com ele.
python3 scripts/ord_http_compare.py balances --run-cli --keep /tmp/ord-balances.json   # servidor desligado
python3 scripts/ord_http_compare.py balances --cli-file /tmp/ord-balances.json --wallets 12
python3 scripts/ord_http_compare.py balances --against-scanner       # contra o set do scanner (mostra a divergência dele)
python3 scripts/ord_http_compare.py seed --run-cli                     # estado inicial (servidor desligado)

# decode: o CLI não toca o índice, então as duas formas rodam lado a lado
python3 scripts/ord_http_compare.py decode --blocks 972240,972241 --per-block 6

# dump por HTTP no formato antigo (entrada de compare-utxo-vs-ord / reseed)
python3 scripts/ord_http_compare.py dump
```

Para a comparação de balances valer, dump e leitura HTTP têm de ser da mesma
altura (o script imprime a altura do servidor e a do bitcoind). Para congelar a
altura, suba o servidor com `--no-sync` (o índice fica na altura em que o
`ord balances` o deixou). `--candidates prod` (padrão) usa estado + expansão, o
caminho de produção, sem gravar o estado; `--candidates cli` usa os outpoints do dump.

## 4. A virada

Ordem importa: o código novo tem de estar no checkout que o cron usa ANTES de o
servidor subir; o código antigo ainda mataria o servidor com `pkill`.

1. Mesclar este PR e conferir no checkout do cron
   (`/home/bitmax/Projects/bitcoin-fullstack/DogData-v1`):
   `git log -1 --format=%h` contém o merge e
   `grep -c get_dog_balances scripts/update_holders_and_fees.py` dá `1`.
   Se o merge entrar ANTES do servidor estar de pé e semeado, ponha
   `ORD_BALANCES_SOURCE=cli` em `.env.local` do checkout do cron (o holders volta a
   abrir o índice pelo binário, sem `pkill`) e retire a linha no passo 5; sem isso
   a leitura HTTP falha (conexão recusada) e o holders daquela hora não atualiza.
   O `dog-scanner.service` é Python de longa vida: reiniciar
   (`sudo systemctl restart dog-scanner`) para carregar o `ord_http` (só o
   bootstrap e a função de referência `ord_decode` mudaram; o caminho quente não).
2. **Semear o estado** (uma vez, com o `ord` ainda parado, fora das :00 a :35, com a
   trava): `flock -n /tmp/dogdata-update.lock python3 scripts/ord_http_compare.py seed --run-cli`
   (roda o `ord balances` pela última vez; imprime a altura e o número de outpoints
   gravados). Sem semente, a leitura cai no set do scanner e acusa `OrdHttpIncomplete`.
3. Criar `/etc/systemd/system/ord-mainnet.service`:

```ini
[Unit]
Description=Ord mainnet (indexador + HTTP) para o mint da DogCity e o DogData
After=bitcoind.service
Requires=bitcoind.service

[Service]
Type=simple
User=bitmax
Group=bitmax
WorkingDirectory=/home/bitmax/Projects/bitcoin-fullstack/ord
ExecStart=/home/bitmax/.cargo/bin/ord --data-dir /home/bitmax/Projects/bitcoin-fullstack/ord/data --index-runes server --address 127.0.0.1 --http-port 8080
Restart=always
RestartSec=15
TimeoutStopSec=300
MemoryMax=6G
Nice=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ord-mainnet

[Install]
WantedBy=multi-user.target
```

   - `--address 127.0.0.1`: o padrão do ord é `0.0.0.0`, e o `ord.service` antigo
     (inativo) expunha a porta.
   - `TimeoutStopSec=300`: o ord faz commit do redb ao receber SIGTERM; matar no
     meio força reparo no próximo start.
   - `MemoryMax=6G` é o teto usado na prova; se o systemd matar o serviço por
     memória (`journalctl -u ord-mainnet | grep -i oom`), subir o teto.
   - Desativar o antigo: `sudo systemctl disable ord.service` (nunca ligar os dois).
4. Subir FORA da janela pesada, depois do fim do cron das :00 (minuto >= 35), com
   a trava segurada até o serviço responder:
   `flock /tmp/dogdata-update.lock -c 'sudo systemctl enable --now ord-mainnet && until curl -sf -H "Accept: application/json" http://127.0.0.1:8080/status >/dev/null; do sleep 2; done'`
5. Conferir: `curl -s -H 'Accept: application/json' http://127.0.0.1:8080/status`
   (`height` igual ao `bitcoin-cli getblockcount`), e na primeira hora cheia
   `tail logs/automated_update.log` deve mostrar `ord http: N UTXOs de DOG, soma ... =
   supply-burned` e `Script de holders executado com sucesso`.

### O cron

A linha `0 * * * * flock -n /tmp/dogdata-update.lock ...` pode ficar igual. O que
muda: a trava `/tmp/dogdata-update.lock` deixa de ser a trava do ord e passa a
servir só para uma rodada do `automated_update.py` não atropelar a outra. Ninguém
mais precisa parar o ord, esperar o fim do cron ou segurar a trava para operar o
servidor; a janela :00 a :35 deixa de ser exclusiva do ord. Quando a virada
estiver estável, pode-se renomear a trava para `/tmp/dogdata-holders.lock`.

### Voltar atrás

1. `sudo systemctl disable --now ord-mainnet` (o worker do mint para junto; avisar
   antes).
2. Para os scripts voltarem a abrir o índice pelo binário, `ORD_BALANCES_SOURCE=cli`
   em `.env.local` (lido por `update_holders_and_fees.py`) ou no ambiente do
   `dog-scanner.service`. Com o servidor desligado o `ord balances` volta a
   funcionar; ligado, falha com mensagem clara em vez de travar.
3. Se preferir o código antigo inteiro: `git revert <merge>` (traz de volta o
   `pkill` do servidor; só faça com o `ord-mainnet` desligado).

## 5. Prova de equivalência

(preenchida abaixo com a execução real)
