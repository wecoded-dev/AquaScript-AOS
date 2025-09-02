/* AOS-Ultimate v1.0 — Ultra-advanced AOS clone Single-file JavaScript framework that injects its own CSS and runs purely on JS + CSS. Features:

Many built-in animations (fade, slide, zoom, flip, rotate, bounce, pulse, mask reveal, staggered children, SVG draw support)

Per-element options via data attributes (data-aos, data-aos-duration, data-aos-delay, data-aos-easing, data-aos-offset, data-aos-once, data-aos-mirror, data-aos-anchor, data-aos-stagger, data-aos-anchor-placement)

Global config override on init

Staggered children support and "once" / "mirror" behavior

API: AOSUltimate.init(opts), .refresh(), .destroy(), .register(name, cssRules)

Works with dynamically added nodes: call refresh() after injecting


USAGE:

1. Save this file as aos-ultimate.js and include with <script type="module"> or normal script.


2. Call AOSUltimate.init() after DOM is ready.


3. In HTML: <div data-aos="fade-up" data-aos-duration="800" data-aos-delay="100" data-aos-offset="120">...</div>


4. For stagger: parent with data-aos="stagger" and data-aos-stagger="80" and child elements with data-aos-child



Example HTML (copy into an HTML file) is included at the bottom of this file in a commented block. */

(function (global) { const DEFAULTS = { duration: 700, delay: 0, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', offset: 120, once: true, mirror: false, anchorPlacement: 'top-bottom', // top-bottom | center-bottom etc throttleDelay: 50, };

// CSS that will be injected. Uses CSS variables for per-element overrides. const INJECTED_CSS = ` :root{--aos-default-duration:700ms;--aos-default-easing:cubic-bezier(0.2,0.8,0.2,1);} [data-aos]{opacity:0;transform-origin:center center;transition-property:opacity,transform,filter,clip-path;transition-timing-function:var(--aos-easing, ${DEFAULTS.easing});transition-duration:var(--aos-duration, ${DEFAULTS.duration}ms);will-change:transform,opacity;} [data-aos].aos-animate{opacity:1;}

/* Basic fades */ [data-aos="fade"]{transform:translateY(0) scale(1);} [data-aos="fade-up"]{transform:translateY(16px);} [data-aos="fade-down"]{transform:translateY(-16px);} [data-aos="fade-left"]{transform:translateX(16px);} [data-aos="fade-right"]{transform:translateX(-16px);} [data-aos].aos-animate[data-aos="fade-up"]{transform:translateY(0);} [data-aos].aos-animate[data-aos="fade-down"]{transform:translateY(0);} [data-aos].aos-animate[data-aos="fade-left"]{transform:translateX(0);} [data-aos].aos-animate[data-aos="fade-right"]{transform:translateX(0);}

/* Slide */ [data-aos="slide-up"]{transform:translateY(30px);} [data-aos="slide-down"]{transform:translateY(-30px);} [data-aos="slide-left"]{transform:translateX(30px);} [data-aos="slide-right"]{transform:translateX(-30px);} [data-aos].aos-animate[data-aos^="slide"]{transform:translate(0,0);}

/* Zoom */ [data-aos="zoom-in"]{transform:scale(0.85);} [data-aos="zoom-out"]{transform:scale(1.15);} [data-aos].aos-animate[data-aos^="zoom"]{transform:scale(1);}

/* Rotate / flip */ [data-aos="flip-x"]{transform:rotateX(20deg) perspective(600px);} [data-aos="flip-y"]{transform:rotateY(20deg) perspective(600px);} [data-aos].aos-animate[data-aos^="flip"]{transform:rotateX(0) rotateY(0);}

/* Attention */ [data-aos="pulse"]{transform:scale(0.98);} [data-aos].aos-animate[data-aos="pulse"]{animation:__aos_pulse var(--aos-duration,700ms) infinite;} @keyframes __aos_pulse{0%{transform:scale(0.98)}50%{transform:scale(1.02)}100%{transform:scale(0.98)}}

[data-aos="shake"]{transform:translateX(0);} [data-aos].aos-animate[data-aos="shake"]{animation:__aos_shake calc(var(--aos-duration,700ms) * 0.8) 1 linear;} @keyframes __aos_shake{0%{transform:translateX(-6px)}25%{transform:translateX(6px)}50%{transform:translateX(-4px)}75%{transform:translateX(4px)}100%{transform:translateX(0)}}

/* Mask reveal (requires element overflow hidden or mask container) */ [data-aos="mask-reveal"]{--mask-pos: -120%;} [data-aos="mask-reveal"]::before{content:"";position:absolute;inset:0;background:var(--mask-color,white);transform:translateX(var(--mask-pos));transition:transform var(--aos-duration,700ms) var(--aos-easing, ${DEFAULTS.easing});pointer-events:none} [data-aos].aos-animate[data-aos="mask-reveal"]::before{transform:translateX(120%)}

/* SVG draw helper (.svg path should have stroke-dasharray set via JS) */ [data-aos="svg-draw"]{opacity:1;}

/* Stagger helper: children with [data-aos-child] will use inline transition-delay styles injected by JS */

/* Accessibility: reduce motion fallback */ @media (prefers-reduced-motion: reduce){ [data-aos]{transition:none !important;animation:none !important;} [data-aos]::before{transition:none !important} } `;

class AOSUltimateClass { constructor(opts = {}) { this.opts = Object.assign({}, DEFAULTS, opts); this.selector = '[data-aos]'; this.observer = null; this.animated = new WeakSet(); this.registered = {}; // for user-registered animation rules (not used in CSS injection here but kept for API) this.nodes = []; this._onIntersect = this._onIntersect.bind(this); this._mutationObserver = null; this._injected = false; }

injectCSS() {
  if (this._injected) return;
  const s = document.createElement('style');
  s.setAttribute('data-aos-ultimate', '');
  s.innerHTML = INJECTED_CSS;
  document.head.appendChild(s);
  this._injected = true;
}

parseOptions(el) {
  return {
    duration: parseInt(el.getAttribute('data-aos-duration')) || this.opts.duration,
    delay: parseInt(el.getAttribute('data-aos-delay')) || this.opts.delay,
    easing: el.getAttribute('data-aos-easing') || this.opts.easing,
    offset: parseInt(el.getAttribute('data-aos-offset')) || this.opts.offset,
    once: this._parseBool(el.getAttribute('data-aos-once'), this.opts.once),
    mirror: this._parseBool(el.getAttribute('data-aos-mirror'), this.opts.mirror),
    anchor: el.getAttribute('data-aos-anchor') || null,
    anchorPlacement: el.getAttribute('data-aos-anchor-placement') || this.opts.anchorPlacement,
    stagger: parseInt(el.getAttribute('data-aos-stagger')) || 0,
    iteration: el.getAttribute('data-aos-iteration') || 1,
  };
}

_parseBool(val, fallback) {
  if (val === null || val === undefined) return fallback;
  return String(val) === 'true' || String(val) === '';
}

_setStyleVars(el, options) {
  el.style.setProperty('--aos-duration', options.duration + 'ms');
  el.style.setProperty('--aos-easing', options.easing);
  el.style.setProperty('--aos-delay', options.delay + 'ms');
  el.style.setProperty('--aos-iteration', options.iteration);
}

_prepareSVG(el) {
  // If element is svg path and data-aos="svg-draw"
  try {
    if (el.tagName.toLowerCase() === 'svg') {
      const paths = el.querySelectorAll('path, circle, line, polyline, polygon');
      paths.forEach(p => {
        const len = p.getTotalLength ? p.getTotalLength() : 0;
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        p.style.transition = `stroke-dashoffset var(--aos-duration, ${this.opts.duration}ms) var(--aos-easing, ${this.opts.easing})`;
      });
    }
  } catch (e) { /* ignore */ }
}

observe() {
  if (!('IntersectionObserver' in window)) {
    // fallback: animate everything immediately
    this.nodes.forEach((n) => this._doAnimate(n));
    return;
  }

  const rootMargin = `0px 0px -${this.opts.offset}px 0px`;
  this.observer = new IntersectionObserver(this._onIntersect, {
    root: null,
    rootMargin: rootMargin,
    threshold: this._buildThresholds(),
  });

  this.nodes.forEach(node => {
    this.observer.observe(node);
  });
}

_buildThresholds() {
  // use an array for smoother intersection detection
  const t = [];
  for (let i = 0; i <= 1.0; i += 0.05) t.push(i);
  return t;
}

_onIntersect(entries) {
  entries.forEach(entry => {
    const el = entry.target;
    const opts = this.parseOptions(el);
    // only run if entry is intersecting
    if (entry.isIntersecting) {
      // handle stagger parent
      if (el.hasAttribute('data-aos') && el.getAttribute('data-aos') === 'stagger') {
        this._animateStagger(el, opts);
      } else {
        // normal element: apply style vars then animate
        this._setStyleVars(el, opts);
        this._prepareSVG(el);
        // apply delay via inline style for better control
        if (opts.delay) el.style.transitionDelay = opts.delay + 'ms';
        if (opts.duration) el.style.transitionDuration = opts.duration + 'ms';
        // mark animate
        el.classList.add('aos-animate');
        // svg draw
        if (el.getAttribute('data-aos') === 'svg-draw') this._startSVGDraw(el);
        // if once, unobserve
        if (opts.once) {
          this._stopObserving(el);
        } else {
          // if mirror: when leaving viewport hide again; that is handled by IntersectionObserver's exit
        }
      }
    } else {
      // leaving the viewport
      const optsExit = this.parseOptions(el);
      if (!optsExit.once && optsExit.mirror) {
        // remove animate class to allow replays
        el.classList.remove('aos-animate');
        // reset svg
        if (el.getAttribute('data-aos') === 'svg-draw') this._resetSVGDraw(el);
      }
    }
  });
}

_startSVGDraw(svgEl) {
  if (svgEl.tagName.toLowerCase() === 'svg') {
    const paths = svgEl.querySelectorAll('path, circle, line, polyline, polygon');
    paths.forEach(p => {
      requestAnimationFrame(() => p.style.strokeDashoffset = '0');
    });
  }
}
_resetSVGDraw(svgEl) {
  if (svgEl.tagName.toLowerCase() === 'svg') {
    const paths = svgEl.querySelectorAll('path, circle, line, polyline, polygon');
    paths.forEach(p => {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      p.style.strokeDashoffset = len;
    });
  }
}

_animateStagger(parent, opts) {
  const children = Array.from(parent.querySelectorAll('[data-aos-child]'));
  const baseDelay = opts.delay || 0;
  const stagger = opts.stagger || 60;
  children.forEach((c, i) => {
    const d = baseDelay + i * stagger;
    c.style.transitionDelay = d + 'ms';
    this._setStyleVars(c, opts);
    c.classList.add('aos-animate');
  });
  if (opts.once) this._stopObserving(parent);
}

_stopObserving(el) {
  try { if (this.observer) this.observer.unobserve(el); } catch (e) {}
}

_doAnimate(el) {
  const opts = this.parseOptions(el);
  this._setStyleVars(el, opts);
  el.classList.add('aos-animate');
  if (el.getAttribute('data-aos') === 'svg-draw') this._startSVGDraw(el);
}

scan() {
  this.nodes = Array.from(document.querySelectorAll(this.selector));
  // prepare SVGs
  this.nodes.forEach(n => this._prepareSVG(n));
}

// Public API
init(opts = {}) {
  Object.assign(this.opts, opts);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => this._init());
  } else {
    this._init();
  }
  return this;
}

_init() {
  this.injectCSS();
  this.scan();
  this.observe();
  this._attachMutationObserver();
}

refresh() {
  // re-scan nodes (useful when new elements added)
  if (this.observer) {
    // unobserve previous
    this.nodes.forEach(n => { try { this.observer.unobserve(n); } catch(e){} });
  }
  this.scan();
  if (this.observer) {
    this.nodes.forEach(n => this.observer.observe(n));
  } else {
    this.observe();
  }
}

destroy() {
  if (this.observer) this.observer.disconnect();
  if (this._mutationObserver) this._mutationObserver.disconnect();
  // remove added classes and css
  this.nodes.forEach(n => { n.classList.remove('aos-animate'); });
  const injected = document.querySelector('style[data-aos-ultimate]');
  if (injected) injected.remove();
  this._injected = false;
}

register(name, cssRuleString) {
  // allow registering extra CSS rules for new animations
  this.registered[name] = cssRuleString;
  const s = document.querySelector('style[data-aos-ultimate]');
  if (s) s.innerHTML += '\n' + cssRuleString;
}

_attachMutationObserver() {
  if (!('MutationObserver' in window)) return;
  this._mutationObserver = new MutationObserver((mutations) => {
    let needs = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) needs = true;
    }
    if (needs) {
      // small debounce
      clearTimeout(this._moTimer);
      this._moTimer = setTimeout(() => this.refresh(), 80);
    }
  });
  this._mutationObserver.observe(document.body, { childList: true, subtree: true });
}

}

// Expose singleton const AOSUltimate = new AOSUltimateClass(); // attach to global global.AOSUltimate = AOSUltimate;

// Auto-init if script has data-auto-init if (document && document.currentScript && document.currentScript.getAttribute('data-auto-init') === 'true') { AOSUltimate.init(); }

// ------------------------- // Example HTML usage (copy-paste into an .html file to test) // ------------------------- /* <!doctype html>

  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>AOS-Ultimate Demo</title>
    <style>
      body{font-family:Inter,system-ui,Arial;padding:40px;}
      .card{background:white;border-radius:12px;padding:24px;margin:24px 0;box-shadow:0 8px 30px rgba(10,10,20,0.06);}
      .stagger-row{display:flex;gap:16px}
      .stagger-row .item{flex:1;padding:16px;background:linear-gradient(135deg,#f8fbff,#eef7ff);border-radius:8px}
    </style>
  </head>
  <body>  <h1 data-aos="fade-up" data-aos-duration="900">AOS-Ultimate — Demo</h1>  <div class="card" data-aos="slide-left" data-aos-duration="800" data-aos-delay="60">Slide left card</div>  <div class="card" data-aos="zoom-in" data-aos-duration="900">Zoom in card</div>  <div class="card" data-aos="mask-reveal" data-aos-duration="900" style="position:relative;overflow:hidden">Mask reveal content</div>  <div data-aos="stagger" data-aos-stagger="120" data-aos-duration="700">
    <div class="stagger-row">
      <div class="item" data-aos-child data-aos="fade-up">One</div>
      <div class="item" data-aos-child data-aos="fade-up">Two</div>
      <div class="item" data-aos-child data-aos="fade-up">Three</div>
    </div>
  </div>  <svg data-aos="svg-draw" width="200" height="80" viewBox="0 0 200 80" fill="none" stroke="#0b74de" stroke-width="2">
    <path d="M10 60 C 40 10, 160 10, 190 60" />
  </svg>  <script src="/path/to/aos-ultimate.js"></script>  <script> AOSUltimate.init(); </script>  </body>
  </html>
  */})(window);

