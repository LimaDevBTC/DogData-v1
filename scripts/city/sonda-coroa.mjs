import { readFileSync } from 'node:fs'
const ENT='/home/bitmax/Projects/bitcoin-fullstack/marketing/mapas'
const meta=JSON.parse(readFileSync(`${ENT}/topo.json`,'utf8'))
const N=meta.n,RAIO=meta.raio,CEL=meta.celulaM
const buf=readFileSync(`${ENT}/topo.f32`)
const H=new Float32Array(N*N); for(let i=0;i<N*N;i++)H[i]=buf.readFloatLE(i*4)
const idx=(i,j)=>H[j*N+i]
const alturaEm=(x,z)=>{const u=((x+RAIO)/(2*RAIO))*(N-1),v=((z+RAIO)/(2*RAIO))*(N-1)
 const i=Math.max(0,Math.min(N-2,Math.floor(u))),j=Math.max(0,Math.min(N-2,Math.floor(v)))
 const fu=u-i,fv=v-j
 return idx(i,j)*(1-fu)*(1-fv)+idx(i+1,j)*fu*(1-fv)+idx(i,j+1)*(1-fu)*fv+idx(i+1,j+1)*fu*fv}
const declEm=(x,z)=>{const d=CEL
 return Math.atan(Math.hypot((alturaEm(x+d,z)-alturaEm(x-d,z))/(2*d),(alturaEm(x,z+d)-alturaEm(x,z-d))/(2*d)))*180/Math.PI}
const COTA=-40, AN7=6950, DOMO=9050
// amostragem polar de 10 m x 0,25 grau
const dr=10, dg=0.25
const conta = (r0,r1,filtro) => {
  let agua=0, lote=0, rua=0, ingreme=0, tot=0
  for(let g=0; g<360; g+=dg){
    if (filtro && !filtro(g)) continue
    const a=g*Math.PI/180, sx=Math.sin(a), sz=-Math.cos(a)
    for(let r=r0; r<r1; r+=dr){
      const cel = r*dr*(dg*Math.PI/180)   // area do setor elementar, m2
      tot+=cel
      const x=sx*r, z=sz*r
      if (alturaEm(x,z)<=COTA) { agua+=cel; continue }
      const d=declEm(x,z)
      if (d<=5) lote+=cel; else if (d<=12) rua+=cel; else ingreme+=cel
    }
  }
  return {tot,agua,lote,rua,ingreme}
}
const km=(v)=>(v/1e6).toFixed(2)
const mostra=(nome,o)=>console.log(
  `${nome.padEnd(34)} total ${km(o.tot).padStart(7)}  agua ${km(o.agua).padStart(6)}  ate5 ${km(o.lote).padStart(6)}  5a12 ${km(o.rua).padStart(6)}  >12 ${km(o.ingreme).padStart(6)}  (km2)`)

mostra('SOB A CUPULA inteira (0 a 9050)', conta(0,DOMO))
mostra('  dentro da AN7 (0 a 6950)', conta(0,AN7))
mostra('  COROA EXTERNA (6950 a 9050)', conta(AN7,DOMO))
const cabos=(g)=>(g>=115&&g<=134)||(g>=330&&g<=348)
const alca=(g)=>(g>=346||g<=116.5)
mostra('    coroa: os dois cabos', conta(AN7,DOMO,cabos))
mostra('    coroa: arco da alca', conta(AN7,DOMO,(g)=>alca(g)&&!cabos(g)))
mostra('    coroa: o resto (135 a 330)', conta(AN7,DOMO,(g)=>!alca(g)&&!cabos(g)))
