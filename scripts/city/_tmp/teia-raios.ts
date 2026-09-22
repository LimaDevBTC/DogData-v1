import { ANEIS, raioDodeca, anelRaio } from '../../../app/city/plaza/teia'
const faixa = ANEIS.filter(r => r > 3900 && r < 6400)
console.log('anéis da teia entre 3900 e 6400 (VÉRTICE):', faixa.map(r=>r.toFixed(0)).join(' '))
console.log('os mesmos na FACE (rumo 51,3°):', faixa.map(r=>raioDodeca(r, 51.3*Math.PI/180).toFixed(0)).join(' '))
console.log('total de anéis', ANEIS.length, 'de', ANEIS[0], 'a', ANEIS[ANEIS.length-1])
