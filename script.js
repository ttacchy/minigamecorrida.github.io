(function () {
  var box = document.getElementById('w'), cv = document.getElementById('c');
  var elSc = document.getElementById('sc'), elCn = document.getElementById('cn'), elKmh = document.getElementById('kmh'), elBest = document.getElementById('best');
  var ov = document.getElementById('ov'), ovT = document.getElementById('ovT'), ovP = document.getElementById('ovP'), go = document.getElementById('go');
  var best = 0;
  try { best = parseInt(localStorage.getItem('corrida3d-best'), 10) || 0; } catch (e) {}
  elBest.textContent = best;

  if (!window.THREE) { ovP.textContent = 'Não foi possível carregar o motor 3D. Verifique sua conexão.'; go.style.display = 'none'; return; }

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); }
  catch (e) { ovP.textContent = 'Seu navegador não suporta gráficos 3D (WebGL).'; go.style.display = 'none'; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  var SKY = 0x87ceeb;
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 50, 170);
  var camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x557755, 0.95));
  var sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(6, 12, 6); scene.add(sun);

  function resize() {
    var w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---------- cenário ----------
  var grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 500), new THREE.MeshLambertMaterial({ color: 0x4caf50 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, -150); scene.add(grass);
  var road = new THREE.Mesh(new THREE.PlaneGeometry(12, 500), new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -150); scene.add(road);
  var lineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-5.8, 5.8].forEach(function (x) {
    var l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 500), lineM); l.position.set(x, 0.01, -150); scene.add(l);
  });

  var dashes = [], DL = 192;
  for (var i = 0; i < 24; i++) {
    [-2, 2].forEach(function (x) {
      var d = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 3), lineM);
      d.position.set(x, 0.01, 24 - i * 8); scene.add(d); dashes.push(d);
    });
  }

  var trees = [], TL = 196;
  var trunkG = new THREE.CylinderGeometry(0.3, 0.4, 2, 6), leafG = new THREE.ConeGeometry(1.6, 4, 7);
  var trunkM = new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), leafM = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  for (var k = 0; k < 14; k++) {
    [-1, 1].forEach(function (side) {
      var g = new THREE.Group();
      var tr = new THREE.Mesh(trunkG, trunkM); tr.position.y = 1; g.add(tr);
      var lf = new THREE.Mesh(leafG, leafM); lf.position.y = 4; g.add(lf);
      g.position.set(side * (9 + Math.random() * 6), 0, 26 - k * 14 - Math.random() * 6);
      scene.add(g); trees.push(g);
    });
  }

  // ---------- carros ----------
  var bodyG = new THREE.BoxGeometry(2, 0.7, 4), cabG = new THREE.BoxGeometry(1.6, 0.6, 2), wheelG = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12), lightG = new THREE.BoxGeometry(0.45, 0.2, 0.1);
  var wheelM = new THREE.MeshLambertMaterial({ color: 0x111111 }), glassM = new THREE.MeshLambertMaterial({ color: 0x1f2f44 });
  var tailM = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), headM = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
  function makeCar(color) {
    var g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: color });
    var b = new THREE.Mesh(bodyG, m); b.position.y = 0.65; g.add(b);
    var c = new THREE.Mesh(cabG, glassM); c.position.set(0, 1.25, 0.2); g.add(c);
    [[-1.05, 1.3], [1.05, 1.3], [-1.05, -1.3], [1.05, -1.3]].forEach(function (w) {
      var wm = new THREE.Mesh(wheelG, wheelM); wm.rotation.z = Math.PI / 2; wm.position.set(w[0], 0.45, w[1]); g.add(wm);
    });
    [-0.6, 0.6].forEach(function (x) {
      var t = new THREE.Mesh(lightG, tailM); t.position.set(x, 0.75, 2.02); g.add(t);
      var h = new THREE.Mesh(lightG, headM); h.position.set(x, 0.75, -2.02); g.add(h);
    });
    return g;
  }
  var player = makeCar(0xe63946); scene.add(player);
  var COLORS = [0x2a9d8f, 0xf4a261, 0x457b9d, 0x9b5de5, 0xf1c453, 0x6c757d];

  var coinG = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 16), coinM = new THREE.MeshLambertMaterial({ color: 0xffc400, emissive: 0x553300 });

  // ---------- estado ----------
  var state = 'idle', enemies = [], coins = [], keys = { l: false, r: false };
  var px = 0, pvx = 0, speed = 12, t = 0, dist = 0, coinCount = 0, eGap = 0, cGap = 0, shake = 0, last = performance.now();
  var LANES = [-4, 0, 4];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clear() {
    enemies.forEach(function (e) { scene.remove(e.m); }); enemies = [];
    coins.forEach(function (c) { scene.remove(c.m); }); coins = [];
  }
  function start() {
    clear(); px = 0; pvx = 0; t = 0; dist = 0; coinCount = 0; speed = 24; eGap = 40; cGap = 40; shake = 0;
    state = 'running'; ov.classList.add('hide'); last = performance.now();
  }
  function crash() {
    state = 'over'; shake = 0.8;
    var s = score();
    if (s > best) { best = s; elBest.textContent = best; try { localStorage.setItem('corrida3d-best', best); } catch (e) {} }
    ovT.textContent = 'Bateu!';
    ovP.textContent = 'Você fez ' + s + ' pontos e pegou ' + coinCount + ' moedas. Recorde: ' + best + '.';
    go.textContent = 'Jogar de novo';
    setTimeout(function () { ov.classList.remove('hide'); go.focus(); }, 500);
  }
  function score() { return Math.floor(dist / 8) + coinCount * 10; }

  function spawnEnemy() {
    var lanes = LANES.slice().sort(function () { return Math.random() - 0.5; });
    var n = Math.random() < 0.35 ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var m = makeCar(COLORS[Math.floor(Math.random() * COLORS.length)]);
      m.position.set(lanes[i] + rand(-0.4, 0.4), 0, -160);
      scene.add(m); enemies.push({ m: m, sp: rand(6, 14) });
    }
    eGap = rand(24, 38) + speed * 0.25;
  }
  function spawnCoins() {
    var x = LANES[Math.floor(Math.random() * 3)];
    for (var i = 0; i < 5; i++) {
      var g = new THREE.Group(), c = new THREE.Mesh(coinG, coinM); c.rotation.x = Math.PI / 2; c.position.y = 1.1; g.add(c);
      g.position.set(x, 0, -160 - i * 4); scene.add(g); coins.push({ m: g });
    }
    cGap = rand(60, 110);
  }

  function update(dt) {
    var v = state === 'running' ? speed : 12;
    if (state === 'running') {
      t += dt; speed = Math.min(60, 24 + t * 0.7); v = speed; dist += v * dt;
      var input = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
      pvx += (input * 16 - pvx) * Math.min(1, dt * 8);
      px = Math.max(-5, Math.min(5, px + pvx * dt));
      eGap -= v * dt; if (eGap <= 0) spawnEnemy();
      cGap -= v * dt; if (cGap <= 0) spawnCoins();
    } else { pvx *= 0.9; }

    player.position.x = px; player.rotation.y = -pvx * 0.025; player.rotation.z = -pvx * 0.01;
    if (state === 'over') player.rotation.y += dt * 6;

    dashes.forEach(function (d) { d.position.z += v * dt; if (d.position.z > 24) d.position.z -= DL; });
    trees.forEach(function (g) { g.position.z += v * dt; if (g.position.z > 26) { g.position.z -= TL; } });

    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      e.m.position.z += (v - e.sp) * dt * (state === 'running' ? 1 : 0) + (state === 'running' ? 0 : v * dt * 0.3);
      if (state === 'running' && Math.abs(e.m.position.x - px) < 1.8 && Math.abs(e.m.position.z) < 3.8) crash();
      if (e.m.position.z > 15) { scene.remove(e.m); enemies.splice(i, 1); }
    }
    for (var j = coins.length - 1; j >= 0; j--) {
      var c = coins[j];
      c.m.position.z += v * dt; c.m.rotation.y += dt * 4;
      if (state === 'running' && Math.abs(c.m.position.x - px) < 1.5 && Math.abs(c.m.position.z) < 2) {
        coinCount++; scene.remove(c.m); coins.splice(j, 1); continue;
      }
      if (c.m.position.z > 15) { scene.remove(c.m); coins.splice(j, 1); }
    }

    shake = Math.max(0, shake - dt * 1.6);
    camera.fov = 62 + (v - 20) * 0.25; camera.updateProjectionMatrix();
    camera.position.set(px * 0.6 + (Math.random() - 0.5) * shake, 5 + (Math.random() - 0.5) * shake, 9);
    camera.lookAt(px * 0.3, 1, -12);

    elSc.textContent = score(); elCn.textContent = coinCount; elKmh.textContent = Math.round(v * 3.2);
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---------- entradas ----------
  go.addEventListener('click', start);
  document.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') { keys.l = true; e.preventDefault(); }
    else if (k === 'd' || k === 'arrowright') { keys.r = true; e.preventDefault(); }
    else if ((k === ' ' || k === 'enter') && state !== 'running') { e.preventDefault(); start(); }
  });
  document.addEventListener('keyup', function (e) {
    var k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') keys.l = false;
    else if (k === 'd' || k === 'arrowright') keys.r = false;
  });
  function hold(id, key) {
    var b = document.getElementById(id);
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); keys[key] = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { keys[key] = false; }); });
  }
  hold('bl', 'l'); hold('br', 'r');

  resize();
  requestAnimationFrame(frame);
})();
