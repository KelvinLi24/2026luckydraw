(() => {
  // =========================
  // LocalStorage
  // =========================
  const LS_KEY = "gift_lottery_2026_full";
  const loadState = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const saveState = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  };
  const clearAllStorage = () => {
    try { localStorage.clear(); } catch {}
  };

  // =========================
  // Helpers
  // =========================
  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls) => {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    return x;
  };
  const uniq = (arr) => Array.from(new Set(arr));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove("show"), 2200);
  };

  // =========================
  // Countdown
  // =========================
  const target = new Date("2026-01-01T00:00:00+08:00");
  const tickCountdown = () => {
    const now = new Date();
    let ms = target - now;
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const dd = Math.floor(s / 86400);
    const hh = Math.floor((s % 86400) / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    $("#countdown").textContent = (dd > 0 ? `${dd}d ` : "") + `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  };
  setInterval(tickCountdown, 250);
  tickCountdown();

  // =========================
  // State
  // =========================
  const defaultState = {
    step: 1, // 1,2,3,4(final)
    participantsAll: [],
    participantPool: [],
    giftPool: [],
    orderMode: "random",
    randomTimes: 0,
    manualOrder: [],
    drawOrder: [],
    drawIndex: 0,
    assignment: {},
    done: [], // {picker, giftOwner, time}
    viewMode: "wheel", // wheel|flash
    round: {
      status: "idle", // idle | spinning | decel | result
      currentPicker: null,
      currentGift: null,
      viewLocked: false
    }
  };

  let state = loadState() || structuredClone(defaultState);

  // =========================
  // Step Visibility
  // =========================
  function showStep(n) {
    state.step = n;
    $("#step1Card").classList.toggle("hidden", n !== 1);
    $("#step2Card").classList.toggle("hidden", n !== 2);
    $("#step3Card").classList.toggle("hidden", n !== 3);
    $("#finalCard").classList.toggle("hidden", n !== 4);
    saveState();
  }

  // =========================
  // Participant delete (with confirm)
  // =========================
  function deleteParticipant(name) {
    const ok = confirm(`確定要刪除「${name}」？\n（會同時重置順序與抽獎進度）`);
    if (!ok) return;

    state.participantsAll = state.participantsAll.filter(n => n !== name);
    hardResetAfterParticipantChange();
    saveState();

    renderPools();
    renderOrderStatus();
    renderManualPools();
    renderDoneList();

    toast(`已刪除：${name}`);
  }

  // =========================
  // Pools Rendering
  // =========================
  function renderPools() {
    const participantWrap = $("#participantPool");
    const giftWrap = $("#giftPool");
    participantWrap.innerHTML = "";
    giftWrap.innerHTML = "";

    state.participantPool.forEach((n) => {
      const t = el("div", "tag withAction");
      const nameSpan = el("span");
      nameSpan.textContent = n;

      const btn = el("button", "iconBtn");
      btn.type = "button";
      btn.title = "刪除";
      btn.setAttribute("aria-label", `刪除 ${n}`);
      btn.textContent = "🗑";
      btn.addEventListener("click", () => deleteParticipant(n));

      t.appendChild(nameSpan);
      t.appendChild(btn);
      participantWrap.appendChild(t);
    });

    state.giftPool.forEach((n) => {
      const t = el("div", "tag");
      t.textContent = n;
      giftWrap.appendChild(t);
    });

    $("#pCount").textContent = state.participantPool.length;
    $("#gCount").textContent = state.giftPool.length;
    $("#pLeft").textContent = state.participantPool.length;
    $("#gLeft").textContent = state.giftPool.length;
    $("#countAll").textContent = state.participantsAll.length;

    // stage3 live gift list
    $("#giftLeftLabel").textContent = state.giftPool.length;
    $("#giftLiveCount").textContent = state.giftPool.length;
    const live = $("#giftLiveList");
    live.innerHTML = "";
    state.giftPool.forEach((n) => {
      const t = el("div", "tag small");
      t.textContent = n;
      live.appendChild(t);
    });

    // step3 order live
    renderOrderLive();

    // step1 gating
    $("#btnFinishInput").disabled = state.participantsAll.length < 2;
    $("#step1Hint").textContent =
      state.participantsAll.length < 2
        ? "提示：至少 2 個人先可以進入下一步。"
        : "✅ 你可以按「完成輸入所有人」進入下一步。";
  }

  // =========================
  // Step3: order live list (remaining)
  // =========================
  function renderOrderLive(){
    const wrap = $("#orderLiveList");
    if(!wrap) return;

    const remaining = state.drawOrder.slice(state.drawIndex);
    $("#orderLiveCount").textContent = remaining.length;

    wrap.innerHTML = "";
    remaining.forEach((name, i) => {
      const item = el("div", "orderLiveItem");

      const left = el("div", "left");
      const num = el("div", "badgeNum");
      num.textContent = String(i + 1);

      const nm = el("div", "nm");
      nm.textContent = name;

      left.appendChild(num);
      left.appendChild(nm);
      item.appendChild(left);

      // highlight current picker
      if (i === 0) {
        item.style.borderColor = "rgba(255,211,106,.35)";
        item.style.background = "rgba(255,211,106,.10)";
      }

      wrap.appendChild(item);
    });
  }

  // =========================
  // Order preview list (Step2) ✅ fix double numbering
  // =========================
  function renderOrderPreview() {
    const ol = $("#orderPreviewList");
    const hint = $("#orderPreviewHint");
    if (!ol) return;
    ol.innerHTML = "";
    if (!state.drawOrder.length) {
      if (hint) hint.textContent = "尚未生成／確認順序。";
      return;
    }
    if (hint) hint.textContent = "";

    // ✅ only show name, numbering by <ol>
    state.drawOrder.forEach((name) => {
      const li = document.createElement("li");
      li.textContent = name;
      ol.appendChild(li);
    });
  }

  // =========================
  // Step2 Rendering / modes
  // =========================
  function renderOrderStatus() {
    const c = state.drawOrder.length;
    $("#orderCount").textContent = c;
    $("#orderStatus").textContent = c ? `${c} 人` : "未設定";

    const ok = c === state.participantsAll.length && c >= 2;
    $("#btnStartStage3").disabled = !ok;
    $("#step2Hint").textContent = ok ? "✅ 可以開始抽獎環節" : "請先設定抽獎順序";

    renderOrderPreview();
  }

  function setOrderMode(mode) {
    state.orderMode = mode;
    $("#modeRandom").classList.toggle("active", mode === "random");
    $("#modeManual").classList.toggle("active", mode === "manual");
    $("#manualArea").classList.toggle("show", mode === "manual");
    $("#btnRandomize").disabled = mode !== "random";
    saveState();
    renderManualPools();
  }

  function renderManualPools() {
    const pick = $("#manualPickPool");
    const order = $("#manualOrderList");
    if (!pick || !order) return;

    pick.innerHTML = "";
    order.innerHTML = "";

    const inOrder = state.manualOrder.slice();
    const pickables = state.participantsAll.filter((n) => !inOrder.includes(n));

    pickables.forEach((n) => {
      const t = el("div", "tag pickable");
      t.textContent = n;
      t.addEventListener("click", () => {
        state.manualOrder.push(n);
        saveState();
        renderManualPools();
        toast(`已加入順序池：${n}`);
      });
      pick.appendChild(t);
    });

    inOrder.forEach((n, idx) => {
      const item = el("div", "orderItem");
      item.draggable = true;

      const left = el("div");
      const nm = el("div", "name"); nm.textContent = n;
      const hint = el("div", "hint"); hint.textContent = "拖曳調整順序";
      left.appendChild(nm);
      left.appendChild(hint);

      const rm = el("button", "btn danger");
      rm.textContent = "移除";
      rm.style.padding = "8px 10px";
      rm.style.borderRadius = "12px";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        state.manualOrder.splice(idx, 1);
        saveState();
        renderManualPools();
      });

      item.appendChild(left);
      item.appendChild(rm);

      item.addEventListener("dragstart", () => item.classList.add("dragging"));
      item.addEventListener("dragend", () => item.classList.remove("dragging"));

      order.appendChild(item);
    });

    $("#manualPickCount").textContent = pickables.length;
    $("#manualOrderCount").textContent = state.manualOrder.length;

    $("#btnConfirmManual").disabled = !(
      state.manualOrder.length === state.participantsAll.length &&
      state.participantsAll.length >= 2
    );
  }

  // Drag reorder manual list
  const manualOrderList = $("#manualOrderList");
  if (manualOrderList) {
    manualOrderList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = manualOrderList.querySelector(".dragging");
      if (!dragging) return;

      const after = getDragAfterElement(manualOrderList, e.clientY);
      if (after == null) manualOrderList.appendChild(dragging);
      else manualOrderList.insertBefore(dragging, after);
    });

    manualOrderList.addEventListener("drop", () => {
      const items = Array.from(manualOrderList.querySelectorAll(".orderItem"));
      state.manualOrder = items.map((it) => it.querySelector(".name").textContent);
      saveState();
      renderManualPools();
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll(".orderItem:not(.dragging)")];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    for (const child of draggableElements) {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset, element: child };
      }
    }
    return closest.element;
  }

  // =========================
  // Derangement assignment (no self-pick)
  // =========================
  function buildDerangement(names) {
    const N = names.length;
    let tries = 0;
    while (tries < 3000) {
      tries++;
      const perm = shuffle(names);
      let ok = true;
      for (let i = 0; i < N; i++) {
        if (perm[i] === names[i]) { ok = false; break; }
      }
      if (ok) {
        const mapping = {};
        for (let i = 0; i < N; i++) mapping[names[i]] = perm[i];
        return mapping;
      }
    }
    // fallback shuffle
    const a = names.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    const mapping = {};
    for (let i = 0; i < N; i++) mapping[names[i]] = a[i];
    return mapping;
  }

  // =========================
  // Stage3: Wheel / Flash
  // =========================
  const wheelCanvas = $("#wheel");
  const wctx = wheelCanvas.getContext("2d");

  let wheelAngle = 0;
  let wheelRaf = null;
  let wheelStopPlan = null;

  let flashTimer = null;
  let flashIndex = 0;
  let flashStopPlan = null;

  function segmentColor(i, n) {
    const hue = 38 + (i * 360 / n) * 0.08 + (i % 3) * 4;
    const sat = 92 - (i % 4) * 3;
    const light = 55 + (i % 2 ? 8 : 0);
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  function resizeCanvasToDisplaySize(canvas) {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const newW = Math.floor(cssW * dpr);
    const newH = Math.floor(cssH * dpr);
    if (canvas.width !== newW || canvas.height !== newH) {
      canvas.width = newW;
      canvas.height = newH;
    }
    return { w: newW, h: newH };
  }

  function drawWheel() {
    const { w, h } = resizeCanvasToDisplaySize(wheelCanvas);
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.44;

    wctx.clearRect(0, 0, w, h);
    wctx.save();
    wctx.translate(cx, cy);

    wctx.beginPath();
    wctx.arc(0, 0, R * 1.08, 0, Math.PI * 2);
    wctx.fillStyle = "rgba(255, 211, 106, .10)";
    wctx.fill();

    const names = state.giftPool.length ? state.giftPool : ["—"];
    const n = names.length;
    const seg = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const a0 = wheelAngle + i * seg;
      const a1 = a0 + seg;

      wctx.beginPath();
      wctx.moveTo(0, 0);
      wctx.arc(0, 0, R, a0, a1);
      wctx.closePath();

      wctx.fillStyle = segmentColor(i, n);
      wctx.fill();

      wctx.strokeStyle = "rgba(0,0,0,.25)";
      wctx.lineWidth = Math.max(1, R * 0.012);
      wctx.stroke();

      const mid = (a0 + a1) / 2;
      wctx.save();
      wctx.rotate(mid);
      wctx.translate(R * 0.70, 0);
      wctx.rotate(Math.PI / 2);
      wctx.fillStyle = "rgba(18, 12, 0, .95)";
      wctx.font = `1000 ${Math.max(12, R * 0.085)}px ui-sans-serif, system-ui`;
      wctx.textAlign = "center";
      wctx.textBaseline = "middle";
      const label = names[i];
      const maxLen = 12;
      const text = label.length > maxLen ? label.slice(0, maxLen) + "…" : label;
      wctx.fillText(text, 0, 0);
      wctx.restore();
    }

    wctx.beginPath();
    wctx.arc(0, 0, R * 0.18, 0, Math.PI * 2);
    wctx.fillStyle = "rgba(9, 8, 12, .88)";
    wctx.fill();
    wctx.strokeStyle = "rgba(255, 241, 181, .22)";
    wctx.lineWidth = Math.max(1, R * 0.01);
    wctx.stroke();

    wctx.fillStyle = "rgba(255, 241, 181, .95)";
    wctx.font = `1100 ${Math.max(12, R * 0.10)}px ui-sans-serif, system-ui`;
    wctx.textAlign = "center";
    wctx.textBaseline = "middle";
    wctx.fillText("GIFT", 0, -R * 0.02);

    wctx.fillStyle = "rgba(188, 183, 218, .90)";
    wctx.font = `900 ${Math.max(10, R * 0.06)}px ui-sans-serif, system-ui`;
    wctx.fillText(`${n} items`, 0, R * 0.10);

    wctx.restore();
  }

  function stopAllSpins() {
    if (wheelRaf) cancelAnimationFrame(wheelRaf);
    wheelRaf = null;
    wheelStopPlan = null;

    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = null;
    flashStopPlan = null;
  }

  // =========================
  // Fireworks overlay + Final control (30s + toggle)
  // =========================
  const fw = {
    canvas: $("#fireworksOverlay"),
    ctx: $("#fireworksOverlay").getContext("2d"),
    raf: null,
    particles: [],
    until: 0,
    infinite: false
  };

  const FINAL_FW_SECONDS = 30;
  let fwAutoStopTimer = null;
  let fwIsRunning = false;

  function setFireworksButtonLabel() {
    const btn = $("#btnToggleFireworks");
    if (!btn) return;
    btn.textContent = fwIsRunning ? "停止煙花" : "開始煙花";
    btn.classList.toggle("warn", fwIsRunning);
    btn.classList.toggle("good", !fwIsRunning);
  }

  function resizeFW() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    fw.canvas.width = Math.floor(window.innerWidth * dpr);
    fw.canvas.height = Math.floor(window.innerHeight * dpr);
  }

  function spawnBurst() {
    const w = fw.canvas.width;
    const h = fw.canvas.height;
    const cx = (0.12 + Math.random() * 0.76) * w;
    const cy = (0.10 + Math.random() * 0.42) * h;
    const count = 70 + Math.floor(Math.random() * 70);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 4.2;
      fw.particles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * sp * (0.8 + Math.random() * 0.8),
        vy: Math.sin(ang) * sp * (0.8 + Math.random() * 0.8),
        life: 85 + Math.floor(Math.random() * 55),
        age: 0,
        size: 1.2 + Math.random() * 3.0
      });
    }
  }

  function startFireworks(seconds) {
    resizeFW();
    fw.canvas.classList.add("show");

    if (fwAutoStopTimer) {
      clearTimeout(fwAutoStopTimer);
      fwAutoStopTimer = null;
    }

    fwIsRunning = true;
    setFireworksButtonLabel();

    fw.particles = [];
    fw.infinite = (seconds === Infinity);
    fw.until = fw.infinite ? 0 : (performance.now() + seconds * 1000);

    for (let i = 0; i < 8; i++) spawnBurst();

    if (fw.raf) cancelAnimationFrame(fw.raf);
    fw.raf = requestAnimationFrame(fwLoop);
  }

  function stopFireworks() {
    if (fwAutoStopTimer) {
      clearTimeout(fwAutoStopTimer);
      fwAutoStopTimer = null;
    }

    fwIsRunning = false;
    setFireworksButtonLabel();

    if (fw.raf) cancelAnimationFrame(fw.raf);
    fw.raf = null;
    fw.particles = [];
    fw.ctx.clearRect(0, 0, fw.canvas.width, fw.canvas.height);
    fw.canvas.classList.remove("show");
    fw.infinite = false;
  }

  function fwLoop() {
    const now = performance.now();
    const w = fw.canvas.width;
    const h = fw.canvas.height;
    const ctx = fw.ctx;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(0, 0, w, h);

    fw.particles.forEach((p) => {
      p.age++;
      p.vy += 0.035;
      p.x += p.vx;
      p.y += p.vy;

      const t = 1 - p.age / p.life;
      if (t <= 0) return;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + 0.9 * t), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, ${210 + Math.floor(30 * t)}, ${120 + Math.floor(90 * t)}, ${0.15 + 0.75 * t})`;
      ctx.fill();
    });

    fw.particles = fw.particles.filter((p) => p.age < p.life);

    if (Math.random() < 0.22) spawnBurst();

    if (!fw.infinite && now >= fw.until && fw.particles.length === 0) {
      stopFireworks();
      return;
    }

    fw.raf = requestAnimationFrame(fwLoop);
  }

  window.addEventListener("resize", () => {
    drawWheel();
    if (fw.canvas.classList.contains("show")) resizeFW();
  });

  // =========================
  // Round UI / flow
  // =========================
  function setDrawModeLabel() {
    const s = state.round.status;
    if (s === "idle") $("#drawModeLabel").textContent = "未開始";
    if (s === "spinning") $("#drawModeLabel").textContent = state.viewMode === "wheel" ? "轉盤中" : "閃名中";
    if (s === "decel") $("#drawModeLabel").textContent = "減速停定中";
    if (s === "result") $("#drawModeLabel").textContent = "已抽中";
  }

  function setSpinButtonText() {
    const btn = $("#btnSpin");
    const s = state.round.status;

    if (s === "idle") {
      btn.textContent = "開始";
      btn.disabled = false;
      btn.classList.remove("danger");
      btn.classList.add("warn");
    } else if (s === "spinning") {
      btn.textContent = "停止";
      btn.disabled = false;
      btn.classList.remove("warn");
      btn.classList.add("danger");
    } else if (s === "decel") {
      btn.textContent = "停止";
      btn.disabled = true;
      btn.classList.remove("warn");
      btn.classList.add("danger");
    } else if (s === "result") {
      btn.textContent = "開始";
      btn.disabled = true;
      btn.classList.remove("danger");
      btn.classList.add("warn");
    }
  }

  function updateProgressUI() {
    $("#progress").textContent = `${Math.min(state.drawIndex, state.drawOrder.length)}/${state.drawOrder.length}`;
    $("#giftLeftLabel").textContent = state.giftPool.length;

    const next = state.drawOrder[state.drawIndex + 1] || "—";
    $("#nextName").textContent = next;
    $("#btnNext").disabled = true;

    renderOrderLive();
  }

  function setCurrentPickerUI() {
    const picker = state.round.currentPicker;
    if (!picker) {
      $("#currentPicker").textContent = "未開始";
      $("#currentHint").textContent = "按「開始」開始旋轉/閃名，之後按「停止」減速停定。";
      return;
    }
    $("#currentPicker").textContent = `🎁 輪到：${picker}`;
    $("#currentHint").textContent = "按「開始」→（變停止）→ 按「停止」減速停定後出結果。";
  }

  function showResultUI() {
    const picker = state.round.currentPicker;
    const giftOwner = state.round.currentGift;
    const box = $("#resultBox");
    box.classList.add("show");
    $("#resultBig").textContent = `🎉 ${picker} 抽中咗：${giftOwner} 嘅禮物！`;
    $("#resultSmall").textContent = `按「完成此輪」會把 ${picker} 同 ${giftOwner} 從 Pool 移除。`;
  }

  function hideResultUI() {
    $("#resultBox").classList.remove("show");
  }

  // =========================
  // View Mode Toggle
  // =========================
  function setViewMode(mode) {
    if (state.round.viewLocked) {
      toast("本輪已開始，完成此輪後下一輪先可以切換模式");
      return;
    }

    state.viewMode = mode;
    $("#viewWheel").classList.toggle("active", mode === "wheel");
    $("#viewFlash").classList.toggle("active", mode === "flash");

    $("#wheel").style.display = mode === "wheel" ? "block" : "none";
    $("#wheelPointer").style.display = mode === "wheel" ? "block" : "none";
    $("#flashBox").style.display = mode === "flash" ? "flex" : "none";

    saveState();
    drawWheel();
    setDrawModeLabel();
  }

  // =========================
  // Start spinning
  // =========================
  function startSpin() {
    stopAllSpins();
    hideResultUI();
    stopFireworks();

    state.round.status = "spinning";
    state.round.currentGift = null;

    state.round.viewLocked = true;

    saveState();
    setSpinButtonText();
    setDrawModeLabel();

    if (state.viewMode === "wheel") {
      wheelLoop();
    } else {
      const displayPool = state.participantsAll; // show all
      flashIndex = Math.floor(Math.random() * Math.max(1, displayPool.length));
      $("#flashName").textContent = displayPool[flashIndex] || "—";
      flashLoop();
    }
  }

  function wheelLoop() {
    if (state.round.status !== "spinning") return;
    wheelAngle += 0.30;
    drawWheel();
    wheelRaf = requestAnimationFrame(wheelLoop);
  }

  function flashLoop() {
    if (state.round.status !== "spinning") return;
    const displayPool = state.participantsAll;
    if (!displayPool.length) { $("#flashName").textContent = "—"; return; }
    flashIndex = (flashIndex + 1 + Math.floor(Math.random() * 2)) % displayPool.length;
    $("#flashName").textContent = displayPool[flashIndex];
    flashTimer = setTimeout(flashLoop, 55);
  }

  // =========================
  // Stop plan to target gift (from giftPool only)
  // =========================
  function planStopToGift(targetGiftOwner) {
    state.round.status = "decel";
    saveState();
    setSpinButtonText();
    setDrawModeLabel();

    if (state.viewMode === "wheel") {
      const names = state.giftPool.slice();
      const n = names.length;
      const idx = Math.max(0, names.indexOf(targetGiftOwner));
      const seg = (Math.PI * 2) / n;

      const desired = -Math.PI / 2;
      const targetAngle = desired - (idx + 0.5) * seg;

      const TWO = Math.PI * 2;
      let cur = wheelAngle % TWO; if (cur < 0) cur += TWO;
      let tgt = targetAngle % TWO; if (tgt < 0) tgt += TWO;

      const extraTurns = 4 + Math.floor(Math.random() * 2);
      let final = tgt + extraTurns * TWO;
      while (final < cur + 2 * TWO) final += TWO;

      wheelStopPlan = {
        startTs: performance.now(),
        dur: 2400 + Math.floor(Math.random() * 700),
        startAngle: wheelAngle,
        endAngle: final
      };

      if (wheelRaf) cancelAnimationFrame(wheelRaf);
      wheelRaf = requestAnimationFrame(wheelStopLoop);
    } else {
      flashStopPlan = {
        startTs: performance.now(),
        dur: 2100 + Math.floor(Math.random() * 800),
        startInterval: 45,
        endInterval: 320,
        target: targetGiftOwner
      };
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = null;
      flashDecelTick();
    }
  }

  function wheelStopLoop(ts) {
    if (!wheelStopPlan) return;
    const t = clamp((ts - wheelStopPlan.startTs) / wheelStopPlan.dur, 0, 1);
    const e = easeOutCubic(t);
    wheelAngle = wheelStopPlan.startAngle + (wheelStopPlan.endAngle - wheelStopPlan.startAngle) * e;
    drawWheel();

    if (t < 1) {
      wheelRaf = requestAnimationFrame(wheelStopLoop);
    } else {
      wheelStopPlan = null;
      onStopped();
    }
  }

  function flashDecelTick() {
    if (!flashStopPlan) return;
    const now = performance.now();
    const t = clamp((now - flashStopPlan.startTs) / flashStopPlan.dur, 0, 1);
    const e = easeOutCubic(t);
    const interval = Math.floor(flashStopPlan.startInterval + (flashStopPlan.endInterval - flashStopPlan.startInterval) * e);

    const displayPool = state.participantsAll;
    if (displayPool.length) {
      flashIndex = (flashIndex + 1 + Math.floor(Math.random() * 3)) % displayPool.length;
      $("#flashName").textContent = displayPool[flashIndex];
    }

    if (t < 1) {
      flashTimer = setTimeout(flashDecelTick, interval);
    } else {
      $("#flashName").textContent = flashStopPlan.target || "—";
      flashStopPlan = null;
      onStopped();
    }
  }

  function onStopped() {
    state.round.status = "result";
    saveState();

    setDrawModeLabel();
    setSpinButtonText();

    showResultUI();
    $("#btnDone").disabled = false;

    startFireworks(3.4);
  }

  // =========================
  // Finish a round
  // =========================
  function finishThisRound() {
    if (state.round.status !== "result") return;
    const picker = state.round.currentPicker;
    const giftOwner = state.round.currentGift;
    if (!picker || !giftOwner) return;

    state.participantPool = state.participantPool.filter((n) => n !== picker);
    state.giftPool = state.giftPool.filter((n) => n !== giftOwner);

    const time = new Date().toLocaleTimeString("zh-Hant-TW", { hour: "2-digit", minute: "2-digit" });
    state.done.push({ picker, giftOwner, time });

    state.drawIndex += 1;
    const nextPicker = state.drawOrder[state.drawIndex] || null;

    state.round = {
      status: "idle",
      currentPicker: nextPicker,
      currentGift: null,
      viewLocked: false
    };

    saveState();
    renderPools();
    renderDoneList();
    hideResultUI();
    stopFireworks();

    $("#btnDone").disabled = true;
    setSpinButtonText();
    setDrawModeLabel();

    updateProgressUI();
    setCurrentPickerUI();

    if (!nextPicker || state.giftPool.length === 0) {
      showFinal();
      return;
    }

    toast("已完成此輪");
  }

  // =========================
  // Done list render
  // =========================
  function renderDoneList() {
    const wrap = $("#doneItems");
    wrap.innerHTML = "";
    state.done.slice().reverse().forEach((d) => {
      const item = el("div", "doneItem");
      const left = el("div");
      left.innerHTML = `<b>${d.picker}</b><div><span>抽中咗</span> <b>${d.giftOwner}</b><span> 嘅禮物</span></div>`;
      const right = el("div");
      right.innerHTML = `<span>${d.time}</span>`;
      item.appendChild(left);
      item.appendChild(right);
      wrap.appendChild(item);
    });
  }

  // =========================
  // Final page (auto 30s + toggle button)
  // =========================
  function showFinal() {
    showStep(4);

    $("#finalCount").textContent = state.done.length;

    const ul = $("#finalList");
    ul.innerHTML = "";
    state.done.forEach((d) => {
      const li = document.createElement("li");
      li.textContent = `${d.picker} ➜ ${d.giftOwner}`;
      ul.appendChild(li);
    });

    // ✅ auto play 30 seconds
    startFireworks(FINAL_FW_SECONDS);

    if (fwAutoStopTimer) clearTimeout(fwAutoStopTimer);
    fwAutoStopTimer = setTimeout(() => {
      stopFireworks();
    }, (FINAL_FW_SECONDS * 1000) + 400);

    setFireworksButtonLabel();
    toast("🎉 全部完成！");
  }

  // =========================
  // Step1: Add names + reset cascade
  // =========================
  function hardResetAfterParticipantChange() {
    state.participantPool = state.participantsAll.slice();
    state.giftPool = state.participantsAll.slice();

    state.randomTimes = 0;
    state.manualOrder = [];
    state.drawOrder = [];
    state.drawIndex = 0;
    state.assignment = {};
    state.done = [];

    state.round = { status: "idle", currentPicker: null, currentGift: null, viewLocked: false };

    stopAllSpins();
    stopFireworks();
    hideResultUI();
  }

  function addName(nameRaw) {
    const name = (nameRaw || "").trim();
    if (!name) return toast("請輸入名字");
    if (state.participantsAll.includes(name)) return toast("呢個名字已經存在");

    state.participantsAll.push(name);
    state.participantsAll = uniq(state.participantsAll);

    hardResetAfterParticipantChange();
    saveState();

    renderPools();
    renderOrderStatus();
    renderManualPools();
    renderDoneList();

    toast(`已加入：${name}`);
  }

  // =========================
  // Step2: random/manual order
  // =========================
  function randomizeOrder() {
    if (state.participantsAll.length < 2) return toast("請至少 2 個名字");
    state.randomTimes++;

    if (state.randomTimes >= 2) {
      const ok = confirm("你已經生成過一次隨機順序。確定要再次隨機？（會覆蓋現有順序）");
      if (!ok) {
        state.randomTimes--;
        return;
      }
    }

    state.drawOrder = shuffle(state.participantsAll);
    state.drawIndex = 0;

    state.assignment = {};
    state.done = [];
    state.round = { status: "idle", currentPicker: null, currentGift: null, viewLocked: false };

    saveState();
    renderOrderStatus();
    toast("已生成隨機抽獎順序");
  }

  function confirmManualOrder() {
    if (state.manualOrder.length !== state.participantsAll.length) {
      return toast("全部人都要進入順序池先可以確認");
    }
    state.drawOrder = state.manualOrder.slice();
    state.drawIndex = 0;

    state.assignment = {};
    state.done = [];
    state.round = { status: "idle", currentPicker: null, currentGift: null, viewLocked: false };

    saveState();
    renderOrderStatus();
    toast("已確認手動抽獎順序 ✅");
  }

  // =========================
  // Stage3 start
  // =========================
  function startStage3() {
    if (state.drawOrder.length !== state.participantsAll.length || state.participantsAll.length < 2) {
      return toast("請先完成抽獎順序設定");
    }

    state.participantPool = state.participantsAll.slice();
    state.giftPool = state.participantsAll.slice();

    state.assignment = buildDerangement(state.participantsAll);

    state.drawIndex = 0;
    state.round = {
      status: "idle",
      currentPicker: state.drawOrder[0] || null,
      currentGift: null,
      viewLocked: false
    };

    state.done = [];
    saveState();

    renderPools();
    renderDoneList();
    showStep(3);

    applyViewModeUI();

    hideResultUI();
    $("#btnDone").disabled = true;

    setCurrentPickerUI();
    updateProgressUI();
    setDrawModeLabel();
    setSpinButtonText();

    $("#btnSpin").disabled = !state.round.currentPicker;

    toast("已進入抽獎環節");
  }

  function applyViewModeUI() {
    $("#viewWheel").classList.toggle("active", state.viewMode === "wheel");
    $("#viewFlash").classList.toggle("active", state.viewMode === "flash");
    $("#wheel").style.display = state.viewMode === "wheel" ? "block" : "none";
    $("#wheelPointer").style.display = state.viewMode === "wheel" ? "block" : "none";
    $("#flashBox").style.display = state.viewMode === "flash" ? "flex" : "none";
    drawWheel();
  }

  // =========================
  // Spin button click (Start/Stop)
  // =========================
  function onSpinButtonClick() {
    if (state.step !== 3) return;
    const s = state.round.status;
    const picker = state.round.currentPicker;
    if (!picker) return;

    if (s === "idle") {
      startSpin();
      return;
    }

    if (s === "spinning") {
      let finalGift = state.assignment[picker];

      if (!state.giftPool.includes(finalGift)) {
        const candidates = state.giftPool.filter((n) => n !== picker);
        finalGift = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : state.giftPool[0];
      }

      if (finalGift === picker) {
        const candidates = state.giftPool.filter((n) => n !== picker);
        finalGift = candidates.length ? candidates[0] : finalGift;
      }

      state.round.currentGift = finalGift;
      saveState();

      planStopToGift(finalGift);
      return;
    }
  }

  // =========================
  // Section resets / backs
  // =========================
  function resetStep1Only() {
    state = structuredClone(defaultState);
    stopAllSpins();
    stopFireworks();
    hideResultUI();
    saveState();
    showStep(1);
    renderPools();
    renderOrderStatus();
    renderManualPools();
    renderDoneList();
    setCurrentPickerUI();
    updateProgressUI();
    setDrawModeLabel();
    setSpinButtonText();
    toast("已重置 Step 1");
  }

  function resetStep2Only() {
    state.orderMode = "random";
    state.randomTimes = 0;
    state.manualOrder = [];
    state.drawOrder = [];
    state.drawIndex = 0;
    state.assignment = {};
    state.done = [];
    state.round = { status: "idle", currentPicker: null, currentGift: null, viewLocked: false };

    saveState();
    setOrderMode("random");
    renderOrderStatus();
    renderManualPools();
    toast("已重置 Step 2（順序）");
  }

  function resetStep3Only() {
    if (state.drawOrder.length !== state.participantsAll.length || state.participantsAll.length < 2) {
      toast("順序未完成，請先回到 Step 2 設定");
      return;
    }

    stopAllSpins();
    stopFireworks();
    hideResultUI();

    state.participantPool = state.participantsAll.slice();
    state.giftPool = state.participantsAll.slice();
    state.done = [];
    state.drawIndex = 0;
    state.assignment = buildDerangement(state.participantsAll);

    state.round = {
      status: "idle",
      currentPicker: state.drawOrder[0] || null,
      currentGift: null,
      viewLocked: false
    };

    saveState();
    renderPools();
    renderDoneList();
    setCurrentPickerUI();
    updateProgressUI();
    setDrawModeLabel();
    setSpinButtonText();
    $("#btnDone").disabled = true;
    $("#btnSpin").disabled = !state.round.currentPicker;

    toast("已重置 Step 3（抽獎進度）");
  }

  // =========================
  // Global reset
  // =========================
  $("#btnGlobalReset").addEventListener("click", () => {
    const ok = confirm("⚠️ 危險操作：會清除所有進度與 localStorage，是否繼續？");
    if (!ok) return;
    clearAllStorage();
    location.reload();
  });

  // =========================
  // Wire UI events
  // =========================
  $("#btnAddName").addEventListener("click", () => {
    addName($("#singleNameInput").value);
    $("#singleNameInput").value = "";
    $("#singleNameInput").focus();
  });
  $("#singleNameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("#btnAddName").click();
    }
  });

  $("#btnFinishInput").addEventListener("click", () => {
    if (state.participantsAll.length < 2) return;
    showStep(2);
    renderOrderStatus();
    toast("已進入：選擇抽獎順序模式");
  });

  $("#resetStep1").addEventListener("click", () => {
    if (!confirm("確定要重置 Step 1？（會清空所有名字與後續設定）")) return;
    resetStep1Only();
  });

  $("#backToStep1").addEventListener("click", () => {
    showStep(1);
    toast("已回到 Step 1");
  });
  $("#resetStep2").addEventListener("click", () => {
    if (!confirm("確定要重置 Step 2？（只清空抽獎順序設定）")) return;
    resetStep2Only();
  });

  $("#modeRandom").addEventListener("click", () => setOrderMode("random"));
  $("#modeManual").addEventListener("click", () => setOrderMode("manual"));
  $("#btnRandomize").addEventListener("click", randomizeOrder);

  $("#btnResetManual").addEventListener("click", () => {
    state.manualOrder = [];
    saveState();
    renderManualPools();
    toast("已重置順序池");
  });
  $("#btnConfirmManual").addEventListener("click", () => {
    confirmManualOrder();
    renderOrderPreview();
  });

  $("#btnStartStage3").addEventListener("click", startStage3);

  $("#backToStep2").addEventListener("click", () => {
    stopAllSpins();
    stopFireworks();
    hideResultUI();
    state.round.status = "idle";
    state.round.viewLocked = false;
    saveState();

    showStep(2);
    renderOrderStatus();
    renderManualPools();
    toast("已回到 Step 2");
  });
  $("#resetStep3").addEventListener("click", () => {
    if (!confirm("確定要重置 Step 3？（清空抽獎結果，重新開始抽獎）")) return;
    resetStep3Only();
  });

  $("#viewWheel").addEventListener("click", () => setViewMode("wheel"));
  $("#viewFlash").addEventListener("click", () => setViewMode("flash"));

  $("#btnSpin").addEventListener("click", onSpinButtonClick);
  $("#btnDone").addEventListener("click", () => finishThisRound());

  // ✅ Final toggle fireworks button (single button)
  const btnToggleFw = $("#btnToggleFireworks");
  if (btnToggleFw) {
    btnToggleFw.addEventListener("click", () => {
      if (state.step !== 4) return;

      if (fwIsRunning) {
        stopFireworks();
        toast("已停止煙花");
      } else {
        startFireworks(FINAL_FW_SECONDS);
        if (fwAutoStopTimer) clearTimeout(fwAutoStopTimer);
        fwAutoStopTimer = setTimeout(() => stopFireworks(), (FINAL_FW_SECONDS * 1000) + 400);
        toast("已開始煙花（30 秒）");
      }
    });
  }

  // =========================
  // Restore from saved state
  // =========================
  function restore() {
    showStep(state.step);

    renderPools();
    renderOrderStatus();
    renderManualPools();
    renderDoneList();

    applyViewModeUI();

    setCurrentPickerUI();
    updateProgressUI();
    setDrawModeLabel();
    setSpinButtonText();

    if (state.round.status === "result") {
      $("#resultBox").classList.add("show");
      showResultUI();
      $("#btnDone").disabled = false;
      $("#btnSpin").disabled = true;
    } else {
      hideResultUI();
      $("#btnDone").disabled = true;
    }

    if (state.round.status === "spinning" || state.round.status === "decel") {
      stopAllSpins();
      stopFireworks();
      state.round.status = "idle";
      state.round.viewLocked = false;
      state.round.currentGift = null;
      saveState();
      setSpinButtonText();
      setDrawModeLabel();
    }

    // ✅ If already at final, follow 30s rule (not Infinity)
    if (state.step === 4) {
      $("#finalCount").textContent = state.done.length;

      const ul = $("#finalList");
      ul.innerHTML = "";
      state.done.forEach((d) => {
        const li = document.createElement("li");
        li.textContent = `${d.picker} ➜ ${d.giftOwner}`;
        ul.appendChild(li);
      });

      startFireworks(FINAL_FW_SECONDS);
      if (fwAutoStopTimer) clearTimeout(fwAutoStopTimer);
      fwAutoStopTimer = setTimeout(() => stopFireworks(), (FINAL_FW_SECONDS * 1000) + 400);

      setFireworksButtonLabel();
    } else {
      // ensure label consistent even outside final
      fwIsRunning = false;
      setFireworksButtonLabel();
    }

    $("#btnSpin").disabled = !(state.step === 3 && !!state.round.currentPicker && state.round.status === "idle");
  }

  // keep wheel updated when idle
  setInterval(() => {
    if (state.step === 3 && state.viewMode === "wheel" && state.round.status === "idle") {
      drawWheel();
    }
  }, 500);

  // =========================
  // Init
  // =========================
  restore();
  drawWheel();

})();
