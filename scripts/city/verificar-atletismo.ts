/** Offline: npx tsx scripts/city/verificar-atletismo.ts --scan */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { ANEIS, N_RAD, passoNoRaio, caixaDoModulo, polyDoModulo, AVENIDAS, anelPonto, type Modulo } from '../../app/city/plaza/teia'
import { ESTADIO_MOD, estadioSitio } from '../../app/city/plaza/estadio'
import { GEODE_MOD, geodeSitio } from '../../app/city/plaza/geode'
import { SPHERE_MOD } from '../../app/city/plaza/sphere'
type Pt = [number, number]
const M = JSON.parse(readFileSync('public/city/cidade-malha.json', 'utf8'))
const C = JSON.parse(readFileSync('public/city/cidade.json', 'utf8'))
import { ATLETISMO_MOD, ATLETISMO_PECA_X, ATLETISMO_PECA_Z, ATLETISMO_FOLGA_Y, assentarAtletismo, atletismoCull, atletismoSitio } from '../../app/city/plaza/atletismo'
const X = ATLETISMO_PECA_X, Z = ATLETISMO_PECA_Z
function site(m: Modulo) { const c=caixaDoModulo(m), a=(c.a0+c.a1)/2; return {x:Math.sin(a)*c.rm,z:-Math.cos(a)*c.rm,a,c} }
function point(m:Modulo,x:number,z:number):Pt {const s=site(m), c=Math.cos(-s.a), sn=Math.sin(-s.a);return [s.x+c*x+sn*z,s.z-sn*x+c*z]}
function rect(m:Modulo):Pt[]{return [[-X/2,-Z/2],[X/2,-Z/2],[X/2,Z/2],[-X/2,Z/2]].map(([x,z])=>point(m,x,z))}
function inside(p:Pt,poly:Pt[]) {let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
function pointSeg(p:Pt,a:Pt,b:Pt){const x=b[0]-a[0],z=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*z)/(x*x+z*z||1)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*z)}
function cross(a:Pt,b:Pt,p:Pt){return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])}
function segDist(a:Pt,b:Pt,c:Pt,d:Pt){if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(pointSeg(a,c,d),pointSeg(b,c,d),pointSeg(c,a,b),pointSeg(d,a,b))}
function polyDist(a:Pt[],b:Pt[]){if(a.some(p=>inside(p,b))||b.some(p=>inside(p,a)))return 0;let d=Infinity;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)d=Math.min(d,segDist(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]));return d}
function segmentDist(poly:Pt[],a:Pt,b:Pt){if(inside(a,poly)||inside(b,poly))return 0;return Math.min(...poly.map((p,i)=>segDist(p,poly[(i+1)%poly.length],a,b)))}
const roads:{id:string;a:Pt;b:Pt;half:number}[]=[]
function radial(id:string,rumo:number,r0:number,r1:number,half:number){const a=rumo*Math.PI/180;roads.push({id,a:[Math.sin(a)*r0,-Math.cos(a)*r0],b:[Math.sin(a)*r1,-Math.cos(a)*r1],half})}
for(const b of M.bulevares)radial(`json:${b.id}`,b.rumo,b.rInicio,b.rFim,b.largura/2+6)
for(const b of AVENIDAS)radial(`ativa:${b.rumo}`,b.rumo,1420,8000,b.largura/2+6)
for(const a of M.autopistas){const r=a.rumo*Math.PI/180,c=Math.cos(r),s=Math.sin(r),o=a.afastamento??0;roads.push({id:a.id,a:[c*o+s*-12000,s*o-c*-12000],b:[c*o+s*12000,s*o-c*12000],half:a.largura/2+6})}
for(const a of M.aneisViarios){for(let i=0;i<12;i++)roads.push({id:a.id,a:anelPonto(a.r,i*Math.PI/6),b:anelPonto(a.r,(i+1)*Math.PI/6),half:a.larg/2+8})}
// ⚠️ O ARENA E A GEODE SAÍRAM DESTA LISTA EM 07/09, e não por descuido: as três
// peças passaram a dividir a MESMA parcela (o campus esportivo, `campus.ts`), e
// os blocos delas agora encostam no do atletismo por construção. Enquanto elas
// estavam aqui, `evaluate` reprovava o sítio novo por "colisão" com os vizinhos
// de campus, que é exatamente o arranjo que o fundador pediu. Quem confere o
// campus inteiro, incluindo a distância entre os três pódios, é
// `scripts/city/verificar-campus.ts`; aqui ficou a peça do atletismo sozinha.
const occupied:{id:string;poly:Pt[]}[]=[{id:'SPHERE',poly:polyDoModulo(SPHERE_MOD)},...C.programa.filter((p:any)=>p.poly?.length).map((p:any)=>({id:`programa:${p.id}`,poly:p.poly}))]
function evaluate(m:Modulo){const s=site(m),p=rect(m),parcel=polyDoModulo(m); if(!p.every(q=>inside(q,parcel)))return null;const occ=occupied.filter(o=>polyDist(parcel,o.poly)<1); if(occ.length)return null;const road=roads.map(r=>({id:r.id,clearance:segmentDist(p,r.a,r.b)-r.half})).sort((a,b)=>a.clearance-b.clearance)[0];if(road.clearance<15)return null;const es=estadioSitio(),gs=geodeSitio();return{m,x:s.x,z:s.z,radial:s.c.r1-s.c.r0,arc:(s.c.a1-s.c.a0)*s.c.rm,road,distEstadio:Math.hypot(s.x-es.x,s.z-es.z),distGeode:Math.hypot(s.x-gs.x,s.z-gs.z)}}
if(process.argv.includes('--scan')){const result=[];for(let i=6;i<18;i++)for(let nr=1;nr<=3;nr++)for(let ns=1;ns<=3;ns++){const step=passoNoRaio((ANEIS[i]+ANEIS[i+nr])/2);for(let j=36;j<66;j+=step){const e=evaluate({i,nr,j,ns});if(e&&e.distGeode<2000&&e.distEstadio<2000)result.push(e)}}result.sort((a,b)=>Math.max(a.distGeode,a.distEstadio)-Math.max(b.distGeode,b.distEstadio));console.log(JSON.stringify(result.slice(0,15),null,2))}
async function terrainCheck(){
  // Canvas é apenas recipiente de material aqui: nenhuma rasterização/browser/GPU.
  Object.assign(globalThis,{document:{createElement:()=>({width:0,height:0,getContext:()=>({putImageData(){}})})},ImageData:class {constructor(public data:Uint8ClampedArray,public width:number,public height:number){}}})
  const {buildTerrain,CANAL_LAMINA,LAGO_R1}=await import('../../app/city/plaza/terrain')
  const {encaixaPrograma}=await import('../../app/city/plaza/programa')
  const meta=JSON.parse(readFileSync('public/lunar/btc-core-heightmap.json','utf8')),b=readFileSync('public/lunar/btc-core-heightmap.f32')
  const terrain=buildTerrain(meta,new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),{radiais:M.canais.radiais.map((r:any)=>({rumo:r.rumo,secao:CANAL_LAMINA,rInicio:Math.min(r.rInicio,LAGO_R1),rFim:r.rFim??4300})),aneis:M.canais.aneis,talude:M.canais.talude,leito:M.lagos.cota-4},{faixaSeca:false})
  const programs=encaixaPrograma(C.programa.map((q:any)=>({id:q.id,nome:q.nome,tipo:q.tipo,x:q.x,z:q.z,area:(q.ha??0)*1e4||4*(q.a??100)*(q.b??100)})),(x,z)=>terrain.superficieAt(x,z)<M.lagos.cota+1.2,{aneis:M.aneisViarios.map((r:any)=>r.r),bulevares:M.bulevares.map((r:any)=>r.rumo)})
  const mod=ATLETISMO_MOD,parcel=polyDoModulo(mod),foot=rect(mod),e=evaluate(mod)
  assert(e,'Pegada fora da grade ou colidindo com infraestrutura/programa')
  assert(!programs.some(o=>polyDist(parcel,o.poly)<1),'Parcela colide com programa reencaixado')
  const drySamples:number[]=[]
  // Sonda de verificação a 2 m: mais densa que a grade de assentamento (8 m).
  for(let i=0;i<=X/2;i++)for(let j=0;j<=Z/2;j++){
    const [x,z]=point(mod,-X/2+2*i,-Z/2+2*j)
    drySamples.push(terrain.superficieAt(x,z))
  }
  const min=Math.min(...drySamples),max=Math.max(...drySamples)
  assert(min>M.lagos.cota+1.2,'Água na pegada')
  const root=assentarAtletismo(new THREE.Group(),terrain.superficieAt)
  assert(root.position.y-max>0.2,'A superfície desenhada atravessa o piso')
  assert(root.position.y-min<5.5,'A saia de 5,5 m não alcança o ponto baixo')
  const nearProgram=programs.map(o=>({id:o.id,clearance:polyDist(foot,o.poly)})).sort((a,b)=>a.clearance-b.clearance)[0]
  const canalClearance=M.canais.radiais.map((r:any)=>{
    const a=r.rumo*Math.PI/180,r0=Math.min(r.rInicio,LAGO_R1),r1=r.rFim??4300
    return {id:r.id,clearance:segmentDist(foot,[Math.sin(a)*r0,-Math.cos(a)*r0],[Math.sin(a)*r1,-Math.cos(a)*r1])-CANAL_LAMINA/2-40}
  })
  assert(canalClearance.every((r:{clearance:number})=>r.clearance>0),'Canal/praia atravessa a peça')
  const parcelRoads=roads.map(r=>({id:r.id,clearance:segmentDist(parcel,r.a,r.b)-r.half})).sort((a,b)=>a.clearance-b.clearance)
  const report={ok:true,module:mod,envelope:{x:X,z:Z},...e,terrain:{source:'btc-core-heightmap.f32 + buildTerrain/cava real; superficieAt',samples:drySamples.length,min,max,range:max-min,settledY:root.position.y,minimumFloorClearance:root.position.y-max,maximumSkirtDepth:root.position.y-min},nearestProgram:nearProgram,canalClearance,nearestParcelRoad:parcelRoads[0],checks:{publishedPrograms:C.programa.length,reallocatedPrograms:programs.length,existingSportsAndSphere:3},limits:['Não valida lotes futuros do snapshot nem modelos GLB dinâmicos ausentes do programa; reservas cívicas de praça/ilhas ficam fora deste raio.','Canvas apenas simulado para alojar material; não mede FPS/GPU ou rasterização.']}
  console.log(JSON.stringify(report,null,2))
  terrain.group.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)m.geometry.dispose()});terrain.material.dispose()
}
if(!process.argv.includes('--scan'))terrainCheck().catch(e=>{console.error(e);process.exitCode=1})

// Contrato de transformação e bordas: um pico assimétrico só no canto correto
// detecta a rotação espelhada e a omissão da última linha/coluna da grade.
const expectedCorner=point(ATLETISMO_MOD,X/2,Z/2)
let cornerVisited=false
const synthetic=assentarAtletismo(new THREE.Group(),(x,z)=>{
  const atCorner=Math.hypot(x-expectedCorner[0],z-expectedCorner[1])<1e-6
  if(atCorner)cornerVisited=true
  return atCorner?37:0
})
assert(cornerVisited,'A sonda esqueceu a borda extrema')
assert.equal(synthetic.position.y,37+ATLETISMO_FOLGA_Y)
synthetic.updateMatrixWorld(true)
const transformed=new THREE.Vector3(X/2,0,Z/2).applyMatrix4(synthetic.matrixWorld)
assert(Math.hypot(transformed.x-expectedCorner[0],transformed.z-expectedCorner[1])<1e-6,'Sonda e Three usam rotações diferentes')
assert.throws(()=>assentarAtletismo(new THREE.Group(),()=>NaN),/cota/)
const st=atletismoSitio()
assert(atletismoCull('mobile')>Math.hypot(st.x,st.z)+1024,'Culling remove estádio visto da praça')
assert(atletismoCull('desktop')>=atletismoCull('mobile'))
