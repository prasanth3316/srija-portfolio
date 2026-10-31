"use strict";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SVGNS = "http://www.w3.org/2000/svg";

/* =========================================================
   0. Loader: an engine cranks, catches, revs and settles to idle
   ========================================================= */
const engineStarted = new Promise((resolve) => {
  const loader = document.getElementById("loader");
  const finish = () => {
    if (!loader || loader.classList.contains("done")) return resolve();
    loader.classList.add("done");
    document.body.classList.add("started");
    setTimeout(() => loader.classList.add("gone"), 850);
    resolve();
  };
  if (!loader || reduceMotion) { if (loader) loader.classList.add("done", "gone"); document.body.classList.add("started"); return resolve(); }

  // tach ticks 0..8 (x1000 rpm), sweep -90deg (left) .. +90deg (right)
  const ticks = document.getElementById("tach-ticks");
  for (let k = 0; k <= 8; k++) {
    const a = (-90 + (k / 8) * 180) * Math.PI / 180;
    const sx = 120 + Math.sin(a) * 78, sy = 140 - Math.cos(a) * 78;
    const ex = 120 + Math.sin(a) * 66, ey = 140 - Math.cos(a) * 66;
    const tx = 120 + Math.sin(a) * 52, ty = 140 - Math.cos(a) * 52 + 4;
    ticks.insertAdjacentHTML("beforeend",
      `<line class="tach-tick" x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}"/>` +
      `<text class="tach-num" x="${tx}" y="${ty}" text-anchor="middle">${k}</text>`);
  }
  const needle = document.getElementById("needle");
  const rpmEl = document.getElementById("rpm");
  const text = document.getElementById("loader-text");
  const engine = document.getElementById("engine");
  const pistonsG = document.getElementById("pistons");
  const puffsG = document.getElementById("puffs");

  const CYL = [48, 96, 144, 192];
  const PHASE = [0, Math.PI, Math.PI, 0];            // firing order 1-3-4-2 pairs
  const pistons = CYL.map((x) => {
    pistonsG.insertAdjacentHTML("beforeend",
      `<g><rect x="${x - 17}" y="52" width="34" height="60" fill="#56616A"/>` +
      `<line class="rod" x1="${x}" y1="70" x2="${x}" y2="125" stroke="#2C353C" stroke-width="6" stroke-linecap="round"/>` +
      `<rect class="pis" x="${x - 15}" y="56" width="30" height="22" rx="3" fill="#D3D7D8"/>` +
      `<circle class="spark" cx="${x}" cy="48" r="7" fill="#F2B705" opacity="0"/></g>`);
    const g = pistonsG.lastElementChild;
    return { x, rod: g.querySelector(".rod"), pis: g.querySelector(".pis"), spark: g.querySelector(".spark") };
  });

  let theta = 0, rpm = 0, fired = false, puffTimer = 0;
  const puffs = [];
  const smooth = (t) => t * t * (3 - 2 * t);
  const t0 = performance.now();
  let last = t0;
  let pageLoaded = document.readyState === "complete";
  window.addEventListener("load", () => { pageLoaded = true; });

  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (t < 0.5) { rpm = 0; text.textContent = "Ignition on"; }
    else if (t < 1.5) { rpm = 220 + Math.sin(t * 40) * 60; text.textContent = "Cranking…"; }
    else if (t < 2.0) {
      if (!fired) { fired = true; engine.classList.add("shake"); }
      rpm = 300 + smooth((t - 1.5) / 0.5) * 3900; text.textContent = "Engine started";
    } else if (t < 2.8) { rpm = 4200 - smooth((t - 2.0) / 0.8) * 3350; }
    else { rpm = 850 + Math.sin(t * 9) * 25; text.textContent = "Idling. Welcome in."; engine.classList.remove("shake"); }

    // needle + readout
    const ang = -90 + Math.min(8000, Math.max(0, rpm)) / 8000 * 180;
    needle.setAttribute("transform", `rotate(${ang.toFixed(2)} 120 140)`);
    rpmEl.textContent = Math.round(rpm / 10) * 10;

    // crankshaft (visually slowed so the pistons stay readable)
    theta += (rpm / 60) * 0.16 * 2 * Math.PI * dt;
    pistons.forEach((p, i) => {
      const c = Math.cos(theta + PHASE[i]);
      const y = 71 - 15 * c;
      p.pis.setAttribute("y", (y - 11).toFixed(1));
      p.rod.setAttribute("y1", y.toFixed(1));
      p.rod.setAttribute("x2", (p.x + Math.sin(theta + PHASE[i]) * 8).toFixed(1));
      p.spark.setAttribute("opacity", fired && c > 0.93 ? "1" : "0");
    });

    // exhaust puffs once it's running
    if (fired) {
      puffTimer -= dt;
      if (puffTimer <= 0) {
        const c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("fill", "#8E979C");
        puffsG.appendChild(c);
        puffs.push({ el: c, x: 250, y: 54, r: 4, life: 1 });
        puffTimer = Math.max(0.06, 0.5 - rpm / 10000);
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.life -= dt * 1.2; p.x += 40 * dt; p.y -= 26 * dt; p.r += 14 * dt;
      if (p.life <= 0) { p.el.remove(); puffs.splice(i, 1); continue; }
      p.el.setAttribute("cx", p.x); p.el.setAttribute("cy", p.y);
      p.el.setAttribute("r", p.r); p.el.setAttribute("opacity", (p.life * 0.6).toFixed(2));
    }

    if (t > 3.4 && pageLoaded) return finish();
    if (!loader.classList.contains("done")) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.getElementById("loader-skip").addEventListener("click", finish);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") finish(); }, { once: true });
});

/* =========================================================
   1. Robot work cell
   ========================================================= */
(function workCell() {
  const svg = document.getElementById("cell");
  if (!svg) return;

  const $ = (id) => document.getElementById(id);
  const upper = $("upper"), fore = $("fore"), wrist = $("wrist");
  const boxesG = $("boxes"), belt = $("belt"), beam = $("beam"), camEye = $("cam-eye");
  const lamps = { red: $("lamp-red"), amber: $("lamp-amber"), green: $("lamp-green") };
  const tags = { status: $("tag-status"), good: $("tag-good"), bad: $("tag-bad"), cycle: $("tag-cycle") };
  const toggle = $("line-toggle");

  // Geometry (SVG units)
  const SHOULDER = { x: 580, y: 240 };
  const L1 = 130, L2 = 125, TOOL = 28;        // wrist -> bottom of suction cup
  const BOX_W = 40, BOX_H = 32, BELT_TOP = 300;
  const PICK_X = 444;                           // box center where the stopper holds it
  const CAM_X = 300;
  const BIN = { x: 509, y: 312 };
  const PALLET = { x: 725, top: 352 };
  const HOME = { x: 610, y: 140 };
  const BELT_SPEED = 70;                        // px/s
  const PALLET_CAP = 4;

  let running = false;
  let visible = true;
  let good = 0, bad = 0, spawnTimer = 1.2, beltOffset = 0, flash = 0;
  let boxes = [];
  let stack = [];
  let robot = { q: ik(HOME.x, HOME.y), moves: [], t: 0, holding: null, cycleStart: 0 };
  let clock = 0;

  // ---- inverse kinematics, picking the elbow-up solution ----
  function ik(x, y) {
    const dx = x - SHOULDER.x, dy = y - SHOULDER.y;
    const d2 = dx * dx + dy * dy;
    let c = (d2 - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    c = Math.max(-1, Math.min(1, c));
    let best = null;
    for (const s of [1, -1]) {
      const q2 = s * Math.acos(c);
      const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
      const elbowY = SHOULDER.y + L1 * Math.sin(q1);
      if (!best || elbowY < best.elbowY) best = { q1, q2, elbowY };
    }
    return [best.q1, best.q2];
  }
  function fk(q) {
    const ex = SHOULDER.x + L1 * Math.cos(q[0]), ey = SHOULDER.y + L1 * Math.sin(q[0]);
    return { x: ex + L2 * Math.cos(q[0] + q[1]), y: ey + L2 * Math.sin(q[0] + q[1]) };
  }
  const deg = (r) => (r * 180) / Math.PI;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function drawRobot() {
    const [q1, q2] = robot.q;
    upper.setAttribute("transform", `translate(${SHOULDER.x},${SHOULDER.y}) rotate(${deg(q1)})`);
    fore.setAttribute("transform", `translate(${L1},0) rotate(${deg(q2)})`);
    // keep the tool pointing straight down
    wrist.setAttribute("transform", `translate(${L2},0) rotate(${90 - deg(q1 + q2)})`);
  }

  // ---- boxes ----
  function makeBox(x) {
    const g = document.createElementNS(SVGNS, "g");
    g.innerHTML =
      `<rect x="${-BOX_W / 2}" y="${-BOX_H / 2}" width="${BOX_W}" height="${BOX_H}" rx="2" fill="#C9A26B" stroke="#8A6A3C" stroke-width="2"/>` +
      `<rect x="-4" y="${-BOX_H / 2}" width="8" height="${BOX_H}" fill="#E0C48F"/>` +
      `<g class="mark" opacity="0"></g>`;
    boxesG.appendChild(g);
    const ok = Math.random() > 0.22;
    if (!ok) {
      // visible defect: a crushed corner
      g.insertAdjacentHTML("beforeend",
        `<path d="M${BOX_W / 2 - 12} ${-BOX_H / 2} L${BOX_W / 2} ${-BOX_H / 2 + 10}" stroke="#8A6A3C" stroke-width="2.5"/>`);
    }
    return { g, x, y: BELT_TOP - BOX_H / 2, ok, inspected: false, state: "belt", mark: g.querySelector(".mark") };
  }
  function placeBox(b) { b.g.setAttribute("transform", `translate(${b.x},${b.y})`); }
  function markBox(b) {
    b.mark.innerHTML = b.ok
      ? `<circle r="9" fill="#2E9E5B"/><path d="M-4 0 l3 3 l5 -6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<circle r="9" fill="#C8312B"/><path d="M-4 -4 l8 8 M4 -4 l-8 8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`;
    b.mark.setAttribute("opacity", "1");
  }

  // ---- robot motion planning ----
  function plan(b) {
    const above = (x, y) => ({ x, y: y - 60 });
    const pick = { x: PICK_X, y: BELT_TOP - BOX_H - TOOL };
    let drop, release;
    if (b.ok) {
      const topY = PALLET.top - BOX_H * (stack.length + 1);
      drop = { x: PALLET.x, y: topY - TOOL };
      release = () => {
        b.state = "placed"; b.x = PALLET.x; b.y = topY + BOX_H / 2; placeBox(b);
        stack.push(b); good++;
        if (stack.length >= PALLET_CAP) swapPallet();
      };
    } else {
      drop = { x: BIN.x, y: BIN.y - 70 };
      release = () => {
        b.state = "binned"; bad++;
        dropIntoBin(b);
      };
    }
    const seq = [
      { to: above(pick.x, pick.y), dur: 0.7 },
      { to: pick, dur: 0.35, end: () => { robot.holding = b; b.state = "held"; } },
      { to: above(pick.x, pick.y), dur: 0.35 },
      { to: b.ok ? above(drop.x, drop.y) : drop, dur: b.ok ? 0.9 : 0.5 },
    ];
    if (b.ok) seq.push({ to: drop, dur: 0.4 });
    seq.push({ to: null, dur: 0.15, end: () => { robot.holding = null; release(); } });
    if (b.ok) seq.push({ to: above(drop.x, drop.y), dur: 0.35 });
    seq.push({ to: HOME, dur: 0.8, end: () => {
      const ct = clock - robot.cycleStart;
      tags.cycle.textContent = ct.toFixed(1) + " s";
    } });
    robot.moves = seq.map((m) => ({ ...m, q: m.to ? ik(m.to.x, m.to.y) : null }));
    robot.from = robot.q.slice();
    robot.t = 0;
    robot.cycleStart = clock;
  }

  function dropIntoBin(b) {
    let vy = 0;
    const step = () => {
      vy += 0.9; b.y += vy;
      if (b.y > BIN.y + 30) { b.g.remove(); return; }
      placeBox(b);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function swapPallet() {
    const old = stack; stack = [];
    setTimeout(() => {
      old.forEach((b) => { b.g.style.transition = "opacity .6s"; b.g.style.opacity = "0"; });
      setTimeout(() => old.forEach((b) => b.g.remove()), 700);
    }, 600);
  }

  // ---- lamps / tags ----
  function setLamps() {
    lamps.green.setAttribute("fill", running ? "#3FD47C" : "#1F4A31");
    lamps.amber.setAttribute("fill", running ? "#5E4F1F" : "#F2B705");
    lamps.red.setAttribute("fill", "#5E2B29");
    tags.status.textContent = running ? "Running" : "Stopped";
    tags.status.dataset.state = running ? "running" : "stopped";
    toggle.textContent = running ? "Stop the line" : "Start the line";
    toggle.setAttribute("aria-pressed", String(running));
  }

  // ---- main loop ----
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (running && visible) update(dt);
    requestAnimationFrame(tick);
  }

  function update(dt) {
    clock += dt;

    // spawn
    spawnTimer -= dt;
    const onBelt = boxes.filter((b) => b.state === "belt");
    const leftmost = onBelt.reduce((m, b) => Math.min(m, b.x), Infinity);
    if (spawnTimer <= 0 && leftmost > 60 && onBelt.length < 5) {
      const b = makeBox(-BOX_W);
      boxes.push(b); placeBox(b);
      spawnTimer = 2.6 + Math.random() * 1.4;
    }

    // belt motion: front of the line first so queues compress correctly
    onBelt.sort((a, b) => b.x - a.x);
    let limit = PICK_X;
    let beltMoving = false;
    for (const b of onBelt) {
      const target = Math.min(limit, b.x + BELT_SPEED * dt);
      if (target > b.x) beltMoving = true;
      b.x = Math.max(b.x, target);
      limit = b.x - BOX_W - 10;
      if (!b.inspected && b.x >= CAM_X) { b.inspected = true; flash = 1; markBox(b); }
      placeBox(b);
    }
    if (beltMoving || onBelt.length === 0) {
      beltOffset -= BELT_SPEED * dt;
      belt.setAttribute("stroke-dashoffset", beltOffset.toFixed(1));
    }

    // camera flash
    if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
    beam.setAttribute("opacity", flash.toFixed(2));
    camEye.setAttribute("fill", flash > 0.2 ? "#7FB2E8" : "#1D252C");

    // robot
    if (robot.moves.length === 0) {
      const ready = onBelt.find((b) => b.x >= PICK_X - 0.5 && b.inspected);
      if (ready) plan(ready);
    } else {
      const m = robot.moves[0];
      robot.t += dt / m.dur;
      const k = ease(Math.min(1, robot.t));
      if (m.q) {
        robot.q = [
          robot.from[0] + wrap(m.q[0] - robot.from[0]) * k,
          robot.from[1] + wrap(m.q[1] - robot.from[1]) * k,
        ];
      }
      if (robot.t >= 1) {
        if (m.end) m.end();
        robot.moves.shift();
        robot.from = robot.q.slice();
        robot.t = 0;
      }
    }
    if (robot.holding) {
      const tip = fk(robot.q);
      robot.holding.x = tip.x;
      robot.holding.y = tip.y + TOOL + BOX_H / 2;
      placeBox(robot.holding);
    }
    boxes = boxes.filter((b) => b.state === "belt" || b.state === "held" || stack.includes(b));
    drawRobot();

    tags.good.textContent = good;
    tags.bad.textContent = bad;
  }

  toggle.addEventListener("click", () => { running = !running; last = performance.now(); setLamps(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }).observe(svg);

  drawRobot();
  setLamps();
  requestAnimationFrame(tick);
  engineStarted.then(() => setTimeout(() => {
    if (reduceMotion) return;
    running = true; last = performance.now(); setLamps();
  }, 700));
})();

/* =========================================================
   2. Ladder rungs energize when scrolled into view
   ========================================================= */
(function ladder() {
  const rungs = document.querySelectorAll(".rung");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    rungs.forEach((r) => r.classList.add("on"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -35% 0px" });
  rungs.forEach((r) => io.observe(r));
})();

/* =========================================================
   3. PID step response
   ========================================================= */
(function pid() {
  const canvas = document.getElementById("pid");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const inputs = { kp: document.getElementById("kp"), ki: document.getElementById("ki"), kd: document.getElementById("kd") };
  const outs = { kp: document.getElementById("o-kp"), ki: document.getElementById("o-ki"), kd: document.getElementById("o-kd") };
  const read = { os: document.getElementById("r-os"), ts: document.getElementById("r-ts"), ess: document.getElementById("r-ess") };

  // Plant: m x'' + c x' + k x = u   (a cart on a spring with damping)
  const M = 1, C = 0.6, K = 1;
  const T = 10, DT = 0.005;

  function simulate(kp, ki, kd) {
    let x = 0, v = 0, integ = 0, prevX = 0;
    const out = [];
    for (let t = 0; t <= T; t += DT) {
      const e = 1 - x;
      integ += e * DT;
      const dx = (x - prevX) / DT;          // derivative on measurement: no setpoint kick
      prevX = x;
      let u = kp * e + ki * integ - kd * dx;
      u = Math.max(-40, Math.min(40, u));   // actuator limit
      const a = (u - C * v - K * x) / M;
      v += a * DT; x += v * DT;
      out.push([t, x]);
    }
    return out;
  }

  function metrics(data) {
    const peak = Math.max(...data.map((p) => p[1]));
    const final = data[data.length - 1][1];
    let ts = null;
    for (let i = data.length - 1; i >= 0; i--) {
      if (Math.abs(data[i][1] - 1) > 0.02) { ts = data[i][0]; break; }
    }
    return {
      os: Math.max(0, (peak - 1) * 100),
      ts: ts === null ? 0 : ts >= T - 0.05 ? null : ts,
      ess: Math.abs(1 - final),
    };
  }

  let progress = reduceMotion ? 1 : 0;
  function draw(data) {
    const W = canvas.width, H = canvas.height;
    const pad = { l: 46, r: 14, t: 16, b: 34 };
    const yMax = 2;
    const X = (t) => pad.l + (t / T) * (W - pad.l - pad.r);
    const Y = (y) => pad.t + (1 - Math.max(-0.2, Math.min(yMax, y)) / yMax) * (H - pad.t - pad.b);

    ctx.clearRect(0, 0, W, H);
    ctx.font = "500 15px Barlow, sans-serif";
    ctx.fillStyle = "#56616A";
    ctx.strokeStyle = "#D6DADB";
    ctx.lineWidth = 1;
    for (let y = 0; y <= yMax; y += 0.5) {
      ctx.beginPath(); ctx.moveTo(pad.l, Y(y)); ctx.lineTo(W - pad.r, Y(y)); ctx.stroke();
      ctx.fillText(y.toFixed(1), 8, Y(y) + 5);
    }
    for (let t = 0; t <= T; t += 2) {
      ctx.fillText(t + " s", X(t) - 8, H - 10);
    }
    // ±2% band
    ctx.fillStyle = "rgba(46,158,91,.12)";
    ctx.fillRect(pad.l, Y(1.02), W - pad.l - pad.r, Y(0.98) - Y(1.02));
    // setpoint
    ctx.setLineDash([7, 6]); ctx.strokeStyle = "#1D252C"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(0), Y(1)); ctx.lineTo(X(T), Y(1)); ctx.stroke();
    ctx.setLineDash([]);
    // response
    ctx.strokeStyle = "#2563A8"; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.beginPath();
    const n = Math.max(1, Math.ceil(data.length * progress));
    data.slice(0, n).forEach(([t, y], i) => (i ? ctx.lineTo(X(t), Y(y)) : ctx.moveTo(X(t), Y(y))));
    ctx.stroke();
    // labels
    ctx.fillStyle = "#1D252C"; ctx.fillText("Setpoint", W - pad.r - 64, Y(1) - 8);
  }

  function render() {
    const kp = +inputs.kp.value, ki = +inputs.ki.value, kd = +inputs.kd.value;
    outs.kp.textContent = kp.toFixed(1);
    outs.ki.textContent = ki.toFixed(2);
    outs.kd.textContent = kd.toFixed(2);
    const data = simulate(kp, ki, kd);
    draw(data);
    const m = metrics(data);
    read.os.textContent = m.os.toFixed(0) + "%";
    read.ts.textContent = m.ts === null ? "Not settled" : m.ts.toFixed(1) + " s";
    read.ess.textContent = m.ess.toFixed(3);
  }

  Object.values(inputs).forEach((el) => el.addEventListener("input", render));
  document.querySelectorAll(".presets button").forEach((b) =>
    b.addEventListener("click", () => {
      const [p, i, d] = b.dataset.p.split(",");
      inputs.kp.value = p; inputs.ki.value = i; inputs.kd.value = d;
      render();
    }));
  // trace the curve the first time the plot scrolls into view
  if (!reduceMotion) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (now) => {
        progress = Math.min(1, (now - start) / 1400);
        render();
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(canvas);
  }
  // redraw once fonts load so canvas text uses Barlow
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(render);
  render();
})();

/* =========================================================
   4. Visitors by country (Cloudflare Pages Function at /api/visit)
   ========================================================= */
(function visitors() {
  const summary = document.getElementById("vis-summary");
  const table = document.getElementById("vis-table");
  const svg = document.getElementById("vis-map");
  const tip = document.getElementById("vis-tip");
  const nEl = document.getElementById("vis-n");
  if (!summary) return;

  const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  const flag = (cc) => /^[A-Z]{2}$/.test(cc)
    ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌐";
  const nameOf = (cc) => { try { return (names && names.of(cc)) || cc; } catch { return cc; } };
  const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  // sequential ramp (validated: one hue, monotone lightness, light end clears the map surface)
  const RAMP = ["#86ACD9", "#5E8FCB", "#3B72B8", "#225A9A", "#163D69"];
  const NONE = "#D3D7D8";

  // Count each browser once; later visits just read the totals.
  const KEY = "sg-visit-counted";
  const firstVisit = !localStorage.getItem(KEY);

  const counts = fetch("/api/visit", { method: firstVisit ? "POST" : "GET", headers: { accept: "application/json" } })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => { if (firstVisit) localStorage.setItem(KEY, "1"); renderTable(data); return data; })
    .catch(() => {
      summary.textContent = "The visitor counter isn’t reachable right now, so the map shows no visits.";
      return { total: 0, countries: {} };
    });

  // load the map only when the station is getting close
  const mapData = new Promise((resolve) => {
    const go = () => fetch("world.json").then((r) => r.json()).then(resolve).catch(() => resolve(null));
    if (!("IntersectionObserver" in window)) return go();
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); go(); } }, { rootMargin: "600px 0px" });
    io.observe(svg);
  });
  Promise.all([mapData, counts]).then(([map, data]) => { if (map) drawMap(map, data); });

  function renderTable({ total = 0, countries = {}, you }) {
    const rows = Object.entries(countries).sort((a, b) => b[1] - a[1]);
    const n = rows.length;
    nEl.textContent = n;
    summary.textContent = total
      ? `${plural(total, "visitor", "visitors")} from ${plural(n, "country", "countries")} so far. Hover or tap a country for its count.`
      : "No visitors counted yet. You could be the first.";
    if (!n) return;
    const max = rows[0][1];
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";
    for (const [cc, count] of rows.slice(0, 12)) {
      const tr = document.createElement("tr");
      if (cc === you) tr.className = "you";
      const td1 = document.createElement("td");
      td1.innerHTML = `<span class="flag" aria-hidden="true">${flag(cc)}</span>`;
      td1.append(nameOf(cc));
      const td2 = document.createElement("td");
      td2.textContent = count.toLocaleString();
      const td3 = document.createElement("td");
      td3.innerHTML = `<div class="bar"><span style="--w:${((count / max) * 100).toFixed(1)}%;--r:${tbody.children.length}"></span></div>`;
      tr.append(td1, td2, td3);
      tbody.append(tr);
    }
    if (n > 12) {
      const rest = rows.slice(12).reduce((a, r) => a + r[1], 0);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${plural(n - 12, "other country", "other countries")}</td><td>${rest.toLocaleString()}</td><td></td>`;
      tbody.append(tr);
    }
    table.hidden = false;
  }

  function drawMap(map, { countries = {}, you }) {
    const max = Math.max(1, ...Object.values(countries));
    // log buckets so one big country doesn't wash out everyone else
    const bucket = (c) => Math.min(RAMP.length - 1, Math.floor((Math.log(c) / Math.log(max + 1)) * RAMP.length));
    const color = (c) => (c ? RAMP[bucket(c)] : NONE);
    const frag = document.createDocumentFragment();
    const shapes = document.createElementNS(SVGNS, "g");
    let order = 0;
    for (const [cc, d] of map.c) {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", d);
      const c = countries[cc] || 0;
      p.setAttribute("class", "ctry" + (c ? " hit" : "") + (cc === you ? " you" : ""));
      p.style.setProperty("--fill", color(c));
      if (c) p.style.setProperty("--i", order++);
      p.dataset.cc = cc;
      if (c) { p.setAttribute("tabindex", "0"); p.setAttribute("aria-label", `${nameOf(cc)}: ${plural(c, "visitor", "visitors")}`); }
      shapes.append(p);
    }
    frag.append(shapes);
    // pins for visited countries too small (or missing) on a small map, plus "you"
    const pins = document.createElementNS(SVGNS, "g");
    for (const [cc, c] of Object.entries(countries)) {
      const pt = map.pt[cc];
      if (!pt || !(pt[2] || cc === you)) continue;
      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute("class", "pin" + (cc === you ? " you" : ""));
      g.setAttribute("transform", `translate(${pt[0]} ${pt[1]})`);
      g.dataset.cc = cc;
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", `${nameOf(cc)}: ${plural(c, "visitor", "visitors")}${cc === you ? " (you)" : ""}`);
      g.innerHTML = (cc === you ? '<circle class="pulse" r="7"/>' : "") +
        `<circle r="${cc === you ? 6 : 5}" style="fill:${cc === you ? "#F2B705" : color(c)}"/>`;
      pins.append(g);
    }
    frag.append(pins);
    svg.append(frag);

    // tooltip: hover, focus, or tap
    const wrap = svg.parentElement;
    function show(cc, x, y) {
      const c = countries[cc] || 0;
      tip.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = `${flag(cc)} ${nameOf(cc)}`;
      tip.append(strong, document.createTextNode(c ? plural(c, "visitor", "visitors") + (cc === you ? ", including you" : "") : "No visits yet"));
      tip.hidden = false;
      const r = wrap.getBoundingClientRect();
      const left = Math.min(Math.max(x - r.left, 70), r.width - 70);
      tip.style.left = left + "px";
      tip.style.top = (y - r.top) + "px";
    }
    const hide = () => { tip.hidden = true; };
    const target = (e) => e.target.closest("[data-cc]");
    svg.addEventListener("pointermove", (e) => { const t = target(e); if (t && t.dataset.cc) show(t.dataset.cc, e.clientX, e.clientY); else hide(); });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("focusin", (e) => {
      const t = target(e); if (!t) return;
      const b = t.getBoundingClientRect();
      show(t.dataset.cc, b.left + b.width / 2, b.top + b.height / 2);
    });
    svg.addEventListener("focusout", hide);
    requestAnimationFrame(() => svg.classList.add("drawn"));
  }
})();

/* =========================================================
   5. Section animations: tag each section "in" when it arrives
   ========================================================= */
(function sections() {
  // stagger values used by the CSS
  document.querySelectorAll(".sheet").forEach((sheet, si) => {
    sheet.style.setProperty("--d", `${(si % 3) * 150}ms`);
    [...sheet.querySelectorAll(".pict > *")].forEach((el, i) => el.style.setProperty("--i", i));
  });

  const sections = document.querySelectorAll(".section");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    sections.forEach((s) => s.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { threshold: 0.15 });
  sections.forEach((s) => io.observe(s));
})();

/* =========================================================
   6. HMI clocks
   ========================================================= */
(function clocks() {
  const els = document.querySelectorAll("[data-clock]");
  const fmt = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tick = () => els.forEach((el) => { el.textContent = fmt.format(new Date()); });
  tick();
  setInterval(tick, 1000);
})();

/* =========================================================
   7. Toolbox: factory floor plan
   ========================================================= */
(function plant() {
  const svg = document.getElementById("plant");
  if (!svg) return;
  const ZONES = {
    scada: {
      title: "Control room",
      text: "I build the screens operators run the plant from: live status, alarms, diagnostics, and production data flowing to MES for traceability.",
      skills: ["Ignition 8.1", "FactoryTalk View", "HMI design", "Alarm management", "MES integration", "Data acquisition", "Python"],
      cert: "Ignition 8.1 Credential, Inductive Automation",
    },
    controls: {
      title: "Electrical room",
      text: "Where the logic lives. I write and troubleshoot PLC programs, set up drives, and keep schematics and backups current.",
      skills: ["Allen-Bradley", "Studio 5000", "RSLogix", "Siemens", "Modicon", "GE", "PID control", "VFDs", "Electrical schematics"],
    },
    engineering: {
      title: "Engineering office",
      text: "Models first, metal later. I simulate control systems, design parts and tooling, and build test tools before anything is installed.",
      skills: ["MATLAB", "Simulink", "Stateflow", "LabVIEW", "Python", "SolidWorks", "AutoCAD", "CATIA"],
    },
    research: {
      title: "Robotics lab",
      text: "At Michigan Tech I researched how people and robots work together, using sensor fusion, AR/VR robot control and motion capture.",
      skills: ["Franka Emika", "UR10e", "ROS", "Sensor fusion", "AR/VR control", "Motion capture", "Raspberry Pi", "YOLOv8"],
      cert: "Industrial Robotics, Michigan Tech",
    },
    iiot: {
      title: "Infeed and IIoT",
      text: "Sensors on every motor and valve. Balluff IO-Link sensors report vibration, temperature, humidity and air pressure so maintenance can act before a breakdown.",
      skills: ["Balluff condition monitoring", "IO-Link", "EtherNet/IP", "CAN", "Sensor integration", "Predictive maintenance"],
    },
    robots: {
      title: "Robot cell",
      text: "I integrate and program FANUC robots, design end-of-arm tooling, and tune paths to bring cycle time down.",
      skills: ["FANUC", "HandlingTool", "ROBOGUIDE", "Universal Robots", "Cobots", "EOAT design", "Path optimization"],
      cert: "FANUC HandlingTool Operation and Programming",
    },
    safety: {
      title: "Safety",
      text: "Safety PLCs, light curtains and area scanners keep people out of harm’s way, and poka-yoke checks stop bad parts from moving on.",
      skills: ["Safety PLCs", "Light curtains", "Area scanners", "Poka-yoke", "Error proofing", "Pneumatics", "Hydraulics"],
    },
    vision: {
      title: "Vision inspection",
      text: "Cameras check every part on the line and reject the ones that don’t pass.",
      skills: ["Cognex", "Keyence", "FANUC iRVision", "Machine vision", "Inspection setup"],
      cert: "FANUC 2D iRVision",
    },
  };
  const zones = [...svg.querySelectorAll(".zone")];
  const navBtns = [...document.querySelectorAll(".zone-nav button")];
  const title = document.getElementById("zp-title");
  const text = document.getElementById("zp-text");
  const skills = document.getElementById("zp-skills");
  const cert = document.getElementById("zp-cert");
  let touring = null;

  function select(key) {
    const z = ZONES[key];
    if (!z) return;
    svg.dataset.active = key;
    zones.forEach((g) => g.classList.toggle("active", g.dataset.zone === key));
    zones.forEach((g) => g.setAttribute("aria-pressed", String(g.dataset.zone === key)));
    navBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zone === key)));
    title.textContent = z.title;
    text.textContent = z.text;
    skills.innerHTML = "";
    z.skills.forEach((sk) => { const li = document.createElement("li"); li.textContent = sk; skills.append(li); });
    cert.hidden = !z.cert;
    cert.textContent = z.cert ? "Certified: " + z.cert : "";
  }
  const choose = (key) => { if (touring) { clearInterval(touring); touring = null; } select(key); };

  zones.forEach((g) => {
    g.addEventListener("click", () => choose(g.dataset.zone));
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(g.dataset.zone); } });
  });
  navBtns.forEach((b) => b.addEventListener("click", () => choose(b.dataset.zone)));
  select("robots");

  // When the plan scrolls into view, sweep across every zone once, then settle on the robot cell.
  if (!reduceMotion && "IntersectionObserver" in window) {
    const order = ["scada", "controls", "engineering", "research", "iiot", "robots", "safety", "vision", "robots"];
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      let i = 0;
      touring = setInterval(() => {
        select(order[i++]);
        if (i >= order.length) { clearInterval(touring); touring = null; }
      }, 520);
    }, { threshold: 0.45 });
    io.observe(svg);
  }
})();

/* =========================================================
   8. Contact station: permissives arm the Send pushbutton
   ========================================================= */
(function station() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const name = document.getElementById("f-name");
  const email = document.getElementById("f-email");
  const msg = document.getElementById("f-msg");
  const banner = document.getElementById("banner");
  const bannerText = document.getElementById("banner-text");
  const send = document.getElementById("pb-send");
  const pilot = document.getElementById("pilot");
  const knob = document.getElementById("knob");
  const radios = [...form.querySelectorAll('input[name="topic"]')];
  const contacts = [...document.querySelectorAll(".mr-contact")];
  const coil = document.querySelector(".mr-coil");
  const wires = [...document.querySelectorAll(".mr-wire")];
  const perms = [...document.querySelectorAll(".permissives li")];
  const TO = "srijagummadi12@gmail.com";
  const LABEL = { name: "Name_OK", email: "Email_OK", msg: "Msg_OK" };
  const HINT = { name: "enter your name", email: "enter a valid email address", msg: "write a message of at least 10 characters" };

  const state = () => ({
    name: name.value.trim().length >= 2,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()),
    msg: msg.value.trim().length >= 10,
  });

  function setBanner(kind, message) { banner.dataset.state = kind; bannerText.textContent = message; }

  function scan() {
    const st = state();
    const order = ["name", "email", "msg"];
    // power flows left to right: each wire is live only if everything before it is closed
    let live = true;
    wires[0].classList.add("on");
    order.forEach((k, i) => {
      contacts[i].classList.toggle("on", st[k]);
      live = live && st[k];
      wires[i + 1].classList.toggle("on", live);
    });
    coil.classList.toggle("on", live);
    wires[4].classList.toggle("on", live);
    perms.forEach((li) => li.classList.toggle("on", st[li.dataset.for]));
    name.classList.toggle("ok", st.name);
    email.classList.toggle("ok", st.email);
    msg.classList.toggle("ok", st.msg);
    send.classList.toggle("armed", live);
    send.setAttribute("aria-disabled", String(!live));
    pilot.classList.toggle("on", live);
    if (banner.dataset.state === "sent" && !live) return live;
    if (live) setBanner("ready", "All permissives on. Press Send.");
    else {
      const missing = order.filter((k) => !st[k]).map((k) => k === "msg" ? "message" : k);
      setBanner("wait", `Waiting for operator input: ${missing.join(", ")}.`);
    }
    return live;
  }

  function setKnob() {
    const i = radios.findIndex((r) => r.checked);
    knob.style.setProperty("--knob", `${-45 + i * 45}deg`);
  }
  knob.addEventListener("click", () => {
    const i = radios.findIndex((r) => r.checked);
    radios[(i + 1) % radios.length].checked = true;
    setKnob();
  });
  radios.forEach((r) => r.addEventListener("change", setKnob));

  [name, email, msg].forEach((el) => el.addEventListener("input", scan));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const st = state();
    if (!scan()) {
      const first = ["name", "email", "msg"].find((k) => !st[k]);
      setBanner("blocked", `Send blocked: ${LABEL[first]} is off. Please ${HINT[first]}.`);
      ({ name, email, msg })[first].focus();
      return;
    }
    const topic = radios.find((r) => r.checked).value;
    const subject = `${topic} from ${name.value.trim()}`;
    const body = `${msg.value.trim()}\n\n${name.value.trim()}\n${email.value.trim()}`;
    window.location.href = `mailto:${TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setBanner("sent", "Message opened in your email app. Press send there to deliver it.");
  });

  form.addEventListener("reset", () => {
    setTimeout(() => { setKnob(); banner.dataset.state = "wait"; scan(); }, 0);
  });

  setKnob();
  scan();
})();

/* =========================================================
   9. The page as a production line: transfers between stations,
      status lights, and the current station in the top menu
   ========================================================= */
(function line() {
  const stations = [...document.querySelectorAll(".section")];
  const hero = document.querySelector(".hero");
  if (!stations.length) return;
  [hero, ...stations].slice(0, -1).forEach((el) => {
    if (!el) return;
    const t = document.createElement("div");
    t.className = "transfer";
    t.setAttribute("aria-hidden", "true");
    t.innerHTML = '<span class="tote"></span>';
    el.after(t);
  });
  const links = new Map([...document.querySelectorAll(".topbar nav a")].map((a) => [a.getAttribute("href").slice(1), a]));
  let current = -2;

  function update() {
    const mid = window.innerHeight * 0.45;
    let idx = -1;
    stations.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) idx = i; });
    if (idx === current) return;
    current = idx;
    stations.forEach((s, i) => {
      const status = i < idx ? "done" : i === idx ? "active" : "wait";
      if (status === "active" && s.dataset.status !== "active") {
        const t = s.previousElementSibling;
        if (t && t.classList.contains("transfer") && !reduceMotion) t.classList.add("go");
      }
      s.dataset.status = status;
    });
    links.forEach((a, id) => {
      const on = idx >= 0 && stations[idx].id === id;
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  let queued = false;
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
