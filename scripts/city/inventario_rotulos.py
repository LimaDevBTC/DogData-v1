#!/usr/bin/env python3
"""
INVENTARIO DE ROTULOS x FILA DA DOGCITY.

Pergunta que esta ferramenta responde, e so ela: de todo endereco que o projeto
ja rotulou a mao (migracao do Supabase, tabela em producao, verified_addresses),
quais estao na fila RESIDENCIAL do snapshot 966.670, ou seja, recebendo lote de
morador, e quais foram para a fila INSTITUCIONAL.

⚠️ SO LE. Nao escreve em public/, data/, supabase/ nem no gerador. A saida vai
para stdout (texto) e, com --json, para o caminho que voce passar.

⚠️ A TABELA EM PRODUCAO MANDA sobre a migracao. Ha linha em producao que nenhuma
migracao insere (o detector de entidade escreveu direto no banco em 24/08/2026),
e ha nota de prova que foi reescrita no banco depois da migracao. Por isso a
coluna `fonte` diz de onde veio cada linha, e quando as duas discordam o
inventario registra as duas.

Uso:
  python3 scripts/city/inventario_rotulos.py
  python3 scripts/city/inventario_rotulos.py --labels /caminho/dog_labels.json
"""

import argparse
import csv
import json
import os
import re
import sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

MIGRACOES = os.path.join(RAIZ, 'supabase', 'migrations')
VERIFIED = os.path.join(RAIZ, 'public', 'data', 'verified_addresses.json')
ORDEM_RES = os.path.join(RAIZ, 'data', 'snapshots', 'dog_966670_ordem_residencial.json')
TAG_INST = os.path.join(RAIZ, 'data', 'snapshots', 'dog_966670_tag_institucional.json')
LOTES = os.path.join(RAIZ, 'data', 'dogcity_lotes.csv')

# bech32m (taproot/segwit) e base58 (legacy/p2sh)
RE_ENDERECO = re.compile(r'\b(bc1[a-z0-9]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b')


def enderecos_das_migracoes():
    """Todo endereco citado em qualquer .sql, com o arquivo e a linha.

    Citado NAO e o mesmo que rotulado: uma nota de prova cita o endereco de
    outra carteira o tempo todo. Quem separa e o cruzamento com a tabela.
    """
    achados = {}
    for nome in sorted(os.listdir(MIGRACOES)):
        if not nome.endswith('.sql'):
            continue
        caminho = os.path.join(MIGRACOES, nome)
        with open(caminho, encoding='utf-8') as fh:
            for n, linha in enumerate(fh, 1):
                for m in RE_ENDERECO.finditer(linha):
                    achados.setdefault(m.group(1), []).append(f'{nome}:{n}')
    return achados


def rotulos_de_producao(caminho):
    if not caminho or not os.path.exists(caminho):
        return {}
    with open(caminho, encoding='utf-8') as fh:
        linhas = json.load(fh)
    return {r['address']: r for r in linhas}


def verificados():
    with open(VERIFIED, encoding='utf-8') as fh:
        j = json.load(fh)
    return j.get('verified', {})


def fila_residencial():
    with open(ORDEM_RES, encoding='utf-8') as fh:
        j = json.load(fh)
    return {r['address']: r for r in j['ordem']}, j


def fila_institucional():
    with open(TAG_INST, encoding='utf-8') as fh:
        j = json.load(fh)
    return {r['address']: r for r in j['linhas']}, j


def lotes_por_endereco():
    """address -> lista de lotes. Um endereco pode ter mais de um lote."""
    saida = {}
    if not os.path.exists(LOTES):
        return saida
    with open(LOTES, newline='', encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            saida.setdefault(r['address'], []).append(r)
    return saida


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--labels', help='JSON exportado de dog_labels em producao')
    ap.add_argument('--json', help='grava o inventario neste caminho')
    args = ap.parse_args()

    prod = rotulos_de_producao(args.labels)
    citados = enderecos_das_migracoes()
    ver = verificados()
    res, meta_res = fila_residencial()
    inst, meta_inst = fila_institucional()
    lotes = lotes_por_endereco()

    universo = set(prod) | set(ver)

    linhas = []
    for addr in universo:
        p = prod.get(addr)
        v = ver.get(addr)
        fontes = []
        if p:
            fontes.append('dog_labels (producao)')
        if addr in citados:
            fontes.append('migracao ' + ', '.join(citados[addr]))
        elif p:
            fontes.append('SEM MIGRACAO')
        if v:
            fontes.append('verified_addresses.json')

        nome = (p or {}).get('entity') or (v or {}).get('name')
        papel = (p or {}).get('role')
        tipo = (p or {}).get('kind') or ('official' if v else None)
        prova = (p or {}).get('evidence') or ('first_party' if v else None)
        interno = bool((p or {}).get('internal'))

        r = res.get(addr)
        i = inst.get(addr)
        meus_lotes = lotes.get(addr, [])

        linhas.append({
            'address': addr,
            'nome': nome,
            'papel': papel,
            'tipo': tipo,
            'prova': prova,
            'internal': interno,
            'fontes': fontes,
            'fila': 'institucional' if i else ('residencial' if r else 'fora do snapshot'),
            'dog': (r or {}).get('dog') if r else ((i or {}).get('dog') if i else None),
            'area_prometida_m2': (r or {}).get('area_m2') if r else None,
            'posicao_residencial': (r or {}).get('posicao_residencial') if r else None,
            'motivos_institucional': (i or {}).get('motivos'),
            'lotes': [{'lot_id': L['lot_id'], 'area_m2': float(L['area_m2']),
                       'setor': L['setor'], 'ordem': L['ordem']} for L in meus_lotes],
            'nota': (p or {}).get('evidence_note') or (v or {}).get('description'),
        })

    linhas.sort(key=lambda x: -(x['dog'] or 0))

    print(f'universo de rotulos: {len(universo)} '
          f'({len(prod)} em dog_labels, {len(ver)} em verified_addresses.json)')
    print(f'fila residencial: {meta_res["total"]} enderecos')
    print(f'fila institucional: {len(inst)} enderecos ({meta_inst["regra"]})')
    print()
    for x in linhas:
        dog = f'{x["dog"]:,.0f}' if x['dog'] else '-'
        area = f'{x["area_prometida_m2"]:,.0f}' if x['area_prometida_m2'] else '-'
        lote = ', '.join(f'{L["lot_id"]}={L["area_m2"]:,.0f}m2(S{L["setor"]})'
                         for L in x['lotes']) or '-'
        print(f'{x["fila"]:>15} | {dog:>17} DOG | promete {area:>9} m2 | '
              f'{x["nome"] or "(sem nome)"}/{x["papel"] or "-"}/{x["tipo"]} '
              f'[{x["prova"]}{" INTERNO" if x["internal"] else ""}] '
              f'{x["address"]}')
        print(f'{"":>15} | lote: {lote}')
        print(f'{"":>15} | fonte: {"; ".join(x["fontes"])}')

    if args.json:
        with open(args.json, 'w', encoding='utf-8') as fh:
            json.dump({'universo': len(universo), 'linhas': linhas}, fh,
                      ensure_ascii=False, indent=1)
        print(f'\ngravado em {args.json}', file=sys.stderr)


if __name__ == '__main__':
    main()
