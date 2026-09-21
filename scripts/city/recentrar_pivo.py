#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════════════
# O PIVÔ DA ÁRVORE É O TRONCO, NÃO A CAIXA
#
# ⚠️ POR QUE ISTO EXISTE. O fundador viu uma palmeira plantada NO ASFALTO no
# canteiro central da Orla Nobre. Medido: `palm.glb` tem o tronco 1,25 m fora
# da origem do modelo, contra 0,07 m do `palm-tall` e 0,26 m do `palm-date`.
#
# A causa é o conversor (`blender/convert_sketchfab_assets.py:69` e
# `convert_one_asset.py:174`): ele centra pela CAIXA INTEIRA, tronco mais copa.
# Quando a copa é assimétrica, e copa de palmeira quase sempre é, o centro da
# caixa foge do eixo do tronco e a árvore nasce torta em relação ao ponto onde
# o plantio a colocou. O plantio está certo; o modelo é que mente sobre onde
# ele começa.
#
# Aqui o pivô é recentrado pela FATIA DE BAIXO do modelo, que é o tronco no
# chão, e a correção entra como `translation` no nó raiz: nenhum vértice é
# tocado, então Draco, textura e animação continuam valendo.
#
#   python3 scripts/city/recentrar_pivo.py public/city/sf/palm.glb [--fatia=0.10] [--aplicar]
# ═══════════════════════════════════════════════════════════════════════════
import json, struct, sys, os

arg = lambda k, d: next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith(f'--{k}=')), d)
APLICAR = '--aplicar' in sys.argv
FATIA = float(arg('fatia', '0.10'))
alvos = [a for a in sys.argv[1:] if not a.startswith('--')]

def ler_glb(caminho):
    b = open(caminho, 'rb').read()
    assert b[:4] == b'glTF', 'nao e glb'
    total = struct.unpack_from('<I', b, 8)[0]
    off, js, bins = 12, None, []
    while off < total:
        tam, tipo = struct.unpack_from('<II', b, off)
        dados = b[off + 8: off + 8 + tam]
        if tipo == 0x4E4F534A: js = json.loads(dados.decode('utf-8'))
        else: bins.append((tipo, dados))
        off += 8 + tam + ((4 - tam % 4) % 4 if tam % 4 else 0)
    return js, bins

def escrever_glb(caminho, js, bins):
    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    partes = [struct.pack('<II', len(jb), 0x4E4F534A) + jb]
    for tipo, dados in bins:
        pad = b'\x00' * ((4 - len(dados) % 4) % 4)
        partes.append(struct.pack('<II', len(dados) + len(pad), tipo) + dados + pad)
    corpo = b''.join(partes)
    open(caminho, 'wb').write(struct.pack('<4sII', b'glTF', 2, 12 + len(corpo)) + corpo)

for caminho in alvos:
    js, bins = ler_glb(caminho)
    # a caixa de cada primitiva vem do accessor de POSITION, que o glTF obriga
    # a carregar min e max mesmo com Draco
    caixas = []
    for m in js.get('meshes', []):
        for pr in m.get('primitives', []):
            ac = js['accessors'][pr['attributes']['POSITION']]
            if 'min' in ac and 'max' in ac: caixas.append((ac['min'], ac['max']))
    if not caixas:
        print(f'{caminho}: sem caixa declarada, pulado'); continue
    y_min = min(c[0][1] for c in caixas)
    y_max = max(c[1][1] for c in caixas)
    corte = y_min + (y_max - y_min) * FATIA
    # ⚠️ A FATIA DE BAIXO É O TRONCO. Uma primitiva entra na conta se ela NASCE
    # abaixo do corte; copa que começa lá em cima não vota no pivô.
    base = [c for c in caixas if c[0][1] <= corte]
    if not base: base = caixas
    cx = sum((c[0][0] + c[1][0]) / 2 for c in base) / len(base)
    cz = sum((c[0][2] + c[1][2]) / 2 for c in base) / len(base)
    # ⚠️ A CONFERÊNCIA TEM DE SOMAR A TRANSLAÇÃO DO NÓ, senão ela mede sempre o
    # arquivo de antes: a correção não toca vértice nenhum, ela mora no nó.
    _raiz = js['scenes'][js.get('scene', 0)]['nodes'][0]
    _t0 = js['nodes'][_raiz].get('translation', [0, 0, 0])
    cx += _t0[0]; cz += _t0[2]
    d = (cx * cx + cz * cz) ** 0.5
    print(f'{os.path.basename(caminho)}: tronco em ({cx:+.3f}, {cz:+.3f}), '
          f'deslocamento {d:.3f} m, altura {y_min:.2f} a {y_max:.2f}')
    if not APLICAR or d < 0.02: continue
    raiz = js['scenes'][js.get('scene', 0)]['nodes'][0]
    n = js['nodes'][raiz]
    if 'matrix' in n:
        print('  nó raiz usa matrix, não translation: pulado para não brigar com a matriz')
        continue
    t = n.get('translation', [0, 0, 0])
    n['translation'] = [t[0] - cx, t[1], t[2] - cz]
    escrever_glb(caminho, js, bins)
    print(f'  corrigido: translation do nó raiz agora é {n["translation"]}')
