/**
 * microAOS - JS-only scroll animation framework
 * Single-file. Drop into page and call AOS.init(options).
 *
 * Features implemented:
 * - Many entrance animations (fade, slide, zoom, flip, zoom-in-up, etc.)
 * - Attention seekers (bounce, tada, pulse, shake, pop, swing, rubber-band)
 * - Modern effects (blur-in, glow-in, clip-in, clip-in-vertical, flip-3d, rotate-3d-in)
 * - Typewriter for text, line-reveal, swash-in
 * - Stagger support for children via data-aos-stagger
 * - SVG path draw support via data-aos="draw-path"
 * - Exit animations and scroll-up reverse
 * - Parallax via data-aos-parallax-speed
 * - Options: duration, delay, easing, offset, once
 * - Uses IntersectionObserver; falls back gracefully
 * - Honors prefers-reduced-motion
 *
 * Usage: include script then AOS.init({ once: true, offset: 120 });
 */

(function (global) {
  'use strict';

  const defaultOptions = {
    offset: 120, // px before element enters viewport
    duration: 600, // default duration ms
    delay: 0,
    easing: 'cubic-bezier(.22,.9,.26,1)', // nice ease-out-ish
    once: false, // animate only once
    mirror: true, // animate out when scrolling back up
    staggerDelay: 80, // default stagger between children (ms)
    root: null,
    rootMargin: '0px',
    threshold: 0.15,
    reduceMotion: true, // respect prefers-reduced-motion
  };

  // Small helpful set of animation types and their initial/final style generators.
  const ANIMATIONS = {
    // Fade family
    'fade': ({dir}) => ({ from: { opacity: 0, transform: 'none' }, to: { opacity: 1 } }),
    'fade-up': ({offsetY=20}) => ({ from: { opacity: 0, transform: `translateY(${offsetY}px)` }, to: { opacity: 1, transform: 'translateY(0)' } }),
    'fade-down': ({offsetY=20}) => ({ from: { opacity: 0, transform: `translateY(-${offsetY}px)` }, to: { opacity: 1, transform: 'translateY(0)' } }),
    'fade-left': ({offsetX=20}) => ({ from: { opacity: 0, transform: `translateX(${offsetX}px)` }, to: { opacity: 1, transform: 'translateX(0)' } }),
    'fade-right': ({offsetX=20}) => ({ from: { opacity: 0, transform: `translateX(-${offsetX}px)` }, to: { opacity: 1, transform: 'translateX(0)' } }),

    // Slide family (more pronounced)
    'slide-up': ({offsetY=30}) => ({ from: { opacity: 0, transform: `translateY(${offsetY}px)` }, to: { opacity: 1, transform: 'translateY(0)' } }),
    'slide-down': ({offsetY=30}) => ({ from: { opacity: 0, transform: `translateY(-${offsetY}px)` }, to: { opacity: 1, transform: 'translateY(0)' } }),
    'slide-left': ({offsetX=40}) => ({ from: { opacity: 0, transform: `translateX(${offsetX}px)` }, to: { opacity: 1, transform: 'translateX(0)' } }),
    'slide-right': ({offsetX=40}) => ({ from: { opacity: 0, transform: `translateX(-${offsetX}px)` }, to: { opacity: 1, transform: 'translateX(0)' } }),

    // Zoom
    'zoom-in': ({s=0.85}) => ({ from: { opacity: 0, transform: `scale(${s})` }, to: { opacity: 1, transform: 'scale(1)' } }),
    'zoom-in-up': ({s=0.9, offsetY=20}) => ({ from: { opacity: 0, transform: `scale(${s}) translateY(${offsetY}px)` }, to: { opacity: 1, transform: 'scale(1) translateY(0)' } }),
    'zoom-in-down': ({s=0.9, offsetY=20}) => ({ from: { opacity: 0, transform: `scale(${s}) translateY(-${offsetY}px)` }, to: { opacity: 1, transform: 'scale(1) translateY(0)' } }),
    'zoom-in-left': ({s=0.9, offsetX=20}) => ({ from: { opacity: 0, transform: `scale(${s}) translateX(${offsetX}px)` }, to: { opacity: 1, transform: 'scale(1) translateX(0)' } }),
    'zoom-in-right': ({s=0.9, offsetX=20}) => ({ from: { opacity: 0, transform: `scale(${s}) translateX(-${offsetX}px)` }, to: { opacity: 1, transform: 'scale(1) translateX(0)' } }),
    'zoom-out': ({s=1.05}) => ({ from: { opacity: 0, transform: `scale(${s})` }, to: { opacity: 1, transform: 'scale(1)' } }),

    // Attention seekers
    'flip': ({}) => ({ from: { opacity: 0, transform: 'rotateY(90deg)' }, to: { opacity: 1, transform: 'rotateY(0)' } }),
    'flip-up': ({}) => ({ from: { opacity: 0, transform: 'rotateX(75deg)' }, to: { opacity: 1, transform: 'rotateX(0)' } }),
    'flip-down': ({}) => ({ from: { opacity: 0, transform: 'rotateX(-75deg)' }, to: { opacity: 1, transform: 'rotateX(0)' } }),
    'flip-left': ({}) => ({ from: { opacity: 0, transform: 'rotateY(75deg)' }, to: { opacity: 1, transform: 'rotateY(0)' } }),
    'flip-right': ({}) => ({ from: { opacity: 0, transform: 'rotateY(-75deg)' }, to: { opacity: 1, transform: 'rotateY(0)' } }),

    // Pop & bounce-ish (we'll simulate through scale + translate)
    'bounce': ({}) => ({ from: { opacity: 0, transform: 'scale(.95)' }, to: { opacity: 1, transform: 'scale(1)' } }),
    'bounce-in': ({}) => ({ from: { opacity: 0, transform: 'scale(.7)' }, to: { opacity: 1, transform: 'scale(1)' } }),
    'tada': ({}) => ({ from: { opacity: 0, transform: 'scale(.9) rotate(-4deg)' }, to: { opacity: 1, transform: 'scale(1) rotate(0)' } }),
    'pulse': ({}) => ({ from: { opacity: 1, transform: 'scale(1)' }, to: { opacity: 1, transform: 'scale(1.02)' } }),
    'rubber-band': ({}) => ({ from: { opacity: 0, transform: 'scale(.8)' }, to: { opacity: 1, transform: 'scale(1)' } }),
    'shake': ({}) => ({ from: { opacity: 1, transform: 'translateX(0)' }, to: { opacity: 1, transform: 'translateX(0)' } }), // we'll animate using keyframes below
    'pop': ({}) => ({ from: { opacity: 0, transform: 'scale(.6)' }, to: { opacity: 1, transform: 'scale(1)' } }),
    'swing': ({}) => ({ from: { opacity: 0, transform: 'rotate(-8deg)' }, to: { opacity: 1, transform: 'rotate(0)' } }),

    // Modern & advanced
    'blur-in': ({}) => ({ from: { opacity: 0, filter: 'blur(8px)' }, to: { opacity: 1, filter: 'blur(0)' } }),
    'blur-out': ({}) => ({ from: { opacity: 1, filter: 'blur(0)' }, to: { opacity: 0, filter: 'blur(6px)' } }),
    'glow-in': ({}) => ({ from: { opacity: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' }, to: { opacity: 1, boxShadow: '0 8px 30px rgba(0,0,0,.12)' } }),
    'clip-in': ({}) => ({ from: { opacity: 0, clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)' }, to: { opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' } }),
    'clip-in-vertical': ({}) => ({ from: { opacity: 0, clipPath: 'inset(50% 0 50% 0)' }, to: { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' } }),
    'clip-in-horizontal': ({}) => ({ from: { opacity: 0, clipPath: 'inset(0 50% 0 50%)' }, to: { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)' } }),
    'flip-3d': ({}) => ({ from: { opacity: 0, transform: 'perspective(800px) rotateY(90deg)' }, to: { opacity: 1, transform: 'perspective(800px) rotateY(0deg)' } }),
    'flip-3d-vertical': ({}) => ({ from: { opacity: 0, transform: 'perspective(900px) rotateX(90deg)' }, to: { opacity: 1, transform: 'perspective(900px) rotateX(0deg)' } }),
    'flip-3d-horizontal': ({}) => ({ from: { opacity: 0, transform: 'perspective(900px) rotateY(90deg)' }, to: { opacity: 1, transform: 'perspective(900px) rotateY(0deg)' } }),
    'rotate-3d-in': ({}) => ({ from: { opacity: 0, transform: 'perspective(900px) rotate3d(1,1,0,45deg)' }, to: { opacity: 1, transform: 'perspective(900px) rotate3d(0,0,0,0deg)' } }),

    // Text animations are handled specially
    'typewriter': null,
    'line-reveal': null,
    'swash-in': null,

    // Exit placeholders (we reverse where appropriate)
    'fade-out': ({offsetY=10}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: `translateY(-${offsetY}px)` } }),
    'fade-out-up': ({offsetY=20}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: `translateY(-${offsetY}px)` } }),
    'fade-out-down': ({offsetY=20}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: `translateY(${offsetY}px)` } }),
    'slide-out-up': ({offsetY=30}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: `translateY(-${offsetY}px)` } }),
    'slide-out-down': ({offsetY=30}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: `translateY(${offsetY}px)` } }),
    'zoom-out': ({s=1.05}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: `scale(${s})` } }),
    'flip-out': ({}) => ({ from: { opacity: 1 }, to: { opacity: 0, transform: 'rotateY(90deg)' } }),

    // Draw path for SVGs handled specially
    'draw-path': null,
    // More can be added...
  };

  function extend(a, b) {
    const out = {};
    for (let k in a) out[k] = a[k];
    for (let k in b) out[k] = b[k];
    return out;
  }

  // Helpers
  function px(n) { return (typeof n === 'number') ? `${n}px` : n; }
  function isReducedMotionAllowed() {
    if (!window.matchMedia) return true;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function applyStyles(el, styles) {
    for (let k in styles) {
      try { el.style[k] = styles[k]; } catch (e) { /* skip invalid */ }
    }
  }

  function setTransition(el, duration, easing, delay, properties = 'opacity,transform') {
    // Use hardware-accelerated properties only typically: transform, opacity, filter
    el.style.transition = `${properties} ${duration}ms ${easing} ${delay}ms`;
    el.style.willChange = properties;
  }

  function clearTransition(el) {
    el.style.transition = '';
    // keep will-change maybe
  }

  // For keyframe-like attention seekers we create CSS @keyframes dynamically once
  let _styleInjected = false;
  function injectGlobalStyles() {
    if (_styleInjected) return;
    _styleInjected = true;
    const css = `
      .aos-initial-hidden { opacity: 0; }
      .aos-visible { opacity: 1; }
      @keyframes aos-shake { 0% { transform: translateX(0) } 10% { transform: translateX(-6px) } 30% { transform: translateX(6px) } 50% { transform: translateX(-4px) } 70% { transform: translateX(4px) } 100% { transform: translateX(0) } }
      @keyframes aos-pulse { 0% { transform: scale(1)} 50% { transform: scale(1.03)} 100% { transform: scale(1)} }
      @keyframes aos-rubber { 0% { transform: scale(1)} 30% { transform: scale(1.25,0.85)} 50% { transform: scale(.9)} 65% { transform: scale(1.05)} 100% { transform: scale(1)} }
    `;
    const s = document.createElement('style');
    s.setAttribute('data-micro-aos', 'true');
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  // Typewriter helper: splits text nodes into spans and reveals with interval.
  function runTypewriter(el, duration, easing, delay) {
    // only run once per element
    if (el.__aosTypewriterDone) return;
    el.__aosTypewriterDone = true;

    const text = el.textContent.trim();
    el.textContent = '';
    const totalDuration = Math.max(200, duration || 800);
    const perChar = Math.max(10, Math.round(totalDuration / Math.max(1, text.length)));

    const fragment = document.createDocumentFragment();
    Array.from(text).forEach((ch) => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.style.opacity = 0;
      span.style.transition = `opacity ${perChar}ms linear`;
      fragment.appendChild(span);
    });
    el.appendChild(fragment);

    const spans = el.querySelectorAll('span');
    let i = 0;
    function revealNext() {
      if (i >= spans.length) return;
      spans[i].style.opacity = 1;
      i++;
      setTimeout(revealNext, perChar);
    }
    setTimeout(revealNext, delay || 0);
  }

  // SVG draw path
  function prepareSVGPath(el) {
    if (!(el instanceof SVGElement)) return;
    const paths = el.querySelectorAll('path, circle, rect, line, polyline, polygon');
    paths.forEach(p => {
      try {
        const len = p.getTotalLength ? p.getTotalLength() : (p.getBBox ? Math.max(p.getBBox().width, p.getBBox().height) : 100);
        p.style.strokeDasharray = len;
        p.style.strokeDashoffset = len;
        p.style.transition = `stroke-dashoffset var(--aos-duration, 600ms) var(--aos-easing, ease) var(--aos-delay, 0ms)`;
        p.style.strokeLinecap = p.style.strokeLinecap || 'round';
      } catch (e) {}
    });
  }
  function runSVGDraw(el) {
    const paths = el.querySelectorAll('path, circle, rect, line, polyline, polygon');
    paths.forEach(p => {
      try {
        p.style.strokeDashoffset = 0;
      } catch (e) {}
    });
  }
  function resetSVGDraw(el) {
    const paths = el.querySelectorAll('path, circle, rect, line, polyline, polygon');
    paths.forEach(p => {
      try {
        const len = p.getTotalLength ? p.getTotalLength() : (p.getBBox ? Math.max(p.getBBox().width, p.getBBox().height) : 100);
        p.style.strokeDashoffset = len;
      } catch (e) {}
    });
  }

  // Higher level worker for a single element
  function processElement(el, opts, observer) {
    // read attributes
    const anim = (el.getAttribute('data-aos') || '').trim();
    const duration = parseInt(el.getAttribute('data-aos-duration') || opts.duration, 10);
    const delay = parseInt(el.getAttribute('data-aos-delay') || opts.delay, 10);
    const easing = el.getAttribute('data-aos-easing') || opts.easing;
    const offset = parseInt(el.getAttribute('data-aos-offset') || opts.offset, 10);
    const onceAttr = el.getAttribute('data-aos-once');
    const once = onceAttr === 'true' ? true : (onceAttr === 'false' ? false : opts.once);
    const stagger = el.getAttribute('data-aos-stagger') === 'true';
    const staggerSelector = el.getAttribute('data-aos-stagger-selector') || null;
    const staggerDelay = parseInt(el.getAttribute('data-aos-stagger-delay') || opts.staggerDelay, 10);
    const exitAnim = el.getAttribute('data-aos-exit') || null;
    const parallax = parseFloat(el.getAttribute('data-aos-parallax-speed') || 0);
    const anchorSelector = el.getAttribute('data-aos-anchor') || null;

    // flag
    el.__aos = el.__aos || {};
    el.__aos.meta = { anim, duration, delay, easing, offset, once, stagger, staggerSelector, staggerDelay, exitAnim, parallax, anchorSelector };

    // prepare initial style depending on animation type
    function setInitialState() {
      // skip if reduced motion
      if (opts.reduceMotion && isReducedMotionAllowed()) {
        // make element visible with no heavy transforms
        el.style.opacity = 1;
        el.style.transform = 'none';
        return;
      }

      if (!anim) return;
      // special types
      if (anim === 'typewriter') {
        // hide text, keep block visible
        el.style.opacity = 1;
        el.style.whiteSpace = 'pre';
        el.style.overflow = 'hidden';
        el.style.display = el.style.display || 'inline-block';
      } else if (anim === 'draw-path') {
        // Prepare SVG children
        prepareSVGPath(el);
      }
      // generic: place initial transform/opacity per ANIMATIONS map
      const fn = ANIMATIONS[anim];
      if (fn) {
        const states = fn({});
        const init = states.from || {};
        applyStyles(el, {
          opacity: (init.opacity != null) ? init.opacity : (el.style.opacity || 0),
          transform: init.transform || (el.style.transform || 'none'),
        });
        // apply any other properties (filter, clipPath, boxShadow)
        ['filter','clipPath','boxShadow'].forEach(k => { if (init[k]) el.style[k] = init[k]; });
      } else {
        // If unknown or special, default to invisible
        el.style.opacity = el.style.opacity || 0;
      }

      // set transition variables via css variables used by svg draw
      el.style.setProperty('--aos-duration', `${duration}ms`);
      el.style.setProperty('--aos-easing', easing);
      el.style.setProperty('--aos-delay', `${delay}ms`);

      // global transition
      // For certain keyframe heavy animations (shake, pulse, rubber-band) we'll use animation instead of transition
      if (['shake','pulse','rubber-band'].includes(anim)) {
        // use CSS animation names we injected
        if (anim === 'shake') el.style.animation = `aos-shake ${Math.max(600,duration)}ms ${easing} ${delay}ms both`;
        if (anim === 'pulse') el.style.animation = `aos-pulse ${Math.max(800,duration)}ms ${easing} ${delay}ms both`;
        if (anim === 'rubber-band') el.style.animation = `aos-rubber ${Math.max(800,duration)}ms ${easing} ${delay}ms both`;
      } else {
        setTransition(el, duration, easing, delay, 'opacity,transform,filter,clip-path,box-shadow');
      }

      // ensure transform-origin for 3D flips
      if ((anim && anim.includes('flip')) || anim && anim.includes('rotate-3d')) {
        el.style.transformStyle = 'preserve-3d';
        el.style.backfaceVisibility = 'hidden';
      }

      el.classList.add('aos-initial-hidden');
    }

    function applyEntrance(doStagger=false, anchor=null) {
      if (opts.reduceMotion && isReducedMotionAllowed()) {
        el.style.opacity = 1;
        el.style.transform = 'none';
        clearTransition(el);
        return;
      }

      // if typewriter
      if (anim === 'typewriter') {
        // show container and run typewriter
        el.style.opacity = 1;
        runTypewriter(el, duration, easing, delay);
        return;
      }
      if (anim === 'draw-path') {
        // reveal svg draw
        runSVGDraw(el);
        el.style.opacity = 1;
        return;
      }

      const fn = ANIMATIONS[anim];
      let finalStyles = {};
      if (fn) {
        const states = fn({});
        finalStyles = states.to || {};
      } else {
        // default final
        finalStyles = { opacity: 1, transform: 'none' };
      }

      // if stagger and children
      if (el.__aos.meta && el.__aos.meta.stagger) {
        const selector = el.__aos.meta.staggerSelector || '[data-aos-child]';
        const children = selector === '[data-aos-child]' ? Array.from(el.children).filter(c=>c.hasAttribute('data-aos-child')) : Array.from(el.querySelectorAll(selector));
        children.forEach((child, idx) => {
          const d = (el.__aos.meta.staggerDelay || opts.staggerDelay) * idx;
          child.style.transitionDelay = `${d + (el.__aos.meta.delay || 0)}ms`;
          // apply final styles to child (keeping opacity/transform changes)
          child.style.opacity = finalStyles.opacity != null ? finalStyles.opacity : 1;
          if (finalStyles.transform) child.style.transform = finalStyles.transform;
          if (finalStyles.filter) child.style.filter = finalStyles.filter;
          if (finalStyles.clipPath) child.style.clipPath = finalStyles.clipPath;
        });
        // reveal parent quickly
        el.style.opacity = 1;
      } else {
        // normal element
        // remove initial hidden class
        el.classList.remove('aos-initial-hidden');
        // apply final styles (use empty-string fallback for properties intentionally unset)
        if (finalStyles.opacity != null) el.style.opacity = finalStyles.opacity;
        if (finalStyles.transform != null) el.style.transform = finalStyles.transform;
        if (finalStyles.filter != null) el.style.filter = finalStyles.filter;
        if (finalStyles.clipPath != null) el.style.clipPath = finalStyles.clipPath;
        if (finalStyles.boxShadow != null) el.style.boxShadow = finalStyles.boxShadow;
      }
    }

    function applyExit() {
      // handle exit animations (reverse or explicit)
      if (opts.reduceMotion && isReducedMotionAllowed()) {
        return;
      }
      const exit = exitAnim || inferExit(anim);
      if (!exit) return;
      const fn = ANIMATIONS[exit];
      if (exit === 'draw-path') {
        resetSVGDraw(el); return;
      }
      if (fn) {
        const states = fn({});
        const final = states.to || {};
        // apply final exit
        if (final.opacity != null) el.style.opacity = final.opacity;
        if (final.transform != null) el.style.transform = final.transform;
        if (final.filter != null) el.style.filter = final.filter;
      } else {
        // fallback: fade out
        el.style.opacity = 0;
        el.style.transform = 'translateY(-10px)';
      }
    }

    function inferExit(enterAnim) {
      if (!enterAnim) return 'fade-out';
      if (enterAnim.startsWith('fade')) return 'fade-out';
      if (enterAnim.startsWith('slide')) return 'slide-out-up';
      if (enterAnim.startsWith('zoom')) return 'zoom-out';
      if (enterAnim.includes('flip')) return 'flip-out';
      return 'fade-out';
    }

    setInitialState();

    return {
      setInitialState,
      applyEntrance,
      applyExit,
      meta: el.__aos.meta,
    };
  }

  // Create global observer and optional scroll listener for parallax
  const AOS = {
    _opts: {},
    _observer: null,
    _instances: new Map(),
    init(opts = {}) {
      injectGlobalStyles();
      this._opts = extend(defaultOptions, opts || {});
      const reduced = isReducedMotionAllowed();
      if (this._opts.reduceMotion && reduced) {
        // Make everything visible immediately if user prefers reduced motion
        Array.from(document.querySelectorAll('[data-aos]')).forEach(el => {
          el.style.opacity = 1;
          el.style.transform = 'none';
        });
        // still return object for API
      }

      // Build IntersectionObserver with rootMargin tuned by offset
      const root = this._opts.root;
      const rootMargin = this._opts.rootMargin;
      const threshold = this._opts.threshold;

      // Disconnect any previous observer
      if (this._observer) this._observer.disconnect();

      // Create observer callback
      const observerCb = (entries) => {
        entries.forEach(entry => {
          const el = entry.target;
          const inst = this._instances.get(el);
          if (!inst) return;

          const meta = inst.meta;
          const isVisible = entry.isIntersecting && entry.intersectionRatio > 0;
          // Trigger point: allow offset: we use boundingClientRect in viewport so anchor or threshold handles it
          if (isVisible) {
            // apply entrance (with stagger handled internally)
            inst.applyEntrance();
            // if once: unobserve
            if (meta.once) {
              this._observer.unobserve(el);
            }
          } else {
            // animate out if mirror true
            if (this._opts.mirror && !meta.once) {
              inst.applyExit();
            }
          }
        });
      };

      this._observer = new IntersectionObserver(observerCb, { root, rootMargin, threshold });

      // Find all elements with data-aos
      const elements = Array.from(document.querySelectorAll('[data-aos]'));
      elements.forEach(el => {
        // skip if reduced motion and configured
        const inst = processElement(el, this._opts, this._observer);
        this._instances.set(el, inst);

        // wait a tick then observe (so layout settles)
        try { this._observer.observe(el); } catch (e) { }
        // for SVG draw and typewriter we prepared earlier
      });

      // Parallax handling if any elements declare it
      this._setupParallax();

      // Optional: throttle resize to refresh observers if offsets change
      window.addEventListener('resize', throttle(() => this.refresh(), 200));
      return this;
    },

    refresh() {
      // re-process nodes (useful when DOM changes)
      // disconnect old
      if (this._observer) this._observer.disconnect();
      this._instances = new Map();
      return this.init(this._opts);
    },

    destroy() {
      if (this._observer) this._observer.disconnect();
      this._instances.forEach((v,k) => {
        // clear transitions
        clearTransition(k);
      });
      this._instances.clear();
    },

    _setupParallax() {
      // find elements that want parallax
      const parallaxEls = Array.from(document.querySelectorAll('[data-aos-parallax-speed]')).map(el => ({
        el,
        speed: parseFloat(el.getAttribute('data-aos-parallax-speed')) || 0
      })).filter(x => Math.abs(x.speed) > 0);

      if (!parallaxEls.length) return;

      // attach scroll listener
      const onScroll = throttle(() => {
        const vh = window.innerHeight;
        parallaxEls.forEach(({el, speed}) => {
          const rect = el.getBoundingClientRect();
          // center offset ratio: -1..1
          const centerOffset = ((rect.top + rect.height/2) - (vh/2)) / (vh/2);
          const translateY = Math.round(centerOffset * speed * 100); // px-ish
          el.style.transform = `translateY(${translateY}px)`;
        });
      }, 16);

      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll(); // initial
    }
  };

  // Utility: simple throttle
  function throttle(fn, wait) {
    let last = 0, timer = null;
    return function () {
      const now = Date.now();
      const args = arguments;
      if (now - last >= wait) {
        last = now;
        fn.apply(this, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(() => {
          last = Date.now();
          fn.apply(this, args);
        }, wait - (now - last));
      }
    };
  }

  // Expose
  global.AOS = AOS;

  // Auto-init if attribute present on DOMContentLoaded: <body data-aos-auto-init="true">
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const auto = document.body && document.body.getAttribute && document.body.getAttribute('data-aos-auto-init');
      if (auto === 'true') {
        AOS.init();
      }
    } catch (e) {}
  });

})(window);
