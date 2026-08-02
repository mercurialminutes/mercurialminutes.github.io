(function () {
  "use strict";

  const nav = document.getElementById("constellation");
  const list = document.getElementById("node-list");
  const panel = document.getElementById("panel");
  const photo = document.getElementById("photo-window");
  if (!nav || !list) return;

  const desktopMq = window.matchMedia("(min-width: 901px)");
  const nodes = Array.prototype.slice.call(list.querySelectorAll(".node"));

  let year = "all";
  let zTop = 100;
  let allPick = []; // up to 10 randomly shuffled highlights for "All"
  let panelUserMoved = false;
  let photoUserMoved = false;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickAllHighlights() {
    const highlights = nodes.filter((n) => n.classList.contains("is-highlight"));
    allPick = shuffle(highlights).slice(0, 10);
  }

  function ensureCoordsEl(node) {
    let el = node.querySelector(".box-coords");
    if (!el) {
      el = document.createElement("span");
      el.className = "box-coords";
      el.setAttribute("aria-hidden", "true");
      node.appendChild(el);
    }
    return el;
  }

  function updateBoxCoords(node) {
    const el = ensureCoordsEl(node);
    const x = Math.round(parseFloat(node.style.left) || 0);
    const y = Math.round(parseFloat(node.style.top) || 0);
    el.textContent = "X: " + x + "PX  Y: " + y + "PX";
  }

  function hash(n) {
    let h = (n + 1) * 2654435761;
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  }

  function isVisible(node) {
    if (year === "all") return allPick.indexOf(node) !== -1;
    return node.dataset.year === year;
  }

  function panelBounds() {
    const panelEl = document.getElementById("panel");
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (!panelEl) {
      const contentW = Math.min(640, W - 32);
      const midL = (W - contentW) / 2;
      return { left: midL, right: midL + contentW, top: 56, bottom: H - 24 };
    }
    const r = panelEl.getBoundingClientRect();
    // generous clear zone so project windows never crowd the bio
    const pad = 28;
    return {
      left: r.left - pad,
      right: r.right + pad,
      top: r.top - pad,
      bottom: r.bottom + pad,
    };
  }

  function layout() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const mid = panelBounds();
    const topPad = 72;
    const bottomPad = 36;
    const gutter = 16;

    const leftBandW = Math.max(0, mid.left - gutter);
    const rightBandW = Math.max(0, W - mid.right - gutter);

    const visible = [];
    nodes.forEach((n) => {
      if (isVisible(n)) visible.push(n);
      else {
        n.classList.remove("is-shown");
        n.style.display = "none";
      }
    });

    // alternate into left / right columns like the reference scatter
    const left = [];
    const right = [];
    visible.forEach((n, i) => (i % 2 === 0 ? left : right).push(n));

    function place(side, arr, bandW, bandLeft) {
      const count = Math.max(arr.length, 1);
      const usableH = H - topPad - bottomPad;
      let prevBottom = topPad;
      let prevLeft = bandLeft;
      let prevW = 0;

      arr.forEach((el, k) => {
        const seed = nodes.indexOf(el);
        const r1 = hash(seed * 11 + 1);
        const r2 = hash(seed * 11 + 2);
        const r3 = hash(seed * 11 + 3);

        // taller/wider panes so overlaps can actually happen
        const maxW = Math.max(160, bandW - 8);
        const w = Math.min(maxW, Math.floor(210 + r3 * 90));
        const estH = 84 + Math.floor(r1 * 36);

        // base slot down the column
        const slotH = usableH / count;
        let y = topPad + slotH * k + slotH * (0.1 + 0.22 * r1);

        // zig-zag X within the side band
        const xRoom = Math.max(bandW - w, 0);
        let xBias;
        if (side === "left") {
          xBias = k % 2 === 0 ? 0.06 + r2 * 0.3 : 0.4 + r2 * 0.5;
        } else {
          xBias = k % 2 === 0 ? 0.5 + r2 * 0.4 : 0.04 + r2 * 0.35;
        }
        let x = bandLeft + xBias * xRoom;

        // occasional tiny kiss — at most ~10% of the box size
        if (k > 0 && Math.random() < 0.15) {
          const overlapPx = Math.min(estH, 96) * (0.04 + r1 * 0.06); // 4–10%
          y = prevBottom - overlapPx;
          // slight X nudge so edges just kiss
          const toward = prevLeft + (prevW - w) * 0.2;
          x = toward * 0.25 + x * 0.75;
        }

        y = Math.max(topPad, Math.min(y, H - bottomPad - estH));
        x = Math.max(gutter, Math.min(bandLeft + bandW - w, x));

        el.style.display = "";
        el.style.width = w + "px";
        el.style.left = Math.round(x) + "px";
        el.style.top = Math.round(y) + "px";
        el.style.zIndex = 100 + k;
        el.style.removeProperty("--tilt");
        el.classList.add("is-shown");
        updateBoxCoords(el);

        prevBottom = y + estH;
        prevLeft = x;
        prevW = w;
      });
    }

    if (leftBandW > 90) place("left", left, leftBandW, gutter);
    else left.forEach((el) => { el.style.display = "none"; el.classList.remove("is-shown"); });

    if (rightBandW > 90) place("right", right, rightBandW, mid.right + gutter);
    else right.forEach((el) => { el.style.display = "none"; el.classList.remove("is-shown"); });

    zTop = 100 + visible.length;
    nav.classList.add("is-ready");
  }

  function clearDesktopStyles() {
    nodes.forEach((n) => {
      n.classList.remove("is-shown");
      n.style.display = "";
      n.style.width = "";
      n.style.left = "";
      n.style.top = "";
      n.style.zIndex = "";
      n.style.removeProperty("--tilt");
    });
    nav.classList.add("is-ready");
  }

  // Lower = heavier / lazier follow. Windows ease toward the pointer.
  const DRAG_EASE = 0.11;
  const DRAG_STOP = 0.35;

  function clampPos(el, x, y) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return {
      x: Math.max(4, Math.min(W - w - 4, x)),
      y: Math.max(4, Math.min(H - Math.min(h, H - 8) - 4, y)),
    };
  }

  function attachLazyDrag(el, opts) {
    const openOnClick = opts && opts.openOnClick;
    const onMoved = opts && opts.onMoved;
    const ignoreInteractive = opts && opts.ignoreInteractive;

    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let curX = 0;
    let curY = 0;
    let targetX = 0;
    let targetY = 0;
    let moved = false;
    let active = false;
    let coasting = false;
    let pointerId = null;
    let raf = 0;

    function applyPos() {
      el.style.left = Math.round(curX) + "px";
      el.style.top = Math.round(curY) + "px";
      updateBoxCoords(el);
      if (el === panel) syncYearBar();
    }

    function tick() {
      raf = 0;
      const dx = targetX - curX;
      const dy = targetY - curY;
      if (Math.abs(dx) < DRAG_STOP && Math.abs(dy) < DRAG_STOP) {
        curX = targetX;
        curY = targetY;
        applyPos();
        if (!active) {
          coasting = false;
          el.classList.remove("is-dragging");
        }
        return;
      }
      curX += dx * DRAG_EASE;
      curY += dy * DRAG_EASE;
      applyPos();
      raf = requestAnimationFrame(tick);
    }

    function startTick() {
      if (!raf) raf = requestAnimationFrame(tick);
    }

    el.addEventListener("pointerdown", (e) => {
      if (!desktopMq.matches) return;
      if (e.button != null && e.button !== 0) return;
      if (ignoreInteractive && isInteractive(e.target)) return;
      active = true;
      coasting = false;
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      originX = parseFloat(el.style.left);
      originY = parseFloat(el.style.top);
      if (Number.isNaN(originX)) originX = el.getBoundingClientRect().left;
      if (Number.isNaN(originY)) originY = el.getBoundingClientRect().top;
      curX = originX;
      curY = originY;
      targetX = originX;
      targetY = originY;
      el.style.zIndex = ++zTop;
      updateBoxCoords(el);
    });

    el.addEventListener("pointermove", (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && dx * dx + dy * dy > 36) {
        moved = true;
        el.classList.add("is-dragging");
        if (onMoved) onMoved();
        try {
          el.setPointerCapture(pointerId);
        } catch (_) {}
      }
      if (!moved) return;
      const next = clampPos(el, originX + dx, originY + dy);
      targetX = next.x;
      targetY = next.y;
      startTick();
      if (e.cancelable) e.preventDefault();
    });

    function endDrag(e) {
      if (!active) return;
      const wasMoved = moved;
      active = false;
      if (pointerId != null) {
        try {
          el.releasePointerCapture(pointerId);
        } catch (_) {}
        pointerId = null;
      }
      if (wasMoved) {
        // keep easing toward the last target — a little coast of weight
        coasting = true;
        startTick();
      } else {
        el.classList.remove("is-dragging");
        if (openOnClick) {
          const href = openOnClick.getAttribute("href");
          if (href) {
            if (e && e.preventDefault) e.preventDefault();
            window.open(href, "_blank", "noopener,noreferrer");
          }
        }
      }
      moved = false;
    }

    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", () => {
      active = false;
      moved = false;
      coasting = false;
      el.classList.remove("is-dragging");
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });

    if (openOnClick) {
      openOnClick.setAttribute("draggable", "false");
      openOnClick.addEventListener("click", (e) => {
        if (desktopMq.matches) e.preventDefault();
      });
    }
  }

  function initDrag() {
    nodes.forEach((node) => {
      attachLazyDrag(node, { openOnClick: node.querySelector("a") });
    });
  }

  function isInteractive(el) {
    return !!(
      el &&
      el.closest &&
      el.closest("a, button, .tab, input, textarea, select, label")
    );
  }

  function syncYearBar() {
    if (!panel) return;
    if (!desktopMq.matches) {
      document.documentElement.style.removeProperty("--year-left");
      return;
    }
    const left = panel.getBoundingClientRect().left;
    document.documentElement.style.setProperty("--year-left", Math.round(left) + "px");
  }

  function placePanel(center) {
    if (!panel || !desktopMq.matches) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = panel.offsetWidth || Math.min(640, W - 32);
    const h = panel.offsetHeight || 400;
    let x;
    let y;
    if (center || !panelUserMoved) {
      x = Math.max(12, (W - w) / 2);
      y = Math.max(56, (H - h) / 2);
    } else {
      x = parseFloat(panel.style.left) || 12;
      y = parseFloat(panel.style.top) || 56;
      x = Math.max(4, Math.min(W - Math.min(w, W - 8), x));
      y = Math.max(4, Math.min(H - 48, y));
    }
    panel.style.left = Math.round(x) + "px";
    panel.style.top = Math.round(y) + "px";
    panel.style.width = "";
    updateBoxCoords(panel);
    syncYearBar();
  }

  function placePhoto(center) {
    if (!photo || !desktopMq.matches) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = photo.offsetWidth || 220;
    const h = photo.offsetHeight || 220;
    let x;
    let y;
    if (center || !photoUserMoved) {
      // top-right of the bio window — higher, overlapping at most ~30%
      const pr = panel
        ? panel.getBoundingClientRect()
        : { left: (W - 640) / 2, top: 80, right: (W + 640) / 2, width: 640 };
      const seedX = hash(42);
      const seedY = hash(43);
      // hang mostly above the panel; only a slim bottom strip overlaps (~8–14%)
      const overlap = h * (0.08 + seedY * 0.06);
      x = pr.right - w * (0.65 + seedX * 0.15);
      y = pr.top - h + overlap;
      x = Math.max(4, Math.min(W - w - 4, x));
      y = Math.max(8, Math.min(H - h - 4, y));
    } else {
      x = parseFloat(photo.style.left) || 12;
      y = parseFloat(photo.style.top) || 56;
      x = Math.max(4, Math.min(W - w - 4, x));
      y = Math.max(4, Math.min(H - h - 4, y));
    }
    photo.style.left = Math.round(x) + "px";
    photo.style.top = Math.round(y) + "px";
    updateBoxCoords(photo);
  }

  function clearPanelDesktop() {
    document.documentElement.style.removeProperty("--year-left");
    if (panel) {
      panel.classList.remove("is-dragging");
      panel.style.left = "";
      panel.style.top = "";
      panel.style.zIndex = "";
      panelUserMoved = false;
      const coords = panel.querySelector(".box-coords");
      if (coords) coords.remove();
    }
    if (photo) {
      photo.classList.remove("is-dragging");
      photo.style.left = "";
      photo.style.top = "";
      photo.style.zIndex = "";
      photoUserMoved = false;
      const coords = photo.querySelector(".box-coords");
      if (coords) coords.remove();
    }
  }

  function initPanelDrag() {
    if (panel) {
      attachLazyDrag(panel, {
        ignoreInteractive: true,
        onMoved: () => {
          panelUserMoved = true;
        },
      });
    }
    if (photo) {
      attachLazyDrag(photo, {
        onMoved: () => {
          photoUserMoved = true;
        },
      });
    }
  }

  function apply() {
    if (desktopMq.matches) {
      placePanel(false);
      placePhoto(false);
      layout();
    } else {
      clearPanelDesktop();
      clearDesktopStyles();
    }
  }

  window.Boxes = {
    setYear(y) {
      year = String(y);
      if (year === "all") pickAllHighlights();
      if (desktopMq.matches) layout();
    },
  };

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 150);
  });
  if (desktopMq.addEventListener) desktopMq.addEventListener("change", apply);

  // Cursor light on windows — position + distance falloff
  function initWindowLight() {
    let tx = -9999;
    let ty = -9999;
    let sx = -9999;
    let sy = -9999;
    let raf = 0;
    // glow reaches this far beyond a window's edge (px)
    const REACH = 720;

    function windows() {
      const list = nodes.filter((n) => n.classList.contains("is-shown"));
      if (panel) list.push(panel);
      if (photo) list.push(photo);
      return list;
    }

    function distToRect(x, y, r) {
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      return Math.sqrt(dx * dx + dy * dy);
    }

    function paint() {
      raf = 0;
      sx += (tx - sx) * 0.18;
      sy += (ty - sy) * 0.18;
      windows().forEach((el) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--lx", sx - r.left + "px");
        el.style.setProperty("--ly", sy - r.top + "px");
        const d = distToRect(sx, sy, r);
        // 1 inside / on the pane, soft ease to 0 at REACH
        const t = Math.max(0, 1 - d / REACH);
        const intensity = t * t * (3 - 2 * t); // smoothstep — wide, gentle bloom
        el.style.setProperty("--light", intensity.toFixed(3));
      });
      if (desktopMq.matches) raf = requestAnimationFrame(paint);
    }

    function startPaint() {
      if (!raf && desktopMq.matches) raf = requestAnimationFrame(paint);
    }

    window.addEventListener(
      "pointermove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        if (sx < -9000) {
          sx = tx;
          sy = ty;
        }
        startPaint();
      },
      { passive: true }
    );

    if (desktopMq.addEventListener) {
      desktopMq.addEventListener("change", () => {
        if (desktopMq.matches) startPaint();
        else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
    }
  }

  function init() {
    initDrag();
    initPanelDrag();
    initWindowLight();
    pickAllHighlights();
    apply();
    // re-center once layout has settled (photo/fonts)
    requestAnimationFrame(() => {
      if (desktopMq.matches && !panelUserMoved) placePanel(true);
      if (desktopMq.matches && !photoUserMoved) placePhoto(true);
      if (desktopMq.matches) layout();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
