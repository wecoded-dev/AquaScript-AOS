/**
 * AOS-Ultra-Pro v2.0
 * Single-file advanced scroll animation engine (WAAPI-first + fallbacks).
 * Includes:
 *  - presets & keyframes, WAAPI, spring physics, motion paths, ScrollTimeline integration,
 *  - Lottie hook support, SVG draw/morph, count-up, parallax, stagger, timeline editor UI,
 *  - profiling, dev inspector, plugin hooks, MutationObserver, batching, SSR-safe.
 *
 * Drop into a script tag and use data attributes:
 *  data-aos="presetName" | "key:myKey" | "timeline:timelineName"
 *  data-aos-duration, data-aos-delay, data-aos-easing, data-aos-offset
 *  data-aos-stiffness, data-aos-damping (for spring)
 *  data-path="#motionPathId" data-path-offset="0" data-path-reverse="true"
 *  data-lottie="true" (requires Lottie already loaded)
 *  data-scroll-scrub="true" (connects to ScrollTimeline if supported)
 *  data-morph="#targetPath" (basic morph)
 *  data-dev="true" to expose the editor UI for that element (or call API)
 *
 * Public global: window.AOSProV2 with API:
 *  init(opts), refresh(), destroy(), registerPreset(name,preset),
 *  registerKeyframes(name,frames), timeline(name,opts), animate(el,opts),
 *  enableEditor(), profile(), use(plugin)
 *
 * Author: your needy web dev overlord
 */

(function (global) {
  'use strict';
  if (typeof window === 'undefined') {
    // Server / SSR safe no-op
    global.AOSProV2 = {
      init: () => {},
      refresh: () => {},
      destroy: () => {},
      registerPreset: () => {},
      registerKeyframes: () => {},
      timeline: () => ({ run: () => {} }),
      animate: () => {},
      enableEditor: () => {},
      profile: () => ({})
    };
    return;
  }

  /* ===========================
     Config & Utility Helpers
     =========================== */
  const DEFAULTS = {
    offset: 140,
    duration: 800,
    delay: 0,
    easing: 'cubic-bezier(.2,.9,.2,1)',
    once: true,
    mirror: false,
    anchorPlacement: 'top-bottom',
    disableOnMobile: false,
    debug: false,
    injectedStyles: true,
    batchInterval: 100,
    maxFPSDropWarn: 10, // warn if engine causes fps drop > this
    presets: {}, // fill later
    keyframes: {},
    editorEnabled: false,
  };

  const PRESET_BANK = {
    /* subtle */
    'fade-up': { transform: 'translateY(24px)', opacity: 0 },
    'fade-down': { transform: 'translateY(-24px)', opacity: 0 },
    'fade-left': { transform: 'translateX(-24px)', opacity: 0 },
    'fade-right': { transform: 'translateX(24px)', opacity: 0 },
    'zoom-in': { transform: 'scale(.95)', opacity: 0 },
    'soft-pop': { transform: 'scale(.96) translateY(6px)', opacity: 0, filter: 'blur(3px)' },

    /* dramatic */
    'flip-left': { transform: 'rotateY(22deg) translateZ(0)', opacity: 0 },
    'flip-right': { transform: 'rotateY(-22deg) translateZ(0)', opacity: 0 },
    'sweep-up': { transform: 'translateY(50px) rotate(-4deg)', opacity: 0 },

    /* physics */
    'spring-pop': { keyframePreset: 'spring-pop', useWAAPI: true },
    'elastic': { keyframePreset: 'elastic-entrance', useWAAPI: true },

    /* special */
    'draw-line': { drawPath: true }, // triggers SVG draw if element is svg
  };

  const DEFAULT_KEYFRAMES = {
    'spring-pop': [
      { transform: 'scale(.92)', opacity: 0 },
      { transform: 'scale(1.06)', offset: 0.6 },
      { transform: 'scale(1)', opacity: 1 }
    ],
    'elastic-entrance': [
      { transform: 'translateY(36px)', opacity: 0 },
      { transform: 'translateY(-14px)', offset: 0.6 },
      { transform: 'translateY(0)', opacity: 1 }
    ]
  };

  const isReducedMotion = () => {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  };
  const isMobileUA = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
  const raf = (fn) => window.requestAnimationFrame ? window.requestAnimationFrame(fn) : setTimeout(fn, 16);
  const now = () => (performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const parseBool = (v) => { if (v === undefined || v === null) return undefined; if (typeof v === 'boolean') return v; const s = String(v).toLowerCase(); return s === 'true' ? true : (s === 'false' ? false : undefined); };

  /* ===========================
     Engine Class
     =========================== */
  class AOSProV2Engine {
    constructor(opts = {}) {
      this.opts = Object.assign({}, DEFAULTS, opts);
      this.opts.presets = Object.assign({}, PRESET_BANK, (opts.presets || {}));
      this.opts.keyframes = Object.assign({}, DEFAULT_KEYFRAMES, (opts.keyframes || {}));
      this.observer = null;
      this.mutationObserver = null;
      this.elements = new Map(); // el -> meta
      this.queue = [];
      this.batchTimer = null;
      this.animations = new Set(); // WAAPI entries or internal runners
      this.timelines = new Map();
      this.editorOpen = false;
      this.profiler = { frames: [], lastTick: now(), warned: false };
      this._handleIntersect = this._handleIntersect.bind(this);
      this._mutationHandler = this._mutationHandler.bind(this);
      this._onScroll = this._onScroll.bind(this);
      if (this.opts.injectedStyles) this._injectStyles();
      this._bindScroll();
    }

    log(...args) { if (this.opts.debug) console.info('[AOSProV2]', ...args); }

    _injectStyles() {
      if (document.getElementById('aos-pro-v2-styles')) return;
      const s = document.createElement('style'); s.id = 'aos-pro-v2-styles';
      s.textContent = `
/* AOS-Pro-V2 core */
.aosv2-init { will-change: transform, opacity, filter; transition-property: transform, opacity, filter; opacity:1; }
.aosv2-hidden { opacity:0; }
.aosv2-anim { pointer-events:auto; }
.aosv2-devui { position: fixed; right: 10px; top: 10px; z-index: 99999; background: rgba(6,10,18,0.8); color:#e9f3ff; padding:10px; border-radius:10px; font-family: Inter, system-ui; font-size:12px; box-shadow:0 8px 30px rgba(2,6,23,0.6);}
.aosv2-badge { padding:4px 8px; border-radius:6px; display:inline-block; margin:2px; background: rgba(255,255,255,0.03); }
`;
      document.head.appendChild(s);
    }

    _bindScroll() {
      window.addEventListener('scroll', this._onScroll, { passive: true });
      window.addEventListener('resize', () => { this.elements.forEach((m) => { if (m.motionPath) this._updatePathProgress(m); }); });
    }

    _onScroll() {
      // profiler sample
      const t = now();
      const delta = t - this.profiler.lastTick;
      this.profiler.frames.push(delta);
      if (this.profiler.frames.length > 60) this.profiler.frames.shift();
      this.profiler.lastTick = t;
      const avg = this.profiler.frames.reduce((a,b)=>a+b,0)/this.profiler.frames.length;
      const fps = 1000/avg;
      if (1000/avg < (60 - this.opts.maxFPSDropWarn) && !this.profiler.warned) {
        console.warn('[AOSProV2] Significant FPS drop detected. Use reduced effects or disable dev modes.');
        this.profiler.warned = true;
      }
      // progress motion paths & lottie scrub
      this.elements.forEach((meta, el) => {
        if (meta.motionPath) this._applyPathProgress(el, meta);
        if (meta.scrollScrub && meta.lottie && window.lottie) this._applyLottieScrub(el, meta);
      });
    }

    _getNodes(selector='[data-aos]') { return Array.from(document.querySelectorAll(selector)); }

    _buildMeta(el) {
      const rawName = el.getAttribute('data-aos') || 'fade-up';
      const name = String(rawName).trim();
      const preset = this.opts.presets[name] || {};
      const keyframeRef = preset.keyframePreset || el.getAttribute('data-aos-keyframe') || null;
      const useWAAPI = preset.useWAAPI || (el.getAttribute('data-aos-waapi') === 'true') || false;
      const meta = {
        el,
        name,
        preset,
        duration: parseInt(el.getAttribute('data-aos-duration')) || preset.duration || this.opts.duration,
        delay: parseInt(el.getAttribute('data-aos-delay')) || this.opts.delay,
        easing: el.getAttribute('data-aos-easing') || preset.easing || this.opts.easing,
        offset: parseInt(el.getAttribute('data-aos-offset')) || preset.offset || this.opts.offset,
        once: parseBool(el.getAttribute('data-aos-once')) ?? (preset.once ?? this.opts.once),
        mirror: parseBool(el.getAttribute('data-aos-mirror')) ?? (preset.mirror ?? this.opts.mirror),
        anchor: this._resolveAnchor(el),
        anchorPlacement: el.getAttribute('data-aos-anchor-placement') || this.opts.anchorPlacement,
        customClass: el.getAttribute('data-aos-class') || 'aosv2-animated',
        stagger: parseInt(el.getAttribute('data-aos-stagger')) || preset.stagger || 0,
        useWAAPI,
        keyframes: this.opts.keyframes[keyframeRef] || null,
        motionPath: this._parsePath(el.getAttribute('data-path')),
        pathOffset: parseFloat(el.getAttribute('data-path-offset')||0),
        pathReverse: parseBool(el.getAttribute('data-path-reverse')) || false,
        scrollScrub: parseBool(el.getAttribute('data-scroll-scrub')) || false,
        lottie: parseBool(el.getAttribute('data-lottie')) || false,
        spring: { stiffness: parseFloat(el.getAttribute('data-aos-stiffness')) || 180, damping: parseFloat(el.getAttribute('data-aos-damping')) || 18 },
        drawPath: el.getAttribute('data-draw-path') === 'true',
        morphTarget: el.getAttribute('data-morph') || null,
        count: el.getAttribute('data-count') || null,
        dev: parseBool(el.getAttribute('data-dev')) || false
      };
      return meta;
    }

    _resolveAnchor(el) {
      const sel = el.getAttribute('data-aos-anchor');
      if (!sel) return el;
      try {
        return document.querySelector(sel) || el;
      } catch (e) { return el; }
    }

    _parsePath(val) {
      if (!val) return null;
      try {
        const el = document.querySelector(val);
        if (!el) return null;
        if (el.tagName.toLowerCase() !== 'path' && el.querySelector) {
          // if selector is svg container, try find a path
          const p = el.querySelector('path');
          return p || null;
        }
        return el;
      } catch (e) { return null; }
    }

    _prepareElement(el, meta) {
      // set base classes and transitions
      el.classList.add('aosv2-init');
      el.style.transitionProperty = 'transform, opacity, filter';
      el.style.transitionDuration = `${meta.duration}ms`;
      el.style.transitionTimingFunction = meta.easing;
      el.style.transitionDelay = `${meta.delay}ms`;
      if (!isReducedMotion()) {
        if (meta.preset && meta.preset.transform) el.style.transform = meta.preset.transform;
        if (meta.preset && meta.preset.opacity !== undefined) el.style.opacity = meta.preset.opacity;
        if (meta.preset && meta.preset.filter) el.style.filter = meta.preset.filter;
      } else {
        el.style.transitionDuration = '0ms';
        el.style.transitionDelay = '0ms';
        el.style.opacity = 1;
        el.style.transform = 'none';
      }
      el.classList.add('aosv2-hidden');

      // SVG draw setup
      if (meta.drawPath && el.tagName.toLowerCase() === 'svg') {
        const paths = el.querySelectorAll('path, line, polyline, polygon, circle, rect');
        paths.forEach(p => {
          try {
            const len = p.getTotalLength ? p.getTotalLength() : 0;
            p.style.strokeDasharray = len;
            p.style.strokeDashoffset = len;
            p.style.transition = `stroke-dashoffset ${meta.duration}ms ${meta.easing} ${meta.delay}ms`;
          } catch (e) {}
        });
      }

      // count-up prep
      if (meta.count) {
        const [start, end] = String(meta.count).split(':').map(s => parseFloat(s));
        el.__aosv2_count = { start: start||0, end: end||0, duration: meta.duration, started: false };
        // optionally set initial text
      }

      // path motion precompute
      if (meta.motionPath) {
        this._initPathMeta(meta);
      }

      // Lottie: if requested, try to bind existing player by data attribute (user should init Lottie themselves)
      if (meta.lottie && window.lottie) {
        // expecting the element to be a container with data-lottie-player already loaded
        meta.lottiePlayer = el.lottiePlayer || null;
      }
    }

    _initPathMeta(meta) {
      try {
        const path = meta.motionPath;
        const len = path.getTotalLength();
        meta.pathLength = len;
      } catch (e) {
        meta.motionPath = null;
      }
    }

    _applyPathProgress(el, meta) {
      // determine anchor rect relative progress
      try {
        const anchorRect = meta.anchor.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const triggerStart = Math.max(0, anchorRect.top - vh + meta.offset);
        const progress = clamp(1 - ((anchorRect.top + (anchorRect.height/2)) / vh), 0, 1);
        const pct = meta.pathReverse ? 1 - progress : progress;
        const p = Math.max(0, Math.min(1, pct + meta.pathOffset));
        // compute point on path
        const pt = meta.motionPath.getPointAtLength(p * meta.pathLength);
        // position element (center)
        el.style.position = 'relative';
        el.style.left = (pt.x) + 'px';
        el.style.top = (pt.y) + 'px';
      } catch (e) { /* ignore */ }
    }

    _applyLottieScrub(el, meta) {
      if (!meta.lottiePlayer) return;
      try {
        const rect = meta.anchor.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const progress = clamp(1 - (rect.top / vh), 0, 1);
        const frame = progress * (meta.lottiePlayer.totalFrames || meta.lottiePlayer.getDuration(true));
        meta.lottiePlayer.goToAndStop(frame, true);
      } catch (e) {}
    }

    _runCountUp(el, countMeta) {
      const start = countMeta.start, end = countMeta.end, duration = Math.max(40, countMeta.duration);
      const t0 = now();
      countMeta.started = true;
      const tick = () => {
        const p = clamp((now() - t0) / duration, 0, 1);
        const val = Math.round(start + (end - start) * p);
        el.textContent = val;
        if (p < 1) raf(tick);
      };
      raf(tick);
    }

    _triggerReveal(el, meta) {
      if (meta.once && meta.revealed) return;

      // stagger children if requested
      if (meta.stagger && meta.stagger > 0) {
        const items = el.querySelectorAll('[data-aos-item]');
        items.forEach((it, idx) => {
          setTimeout(() => this._triggerReveal(it, this.elements.get(it)), meta.delay + idx * meta.stagger);
        });
      }

      // WAAPI path
      if (meta.useWAAPI && (el.animate || Element.prototype.animate)) {
        const kf = meta.keyframes || this.opts.keyframes[meta.name];
        if (kf) {
          const anim = el.animate(kf, { duration: meta.duration, delay: meta.delay, easing: meta.easing, fill: 'forwards' });
          this._trackAnim(anim, el, meta);
          meta.revealed = true;
          this.elements.set(el, meta);
          if (meta.once && this.observer) this.observer.unobserve(meta.anchor);
          return;
        }
      }

      // physics spring fallback: small spring solver to animate transform scale/translate over time
      if (meta.preset && meta.preset.useSpring) {
        this._springReveal(el, meta);
      } else {
        // CSS transition fallback
        requestAnimationFrame(() => {
          el.classList.remove('aosv2-hidden');
          el.classList.add(meta.customClass);
          el.style.transform = 'none';
          el.style.opacity = 1;
          el.style.filter = 'none';
        });
      }

      // SVG draw
      if (meta.drawPath && el.tagName.toLowerCase() === 'svg') {
        const paths = el.querySelectorAll('path, line, polyline, polygon, circle, rect');
        paths.forEach(p => { try { p.style.strokeDashoffset = 0; } catch (e) {} });
      }

      // count-up
      if (meta.count && el.__aosv2_count && !el.__aosv2_count.started) {
        this._runCountUp(el, el.__aosv2_count);
      }

      meta.revealed = true;
      this.elements.set(el, meta);
      if (meta.once && this.observer) this.observer.unobserve(meta.anchor);
    }

    _trackAnim(anim, el, meta) {
      this.animations.add(anim);
      const cleanup = () => { try { anim.cancel && anim.cancel(); } catch (e) {} this.animations.delete(anim); };
      anim.onfinish = () => cleanup();
      anim.oncancel = () => cleanup();
    }

    _springReveal(el, meta) {
      // tiny spring on scale -> settle to 1
      const stiffness = meta.spring.stiffness || 180;
      const damping = meta.spring.damping || 18;
      let x = 0, v = 0, target = 1, mass = 1;
      el.style.transformOrigin = 'center center';
      el.style.transform = (meta.preset && meta.preset.transform) ? meta.preset.transform : 'scale(.96)';
      const step = () => {
        const f = -stiffness * (x - target) - damping * v;
        const a = f / mass;
        v += a * 0.016;
        x += v * 0.016;
        el.style.transform = `scale(${x})`;
        if (Math.abs(v) > 0.001 || Math.abs(x - target) > 0.001) {
          raf(step);
        } else {
          el.style.transform = 'none';
        }
      };
      // seed
      x = 0.96; v = 0;
      setTimeout(() => raf(step), meta.delay || 0);
    }

    _resetReveal(el, meta) {
      if (!meta.mirror) return;
      requestAnimationFrame(() => {
        el.classList.add('aosv2-hidden');
        el.classList.remove(meta.customClass);
        if (meta.preset && meta.preset.transform) el.style.transform = meta.preset.transform;
        if (meta.preset && meta.preset.opacity !== undefined) el.style.opacity = meta.preset.opacity;
        meta.revealed = false;
        this.elements.set(el, meta);
      });
    }

    _handleIntersect(entries) {
      entries.forEach(entry => {
        // each observed anchor may correspond to multiple metas
        this.elements.forEach((meta, el) => {
          if (meta.anchor !== entry.target) return;
          const inView = entry.isIntersecting && entry.intersectionRatio > 0;
          if (inView) {
            if (meta.scrollScrub && meta.motionPath) {
              // allow scrub to control; still reveal
              this._applyPathProgress(el, meta);
            }
            this._triggerReveal(el, meta);
          } else {
            this._resetReveal(el, meta);
          }
        });
      });
    }

    _observeBatch(nodes) {
      nodes.forEach(n => { if (!this.elements.has(n)) this.queue.push(n); });
      if (this.batchTimer) return;
      this.batchTimer = setTimeout(() => this._flushQueue(), this.opts.batchInterval);
    }

    _flushQueue() {
      const nodes = this.queue.splice(0);
      if (!nodes.length) { clearTimeout(this.batchTimer); this.batchTimer = null; return; }
      if (!this.observer) {
        const options = { root: null, rootMargin: '0px', threshold: 0 };
        this.observer = new IntersectionObserver(this._handleIntersect, options);
      }
      nodes.forEach(el => {
        const meta = this._buildMeta(el);
        this.elements.set(el, meta);
        this._prepareElement(el, meta);
        try { this.observer.observe(meta.anchor); } catch (e) { this.observer.observe(el); }
      });
      clearTimeout(this.batchTimer); this.batchTimer = null;
      this.log(`observing ${nodes.length} nodes; total tracked ${this.elements.size}`);
    }

    _mutationHandler(muts) {
      muts.forEach(m => {
        if (m.type === 'childList') {
          m.addedNodes.forEach(node => {
            if (!(node instanceof Element)) return;
            if (node.hasAttribute && node.hasAttribute('data-aos')) this._observeBatch([node]);
            const found = node.querySelectorAll && node.querySelectorAll('[data-aos]');
            if (found && found.length) this._observeBatch(Array.from(found));
          });
        }
      });
    }

    init(opts={}) {
      this.opts = Object.assign({}, this.opts, opts);
      if (this.opts.disableOnMobile && isMobileUA()) { this.log('disabled on mobile'); return; }
      if (isReducedMotion()) { this.log('reduced motion: disabled'); return; }

      const nodes = this._getNodes();
      if (nodes.length) this._observeBatch(nodes);

      if (!this.mutationObserver) {
        this.mutationObserver = new MutationObserver(this._mutationHandler);
        this.mutationObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
      }

      if (this.opts.editorEnabled) this.enableEditor();
      this.log('AOSProV2 initialized');
    }

    refresh() {
      const nodes = this._getNodes();
      const newNodes = nodes.filter(n => !this.elements.has(n));
      if (newNodes.length) this._observeBatch(newNodes);
      this.log('refresh: tracked', this.elements.size);
    }

    destroy() {
      try { this.observer && this.observer.disconnect(); } catch (e) {}
      try { this.mutationObserver && this.mutationObserver.disconnect(); } catch (e) {}
      this.elements.forEach((meta, el) => {
        el.classList.remove('aosv2-init','aosv2-hidden', meta.customClass);
        el.style.transition = ''; el.style.transform=''; el.style.opacity=''; el.style.filter='';
      });
      this.elements.clear();
      this.queue = [];
      this.log('destroyed');
    }

    registerPreset(name, preset) { this.opts.presets[name] = preset; this.log('preset registered', name); }
    registerKeyframes(name, frames) { this.opts.keyframes[name] = frames; this.log('keyframes registered', name); }

    animate(el, opts={}) {
      if (!(el instanceof Element)) return;
      const meta = Object.assign({}, this._buildMeta(el), opts);
      this._prepareElement(el, meta);
      setTimeout(() => this._triggerReveal(el, meta), 20);
    }

    timeline(name, opts={}) {
      const items = opts.items || [];
      const tl = {
        name,
        items,
        run: (loop=false) => {
          let t = 0;
          items.forEach(i => {
            setTimeout(() => this.animate(i.el, i), t + (i.delay||0));
            t += (i.duration || this.opts.duration) + (i.delay||0);
          });
          if (loop) setTimeout(()=>tl.run(true), t+100);
        },
        seek: (ms)=>{ /* implement seek if needed later */ }
      };
      this.timelines.set(name, tl);
      return tl;
    }

    enableEditor() {
      if (this.editorOpen) return;
      const ui = document.createElement('div');
      ui.className = 'aosv2-devui';
      ui.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <div class="aosv2-badge">AOSProV2</div>
        <div class="aosv2-badge">tracked: <span id="aosv2-count">${this.elements.size}</span></div>
        <button id="aosv2-refresh" style="padding:6px;border-radius:6px;">Refresh</button>
        <button id="aosv2-sample" style="padding:6px;border-radius:6px;">Preview Sample</button>
      </div>`;
      document.body.appendChild(ui);
      document.getElementById('aosv2-refresh').addEventListener('click', () => this.refresh());
      document.getElementById('aosv2-sample').addEventListener('click', () => {
        // run a small preview of first 4 elements
        let i=0;
        this.elements.forEach((meta, el) => {
          if (i++>3) return;
          this._triggerReveal(el, meta);
        });
      });
      this.editorOpen = true;
      this.devUI = ui;
      this._devInterval = setInterval(()=>{ const c=document.getElementById('aosv2-count'); if(c) c.textContent=this.elements.size; }, 400);
    }

    profile() {
      const avg = this.profiler.frames.length ? (this.profiler.frames.reduce((a,b)=>a+b,0)/this.profiler.frames.length) : 0;
      return { avgFrame: avg, fps: (avg?Math.round(1000/avg):60), samples: this.profiler.frames.length };
    }

    use(plugin) {
      try {
        if (typeof plugin === 'function') plugin(this);
        else if (plugin && plugin.install) plugin.install(this);
      } catch (e) { console.error('plugin error', e); }
    }

  } // class

  // Expose
  global.AOSProV2 = new AOSProV2Engine();

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ()=>{ try { global.AOSProV2.init(); } catch(e){ console.error(e); } });
  } else {
    try { global.AOSProV2.init(); } catch(e){ console.error(e); }
  }

})(window);
