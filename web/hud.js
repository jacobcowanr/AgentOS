/* AgentOS 3D scene — voice orb (home), crew constellation (team), skill galaxy (factory). Exposes window.HUD. */
"use strict";
(function(){
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x04030a);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04030a, 0.018);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
const root = new THREE.Group(); scene.add(root);

const PURPLE = 0x8b6cef, LAV = 0xa88bfa, BLUE = 0x5b7cfa, ICE = 0x9fb4ff, GOLD = 0xf5c66b, RED = 0xff6b8b;
function glowTex(){
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.25,"rgba(255,255,255,.45)"); gr.addColorStop(1,"rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0,0,128,128); return new THREE.CanvasTexture(c);
}
const GLOW = glowTex();
const THEME = {home:new THREE.Color(PURPLE), team:new THREE.Color(PURPLE), factory:new THREE.Color(BLUE), ambient:new THREE.Color(0x6a58c8)};
const cur = new THREE.Color(PURPLE);
const tinted = [];
const tint = m => (tinted.push(m), m);
const add = {transparent:true, blending:THREE.AdditiveBlending, depthWrite:false};
function sprite(color, scale, op=1){
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color, ...add, opacity:op}));
  s.scale.set(scale,scale,1); return s;
}

// nebula starfield (purple + blue)
{
  const n = 1800, p = new Float32Array(n*3), col = new Float32Array(n*3);
  const a = new THREE.Color(LAV), b = new THREE.Color(BLUE), w = new THREE.Color(0xffffff);
  for(let i=0;i<n;i++){
    const r = 40+Math.random()*100, th = Math.random()*6.283, ph = Math.acos(2*Math.random()-1);
    p[i*3]=r*Math.sin(ph)*Math.cos(th); p[i*3+1]=r*Math.cos(ph)*0.6; p[i*3+2]=r*Math.sin(ph)*Math.sin(th);
    const c = Math.random()<.15 ? w : a.clone().lerp(b, Math.random()); col.set([c.r,c.g,c.b], i*3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p,3)); g.setAttribute("color", new THREE.BufferAttribute(col,3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({size:.24, vertexColors:true, ...add, opacity:.6})));
}
const grid = new THREE.GridHelper(140, 70, PURPLE, BLUE);
grid.position.y = -4.4; grid.material.transparent = true; grid.material.opacity = .09; grid.material.depthWrite = false;
scene.add(grid);

/* ---------- HUB / voice orb ---------- */
const hub = new THREE.Group(); root.add(hub);
const hubRings = [];
[[1.7,.03,1],[2.35,.022,-.7],[3.1,.018,.45]].forEach(([r,t,sp],i)=>{
  const m = new THREE.Mesh(new THREE.TorusGeometry(r,t,8,180), tint(new THREE.MeshBasicMaterial({color:PURPLE, ...add, opacity:.85-i*.2})));
  m.rotation.x = Math.PI/2 + i*.35; m.rotation.y = i*.5; m.userData.sp = sp; hub.add(m); hubRings.push(m);
});
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.95,1), tint(new THREE.MeshBasicMaterial({color:PURPLE, wireframe:true, ...add, opacity:.9})));
hub.add(core);
const coreIn = new THREE.Mesh(new THREE.IcosahedronGeometry(.55,2), new THREE.MeshBasicMaterial({color:LAV, ...add, opacity:.6}));
hub.add(coreIn);
const coreGlow = sprite(PURPLE, 7.5, .8); tint(coreGlow.material); hub.add(coreGlow);
const halo = sprite(BLUE, 16, .18); hub.add(halo);
{
  const g = new THREE.BufferGeometry(), pts = [];
  for(let i=0;i<96;i++){ const a=i/96*6.283, r0=3.5, r1=i%8===0?3.9:3.66; pts.push(Math.cos(a)*r0,0,Math.sin(a)*r0, Math.cos(a)*r1,0,Math.sin(a)*r1); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
  const ticks = new THREE.LineSegments(g, tint(new THREE.LineBasicMaterial({color:PURPLE, ...add, opacity:.5}))); ticks.userData.sp=.12; hub.add(ticks); hubRings.push(ticks);
}
// voice shell — points on a sphere that ripple with the voice level
const SHELL_N = 1400, shellBase = new Float32Array(SHELL_N*3), shellPos = new Float32Array(SHELL_N*3);
for(let i=0;i<SHELL_N;i++){
  const y = 1 - (i/(SHELL_N-1))*2, r = Math.sqrt(1-y*y), th = i*2.39996;
  shellBase.set([Math.cos(th)*r, y, Math.sin(th)*r], i*3);
}
const shellGeo = new THREE.BufferGeometry(); shellGeo.setAttribute("position", new THREE.BufferAttribute(shellPos,3));
const shellMat = new THREE.PointsMaterial({color:LAV, size:.055, ...add, opacity:.85});
const shell = new THREE.Points(shellGeo, shellMat); hub.add(shell);
// equalizer ring (bars around the orb, home only)
const EQ_N = 72, eq = new THREE.Group(); hub.add(eq);
const eqBars = [];
for(let i=0;i<EQ_N;i++){
  const a = i/EQ_N*6.283;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(.06,1), new THREE.MeshBasicMaterial({color:ICE, ...add, opacity:.7, side:THREE.DoubleSide}));
  m.position.set(Math.cos(a)*4.4, 0, Math.sin(a)*4.4); m.rotation.y = -a + Math.PI/2; m.scale.y = .05;
  eq.add(m); eqBars.push(m);
}

/* ---------- TEAM: crew nodes ---------- */
const team = new THREE.Group(); root.add(team);
const nodes = {}, hits = [];
const R = 7.6, rad = d => d*Math.PI/180;
const ringPos = (deg,y)=>[Math.cos(rad(deg))*R, y, Math.sin(rad(deg))*R*.85];
const POS = { orchestrator:[0,3.9,0], research:ringPos(172,.4), writer:ringPos(122,.8), developer:ringPos(58,.8), auditor:ringPos(8,.4), librarian:ringPos(238,.1) };
function buildTeam(crew){
  crew.forEach((b,idx)=>{
    if(nodes[b.name]) return;
    const p = POS[b.name] || ringPos(290 + idx*20, .3), g = new THREE.Group(); g.position.set(...p);
    const big = b.name==="orchestrator";
    const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(big?.8:.58,1), new THREE.MeshBasicMaterial({color:PURPLE, wireframe:true, ...add, opacity:.95}));
    const inner = new THREE.Mesh(new THREE.OctahedronGeometry(big?.42:.3), new THREE.MeshBasicMaterial({color:LAV, ...add, opacity:.6}));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(big?1.15:.9,.018,6,64), new THREE.MeshBasicMaterial({color:PURPLE, ...add, opacity:.7}));
    ring.rotation.x = Math.PI/2;
    const glow = sprite(PURPLE, big?4.4:3.2, .55);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.3,8,8), new THREE.MeshBasicMaterial({visible:false}));
    hit.userData = {kind:"bot", name:b.name};
    g.add(ico, inner, ring, glow, hit); team.add(g); hits.push(hit);
    const from = big ? [0,0,0] : POS.orchestrator;
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...p)]);
    const lm = new THREE.LineBasicMaterial({color:PURPLE, ...add, opacity:b.name==="librarian"?.12:.3});
    team.add(new THREE.Line(lg, lm));
    const pkt = sprite(GOLD, 1.1, 0); team.add(pkt);
    nodes[b.name] = {g, ico, inner, ring, glow, lm, pkt, from:new THREE.Vector3(...from), to:new THREE.Vector3(...p), state:"idle", phase:Math.random()};
    const lab = document.createElement("div"); lab.className="lab"; lab.innerHTML = esc(b.name.toUpperCase())+"<small></small>";
    $("labels").appendChild(lab); nodes[b.name].lab = lab;
  });
}
{
  const r = new THREE.Mesh(new THREE.RingGeometry(7.4,7.5,128), tint(new THREE.MeshBasicMaterial({color:PURPLE, ...add, opacity:.3, side:THREE.DoubleSide})));
  r.rotation.x = -Math.PI/2; r.position.y = -3.2; team.add(r);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(3.9,3.95,96), tint(new THREE.MeshBasicMaterial({color:PURPLE, ...add, opacity:.25, side:THREE.DoubleSide})));
  r2.rotation.x = -Math.PI/2; r2.position.y = -3.2; team.add(r2);
}

/* ---------- FACTORY: skills galaxy ---------- */
const factory = new THREE.Group(); root.add(factory);
const gear = new THREE.Mesh(new THREE.TorusGeometry(4.3,.35,6,18), new THREE.MeshBasicMaterial({color:BLUE, wireframe:true, ...add, opacity:.45}));
gear.rotation.x = Math.PI/2; factory.add(gear);
const sweep = new THREE.Mesh(new THREE.CircleGeometry(15,48,0,.7), new THREE.MeshBasicMaterial({color:BLUE, ...add, opacity:.1, side:THREE.DoubleSide}));
sweep.rotation.x = -Math.PI/2; factory.add(sweep);
{ const r = new THREE.Mesh(new THREE.RingGeometry(14.9,15,128), new THREE.MeshBasicMaterial({color:PURPLE, ...add, opacity:.4, side:THREE.DoubleSide})); r.rotation.x=-Math.PI/2; factory.add(r); }
const skillMeshes = []; let skillSig = "";
const ORIGIN_COL = {agent:LAV, bundled:BLUE, hub:0x7dd3fc};
const ORIGIN_Y = {agent:1.2, bundled:0, hub:-1.2};
function buildSkills(list){
  const sig = list.map(s=>s.name+s.dormant).join("|"); if(sig===skillSig) return; skillSig = sig;
  skillMeshes.splice(0).forEach(m=>{ factory.remove(m); m.geometry.dispose(); m.material.dispose(); m.children.forEach(c=>c.material.dispose()); });
  hits.splice(0, hits.length, ...hits.filter(h=>h.userData.kind==="bot"));
  const byO = {agent:[], bundled:[], hub:[], external:[]};
  list.forEach(s=>(byO[s.origin]||byO.agent).push(s));
  Object.entries(byO).forEach(([o,arr])=>{
    arr.sort((a,b)=>b.act-a.act);
    arr.forEach((s,i)=>{
      const ang = i*2.39996 + (o==="hub"?1:o==="bundled"?2:0), r = 5 + Math.sqrt(i+1)*1.1 + (o==="bundled"?.7:0);
      const size = .09 + Math.log(s.act+1)*.042;
      const col = s.dormant ? 0x3d3766 : (ORIGIN_COL[o]||LAV);
      const m = new THREE.Mesh(new THREE.SphereGeometry(size,12,12), new THREE.MeshBasicMaterial({color:col, ...add, opacity:s.dormant?.55:1}));
      m.position.set(Math.cos(ang)*r, (ORIGIN_Y[o]||0)+Math.sin(i*1.7)*.35, Math.sin(ang)*r);
      if(!s.dormant && s.act>20){ m.add(sprite(col, size*14, .5)); }
      m.userData = {kind:"skill", s}; factory.add(m); skillMeshes.push(m); hits.push(m);
    });
  });
}

/* ---------- views ---------- */
const CAM = {
  home:{pos:new THREE.Vector3(0,1.1,12.5), look:new THREE.Vector3(0,-1.25,0)},
  team:{pos:new THREE.Vector3(1.5,8.4,17.5), look:new THREE.Vector3(1.5,.4,0)},
  factory:{pos:new THREE.Vector3(1.5,17,28), look:new THREE.Vector3(1.5,-.5,0)},
  ambient:{pos:new THREE.Vector3(-6,5,24), look:new THREE.Vector3(-4,1,0)},
};
let view = "home";
const camPos = CAM.home.pos.clone(), camLook = CAM.home.look.clone();
const grp = {team:{g:team, t:0}, factory:{g:factory, t:0}};
team.scale.setScalar(.0001); factory.scale.setScalar(.0001); team.visible = factory.visible = false;

/* ---------- voice-driven state ---------- */
let mode = "idle", level = 0, lvlTarget = 0, selBot = null;
const MODE_COL = {idle:new THREE.Color(PURPLE), listen:new THREE.Color(BLUE), think:new THREE.Color(0xb38cff), speak:new THREE.Color(LAV)};

/* ---------- interaction ---------- */
const mouse = new THREE.Vector2(-9,-9), ray = new THREE.Raycaster(), par = {x:0,y:0};
let hover = null, S = null;
addEventListener("mousemove", e=>{
  mouse.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight*2-1)); par.x = mouse.x; par.y = mouse.y;
  if(hover){ const tip = $("tip"); tip.style.left = Math.min(e.clientX+16, innerWidth-290)+"px"; tip.style.top = (e.clientY+16)+"px"; }
});
addEventListener("click", e=>{
  if(hover && hover.userData.kind==="bot" && view==="team" && e.target === canvas){
    selBot = hover.userData.name; HUD.onSelectBot && HUD.onSelectBot(selBot);
  }
});
function pick(){
  if(view!=="team" && view!=="factory"){ if(hover){ hover=null; $("tip").style.display="none"; document.body.style.cursor=""; } return; }
  ray.setFromCamera(mouse, camera);
  const live = hits.filter(h=> (h.userData.kind==="bot") === (view==="team"));
  const hit = ray.intersectObjects(live, false)[0];
  const h = hit ? hit.object : null;
  if(h !== hover){
    hover = h; const tip = $("tip");
    if(!h){ tip.style.display="none"; document.body.style.cursor=""; return; }
    document.body.style.cursor = "pointer";
    const u = h.userData;
    if(u.kind==="skill") tip.innerHTML = `<b>${esc(u.s.name)}</b><br>${esc(u.s.origin.toUpperCase())} · use ${u.s.use} · patches ${u.s.patch}<br>last active: ${esc(u.s.last)}${u.s.dormant?" · <span style='color:#ff9a6a'>DORMANT</span>":""}`;
    else { const b = S && S.crew.find(x=>x.name===u.name); tip.innerHTML = `<b>${esc(u.name.toUpperCase())}</b><br>${esc(b?b.role:"")}`; }
    tip.style.display="block";
  }
}

/* ---------- animate ---------- */
const clock = new THREE.Clock(), tmp = new THREE.Vector3(), tmpC = new THREE.Color();
function resize(){
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth/innerHeight;
  const side = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--side")) || 0;
  camera.setViewOffset(innerWidth, innerHeight, -side/2, 0, innerWidth, innerHeight);  // centre the scene in the area right of the sidebar
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();
let hidden = false; document.addEventListener("visibilitychange", ()=>{ hidden = document.hidden; });
function frame(){
  requestAnimationFrame(frame);
  if(hidden) return;
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime, k = reduced ? 0 : 1;
  // level smoothing (speak mode synthesises a level if no real one is fed)
  if(mode==="speak" && lvlTarget < .05) lvlTarget = .25 + .25*Math.abs(Math.sin(t*9)*Math.sin(t*3.3));
  level += (lvlTarget - level) * Math.min(1, dt*14); lvlTarget *= Math.pow(.02, dt);
  // theme colour: home follows the voice mode
  const target = view==="home" ? MODE_COL[mode] : THEME[view] || THEME.ambient;
  cur.lerp(target, Math.min(1, dt*3)); tinted.forEach(m=>m.color.copy(cur));
  shellMat.color.copy(cur).lerp(tmpC.set(0xffffff), .25 + level*.4);
  for(const [name, o] of Object.entries(grp)){
    const tgt = name===view ? 1 : 0; o.t += (tgt-o.t)*Math.min(1, dt*3.2);
    o.g.scale.setScalar(Math.max(.0001, o.t)); o.g.visible = o.t > .02;
  }
  // hub: big + reactive on home, compact elsewhere
  const hs = view==="home" ? 1.05 + level*.35 : view==="ambient" ? .9 : .78;
  hub.scale.lerp(tmp.set(hs,hs,hs), Math.min(1, dt*6));
  const spin = mode==="think" ? 3.2 : mode==="listen" ? 1.6 : 1;
  hubRings.forEach(r=>{ r.rotation.z += dt*r.userData.sp*k*spin; r.rotation.y += dt*(r.type==="LineSegments"?.12:.2*r.userData.sp)*k; });
  core.rotation.y += dt*.5*k*spin; core.rotation.x += dt*.3*k;
  coreIn.scale.setScalar(1+Math.sin(t*2)*.08*k + level*.6);
  coreGlow.material.opacity = .6+Math.sin(t*1.6)*.1*k + level*.4;
  halo.material.opacity = (view==="home" ? .16 : .08) + level*.25;
  // shell ripple
  const amp = view==="home" ? (.08 + level*.55) : .04, baseR = view==="home" ? 2.05 : 1.6;
  for(let i=0;i<SHELL_N;i++){
    const x = shellBase[i*3], y = shellBase[i*3+1], z = shellBase[i*3+2];
    const n = Math.sin(x*4+t*2.1)*Math.cos(y*5-t*1.7)*Math.sin(z*3+t*1.3);
    const r = baseR * (1 + n*amp*k + (mode==="think" ? Math.sin(t*6+y*8)*.04 : 0));
    shellPos[i*3]=x*r; shellPos[i*3+1]=y*r; shellPos[i*3+2]=z*r;
  }
  shellGeo.attributes.position.needsUpdate = true;
  shell.rotation.y += dt*.15*k*spin; shellMat.opacity = view==="home" ? .85 : .35;
  // equalizer
  eq.visible = view==="home";
  if(eq.visible){
    eq.rotation.y += dt*.05*k;
    for(let i=0;i<EQ_N;i++){
      const v = Math.abs(Math.sin(i*.9 + t*7)*Math.sin(i*.37 - t*3.1));
      const h = .04 + level*(.15 + v*.75) + (mode==="think" ? (Math.sin(t*5 + i*.4)+1)*.06 : 0);
      eqBars[i].scale.y += (h - eqBars[i].scale.y)*Math.min(1, dt*12);
      eqBars[i].material.color.copy(cur).lerp(tmpC.set(ICE), .5);
      eqBars[i].material.opacity = .18 + level*.4;
    }
  }
  gear.rotation.z += dt*.15*k; sweep.rotation.z -= dt*.9*k;
  root.rotation.y += dt*(view==="home" ? .02 : .03)*k;
  for(const [name, n] of Object.entries(nodes)){
    n.ico.rotation.y += dt*.6*k; n.ico.rotation.x += dt*.25*k; n.inner.rotation.y -= dt*1.1*k; n.ring.rotation.z += dt*.7*k;
    const run = n.state==="run", blk = n.state==="blk";
    const col = run ? GOLD : blk ? RED : null;
    n.g.scale.setScalar(run ? 1+Math.sin(t*5+n.phase)*.15 : 1+Math.sin(t*1.5+n.phase)*.04);
    n.g.position.y = n.to.y + Math.sin(t*.9+n.phase*6)*.18*k;
    [n.ico.material, n.inner.material, n.ring.material, n.glow.material, n.lm].forEach(m=> col ? m.color.setHex(col) : m.color.copy(cur));
    n.glow.material.opacity = run ? .9 : blk ? .8 : .5;
    if(run){ n.pkt.material.opacity = 1; n.pkt.position.lerpVectors(n.from, n.to, (t*.55 + n.phase)%1); } else n.pkt.material.opacity = 0;
    tmp.setFromMatrixPosition(n.g.matrixWorld); tmp.y -= 1.25; tmp.project(camera);
    n.lab.style.opacity = (view==="team" && tmp.z<1 && grp.team.t>.6) ? 1 : 0;
    n.lab.style.left = ((tmp.x+1)/2*innerWidth)+"px"; n.lab.style.top = ((1-tmp.y)/2*innerHeight)+"px";
    n.lab.classList.toggle("run", run);
    n.ring.scale.setScalar(name===selBot ? 1.25+Math.sin(t*4)*.06 : 1);
  }
  const c = CAM[view] || CAM.ambient;
  camPos.lerp(c.pos, Math.min(1, dt*2.2)); camLook.lerp(c.look, Math.min(1, dt*2.2));
  const pm = view==="home" ? .6 : 1.8;
  camera.position.set(camPos.x + par.x*pm, camPos.y + par.y*-pm*.55, camPos.z);
  camera.lookAt(camLook);
  pick();
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

window.HUD = {
  setView(v){ view = CAM[v] ? v : "ambient"; $("tip").style.display = "none"; hover = null; document.body.style.cursor = ""; },
  setMode(m){ mode = m; },
  setLevel(l){ lvlTarget = Math.max(lvlTarget, Math.min(1, l)); },
  select(name){ selBot = name; },
  apply(state){
    S = state; buildTeam(state.crew||[]); buildSkills(state.skills||[]);
    (state.crew||[]).forEach(b=>{
      const n = nodes[b.name]; if(!n) return;
      n.state = (b.counts.running||0) ? "run" : ((b.counts.blocked||0) ? "blk" : "idle");
      n.lab.querySelector("small").textContent = b.current ? b.current.slice(0,28) : (n.state==="idle" ? "STANDBY" : n.state.toUpperCase());
    });
  },
  onSelectBot:null,
};
})();
