#!/usr/bin/env python3
"""Custo do portao pad330 no top 500: mede as 500 primeiras posicoes e conta quem
o portao rebaixaria. Uso: python3 scripts/regua/pad330_top500.py
"""
import json, sys, collections, importlib.util
spec=importlib.util.spec_from_file_location('p','scripts/regua/pad330.py'); P=importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
OUT='/tmp/claude-1000/-home-bitmax-Projects-bitcoin-fullstack/df22a3c1-6af6-4f08-9816-452773b035e4/scratchpad/pad330_top500.json'
res={}
for p in range(1,501):
    a=P.POS[p]
    res[a]={'pos':p,'tipo':P.tipo(a),'todos':P.medir(a,8,0),'y2026':P.medir(a,14,P.DESDE),
            'dog':P.H[a]['dog'],'utxo':len(P.PE.get(a,[]))}
    if p%50==0: print('  ...%d'%p,file=sys.stderr)
json.dump(res,open(OUT,'w'))
print('salvo',OUT,len(res))
