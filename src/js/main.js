import { App as CapApp } from '@capacitor/app';
/* ============================================================================
   NEXUS — MILESTONE 1: JS FOUNDATION
   Namespaced architecture. Feature modules are registered in later milestones.
   ============================================================================ */
'use strict';

const NEXUS = (() => {
  /* --- CONFIG ------------------------------------------------------------ */
  const CONFIG = Object.freeze({
    app: 'NEXUS',
    tagline: 'Your Life. In One Place.',
  });

  /* --- UTIL -------------------------------------------------------------- */
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null) return;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  };

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

  const fmt = n => Number(n || 0).toLocaleString('en-IN');
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const clock = s => {
    s = Math.max(0, Math.floor(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  /* Deterministic id helpers (stable across reloads for demo records). */
  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
  /* A real timestamp, in the one format the workspace stores. */
  const nowIso = () => new Date().toISOString();

  /* --- BYTES ⇄ BASE64 (M39) ----------------------------------------------
     An export is JSON, and a Blob does not survive JSON.stringify — it becomes
     `{}` and the file is lost. So file contents travel as base64 with their mime
     type. Chunked, because `String.fromCharCode.apply` blows the argument limit
     on anything larger than a toy file. */
  const B64_CHUNK = 0x8000;
  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += B64_CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + B64_CHUNK));
    }
    return btoa(bin);
  }
  function base64ToBytes(b64) {
    const bin = atob(String(b64 || ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  /* The exact byte length a base64 string decodes to — so a size can be DERIVED
     from the contents instead of being declared beside them. */
  function base64Bytes(b64) {
    const s = String(b64 || '');
    const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor(s.length * 3 / 4) - pad);
  }

  /* --- TOASTS ------------------------------------------------------------ */
  const Toast = {
    icons: {
      default: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>',
      good:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>',
      warn:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
      bad:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    },
    show(msg, kind = 'default', ms = 2600) {
      const stack = $('#toast-stack');
      if (!stack) return;
      const node = el('div', { class: `toast toast-${kind}` });
      node.innerHTML =
        `<span class="toast-ic">${this.icons[kind] || this.icons.default}</span><span>${esc(msg)}</span>`;
      stack.append(node);
      setTimeout(() => {
        node.classList.add('is-out');
        setTimeout(() => node.remove(), 220);
      }, ms);
    },
  };

  /* --- THEME ------------------------------------------------------------- */
  const THEMES = {
    midnight:  { label: 'Midnight',  pro: false },
    light:     { label: 'Light',     pro: false },
    cyber:     { label: 'Cyber',     pro: false  },
    aurora:    { label: 'Aurora',    pro: false  },
    nebula:    { label: 'Nebula',    pro: false  },
    obsidian:  { label: 'Obsidian',  pro: false  },
    violet:    { label: 'Violet',    pro: false  },
    monochrome:{ label: 'Monochrome',pro: false  },
  };
  const Theme = {
    key: 'nexus.theme',
    init() {
      let saved = null;
      try { saved = localStorage.getItem(this.key); } catch (_) {}
      this.apply(THEMES[saved] ? saved : 'midnight', { silent: true });
    },
    apply(name, { silent = false } = {}) {
      if (!THEMES[name]) return;
      const root = document.documentElement;
      /* Cross-fade the change instead of cutting to it. The class is removed the
         moment the transition is done, so no computed style is ever a moving
         target outside these 240ms — which is what makes this safe in an app
         whose every colour is asserted somewhere. */
      if (this._animT) clearTimeout(this._animT);
      root.classList.add('theme-anim');
      this._animT = setTimeout(() => root.classList.remove('theme-anim'), 260);
      root.dataset.theme = name;
      try { localStorage.setItem(this.key, name); } catch (_) {}
      // Mirror into Settings once it has been initialised (avoids TDZ on boot).
      if (Theme._onApply) Theme._onApply(name);
      document.dispatchEvent(new CustomEvent('nexus:theme', { detail: { name } }));
      if (!silent) Toast.show(`${THEMES[name].label} theme applied`, 'good');
    },
    _animT: null,
  };

  /* --- OVERLAY / MODAL --------------------------------------------------- */
  const Overlay = {
    root: null,
    init() { this.root = $('#overlay-root'); },
    open(html, { cls = '' } = {}) {
      this.close();
      const wrap = el('div', { class: 'overlay' });
      wrap.innerHTML = `<div class="modal ${cls}">${html}</div>`;
      wrap.addEventListener('mousedown', e => { if (e.target === wrap) this.close(); });
      /* `data-close` is handled HERE, once, for every overlay. It used to be
         bound by each modal individually — so a modal that forgot left its
         Cancel and ✕ buttons dead on screen. A visible control must always work. */
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) this.close(); });
      this.root.append(wrap);
      document.body.style.overflow = 'hidden';
      return wrap.firstElementChild;
    },
    /* Right-edge detail drawer (Milestone 16). Same contract as open(), but
       docks to the edge and fills the viewport height. */
    panel(html, { wide = false } = {}) {
      this.close();
      const wrap = el('div', { class: 'overlay is-panel' });
      wrap.innerHTML = `<aside class="panel ${wide ? 'panel-wide' : ''}" role="dialog" aria-modal="true">${html}</aside>`;
      wrap.addEventListener('mousedown', e => { if (e.target === wrap) this.close(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) this.close(); });
      this.root.append(wrap);
      document.body.style.overflow = 'hidden';
      return wrap.firstElementChild;
    },
    close() {
      if (!this.root) return;
      this.root.innerHTML = '';
      document.body.style.overflow = '';
    },
    get isOpen() { return !!(this.root && this.root.children.length); },
  };

  /* --- ROUTER ------------------------------------------------------------ */
  /* --- MOTION (Milestone 44) ---------------------------------------------
     The entrance pass and the scroll polish. Everything here is additive: if
     any of it throws or is unsupported, the page is already painted and correct
     and the only loss is the animation. `prefers-reduced-motion` short-circuits
     it to a no-op, so nothing is ever left hidden behind an animation that will
     not run. */
  const Motion = {
    _io: null,
    _ticking: false,

    reduced() {
      return !!(window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    /* Called once by the Router after a route paints.
       Cards already on screen are numbered and rise in sequence; cards below the
       fold are held until they are scrolled to. A card inside another card is
       skipped — animating a parent and its child doubles the travel and reads as
       a wobble rather than an entrance.

       Repaints deliberately do NOT come through here. An instant update is what
       makes editing feel responsive, and re-animating a list on every keystroke
       would be a fairground. */
    enter(root) {
      if (!root) return;
      const cards = $$('.card', root).filter(c => !(c.parentElement && c.parentElement.closest('.card')));
      if (this.reduced()) {
        cards.forEach(c => c.removeAttribute('data-mot'));
        this.navPill();
        return;
      }
      const vh = window.innerHeight || 900;
      let i = 0;
      cards.forEach(c => {
        if (c.getBoundingClientRect().top < vh - 40) {
          c.style.setProperty('--i', i++);
          c.setAttribute('data-mot', 'in');
        } else {
          c.setAttribute('data-mot', 'hold');
        }
      });
      this._observe(root);
      this.navPill();
    },

    _observe(root) {
      const held = $$('[data-mot="hold"]', root);
      if (!held.length) return;
      if (!('IntersectionObserver' in window)) {
        held.forEach(c => c.setAttribute('data-mot', 'in'));
        return;
      }
      if (!this._io) {
        this._io = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (!e.isIntersecting) return;
            e.target.style.removeProperty('--i');   // no stagger on a scroll reveal
            e.target.setAttribute('data-mot', 'in');
            this._io.unobserve(e.target);
          });
        }, { rootMargin: '0px 0px -40px 0px' });
      }
      held.forEach(c => this._io.observe(c));
    },

    /* The sidebar's active pill. ONE element that travels, positioned from the
       active item's own offset — so it is right at any width and after any
       scroll, and it never has to know how many groups the nav has. */
    navPill() {
      const nav = $('#sideNav');
      if (!nav) return;
      let pill = $('.nav-pill', nav);
      if (!pill) {
        pill = el('i', { class: 'nav-pill is-off' });
        nav.insertBefore(pill, nav.firstChild);
      }
      const active = $('.nav-item.is-active', nav);
      if (!active || this.reduced()) { pill.classList.add('is-off'); return; }
      pill.style.height = active.offsetHeight + 'px';
      pill.style.transform = 'translateY(' + active.offsetTop + 'px)';
      pill.classList.remove('is-off');
    },

    /* The scroll rail and the header's depth. Both read the scroll position
       inside a rAF, so a fast scroll cannot queue up layout work — this is the
       whole reason the pass is 60fps. */
    scroll() {
      if (this._ticking) return;
      this._ticking = true;
      requestAnimationFrame(() => {
        this._ticking = false;
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const rail = $('.scroll-rail');
        if (rail) {
          const bar = $('i', rail);
          if (bar) bar.style.transform = 'scaleX(' + Math.min(1, y / max).toFixed(4) + ')';
          rail.classList.toggle('is-idle', y < 8);
        }
        document.body.classList.toggle('is-scrolled', y > 6);
      });
    },

    init() {
      document.body.append(el('div', { class: 'scroll-rail is-idle', html: '<i></i>' }));
      window.addEventListener('scroll', () => this.scroll(), { passive: true });
      window.addEventListener('resize', () => { this.navPill(); this.scroll(); });
      this.scroll();
    },
  };

  const Router = {
    routes: {},
    current: null,
    register(name, fn) { this.routes[name] = fn; },
    go(name, opts = {}) {
      if (!this.routes[name]) name = 'dashboard';
      if (location.hash.slice(1) !== name) {
        /* Changing the hash fires `hashchange`, which renders without options —
           so stash them and let render() pick them up. Otherwise a cross-page
           "go here AND open this record" silently loses the record. */
        this._pending = opts;
        location.hash = name;
        return;
      }
      this.render(name, opts);
    },
    _pending: null,
    render(name, opts) {
      const o = opts || this._pending || {};
      this._pending = null;
      this.current = name;
      const view = this.routes[name];
      const mount = $('#page-mount');
      if (!mount) return;
      mount.innerHTML = '';
      // A view may either return a node, or paint into #page-mount itself and
      // return nothing. Appending a non-node would inject a literal
      // "undefined" text node, so only append real nodes.
      const out = view ? view(o) : this.routes.dashboard();
      if (out instanceof Node) mount.append(out);
      $$('.nav-item[data-route]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.route === name));
      $$('.bn-item[data-route]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.route === name));
      const nav = $('.nav') ; if (nav) nav.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
      /* After the scroll is reset, so the entrance pass measures the cards where
         they will actually be seen. */
      Motion.enter(mount);
      document.dispatchEvent(new CustomEvent('nexus:route', { detail: { name } }));
    },
    init() {
      window.addEventListener('hashchange', () => this.render(location.hash.slice(1) || 'dashboard'));
      if (!location.hash) history.replaceState(null, '', '#dashboard');
    },
  };

  /* --- NAVIGATION MODEL -------------------------------------------------- */
  /* Grouped exactly like the reference sidebar. Premium items are flagged. */
  const NAV = [
    { id: 'core', label: 'Core', items: [
      { route: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { route: 'tasks',     label: 'Tasks',     icon: 'check' },
      { route: 'projects',  label: 'Projects',  icon: 'layers' },
      { route: 'goals',     label: 'Goals',     icon: 'target' },
      { route: 'calendar',  label: 'Calendar',  icon: 'calendar' },
      { route: 'habits',    label: 'Habits',    icon: 'repeat' },
      { route: 'focus',     label: 'Focus',     icon: 'focus' },
    ]},
    { id: 'knowledge', label: 'Knowledge', items: [
      { route: 'notes',     label: 'Notes',     icon: 'note' },
      { route: 'knowledge', label: 'Knowledge', icon: 'brain' },
      { route: 'journal',   label: 'Journal',   icon: 'book' },
      { route: 'inbox',     label: 'Inbox',     icon: 'inbox' },
    ]},
    { id: 'life', label: 'Life', items: [
      { route: 'finance',   label: 'Finance',   icon: 'wallet' },
      { route: 'files',     label: 'Files',     icon: 'folder' },
      { route: 'analytics', label: 'Analytics', icon: 'chart' },
      { route: 'activity',  label: 'Activity',  icon: 'pulse' },
    ]},
    { id: 'advanced', label: 'Advanced', items: [
      { route: 'time',       label: 'Time Machine', icon: 'clock', pro: false },
      { route: 'automation', label: 'Automation',   icon: 'bolt',  pro: false },
      { route: 'templates',  label: 'Templates',    icon: 'sparkles', pro: false },
    ]},
  ];

  const MOBILE_NAV = [
    { route: 'dashboard', label: 'Home',    icon: 'grid' },
    { route: 'tasks',     label: 'Tasks',   icon: 'check' },
    { route: 'focus',     label: 'Focus',   icon: 'focus' },
    { route: 'projects',  label: 'Projects',icon: 'layers' },
    { route: 'settings',  label: 'More',    icon: 'settings' },
  ];

  /* Inline icon set — 24×24 stroke icons, no external dependency. */
  const ICONS = {
    grid:    '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    check:   '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
    layers:  '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    target:  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    repeat:  '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>',
    focus:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
    note:    '<path d="M5 3h9l5 5v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
    brain:   '<path d="M9.5 3A3.5 3.5 0 006 6.5 3 3 0 004 9.3a3 3 0 001.6 2.6A3 3 0 005 14a3 3 0 003 3 3 3 0 003 3V3a2 2 0 00-1.5 0z"/><path d="M14.5 3A3.5 3.5 0 0118 6.5a3 3 0 012 2.8 3 3 0 01-1.6 2.6A3 3 0 0119 14a3 3 0 01-3 3 3 3 0 01-3 3"/>',
    book:    '<path d="M4 4.5A2.5 2.5 0 016.5 2H20v18H6.5A2.5 2.5 0 004 22.5z"/><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>',
    inbox:   '<path d="M21 12v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7"/><path d="M3 12l2.5-8h13L21 12"/><path d="M3 12h5l1.5 3h5L16 12h5"/>',
    wallet:  '<path d="M3 7a2 2 0 012-2h13a1 1 0 011 1v1"/><path d="M3 7v11a2 2 0 002 2h14a2 2 0 002-2v-6a1 1 0 00-1-1h-3a2 2 0 000 4h3"/>',
    folder:  '<path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    chart:   '<path d="M3 20h18"/><path d="M6 20V11M11 20V5M16 20v-6M21 20v-9"/>',
    pulse:   '<path d="M2 12h4l2.5-6 3 12 2.5-6H22"/>',
    clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    bolt:    '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>',
    sparkles:'<path d="M12 3l1.8 4.9L18 9.7l-4.2 1.8L12 16l-1.8-4.5L6 9.7l4.2-1.8z"/><path d="M19 15l.9 2.4L22 18.3l-2.1.9L19 21l-.9-1.8-2.1-.9 2.1-.9z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 008 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1A1.6 1.6 0 004.6 8a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H22a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    star:    '<path d="M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9.1 9z"/>',
    upload:  '<path d="M12 16V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
    download:'<path d="M12 4v12"/><path d="M7.5 11.5L12 16l4.5-4.5"/><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3"/>',
    search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    play:    '<path d="M7 4.5l12 7.5-12 7.5z"/>',
    pause:   '<path d="M9 4v16M15 4v16"/>',
    reset:   '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    flame:   '<path d="M12 22a6 6 0 006-6c0-5-6-13-6-13S6 11 6 16a6 6 0 006 6z"/>',
    drop:    '<path d="M12 3s6 6.5 6 10.5A6 6 0 016 13.5C6 9.5 12 3 12 3z"/>',
    trash:   '<path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"/>',
    edit:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    more:    '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    arrowR:  '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    chevR:   '<path d="M9 6l6 6-6 6"/>',
    chevL:   '<path d="M15 6l-6 6 6 6"/>',
    chevU:   '<path d="M6 15l6-6 6 6"/>',
    chevD:   '<path d="M6 9l6 6 6-6"/>',
    arrowL:  '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    clip:    '<path d="M21.4 11.05l-9.19 9.19a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.67 3.67 0 015.19 5.19l-9.2 9.19a1.83 1.83 0 01-2.59-2.59l8.49-8.48"/>',
    /* Milestone 15 — Tasks page */
    list:    '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
    filter:  '<path d="M4 5h16l-6.2 7.4V19l-3.6-2v-4.6z"/>',
    sort:    '<path d="M4 7h10M4 12h7M4 17h4"/><path d="M17 6v12"/><path d="M14.5 15.5L17 18l2.5-2.5"/>',
    tag:     '<path d="M3 12.5V5a2 2 0 012-2h7.5L21 11.5a2 2 0 010 2.8l-6.7 6.7a2 2 0 01-2.8 0z"/><circle cx="8" cy="8" r="1.4"/>',
    copy:    '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M6 15H5a2 2 0 01-2-2V5a2 2 0 012-2h8a2 2 0 012 2v1"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1.4"/><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8"/><path d="M10 12h4"/>',
    flag:    '<path d="M5 21V4"/><path d="M5 5h11l-1.6 3.2L16 12H5z"/>',
    sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',
    moon:    '<path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/>',
    x:       '<path d="M18 6L6 18M6 6l12 12"/>',
    checkAll:'<path d="M2 12.5l4.5 4.5L13 10"/><path d="M11 15l1.5 1.5L22 7"/>',
    /* Milestone 28 — Files */
    file:    '<path d="M6 2.5h7.5L18 7v14a1 1 0 01-1 1H6a1 1 0 01-1-1v-17a1 1 0 011-1z"/><path d="M13.5 2.5V7H18"/>',
    image:   '<rect x="3" y="4.5" width="18" height="15" rx="2.2"/><circle cx="8.6" cy="9.6" r="1.5"/><path d="M4 17l4.8-4.4 3.4 3 3-2.6L20 17"/>',
    sheet:   '<rect x="3" y="4.5" width="18" height="15" rx="2.2"/><path d="M3 9.5h18M3 14.5h18M9 4.5v15M15 4.5v15"/>',
  };
  const icon = (name, size = 18) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.grid}</svg>`;

  /* ======================================================================
     DATA LAYER — Milestone 6 foundation
     State + deterministic derivations. Persistence (IndexedDB) arrives in
     Milestone 13; for now state lives in memory seeded from demo data.
     ====================================================================== */

  /* Today's date, formatted like the reference ("Sun, 13 Sep 2026"). */
  const todayMeta = (() => {
    const d = new Date();
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return {
      date: d,
      short: `${days[d.getDay()]}`,
      label: `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  })();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 22) return 'Good evening';
    return 'Working late';
  };

  /* ======================================================================
     TASK ENTITY — Milestone 14
     The full NEXUS task model. The demo only populates a subset, but every
     field the product needs exists from day one so nothing has to be
     migrated later. normalizeTask() upgrades partial records safely.
     ====================================================================== */
  const PRIORITIES = ['High', 'Medium', 'Low'];
  const TASK_STATUS = ['today', 'upcoming', 'scheduled', 'done', 'archived'];

  /* The kinds of workspace object a note can point at. Kept as a list so the
     normalizer, the picker and the tests all agree on one vocabulary. */
  const REF_TYPES = ['task', 'project', 'goal'];

  const Task = {
    create(fields = {}) {
      const now = new Date().toISOString();
      return normalizeTask({
        id: fields.id || uid('t'),
        title: fields.title || 'Untitled task',
        description: fields.description || '',
        priority: fields.priority || 'Medium',
        status: fields.status || 'today',
        createdAt: now,
        updatedAt: now,
        /* `due` carries a real day key (or a token that normalizeTask parses);
           there is deliberately no second `dueDate` field to drift away from it. */
        startDate: fields.startDate || null,
        completedAt: null,
        estimate: fields.estimate ?? null,       // minutes
        actualMinutes: 0,
        projectId: fields.projectId || null,
        goalId: fields.goalId || null,
        workspaceId: fields.workspaceId || 'personal',
        tags: fields.tags || [],
        subtasks: fields.subtasks || [],         // [{id,title,done}]
        dependencies: fields.dependencies || [], // [taskId]
        attachments: fields.attachments || [],   // [fileRefId]
        recurrence: fields.recurrence || null,   // 'daily'|'weekly'|'monthly'|null
        archived: !!fields.archived,
        ...fields,
      });
    },
  };

  /* --- Calendar date helpers ---------------------------------------------
     Everything is local-time and ISO `YYYY-MM-DD` keys, so a day key compares
     and sorts as a plain string and never drifts through timezone conversion. */
  function dayKey(d) {
    const x = (d instanceof Date) ? d : new Date(d);
    if (isNaN(x)) return null;
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${x.getFullYear()}-${m}-${day}`;
  }
  function shiftDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function todayKey() { return dayKey(new Date()); }

  /* Turn a human due token into a real day key, or null when it names no day.
     This is the BOUNDARY parser (Milestone 34): it runs when a date ENTERS the
     workspace — the demo seed, the quick-add field, the task editor — and never
     at render time. A due date is an INTENTION, so it is resolved once and then
     stored. Re-resolving it on every render would let the intention drift to a
     new day at midnight (the activity log's `at: 'Just now'` bug, M30) and made
     "overdue" impossible to express: a task could never be past its own due date. */
  function parseDueToken(token) {
    if (!token) return null;
    const t = String(token).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;          // already a real key
    const today = new Date();
    switch (t) {
      case 'Today': case 'Tonight': case '6 PM': return dayKey(today);
      case 'Tomorrow': return dayKey(shiftDays(today, 1));
      case 'Yesterday': return dayKey(shiftDays(today, -1));
      default: break;
    }
    // "This week" has no single day — spread it onto the coming weekend so it
    // is visible on the grid without inventing a specific commitment.
    if (/^this week$/i.test(t)) return dayKey(shiftDays(today, 5));
    if (/^next week$/i.test(t)) return dayKey(shiftDays(today, 7));
    // An explicit date token like "12 Sep" is taken as the nearest one that has
    // not passed, so a bare "12 Sep" typed in September means next year rather
    // than ten months ago.
    const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,})$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
        .indexOf(m[2].slice(0, 3).toLowerCase());
      if (month >= 0) {
        const y = today.getFullYear();
        let d = new Date(y, month, day);
        if (isNaN(d)) return null;
        if (dayKey(d) < dayKey(today)) d = new Date(y + 1, month, day);
        return dayKey(d);
      }
    }
    return null;
  }

  /* Coerce an event into a valid record with a real `date` (YYYY-MM-DD).
     Demo events arrive with a `dayOffset` anchor instead of a date; that is
     resolved against today exactly once, then persisted like any other date. */
  function normalizeEvent(u) {
    let date = u.date;
    if (!date && typeof u.dayOffset === 'number') date = dayKey(shiftDays(new Date(), u.dayOffset));
    if (!date) date = todayKey();
    return {
      id: u.id || uid('u'),
      title: u.title || 'Untitled event',
      time: u.time || 'All day',
      kind: u.kind || 'event',
      color: u.color || '#6366F1',
      date,
      notes: u.notes || '',
      allDay: !!u.allDay,
    };
  }

  /* Coerce a habit into a valid record, migrating the legacy demo shape.
     Old records carried `streak` / `done` counters and a `doneToday` flag;
     those are discarded in favour of a real `history` array of day keys.
     A legacy `doneToday:true` seed becomes today's history entry so nothing
     visibly changes for the user on first load. */
  function normalizeHabit(h) {
    let history = Array.isArray(h.history) ? h.history.slice() : [];
    // Resolve demo `dayOffset` anchors into real day keys, once.
    history = history.map(v => typeof v === 'number'
      ? dayKey(shiftDays(new Date(), v))
      : String(v));
    if (!Array.isArray(h.history) && h.doneToday) history.push(todayKey());
    // De-duplicate and keep a bounded, newest-last window.
    const seen = new Set();
    const clean = history.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && !seen.has(k) && seen.add(k));
    clean.sort();
    const KEEP = 400;                                  // ~13 months of daily data
    return {
      id: h.id || uid('h'),
      name: h.name || 'Untitled habit',
      icon: h.icon || 'repeat',
      color: h.color || 'cyan',
      history: clean.slice(-KEEP),
    };
  }

  /* Coerce any record into a valid Note.
     Notes are user-authored content, so nothing here is derived — but the
     timestamps must be real ISO strings (never a relative offset), and tags
     must be a clean, lower-cased, de-duplicated list. Demo records carry an
     `hoursAgo` anchor which is resolved ONCE, here, and then persisted. */
  /* The provenance stamp an automation puts on the records it makes (M35).
     Declared here, as a hoisted `function` beside its one regex, because the
     normalizers defined earlier in this file (a note, an inbox capture) call it
     at runtime — and there must be one rule for what a valid stamp is, not three
     copies of it. It is a FACT about where a record came from, not a
     measurement, so unlike every other link in this app it cannot be recomputed
     and has to be stored. */
  const AUTO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function normalizeOrigin(o) {
    if (!o || !o.rule || !AUTO_DAY_RE.test(String(o.day == null ? '' : o.day))) return null;
    return { rule: String(o.rule), day: String(o.day) };
  }

  function normalizeNote(n) {
    const now = Date.now();
    const rel = typeof n.hoursAgo === 'number' ? n.hoursAgo * 3600000 : null;

    let updated = n.updatedAt != null ? new Date(n.updatedAt).getTime() : NaN;
    if (!isFinite(updated)) updated = rel != null ? now - rel : now;

    let created = n.createdAt != null ? new Date(n.createdAt).getTime() : NaN;
    if (!isFinite(created)) created = updated;
    if (created > updated) created = updated;

    const tags = Array.isArray(n.tags)
      ? [...new Set(n.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
          .filter(t => t.length <= 24).slice(0, 12)
      : [];

    /* Pointers at workspace objects. A dangling ref is kept here and reported
       by the UI as "missing" rather than silently dropped — the user should
       know a link broke, and deleting a task must not rewrite their notes. */
    const refs = Array.isArray(n.refs)
      ? n.refs
          .filter(r => r && REF_TYPES.includes(r.type) && r.id)
          .map(r => ({ type: r.type, id: String(r.id) }))
          .filter((r, i, arr) => arr.findIndex(x => x.type === r.type && x.id === r.id) === i)
          .slice(0, 20)
      : [];

    return {
      id: n.id || uid('n'),
      title: String(n.title == null ? '' : n.title).trim().slice(0, 140) || 'Untitled note',
      body: typeof n.body === 'string' ? n.body.slice(0, 40000) : '',
      tags,
      /* Hierarchy: the note this one lives inside, or null for a root. Cycles
         and dangling parents are repaired in State._reconcile, not here, so
         this function stays total (it never needs to see the whole set). */
      parentId: n.parentId ? String(n.parentId) : null,
      refs,
      origin: normalizeOrigin(n.origin),
      favorite: !!n.favorite,
      pinned: !!n.pinned,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(updated).toISOString(),
    };
  }

  /* Make a note collection's parent links sound, in place.
     Two kinds of corruption are possible and both are silent killers:
       · a parentId pointing at a note that no longer exists (deleting a parent
         without reparenting, or an imported file with stale ids), and
       · a cycle — A inside B inside A — which makes every tree walk loop
         forever and hang the render.
     Both are repaired here on load, so the rest of the code can assume the
     hierarchy is a forest. */
  function repairNoteHierarchy(notes) {
    const byId = new Map(notes.map(n => [n.id, n]));
    let repaired = 0;

    notes.forEach(n => {
      if (n.parentId && !byId.has(n.parentId)) { n.parentId = null; repaired++; }
    });

    notes.forEach(n => {
      if (!n.parentId) return;
      const seen = new Set([n.id]);
      let cur = n.parentId;
      while (cur) {
        if (seen.has(cur)) { n.parentId = null; repaired++; break; }   // cycle → unfile
        seen.add(cur);
        const p = byId.get(cur);
        cur = p ? p.parentId : null;
      }
    });

    return { notes, repaired };
  }

  /* Coerce any record into a valid focus session.
     A session is a REAL record of something that happened: it began at a
     moment, ended at a moment, and lasted `minutes`. Everything the UI shows
     about focus (today's total, the month total, the streak, the score) is
     derived from this collection — nothing is kept as a running counter.
     Demo records carry `dayOffset`/`minutesAgo` anchors so the log always looks
     alive; those are resolved ONCE here and then persisted as real timestamps. */
  function normalizeFocusSession(s) {
    const now = Date.now();
    let started = s.startedAt;
    if (started == null) {
      // Resolve a relative anchor into an absolute moment, once.
      const dayOff = typeof s.dayOffset === 'number' ? s.dayOffset : 0;
      const minsAgo = typeof s.minutesAgo === 'number' ? s.minutesAgo : 0;
      const d = shiftDays(new Date(), dayOff);
      d.setHours(9, 0, 0, 0);
      started = d.getTime() + (s.atMinute || 0) * 60000 - minsAgo * 60000;
    }
    started = Number(started);
    if (!isFinite(started)) started = now;

    const minutes = Math.max(0, Math.round(Number(s.minutes) || 0));
    const ended = s.endedAt != null ? Number(s.endedAt) : started + minutes * 60000;
    const mode = s.mode === 'break' ? 'break' : 'focus';

    return {
      id: s.id || uid('f'),
      taskId: s.taskId || null,
      mode,
      minutes,
      startedAt: started,
      endedAt: isFinite(ended) ? ended : started + minutes * 60000,
      day: /^\d{4}-\d{2}-\d{2}$/.test(s.day) ? s.day : dayKey(new Date(started)),
    };
  }

  /* Clamp a self-rating onto the 1–5 scale. `null` is a legitimate value —
     "I did not rate this day" is different from "I rated it 0". */
  function journalRating(v) {
    if (v == null || v === '') return null;
    const n = Math.round(Number(v));
    return (isFinite(n) && n >= 1 && n <= 5) ? n : null;
  }

  /* Coerce any record into a valid journal entry.
     A journal entry is the one record in NEXUS the user writes by hand: a body
     plus three self-ratings (mood / energy / productivity). Those are the only
     things stored, because they are the only things that cannot be computed.
     Everything *about* the collection — the streak, the averages, the month
     grid, the search ranking — is derived at render time.
     One entry per day, so `day` (a real YYYY-MM-DD key) is the identity that
     matters. Demo records carry a `dayOffset` anchor, resolved ONCE here. */
  function normalizeJournal(e) {
    let day = e.day;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
      day = typeof e.dayOffset === 'number'
        ? dayKey(shiftDays(new Date(), e.dayOffset))
        : todayKey();
    }

    const now = Date.now();
    let updated = e.updatedAt != null ? new Date(e.updatedAt).getTime() : NaN;
    if (!isFinite(updated)) updated = now;
    let created = e.createdAt != null ? new Date(e.createdAt).getTime() : NaN;
    if (!isFinite(created)) created = updated;
    if (created > updated) created = updated;

    const tags = Array.isArray(e.tags)
      ? [...new Set(e.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean))]
          .filter(t => t.length <= 24).slice(0, 12)
      : [];

    return {
      id: e.id || uid('j'),
      day,
      title: String(e.title == null ? '' : e.title).trim().slice(0, 140),
      body: typeof e.body === 'string' ? e.body.slice(0, 40000) : '',
      mood: journalRating(e.mood),
      energy: journalRating(e.energy),
      productivity: journalRating(e.productivity),
      tags,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(updated).toISOString(),
    };
  }

  /* What the Inbox accepts. One list drives the capture row, the kind filter and
     the row badges, so a kind cannot exist in one place and be missing in
     another. */
  const INBOX_KINDS = [
    { key: 'task',     label: 'Task',     icon: 'check',    hint: 'Something to do' },
    { key: 'idea',     label: 'Idea',     icon: 'sparkles', hint: 'Something worth trying' },
    { key: 'note',     label: 'Note',     icon: 'note',     hint: 'Something to remember' },
    { key: 'link',     label: 'Link',     icon: 'arrowR',   hint: 'Something to read' },
    { key: 'reminder', label: 'Reminder', icon: 'clock',    hint: 'Something to come back to' },
    { key: 'thought',  label: 'Thought',  icon: 'brain',    hint: 'Something on your mind' },
  ];

  /* Where a capture can go. Each destination says exactly what will happen, so
     the convert dialog never has to guess or over-promise. */
  const INBOX_DESTS = [
    { type: 'task',    label: 'Task',    icon: 'check',  blurb: 'A task in Personal, due today.' },
    { type: 'note',    label: 'Note',    icon: 'note',   blurb: 'A note holding this text as its body.' },
    { type: 'project', label: 'Project', icon: 'layers', blurb: 'A new active project.' },
    { type: 'goal',    label: 'Goal',    icon: 'target', blurb: 'A new goal on the quarter horizon.' },
    { type: 'journal', label: 'Journal', icon: 'book',   blurb: "Appended to today's journal entry." },
  ];

  /* Coerce any record into a valid inbox capture.
     A capture is raw: the text the user typed, the kind they tagged it with and
     an optional URL. `status` / `convertedTo` / `processedAt` record a real
     triage decision, which is why they are stored — but every count, age and
     search ranking is derived at render time.
     Demo records carry `hoursAgo` / `processedHoursAgo` anchors, resolved ONCE. */
  function normalizeInbox(it) {
    const now = Date.now();
    const rel = typeof it.hoursAgo === 'number' ? it.hoursAgo * 3600000
              : typeof it.minutesAgo === 'number' ? it.minutesAgo * 60000 : null;

    let created = it.createdAt != null ? new Date(it.createdAt).getTime() : NaN;
    if (!isFinite(created)) created = rel != null ? now - rel : now;

    let processedAt = it.processedAt != null ? new Date(it.processedAt).getTime() : NaN;
    if (!isFinite(processedAt) && typeof it.processedHoursAgo === 'number') {
      processedAt = now - it.processedHoursAgo * 3600000;
    }
    if (!isFinite(processedAt)) processedAt = null;

    /* A pointer at what this capture became. Kept even when the target is later
       deleted, so the UI can say "missing" instead of quietly dropping the row. */
    const c = it.convertedTo;
    const convertedTo = (c && c.id && INBOX_DESTS.some(d => d.type === c.type))
      ? { type: c.type, id: String(c.id) }
      : null;

    return {
      id: it.id || uid('i'),
      text: String(it.text == null ? '' : it.text).trim().slice(0, 2000),
      kind: INBOX_KINDS.some(k => k.key === it.kind) ? it.kind : 'thought',
      url: typeof it.url === 'string' ? it.url.trim().slice(0, 500) : '',
      /* "Processed" without a destination would be meaningless, so the pointer
         is the authority on whether a capture has actually been triaged. */
      status: (it.status === 'processed' && convertedTo) ? 'processed' : 'inbox',
      convertedTo,
      origin: normalizeOrigin(it.origin),
      createdAt: new Date(created).toISOString(),
      processedAt: processedAt != null ? new Date(processedAt).toISOString() : null,
    };
  }

  /* Supported currencies. `currency` is a PREFERENCE, so it lives in the finance
     singleton rather than on any transaction — changing it must reformat every
     figure without touching a single record. */
  const CURRENCIES = [
    { code: 'INR', symbol: '₹' },
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' },
  ];

  /* The category vocabulary, split by side of the ledger. A category belongs to
     exactly one type, so an expense can never be filed as "Salary" — the model
     enforces it rather than trusting the form. */
  const FINANCE_CATEGORIES = [
    { name: 'Housing',       type: 'expense', color: 'var(--indigo)',   icon: 'layers' },
    { name: 'Food',          type: 'expense', color: 'var(--cyan)',     icon: 'flame' },
    { name: 'Transport',     type: 'expense', color: 'var(--magenta)',  icon: 'arrowR' },
    { name: 'Subscriptions', type: 'expense', color: 'var(--violet)',   icon: 'repeat' },
    { name: 'Health',        type: 'expense', color: 'var(--good)',     icon: 'pulse' },
    { name: 'Learning',      type: 'expense', color: 'var(--accent-2)', icon: 'book' },
    { name: 'Fun',           type: 'expense', color: 'var(--warn)',     icon: 'star' },
    { name: 'Other',         type: 'expense', color: 'var(--text-2)',   icon: 'more' },
    { name: 'Salary',        type: 'income',  color: 'var(--good)',     icon: 'wallet' },
    { name: 'Freelance',     type: 'income',  color: 'var(--cyan)',     icon: 'sparkles' },
    { name: 'Other income',  type: 'income',  color: 'var(--text-2)',   icon: 'plus' },
  ];

  /* Coerce any record into a valid transaction.
     A transaction records something that happened: a label, a positive amount,
     which side of the ledger it fell on, a category and a real day key. The
     amount is stored as a MAGNITUDE — the sign is `type`, so a "-500 expense" and
     a "500 refund" can never be confused for each other.
     Demo records carry a `dayOffset` anchor, resolved ONCE here. */
  function normalizeTransaction(t) {
    const type = t.type === 'income' ? 'income' : 'expense';
    const amount = Math.round(Math.abs(Number(t.amount) || 0) * 100) / 100;

    let day = t.day;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) {
      /* Legacy records (they used to live inside the finance singleton) carry no
         date at all. They are kept and recorded as happening now — losing a
         transaction would be worse than misdating one. */
      day = typeof t.dayOffset === 'number'
        ? dayKey(shiftDays(new Date(), t.dayOffset))
        : todayKey();
    }

    const fallback = type === 'income' ? 'Other income' : 'Other';
    const category = FINANCE_CATEGORIES.some(c => c.name === t.category && c.type === type)
      ? t.category
      : fallback;

    let created = t.createdAt != null ? new Date(t.createdAt).getTime() : NaN;
    if (!isFinite(created)) created = Date.now();

    return {
      id: t.id || uid('x'),
      label: String(t.label == null ? '' : t.label).trim().slice(0, 120) || 'Untitled',
      amount,
      type,
      category,
      day,
      note: typeof t.note === 'string' ? t.note.slice(0, 500) : '',
      createdAt: new Date(created).toISOString(),
    };
  }

  /* The finance singleton holds PREFERENCES only: the display currency and the
     monthly budget TARGETS.
     It used to also carry a pre-computed category breakdown, a frozen seven-day
     spending array and a `spendPercent` — derived numbers kept in storage, which
     is precisely what this codebase forbids: they could not be recomputed and they
     drifted the moment a transaction changed. Those are gone.
     A budget survives the cull because a target is an INTENTION, not a
     calculation: there is no way to derive what you meant to spend. */
  function normalizeFinance(f) {
    const src = f || {};
    const codes = CURRENCIES.map(c => c.code);

    /* Only a positive number against a real EXPENSE category is a budget. A
       phantom key (a deleted category, an income category, a string) is dropped
       rather than kept as a target nothing can ever be measured against. */
    const raw = (src.budgets && typeof src.budgets === 'object') ? src.budgets : {};
    const budgets = {};
    FINANCE_CATEGORIES.filter(c => c.type === 'expense').forEach(c => {
      const v = Math.round(Number(raw[c.name]) * 100) / 100;
      if (v > 0) budgets[c.name] = v;
    });

    return {
      currency: codes.includes(src.currency) ? src.currency : 'INR',
      budgets,
    };
  }

  /* ======================================================================
     PROJECTS AND GOALS — the two collections that had no normalizer
     ======================================================================
     Milestone 39 gave them one, because an import is a new door into state and
     every door has to lead through the same guard. A task, a note or a habit
     could never arrive malformed; a project could — and a project with no name
     would render as a blank card and could never be matched by the tasks that
     point at it, because tasks reference a project BY NAME, not by id.

     `HORIZONS` / `LIFE_AREAS` live here now rather than beside GoalsPage: they
     are the goal vocabulary, and the guard has to validate against the same
     list the editor offers, or the two would drift.
     ====================================================================== */
  const HORIZONS = ['Quarter', 'Year', 'Someday'];
  const LIFE_AREAS = ['Career', 'Health', 'Creative', 'Finance', 'Learning', 'Relationships', 'Personal'];

  function normalizeProject(p) {
    const src = p || {};
    const name = String(src.name == null ? '' : src.name)
      .replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled project';
    return {
      id: src.id || uid('p'),
      name,
      status: String(src.status == null ? '' : src.status).trim().slice(0, 40) || 'Active',
      deadline: src.deadline ? String(src.deadline).slice(0, 40) : null,
      color: src.color ? String(src.color).slice(0, 24) : Derive._autoColor(name),
    };
  }

  function normalizeGoal(g) {
    const src = g || {};
    const name = String(src.name == null ? '' : src.name)
      .replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled goal';
    return {
      id: src.id || uid('g'),
      name,
      area: LIFE_AREAS.indexOf(src.area) !== -1 ? src.area : 'Personal',
      horizon: HORIZONS.indexOf(src.horizon) !== -1 ? src.horizon : 'Quarter',
      deadline: src.deadline ? String(src.deadline).slice(0, 40) : null,
      color: src.color ? String(src.color).slice(0, 24) : Derive._autoColor(name),
      why: String(src.why == null ? '' : src.why).slice(0, 600),
    };
  }

  /* ======================================================================
     ONBOARDING — Milestone 38
     ======================================================================
     The workspace owner. `name` is the only thing the app needs to know about a
     person, and it exists for one reason: the dashboard greets them by it, and a
     greeting carrying a name the user cannot change is a lie.

     Two fields are stored, and both are stored for the same reason — neither can
     be derived:

       * `focus` is an INTENTION. There is no way to compute what someone wants to
         work on first, so it has to be asked.
       * `onboardedAt` is a DECISION — the fact that they have seen the setup.
         `null` means never, which is what makes the first run identifiable.

     Nothing else about a person is kept. No email, no account, no analytics.
     ====================================================================== */
  const USER_NAME_MAX = 40;

  /* The starting points onboarding offers. Each one ends somewhere REAL — the
     flow navigates to the chosen route when it finishes, so the last thing a
     first run does is take you to work rather than say "all set". */
  const START_HERE = [
    { key: 'plan',   label: 'Plan my week',       icon: 'check',
      blurb: 'Get the week out of your head and into a list you can work from.', route: 'tasks' },
    { key: 'habits', label: 'Build a habit',      icon: 'repeat',
      blurb: 'Something small, every day, with a streak you can watch grow.',    route: 'habits' },
    { key: 'focus',  label: 'Protect my focus',   icon: 'focus',
      blurb: 'Deep-work sessions that add up to real hours.',                    route: 'focus' },
    { key: 'money',  label: 'Get money in order', icon: 'wallet',
      blurb: 'Log what you spend and set a target you can actually keep.',       route: 'finance' },
    { key: 'write',  label: 'Write things down',  icon: 'note',
      blurb: 'Notes and a journal that link to each other.',                     route: 'notes' },
    { key: 'look',   label: 'Just look around',   icon: 'grid',
      blurb: 'Nothing to set up — the workspace is already full of demo data.',  route: 'dashboard' },
  ];
  const startHere = k => START_HERE.find(s => s.key === k) || null;

  /* ======================================================================
     EXPORT / IMPORT — Milestone 39
     ======================================================================
     An export is the user's DATA, in one file. Two rules shape it:

     1. **The envelope carries no derivable numbers.** It does not store a record
        count or a summary — those are read off `data` itself, so a hand-edited
        file cannot claim a count its contents do not support. The export *screen*
        shows the counts; the *file* does not bake them in.
     2. **The plan is not in the file.** An entitlement is not data — it is live
        state (invariant 10) — so letting a file grant Pro would make the gate
        (invariant 13) mean nothing. The UI says so rather than surprising you.

     `EXPORT_COLLECTIONS` is the one table of what a workspace holds, in the order
     the file writes it, with the labels the manifest shows. It is the export's
     counterpart to `START_HERE`: one list, so the summary, the file and the
     import preview cannot disagree about what exists.
     ====================================================================== */
  const EXPORT_FORMAT = 1;
  const EXPORT_COLLECTIONS = [
    { key: 'tasks',        label: 'Tasks' },
    { key: 'projects',     label: 'Projects' },
    { key: 'goals',        label: 'Goals' },
    { key: 'habits',       label: 'Habits' },
    { key: 'notes',        label: 'Notes' },
    { key: 'journal',      label: 'Journal' },
    { key: 'inbox',        label: 'Inbox' },
    { key: 'upcoming',     label: 'Calendar events' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'focus',        label: 'Focus sessions' },
    { key: 'reviews',      label: 'Reviews' },
    { key: 'files',        label: 'Files' },
    { key: 'automations',  label: 'Automations' },
    { key: 'templates',    label: 'Templates' },
    { key: 'activity',     label: 'Activity log' },
  ];
  const exportLabel = k => (EXPORT_COLLECTIONS.find(c => c.key === k) || {}).label || k;

  /* ONE phrasing for "how much a workspace holds", shared by the import and the
     reset confirmations — two modals describing the same shape must not drift.
     The files are INSIDE `records` (both are rows of `EXPORT_COLLECTIONS`), so
     they are named as part of that total, never added to it: "307 records and 6
     files" claimed 313 while the chips beside it added up to 307. */
  const recordSummaryLine = s => `${s.records} record${s.records === 1 ? '' : 's'}`
    + (s.kinds.length ? ` across ${s.kinds.length} kind${s.kinds.length === 1 ? '' : 's'}` : '')
    + (s.files ? `, including ${s.files} file${s.files === 1 ? '' : 's'} (${s.fileSizeLabel})` : '');

  /* ======================================================================
     DASHBOARD CARDS — Milestone 41
     ======================================================================
     The ONE table of what the dashboard can show. The dashboard renders from it,
     the customise panel lists it, and an export carries it, so none of the three
     can disagree about what exists, where it goes, or what order it is in — the
     same rule as `START_HERE` and `EXPORT_COLLECTIONS`.

     The dashboard is TWO columns of different widths (the wide one carries the
     work, the side one is a stack of summaries), so a card's column is part of
     its identity rather than something an ordered list can imply — an ordered
     list would have to guess, and every guess would move a card the user did not
     move. `col` is the default column; the user's arrangement may move a card.

     `span` is only meaningful in the wide column, where two consecutive `half`
     cards share a row (that is how habits and money sit side by side). A `full`
     card takes the whole column. */
  const DASH_CARDS = [
    { key: 'todaysfocus', label: "Today's Focus", col: 'wide', span: 'full', sel: 'w-todaysfocus',
      blurb: 'What is due today, and a way to tick it off.' },
    { key: 'habits',      label: 'Habit tracker', col: 'wide', span: 'half', sel: 'w-habits',
      blurb: 'The last two weeks, at a glance.' },
    { key: 'money',       label: 'Money',         col: 'wide', span: 'half', sel: 'w-finance',
      blurb: 'This month so far, against your budgets.' },
    { key: 'journal',     label: 'Journal',       col: 'wide', span: 'half', sel: 'w-journal',
      blurb: "Today's mood, energy and focus." },
    { key: 'inbox',       label: 'Inbox',         col: 'wide', span: 'half', sel: 'w-inbox',
      blurb: 'Captured today, and what is still waiting.' },
    { key: 'activity',    label: 'Activity',      col: 'wide', span: 'full', sel: 'w-activity',
      blurb: 'What has happened, and how much of it.' },
    { key: 'focus',       label: 'Focus Mode',    col: 'side', span: 'full', sel: 'w-focus',
      blurb: 'The live timer and your focus totals.' },
    { key: 'upcoming',    label: 'Upcoming',      col: 'side', span: 'full', sel: 'w-upcoming',
      blurb: 'The next few things on the calendar.' },
    { key: 'goals',       label: 'Goals',         col: 'side', span: 'full', sel: 'w-goal',
      blurb: 'Progress toward what you are aiming at.' },
    { key: 'score',       label: 'NEXUS Score',   col: 'side', span: 'full', sel: 'w-score',
      blurb: 'The score, and what moved it.' },
    { key: 'quote',       label: 'Daily reminder', col: 'side', span: 'full', sel: 'w-quote',
      blurb: 'One line to start the day with.' },
  ];
  const DASH_KEYS = DASH_CARDS.map(c => c.key);
  const DASH_COLS = ['wide', 'side'];
  const DASH_COL_LABELS = { wide: 'Wide column', side: 'Side column' };
  const dashCard = k => DASH_CARDS.find(c => c.key === k) || null;

  /* An arrangement is a PREFERENCE — which cards, in what order, in which column.
     No record can derive it, so it is stored, exactly like a budget target.
     `null` means "never arranged", which keeps the default identifiable and a
     deliberate "hide everything" (`{wide:[],side:[]}`) different from it — the
     same distinction `user.onboardedAt` draws between never-asked and answered.

     A card lives in ONE column, so the first list to name a key wins and a repeat
     is dropped; unknown keys are dropped too, so a hand-edited or imported file
     can never render a card that does not exist, or the same card twice. */
  function pickDashBoard(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const seen = new Set();
    const out = { wide: [], side: [] };
    DASH_COLS.forEach(col => {
      const list = Array.isArray(v[col]) ? v[col] : [];
      list.forEach(k => {
        const key = String(k);
        if (DASH_KEYS.indexOf(key) === -1 || seen.has(key)) return;
        seen.add(key);
        out[col].push(key);
      });
    });
    return out;
  }

  /* The arrangement to render: the user's when they have made one, otherwise
     every card in its declared column, in canonical order. */
  function dashLayout() {
    const chosen = pickDashBoard(Settings.read().dashboard);
    if (chosen !== null) return chosen;
    const out = { wide: [], side: [] };
    DASH_CARDS.forEach(c => out[c.col].push(c.key));
    return out;
  }

  /* The daily focus target is a preference, and it has bounds (15 min … 12 h).
     Named here so the setter, the export and the import all agree — a file must
     not be able to set a target the Settings field would refuse. */
  const FOCUS_TARGET_MIN = 15;
  const FOCUS_TARGET_MAX = 720;

  /* The preferences that travel with a workspace, named explicitly. Not "all of
     Settings": that blob also holds the notification decision cache, and an
     export should carry intentions the user recognises, not our internals.
     Each entry knows how to describe its own value, so the export screen and the
     import preview cannot describe the same preference two different ways. */
  const EXPORT_PREFS = [
    { key: 'theme',       label: 'Theme',
      value: v => (THEMES[v] || {}).label || String(v) },
    { key: 'focusTarget', label: 'Daily focus target',
      value: v => focusTargetLabel(v) },
    { key: 'dashboard',   label: 'Dashboard cards',
      value: v => {
        const n = pickDashBoard(v);
        return n === null ? 'the default set'
          : `${n.wide.length + n.side.length} of ${DASH_CARDS.length} cards`;
      } },
  ];

  /* Read the exportable preferences out of Settings, and validate an incoming
     set against the same rules the app's own setters enforce — so a file can
     only set a preference the app actually has, to a value it can actually use.
     Anything unrecognised is dropped rather than stored. */
  function pickPreferences(src) {
    const s = (src && typeof src === 'object') ? src : {};
    const out = {};
    if (THEMES[s.theme]) out.theme = s.theme;
    const ft = Math.round(Number(s.focusTarget) || 0);
    if (ft >= FOCUS_TARGET_MIN && ft <= FOCUS_TARGET_MAX) out.focusTarget = ft;
    const db = pickDashBoard(s.dashboard);
    if (db !== null) out.dashboard = db;
    return out;
  }

  /* Minutes as a person says them — "45m", "2h", "1h 30m". */
  function focusTargetLabel(n) {
    const m = Math.round(Number(n) || 0);
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  function normalizeUser(u) {
    const src = u || {};
    const name = String(src.name == null ? '' : src.name)
      .replace(/\s+/g, ' ').trim().slice(0, USER_NAME_MAX);
    /* Only real starting points survive, so a renamed or retired one cannot
       leave a dead chip pointing at a route that no longer exists. */
    const focus = [];
    (Array.isArray(src.focus) ? src.focus : []).forEach(k => {
      if (startHere(k) && focus.indexOf(k) === -1) focus.push(k);
    });
    const joined = /^\d{4}-\d{2}-\d{2}$/.test(String(src.joined)) ? src.joined : todayKey();
    const at = src.onboardedAt;
    return {
      name: name || 'there',
      joined,
      focus,
      onboardedAt: (typeof at === 'number' && at > 0) ? at : null,
    };
  }

  /* Files are local references. Nothing is uploaded anywhere: the content is read
     from the user's disk into a Blob and kept in the workspace's own database, so
     the workspace stays the only place the data lives. */
  const MAX_FILE_BYTES = 8 * 1024 * 1024;          // 8 MB — a friendly local cap
  const FILE_PREVIEW_TEXT_BYTES = 256 * 1024;      // read at most this much as text

  /* The kinds a file can be, derived from its media type and extension. Nothing
     stores the kind — it is computed, so it cannot disagree with the file. */
  const FILE_KINDS = [
    { key: 'image',   label: 'Image',   icon: 'star' },
    { key: 'pdf',     label: 'PDF',     icon: 'book' },
    { key: 'doc',     label: 'Document', icon: 'note' },
    { key: 'sheet',   label: 'Sheet',   icon: 'grid' },
    { key: 'text',    label: 'Text',    icon: 'list' },
    { key: 'archive', label: 'Archive', icon: 'archive' },
    { key: 'audio',   label: 'Audio',   icon: 'pulse' },
    { key: 'video',   label: 'Video',   icon: 'play' },
    { key: 'other',   label: 'File',    icon: 'folder' },
  ];

  /* What a file can be attached to. The master instruction names these four. */
  const FILE_REF_META = [
    { type: 'task',    label: 'Task',    icon: 'check',  route: 'tasks' },
    { type: 'project', label: 'Project', icon: 'layers', route: 'projects' },
    { type: 'note',    label: 'Note',    icon: 'note',   route: 'notes' },
    { type: 'journal', label: 'Journal', icon: 'book',   route: 'journal' },
  ];
  const FILE_REF_TYPES = FILE_REF_META.map(m => m.type);

  /* The vocabulary of file kinds. `fileKind()` classifies a file into exactly one
     of these, and every surface — the row badge, the kind filter, the storage
     breakdown — reads its label, icon and colour from this one list, so a kind
     cannot exist in the classifier and be missing from the UI. */
  const FILE_KIND_META = [
    { kind: 'image',   label: 'Image',    icon: 'image',  color: 'var(--violet)' },
    { kind: 'text',    label: 'Text',     icon: 'file',   color: 'var(--cyan)' },
    { kind: 'sheet',   label: 'Sheet',    icon: 'sheet',  color: 'var(--good)' },
    { kind: 'doc',     label: 'Document', icon: 'file',   color: 'var(--blue)' },
    { kind: 'pdf',     label: 'PDF',      icon: 'file',   color: 'var(--bad)' },
    { kind: 'archive', label: 'Archive',  icon: 'archive',color: 'var(--warn)' },
    { kind: 'video',   label: 'Video',    icon: 'play',   color: 'var(--magenta)' },
    { kind: 'audio',   label: 'Audio',    icon: 'play',   color: 'var(--purple)' },
    { kind: 'other',   label: 'Other',    icon: 'folder', color: 'var(--text-2)' },
  ];
  const fileKindMeta = k =>
    FILE_KIND_META.find(m => m.kind === k)
    || { kind: k, label: 'File', icon: 'file', color: 'var(--text-2)' };

  /* The searchable surface of the workspace — Milestone 29.
     One list drives the scope chips, the group headers, the aside's index and
     the order ties break in, so a source cannot exist in the indexer and be
     missing from the UI. `route` is where a hit of that kind lives. */
  const SEARCH_SOURCES = [
    { key: 'task',        label: 'Tasks',    icon: 'check',    route: 'tasks',     color: 'var(--accent)' },
    { key: 'project',     label: 'Projects', icon: 'layers',   route: 'projects',  color: 'var(--violet)' },
    { key: 'goal',        label: 'Goals',    icon: 'target',   route: 'goals',     color: 'var(--indigo)' },
    { key: 'note',        label: 'Notes',    icon: 'note',     route: 'notes',     color: 'var(--cyan)' },
    { key: 'journal',     label: 'Journal',  icon: 'book',     route: 'journal',   color: 'var(--magenta)' },
    { key: 'inbox',       label: 'Inbox',    icon: 'inbox',    route: 'inbox',     color: 'var(--warn)' },
    { key: 'transaction', label: 'Finance',  icon: 'wallet',   route: 'finance',   color: 'var(--good)' },
    { key: 'file',        label: 'Files',    icon: 'folder',   route: 'files',     color: 'var(--purple)' },
    { key: 'habit',       label: 'Habits',   icon: 'repeat',   route: 'habits',    color: 'var(--blue)' },
    { key: 'event',       label: 'Calendar', icon: 'calendar', route: 'calendar',  color: 'var(--info)' },
    { key: 'activity',    label: 'Activity', icon: 'pulse',    route: 'activity',  color: 'var(--text-2)' },
  ];
  const searchSource = k =>
    SEARCH_SOURCES.find(s => s.key === k) || { key: k, label: 'Result', icon: 'file', route: 'dashboard', color: 'var(--text-2)' };

  /* Where a record of each kind lives. One table, so "open this record" means
     the same thing from the Files panel, the search results and anywhere else
     that follows a pointer. */
  const RECORD_ROUTES = { task: 'tasks', project: 'projects', goal: 'goals',
                          note: 'notes', journal: 'journal', file: 'files',
                          inbox: 'inbox', habit: 'habits', event: 'calendar',
                          transaction: 'finance', activity: 'activity' };

  /* Follow a pointer to the record it names. A page that can reveal a specific
     record does; the rest at least land on the right page.
     This table has to cover EVERY kind a search result can carry, because the
     one thing "follow this pointer" must never do is nothing at all — an entry
     missing from here made clicking an Inbox, Finance, Habits, Calendar or
     Activity search hit a silent dead end. */
  function revealRecord(type, id) {
    const route = RECORD_ROUTES[type];
    if (!route || !id) return;
    Overlay.close();
    const reveal = () => {
      if (type === 'task')         { if (typeof TaskDetail !== 'undefined') TaskDetail.open(id); }
      else if (type === 'project') { const p = State.projects.find(x => x.id === id); if (p && typeof ProjectDetail !== 'undefined') ProjectDetail.open(p.name); }
      else if (type === 'goal')    { if (typeof GoalDetail !== 'undefined') GoalDetail.open(id); }
      else if (type === 'note')    { if (typeof NotesPage !== 'undefined') NotesPage.openNote(id); }
      else if (type === 'journal') { if (typeof JournalPage !== 'undefined') JournalPage.openEntry(id); }
      else if (type === 'file')    { if (typeof FilesPage !== 'undefined') FilesPage.openPreview(id); }
      else if (type === 'inbox')   { if (typeof InboxPage !== 'undefined') InboxPage.focusItem(id); }
      else if (type === 'habit')   { if (typeof HabitDetail !== 'undefined') HabitDetail.open(id); }
      else if (type === 'event') {
        const ev = (State.upcoming || []).find(x => x.id === id);
        if (ev && typeof CalendarPage !== 'undefined') CalendarPage.openEvent(id, ev.date);
      }
      /* `transaction` and `activity` have no per-record surface to open, so the
         route above is the whole reveal — which is still the right page. */
    };
    if (Router.current === route) { reveal(); return; }
    Router.go(route);
    setTimeout(reveal, 90);
  }

  function fileKind(type, name) {
    const m = String(type || '').toLowerCase();
    const ext = String(name || '').toLowerCase().split('.').pop();
    const has = list => list.indexOf(ext) !== -1;
    if (m.indexOf('image/') === 0) return 'image';
    if (m === 'application/pdf' || has(['pdf'])) return 'pdf';
    if (m.indexOf('video/') === 0) return 'video';
    if (m.indexOf('audio/') === 0) return 'audio';
    if (/zip|tar|gzip|compressed|7z|rar/.test(m) || has(['zip', 'tar', 'gz', '7z', 'rar'])) return 'archive';
    if (/spreadsheet|excel|csv|tab-separated/.test(m) || has(['xls', 'xlsx', 'csv', 'tsv', 'ods'])) return 'sheet';
    if (/word|opendocument.text|rtf/.test(m) || has(['doc', 'docx', 'rtf', 'odt', 'pages'])) return 'doc';
    if (m.indexOf('text/') === 0) return has(['md', 'markdown', 'txt', 'log']) ? 'text' : 'doc';
    if (/json|xml|javascript|yaml|x-sh/.test(m)
        || has(['json', 'xml', 'yml', 'yaml', 'js', 'ts', 'css', 'html', 'md', 'txt'])) return 'text';
    return 'other';
  }

  /* Coerce any record into a valid file reference.
     A file record IS its bytes: the Blob travels on the record and everything
     shown about it — size, mime type, kind, extension — is derived from that Blob
     at render time. Nothing computable is ever stored, so a file's descriptor can
     never drift from its content, and a record with no bytes is not a file at all.
     Demo records carry a `minutesAgo` anchor, resolved once, here. */
  function normalizeFile(f) {
    const now = Date.now();
    const rel = typeof f.minutesAgo === 'number' ? f.minutesAgo * 60000
              : typeof f.hoursAgo === 'number' ? f.hoursAgo * 3600000 : null;
    let created = f.createdAt != null ? new Date(f.createdAt).getTime() : NaN;
    if (!isFinite(created)) created = rel != null ? now - rel : now;

    /* A pointer at what this file is attached to. A dangling pointer is kept and
       reported as missing rather than silently dropped — the same rule notes and
       inbox captures follow. */
    const refs = Array.isArray(f.refs)
      ? f.refs
          .filter(r => r && r.id && FILE_REF_TYPES.indexOf(r.type) !== -1)
          .map(r => ({ type: r.type, id: String(r.id) }))
          .filter((r, i, arr) => arr.findIndex(x => x.type === r.type && x.id === r.id) === i)
          .slice(0, 20)
      : [];

    const blob = (f.blob && typeof f.blob.size === 'number') ? f.blob : null;

    return {
      id: f.id || uid('fl'),
      name: String(f.name == null ? '' : f.name).trim().slice(0, 200) || 'Untitled file',
      label: String(f.label == null ? '' : f.label).trim().slice(0, 160),
      refs,
      createdAt: new Date(created).toISOString(),
      blob,
    };
  }

  /* The vocabulary of things the workspace logs. One list drives the activity
     filter chips, the row icons and colours, and the aside's breakdown — so a
     kind cannot exist in the log and be missing from the UI. `route` is where an
     entry of that kind belongs. */
  const ACTIVITY_KINDS = [
    { key: 'task',     label: 'Tasks',    icon: 'check',    route: 'tasks',     color: 'var(--accent)' },
    { key: 'project',  label: 'Projects', icon: 'layers',   route: 'projects',  color: 'var(--violet)' },
    { key: 'goal',     label: 'Goals',    icon: 'target',   route: 'goals',     color: 'var(--indigo)' },
    { key: 'habit',    label: 'Habits',   icon: 'repeat',   route: 'habits',    color: 'var(--blue)' },
    { key: 'focus',    label: 'Focus',    icon: 'focus',    route: 'focus',     color: 'var(--cyan)' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar', route: 'calendar',  color: 'var(--info)' },
    { key: 'note',     label: 'Notes',    icon: 'note',     route: 'notes',     color: 'var(--purple)' },
    { key: 'journal',  label: 'Journal',  icon: 'book',     route: 'journal',   color: 'var(--magenta)' },
    { key: 'inbox',    label: 'Inbox',    icon: 'inbox',    route: 'inbox',     color: 'var(--warn)' },
    { key: 'finance',  label: 'Finance',  icon: 'wallet',   route: 'finance',   color: 'var(--good)' },
    { key: 'file',     label: 'Files',    icon: 'folder',   route: 'files',     color: 'var(--purple)' },
    { key: 'review',   label: 'Reviews',  icon: 'star',     route: 'reviews',   color: 'var(--accent-2)' },
    { key: 'automation', label: 'Automation', icon: 'bolt', route: 'automation', color: 'var(--warn)' },
    { key: 'template', label: 'Templates', icon: 'sparkles', route: 'templates', color: 'var(--cyan)' },
    { key: 'other',    label: 'Workspace',icon: 'pulse',    route: 'dashboard', color: 'var(--text-2)' },
  ];
  const activityKind = k => ACTIVITY_KINDS.find(x => x.key === k) || ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];

  /* ======================================================================
     NOTIFICATIONS — Milestone 36

     A notification is a STATEMENT ABOUT THE WORKSPACE THAT IS CURRENTLY TRUE.
     Nothing here is authored: every alert is folded out of records the user
     already has, so an alert cannot describe something that did not happen and
     cannot outlive the condition that caused it. When nothing is true the list
     is empty and says so — no "welcome back" filler, no invented urgency.

     The one thing that CANNOT be derived is the user's own DECISION about an
     alert — whether they have read or dismissed it. That is an intention, so it
     is the only part that is stored (in Settings, like every other preference:
     small, synchronous, and no database version needed).

     That makes the alert KEY load-bearing. It has to be stable enough for a
     decision to attach to, and specific enough that a NEW occurrence is a
     different alert. So a day-scoped alert carries its day
     (`habit:h3:2026-09-14`) — dismissing today's nudge does not silence
     tomorrow's — while a record-scoped one carries only the record
     (`overdue:t10`), because the condition is the same condition until the task
     stops being late.

     `until` is what makes the stored map self-cleaning: the first day on which
     this alert can never recur (the next day for a day-scoped alert, the first
     of next month for a month-scoped one, `null` for a record-scoped one). A
     decision whose `until` has arrived is dropped — a past day never becomes
     current again.

     DELIBERATELY NOT A NOTIFICATION: anything about a goal or project deadline.
     Those are free-text labels (`'30 Sep'`), never resolved to a date anywhere
     in the app, so "this deadline has passed" is not derivable from the
     workspace — it would be an invented fact, which is the one thing a
     notification must never be.
     ====================================================================== */
  const NOTIFICATION_KINDS = [
    { key: 'overdue',    label: 'Overdue',    icon: 'clock',  route: 'tasks',      rank: 3, color: 'var(--bad)' },
    { key: 'budget',     label: 'Budgets',    icon: 'wallet', route: 'finance',    rank: 3, color: 'var(--bad)' },
    { key: 'habit',      label: 'Habits',     icon: 'repeat', route: 'habits',     rank: 2, color: 'var(--blue)' },
    { key: 'inbox',      label: 'Inbox',      icon: 'inbox',  route: 'inbox',      rank: 2, color: 'var(--warn)' },
    { key: 'journal',    label: 'Journal',    icon: 'book',   route: 'journal',    rank: 1, color: 'var(--magenta)' },
    { key: 'automation', label: 'Automation', icon: 'bolt',   route: 'automation', rank: 1, color: 'var(--warn)' },
  ];
  const notificationKind = k => NOTIFICATION_KINDS.find(x => x.key === k) || NOTIFICATION_KINDS[NOTIFICATION_KINDS.length - 1];
  /* An open capture older than this is "waiting too long" rather than merely
     unread. A threshold, not a deadline: it is a judgement the app is allowed to
     make, and it is stated here once so the copy and the rule cannot drift. */
  const NOTIFICATION_WAIT_DAYS = 3;
  /* The first day of the month AFTER `yyyy-mm` — the day a month-scoped alert can
     never recur. */
  function firstOfNextMonth(monthKey) {
    const y = Number(String(monthKey).slice(0, 4));
    const m = Number(String(monthKey).slice(5, 7));
    return m >= 12 ? (y + 1) + '-01-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01';
  }

  /* Coerce any activity record into a real entry.
     An entry used to store its own age as a display string — literally `'Just now'`
     — so an entry written yesterday still claimed to be just now, and the log could
     not be grouped by day at all. Age is a derivation, so the log now stores a real
     `createdAt` and the string is computed from it. Legacy entries are migrated
     ONCE: the relative token is resolved here and then persisted, exactly like a
     demo event's `dayOffset`. */
  function normalizeActivity(a) {
    const now = Date.now();
    let created = a.createdAt != null ? new Date(a.createdAt).getTime() : NaN;
    if (!isFinite(created)) {
      const at = String(a.at == null ? '' : a.at).trim().toLowerCase();
      const unit = /^(?:an?\s+)?\d+\s*(?:m|min|mins|minute|minutes)\b/.test(at) ? 60000
                 : /^(?:an?\s+)?\d+\s*(?:h|hr|hrs|hour|hours)\b/.test(at) ? 3600000
                 : /^(?:an?\s+)?\d+\s*(?:d|day|days)\b/.test(at) ? 86400000 : 0;
      if (unit) {
        const n = parseInt(at.replace(/^an?\s+/, ''), 10) || 0;
        created = now - n * unit;
      } else if (at === 'yesterday') {
        created = now - 86400000;
      } else if (typeof a.hoursAgo === 'number') {
        created = now - a.hoursAgo * 3600000;
      } else if (typeof a.daysAgo === 'number') {
        created = now - a.daysAgo * 86400000;
      } else {
        created = now;
      }
    }
    return {
      id: a.id || uid('a'),
      kind: ACTIVITY_KINDS.some(k => k.key === a.kind) ? a.kind : 'other',
      text: String(a.text == null ? '' : a.text).slice(0, 300),
      createdAt: new Date(created).toISOString(),
    };
  }

  /* ======================================================================
     REVIEW ENTITY — Milestone 32
     A review is a period the user closed and thought about. It stores ONLY what
     they wrote: which cadence, which period, a title, the reflection and a
     self-rating. Every figure shown beside a review is derived from the records
     of that period at the moment it is read, so a review can never quote a
     number the workspace no longer supports — the same rule the journal and the
     finance ledger follow.
     ====================================================================== */
  const REVIEW_KINDS = [
    { key: 'week',  label: 'Weekly',  unit: 'week',  icon: 'calendar' },
    { key: 'month', label: 'Monthly', unit: 'month', icon: 'chart' },
  ];
  const reviewKind = k => REVIEW_KINDS.find(x => x.key === k) || REVIEW_KINDS[0];

  /* The first day of the period a review covers. A week starts on Monday — the
     convention the calendar, the journal month grid and analytics already share —
     and a month starts on the 1st. */
  function reviewStart(kind, date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    if (kind === 'month') d.setDate(1);
    else d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(d);
  }

  /* A self-rating is 1–5, and `null` is a real value meaning "not rated" — 0 would
     mean "rated it the worst possible". Clamp at the boundary, keep null through
     the model. */
  function reviewRating(v) {
    if (v == null || v === '') return null;
    const n = Math.round(Number(v));
    return isFinite(n) && n >= 1 && n <= 5 ? n : null;
  }

  /* ======================================================================
     AUTOMATION ENTITY — Milestone 35
     A rule the user writes that runs itself. The record holds ONLY the
     intention: when it should fire and what it should make. It never holds a
     result. Every record a rule produced carries an `origin` stamp, and "what
     this rule has done" is the INVERSE of that link — recomputed on demand,
     the way `filesFor()` is the inverse of a file's pointers.

     There is no background process. A local-first, offline app cannot run a
     timer while it is closed, and a `setInterval` that "runs" rules only while
     the tab is open would be theatre — it would silently skip every occurrence
     that fell outside a session. So the engine is a fold: on load it asks what
     each rule SHOULD have produced by now and makes up the difference.
     ====================================================================== */
  const AUTOMATION_TRIGGERS = [
    { key: 'day',     label: 'Every day' },
    { key: 'weekday', label: 'Every weekday' },
    { key: 'week',    label: 'Every week' },
    { key: 'month',   label: 'Every month' },
  ];
  const AUTOMATION_ACTIONS = [
    { key: 'task',    label: 'Add a task',       icon: 'check' },
    { key: 'capture', label: 'Capture to Inbox', icon: 'inbox' },
    { key: 'note',    label: 'Add a note',       icon: 'note' },
  ];
  const automationTrigger = k =>
    AUTOMATION_TRIGGERS.find(x => x.key === k) || AUTOMATION_TRIGGERS[0];
  const automationAction = k =>
    AUTOMATION_ACTIONS.find(x => x.key === k) || AUTOMATION_ACTIONS[0];

  /* How many missed occurrences one run will make up. A rule left alone for
     three months must not dump ninety tasks into the workspace the moment the
     app opens; anything older than this is skipped, and the run says so. */
  const AUTOMATION_CATCHUP = 14;

  /* `trigger.dow` is 1 = Monday … 7 = Sunday (the ISO week), so it does not line
     up with `DOW` (0 = Monday) or with `Date.getDay()` (0 = Sunday). One table,
     read in one place, is cheaper than three off-by-one bugs. */
  const DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function ordinal(n) {
    const v = Math.round(Number(n)) || 1;
    const s = ['th', 'st', 'nd', 'rd'], k = v % 100;
    return v + (s[(k - 20) % 10] || s[k] || s[0]);
  }

  const autoText = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const autoInt = (v, lo, hi, d) => {
    const n = Math.round(Number(v));
    return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const autoKey = v => (AUTO_DAY_RE.test(String(v == null ? '' : v)) ? String(v) : null);

  /* A rule is a name, a schedule, an action and a high-water mark.
     `lastRun` is the day of the last occurrence actually made — a real fact
     about what the engine did, not a measurement that could be recomputed. It
     is what makes a run idempotent across reloads AND what makes deleting a
     created record permanent, instead of having it reappear on the next load. */
  function normalizeAutomation(r) {
    const now = new Date().toISOString();
    const t = r.trigger || {};
    const every = AUTOMATION_TRIGGERS.some(x => x.key === t.every) ? t.every : 'day';
    const a = r.action || {};
    const type = AUTOMATION_ACTIONS.some(x => x.key === a.type) ? a.type : 'task';
    const action = type === 'task'
      ? { type, title: autoText(a.title, 140) || 'Untitled task',
          project: autoText(a.project, 60) || 'Personal',
          priority: PRIORITIES.includes(a.priority) ? a.priority : 'Medium',
          dueIn: autoInt(a.dueIn, 0, 30, 0) }
      : type === 'capture'
      ? { type, text: autoText(a.text, 2000) || 'Untitled capture' }
      : { type, title: autoText(a.title, 140) || 'Untitled note',
          body: autoText(a.body, 4000) };
    return {
      id: r.id || uid('au'),
      name: autoText(r.name, 80) || 'Untitled rule',
      enabled: r.enabled !== false,
      trigger: {
        every,
        dow: autoInt(t.dow, 1, 7, 1),   // 1 = Monday … 7 = Sunday
        dom: autoInt(t.dom, 1, 28, 1),  // capped at 28 so every month has that day
        at: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t.at == null ? '' : t.at))
          ? String(t.at) : '08:00',
      },
      action,
      /* Demo anchors, resolved ONCE here and then persisted as real values —
         the same rule a demo task's `dueDaysAgo` and an event's `dayOffset`
         follow. Re-anchoring on every load would silently rewrite history. */
      lastRun: autoKey(r.lastRun)
        ?? (typeof r.lastRunDaysAgo === 'number'
            ? dayKey(shiftDays(new Date(), -r.lastRunDaysAgo)) : null),
      createdAt: r.createdAt || (typeof r.createdDaysAgo === 'number'
        ? new Date(Date.now() - r.createdDaysAgo * 86400000).toISOString()
        : now),
      updatedAt: r.updatedAt || now,
    };
  }

  /* ======================================================================
     TEMPLATES — Milestone 37
     A template is a NAMED BUNDLE OF RECORDS TO CREATE — the shape of a piece of
     work, kept so it never has to be rebuilt by hand. It is the third Pro
     feature, and it is deliberately Automation's SIBLING rather than a second
     copy of it: both speak the same action vocabulary (`AUTOMATION_ACTIONS`) and
     both resolve `{date}` the same way. They differ in the one way that matters:

       · a RULE is scheduled. It fires unattended, it is a fold over elapsed
         time, and running it twice changes nothing.
       · a TEMPLATE is invoked. You ask for it, now, and asking twice makes
         twice as much. That is not a bug — a template is a verb, not a calendar.

     The invariant that follows is the whole design: **a template stores a SHAPE,
     never a date.** Its only time field is an OFFSET (`dueIn`), resolved at the
     moment it is applied, because a template holding `due: '2026-09-17'` would
     be wrong the day after it was written.
     ====================================================================== */
  const TEMPLATE_ICONS = ['sparkles', 'bolt', 'target', 'book', 'brain', 'chart',
    'folder', 'repeat', 'star', 'layers', 'pulse', 'wallet'];
  const TEMPLATE_MAX_ITEMS = 12;
  const templateIcon = k => (TEMPLATE_ICONS.includes(k) ? k : 'sparkles');
  /* The noun for each action, so a bundle can be described in words. Kept beside
     the action table rather than derived from its labels, which are sentences. */
  const TEMPLATE_NOUNS = { task: 'task', capture: 'capture', note: 'note' };

  /* One item is an action, read from the SAME table an automation rule uses. A
     template that spoke its own dialect would be a second thing to keep in step
     with the first, and the first would drift. */
  function normalizeTemplateItem(a) {
    const src = a || {};
    const type = AUTOMATION_ACTIONS.some(x => x.key === src.type) ? src.type : 'task';
    if (type === 'capture') {
      return { type, text: autoText(src.text, 2000) || 'Untitled capture' };
    }
    if (type === 'note') {
      return { type, title: autoText(src.title, 140) || 'Untitled note',
        body: autoText(src.body, 4000) };
    }
    return {
      type: 'task',
      title: autoText(src.title, 140) || 'Untitled task',
      project: autoText(src.project, 60) || 'Personal',
      priority: PRIORITIES.includes(src.priority) ? src.priority : 'Medium',
      /* An offset, never a day. Capped at 30 so a template cannot quietly park
         work a month out — that is a scheduling decision, not a shape. */
      dueIn: autoInt(src.dueIn, 0, 30, 0),
    };
  }

  /* A template is a name, an icon and the records it makes. There is no date
     anywhere in it. Like every other normalizer here it REPAIRS rather than
     rejects: a template with no usable item would make nothing and could never
     be told apart from a mistake, so it falls back to one plain task and stays a
     record the user can open, edit or delete. */
  function normalizeTemplate(t) {
    const now = new Date().toISOString();
    const src = t || {};
    const items = (Array.isArray(src.items) ? src.items : [])
      .slice(0, TEMPLATE_MAX_ITEMS)
      .map(normalizeTemplateItem);
    return {
      id: src.id || uid('tp'),
      name: autoText(src.name, 80) || 'Untitled template',
      icon: templateIcon(src.icon),
      items: items.length ? items : [normalizeTemplateItem({ type: 'task' })],
      /* Demo anchors, resolved ONCE and then persisted as real values — the same
         rule a demo rule's `createdDaysAgo` follows. */
      createdAt: src.createdAt || (typeof src.createdDaysAgo === 'number'
        ? new Date(Date.now() - src.createdDaysAgo * 86400000).toISOString()
        : now),
      updatedAt: src.updatedAt || now,
    };
  }

  /* ======================================================================
     FEATURE ACCESS — Milestone 33
     What NEXUS Pro unlocks, in one list, and the ONE place that decides whether a
     feature is available. A gate that only shows a toast is a dead end, so
     `request()` names the feature and the upgrade page is one click away — and
     that page is honest that this is a local demo licence with no payment and no
     account, which really changes what the app allows and can be undone.

     One tier, one entitlement: `allows()` deliberately ignores its key, because
     there is exactly one thing to be. If a second tier ever arrives, this is the
     only function that has to learn about it.
     ====================================================================== */
  const FEATURES = [
    { key: 'time',       label: 'Time Machine',   icon: 'clock', route: 'time',
      blurb: 'Scrub the whole workspace back to any day it has a record for, and see exactly what it held then.' },
    { key: 'themes',     label: 'Premium themes', icon: 'sun',
      blurb: 'Six more colour schemes — cyber, aurora, nebula, obsidian, violet and monochrome.' },
    { key: 'automation', label: 'Automation',     icon: 'bolt',  route: 'automation',
      blurb: 'Rules that run themselves: recurring work, standing captures and notes that write themselves.' },
    { key: 'templates',  label: 'Templates',      icon: 'sparkles', route: 'templates',
      blurb: 'Bundles of records you keep and reuse — a project and its starter tasks in one click.' },
  ];
  const featureMeta = k =>
    FEATURES.find(f => f.key === k) || { key: k, label: 'This feature', icon: 'star', blurb: '' };

  /* ======================================================================
     PLAN CATALOGUE — the pricing page's one source of numbers
     ======================================================================
     A price is DATA, not a measurement, so it is written down here once and read
     everywhere. Nothing in this table is derived from the user's behaviour and
     nothing about the user is derived from this table — the two must not mix, or
     a change of price would look like a change of plan.

     Three things this table deliberately does NOT do:

     1. **It does not say what is free.** The free row is `PRO_FEATURE_MATRIX`,
        which reads `FEATURES` — so adding a Pro feature cannot leave the
        comparison table behind. A table with its own copy of the feature list
        would be stale the day a feature was added, and nothing would fail.
     2. **It does not compute the saving.** `PLANS` stores each price; the
        percentage off is `Derive.planSaving()` over two prices that both exist.
        A stored "save 33%" is a claim that can drift from the prices beside it.
     3. **It does not invent a currency conversion.** There is one currency and
        it is stated, once, in `PLANS`.

     `days` is the real billing period. It is what makes "renews on …" a
     derivation rather than a stored date that could be wrong, and it is why
     `yearly` is 365 rather than a hand-written renewal timestamp.
     ====================================================================== */
  const PLANS = {
    free: {
      key: 'free', label: 'Free', tagline: 'Everything core, forever',
      price: 0, days: null, cadence: '', note: 'No card, no account, no expiry.',
      cta: 'Your current plan',
    },
    monthly: {
      key: 'monthly', label: 'Pro', tagline: 'Billed monthly',
      price: 5, days: 30, cadence: 'per month', note: 'Cancel any time.',
      cta: 'Choose monthly',
    },
    yearly: {
      key: 'yearly', label: 'Pro', tagline: 'Billed yearly',
      price: 40, days: 365, cadence: 'per year', note: 'Two months free.',
      cta: 'Choose yearly', best: true,
    },
  };
  const PLAN_ORDER = ['free', 'monthly', 'yearly'];
  /* What the free tier includes, stated as capability rather than as a list of
     module names — the modules already are the app, and they are not for sale. */
  const FREE_INCLUDES = [
    'All sixteen core modules',
    'Unlimited tasks, notes, habits and records',
    'IndexedDB storage on your device',
    'Midnight and Light themes',
    'Export, import and demo reset',
    'NEXUS Score and Analytics',
  ];
  /* The comparison table's rows. `inFree` is the ONLY thing that differs between
     the two columns, so the table cannot grow a row that contradicts the gate. */
  const PRO_FEATURE_MATRIX = [
    ...FEATURES.map(f => ({ label: f.label, blurb: f.blurb, inFree: false, pro: false })),
    { label: 'Multiple workspaces', blurb: 'Keep a separate, switchable workspace for work, home or a side project — each with its own records, on the same device.', inFree: false, pro: false },
    { label: 'Cloud sync', blurb: 'Not built yet. NEXUS is local-first and does not have a server, so this is honestly listed as planned rather than sold as available.', inFree: false, pro: false, planned: true },
  ];
  const planMeta = k => PLANS[k] || PLANS.free;

  /* A date the way the rest of the app writes one — "13 Sep 2026". Used for the
     renewal line and the licence start, so the two cannot be formatted
     differently on the same card. */
  function fmtDate(d) {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* The pricing page's questions. These are answers to what the page itself
     raises — the local licence, the free tier, what happens on cancel — rather
     than a generic FAQ, and each one is answerable by the code beside it. */
  const PRICING_FAQ = [
    { q: 'Is the free tier a trial?',
      a: 'No. Every core module — tasks, projects, goals, calendar, habits, focus, notes, knowledge, journal, inbox, finance, files, activity, analytics, reviews and settings — is free with no record limit and no expiry. Pro adds four features that work across the whole workspace; it does not unlock the app.' },
    { q: 'How do I actually pay?',
      a: 'You do not, in this build. There is no payment processor and no account: choosing a plan activates a licence on this device, which is how all of your data is stored anyway. It is a real licence that really changes what the app allows — it just is not a real transaction, and the page says so rather than pretending.' },
    { q: 'What happens to my records if I cancel?',
      a: 'Nothing. Cancel returns the four Pro features to locked and leaves every task, note, project, file and log entry exactly where it is. Reactivating restores them.' },
    { q: 'Can I switch between monthly and yearly?',
      a: 'Yes, at any time and in either direction. Switching keeps the same licence, the same id and the same start date, and simply begins a new billing period today.' },
    { q: 'Does Pro follow me to another device?',
      a: 'No, and that is a deliberate consequence of being local-first: there is no server to sync a licence through. A licence lives on one device. Cloud sync is listed on the comparison table as planned, not as included.' },
  ];

  /* Coerce any stored licence into a valid one. The pricing page added two fields
     (`billing`, `periodStart`) that M33 licences do not have, and an activated Pro
     licence written before this milestone would come back from IndexedDB without
     them — leaving a Pro user on no billing period, which the page would then have
     to guess at. A Pro licence with no recorded period is dated from its own
     `startDate`, which every M33 licence does carry, and defaults to monthly. */
  function normalizeEntitlement(e) {
    const base = { ...DEMO.entitlement, ...(e || {}) };
    const pro = base.status === 'PRO';
    const billing = pro && PLANS[base.billing] && PLANS[base.billing].price > 0
      ? base.billing : (pro ? 'monthly' : null);
    const periodStart = pro ? (base.periodStart || base.startDate || null) : null;
    return { ...base, billing, periodStart };
  }

  const FeatureAccess = {
    allows() {
      return !!(State.data && State.entitlement && State.entitlement.status === 'PRO');
    },
    /* The whole list with its live lock state — the upgrade page reads this. */
    list() {
      return FEATURES.map(f => ({ ...f, unlocked: this.allows(f.key) }));
    },
    /* Ask for a feature. True when it is available; otherwise it says which
       feature is in the way and returns false so the caller can stop. */
    request(key) {
      if (this.allows(key)) return true;
      Toast.show(`${featureMeta(key).label} is part of NEXUS Pro`, 'warn');
      return false;
    },
  };

  /* The one locked state a gated page shows: what the feature is, why it is
     locked, and the single place that can change the answer. */
  function renderLocked(mount, key) {
    const f = featureMeta(key);
    mount.innerHTML = '';
    mount.append(el('div', { class: 'page is-active', html: `
      <div class="tasks-head page-head">
        <div>
          <div class="t-eyebrow">${esc(f.label)}</div>
          <h1>${esc(f.label)}</h1>
          <div class="sub">Part of NEXUS Pro.</div>
        </div>
      </div>
      <div class="card" style="margin-top:var(--sp-4)"><div class="empty">
        <div class="empty-ic">${icon(f.icon, 22)}</div>
        <h4>${esc(f.label)} is a Pro feature</h4>
        <p>${esc(f.blurb || '')}</p>
        <button class="btn btn-primary btn-sm" data-go-pro style="margin-top:var(--sp-3)">
          ${icon('sparkles', 13)} See what Pro adds</button>
      </div></div>
    ` }));
    Shell.setHeader(f.label, 'Pro');
    const btn = $('[data-go-pro]', mount);
    if (btn) btn.addEventListener('click', () => Router.go('pro'));
  }

  /* Coerce any record into a valid review. The period is snapped to its real
     boundary, so a review can never claim a week that does not start on Monday.
     Demo reviews carry a `weeksAgo` / `monthsAgo` anchor that resolves once here. */
  function normalizeReview(r) {
    const kind = REVIEW_KINDS.some(k => k.key === r.kind) ? r.kind : 'week';
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(String(r.start || '')) ? String(r.start) : null;
    let base;
    if (raw) base = new Date(raw + 'T12:00:00');
    else if (typeof r.weeksAgo === 'number') base = shiftDays(new Date(), -r.weeksAgo * 7);
    else if (typeof r.monthsAgo === 'number') {
      base = new Date();
      base.setDate(1);
      base.setMonth(base.getMonth() - r.monthsAgo);
    } else base = new Date();
    const start = reviewStart(kind, base);
    const now = new Date().toISOString();
    return {
      id: r.id || uid('rv'),
      kind, start,
      title: String(r.title == null ? '' : r.title).trim().slice(0, 140),
      body: String(r.body == null ? '' : r.body).slice(0, 20000),
      rating: reviewRating(r.rating),
      createdAt: r.createdAt || now,
      updatedAt: r.updatedAt || now,
    };
  }

  /* Coerce any record (legacy demo shape included) into a valid Task. */
  function normalizeTask(t) {
    const now = new Date().toISOString();
    /* The due date is a real day key, resolved ONCE here and then persisted.
       Anything that is already a key keeps it; a relative token from the demo
       seed or from a record written before M34 is parsed through the boundary
       parser — the same one the input path uses — so there is exactly one rule
       for what a token means. `dueDate` is honoured as a legacy alias and then
       dropped, because two names for one date is how they drift apart. */
    const rawDue = t.dueDate ?? t.due ?? null;
    /* `dueDaysAgo` is the demo's anchor for a due date: relative, resolved ONCE
       here, then persisted as a real key — the same rule a demo event's
       `dayOffset` and a task's `doneDaysAgo` follow. */
    const due = parseDueToken(rawDue)
      ?? (typeof t.dueDaysAgo === 'number' ? dayKey(shiftDays(new Date(), t.dueDaysAgo)) : null);
    const status = t.status
      || (t.done ? 'done' : 'today');
    return {
      id: t.id || uid('t'),
      title: t.title || 'Untitled task',
      description: t.description || '',
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
      status,
      /* A creation date is a real fact. The demo anchors it once, the way it
         anchors a completion, so a per-day score has a history to fold. */
      createdAt: t.createdAt || (typeof t.createdDaysAgo === 'number'
        ? new Date(Date.now() - t.createdDaysAgo * 86400000).toISOString()
        : now),
      updatedAt: t.updatedAt || now,
      due,                                     // the real due day key, or null
      startDate: t.startDate || null,
      /* A completion date is a real fact about a task. A demo task that is already
         done carries a relative anchor that resolves ONCE, here — the same rule
         demo events (`dayOffset`) and the activity log follow — so a completion
         trend has real dates to draw. */
      completedAt: t.completedAt || (t.done && typeof t.doneDaysAgo === 'number'
        ? new Date(Date.now() - t.doneDaysAgo * 86400000).toISOString()
        : null),
      estimate: t.estimate ?? null,
      actualMinutes: t.actualMinutes || 0,
      projectId: t.projectId || null,
      project: t.project || null,              // display name (demo convenience)
      goalId: t.goalId || null,
      workspaceId: t.workspaceId || 'personal',
      tags: Array.isArray(t.tags) ? t.tags : [],
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
      attachments: Array.isArray(t.attachments) ? t.attachments : [],
      recurrence: t.recurrence || null,
      origin: normalizeOrigin(t.origin),
      archived: !!t.archived || status === 'archived',
      done: !!t.done || status === 'done',    // derived flag kept in sync
    };
  }

  /* --- DEMO WORKSPACE ---------------------------------------------------- */
  /* Behaves exactly like real data: every widget reads from State. */
  /* Demo focus log — a REAL session log, generated deterministically.

     The reference design shows a big "this month" focus total. Rather than
     shipping that as a stored number (which would drift the moment a session
     was logged), we ship the *sessions that produce it* and derive every total
     from them. A tiny seeded LCG keeps the pattern plausible and identical on
     every machine — never Math.random(), so the demo cannot flicker.

     Shape of the log: a live 6-day streak (days 0–5 always have focus blocks),
     day 6 deliberately empty so the streak is exactly 6, then a realistic
     ~2-in-3 chance of any earlier day having work. Anchors are absolute
     timestamps resolved at definition time, so the log is "the last 30 days"
     on first seed and then ages naturally as real history. */
  function buildDemoFocus() {
    const BLOCKS = [
      { mode: 'focus', minutes: 50 },
      { mode: 'focus', minutes: 45 },
      { mode: 'focus', minutes: 25 },
      { mode: 'focus', minutes: 60 },
      { mode: 'break', minutes: 5  },
      { mode: 'focus', minutes: 25 },
    ];
    /* Real task ids from DEMO.tasks, plus nulls so some sessions are unlinked. */
    const LINKS = ['t17', 't1', 't5', 't19', 't9', 't2', 't4', null, null, 't7', null];
    const out = [];
    /* mulberry32 — small, deterministic and well distributed. (A naive LCG
       loses precision once `seed * multiplier` exceeds 2^53, which produced a
       degenerate, block-starved log: whole days came out with a single 25-min
       block and the "today" total was a fifth of what the pattern implies.) */
    let seed = 20260913;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    for (let back = 29; back >= 0; back--) {
      if (back === 6) continue;                    // one real gap — the streak is 6
      const streakDay = back <= 5;
      if (!streakDay && rnd() < 0.34) continue;    // some days had no focus at all
      const blocks = streakDay ? 4 + Math.floor(rnd() * 2)
                               : 2 + Math.floor(rnd() * 3);
      /* Today's blocks must already have happened — a demo log that contains
         work scheduled for later this evening would be a lie, and would
         inflate today's total with time not yet spent. */
      const today = back === 0;
      const nowH = new Date().getHours();
      let hour = today ? Math.max(0, nowH - blocks)
                       : 8 + Math.floor(rnd() * 3);
      for (let b = 0; b < blocks; b++) {
        const pick = BLOCKS[Math.floor(rnd() * BLOCKS.length)];
        const d = shiftDays(new Date(), -back);
        d.setHours(Math.min(23, Math.max(0, hour)), Math.floor(rnd() * 55), 0, 0);
        const startedAt = d.getTime();
        hour += today ? 1 : 1 + Math.floor(rnd() * 2);
        out.push({
          id: 'f' + back + '_' + b,
          mode: pick.mode,
          minutes: pick.minutes,
          startedAt,
          endedAt: startedAt + pick.minutes * 60000,
          taskId: LINKS[Math.floor(rnd() * LINKS.length)],
        });
      }
    }
    return out;
  }

  /* Demo transaction log — a REAL log, generated deterministically.

     The reference shows a month income/expense total and a category breakdown.
     Shipping those as stored numbers would be exactly the drift this codebase
     forbids, so we ship the *transactions that produce them* and derive every
     figure from the log. The same seeded mulberry32 as the focus demo keeps the
     pattern plausible and identical on every machine — never Math.random().

     Shape: five months of history. Every month gets a salary, rent and the
     recurring bills, then a realistic spread of discretionary spending. The
     current month only contains days that have already happened, so "this month"
     can never show money spent in the future. */
  function buildDemoTransactions() {
    let seed = 20260913;
    const rnd = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    const money = n => Math.round(n / 10) * 10;

    /* The discretionary spread: how often, how much, and how it is filed. */
    const SPREAD = [
      { category: 'Food',          label: 'Groceries',     lo: 240,  hi: 980,  per: [5, 9] },
      { category: 'Transport',     label: 'Fuel',          lo: 300,  hi: 900,  per: [2, 4] },
      { category: 'Subscriptions', label: 'Design tool',   lo: 899,  hi: 899,  per: [1, 1] },
      { category: 'Health',        label: 'Pharmacy',      lo: 180,  hi: 1200, per: [0, 2] },
      { category: 'Learning',      label: 'Course module', lo: 499,  hi: 1800, per: [0, 2] },
      { category: 'Fun',           label: 'Cinema',        lo: 350,  hi: 900,  per: [1, 3] },
      { category: 'Food',          label: 'Lunch out',     lo: 180,  hi: 620,  per: [3, 6] },
      { category: 'Other',         label: 'Household',     lo: 250,  hi: 1100, per: [1, 3] },
    ];

    const now = new Date();
    const out = [];
    let n = 0;

    for (let back = 4; back >= 0; back--) {
      const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const y = base.getFullYear();
      const m = base.getMonth();
      const daysIn = new Date(y, m + 1, 0).getDate();
      const lastDay = back === 0 ? now.getDate() : daysIn;

      const push = (dayNum, label, amount, category, type) => {
        if (dayNum < 1 || dayNum > lastDay) return;
        out.push({
          id: 'x' + (++n),
          label,
          amount: money(amount),
          type: type || 'expense',
          category,
          day: dayKey(new Date(y, m, dayNum)),
        });
      };

      push(pick(1, 2), 'Monthly salary', 48000, 'Salary', 'income');
      push(pick(2, 4), 'Rent', 7500, 'Housing');
      push(pick(3, 6), 'Electricity', pick(900, 1900), 'Housing');
      push(pick(4, 8), 'Internet', 999, 'Subscriptions');
      if (rnd() < 0.55) push(pick(12, 24), 'Freelance project', pick(6000, 14000), 'Freelance', 'income');

      SPREAD.forEach(sp => {
        const count = pick(sp.per[0], sp.per[1]);
        for (let i = 0; i < count; i++) push(pick(1, lastDay), sp.label, pick(sp.lo, sp.hi), sp.category);
      });
    }
    return out;
  }

  /* Demo files — REAL content, generated deterministically.
     A file list with no bytes behind it would be rows that cannot be opened, so
     every demo file carries actual content that is stored as a Blob on first seed.
     The metadata is derived FROM the Blob, so the size shown is the true size, and
     every ref points at a record that really exists in the demo workspace. */
  function buildDemoFiles() {
    const specs = [
      {
        id: 'fl1', name: 'NEXUS brand notes.md', mime: 'text/markdown', minutesAgo: 40,
        label: 'Colour and type rules',
        refs: [{ type: 'project', id: 'p4' }, { type: 'note', id: 'n4' }],
        text: `# NEXUS — brand notes

## Surfaces
Deep navy, near-black. One accent colour per view, never five.

## Type
Inter, with a system fallback. Tight tracking on display sizes.

## Rules
- Numbers explain themselves: "4 of 7 done" beats "57%".
- Empty states teach the first action instead of apologising.
- Motion stays between 150 and 300ms.
`,
      },
      {
        id: 'fl2', name: 'launch-checklist.csv', mime: 'text/csv', minutesAgo: 180,
        label: 'Vertical slice release',
        refs: [{ type: 'task', id: 't19' }],
        text: `item,owner,status
Store page copy,Alex,done
Trailer cut,Alex,in progress
Press kit,Alex,todo
Build signing,Alex,todo
Day-one patch notes,Alex,todo
`,
      },
      {
        id: 'fl3', name: 'track-layout.svg', mime: 'image/svg+xml', minutesAgo: 600,
        label: 'Layout sketch',
        refs: [{ type: 'project', id: 'p1' }],
        text: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b3a"/><stop offset="1" stop-color="#0b0b18"/></linearGradient></defs><rect width="480" height="300" fill="url(#g)"/><path d="M40 240 C 120 240, 150 90, 240 90 S 360 200, 440 200" fill="none" stroke="#6366F1" stroke-width="10" stroke-linecap="round"/><path d="M40 260 C 120 260, 150 130, 240 130 S 360 230, 440 230" fill="none" stroke="#06B6D4" stroke-width="4" stroke-linecap="round" stroke-dasharray="12 10"/><circle cx="240" cy="90" r="7" fill="#EC4899"/><text x="40" y="46" fill="#c7cbe0" font-family="Inter, sans-serif" font-size="19">Track 03 - layout sketch</text></svg>`,
      },
      {
        id: 'fl4', name: 'budget-2026.csv', mime: 'text/csv', minutesAgo: 1500,
        label: '', refs: [],
        text: `month,income,spend,net
2026-05,48000,21400,26600
2026-06,54000,23900,30100
2026-07,48000,20150,27850
2026-08,48000,24660,23340
2026-09,48000,22630,25370
`,
      },
      {
        id: 'fl5', name: 'reading-notes.txt', mime: 'text/plain', minutesAgo: 2600,
        label: 'Deep Work',
        refs: [{ type: 'journal', id: 'j10' }],
        text: `Deep Work - notes

- Attention is the scarce resource, not time.
- Shallow work feels productive and is not.
- Ritual beats willpower: same place, same start time.
- Track the hours honestly; guessing inflates them by about a third.
`,
      },
      {
        id: 'fl6', name: 'ux-references.md', mime: 'text/markdown', minutesAgo: 3200,
        label: '', refs: [{ type: 'note', id: 'n4' }],
        text: `Patterns worth stealing

- Empty states that teach the first action.
- Optimistic UI on anything that would otherwise feel slow.
- Progress you can see: a ring, a bar, a streak.
- Dark surfaces with one accent colour, not five.
`,
      },
    ];
    return specs.map(s => ({
      id: s.id,
      name: s.name,
      label: s.label,
      refs: s.refs,
      minutesAgo: s.minutesAgo,
      // The bytes ARE the file — size and mime type are derived from this Blob.
      blob: new Blob([s.text], { type: s.mime }),
    }));
  }
  const DEMO_FILES = buildDemoFiles();

  const DEMO = {
    schema: 'nexus.workspace',
    version: 1,
    /* `onboardedAt: null` means this workspace has never been set up, which is
       what makes the first run identifiable. `focus` is empty because it can only
       come from the user answering. */
    user: { name: 'Alex', joined: '2026-01-12', focus: [], onboardedAt: null },
    entitlement: {
      plan: 'FREE', status: 'FREE', source: 'local-demo',
      /* `billing` names which row of PLANS this licence came from, and
         `periodStart` is when that period began. The renewal date is NOT stored —
         it is `periodStart + plan.days` (see Derive.planRenews), because a stored
         renewal date is a second copy of a fact the period already carries. */
      billing: null, periodStart: null,
      startDate: null, endDate: null, licenseId: null, lastVerified: null,
    },
    /* Tasks a demo user has already finished carry `doneDaysAgo`, a relative
       anchor that resolves ONCE into a real `completedAt` (see normalizeTask).
       Without it a completion trend would have no dates to draw. */
    tasks: [
      /* NEXUS App */
      { id:'t1',  title:'Finish dashboard UI',      priority:'High',   project:'NEXUS App',         dueDaysAgo:0,  createdDaysAgo:12, done:true,  estimate:120, doneDaysAgo:1 },
      { id:'t7',  title:'Update documentation',     priority:'Low',    project:'NEXUS App',         dueDaysAgo:0,  createdDaysAgo:14, done:true,  estimate:45,  doneDaysAgo:2 },
      { id:'t9',  title:'Refactor score engine',    priority:'Medium', project:'NEXUS App',         dueDaysAgo:-1, createdDaysAgo:16, done:true,  estimate:90,  doneDaysAgo:1 },
      { id:'t10', title:'Wire the command palette', priority:'High',   project:'NEXUS App',         dueDaysAgo:1,  createdDaysAgo:9,  done:false, estimate:60 },
      { id:'t11', title:'Persist state to IndexedDB',priority:'High',  project:'NEXUS App',         dueDaysAgo:2,  createdDaysAgo:9,  done:false, estimate:75 },

      /* Marketing Website */
      { id:'t2',  title:'Fix mobile layout',        priority:'High',   project:'Marketing Website', dueDaysAgo:0,  createdDaysAgo:5,  done:true,  estimate:60,  doneDaysAgo:0 },
      { id:'t12', title:'Rewrite the pricing page', priority:'Medium', project:'Marketing Website', dueDaysAgo:-5, createdDaysAgo:20, done:true,  estimate:40,  doneDaysAgo:5 },
      { id:'t13', title:'Compress hero images',     priority:'Low',    project:'Marketing Website', dueDaysAgo:4,  createdDaysAgo:11, done:false, estimate:25 },

      /* YouTube Channel — feeds the "Grow the channel" goal */
      { id:'t3',  title:'Plan content strategy',    priority:'Medium', project:'YouTube Channel',   dueDaysAgo:-6, createdDaysAgo:18, done:true,  estimate:50, goalId:'g3', doneDaysAgo:6 },
      { id:'t14', title:'Record the intro segment', priority:'Medium', project:'YouTube Channel',   dueDaysAgo:2,  createdDaysAgo:7,  done:true,  estimate:80, goalId:'g3', doneDaysAgo:1 },
      { id:'t15', title:'Design thumbnail template',priority:'Low',    project:'YouTube Channel',   dueDaysAgo:5,  createdDaysAgo:6,  done:false, estimate:35, goalId:'g3' },

      /* Racing Game — feeds the "Ship my game" goal */
      { id:'t16', title:'Tune the drift physics',   priority:'High',   project:'Racing Game',       dueDaysAgo:0,  createdDaysAgo:10, done:true,  estimate:150, goalId:'g1', doneDaysAgo:0 },
      { id:'t17', title:'Build the track editor',   priority:'Medium', project:'Racing Game',       dueDaysAgo:6,  createdDaysAgo:8,  done:false, estimate:240, goalId:'g1' },
      { id:'t18', title:'Add engine sound layers',  priority:'Low',    project:'Racing Game',       dueDaysAgo:-3, createdDaysAgo:15, done:false, estimate:60,  goalId:'g1' },
      { id:'t19', title:'Ship the vertical slice',  priority:'High',   project:'Racing Game',       dueDaysAgo:-2, createdDaysAgo:25, done:true,  estimate:180, goalId:'g1', doneDaysAgo:2 },

      /* Life areas — Health feeds "Get properly fit" */
      { id:'t4',  title:'Workout for 45 minutes',   priority:'Medium', project:'Health',            dueDaysAgo:0,  createdDaysAgo:30, done:false, estimate:45, goalId:'g2' },
      { id:'t8',  title:'Water 8 glasses',          priority:'Low',    project:'Health',            dueDaysAgo:-4, createdDaysAgo:30, done:true,  goalId:'g2', doneDaysAgo:4 },
      { id:'t20', title:'Book the annual check-up', priority:'Low',    project:'Health',            dueDaysAgo:-18,createdDaysAgo:40, done:true,  goalId:'g2', doneDaysAgo:18 },
      { id:'t5',  title:'Read 10 pages',            priority:'Low',    project:'Learning',          dueDaysAgo:-24,createdDaysAgo:45, done:true,  doneDaysAgo:24 },
      { id:'t6',  title:'Plan next week',           priority:'Low',    project:'Personal',          dueDaysAgo:3,  createdDaysAgo:4,  done:false, estimate:20 },
    ],
    /* Projects carry only identity and goals — never a stored progress number.
       Every percentage shown anywhere is derived from these projects' tasks. */
    projects: [
      { id:'p1', name:'Racing Game',      status:'Active', deadline:'28 Sep', color:'violet'  },
      { id:'p2', name:'Marketing Website',status:'Active', deadline:'18 Sep', color:'cyan'    },
      { id:'p3', name:'YouTube Channel',  status:'Active', deadline:'04 Oct', color:'magenta' },
      { id:'p4', name:'NEXUS App',        status:'Active', deadline:'30 Sep', color:'indigo'  },
    ],
    /* Goals carry only identity and intent — never a stored progress number.
       A goal's progress is the completion ratio of the tasks linked to it via
       task.goalId, computed on every render by Derive.goalStats(). */
    goals: [
      { id:'g1', name:'Ship my game',        area:'Career',  deadline:'30 Sep', horizon:'Quarter', color:'violet',  why:'Finish and publish the racing game I have been building on weekends.' },
      { id:'g2', name:'Get properly fit',    area:'Health',  deadline:'31 Dec', horizon:'Year',    color:'cyan',    why:'Build a body and a routine I can keep for the next decade.' },
      { id:'g3', name:'Grow the channel',    area:'Creative',deadline:'04 Oct', horizon:'Quarter', color:'magenta', why:'Turn a side project into an audience that funds itself.' },
    ],
    /* Habits carry NO streak and NO completion counter.
       `history` is the append-only record of days the habit was completed —
       the ONLY truth about a habit's past. Streak, best-streak, 7/30-day
       completion rates and heatmaps are all derived from it. `dayOffset` is
       resolved once at hydrate time (see normalizeHabit) so the demo always
       looks current without shipping frozen dates. */
    habits: [
      { id:'h1', name:'Read 30 minutes', icon:'book',  color:'cyan',    history:[0,-1,-2,-3,-4,-5,-6,-7,-8,-9,-10,-12,-14] },
      { id:'h2', name:'Workout',         icon:'flame', color:'magenta', history:[-1,-2,-3,-4,-6,-7,-9,-11,-13] },
      { id:'h3', name:'Meditate',        icon:'focus', color:'violet',  history:[-2,-3,-4,-5,-6,-8,-9,-11,-14] },
      { id:'h4', name:'Deep work block', icon:'bolt',  color:'indigo',  history:[0,-1,-2,-3,-5,-8,-10,-13] },
      { id:'h5', name:'Drink 2L water',  icon:'drop',  color:'blue',    history:[-3,-6,-9,-12] },
    ],
    /* Notes are the one collection that is genuinely user-authored rather than
       derived — a title, a body, tags and real timestamps. `hoursAgo` is a
       relative anchor resolved ONCE at hydrate (see normalizeNote), so the demo
       always reads as recently edited without shipping frozen dates.

       `parentId` builds the knowledge hierarchy: a note can live inside another
       note. `[[Title]]` inside a body is a wiki link — links and backlinks are
       DERIVED from the text, never stored. `refs` point at real workspace
       objects (tasks / projects / goals). */
    notes: [
      { id:'n1', title:'Game Ideas', tags:['game','ideas'], favorite:true, pinned:true, hoursAgo:3,
        refs:[{ type:'project', id:'p1' }, { type:'goal', id:'g1' }],
        body: `Core loop: race → earn → upgrade → race again.

Worth prototyping:
- A ghost replay of your own best lap, not other players'. Cheaper to build and more motivating.
- Tracks that change with the weather, so no two laps are identical.
- Upgrade parts that trade off against each other — a faster engine costs grip.

Cut from v1: multiplayer, car customisation, seasons.

Launch thinking lives in [[Marketing Plan]]; interface references in [[UX Inspiration]].` },

      { id:'n2', title:'Marketing Plan', tags:['marketing','launch'], hoursAgo:26,
        parentId:'n1', refs:[{ type:'project', id:'p2' }],
        body: `Positioning: the fastest way for a small team to ship a landing page that converts.

Week 1 — message and structure
Week 2 — copy pass, then design
Week 3 — build, then instrument

Channels, in order of expected return:
1. Existing audience (email + the channel)
2. Two guest posts on niche blogs
3. Product Hunt — only once the page is actually good

The metric that matters is sign-up rate, not traffic.
The thing being marketed is described in [[Game Ideas]].` },

      { id:'n3', title:'Book Notes', tags:['reading','deep work'], hoursAgo:52,
        body: `Reading notes — Deep Work

- Attention is the scarce resource, not time. Protect blocks, not hours.
- Shallow work feels productive and is not. It expands to fill whatever space it is given.
- Ritual beats willpower: same place, same start time, same drink.
- Track the hours honestly. Guessing inflates them by about a third.

To try next week: one 90-minute block before opening the inbox.` },

      { id:'n4', title:'UX Inspiration', tags:['design','ux'], favorite:true, hoursAgo:8,
        parentId:'n1', refs:[{ type:'project', id:'p4' }, { type:'task', id:'t17' }],
        body: `Patterns worth stealing:

- Empty states that teach the first action instead of apologising.
- Optimistic UI on anything that would otherwise feel slow.
- Progress you can see: a ring, a bar, a streak — something that moves.
- Numbers that explain themselves. "4 of 7 done" beats "57%".
- Dark surfaces with one accent colour, not five.

Avoid: tooltips that hide essential information, and confirmation dialogs for
actions that are trivially reversible.

The discipline behind this is in [[Book Notes]].` },
    ],
    /* Journal entries are authored content: the body and the three self-ratings
       are the only things only the user can supply, so they are the only things
       stored. The streak, the averages, the month grid and the search ranking
       are all derived from these records. `dayOffset` is a demo-relative anchor
       (0 = today) resolved ONCE at hydrate time — see normalizeJournal.
       Today is deliberately left unwritten so the composer's invitation is live. */
    journal: [
      { id:'j1', dayOffset:-1, mood:4, energy:4, productivity:5, tags:['work','deep work'],
        title:'Shipped the track editor',
        body: `Got the track editor into a state I would actually show someone. The spline handles were fighting me all morning — turned out I was rebuilding the control points on every frame instead of only on drag. Two lines.

Afternoon was the best block I have had in weeks: three uninterrupted hours, no context switching, and the physics tuning finally felt right. The drift stops snapping when you feather the throttle.

Lesson: the bug was not in the maths, it was in where I put the maths.` },

      { id:'j2', dayOffset:-2, mood:3, energy:3, productivity:4, tags:['work'],
        title:'Slow start, good afternoon',
        body: `Morning was a write-off — inbox, then a call that could have been a message. I let it set the tone for too long.

Recovered after lunch by closing everything and giving the landing page copy a proper pass. Sharper than it was, and shorter.

Note to self: do not open the inbox before the first block. It is not discipline, it is just ordering.` },

      { id:'j3', dayOffset:-3, mood:5, energy:4, productivity:4, tags:['health','running'],
        title:'Long run and a clear head',
        body: `Eleven kilometres along the river before the day started properly. Cold enough that the first two were unpleasant and the rest were easy.

The good part was afterwards: the whole project plan reorganised itself in my head while I was not trying to think about it. Wrote it down over breakfast and it still made sense at lunch.

Movement is the cheapest way to think.` },

      { id:'j4', dayOffset:-5, mood:4, energy:3, productivity:3, tags:['work','meetings'],
        title:'Mostly meetings',
        body: `Four calls, one decision. The decision was a good one — we are cutting multiplayer from the first release and I think that is finally the right call rather than a retreat.

Low output day but not a wasted one. Some days buy the next three.` },

      { id:'j5', dayOffset:-6, mood:2, energy:2, productivity:2, tags:['rest','hard day'],
        title:'Flat day',
        body: `Slept badly and it showed. Everything felt like walking through wet sand. Tried to force a focus block in the afternoon and produced twenty minutes of nothing useful before giving up.

Stopped at six, made something proper for dinner, went to bed early. Not every day has to be a data point in the right direction.

The honest note is that I tried to push through instead of resting, and both the work and the evening were worse for it.` },

      { id:'j6', dayOffset:-8, mood:4, energy:5, productivity:4, tags:['focus'],
        title:'Best focus week yet',
        body: `Six days with a real block in each. The timer is doing more than I expected — knowing the block is only twenty-five minutes makes starting much cheaper.

The pattern I can see in the numbers: I am strongest between nine and noon, and I keep scheduling admin into that window. Moving it.` },

      { id:'j7', dayOffset:-11, mood:3, energy:3, productivity:3, tags:['admin'],
        title:'',
        body: `Untidy day. Cleared the backlog of small things that had been quietly costing me attention all week: invoices, two support replies, the storage cleanup.

Nothing worth reporting, which is itself worth reporting. The floor got swept.` },

      { id:'j8', dayOffset:-14, mood:5, energy:4, productivity:5, tags:['game','work'],
        title:'The vertical slice is fun',
        body: `First time the game has been fun rather than promising. The ghost replay of your own best lap changed the whole feel — suddenly there is a reason to do one more run.

Everything after this is polish and volume, and I know how to do both.

Worth remembering how long the "is this even good" phase lasted: about five months.` },

      { id:'j9', dayOffset:-19, mood:3, energy:2, productivity:3, tags:[],
        title:'Tired but steady',
        body: `Low energy, no particular reason. Kept the streak alive with a short block and the reading habit, then stopped.

Consistency over intensity is starting to feel less like a slogan and more like the actual mechanism.` },

      { id:'j10', dayOffset:-23, mood:4, energy:4, productivity:4, tags:['reading'],
        title:'Reading week',
        body: `Two books finished. The second one argued that attention is the scarce resource and that most productivity advice is about arranging the deck chairs. I think it is right.

Trying one 90-minute block before the inbox for the next fortnight and seeing what it does to the week.` },

      /* No ratings at all — a day that was logged but not scored. The UI has to
         stay honest about that rather than inventing a middle-of-the-road 3. */
      { id:'j11', dayOffset:-27, mood:null, energy:null, productivity:null, tags:[],
        title:'',
        body: `Travelling most of the day. Nothing worth a rating, but I wanted the record to be continuous rather than to look like I skipped it.` },
    ],
    /* Inbox — raw captures, before they have a home. The text and the kind are
       the only authored things; the counts, the ages and the ranking are derived.
       `hoursAgo` / `processedHoursAgo` are demo-relative anchors resolved ONCE at
       hydrate (see normalizeInbox). Two items are already processed so both
       converted states are visible on first load: one pointing at a real task,
       and one whose target was deleted — reported missing rather than hidden. */
    inbox: [
      { id:'i1', kind:'link', text:'The piece on attention being the scarce resource, not time',
        url:'https://example.com/attention', hoursAgo:2 },
      { id:'i2', kind:'idea', text:'Ghost replay of your own best lap — cheaper to build than multiplayer and more motivating',
        hoursAgo:5 },
      { id:'i3', kind:'task', text:'Ask the host about the bandwidth overage on last month’s invoice',
        hoursAgo:9 },
      { id:'i4', kind:'thought', text:'The landing page is trying to say four things. Pick one.', hoursAgo:22 },
      { id:'i5', kind:'reminder', text:'Renew the domain before it lapses in October', hoursAgo:30 },
      { id:'i6', kind:'note', text:'Colour rule for dark surfaces: one accent per view, never five', hoursAgo:46 },
      { id:'i7', kind:'task', text:'Write the release notes for the vertical slice', hoursAgo:52 },
      { id:'i8', kind:'idea', text:'Weekly review template: what moved, what stalled, what to drop', hoursAgo:70 },
      { id:'i9', kind:'link', text:'Reference for the drift physics write-up',
        url:'https://example.com/drift', hoursAgo:96 },
      { id:'i10', kind:'thought', text:'Stop scheduling admin into the nine-to-noon window. It is the best block I have.',
        hoursAgo:120 },
      /* Triaged — became a real task. */
      { id:'i11', kind:'task', text:'Book the annual check-up', hoursAgo:140,
        status:'processed', convertedTo:{ type:'task', id:'t20' }, processedHoursAgo:138 },
      /* Triaged, then the target was deleted — the pointer is reported missing. */
      { id:'i12', kind:'note', text:'Notes from the pricing call', hoursAgo:160,
        status:'processed', convertedTo:{ type:'note', id:'n-gone' }, processedHoursAgo:158 },
    ],
    /* Focus carries NO counters. `focus` is the append-only log of sessions
       that actually happened — each one with a real start, end and duration.
       Today's minutes, the week, the month, the streak and the score's focus
       component are all derived from this array (see Derive.focus*). */
    focus: buildDemoFocus(),
    /* Finance carries PREFERENCES only — the display currency and the monthly
       budget TARGETS. No totals, no category breakdown, no frozen weekly array:
       every figure the Finance page and the dashboard snapshot show is derived
       from the `transactions` collection below, so one new transaction moves all
       of them at once.
       A budget is here because a target is an intention, not a calculation —
       nothing in the log can tell you what you meant to spend. */
    finance: {
      currency: 'INR',
      budgets: {
        Housing: 10000, Food: 12000, Transport: 4000,
        Subscriptions: 2500, Fun: 3000, Learning: 4000,
      },
    },
    /* A real transaction log (see buildDemoTransactions). Day keys are resolved
       at definition time, so the demo reads as "the last five months" on first
       seed and then ages naturally as real history. */
    transactions: buildDemoTransactions(),
    /* Events carry a real ISO date so they can be placed on the calendar grid.
       `dayOffset` is the demo-relative anchor: 0 = today, resolved once at
       hydrate time (see resolveEventDates) so the demo always looks current
       without shipping frozen dates. */
    upcoming: [
      { id:'u1', title:'Team meeting',   time:'10:00 AM – 11:00 AM', kind:'event',   color:'#6366F1', dayOffset:0 },
      { id:'u2', title:'Project review', time:'02:00 PM – 03:00 PM', kind:'review',  color:'#8B5CF6', dayOffset:0 },
      { id:'u3', title:'Workout',        time:'06:00 PM – 07:00 PM', kind:'health',  color:'#4ADE9B', dayOffset:0 },
      { id:'u4', title:'Read',           time:'08:30 PM – 09:30 PM', kind:'learning',color:'#06B6D4', dayOffset:0 },
      { id:'u5', title:'Design sync',    time:'11:00 AM – 12:00 PM', kind:'event',   color:'#06B6D4', dayOffset:2 },
      { id:'u6', title:'Sprint planning',time:'09:30 AM – 10:30 AM', kind:'event',   color:'#6366F1', dayOffset:4 },
      { id:'u7', title:'Deep work block',time:'08:00 AM – 11:00 AM', kind:'focus',   color:'#8B5CF6', dayOffset:5 },
      { id:'u8', title:'Long run',       time:'07:00 AM – 08:30 AM', kind:'health',  color:'#4ADE9B', dayOffset:6 },
      { id:'u9', title:'Dentist',        time:'04:00 PM – 05:00 PM', kind:'health',  color:'#4ADE9B', dayOffset:-3 },
      { id:'u10',title:'Course module 4',time:'07:00 PM – 08:00 PM', kind:'learning',color:'#06B6D4', dayOffset:9 },
    ],
    /* The activity log is newest-first. Demo entries carry real relative anchors
       (`hoursAgo` / `daysAgo`) that `normalizeActivity` resolves ONCE at hydrate,
       so the timeline has real days to group by rather than one frozen "Just now". */
    activity: [
      { id:'a1',  kind:'task',     text:'Completed “Read 10 pages”',                            hoursAgo: 2 },
      { id:'a2',  kind:'focus',    text:'Focus session · 25 min on “Finish dashboard UI”',      hoursAgo: 4 },
      { id:'a3',  kind:'habit',    text:'Completed “Reading”',                                  hoursAgo: 5 },
      { id:'a4',  kind:'finance',  text:'Spent ₹1,240 on “Groceries”',                          hoursAgo: 7 },
      { id:'a5',  kind:'note',     text:'Created “UX Inspiration”',                             hoursAgo: 9 },
      { id:'a6',  kind:'task',     text:'Created “Tune the drift physics”',                     hoursAgo: 11 },
      { id:'a7',  kind:'inbox',    text:'Captured a link: “A good article on deep work”',       hoursAgo: 26 },
      { id:'a8',  kind:'calendar', text:'Added “Weekly review” on 2026-09-14',                  hoursAgo: 28 },
      { id:'a9',  kind:'project',  text:'Renamed “Marketing” to “Marketing Website”',           hoursAgo: 30 },
      { id:'a10', kind:'journal',  text:'Wrote a journal entry for 2026-09-13',                 hoursAgo: 33 },
      { id:'a11', kind:'task',     text:'Completed “Rewrite the pricing page”',                 daysAgo: 2 },
      { id:'a12', kind:'goal',     text:'Created goal “Grow the channel”',                      daysAgo: 2 },
      { id:'a13', kind:'file',     text:'Added “launch-checklist.csv”',                         daysAgo: 2 },
      { id:'a14', kind:'focus',    text:'Focus session · 50 min on “Ship the vertical slice”',  daysAgo: 3 },
      { id:'a15', kind:'habit',    text:'Unchecked “Deep Work”',                                daysAgo: 3 },
      { id:'a16', kind:'finance',  text:'Received ₹48,000 on “Monthly salary”',                 daysAgo: 4 },
      { id:'a17', kind:'note',     text:'Created “Reading list”',                               daysAgo: 4 },
      { id:'a18', kind:'project',  text:'Created project “Racing Game”',                        daysAgo: 5 },
      { id:'a19', kind:'inbox',    text:'Discarded a capture: “Milk, eggs, coffee”',            daysAgo: 5 },
      { id:'a20', kind:'task',     text:'Deleted “Old landing page copy”',                      daysAgo: 6 },
    ],
    /* Reviews a demo user has already written. `weeksAgo` / `monthsAgo` resolve
       ONCE at hydrate into a real period start (see normalizeReview). */
    reviews: [
      { id:'r1', kind:'week', weeksAgo:1, rating:4, title:'A steady week',
        body:`Shipped the vertical slice and the week held together because of it. Three
focus blocks landed before noon, which is when the good work actually happens.

What stalled: the track editor. I kept opening it and closing it — it is too big to
start without a plan, and I did not write one.

Next week: break the editor into four pieces I can finish in an afternoon each.` },
      { id:'r2', kind:'week', weeksAgo:2, rating:3, title:'Habits slipped, money did not',
        body:`Habits were the weak spot — two of five most days, and reading broke its run on
Wednesday. Not a disaster, but the streak was the thing I was proud of.

The money side was clean: under budget in every category, and the groceries number is
finally realistic instead of aspirational.

Lesson: the habit I skip is always the one scheduled last.` },
      { id:'r3', kind:'month', monthsAgo:1, rating:4, title:'August in review',
        body:`A month of building rather than planning. The dashboard went from a sketch to
something I actually use, and the finance log stopped being a chore once it was a real
ledger instead of a decoration.

What I would change: I wrote fewer journal entries than I meant to, and the ones I
skipped are the weeks I would most like to remember.

One thing to keep: the weekly review itself. It is the only reason I noticed the habit
slip at all.` },
    ],
    /* Automations (M35). Five rules covering every cadence and every action, one
       of them switched off, one not yet due — so the page has a real state to show
       in each case. The anchors are relative and resolve once at hydrate; the
       records they produce are ordinary tasks, captures and notes, created through
       the same State methods every other page uses. */
    automations: [
      { id: 'au1', name: 'Morning plan', enabled: true,
        trigger: { every: 'weekday', at: '07:30' },
        action: { type: 'task', title: 'Plan the day', project: 'Personal',
                  priority: 'Medium', dueIn: 0 },
        lastRunDaysAgo: 4, createdDaysAgo: 40 },
      { id: 'au2', name: 'Weekly review nudge', enabled: true,
        trigger: { every: 'week', dow: 1, at: '09:00' },
        action: { type: 'capture', text: 'Write the weekly review for {date}' },
        lastRunDaysAgo: 7, createdDaysAgo: 60 },
      { id: 'au3', name: 'Monthly reset', enabled: true,
        trigger: { every: 'month', dom: 1, at: '10:00' },
        action: { type: 'note', title: 'Monthly reset — {date}',
                  body: 'Close the month: check budgets, archive finished projects, review goals.' },
        createdDaysAgo: 20 },
      { id: 'au4', name: 'Evening shutdown', enabled: true,
        trigger: { every: 'day', at: '21:00' },
        action: { type: 'task', title: 'Close out the day', project: 'Personal',
                  priority: 'Low', dueIn: 0 },
        lastRunDaysAgo: 1, createdDaysAgo: 12 },
      { id: 'au5', name: 'Weekend shutdown', enabled: false,
        trigger: { every: 'week', dow: 6, at: '17:00' },
        action: { type: 'task', title: 'Clear the inbox to zero', project: 'Personal',
                  priority: 'Low', dueIn: 0 },
        lastRunDaysAgo: 9, createdDaysAgo: 30 },
    ],
    /* Templates (M37). A template is a SHAPE WITH HOLES: the records it makes are
       described once, and every value that has to be concrete at the moment of
       use is a token — `{date}` for the day it is applied, `{name}` for whatever
       the user types when they apply it. Nothing concrete is stored, so the same
       "New project kickoff" works for any project on any day. `tp3` deliberately
       has no holes, so applying it is one click with nothing to ask. */
    templates: [
      { id: 'tp1', name: 'New project kickoff', icon: 'layers', createdDaysAgo: 90,
        items: [
          { type: 'task', title: 'Write the brief for {name}', project: '{name}',
            priority: 'High', dueIn: 1 },
          { type: 'task', title: 'Set up the repo and tooling', project: '{name}',
            priority: 'Medium', dueIn: 2 },
          { type: 'task', title: 'Break {name} into milestones', project: '{name}',
            priority: 'Medium', dueIn: 3 },
          { type: 'task', title: 'Book the kickoff call', project: '{name}',
            priority: 'Low', dueIn: 4 },
          { type: 'note', title: '{name} — kickoff notes',
            body: 'Scope, constraints, and who owns what. Revisit at the first checkpoint.' },
        ] },
      { id: 'tp2', name: 'Weekly review', icon: 'chart', createdDaysAgo: 60,
        items: [
          { type: 'capture', text: 'Write the weekly review for {date}' },
          { type: 'task', title: 'Clear the inbox to zero', project: 'Personal',
            priority: 'Low', dueIn: 0 },
        ] },
      { id: 'tp3', name: 'Trip packing', icon: 'target', createdDaysAgo: 30,
        items: [
          { type: 'task', title: 'Passport, tickets and wallet', project: 'Travel',
            priority: 'High', dueIn: 0 },
          { type: 'task', title: 'Charge everything and pack the cables',
            project: 'Travel', priority: 'Medium', dueIn: 0 },
          { type: 'task', title: 'Check in online', project: 'Travel',
            priority: 'Medium', dueIn: 1 },
        ] },
    ],
    /* No `scoreHistory` here any more (M34). A score is a function of a day, so the
       history is DERIVED by evaluating it over the last fortnight — see
       `Derive.scoreHistory()`. A stored array could not move when a task changed,
       which made the sparkline and its delta badge decoration. */
  };

  /* ======================================================================
     STORAGE LAYER — Milestone 13
     Primary:   IndexedDB  (workspace records)
     Secondary: localStorage (settings/preferences only)

     Design rule: no UI component talks to storage directly. Everything goes
     through StorageService (raw persistence) and Repo (collection access).
     If IndexedDB is unavailable (private mode, blocked), we degrade to an
     in-memory store so the app keeps working — never a hard failure.
     ====================================================================== */

  const DB_NAME = 'nexus';
  /* v2 added the `files` store (M28); v3 added `reviews` (M32); v4 added
     `automations` (M35); v5 added `templates` (M37). Bumping the version is safe:
     the upgrade handler creates only the stores that are missing, so an existing
     workspace keeps every record it already had. */
  const DB_VERSION = 5;
  /* Object stores. One record per collection keeps writes atomic and simple,
     which suits a local-first single-user workspace. */
  const STORES = ['meta', 'tasks', 'projects', 'goals', 'habits', 'notes',
                  'finance', 'journal', 'inbox', 'events', 'activity', 'focus',
                  'files', 'reviews', 'automations', 'templates'];

  const StorageService = {
    db: null,
    available: false,
    mode: 'memory',          // 'idb' | 'memory'
    _mem: new Map(),

    async init() {
      if (!('indexedDB' in window)) { this.mode = 'memory'; return this; }
      try {
        this.db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = () => {
            const db = req.result;
            STORES.forEach(name => {
              if (!db.objectStoreNames.contains(name)) {
                db.createObjectStore(name, { keyPath: 'id' });
              }
            });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
          req.onblocked = () => reject(new Error('blocked'));
        });
        this.available = true;
        this.mode = 'idb';
      } catch (e) {
        // Graceful degradation — the app must still run.
        console.warn('[NEXUS] IndexedDB unavailable, using in-memory storage.', e && e.message);
        this.mode = 'memory';
      }
      return this;
    },

    _tx(store, mode = 'readonly') {
      return this.db.transaction(store, mode).objectStore(store);
    },

    async put(store, record) {
      if (this.mode !== 'idb') { this._mem.set(store + ':' + record.id, record); return record; }
      return new Promise((resolve, reject) => {
        const req = this._tx(store, 'readwrite').put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
      });
    },

    async putMany(store, records) {
      if (this.mode !== 'idb') {
        records.forEach(r => this._mem.set(store + ':' + r.id, r));
        return records.length;
      }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        records.forEach(r => os.put(r));
        tx.oncomplete = () => resolve(records.length);
        tx.onerror = () => reject(tx.error);
      });
    },

    async getAll(store) {
      if (this.mode !== 'idb') {
        return [...this._mem.entries()]
          .filter(([k]) => k.startsWith(store + ':'))
          .map(([, v]) => v);
      }
      return new Promise((resolve, reject) => {
        const req = this._tx(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },

    async get(store, id) {
      if (this.mode !== 'idb') return this._mem.get(store + ':' + id) || null;
      return new Promise((resolve, reject) => {
        const req = this._tx(store).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    },

    async remove(store, id) {
      if (this.mode !== 'idb') { this._mem.delete(store + ':' + id); return; }
      return new Promise((resolve, reject) => {
        const req = this._tx(store, 'readwrite').delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    /* Delete many keys in one transaction. Used by persistAll() to prune
       records that no longer exist in the live state (e.g. deleted tasks),
       so removed entities cannot resurrect after a reload. */
    async removeMany(store, ids) {
      if (!ids.length) return 0;
      if (this.mode !== 'idb') { ids.forEach(id => this._mem.delete(store + ':' + id)); return ids.length; }
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        ids.forEach(id => os.delete(id));
        tx.oncomplete = () => resolve(ids.length);
        tx.onerror = () => reject(tx.error);
      });
    },

    /* Primary keys currently stored in a given object store. */
    async keys(store) {
      if (this.mode !== 'idb') {
        return [...this._mem.keys()]
          .filter(k => k.startsWith(store + ':'))
          .map(k => k.slice(store.length + 1));
      }
      return new Promise((resolve, reject) => {
        const req = this._tx(store).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },

    async clear(store) {
      if (this.mode !== 'idb') {
        [...this._mem.keys()].filter(k => k.startsWith(store + ':')).forEach(k => this._mem.delete(k));
        return;
      }
      return new Promise((resolve, reject) => {
        const req = this._tx(store, 'readwrite').clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async clearAll() {
      for (const s of STORES) await this.clear(s);
    },
  };

  /* Settings live in localStorage — small, synchronous, sync-critical.
     M39 removed three keys that had no reader anywhere (`reducedMotion`,
     `densities`, `onboarded`) — the last of them superseded by `user.onboardedAt`
     in M38. A default nothing reads is a preference the app only pretends to
     have. What remains is the pair that genuinely changes what you see. */
  const Settings = {
    key: 'nexus.settings',
    /* `dashboard: null` means "never chosen", so the dashboard renders the whole
       canonical set — and an empty array stays distinguishable from it. */
    defaults: { theme: 'midnight', focusTarget: 120, dashboard: null },
    read() {
      try { return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.key) || '{}') }; }
      catch (_) { return { ...this.defaults }; }
    },
    write(patch) {
      const next = { ...this.read(), ...patch };
      try { localStorage.setItem(this.key, JSON.stringify(next)); } catch (_) {}
      return next;
    },
    set(k, v) { return this.write({ [k]: v }); },
  };

  /* Now that Settings exists, let Theme mirror its choice into settings. */
  Theme._onApply = name => Settings.write({ theme: name });

  /* Repository — the only thing the State layer touches for persistence.
     Maps collections onto object stores and handles hydration/seeding. */
  const Repo = {
    /* Collection name → object store. `transactions` reuses the `finance` store
       created in M13, so promoting the log out of the finance singleton needed no
       database version bump. */
    map: {
      tasks: 'tasks', projects: 'projects', goals: 'goals', habits: 'habits',
      notes: 'notes', journal: 'journal', inbox: 'inbox',
      transactions: 'finance', files: 'files', reviews: 'reviews',
      automations: 'automations', templates: 'templates',
      upcoming: 'events', activity: 'activity', focus: 'focus',
    },

    async hydrate() {
      const data = {};
      for (const [coll, store] of Object.entries(this.map)) {
        data[coll] = await StorageService.getAll(store);
        // Preserve intended order — getAll does not guarantee it.
        data[coll].sort((a, b) => (a._ord ?? 0) - (b._ord ?? 0));
      }
      // Singleton records.
      data.user        = await StorageService.get('meta', 'user');
      data.entitlement = await StorageService.get('meta', 'entitlement');
      data.finance     = await StorageService.get('meta', 'finance');
      data.settings    = await StorageService.get('meta', 'settings');
      return data;
    },

    /* Write every collection from the live state object.
       Two-phase per collection: upsert the current records, then prune any
       stored key that is no longer present. Without the prune step, deleted
       entities would linger in IndexedDB and reappear on the next reload. */
    async persistAll(data) {
      const jobs = [];
      for (const [coll, store] of Object.entries(this.map)) {
        const list = (data[coll] || []).map((r, i) => ({ ...r, _ord: i }));
        jobs.push((async () => {
          if (list.length) await StorageService.putMany(store, list);
          const live = new Set(list.map(r => r.id));
          const stored = await StorageService.keys(store);
          const orphans = stored.filter(k => !live.has(k));
          if (orphans.length) await StorageService.removeMany(store, orphans);
        })());
      }
      if (data.user)        jobs.push(StorageService.put('meta', { id: 'user', ...data.user }));
      if (data.entitlement) jobs.push(StorageService.put('meta', { id: 'entitlement', ...data.entitlement }));
      if (data.finance)     jobs.push(StorageService.put('meta', { id: 'finance', ...data.finance }));
      return Promise.all(jobs);
    },

    /* Seed the database from the demo workspace on first run. Normalize every
       demo task through the Task model first, so the very first write already
       contains the full schema (no half-migrated records later). */
    async seed(demo) {
      const normalized = JSON.parse(JSON.stringify(demo));
      normalized.tasks = (normalized.tasks || []).map(t => normalizeTask(t));
      // The workspace owner (M38): the demo carries no answers, so this seeds a
      // real shape with `onboardedAt: null` — the workspace is genuinely un-set-up.
      normalized.user = normalizeUser(normalized.user);
      // Resolve the demo focus anchors once, so the very first write already
      // stores real timestamps and day keys instead of relative offsets.
      normalized.focus = (normalized.focus || []).map(s => normalizeFocusSession(s));
      normalized.notes = (normalized.notes || []).map(n => normalizeNote(n));
      repairNoteHierarchy(normalized.notes);
      // Journal demo anchors (`dayOffset`) resolve once, so the very first write
      // already stores real day keys instead of relative offsets.
      normalized.journal = (normalized.journal || []).map(e => normalizeJournal(e));
      // Inbox captures carry a real createdAt; the demo `hoursAgo` anchors are
      // resolved once, so the very first write already stores real timestamps.
      normalized.inbox = (normalized.inbox || []).map(it => normalizeInbox(it));
      // Finance: the log is the truth; the singleton keeps preferences only.
      normalized.transactions = (normalized.transactions || []).map(t => normalizeTransaction(t));
      normalized.finance = normalizeFinance(normalized.finance);
      /* Files never travel through the JSON clone above — a Blob does not survive
         JSON.stringify. Seed straight from the live state (which already carries
         the demo records), so the very first write stores real content. */
      normalized.files = (Array.isArray(demo.files) && demo.files.length ? demo.files : DEMO_FILES)
        .map(f => normalizeFile(f));
      /* Activity demo anchors (`hoursAgo` / `daysAgo`) resolve once, so the very
         first write already stores real timestamps instead of relative offsets. */
      normalized.activity = (normalized.activity || [])
        .map(a => normalizeActivity(a))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      /* Reviews (M32) carry only what the user wrote about a period. */
      normalized.reviews = (normalized.reviews || []).map(r => normalizeReview(r));
      /* Automations (M35): the demo's `lastRunDaysAgo` / `createdDaysAgo` anchors
         resolve once, so the very first write already stores real day keys. */
      normalized.automations = (normalized.automations || []).map(r => normalizeAutomation(r));
      /* Templates (M37) store a shape and an offset, never a date, so there is
         nothing relative to resolve beyond the creation anchor. */
      normalized.templates = (normalized.templates || []).map(t => normalizeTemplate(t));
      await this.persistAll(normalized);
    },

    async isSeeded() {
      const meta = await StorageService.get('meta', 'seeded');
      return !!(meta && meta.value);
    },
    async markSeeded() {
      return StorageService.put('meta', { id: 'seeded', value: true, at: new Date().toISOString() });
    },

    async wipe() { await StorageService.clearAll(); },
  };

  /* --- STATE ------------------------------------------------------------- */
  const State = {
    data: null,
    _subs: new Set(),
    _saveTimer: null,
    _ready: false,

    /* Async boot: hydrate from IndexedDB, seed demo on first run. */
    async init() {
      await StorageService.init();

      const seeded = await Repo.isSeeded();
      if (!seeded) {
        await this.seedDemo();
      } else {
        const hydrated = await Repo.hydrate();
        this.data = this._reconcile(hydrated);
      }

      // Settings come from localStorage and win over stored copies.
      const s = Settings.read();
      this.data.settings = s;
      this._ready = true;
      return this;
    },

    /* THE definition of the demo workspace: `_reconcile({})` falls back to DEMO
       for every collection (invariant 4), so this is literally what a first run
       writes. M40's reset goes through the same two calls — a second seed path
       would be a second definition of "the demo", and the two would drift. */
    demoWorkspace() {
      return this._reconcile({ tasks: [], projects: [], goals: [], habits: [], upcoming: [], notes: [], journal: [], inbox: [], time: [], activity: [], transactions: [], files: [], user: { name: '', focus: [], onboardedAt: null }, finance: { currency: 'USD', budgets: {} } });
    },

    async seedDemo() {
      this.data = this.demoWorkspace();
      await Repo.seed(this.data);
      await Repo.markSeeded();
      return this.data;
    },

    /* Guarantee every collection exists so the UI never crashes on a
       partial or older database. Demo data only covers the collections the
       current milestones use; the rest default to empty arrays.

       Important: an array that was hydrated is authoritative even when it is
       empty. If the user deleted every task, that emptiness must survive a
       reload — we only fall back to demo data when the collection was never
       hydrated at all (h has no such key). */
    _reconcile(h) {
      const base = JSON.parse(JSON.stringify(DEMO));
      const out = {
        ...base,
        user: normalizeUser(h.user || base.user),
        entitlement: normalizeEntitlement(h.entitlement || base.entitlement),
        finance: h.finance || base.finance,
      };
      for (const coll of Object.keys(Repo.map)) {
        const fallback = Array.isArray(base[coll]) ? base[coll] : [];
        const source = Array.isArray(h[coll]) ? h[coll] : fallback;
        // Strip internal ordering fields so they never leak into the UI.
        out[coll] = source.map(({ _ord, ...rest }) => rest);
      }
      out.tasks = out.tasks.map(t => normalizeTask(t));
      /* Projects and goals gained a guard in M39 (see `normalizeProject`). They
         were the only two collections without one, which mattered the moment an
         import could introduce a record the app would never have written — a
         nameless project renders blank and can never be matched by the tasks that
         point at it by name. */
      out.projects = out.projects.map(p => normalizeProject(p));
      out.goals = out.goals.map(g => normalizeGoal(g));
      // Demo events are anchored relative to "today" so the calendar always has
      // something current to show. Any event that already has a real date (user
      // created, or previously resolved) keeps it.
      out.upcoming = out.upcoming.map(u => normalizeEvent(u));
      // Habits migrate from stored counters to a real completion history.
      out.habits = out.habits.map(hh => normalizeHabit(hh));
      // Notes carry real ISO timestamps; demo `hoursAgo` anchors resolve once.
      out.notes = out.notes.map(n => normalizeNote(n));
      // Then make the knowledge hierarchy a forest again (drop dangling
      // parents, break cycles) so every tree walk is guaranteed to terminate.
      out.notes = repairNoteHierarchy(out.notes).notes;
      // Journal entries carry a real YYYY-MM-DD `day`; demo `dayOffset` anchors
      // are resolved once, here, and then persisted as real keys.
      out.journal = out.journal.map(e => normalizeJournal(e));
      // Inbox captures keep a real createdAt/processedAt; demo `hoursAgo` and
      // `processedHoursAgo` anchors resolve once and are then persisted.
      out.inbox = out.inbox.map(it => normalizeInbox(it));
      // Focus migrated from a singleton counter record ({minutesToday, …}) to a
      // real session log. Anything with neither a duration nor a time anchor is
      // a leftover of the old shape, not a session — drop it rather than turn
      // it into a zero-minute block today.
      out.focus = out.focus
        .filter(s => s && (typeof s.minutes === 'number' || typeof s.startedAt === 'number'
                        || typeof s.dayOffset === 'number'))
        .map(s => normalizeFocusSession(s));
      /* Finance migrated in M26. Transactions used to live inside the `finance`
         singleton beside a pre-computed category breakdown, a frozen weekly array
         and a spend percentage — derived values kept in storage, which this
         codebase forbids. The collection is now the truth. A workspace written
         before the change has an empty `transactions` store and a legacy embedded
         list, so move it across ONCE rather than showing an empty ledger. */
      out.finance = normalizeFinance(out.finance);
      const legacyTx = (h.finance && Array.isArray(h.finance.transactions)) ? h.finance.transactions : [];
      out.transactions = (out.transactions.length ? out.transactions : legacyTx)
        // A record with no amount is not a transaction — it is a leftover of an
        // older shape or a bad import, and a zero row would only ever be noise.
        .filter(t => t && Math.abs(Number(t.amount) || 0) > 0)
        .map(t => normalizeTransaction(t));
      /* Files (M28). A file record carries its own bytes; anything that lost its
         Blob is not a file and is dropped rather than rendered as an empty row
         that cannot be opened. Files cannot live in DEMO — a Blob does not
         survive the JSON clone above — so the demo fallback is DEMO_FILES, and
         it applies under exactly the same rule as every other collection: only
         when the collection was never hydrated at all. A workspace whose files
         were all deleted keeps that emptiness across a reload. */
      out.files = (Array.isArray(h.files) ? h.files : DEMO_FILES)
        .map(f => normalizeFile(f))
        .filter(f => f.blob);
      /* Activity (M30). Every entry carries a real `createdAt`; a legacy entry's
         stored age string is resolved once, here, and then persisted. The log is
         kept newest-first so its stored order matches the way it is read. */
      out.activity = (out.activity || [])
        .map(a => normalizeActivity(a))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      /* Reviews (M32). A review is the user's own words about a period; every figure
         shown beside it is derived from that period's records, never stored. */
      out.reviews = (out.reviews || []).map(r => normalizeReview(r));
      /* Automations (M35). A rule stores its schedule and its action — the
         intention — plus the day of the last occurrence it actually made. What it
         has PRODUCED is never stored here: it is the inverse of the `origin`
         stamp on the records themselves. */
      out.automations = (out.automations || []).map(r => normalizeAutomation(r));
      /* Templates (M37). A template stores a shape — a name, an icon, and the
         records it would make — and nothing else. There is no date in one: a
         task item carries `dueIn`, an offset from the day it is APPLIED, because
         a template holding a concrete due date would be wrong the day after it
         was written. What it has made is not stored either; applying one is an
         action, and the evidence is the records it left behind. */
      out.templates = (out.templates || []).map(t => normalizeTemplate(t));
      return out;
    },

    /* Debounced write-through with a *leading edge*.
       A trailing-only debounce left a real hole: log a session and reload
       within the 220 ms window and the write had not even started, so the
       change vanished. The unload handler cannot rescue it either — an
       IndexedDB transaction started during teardown is aborted with the page.
       Firing immediately when nothing has been saved recently closes that
       window, while a burst of rapid edits (typing, ticking several boxes)
       still collapses into a single trailing persist. */
    _lastSave: 0,
    _quiet: 400,
    scheduleSave() {
      if (Date.now() - this._lastSave > this._quiet) {
        this._lastSave = Date.now();
        this.flush();
        return;
      }
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.flush(), 220);
    },

    /* Persists are serialized: a flush already in flight is awaited before
       the next one starts, so two concurrent passes can never interleave
       their read-then-prune steps and drop a legitimate write. */
    _flushing: null,
    async flush() {
      if (!this._ready) return;
      this._lastSave = Date.now();
      clearTimeout(this._saveTimer);
      try {
        this._flushing = (this._flushing || Promise.resolve()).then(() =>
          Repo.persistAll(this.data)).catch(e => {
            console.warn('[NEXUS] persist failed', e && e.message);
          });
        return this._flushing;
      } catch (e) {
        console.warn('[NEXUS] persist failed', e && e.message);
      }
    },

    subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
    emit(reason) {
      this.data._rev = (this.data._rev || 0) + 1;
      document.dispatchEvent(new CustomEvent('nexus:state', { detail: { reason } }));
      this._subs.forEach(fn => fn(this.data, reason));
      this.scheduleSave();
    },

    get user() { return this.data.user; },
    get entitlement() { return this.data.entitlement; },
    get tasks() { return this.data.tasks; },
    get projects() { return this.data.projects; },
    get goals() { return this.data.goals; },
    get habits() { return this.data.habits; },
    get focus() { return this.data.focus; },
    get notes() { return this.data.notes; },
    get journal() { return this.data.journal; },
    get inbox() { return this.data.inbox; },
    get transactions() { return this.data.transactions; },
    get finance() { return this.data.finance; },
    get upcoming() { return this.data.upcoming; },
    get activity() { return this.data.activity; },
    get files() { return this.data.files; },
    get reviews() { return this.data.reviews; },
    get automations() { return this.data.automations; },
    get templates() { return this.data.templates; },
    get isPro() { return true; },

    /* Setters for the collection getters above.
       Without these, `State.projects = [...]` would resolve to a getter with
       no setter and *silently do nothing* in non-strict mode — the exact bug
       that made project deletion appear to succeed while the record lived on.
       Prefer in-place mutation (push/splice) for clarity, but these make the
       assignment form safe rather than silently lossy. */
    set tasks(v) { this.data.tasks = v; },
    set projects(v) { this.data.projects = v; },
    set goals(v) { this.data.goals = v; },
    set habits(v) { this.data.habits = v; },
    set upcoming(v) { this.data.upcoming = v; },
    set activity(v) { this.data.activity = v; },
    set focus(v) { this.data.focus = v; },
    set notes(v) { this.data.notes = v; },
    set journal(v) { this.data.journal = v; },
    set inbox(v) { this.data.inbox = v; },
    set transactions(v) { this.data.transactions = v; },
    set files(v) { this.data.files = v; },
    set reviews(v) { this.data.reviews = v; },
    set automations(v) { this.data.automations = v; },
    set templates(v) { this.data.templates = v; },
    get planLabel() {
      const s = this.entitlement.status;
      if (s === 'PRO') return 'NEXUS PRO';
      if (s === 'TRIAL') return 'PRO TRIAL';
      if (s === 'EXPIRED') return 'PRO EXPIRED';
      return 'NEXUS Free';
    },
    /* Which row of PLANS the licence is on. Read from `billing`, never from
       `plan` — `plan` is 'PRO' or 'FREE' (what you are), `billing` is
       'monthly' | 'yearly' (what you bought), and only the latter can be priced. */
    get billing() {
      return this.entitlement.status === 'PRO' ? (this.entitlement.billing || 'monthly') : 'free';
    },

    /* --- Mutations (each emits so every dependent system updates) -------- */
    toggleTask(id) {
      const t = this.tasks.find(x => x.id === id);
      if (!t) return null;
      t.done = !t.done;
      t.status = t.done ? 'done' : 'today';
      t.completedAt = t.done ? new Date().toISOString() : null;
      t.updatedAt = new Date().toISOString();
      this.activity.unshift({
        id: uid('a'), kind: 'task',
        text: `${t.done ? 'Completed' : 'Reopened'} “${t.title}”`,
        createdAt: nowIso(),
      });
      this.emit('task:toggle');
      return t;
    },
    addTask(title, opts = {}) {
      const t = Task.create({
        title,
        done: false,
        priority: opts.priority || 'Medium',
        project: opts.project || 'Personal',
        /* A due date enters the workspace through the one boundary parser, so a
           caller may pass a token ('Tomorrow') or a real key and both land as a
           stored day key. */
        due: parseDueToken(opts.due || opts.dueDate || 'Today'),
        estimate: opts.estimate ?? null,
        tags: opts.tags || [],
        status: 'today',
      });
      this.tasks.unshift(t);
      this.activity.unshift({ id: uid('a'), kind: 'task', text: `Created “${title}”`, createdAt: nowIso() });
      this.emit('task:add');
      return t;
    },
    /* Generic task update + delete — used by the Tasks page and detail panel. */
    updateTask(id, patch) {
      const t = this.tasks.find(x => x.id === id);
      if (!t) return null;
      Object.assign(t, patch, { updatedAt: new Date().toISOString() });
      if (patch.done !== undefined) {
        t.status = patch.done ? 'done' : 'today';
        t.completedAt = patch.done ? new Date().toISOString() : null;
      }
      this.emit('task:update');
      return t;
    },
    deleteTask(id) {
      const i = this.tasks.findIndex(x => x.id === id);
      if (i === -1) return null;
      const [removed] = this.tasks.splice(i, 1);
      this.activity.unshift({ id: uid('a'), kind: 'task', text: `Deleted “${removed.title}”`, createdAt: nowIso() });
      this.emit('task:delete');
      return removed;
    },
    duplicateTask(id) {
      const t = this.tasks.find(x => x.id === id);
      if (!t) return null;
      const copy = Task.create({ ...t, id: uid('t'), title: t.title + ' (copy)', done: false,
        status: 'today', completedAt: null });
      const i = this.tasks.findIndex(x => x.id === id);
      this.tasks.splice(i + 1, 0, copy);
      this.emit('task:duplicate');
      return copy;
    },
    /* --- Subtasks (Milestone 16) ----------------------------------------
       Subtasks live on the parent task. Completion of the last subtask does
       not auto-complete the parent — that stays a deliberate user choice —
       but the progress bar and derived counts update immediately. */
    addSubtask(taskId, title) {
      const t = this.tasks.find(x => x.id === taskId);
      if (!t || !title.trim()) return null;
      const sub = { id: uid('s'), title: title.trim(), done: false };
      t.subtasks = [...(t.subtasks || []), sub];
      t.updatedAt = new Date().toISOString();
      this.emit('subtask:add');
      return sub;
    },
    toggleSubtask(taskId, subId) {
      const t = this.tasks.find(x => x.id === taskId);
      if (!t) return null;
      const s = (t.subtasks || []).find(x => x.id === subId);
      if (!s) return null;
      s.done = !s.done;
      t.updatedAt = new Date().toISOString();
      this.emit('subtask:toggle');
      return s;
    },
    removeSubtask(taskId, subId) {
      const t = this.tasks.find(x => x.id === taskId);
      if (!t) return null;
      t.subtasks = (t.subtasks || []).filter(x => x.id !== subId);
      t.updatedAt = new Date().toISOString();
      this.emit('subtask:remove');
      return t;
    },
    /* Archive / unarchive — sets an explicit status plus a derived flag, so
       the Tasks page can filter it while analytics keep the history. */
    setTaskStatus(id, status) {
      const t = this.tasks.find(x => x.id === id);
      if (!t) return null;
      t.status = status;
      t.archived = status === 'archived';
      t.updatedAt = new Date().toISOString();
      this.emit('task:status');
      return t;
    },
    moveTask(id, patch) {
      const t = this.tasks.find(x => x.id === id);
      if (!t) return null;
      Object.assign(t, patch, { updatedAt: new Date().toISOString() });
      this.emit('task:move');
      return t;
    },
    /* --- Projects (Milestone 17) ----------------------------------------
       A project record holds identity only (name, status, deadline, colour).
       Progress is derived from tasks, so there is nothing numeric to keep in
       sync here — renaming a project must also re-point its tasks. */
    addProject(fields = {}) {
      const name = (fields.name || '').trim();
      if (!name) return null;
      const p = {
        id: uid('p'),
        name,
        status: fields.status || 'Active',
        deadline: fields.deadline || null,
        color: fields.color || Derive._autoColor(name),
      };
      this.projects.push(p);
      this.activity.unshift({ id: uid('a'), kind: 'project', text: `Created project “${name}”`, createdAt: nowIso() });
      this.emit('project:add');
      return p;
    },
    updateProject(name, patch) {
      let p = this.projects.find(x => x.name === name);
      if (!p) {
        // The project may only exist implicitly (via task project labels).
        p = this.addProject({ name });
        if (!p) return null;
      }
      Object.assign(p, patch);
      this.emit('project:update');
      return p;
    },
    /* Rename must cascade to every task that referenced the old name,
       otherwise those tasks would orphan into a phantom project. */
    renameProject(oldName, newName) {
      const next = (newName || '').trim();
      if (!next || next === oldName) return false;
      let touched = 0;
      this.tasks.forEach(t => { if (t.project === oldName) { t.project = next; touched++; } });
      const p = this.projects.find(x => x.name === oldName);
      if (p) p.name = next;
      else this.projects.push({ id: uid('p'), name: next, status: 'Active', deadline: null, color: Derive._autoColor(next) });
      this.activity.unshift({
        id: uid('a'), kind: 'project',
        text: `Renamed “${oldName}” to “${next}”`, createdAt: nowIso(),
      });
      this.emit('project:rename');
      return touched;
    },
    /* Deleting a project keeps its work: tasks move to Personal rather than
       being silently destroyed.
       NB: `State.projects` is a getter over `data.projects`, so the array must
       be mutated in place (splice) — assigning `this.projects = [...]` would
       hit a getter with no setter and silently do nothing. */
    deleteProject(name) {
      const idx = this.projects.findIndex(x => x.name === name);
      const moved = this.tasks.filter(t => t.project === name).length;
      this.tasks.forEach(t => { if (t.project === name) t.project = 'Personal'; });
      if (idx !== -1) this.projects.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'project',
        text: moved
          ? `Deleted project “${name}” · ${moved} task${moved === 1 ? '' : 's'} moved to Personal`
          : `Deleted project “${name}”`,
        createdAt: nowIso(),
      });
      this.emit('project:delete');
      return moved;
    },

    /* --- Goals ------------------------------------------------------------
       A goal record holds identity and intent only. Its progress, health and
       counts are all derived from the tasks linked to it via task.goalId. */
    addGoal(fields = {}) {
      const name = (fields.name || '').trim() || 'Untitled goal';
      const g = {
        id: uid('g'),
        name,
        area: fields.area || 'Personal',
        horizon: fields.horizon || 'Quarter',
        deadline: fields.deadline || null,
        color: fields.color || Derive._autoColor(name),
        why: fields.why || '',
      };
      this.goals.push(g);
      this.activity.unshift({ id: uid('a'), kind: 'goal', text: `Created goal “${name}”`, createdAt: nowIso() });
      this.emit('goal:add');
      return g;
    },
    updateGoal(id, patch = {}) {
      const g = this.goals.find(x => x.id === id);
      if (!g) return null;
      Object.assign(g, patch);
      this.emit('goal:update');
      return g;
    },
    /* Deleting a goal keeps the work: linked tasks are unlinked rather than
       destroyed, so no task silently vanishes with its goal. */
    deleteGoal(id) {
      const idx = this.goals.findIndex(x => x.id === id);
      if (idx === -1) return 0;
      const name = this.goals[idx].name;
      let unlinked = 0;
      this.tasks.forEach(t => { if (t.goalId === id) { t.goalId = null; unlinked++; } });
      this.goals.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'goal',
        text: unlinked
          ? `Deleted goal “${name}” · ${unlinked} task${unlinked === 1 ? '' : 's'} unlinked`
          : `Deleted goal “${name}”`,
        createdAt: nowIso(),
      });
      this.emit('goal:delete');
      return unlinked;
    },

    /* --- Events (calendar) ------------------------------------------------ */
    addEvent(fields = {}) {
      const ev = normalizeEvent({
        id: uid('u'),
        title: fields.title,
        time: fields.time,
        kind: fields.kind || 'event',
        color: fields.color || '#6366F1',
        date: fields.date || todayKey(),
        notes: fields.notes,
      });
      this.upcoming.push(ev);
      this.activity.unshift({ id: uid('a'), kind: 'calendar',
        text: `Added “${ev.title}” on ${ev.date}`, createdAt: nowIso() });
      this.emit('event:add');
      return ev;
    },
    updateEvent(id, patch = {}) {
      const ev = this.upcoming.find(x => x.id === id);
      if (!ev) return null;
      Object.assign(ev, patch);
      this.emit('event:update');
      return ev;
    },
    deleteEvent(id) {
      const idx = this.upcoming.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [ev] = this.upcoming.splice(idx, 1);
      this.activity.unshift({ id: uid('a'), kind: 'calendar',
        text: `Removed “${ev.title}”`, createdAt: nowIso() });
      this.emit('event:delete');
      return ev;
    },
    /* Toggling a habit appends or removes TODAY from its history. That is the
       only mutation — streaks and everything else are derived from the log, so
       they can never drift out of sync with reality. */
    toggleHabit(id) {
      const h = this.habits.find(x => x.id === id);
      if (!h) return null;
      const key = todayKey();
      if (!Array.isArray(h.history)) h.history = [];
      const at = h.history.indexOf(key);
      if (at === -1) h.history.push(key);
      else h.history.splice(at, 1);
      h.history.sort();
      this.activity.unshift({
        id: uid('a'), kind: 'habit',
        text: at === -1 ? `Completed “${h.name}”` : `Unchecked “${h.name}”`,
        createdAt: nowIso(),
      });
      this.emit('habit:toggle');
      return h;
    },
    /* Toggle an arbitrary day — used by the detail-panel day strip so a missed
       day can be filled in retroactively. Future days are rejected. */
    toggleHabitDay(id, key) {
      const h = this.habits.find(x => x.id === id);
      if (!h || !key) return null;
      if (key > todayKey()) return null;                 // no future logging
      if (!Array.isArray(h.history)) h.history = [];
      const at = h.history.indexOf(key);
      if (at === -1) h.history.push(key);
      else h.history.splice(at, 1);
      h.history.sort();
      this.emit('habit:day');
      return h;
    },
    addHabit(fields = {}) {
      const name = (fields.name || '').trim() || 'Untitled habit';
      const h = normalizeHabit({
        id: uid('h'),
        name,
        icon: fields.icon || 'repeat',
        color: fields.color || Derive._autoColor(name),
        history: [],
      });
      this.habits.push(h);
      this.activity.unshift({ id: uid('a'), kind: 'habit',
        text: `Started tracking “${name}”`, createdAt: nowIso() });
      this.emit('habit:add');
      return h;
    },
    updateHabit(id, patch = {}) {
      const h = this.habits.find(x => x.id === id);
      if (!h) return null;
      Object.assign(h, patch);
      this.emit('habit:update');
      return h;
    },
    /* Deleting a habit removes its whole history — but that is the user's
       explicit intent, and we report the size of what was removed. */
    deleteHabit(id) {
      const idx = this.habits.findIndex(x => x.id === id);
      if (idx === -1) return 0;
      const [h] = this.habits.splice(idx, 1);
      const n = Array.isArray(h.history) ? h.history.length : 0;
      this.activity.unshift({ id: uid('a'), kind: 'habit',
        text: n ? `Deleted “${h.name}” · ${n} logged day${n === 1 ? '' : 's'} removed`
                : `Deleted “${h.name}”`, createdAt: nowIso() });
      this.emit('habit:delete');
      return n;
    },
    /* A completed focus session is appended to the log. Everything the UI shows
       about focus is derived from these records, so this is the ONLY write
       path — there is no running counter to keep in sync. */
    logSession({ mode = 'focus', minutes = 0, taskId = null, startedAt = Date.now(), endedAt = null } = {}) {
      const mins = Math.max(0, Math.round(Number(minutes) || 0));
      if (!mins) return null;
      const start = Number(startedAt) || Date.now();
      const s = {
        id: uid('f'),
        mode: mode === 'break' ? 'break' : 'focus',
        minutes: mins,
        startedAt: start,
        endedAt: Number(endedAt) || start + mins * 60000,
        day: dayKey(new Date(start)),
        taskId: taskId || null,
      };
      this.focus.push(s);
      const t = s.taskId ? this.tasks.find(x => x.id === s.taskId) : null;
      this.activity.unshift({
        id: uid('a'), kind: 'focus',
        text: s.mode === 'break'
          ? `Break · ${mins} min`
          : `Focus session · ${mins} min${t ? ' on “' + t.title + '”' : ''}`,
        createdAt: nowIso(),
      });
      this.emit('focus:log');
      return s;
    },
    /* Removing a session removes only that session — the rest of the log, and
       every total derived from it, simply recomputes. */
    deleteSession(id) {
      const idx = this.focus.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [s] = this.focus.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'focus',
        text: `Removed a ${s.minutes} min ${s.mode === 'break' ? 'break' : 'focus session'}`,
        createdAt: nowIso(),
      });
      this.emit('focus:delete');
      return s;
    },
    /* The daily target is a preference, so it lives in Settings — never in the
       session log. Bounds keep it sane (15 min … 12 h), and they are the SAME
       constants an import validates against, so a file cannot set a target this
       setter would refuse. */
    setFocusTarget(minutes) {
      const n = Math.round(Number(minutes) || 0);
      if (!(n >= FOCUS_TARGET_MIN && n <= FOCUS_TARGET_MAX)) return null;
      this.data.settings = Settings.set('focusTarget', n);
      this.emit('focus:target');
      return n;
    },
    /* Arrange the dashboard (M41). Which cards, in what order, in which column is
       an INTENTION — it records what the user asked to see, which no record can
       derive — so it lives in Settings, exactly like the focus target. Passing
       `null` clears the arrangement and the dashboard returns to the default set;
       passing `{wide:[],side:[]}` is a real answer ("show nothing") and is kept
       as one. */
    setDashboardCards(layout) {
      const picked = pickDashBoard(layout);
      this.data.settings = Settings.set('dashboard', picked);
      this.emit('settings:dashboard');
      return this.data.settings.dashboard;
    },
    setEntitlement(patch) {
      Object.assign(this.entitlement, patch);
      this.emit('entitlement:change');
    },
    /* Activate the local demo licence on a chosen billing period (M33, extended
       by the pricing page). There is no payment and no account in this app: the
       entitlement is a record on this device, it really changes what the app
       allows, and it can be undone.

       `billing` must name a real paid row of PLANS. It is checked rather than
       trusted, because the one caller that matters is a button in the DOM and a
       button is not an API — an unknown key here would leave the licence with no
       price and no period, and the page would then have to invent both. */
    activatePro(billing = 'monthly') {
      const plan = PLANS[billing];
      if (!plan || plan.price <= 0) return null;
      const now = nowIso();
      /* The log entry is written BEFORE the entitlement changes, and that order is
         load-bearing. `setEntitlement` emits, and the subscription runs the
         automation engine — which writes its own entries. Writing this one first
         makes insertion order agree with `createdAt` order, which is the order the
         log is re-sorted into on hydrate: the activation precedes the records it
         triggered, and the log reads the same before and after a reload. */
      this.activity.unshift({
        id: uid('a'), kind: 'other',
        text: `Activated the NEXUS Pro demo licence · ${plan.label} ${plan.cadence}`,
        createdAt: now,
      });
      this.setEntitlement({
        plan: 'PRO', status: 'PRO', source: 'local-demo',
        billing, periodStart: now,
        startDate: now, endDate: null,
        licenseId: 'demo-' + uid('lic'), lastVerified: now,
      });
      return billing;
    },
    /* Switching period keeps the same licence, the same start date and the same
       id — it changes WHEN the next period would begin, which is the whole of
       what a period switch is. A new `periodStart` is a new period. */
    switchBilling(billing) {
      const plan = PLANS[billing];
      if (!plan || plan.price <= 0) return null;
      if (!this.isPro) return null;
      const now = nowIso();
      this.activity.unshift({
        id: uid('a'), kind: 'other',
        text: `Switched NEXUS Pro to ${plan.label} ${plan.cadence}`, createdAt: now,
      });
      this.setEntitlement({ billing, periodStart: now, lastVerified: now });
      return billing;
    },
    /* The M33 name for `activatePro`, kept because the pricing page's rename was
       cosmetic and four suites (t34/t36/t38/t41) still call it. It is a thin
       alias, not a second implementation — a second implementation would be the
       thing that drifts. Remove it when those suites are updated. */
    activateDemoPro() { return this.activatePro('monthly'); },
    revertToFree() {
      const now = nowIso();
      /* Same ordering rule as activatePro: log first, then change the plan. */
      this.activity.unshift({
        id: uid('a'), kind: 'other',
        text: 'Returned to NEXUS Free', createdAt: now,
      });
      this.setEntitlement({
        plan: 'FREE', status: 'FREE', source: 'local-demo',
        billing: null, periodStart: null,
        startDate: null, endDate: null, licenseId: null, lastVerified: now,
      });
      return 'FREE';
    },

    /* --- Notes (Milestone 22) --------------------------------------------
       A note's body IS its data, so it is stored — but the timestamps are
       maintained here, in one place, so `updatedAt` can never drift from the
       edit that caused it. */
    addNote({ title = '', body = '', tags = [], parentId = null } = {}) {
      const now = new Date().toISOString();
      const n = normalizeNote({
        id: uid('n'),
        title: String(title).trim() || 'Untitled note',
        body: String(body),
        tags,
        parentId: (parentId && this.noteById(parentId)) ? parentId : null,
        createdAt: now,
        updatedAt: now,
      });
      this.notes.push(n);
      this.activity.unshift({ id: uid('a'), kind: 'note', text: `Created “${n.title}”`, createdAt: nowIso() });
      this.emit('note:add');
      return n;
    },
    /* Patch a note. `updatedAt` is only touched when something real changed, so
       merely opening a note never rewrites its history. */
    updateNote(id, patch) {
      const n = this.noteById(id);
      if (!n) return null;
      const clean = {};
      if ('title' in patch) {
        const t = String(patch.title).trim().slice(0, 140);
        if (t !== n.title) clean.title = t || 'Untitled note';
      }
      if ('body' in patch) {
        const b = String(patch.body).slice(0, 40000);
        if (b !== n.body) clean.body = b;
      }
      if ('tags' in patch) {
        const tags = [...new Set((patch.tags || [])
          .map(t => String(t).trim().toLowerCase()).filter(Boolean))]
          .filter(t => t.length <= 24).slice(0, 12);
        if (JSON.stringify(tags) !== JSON.stringify(n.tags)) clean.tags = tags;
      }
      if ('favorite' in patch && !!patch.favorite !== n.favorite) clean.favorite = !!patch.favorite;
      if ('pinned' in patch && !!patch.pinned !== n.pinned) clean.pinned = !!patch.pinned;
      if (!Object.keys(clean).length) return n;
      Object.assign(n, clean, { updatedAt: new Date().toISOString() });
      this.emit('note:update');
      return n;
    },
    noteById(id) {
      return this.notes.find(x => x.id === id) || null;
    },
    toggleNoteFavorite(id) {
      const n = this.noteById(id);
      if (!n) return null;
      return this.updateNote(id, { favorite: !n.favorite });
    },
    toggleNotePin(id) {
      const n = this.noteById(id);
      if (!n) return null;
      return this.updateNote(id, { pinned: !n.pinned });
    },
    /* Deleting a note removes only the note — there is nothing else that
       references it yet, so nothing else has to change. */
    /* Move a note inside another (or to the top level with `null`).
       Refuses the two things that would corrupt the tree: parenting a note to
       itself, and parenting it to one of its own descendants — either would
       create a cycle that every tree walk would spin on forever. */
    setNoteParent(id, parentId) {
      const n = this.noteById(id);
      if (!n) return null;
      const pid = parentId || null;
      if (pid === id) return null;
      if (pid && !this.noteById(pid)) return null;
      if (pid) {
        let cur = pid, guard = 0;
        while (cur && guard++ < 1000) {
          if (cur === id) return null;            // would make a cycle
          const p = this.noteById(cur);
          cur = p ? p.parentId : null;
        }
      }
      if (n.parentId === pid) return n;
      n.parentId = pid;
      n.updatedAt = new Date().toISOString();
      this.emit('note:move');
      return n;
    },
    /* Pointers at workspace objects. Duplicates and unknown types are refused;
       a note may hold at most 20. */
    addNoteRef(id, type, refId) {
      const n = this.noteById(id);
      if (!n || REF_TYPES.indexOf(type) === -1 || !refId) return null;
      const rid = String(refId);
      if (n.refs.some(r => r.type === type && r.id === rid)) return n;
      if (n.refs.length >= 20) return null;
      n.refs.push({ type, id: rid });
      n.updatedAt = new Date().toISOString();
      this.emit('note:ref');
      return n;
    },
    removeNoteRef(id, type, refId) {
      const n = this.noteById(id);
      if (!n) return null;
      const rid = String(refId);
      const before = n.refs.length;
      n.refs = n.refs.filter(r => !(r.type === type && r.id === rid));
      if (n.refs.length === before) return n;
      n.updatedAt = new Date().toISOString();
      this.emit('note:ref');
      return n;
    },
    /* Deleting a note never destroys the notes filed inside it: children move
       up to take its place, exactly like a project's tasks moving to Personal. */
    deleteNote(id) {
      const idx = this.notes.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [n] = this.notes.splice(idx, 1);
      let moved = 0;
      this.notes.forEach(c => {
        if (c.parentId === id) { c.parentId = n.parentId || null; moved++; }
      });
      this.activity.unshift({
        id: uid('a'), kind: 'note',
        text: moved
          ? `Deleted “${n.title}” · ${moved} child note${moved === 1 ? '' : 's'} kept`
          : `Deleted “${n.title}”`,
        createdAt: nowIso(),
      });
      this.emit('note:delete');
      return n;
    },

    /* --- Journal (Milestone 24) ------------------------------------------
       An entry is the one record the user authors by hand: a body plus three
       self-ratings. One entry per day, so `day` is the natural identity. Nothing
       about the *collection* — the streak, the averages, the month grid — is
       stored; it is all derived at render time from these records. */
    journalById(id) {
      return this.journal.find(e => e.id === id) || null;
    },
    journalByDay(day) {
      const key = /^\d{4}-\d{2}-\d{2}$/.test(day || '') ? day : todayKey();
      return this.journal.find(e => e.day === key) || null;
    },
    /* Lazily create an entry the moment the user starts writing, so the composer
       never needs a separate "create" step. Only ever called when there is real
       content to keep — an untouched day leaves no record behind. */
    ensureJournalEntry(day) {
      const key = /^\d{4}-\d{2}-\d{2}$/.test(day || '') ? day : todayKey();
      const found = this.journalByDay(key);
      if (found) return found;
      const now = new Date().toISOString();
      const e = normalizeJournal({ id: uid('j'), day: key, createdAt: now, updatedAt: now });
      this.journal.push(e);
      // Keep the collection in day order (newest first) so diagnostics read
      // naturally; every UI surface sorts by derivation anyway.
      this.journal.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
      this.activity.unshift({ id: uid('a'), kind: 'journal',
        text: `Wrote a journal entry for ${key}`, createdAt: nowIso() });
      this.emit('journal:add');
      return e;
    },
    /* Patch an entry. `updatedAt` only moves when something real changed, so
       merely opening an entry never rewrites its history. */
    updateJournalEntry(id, patch = {}) {
      const e = this.journalById(id);
      if (!e) return null;
      const clean = {};
      if ('title' in patch) {
        const t = String(patch.title == null ? '' : patch.title).trim().slice(0, 140);
        if (t !== e.title) clean.title = t;
      }
      if ('body' in patch) {
        const b = String(patch.body == null ? '' : patch.body).slice(0, 40000);
        if (b !== e.body) clean.body = b;
      }
      ['mood', 'energy', 'productivity'].forEach(k => {
        if (!(k in patch)) return;
        const v = journalRating(patch[k]);
        if (v !== e[k]) clean[k] = v;
      });
      if ('tags' in patch) {
        const tags = [...new Set((patch.tags || [])
          .map(t => String(t).trim().toLowerCase()).filter(Boolean))]
          .filter(t => t.length <= 24).slice(0, 12);
        if (JSON.stringify(tags) !== JSON.stringify(e.tags)) clean.tags = tags;
      }
      if (!Object.keys(clean).length) return e;
      Object.assign(e, clean, { updatedAt: new Date().toISOString() });
      this.emit('journal:update');
      return e;
    },
    /* Rate one axis of one day, creating the entry if nothing has been written
       yet. Passing `null` clears the rating — the UI uses that for "click the
       active dot again", and refuses to create a record just to clear nothing. */
    rateJournalDay(day, key, value) {
      if (['mood', 'energy', 'productivity'].indexOf(key) === -1) return null;
      const existing = this.journalByDay(day);
      if (!existing && value == null) return null;
      const e = existing || this.ensureJournalEntry(day);
      return this.updateJournalEntry(e.id, { [key]: value });
    },
    deleteJournalEntry(id) {
      const idx = this.journal.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [e] = this.journal.splice(idx, 1);
      this.activity.unshift({ id: uid('a'), kind: 'journal',
        text: `Deleted the journal entry for ${e.day}`, createdAt: nowIso() });
      this.emit('journal:delete');
      return e;
    },

    /* --- Inbox (Milestone 25) --------------------------------------------
       A capture is raw text plus the kind the user tagged it with. Triaging it
       records a real decision (`status`, `convertedTo`, `processedAt`), which is
       why those are stored — but every count, age and ranking is derived. */
    inboxById(id) {
      return this.inbox.find(x => x.id === id) || null;
    },
    addInboxItem({ text = '', kind = 'thought', url = '' } = {}) {
      const body = String(text).trim().slice(0, 2000);
      if (!body) return null;                       // an empty capture is not a capture
      const it = normalizeInbox({
        id: uid('i'), text: body, kind, url, createdAt: new Date().toISOString(),
      });
      this.inbox.unshift(it);
      const label = (INBOX_KINDS.find(k => k.key === it.kind) || {}).label || 'item';
      this.activity.unshift({
        id: uid('a'), kind: 'inbox',
        text: `Captured a ${label.toLowerCase()}: “${it.text.slice(0, 56)}${it.text.length > 56 ? '…' : ''}”`,
        createdAt: nowIso(),
      });
      this.emit('inbox:add');
      return it;
    },
    updateInboxItem(id, patch = {}) {
      const it = this.inboxById(id);
      if (!it) return null;
      const clean = {};
      if ('text' in patch) {
        const t = String(patch.text == null ? '' : patch.text).trim().slice(0, 2000);
        // An empty capture has nothing to say; refuse it rather than blanking the row.
        if (t && t !== it.text) clean.text = t;
      }
      if ('kind' in patch && INBOX_KINDS.some(k => k.key === patch.kind) && patch.kind !== it.kind) {
        clean.kind = patch.kind;
      }
      if ('url' in patch) {
        const u = String(patch.url == null ? '' : patch.url).trim().slice(0, 500);
        if (u !== it.url) clean.url = u;
      }
      if (!Object.keys(clean).length) return it;
      Object.assign(it, clean);
      this.emit('inbox:update');
      return it;
    },
    deleteInboxItem(id) {
      const idx = this.inbox.findIndex(x => x.id === id);
      if (idx === -1) return null;
      const [it] = this.inbox.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'inbox',
        text: `Discarded a capture: “${it.text.slice(0, 56)}${it.text.length > 56 ? '…' : ''}”`,
        createdAt: nowIso(),
      });
      this.emit('inbox:delete');
      return it;
    },
    /* Triage. The target is created through the SAME State methods every other
       page uses, so a converted capture becomes an ordinary record: it shows up
       in Tasks, counts toward its project, and moves the NEXUS Score. Nothing
       here is a special case that only the Inbox can see. */
    convertInboxItem(id, type) {
      const it = this.inboxById(id);
      if (!it || it.status === 'processed') return null;
      if (!INBOX_DESTS.some(d => d.type === type)) return null;

      const text = it.text;
      let target = null;

      if (type === 'task') {
        target = this.addTask(text, { project: 'Personal', due: 'Today' });
      } else if (type === 'note') {
        target = this.addNote({
          title: text.slice(0, 80),
          body: it.url ? text + '\n\n' + it.url : text,
        });
      } else if (type === 'project') {
        target = this.addProject({ name: text.slice(0, 80) });
      } else if (type === 'goal') {
        target = this.addGoal({ name: text.slice(0, 80) });
      } else if (type === 'journal') {
        /* "Keep it as a thought" needs no new record — the words join today's
           entry, which is exactly where an unactionable capture belongs. */
        const e = this.ensureJournalEntry(todayKey());
        const prev = e.body ? e.body.replace(/\s+$/, '') + '\n\n' : '';
        this.updateJournalEntry(e.id, { body: prev + text });
        target = e;
      }
      if (!target) return null;

      it.status = 'processed';
      it.convertedTo = { type, id: String(target.id) };
      it.processedAt = new Date().toISOString();
      this.emit('inbox:convert');
      return { item: it, target };
    },
    /* Un-triaging puts the capture back in the queue. The record it became is
       NOT removed — the user asked to undo the filing, not to destroy the work. */
    reopenInboxItem(id) {
      const it = this.inboxById(id);
      if (!it || it.status !== 'processed') return null;
      it.status = 'inbox';
      it.convertedTo = null;
      it.processedAt = null;
      this.emit('inbox:reopen');
      return it;
    },
    /* Clearing the processed list removes only the capture records. Everything
       they became — tasks, notes, projects, goals — is left untouched. */
    clearProcessedInbox() {
      const doomed = this.inbox.filter(x => x.status === 'processed');
      if (!doomed.length) return 0;
      for (let i = this.inbox.length - 1; i >= 0; i--) {
        if (this.inbox[i].status === 'processed') this.inbox.splice(i, 1);
      }
      this.activity.unshift({
        id: uid('a'), kind: 'inbox',
        text: `Cleared ${doomed.length} processed capture${doomed.length === 1 ? '' : 's'}`,
        createdAt: nowIso(),
      });
      this.emit('inbox:clear');
      return doomed.length;
    },

    /* --- Finance (Milestone 26) ------------------------------------------
       The log is the truth. A transaction records something that happened; every
       total, breakdown, rate and chart is derived from these records, so a new
       entry moves all of them at once and nothing can drift. */
    transactionById(id) {
      return this.transactions.find(t => t.id === id) || null;
    },
    addTransaction({ label = '', amount = 0, type = 'expense', category = '', day = null, note = '' } = {}) {
      const amt = Math.round(Number(amount) * 100) / 100;
      const text = String(label == null ? '' : label).trim().slice(0, 120);
      /* A nameless or non-positive record is not a transaction. A negative amount
         is a caller bug rather than a refund — `type` carries the sign — so it is
         refused instead of being silently flipped to a positive. (normalizeTransaction
         still takes the magnitude, because that function repairs stored data.) */
      if (!text || !(amt > 0)) return null;
      const tx = normalizeTransaction({
        id: uid('x'), label: text, amount: amt, type, category, day, note,
        createdAt: new Date().toISOString(),
      });
      this.transactions.push(tx);
      this.transactions.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
      this.activity.unshift({
        id: uid('a'), kind: 'finance',
        text: `${tx.type === 'income' ? 'Received' : 'Spent'} ${Derive.money(tx.amount)} on “${tx.label}”`,
        createdAt: nowIso(),
      });
      this.emit('finance:add');
      return tx;
    },
    updateTransaction(id, patch = {}) {
      const t = this.transactionById(id);
      if (!t) return null;
      const clean = {};
      if ('label' in patch) {
        const v = String(patch.label == null ? '' : patch.label).trim().slice(0, 120);
        if (v && v !== t.label) clean.label = v;
      }
      if ('amount' in patch) {
        // Same rule as addTransaction: a non-positive amount is refused, never
        // silently rewritten to its absolute value.
        const v = Math.round(Number(patch.amount) * 100) / 100;
        if (v > 0 && v !== t.amount) clean.amount = v;
      }
      if ('type' in patch && (patch.type === 'income' || patch.type === 'expense') && patch.type !== t.type) {
        clean.type = patch.type;
      }
      const nextType = clean.type || t.type;
      if ('category' in patch
          && FINANCE_CATEGORIES.some(c => c.name === patch.category && c.type === nextType)
          && patch.category !== t.category) {
        clean.category = patch.category;
      }
      if ('day' in patch && /^\d{4}-\d{2}-\d{2}$/.test(patch.day || '') && patch.day !== t.day) {
        clean.day = patch.day;
      }
      if ('note' in patch) {
        const v = String(patch.note == null ? '' : patch.note).slice(0, 500);
        if (v !== t.note) clean.note = v;
      }
      if (!Object.keys(clean).length) return t;
      Object.assign(t, clean);
      /* Flipping the side of the ledger can strand the category: "Salary" cannot
         describe an expense. Re-file it rather than leaving an impossible pair. */
      if (clean.type && !FINANCE_CATEGORIES.some(c => c.name === t.category && c.type === t.type)) {
        t.category = t.type === 'income' ? 'Other income' : 'Other';
      }
      this.transactions.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
      this.emit('finance:update');
      return t;
    },
    deleteTransaction(id) {
      const idx = this.transactions.findIndex(t => t.id === id);
      if (idx === -1) return null;
      const [t] = this.transactions.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'finance',
        text: `Removed “${t.label}” · ${Derive.money(t.amount)}`, createdAt: nowIso(),
      });
      this.emit('finance:delete');
      return t;
    },
    /* Currency is a preference, not a property of any record — changing it
       reformats every figure without touching the log. */
    setCurrency(code) {
      if (!CURRENCIES.some(c => c.code === code)) return null;
      if (!this.data.finance) this.data.finance = { currency: code, budgets: {} };
      this.data.finance.currency = code;
      this.emit('finance:currency');
      return code;
    },
    /* A monthly budget TARGET for one expense category. A target is an intention,
       so it is stored — nothing in the log can tell you what you meant to spend.
       Only expense categories take a target (there is no budget for income), and a
       zero or blank clears it rather than leaving a meaningless `0` behind. */
    setBudget(category, amount) {
      const cat = FINANCE_CATEGORIES.find(c => c.name === category && c.type === 'expense');
      if (!cat) return null;
      if (!this.data.finance) this.data.finance = { currency: 'INR', budgets: {} };
      if (!this.data.finance.budgets) this.data.finance.budgets = {};
      const v = Math.round(Number(amount) * 100) / 100;
      if (v > 0) this.data.finance.budgets[category] = v;
      else delete this.data.finance.budgets[category];
      this.emit('finance:budget');
      return v > 0 ? v : null;
    },

    /* --- Files (Milestone 28) --------------------------------------------
       A file is a name, an optional label, a set of pointers at workspace
       records, and the bytes themselves. Nothing about it is precomputed: the
       size, the mime type, the kind and the extension all come off the Blob at
       render time, so a file's descriptor can never disagree with its content. */
    fileById(id) {
      return this.files.find(f => f.id === id) || null;
    },
    /* Store a real uploaded file. The Blob is required — a reference with no
       bytes behind it would be a row the user cannot open. */
    addFile({ name = '', blob = null, label = '', refs = [] } = {}) {
      if (!blob || typeof blob.size !== 'number') return null;
      const f = normalizeFile({ name, blob, label, refs, createdAt: new Date().toISOString() });
      this.files.unshift(f);
      this.activity.unshift({
        id: uid('a'), kind: 'file', text: `Added “${f.name}”`, createdAt: nowIso(),
      });
      this.emit('file:add');
      return f;
    },
    /* Rename / relabel. A file's identity is its content, so a rename does not
       change what it holds and is not tracked as a version. */
    updateFile(id, patch = {}) {
      const f = this.fileById(id);
      if (!f) return null;
      const clean = {};
      if ('name' in patch) {
        const n = String(patch.name == null ? '' : patch.name).trim().slice(0, 200);
        if (n && n !== f.name) clean.name = n;
      }
      if ('label' in patch) {
        const l = String(patch.label == null ? '' : patch.label).trim().slice(0, 160);
        if (l !== f.label) clean.label = l;
      }
      if (!Object.keys(clean).length) return f;
      Object.assign(f, clean);
      this.emit('file:update');
      return f;
    },
    /* Deleting a file removes the file. Nothing in the workspace is built on top
       of it, so nothing else has to move — the pointers it held stop existing and
       the records they named are untouched. */
    deleteFile(id) {
      const idx = this.files.findIndex(f => f.id === id);
      if (idx === -1) return null;
      const [f] = this.files.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'file', text: `Deleted “${f.name}”`, createdAt: nowIso(),
      });
      this.emit('file:delete');
      return f;
    },
    /* Pointers at workspace objects. Unknown types and duplicates are refused;
       a file may hold at most 20. */
    addFileRef(id, type, refId) {
      const f = this.fileById(id);
      if (!f || FILE_REF_TYPES.indexOf(type) === -1 || !refId) return null;
      const rid = String(refId);
      if (f.refs.some(r => r.type === type && r.id === rid)) return f;
      if (f.refs.length >= 20) return null;
      f.refs.push({ type, id: rid });
      this.emit('file:ref');
      return f;
    },
    removeFileRef(id, type, refId) {
      const f = this.fileById(id);
      if (!f) return null;
      const rid = String(refId);
      const before = f.refs.length;
      f.refs = f.refs.filter(r => !(r.type === type && r.id === rid));
      if (f.refs.length === before) return f;
      this.emit('file:ref');
      return f;
    },

    /* --- Activity (Milestone 30) -----------------------------------------
       The log is written by everything else; the one thing the user can do TO it
       is empty it. Nothing is logged about the clear itself — an entry describing
       it would immediately refill the log the user just emptied. */
    clearActivity() {
      const n = this.activity.length;
      if (!n) return 0;
      this.activity.splice(0, this.activity.length);
      this.emit('activity:clear');
      return n;
    },

    /* --- Notification decisions (Milestone 36) ---------------------------
       The alerts are derived; only the user's DECISION about one is stored, and
       it lives in Settings with every other preference — small, synchronous, and
       it needs no database version. Each decision carries the alert's `until`
       (the first day it can never recur) and is kept only while the alert it is
       about is still true — see `pruneNotificationState`. */
    _notifMap() {
      const all = Settings.read().notifications;
      const out = (all && typeof all === 'object') ? all : {};
      out.read = (out.read && typeof out.read === 'object') ? out.read : {};
      out.dismissed = (out.dismissed && typeof out.dismissed === 'object') ? out.dismissed : {};
      return out;
    },
    notificationDecision(key) {
      const all = this._notifMap();
      return { read: !!all.read[key], dismissed: !!all.dismissed[key] };
    },
    _writeNotification(bucket, key, until) {
      if (!key) return null;
      const all = this._notifMap();
      const rec = { at: nowIso(), until: until || null };
      all[bucket][key] = rec;
      Settings.set('notifications', all);
      this.emit('notifications:change');
      return rec;
    },
    markNotificationRead(key, until) { return this._writeNotification('read', key, until); },
    dismissNotification(key, until) { return this._writeNotification('dismissed', key, until); },
    /* Restoring an alert forgets BOTH decisions about it — "show me that again"
       has to mean the alert returns to the unread state, not to a read one. */
    restoreNotification(key) {
      const all = this._notifMap();
      delete all.read[key];
      delete all.dismissed[key];
      Settings.set('notifications', all);
      this.emit('notifications:change');
      return true;
    },
    markAllNotificationsRead() {
      const all = this._notifMap();
      let n = 0;
      Derive.notifications().forEach(a => {
        if (all.dismissed[a.key] || all.read[a.key]) return;
        all.read[a.key] = { at: nowIso(), until: a.until || null };
        n++;
      });
      if (n) { Settings.set('notifications', all); this.emit('notifications:change'); }
      return n;
    },
    /* Forget every decision. The alerts themselves are derived, so this cannot
       lose anything — it only un-hides what the user had already dealt with. */
    clearNotificationState() {
      const all = this._notifMap();
      const n = Object.keys(all.read).length + Object.keys(all.dismissed).length;
      Settings.set('notifications', { read: {}, dismissed: {} });
      this.emit('notifications:change');
      return n;
    },
    /* Drop every decision that has stopped meaning anything. Called on boot, so
       the stored map is bounded by what is currently TRUE rather than by how long
       the workspace has existed. A decision goes for one of two reasons:
         · it has EXPIRED — `until` names the first day the alert can never recur,
           and a past day never becomes current again; or
         · it is no longer ABOUT anything — the alert it refers to is not in
           today's derivation, so keeping it would be keeping a judgement about a
           claim nobody is making.
       The second rule is the real bound. A record-scoped alert (an overdue task,
       a waiting capture, a rule with a backlog) has no expiry, so without it the
       decisions would accumulate for the life of the workspace. */
    pruneNotificationState() {
      const all = this._notifMap();
      const today = todayKey();
      const live = new Set(Derive.notifications().map(a => a.key));
      let n = 0;
      ['read', 'dismissed'].forEach(bucket => {
        Object.keys(all[bucket]).forEach(k => {
          const until = all[bucket][k] && all[bucket][k].until;
          if ((until && until <= today) || !live.has(k)) { delete all[bucket][k]; n++; }
        });
      });
      if (n) Settings.set('notifications', all);
      return n;
    },

    /* --- Reviews (Milestone 32) ------------------------------------------
       A review is the user's own words about a period plus a self-rating. The
       figures shown beside it are derived from that period's records on demand,
       so nothing measured is ever written into a review. */
    reviewById(id) {
      return this.reviews.find(r => r.id === id) || null;
    },
    reviewFor(kind, start) {
      return this.reviews.find(r => r.kind === kind && r.start === start) || null;
    },
    /* One review per period, created lazily the moment the user starts writing —
       an untouched period leaves no record behind. */
    ensureReview(kind, start) {
      const k = REVIEW_KINDS.some(x => x.key === kind) ? kind : 'week';
      const s = reviewStart(k, new Date(start + 'T12:00:00'));
      const found = this.reviewFor(k, s);
      if (found) return found;
      const now = nowIso();
      const r = normalizeReview({ id: uid('rv'), kind: k, start: s, createdAt: now, updatedAt: now });
      this.reviews.push(r);
      this.activity.unshift({
        id: uid('a'), kind: 'review',
        text: `Started a ${reviewKind(k).label.toLowerCase()} review for ${s}`,
        createdAt: now,
      });
      this.emit('review:add');
      return r;
    },
    /* Patch a review. `updatedAt` only moves when something real changed, so merely
       opening one never rewrites its history. */
    updateReview(id, patch = {}) {
      const r = this.reviewById(id);
      if (!r) return null;
      const clean = {};
      if ('title' in patch) {
        const t = String(patch.title == null ? '' : patch.title).trim().slice(0, 140);
        if (t !== r.title) clean.title = t;
      }
      if ('body' in patch) {
        const b = String(patch.body == null ? '' : patch.body).slice(0, 20000);
        if (b !== r.body) clean.body = b;
      }
      if ('rating' in patch) {
        const v = reviewRating(patch.rating);
        if (v !== r.rating) clean.rating = v;
      }
      if (!Object.keys(clean).length) return r;
      Object.assign(r, clean, { updatedAt: nowIso() });
      this.emit('review:update');
      return r;
    },
    /* Deleting a review removes the reflection and nothing else — every record of
       the period it described stays exactly as it was. */
    deleteReview(id) {
      const idx = this.reviews.findIndex(r => r.id === id);
      if (idx === -1) return null;
      const [r] = this.reviews.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'review',
        text: `Deleted the ${reviewKind(r.kind).label.toLowerCase()} review for ${r.start}`,
        createdAt: nowIso(),
      });
      this.emit('review:delete');
      return r;
    },

    /* ======================================================================
       AUTOMATION — Milestone 35
       The engine is a FOLD, not a scheduler. On load it asks what each enabled
       rule should have produced by now and makes up the difference. That is the
       only way an offline, local-first app can honour "rules that run
       themselves": a `setInterval` cannot fire while the app is closed, so it
       would silently skip every occurrence that fell outside a session.
       ====================================================================== */
    automationById(id) { return this.automations.find(r => r.id === id) || null; },

    addAutomation({ name = '', trigger = {}, action = {}, enabled = true } = {}) {
      const now = nowIso();
      const r = normalizeAutomation({
        id: uid('au'), name, trigger, action, enabled, createdAt: now, updatedAt: now,
      });
      this.automations.push(r);
      this.activity.unshift({
        id: uid('a'), kind: 'automation', text: `Created the rule “${r.name}”`,
        createdAt: now,
      });
      this.emit('automation:add');
      return r;
    },

    /* Patch a rule. `updatedAt` only moves when something real changed, so
       opening a rule to look at it never rewrites its history. */
    updateAutomation(id, patch = {}) {
      const r = this.automationById(id);
      if (!r) return null;
      const merged = normalizeAutomation({
        ...r,
        ...('name' in patch ? { name: patch.name } : {}),
        ...('enabled' in patch ? { enabled: !!patch.enabled } : {}),
        ...('trigger' in patch ? { trigger: { ...r.trigger, ...patch.trigger } } : {}),
        ...('action' in patch ? { action: { ...r.action, ...patch.action } } : {}),
        updatedAt: r.updatedAt,
      });
      const changed = ['name', 'enabled'].some(k => merged[k] !== r[k])
        || JSON.stringify(merged.trigger) !== JSON.stringify(r.trigger)
        || JSON.stringify(merged.action) !== JSON.stringify(r.action);
      if (!changed) return r;
      merged.updatedAt = nowIso();
      Object.assign(r, merged);
      this.emit('automation:update');
      return r;
    },

    toggleAutomation(id) {
      const r = this.automationById(id);
      if (!r) return null;
      r.enabled = !r.enabled;
      r.updatedAt = nowIso();
      this.emit('automation:toggle');
      return r;
    },

    /* Deleting a rule stops it running and destroys NOTHING else. Every record it
       made stays exactly where it is — a delete never destroys work the user did
       not ask to destroy — and its `origin` stamp simply stops resolving. */
    deleteAutomation(id) {
      const idx = this.automations.findIndex(r => r.id === id);
      if (idx === -1) return null;
      const [r] = this.automations.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'automation', text: `Deleted the rule “${r.name}”`,
        createdAt: nowIso(),
      });
      this.emit('automation:delete');
      return r;
    },

    /* Make one record for one occurrence. It goes through the SAME creators every
       other page uses, so an automated task is an ordinary task: it counts toward
       its project, moves the NEXUS Score, and turns up in search. The only thing
       added afterwards is the provenance stamp. */
    _materialise(rule, day) {
      const a = rule.action;
      const title = Derive.automationTemplate(a.title || a.text || '', day);
      let rec = null;
      if (a.type === 'task') {
        rec = this.addTask(title, {
          project: a.project, priority: a.priority,
          due: dayKey(shiftDays(new Date(day + 'T12:00:00'), a.dueIn || 0)),
        });
      } else if (a.type === 'capture') {
        rec = this.addInboxItem({ text: title, kind: 'thought' });
      } else {
        rec = this.addNote({ title, body: Derive.automationTemplate(a.body || '', day) });
      }
      if (rec) rec.origin = { rule: rule.id, day };
      return rec;
    },

    /* Bring one rule up to date. At most `AUTOMATION_CATCHUP` occurrences are made
       in a single run: a rule left alone for three months must not dump ninety
       tasks into the workspace the moment the app opens, and the caller is told
       how many older ones were skipped rather than left to guess.
       Returns `{ created, skipped, days }`. */
    runAutomation(id, opts) {
      const rule = this.automationById(id);
      if (!rule || !rule.enabled) return { created: 0, skipped: 0, days: [] };
      const pending = Derive.automationPending(rule, opts);
      if (!pending.length) return { created: 0, skipped: 0, days: [] };
      const take = pending.slice(-AUTOMATION_CATCHUP);
      const skipped = pending.length - take.length;
      let created = 0;
      take.forEach(day => { if (this._materialise(rule, day)) created++; });
      /* The high-water mark is the last occurrence actually MADE. Occurrences
         older than the cap fall behind it and are never retried: the run made a
         deliberate choice, and repeating it on every load would be worse than
         skipping it once. */
      rule.lastRun = take[take.length - 1];
      rule.updatedAt = nowIso();
      if (created) {
        this.activity.unshift({
          id: uid('a'), kind: 'automation',
          text: `“${rule.name}” made ${created} record${created === 1 ? '' : 's'}` +
                (skipped ? ` and skipped ${skipped} older one${skipped === 1 ? '' : 's'}` : ''),
          createdAt: nowIso(),
        });
      }
      this.emit('automation:run');
      return { created, skipped, days: take };
    },

    /* Run every enabled rule that has something waiting. Called once on boot,
       which is what makes the feature real — the rules run without being asked.
       Silent by design: the evidence is the records they left behind.

       It is gated, because Automation is a Pro feature: reverting to Free has to
       stop the rules running, the same way it re-locks the Time Machine route.
       What a rule already made is untouched — Pro takes nothing away, and a
       revert does not destroy work either. */
    runDueAutomations() {
      if (!FeatureAccess.allows('automation')) return { created: 0, rules: 0 };
      let created = 0, rules = 0;
      this.automations.forEach(r => {
        if (!r.enabled) return;
        const out = this.runAutomation(r.id);
        if (out.created) { created += out.created; rules++; }
      });
      return { created, rules };
    },

    /* --- Templates (Milestone 37) ----------------------------------------
       Applying a template is an ACTION, not a schedule. It makes its records now,
       through the SAME creators every other page uses, so a templated task is an
       ordinary task: it counts toward its project, moves the NEXUS Score, and
       turns up in search. Asking twice makes twice as much — that is what an
       invoked thing does, and it is the honest difference from a rule.

       Nothing is stored about the fact that a template was applied beyond the
       activity entry, because everything else is already visible in the records
       it left behind. */
    templateById(id) {
      return this.templates.find(t => t.id === id) || null;
    },

    addTemplate({ name = '', icon = 'sparkles', items = [] } = {}) {
      const t = normalizeTemplate({ name, icon, items });
      this.templates.push(t);
      this.activity.unshift({
        id: uid('a'), kind: 'template',
        text: `Wrote the “${t.name}” template`, createdAt: nowIso(),
      });
      this.emit('template:add');
      return t;
    },

    /* Patch a template. The normalizer runs on the merged record, so an edit can
       never leave a malformed item behind. */
    updateTemplate(id, patch = {}) {
      const t = this.templateById(id);
      if (!t) return null;
      const next = normalizeTemplate({ ...t, ...patch });
      t.name = next.name;
      t.icon = next.icon;
      t.items = next.items;
      t.updatedAt = nowIso();
      this.emit('template:update');
      return t;
    },

    /* Deleting a template destroys NOTHING else. Every record it ever made is an
       ordinary record and stays exactly where it is — a delete never destroys
       work the user did not ask to destroy. */
    deleteTemplate(id) {
      const idx = this.templates.findIndex(t => t.id === id);
      if (idx === -1) return null;
      const [t] = this.templates.splice(idx, 1);
      this.activity.unshift({
        id: uid('a'), kind: 'template',
        text: `Deleted the “${t.name}” template`, createdAt: nowIso(),
      });
      this.emit('template:delete');
      return t;
    },

    /* Make every record the template describes, and nothing else. Refuses rather
       than guesses when a hole is unanswered: a task called "Write the brief for
       {name}" is worse than no task at all, because it looks finished.
       Returns `{ created, records, missing }`. */
    applyTemplate(id, day, vars) {
      const t = this.templateById(id);
      if (!t) return { created: 0, records: [], missing: [] };
      const d = day || todayKey();
      const v = vars || {};
      const missing = Derive.templateHoles(t)
        .filter(k => !String(v[k] == null ? '' : v[k]).trim());
      if (missing.length) return { created: 0, records: [], missing };

      const records = [];
      t.items.forEach(item => {
        const p = Derive.templateItem(item, d, v);
        const rec = p.type === 'task'
          ? this.addTask(p.title, { project: p.project, priority: p.priority, due: p.due })
          : p.type === 'capture'
          ? this.addInboxItem({ text: p.text, kind: 'thought' })
          : this.addNote({ title: p.title, body: p.body });
        if (rec) records.push(rec);
      });
      if (records.length) {
        this.activity.unshift({
          id: uid('a'), kind: 'template',
          text: `Applied the “${t.name}” template — made ${records.length} record${
            records.length === 1 ? '' : 's'}`,
          createdAt: nowIso(),
        });
      }
      this.emit('template:apply');
      return { created: records.length, records, missing: [] };
    },

    /* --- Onboarding (Milestone 38) ----------------------------------------
       The user profile. `name` and `focus` are the only things onboarding asks
       for, and every one of these writes is a real change to state the app then
       reads — the greeting, the dashboard strip. A setter that stored an answer
       nothing consumed would be a survey, not onboarding. */
    setUserName(raw) {
      const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim().slice(0, USER_NAME_MAX);
      if (!name) return null;              // a blank name is not a name — keep the old one
      if (name === this.user.name) return this.user;
      this.user.name = name;
      this.activity.unshift({
        id: uid('a'), kind: 'other', text: `Renamed the workspace owner to “${name}”`,
        createdAt: nowIso(),
      });
      this.emit('user:name');
      return this.user;
    },
    /* Only real starting points, deduped, in the order the table declares them —
       so the dashboard strip and the settings chips cannot disagree about order. */
    setUserFocus(keys) {
      const wanted = Array.isArray(keys) ? keys : [];
      const focus = START_HERE.filter(s => wanted.indexOf(s.key) !== -1).map(s => s.key);
      if (JSON.stringify(focus) === JSON.stringify(this.user.focus)) return this.user;
      this.user.focus = focus;
      this.emit('user:focus');
      return this.user;
    },
    /* Completing and skipping are the SAME write: both mean "they have seen it".
       Skipping deliberately changes nothing else, so the workspace stays exactly
       as it was — a skip must never be a half-set-up state. */
    completeOnboarding({ name, focus } = {}) {
      if (name != null) this.setUserName(name);
      if (focus != null) this.setUserFocus(focus);
      if (this.user.onboardedAt) return this.user;
      this.user.onboardedAt = Date.now();
      this.activity.unshift({
        id: uid('a'), kind: 'other', text: 'Finished setting up the workspace',
        createdAt: nowIso(),
      });
      this.emit('user:onboarded');
      return this.user;
    },
    /* Re-running keeps the answers and only forgets that they were given — so the
       flow can be revisited without losing a name or a focus. */
    resetOnboarding() {
      if (!this.user.onboardedAt) return this.user;
      this.user.onboardedAt = null;
      this.emit('user:onboarded');
      return this.user;
    },

    /* Import a workspace (M39). The payload goes through `_reconcile` — the SAME
       function a reload uses — so a file cannot introduce a record shape the app
       would never write itself. An import is not a second door into state.

       Two things are deliberately NOT taken from the file:
         · **the entitlement.** The plan is live state, not data (invariant 10),
           so a file can neither grant Pro nor take it away. Yours survives.
         · **anything the file does not carry**, for exactly the same reason.

       A refusal changes nothing: `importPreview` runs first, and every failure
       path returns before a single field is touched. */
    async importWorkspace(payload) {
      const p = Derive.importPreview(payload);
      if (!p.ok) return { ok: false, error: p.error };

      const before = Derive.workspaceSummary();

      /* File contents arrive as base64. Decode BEFORE `_reconcile` so
         `normalizeFile` sees a real Blob and keeps it — a record that lost its
         bytes is dropped, which would silently lose the user's files. */
      const raw = { ...payload.data };
      raw.files = (payload.data.files || []).map(f => ({
        ...f,
        blob: new Blob([base64ToBytes(f.data)], { type: f.mime || 'application/octet-stream' }),
      }));

      const next = this._reconcile(raw);
      next.entitlement = this.data.entitlement;   // the plan is not in the file
      this.data = next;

      /* Preferences DO travel. Apply them the way the Settings controls do, so
         the theme actually changes rather than merely being stored. */
      const prefs = p.preferences || {};
      if (prefs.focusTarget != null) Settings.set('focusTarget', prefs.focusTarget);
      /* An empty array is a real answer ("hide every card"), so this tests for
         the key rather than for truthiness — `[]` is truthy, `undefined` is not. */
      if (prefs.dashboard) Settings.set('dashboard', prefs.dashboard);
      if (prefs.theme) Theme.apply(prefs.theme, { silent: true });
      this.data.settings = Settings.read();

      /* The log now belongs to the imported workspace, and the import is a thing
         that happened to it — so it is written into the NEW log, not the old. */
      const bits = [`${p.records} record${p.records === 1 ? '' : 's'}`];
      if (p.files) bits.push(`including ${p.files} file${p.files === 1 ? '' : 's'}`);
      this.activity.unshift({
        id: uid('a'), kind: 'other',
        text: `Imported a workspace — ${bits.join(', ')}`,
        createdAt: nowIso(),
      });

      await this.flush();
      this.emit('workspace:import');
      return { ok: true, error: null, before, after: Derive.workspaceSummary(), preview: p };
    },

    /* Put the demo back (M40). This is the seed, run again — `demoWorkspace()` →
       `Repo.seed()`, the same pair `init()` uses — so a reset workspace is the one
       a fresh install would have produced. That identity is the whole promise, and
       it is why the reset writes NO log entry: an entry describing the reset would
       make the restored workspace differ from a first run. The user is told by the
       confirmation they answered and by the toast afterwards.

       Four things survive, because none of them is the demo's to own:
         · **the profile** (`user`) — the demo carries no answers, and a reset is
           not a reason to ask for them again;
         · **the plan** (`entitlement`) — an entitlement is live state (invariant
           10), and a data operation must not revoke it, exactly as an import
           cannot grant it;
         · **the preferences** (`theme`, `focusTarget`) — they are the user's, and
           they live in localStorage, which a record reset does not touch; and
         · **their own alert decisions**, pruned for liveness below.

       A reset is destructive, so the UI confirms it first and offers an export. */
    async resetToDemo() {
      const before = Derive.workspaceSummary();
      const keepUser = this.data.user;
      const keepPlan = this.data.entitlement;

      /* Wipe rather than rely on `persistAll`'s orphan prune: a reset has to drop
         anything the demo does not define, at the storage layer as well as in
         memory, or the invariant above would only hold by inference. */
      await Repo.wipe();

      this.data = this.demoWorkspace();
      /* Applied BEFORE the write, so storage never briefly holds the demo's
         profile — a reload in that window would show the wrong name. */
      this.data.user = keepUser;
      this.data.entitlement = keepPlan;
      this.data.settings = Settings.read();

      await Repo.seed(this.data);
      await Repo.markSeeded();

      /* A stored decision must expire with its cause (invariant 16). The reset
         restores the demo's alerts, so a decision about an alert that is back is
         kept — it is the user's own judgement about a claim that is true again —
         while one about a record that no longer exists is dropped now rather than
         at the next boot. */
      this.pruneNotificationState();

      this.emit('workspace:reset');
      return { before, after: Derive.workspaceSummary() };
    },
  };

  /* --- DERIVATIONS — deterministic, never random ------------------------- */
  const Derive = {
    /* --- Pricing (Milestone 46) -----------------------------------------
       A price is data and lives in PLANS; everything below is what the pricing
       page READS out of it. Nothing here is stored, so a price change can never
       leave a stale "save 33%" or an out-of-date renewal date behind. */

    /* What the yearly row saves against twelve monthly payments. Returns 0 when
       there is nothing to compare, so a caller can render "—" rather than NaN. */
    planSaving() {
      const m = PLANS.monthly.price, y = PLANS.yearly.price;
      if (!m || !y || y >= m * 12) return 0;
      return 1 - (y / (m * 12));
    },
    /* The monthly-equivalent of a billed-yearly row: the honest way to show a
       yearly price next to a monthly one. Derived, so it cannot disagree with
       the price it was computed from. */
    planPerMonth(billing) {
      const p = PLANS[billing];
      if (!p || p.price <= 0) return 0;
      if (!p.days) return p.price;
      return (p.price / p.days) * 30.44;
    },
    /* When the current paid period ends. `periodStart + plan.days`, both of which
       are real fields — there is no stored renewal date to drift from them.
       Returns null for Free (there is no period) and for a licence with no
       recorded start (there is nothing to add to). */
    planRenews() {
      const e = State.entitlement;
      if (!e || e.status !== 'PRO' || !e.periodStart) return null;
      const plan = planMeta(e.billing);
      if (!plan.days) return null;
      const start = new Date(e.periodStart);
      if (isNaN(start.getTime())) return null;
      const end = new Date(start.getTime());
      end.setDate(end.getDate() + plan.days);
      return end;
    },
    /* Whole days left in the current period, floored at 0. Negative never escapes.
       `null` when there is no period, so the surface shows nothing rather than 0. */
    planDaysLeft() {
      const end = this.planRenews();
      if (!end) return null;
      const ms = end.getTime() - Date.now();
      return Math.max(0, Math.ceil(ms / 86400000));
    },
    /* The comparison table: the free column's includes, then every Pro row with
       its live lock state. Read off FEATURES and the gate, so the table can never
       disagree with what the app actually allows. */
    planCompare() {
      const paid = PLANS.yearly.price;
      return {
        free: FREE_INCLUDES,
        rows: PRO_FEATURE_MATRIX.map(r => ({
          ...r,
          /* A planned row is honest about not existing yet and is therefore
             shown on both columns as "Planned" rather than sold as included. */
          unlocked: r.planned ? false : FeatureAccess.allows(r.key),
        })),
        /* The yearly price expressed against the monthly one — the number that
           makes "two months free" checkable rather than a claim. */
        saving: this.planSaving(),
        perMonth: this.planPerMonth('yearly'),
        perMonthMonthly: PLANS.monthly.price,
        paid,
      };
    },
    /* The plan cards, in PLANS order, each carrying whether it is the one the
       licence is currently on. `currentKey` is derived once here so a card cannot
       decide for itself and disagree with its neighbour. */
    planCards() {
      const b = State.billing;
      return PLAN_ORDER.map(k => ({ ...PLANS[k], current: k === b }));
    },

    /* Task rollups */
    taskSummary() {
      /* Date-based, not token-based (M34). "Today" used to mean "the due field
         literally says Today", which was only ever true because the token was
         re-resolved every render. Archived work is excluded the way project and
         goal rollups already exclude it — a task you filed away is not part of
         what you still have to do. */
      const all = State.tasks.filter(t => !t.archived);
      const today = all.filter(t => t.due === todayKey());
      const done = all.filter(t => t.done).length;
      return {
        total: all.length,
        done,
        todayTotal: today.length,
        todayDone: today.filter(t => t.done).length,
        overdue: all.filter(t => this.isOverdue(t)).length,
        progress: all.length ? done / all.length : 0,
      };
    },
    todayFocusTasks(limit = 5) {
      // Incomplete first, high priority first, then due soonest.
      const rank = { High: 0, Medium: 1, Low: 2 };
      return [...State.tasks]
        .sort((a, b) => (a.done - b.done) || (rank[a.priority] - rank[b.priority]))
        .slice(0, limit);
    },
    /* --- Habits (Milestone 20) -------------------------------------------
       Everything about a habit is read out of its `history` log of day keys.
       Nothing is stored, so nothing can drift. */

    /* Current consecutive-day streak ending today or yesterday.
       A streak is still "alive" if yesterday was logged but today has not been
       checked off yet — otherwise simply opening the app in the morning would
       appear to break every streak. */
    habitStreak(h) {
      if (!h || !Array.isArray(h.history) || !h.history.length) return 0;
      const set = new Set(h.history);
      const today = todayKey();
      const yesterday = dayKey(shiftDays(new Date(), -1));
      let cursor;
      if (set.has(today)) cursor = new Date();
      else if (set.has(yesterday)) cursor = shiftDays(new Date(), -1);
      else return 0;
      let n = 0;
      while (set.has(dayKey(cursor))) { n++; cursor = shiftDays(cursor, -1); }
      return n;
    },

    /* Longest run of consecutive days ever logged. */
    habitBest(h) {
      if (!h || !Array.isArray(h.history) || !h.history.length) return 0;
      const keys = [...new Set(h.history)].filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
      let best = 1, run = 1;
      for (let i = 1; i < keys.length; i++) {
        const prev = new Date(keys[i - 1] + 'T00:00:00');
        const cur = new Date(keys[i] + 'T00:00:00');
        const gap = Math.round((cur - prev) / 86400000);
        run = gap === 1 ? run + 1 : 1;
        if (run > best) best = run;
      }
      return best;
    },

    /* How many of the last `days` days (including today) were logged. */
    habitRate(h, days) {
      if (!h || !Array.isArray(h.history)) return 0;
      const set = new Set(h.history);
      let n = 0;
      for (let i = 0; i < days; i++) if (set.has(dayKey(shiftDays(new Date(), -i)))) n++;
      return n;
    },

    /* A ready-to-render habit: the stored record plus every derived figure. */
    habitView(h) {
      const key = todayKey();
      const set = new Set(h.history || []);
      const streak = this.habitStreak(h);
      const best = this.habitBest(h);
      const rate7 = this.habitRate(h, 7);
      const rate30 = this.habitRate(h, 30);
      const total = (h.history || []).length;

      /* Last 14 days, oldest first, for the mini strip. */
      const strip = [];
      for (let i = 13; i >= 0; i--) {
        const k = dayKey(shiftDays(new Date(), -i));
        strip.push({ key: k, on: set.has(k), isToday: k === key });
      }

      return {
        ...h,
        doneToday: set.has(key),
        streak, best, rate7, rate30, total, strip,
        /* Honest health read — deterministic thresholds off the real log. */
        health: total === 0 ? 'Unstarted'
          : rate7 >= 6 ? 'Strong'
          : rate7 >= 4 ? 'Steady'
          : rate7 >= 2 ? 'Slipping'
          : 'At risk',
      };
    },

    habitSummary() {
      const habits = State.habits.map(x => this.habitView(x));
      const done = habits.filter(x => x.doneToday).length;
      const withStreak = habits.filter(x => x.streak > 0);
      return {
        total: habits.length,
        done,
        progress: habits.length ? done / habits.length : 0,
        bestStreak: habits.reduce((m, x) => Math.max(m, x.streak), 0),
        bestEver: habits.reduce((m, x) => Math.max(m, x.best), 0),
        habits,
        active: withStreak.length,
        /* 7-day completion across every habit — the honest weekly picture. */
        weekRate: habits.length
          ? Math.round(habits.reduce((a, x) => a + x.rate7, 0) / (habits.length * 7) * 100)
          : 0,
      };
    },
    /* Finance rollups — real arithmetic, never invented */
    /* --- Finance (Milestone 26) ------------------------------------------
       Every figure below is derived from the transaction log on every call.
       Nothing about the money is stored: not the month total, not the category
       breakdown, not the savings rate. The old demo shipped all three as stored
       numbers, which is precisely the drift this codebase forbids. */
    money(n) {
      const code = (State.finance || {}).currency;
      const cur = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
      /* Round to paise before formatting. Without this a division leaks its tail
         ("₹1,740.769") and a sum of two-decimal amounts leaks float noise
         ("₹13,130.000000000002") — both of which read as bugs to a user even when
         the arithmetic is right. */
      const v = Math.round((Number(n) || 0) * 100) / 100;
      return (v < 0 ? '-' : '') + cur.symbol + fmt(Math.abs(v));
    },
    transactionsSorted() {
      return (State.transactions || []).slice().sort((a, b) =>
        (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)
        || (a.createdAt < b.createdAt ? 1 : -1));
    },
    _sumType(rows, type) {
      return rows.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);
    },
    financeTotals(rows) {
      const income = this._sumType(rows, 'income');
      const expenses = this._sumType(rows, 'expense');
      return {
        income, expenses,
        net: income - expenses,
        savingsRate: income ? (income - expenses) / income : 0,
        /* The average SIZE of a transaction. The average per DAY is a different
           number and lives on financeMonth, where the elapsed days are known —
           labelling one as the other is how a figure starts lying. */
        perTransaction: rows.length ? expenses / rows.length : 0,
      };
    },
    _rowsForMonth(prefix) {
      return (State.transactions || []).filter(t => t.day.slice(0, 7) === prefix);
    },
    /* Transactions grouped by day, newest day first — the shape the month list
       reads. Biggest first inside a day, so the notable spending leads. */
    _groupByDay(rows) {
      const map = new Map();
      rows.forEach(t => {
        if (!map.has(t.day)) map.set(t.day, []);
        map.get(t.day).push(t);
      });
      return [...map.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([day, list]) => ({
          day,
          rows: list.slice().sort((a, b) => b.amount - a.amount),
          spend: this._sumType(list, 'expense'),
          earned: this._sumType(list, 'income'),
        }));
    },
    /* Expenses grouped by category, with a DERIVED percentage. The old demo
       stored `value` and `pct` on each category — numbers that could not be
       recomputed and went stale the moment a transaction changed. */
    financeByCategory(rows) {
      const expenses = rows.filter(t => t.type === 'expense');
      const total = expenses.reduce((a, t) => a + t.amount, 0);
      const acc = new Map();
      expenses.forEach(t => {
        const cur = acc.get(t.category) || { name: t.category, value: 0, count: 0 };
        cur.value += t.amount;
        cur.count++;
        acc.set(t.category, cur);
      });
      return [...acc.values()]
        .map(c => {
          const meta = FINANCE_CATEGORIES.find(x => x.name === c.name) || { color: 'var(--text-2)' };
          return { ...c, pct: total ? c.value / total : 0, color: meta.color };
        })
        .sort((a, b) => b.value - a.value);
    },
    financeMonth(year, month) {
      const prefix = year + '-' + String(month + 1).padStart(2, '0');
      const rows = this._rowsForMonth(prefix);
      const t = this.financeTotals(rows);
      const sorted = rows.slice().sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
      const daysIn = new Date(year, month + 1, 0).getDate();
      const now = new Date();
      /* A day that has not happened yet has not been spent on: the current month
         averages over the days elapsed so far, not over the whole month. */
      const isCurrent = now.getFullYear() === year && now.getMonth() === month;
      const elapsedDays = isCurrent ? Math.min(daysIn, now.getDate()) : daysIn;
      return {
        year, month, prefix,
        rows: sorted,
        daysIn,
        elapsedDays,
        count: rows.length,
        income: t.income, expenses: t.expenses, net: t.net,
        savingsRate: t.savingsRate,
        perTransaction: t.perTransaction,
        avgPerDay: elapsedDays ? t.expenses / elapsedDays : 0,
        byCategory: this.financeByCategory(rows),
        byDay: this._groupByDay(rows),
      };
    },
    /* Budget status for one month.
       A budget is a stored TARGET — an intention — while spent, remaining and the
       percentage are all derived from the log. Categories are ordered so the ones
       needing attention lead: over budget first, then closest to the line, then
       unbudgeted spending. */
    financeBudgets(year, month) {
      const m = this.financeMonth(year, month);
      const targets = (State.finance || {}).budgets || {};

      const all = FINANCE_CATEGORIES.filter(c => c.type === 'expense').map(c => {
        const hit = m.byCategory.find(x => x.name === c.name);
        const target = targets[c.name] || 0;
        const spent = hit ? hit.value : 0;
        return {
          name: c.name, color: c.color, icon: c.icon,
          target, spent,
          count: hit ? hit.count : 0,
          remaining: target - spent,
          pct: target ? spent / target : 0,
          over: target > 0 && spent > target,
        };
      });

      all.sort((a, b) => {
        if (a.over !== b.over) return a.over ? -1 : 1;
        if (!!a.target !== !!b.target) return a.target ? -1 : 1;
        if (a.target && b.target && a.pct !== b.pct) return b.pct - a.pct;
        return b.spent - a.spent || (a.name < b.name ? -1 : 1);
      });

      const withTarget = all.filter(r => r.target > 0);
      const totalTarget = withTarget.reduce((a, r) => a + r.target, 0);
      const totalSpent = withTarget.reduce((a, r) => a + r.spent, 0);
      const over = withTarget.filter(r => r.over);
      return {
        all,
        /* Only the categories that carry a target or real spending. */
        rows: all.filter(r => r.target > 0 || r.spent > 0),
        set: withTarget.length,
        unset: all.filter(r => !r.target && r.spent > 0).length,
        totalTarget,
        totalSpent,
        totalRemaining: totalTarget - totalSpent,
        pct: totalTarget ? totalSpent / totalTarget : 0,
        overCount: over.length,
        overBy: over.reduce((a, r) => a + (r.spent - r.target), 0),
        /* Spending with no target behind it — the honest "unbudgeted" figure. */
        unbudgeted: all.filter(r => !r.target).reduce((a, r) => a + r.spent, 0),
        monthSpend: m.expenses,
      };
    },

    /* Insights: plain statements read off the log.
       Every one is a deterministic function of the transactions — no estimates, no
       projections, no "you might". If there is nothing to say, it says nothing. */
    financeInsights(year, month) {
      const out = [];
      const m = this.financeMonth(year, month);
      const pd = new Date(year, month - 1, 1);
      const prev = this.financeMonth(pd.getFullYear(), pd.getMonth());
      const b = this.financeBudgets(year, month);

      if (!m.count) {
        return [{ tone: 'neutral', icon: 'wallet',
          text: `Nothing was recorded in ${MONTHS[month]}, so there is nothing to read yet.` }];
      }

      const top = m.byCategory[0];
      if (top) {
        out.push({ tone: 'neutral', icon: 'chart',
          text: `${top.name} is your largest expense this month — ${this.money(top.value)} across ${top.count} transaction${top.count === 1 ? '' : 's'}, ${Math.round(top.pct * 100)}% of everything you spent.` });
      }

      if (prev.expenses > 0) {
        const d = m.expenses - prev.expenses;
        const pct = Math.round(Math.abs(d) / prev.expenses * 100);
        out.push({
          tone: d > 0 ? 'warn' : 'good',
          icon: d > 0 ? 'arrowR' : 'check',
          text: d === 0
            ? `Spending is level with last month, at ${this.money(m.expenses)}.`
            : `Spending is ${d > 0 ? 'up' : 'down'} ${this.money(Math.abs(d))} — ${pct}% ${d > 0 ? 'more' : 'less'} than last month.`,
        });
      }

      if (m.income > 0 && prev.income > 0) {
        const now = Math.round(m.savingsRate * 100);
        const was = Math.round(prev.savingsRate * 100);
        out.push({
          tone: now >= was ? 'good' : 'warn', icon: 'target',
          text: `You kept ${now}% of this month's income — ${now === was ? 'the same as' : now > was ? 'up from' : 'down from'} ${was}% last month.`,
        });
      }

      /* The heaviest day of the week across the whole log — a stable pattern
         rather than one month's noise. */
      const dow = [0, 0, 0, 0, 0, 0, 0];
      (State.transactions || []).forEach(t => {
        if (t.type === 'expense') dow[new Date(t.day + 'T12:00:00').getDay()] += t.amount;
      });
      const dowTotal = dow.reduce((a, v) => a + v, 0);
      if (dowTotal > 0) {
        const max = dow.indexOf(Math.max(...dow));
        const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        out.push({ tone: 'neutral', icon: 'calendar',
          text: `${names[max]} is your heaviest spending day — ${this.money(dow[max])} of ${this.money(dowTotal)} across the whole log, ${Math.round(dow[max] / dowTotal * 100)}% of it.` });
      }

      if (m.expenses > 0) {
        out.push({ tone: 'neutral', icon: 'clock',
          text: `An average day this month has cost ${this.money(m.avgPerDay)}, over ${m.elapsedDays} day${m.elapsedDays === 1 ? '' : 's'}.` });
      }

      const biggest = m.rows.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount)[0];
      if (biggest) {
        out.push({ tone: 'neutral', icon: 'flag',
          text: `The largest single expense was “${biggest.label}” at ${this.money(biggest.amount)}.` });
      }

      if (!b.set) {
        out.push({ tone: 'neutral', icon: 'target',
          text: 'No budgets set yet. A monthly target per category turns these totals into something you can act on.' });
      } else if (b.overCount) {
        out.push({ tone: 'bad', icon: 'bolt',
          text: `${b.overCount} budget${b.overCount === 1 ? '' : 's'} exceeded this month, by ${this.money(b.overBy)} in total.` });
      } else {
        out.push({ tone: 'good', icon: 'check',
          text: `All ${b.set} budgeted categor${b.set === 1 ? 'y' : 'ies'} are inside their target, with ${this.money(b.totalRemaining)} of ${this.money(b.totalTarget)} left.` });
      }

      if (b.unbudgeted > 0) {
        out.push({ tone: 'warn', icon: 'filter',
          text: `${this.money(b.unbudgeted)} of this month's spending has no budget against it.` });
      }

      return out;
    },
    /* Last N months, oldest first — the shape the trend chart reads. */
    financeTrend(months = 6) {
      const now = new Date();
      const out = [];
      for (let back = months - 1; back >= 0; back--) {
        const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
        const prefix = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        const t = this.financeTotals(this._rowsForMonth(prefix));
        out.push({
          year: d.getFullYear(), month: d.getMonth(),
          key: prefix, label: MONTHS[d.getMonth()].slice(0, 3),
          income: t.income, expenses: t.expenses, net: t.net, savingsRate: t.savingsRate,
          current: back === 0,
        });
      }
      return out;
    },
    /* Dense daily rows ending today — spend, earnings and net per day. */
    financeRange(days = 30) {
      const byDay = new Map();
      (State.transactions || []).forEach(t => {
        const cur = byDay.get(t.day) || { spend: 0, earned: 0, count: 0 };
        if (t.type === 'expense') cur.spend += t.amount;
        else cur.earned += t.amount;
        cur.count++;
        byDay.set(t.day, cur);
      });
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const key = dayKey(shiftDays(new Date(), -i));
        const cur = byDay.get(key) || { spend: 0, earned: 0, count: 0 };
        out.push({
          day: key, spend: cur.spend, earned: cur.earned,
          net: cur.earned - cur.spend, count: cur.count,
        });
      }
      return out;
    },
    /* This month's position — the shape the dashboard snapshot reads. */
    financeSummary() {
      const now = new Date();
      const m = this.financeMonth(now.getFullYear(), now.getMonth());
      return {
        income: m.income,
        expenses: m.expenses,
        savings: m.net,
        savingsRate: m.savingsRate,
        count: m.count,
        monthLabel: MONTHS[now.getMonth()],
      };
    },
    financeSearch(q) {
      const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      const out = [];
      this.transactionsSorted().forEach(t => {
        const label = (t.label || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        let score = 0;
        terms.forEach(x => {
          if (label.includes(x)) score += 100;
          if (label.startsWith(x)) score += 40;
          if (cat.includes(x)) score += 50;
          if (note.includes(x)) score += 20;
          if (t.day.includes(x)) score += 60;
          if (t.type === x) score += 30;
          if (String(t.amount) === x) score += 80;
        });
        if (score > 0) out.push({ tx: t, score });
      });
      return out.sort((a, b) => b.score - a.score || (a.tx.day < b.tx.day ? 1 : -1));
    },
    /* The only shape the Finance UI reads. */
    financeList() {
      const now = new Date();
      const all = this.transactionsSorted();
      const totals = this.financeTotals(all);
      return {
        all,
        month: this.financeMonth(now.getFullYear(), now.getMonth()),
        trend: this.financeTrend(6),
        range: this.financeRange(30),
        categories: this.financeByCategory(all),
        summary: {
          total: all.length,
          income: totals.income,
          expenses: totals.expenses,
          net: totals.net,
          savingsRate: totals.savingsRate,
          months: new Set(all.map(t => t.day.slice(0, 7))).size,
          firstDay: all.length ? all[all.length - 1].day : null,
          currency: (State.finance || {}).currency || 'INR',
        },
        empty: all.length === 0,
      };
    },
    /* --- Projects (Milestone 17) ----------------------------------------
       Project progress is NEVER stored as a number on the project record.
       It is derived from the tasks that carry this project's name, so
       completing a task moves its project forward immediately. A stored
       `progress` field would be a fake number that silently drifts. */
    projectStats(name) {
      const all = State.tasks.filter(t => t.project === name);
      const live = all.filter(t => !t.archived);
      const done = live.filter(t => t.done).length;
      const open = live.length - done;
      const overdue = live.filter(t => this.isOverdue(t)).length;
      const high = live.filter(t => !t.done && t.priority === 'High').length;

      /* Progress is the completion ratio. With no tasks yet there is nothing
         to measure, so report 0 rather than inventing a starting value. */
      const progress = live.length ? Math.round(done / live.length * 100) : 0;

      /* Projected estimate remaining — only sums real estimates that exist. */
      const openMinutes = live.filter(t => !t.done)
        .reduce((a, t) => a + (t.estimate || 0), 0);

      return {
        name, total: live.length, done, open, overdue, high, progress, openMinutes,
        linked: all.length,
        /* Health is a judgement from real signals, not a stored label. */
        health: overdue > 0 ? 'At risk' : (progress >= 80 ? 'On track' : progress >= 40 ? 'On track' : 'Getting started'),
      };
    },

    /* Every project that actually exists in the workspace: the ones declared
       in State.projects, plus any project name that only appears on a task
       (and vice versa). This keeps the Projects page honest — nothing shows
       up twice and nothing real is hidden. */
    allProjects() {
      const declared = State.projects.map(p => p.name);
      const used = State.tasks.map(t => t.project).filter(Boolean);
      const names = [...new Set([...declared, ...used])];

      return names.map(name => {
        const meta = State.projects.find(p => p.name === name) || {};
        const stats = this.projectStats(name);
        return {
          id: meta.id || ('pj_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_')),
          name,
          deadline: meta.deadline || null,
          color: meta.color || this._autoColor(name),
          status: stats.open === 0 && stats.total > 0 ? 'Complete'
                : (meta.status || 'Active'),
          declared: !!meta.id,
          ...stats,
        };
      }).sort((a, b) => {
        // Active work first, then most-incomplete, then alphabetical.
        const rank = p => p.status === 'Active' ? 0 : p.status === 'Complete' ? 2 : 1;
        return (rank(a) - rank(b)) || (b.open - a.open) || a.name.localeCompare(b.name);
      });
    },

    /* Stable accent per project so colours never shuffle between renders.
       Only names that exist as --tokens in :root are used. */
    _autoColor(name) {
      const palette = ['violet', 'cyan', 'magenta', 'indigo', 'blue'];
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
      return palette[h % palette.length];
    },

    projectList() {
      const list = this.allProjects();
      const active = list.filter(p => p.status === 'Active');
      const openTasks = list.reduce((a, p) => a + p.open, 0);
      const doneTasks = list.reduce((a, p) => a + p.done, 0);
      const atRisk = list.filter(p => p.overdue > 0).length;
      /* Average progress across projects that actually have tasks. */
      const measured = list.filter(p => p.total > 0);
      const avg = measured.length
        ? Math.round(measured.reduce((a, p) => a + p.progress, 0) / measured.length)
        : 0;
      return { list, active: active.length, openTasks, doneTasks, atRisk, avg };
    },

    /* Goal rollup — every number derived from the tasks linked to each goal.
       A goal is linked to work through task.goalId, set from the Task detail
       panel. Nothing about a goal's progress is ever stored. */
    goalStats(goalId) {
      const all = State.tasks.filter(t => t.goalId === goalId);
      const live = all.filter(t => !t.archived);
      const done = live.filter(t => t.done).length;
      const open = live.length - done;
      const overdue = live.filter(t => this.isOverdue(t)).length;
      const high = live.filter(t => !t.done && t.priority === 'High').length;
      const progress = live.length ? Math.round(done / live.length * 100) : 0;
      const openMinutes = live.filter(t => !t.done).reduce((a, t) => a + (t.estimate || 0), 0);

      /* Deterministic health read — same thresholds as projects, but a goal with
         no linked work is honestly reported as unstarted rather than "on track". */
      let health;
      if (!live.length) health = 'No linked work';
      else if (overdue > 0) health = 'At risk';
      else if (progress >= 80) health = 'On track';
      else if (progress >= 40) health = 'In progress';
      else health = 'Getting started';

      /* Projects contributing to this goal (by name), for the detail panel. */
      const projects = [...new Set(live.map(t => t.project).filter(Boolean))];

      return { id: goalId, total: live.length, done, open, overdue, high, progress,
        openMinutes, health, projects, linked: all.length };
    },

    allGoals() {
      const declared = State.goals;
      const usedIds = new Set(State.tasks.map(t => t.goalId).filter(Boolean));

      /* Goals that exist as records, merged with their derived stats. */
      const list = declared.map(g => {
        const stats = this.goalStats(g.id);
        return { ...g, ...stats, declared: true,
          status: stats.total > 0 && stats.open === 0 ? 'Complete' : 'Active' };
      });

      /* Orphan links: a task points at a goal id that has no record (imported or
         deleted). Surface it instead of silently dropping the link. */
      usedIds.forEach(id => {
        if (!declared.some(g => g.id === id)) {
          const stats = this.goalStats(id);
          list.push({ id, name: 'Untitled goal', horizon: 'Quarter', area: 'Personal',
            color: this._autoColor(id), declared: false,
            status: stats.open === 0 ? 'Complete' : 'Active', ...stats });
        }
      });

      const rank = g => g.status === 'Active' ? 0 : 1;
      return list.sort((a, b) => (rank(a) - rank(b)) || (b.progress - a.progress) || a.name.localeCompare(b.name));
    },

    /* Page-level rollup for the Goals summary strip. */
    goalList() {
      const list = this.allGoals();
      const active = list.filter(g => g.status === 'Active');
      const measured = list.filter(g => g.total > 0);
      const avg = measured.length
        ? Math.round(measured.reduce((a, g) => a + g.progress, 0) / measured.length)
        : 0;
      return {
        list, active: active.length,
        openTasks: list.reduce((a, g) => a + g.open, 0),
        doneTasks: list.reduce((a, g) => a + g.done, 0),
        atRisk: list.filter(g => g.overdue > 0).length,
        unlinked: list.filter(g => g.total === 0).length,
        avg,
      };
    },

    /* Kept for the dashboard/score read-paths — now derived, never stored. */
    goalSummary() {
      const list = this.allGoals();
      if (!list.length) return { count: 0, avg: 0, best: null, atRisk: 0 };
      const measured = list.filter(g => g.total > 0);
      return {
        count: list.length,
        avg: measured.length
          ? Math.round(measured.reduce((a, g) => a + g.progress, 0) / measured.length)
          : 0,
        best: measured.length ? measured.reduce((a, g) => (g.progress > a.progress ? g : a)) : null,
        atRisk: list.filter(g => g.overdue > 0).length,
      };
    },

    /* --- Calendar derivation (Milestone 19, re-cut in 34) -------------------
       Maps the whole workspace onto ISO day keys so the grid is a pure read of
       real data:
         • `events`  — every State.upcoming record, by its real date
         • `tasks`   — open tasks by their real stored due key

       A task's due date used to be a relative token ("Today", "Tomorrow") that
       was re-resolved against the clock on every render. That made the intention
       drift — a task marked "Today" was due today forever — and made "overdue"
       impossible to express, so it was faked with a string match. A due date is
       now a real day key resolved once at hydrate; this parser survives as the
       BOUNDARY, the single rule for what a typed token means on the way in. */
    _dueKey(token) { return parseDueToken(token); },

    /* Is this task past its own due date? ONE definition, so project health, goal
       health, the Tasks views and the NEXUS Score can never disagree about it. */
    isOverdue(t) {
      if (!t || t.done || t.archived) return false;
      return !!t.due && t.due < todayKey();
    },
    isDueToday(t) {
      return !!t && !t.done && !t.archived && t.due === todayKey();
    },
    overdueTasks() { return State.tasks.filter(t => this.isOverdue(t)); },

    /* Whole days a task is late. `isOverdue` answers WHETHER; this answers HOW
       MUCH — and how much is the actionable half. An alert reading "3 days late"
       tells you something; one reading "11 Sep" makes you do the arithmetic. */
    overdueDays(t) {
      if (!this.isOverdue(t)) return 0;
      const due = new Date(String(t.due) + 'T12:00:00').getTime();
      const now = new Date(todayKey() + 'T12:00:00').getTime();
      return Math.max(1, Math.round((now - due) / 86400000));
    },

    /* The label a stored due key shows as. It is a function of `now`, so it is
       derived at render time and never stored — the M30 rule. */
    dueLabel(due) {
      if (!due) return 'No date';
      const today = todayKey();
      if (due === today) return 'Today';
      if (due === dayKey(shiftDays(new Date(), 1))) return 'Tomorrow';
      if (due === dayKey(shiftDays(new Date(), -1))) return 'Yesterday';
      const y = new Date(due + 'T12:00:00').getFullYear();
      return y === new Date().getFullYear() ? this.shortDay(due) : `${this.shortDay(due)} ${y}`;
    },

    /* Everything that belongs on a given day, for the month grid and day panel. */
    dayItems(key) {
      const events = State.upcoming
        .filter(u => u.date === key)
        .map(u => ({ type: 'event', id: u.id, title: u.title, time: u.time,
                     color: u.color, kind: u.kind, done: false, raw: u }));

      const tasks = State.tasks
        .filter(t => !t.archived && !t.done && t.due === key)
        .map(t => ({ type: 'task', id: t.id, title: t.title, time: t.estimate ? t.estimate + ' min' : '',
                     color: t.priority === 'High' ? 'var(--bad)'
                          : t.priority === 'Medium' ? 'var(--warn)' : 'var(--cyan)',
                     kind: 'task', done: false, raw: t, priority: t.priority }));

      return { events, tasks, all: [...events, ...tasks] };
    },

    /* Month matrix: 6 weeks × 7 days starting on Monday, always covering the
       whole month so the grid height never jumps between months. */
    monthMatrix(year, month) {
      const first = new Date(year, month, 1);
      // getDay(): 0=Sun. Shift so Monday is column 0.
      const lead = (first.getDay() + 6) % 7;
      const start = shiftDays(first, -lead);
      const weeks = [];
      for (let w = 0; w < 6; w++) {
        const row = [];
        for (let d = 0; d < 7; d++) {
          const date = shiftDays(start, w * 7 + d);
          const key = dayKey(date);
          const items = this.dayItems(key);
          row.push({
            key, date,
            day: date.getDate(),
            inMonth: date.getMonth() === month,
            isToday: key === todayKey(),
            isWeekend: [0, 6].includes(date.getDay()),
            events: items.events, tasks: items.tasks, all: items.all,
            count: items.all.length,
          });
        }
        weeks.push(row);
      }
      return weeks;
    },

    /* Rollup for the calendar header strip. */
    calendarSummary(year, month) {
      const weeks = this.monthMatrix(year, month);
      const days = weeks.flat().filter(d => d.inMonth);
      const eventCount = days.reduce((a, d) => a + d.events.length, 0);
      const taskCount = days.reduce((a, d) => a + d.tasks.length, 0);
      const busy = days.filter(d => d.count > 0).length;
      // Busiest upcoming day, for the "next up" hint.
      const future = weeks.flat().filter(d => d.key >= todayKey() && d.count > 0);
      return {
        weeks, days, eventCount, taskCount, busy,
        todayCount: (this.dayItems(todayKey()).all.length),
        next: future.sort((a, b) => a.key.localeCompare(b.key))[0] || null,
      };
    },
    /* NEXUS Score — deterministic 0–100 from real workspace signals.
       Inputs: task completion, focus, habits, goals, and overdue burden.
       Each component is weighted, and we subtract an overdue penalty so the
       score always reflects actual behaviour (never a random number). */
    /* --- NEXUS Score (M11, rebuilt in M34) --------------------------------
       The score is a FUNCTION OF A DAY. Every term is folded from records that
       carry their own dates, so the same function that scores today can score
       any day the workspace has records for. That is what makes a real history
       possible instead of a stored array nothing ever appended to.

       Two rules keep it honest:

       1. Each term measures what its label CLAIMS. "Tasks" used to mean the
          lifetime done/total ratio, which can never recover from an old backlog
          and punishes a workspace that is being run well right now. "Habits" was
          today's check-ins, which reads as failure at noon on a good day.
       2. A term with nothing to measure is EXCLUDED, not counted as zero, and
          the remaining weights are renormalised — the rule the journal already
          applies to an unrated day. Counting silence as failure is the same
          mistake as counting it as a middle-of-the-road 3.

         • Tasks   — of the work that came due in the 7 days ending on `day`, the
                     share that got done. Nothing came due? Not measured.
         • Habits  — the 7-day completion rate ending on `day`.
         • Focus   — that day's focus minutes against the daily target.
         • Goals   — average goal progress as of `day`.
         • Overdue — work past its due date and still open: a real count, and a
                     penalty that moves with the calendar. */
    scoreAt(day) {
      const key = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : todayKey();
      const anchor = new Date(key + 'T12:00:00');
      const winStart = dayKey(shiftDays(anchor, -6));

      /* "By then" is decided by real timestamps. Something existed by `day` if it
         was created by then OR completed by then — you cannot finish a task that
         does not exist yet, so a completion is itself proof of existence. A
         record with NO creation date (habits carry none) is treated as
         pre-existing, because nothing proves it was new. */
      const isoDay = v => (v ? dayKey(new Date(v)) : null);
      const createdBy = r => { const k = isoDay(r.createdAt); return k === null || k <= key; };
      const doneBy = t => { const k = isoDay(t.completedAt); return k !== null && k <= key; };
      const live = State.tasks.filter(t => !t.archived);

      /* Tasks — did the work on your plate get cleared? The load is what came
         due in the window OR what you actually completed in it, so getting
         ahead of a deadline counts as doing the work rather than counting for
         nothing. */
      const inWindow = t =>
        (!!t.due && t.due >= winStart && t.due <= key) ||
        (!!t.completedAt && isoDay(t.completedAt) >= winStart && isoDay(t.completedAt) <= key);
      const load = live.filter(inWindow);
      const taskScore = load.length
        ? (load.filter(doneBy).length / load.length) * 100
        : null;

      /* Habits — the trailing week, not a single unfinished day. */
      const habits = State.habits.filter(h => createdBy(h));
      const habitScore = habits.length
        ? (habits.reduce((a, h) => {
            const set = new Set(h.history || []);
            let n = 0;
            for (let i = 0; i < 7; i++) if (set.has(dayKey(shiftDays(anchor, -i)))) n++;
            return a + n / 7;
          }, 0) / habits.length) * 100
        : null;

      /* Goals — average progress as of that day, over the goals that had work. */
      const goalScores = this.allGoals().map(g => {
        const known = live.filter(t => t.goalId === g.id && (createdBy(t) || doneBy(t)));
        return known.length ? (known.filter(doneBy).length / known.length) * 100 : null;
      }).filter(v => v !== null);
      const goalScore = goalScores.length
        ? goalScores.reduce((a, b) => a + b, 0) / goalScores.length
        : null;

      /* Focus — that day's minutes against the target. */
      const focusScore = clamp((this.focusDay(key) / this.focusTarget()) * 100, 0, 100);

      /* Overdue burden — a real comparison against the calendar, at last, and
         measured AS OF `day`: a task is late on that day if it was due before it
         and had not been completed by it. Using the current `done` flag here
         would let finishing something today rewrite yesterday's score, which
         would make the history a moving target instead of a record. */
      const overdue = live.filter(t => t.due && t.due < key && !doneBy(t)).length;
      const overduePenalty = clamp(overdue * 3, 0, 15);

      const terms = [
        { label: 'Tasks',  value: taskScore,  weight: 0.35 },
        { label: 'Focus',  value: focusScore, weight: 0.15 },
        { label: 'Habits', value: habitScore, weight: 0.25 },
        { label: 'Goals',  value: goalScore,  weight: 0.25 },
      ];
      const measured = terms.filter(t => t.value !== null);
      const wsum = measured.reduce((a, t) => a + t.weight, 0);
      const raw = wsum ? measured.reduce((a, t) => a + t.value * t.weight, 0) / wsum : 0;

      return {
        day: key,
        score: Math.round(clamp(raw - overduePenalty, 0, 100)),
        parts: [
          ...terms.map(t => ({ label: t.label, value: t.value === null ? null : Math.round(t.value),
                               weight: t.weight })),
          { label: 'Overdue', value: overdue, penalty: overduePenalty },
        ],
        unmeasured: terms.filter(t => t.value === null).map(t => t.label),
        focusMinutesMonth: this.focusMonth(),
      };
    },

    /* The last n days, oldest first — the SAME function evaluated once per day,
       so the sparkline and the delta badge are drawn from one source and cannot
       disagree. Days before the workspace had any record are not scored: a day
       the workspace did not exist cannot be a failure. */
    scoreHistory(n = 14) {
      const first = this.timeWindow().first;
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const key = dayKey(shiftDays(new Date(), -i));
        if (first && key < first) continue;
        out.push({ day: key, score: this.scoreAt(key).score });
      }
      return out;
    },

    nexusScore() {
      const today = this.scoreAt(todayKey());
      const history = this.scoreHistory(14);
      /* Yesterday is the last point that is not today. Comparing today against
         yesterday's real score is the honest reading of "how am I doing". */
      const prev = history.length > 1 ? history[history.length - 2].score : null;
      return { ...today, delta: prev === null ? 0 : today.score - prev, history };
    },
    focusHoursMonth() {
      return Math.round(this.focusMonth() / 60);
    },

    /* --- Automation (Milestone 35) ---------------------------------------
       A rule states an intention; the engine folds it against the calendar.
       Nothing here reads a stored result, because nothing stores one: "what has
       this rule produced" is the INVERSE of the `origin` stamp on the records
       themselves, exactly as `filesFor()` is the inverse of a file's pointers. */
    /* `{date}` in a rule's title/text becomes the occurrence's own day, so a
       recurring record is never an unidentifiable twin of last week's. */
    automationTemplate(str, day) {
      return String(str == null ? '' : str).replace(/\{date\}/g, this.shortDay(day));
    },
    /* Does the schedule include this day? */
    automationMatches(rule, day) {
      const d = new Date(day + 'T12:00:00');
      switch (rule.trigger.every) {
        case 'weekday': { const w = d.getDay(); return w >= 1 && w <= 5; }
        case 'week':    return ((d.getDay() + 6) % 7) + 1 === rule.trigger.dow;
        case 'month':   return d.getDate() === rule.trigger.dom;
        case 'day':
        default:        return true;
      }
    },
    /* Every day the schedule covers between the rule's start and today, oldest
       first. The start is the day after the last occurrence it made — or, for a
       rule that has never run, the day it was created, so a brand-new rule never
       backfills a history it did not exist for. */
    automationDays(rule) {
      const today = todayKey();
      const start = rule.lastRun
        ? dayKey(shiftDays(new Date(rule.lastRun + 'T12:00:00'), 1))
        : dayKey(new Date(rule.createdAt));
      if (start > today) return [];
      const out = [];
      const end = new Date(today + 'T12:00:00');
      let d = new Date(start + 'T12:00:00');
      /* Bounded — a rule can never look back further than a year. */
      for (let i = 0; i < 400 && d <= end; i++) {
        const k = dayKey(d);
        if (this.automationMatches(rule, k)) out.push(k);
        d = shiftDays(d, 1);
      }
      return out;
    },
    /* The occurrences still waiting to be made. Today's only counts once its
       time has come; `force` is what "Run now" means — bring this rule up to
       date right now, without waiting for the clock. */
    automationPending(rule, opts) {
      if (!rule || !rule.enabled) return [];
      const force = !!(opts && opts.force);
      const today = todayKey();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const parts = String(rule.trigger.at).split(':');
      const atMin = Number(parts[0]) * 60 + Number(parts[1]);
      return this.automationDays(rule).filter(day =>
        day !== today || force || nowMin >= atMin);
    },
    /* The records a rule produced, newest first — the inverse of `origin`. */
    automationOutput(rule) {
      const id = rule && rule.id;
      if (!id) return [];
      const hit = r => !!(r.origin && r.origin.rule === id);
      const rows = [
        ...(State.tasks || []).filter(hit).map(r =>
          ({ type: 'task', id: r.id, title: r.title, day: r.origin.day, done: !!r.done })),
        ...(State.notes || []).filter(hit).map(r =>
          ({ type: 'note', id: r.id, title: r.title, day: r.origin.day })),
        ...(State.inbox || []).filter(hit).map(r =>
          ({ type: 'inbox', id: r.id, title: r.text, day: r.origin.day, status: r.status })),
      ];
      return rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    },
    /* The next day this rule will fire, or null when it is switched off. */
    automationNext(rule) {
      if (!rule || !rule.enabled) return null;
      const today = todayKey();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const parts = String(rule.trigger.at).split(':');
      const atMin = Number(parts[0]) * 60 + Number(parts[1]);
      if (this.automationMatches(rule, today) && nowMin < atMin) return today;
      let d = new Date(today + 'T12:00:00');
      for (let i = 1; i <= 400; i++) {
        d = shiftDays(d, 1);
        const k = dayKey(d);
        if (this.automationMatches(rule, k)) return k;
      }
      return null;
    },
    /* The schedule in words — "Every weekday at 07:30". */
    automationSchedule(rule) {
      const t = rule.trigger;
      if (t.every === 'day') return `Every day at ${t.at}`;
      if (t.every === 'weekday') return `Every weekday at ${t.at}`;
      if (t.every === 'week') return `Every ${DOW_FULL[t.dow - 1]} at ${t.at}`;
      return `The ${ordinal(t.dom)} of every month at ${t.at}`;
    },
    /* The action in words — "Add a task to Personal". */
    automationAct(rule) {
      const a = rule.action;
      if (a.type === 'task') return `Add a task to ${a.project}`;
      if (a.type === 'capture') return 'Capture it to the Inbox';
      return 'Add a note';
    },
    /* The whole page in one fold: every rule with what it is waiting to do and
       what it has already produced. */
    automationSummary() {
      const rows = (State.automations || []).map(rule => ({
        rule,
        pending: this.automationPending(rule),
        produced: this.automationOutput(rule),
        next: this.automationNext(rule),
      }));
      return {
        rows,
        total: rows.length,
        enabled: rows.filter(x => x.rule.enabled).length,
        waiting: rows.reduce((n, x) => n + x.pending.length, 0),
        produced: rows.reduce((n, x) => n + x.produced.length, 0),
        /* The most recent day any rule ran, or null when none ever has. */
        lastRun: rows.reduce((m, x) =>
          (x.rule.lastRun && (!m || x.rule.lastRun > m) ? x.rule.lastRun : m), null),
      };
    },

    /* --- Templates (Milestone 37) ----------------------------------------
       A template is a SHAPE WITH HOLES. `{date}` is the day it is applied and
       `{name}` is whatever the user types when they apply it; neither is stored,
       which is what lets one "New project kickoff" serve any project on any day.
       `templateItem()` is the single resolution point — `applyTemplate` builds
       its records with it and the page builds its preview with it, so what you
       are shown and what you get cannot drift apart. */

    /* The holes a template still needs filled, in the order they appear. A
       template with none can be applied in a single click. */
    templateHoles(t) {
      const holes = [];
      const scan = s => {
        const m = String(s == null ? '' : s).match(/\{([a-z]+)\}/gi) || [];
        m.forEach(tok => {
          const k = tok.slice(1, -1).toLowerCase();
          if (k !== 'date' && holes.indexOf(k) === -1) holes.push(k);
        });
      };
      ((t && t.items) || []).forEach(it => {
        scan(it.title); scan(it.text); scan(it.body); scan(it.project);
      });
      return holes;
    },

    /* Fill one string for one day and one set of answers. `{date}` is the day the
       template is APPLIED, never the day it was written — the same token the
       automation engine resolves, through the same function, so the two features
       cannot disagree about what a `{date}` means. An unanswered hole is left
       visible as itself rather than blanked, so a preview shows you the hole. */
    templateFill(str, day, vars) {
      const v = vars || {};
      const named = String(str == null ? '' : str).replace(/\{name\}/gi,
        () => (v.name == null ? '{name}' : String(v.name)));
      return this.automationTemplate(named, day || todayKey());
    },

    /* One item, resolved for a day. A task's `dueIn` offset becomes a real day
       HERE and nowhere else: the template never holds a date, so the same
       template applied in January and in September produces January and
       September work. */
    templateItem(item, day, vars) {
      const d = day || todayKey();
      const fill = s => this.templateFill(s, d, vars);
      if (item.type === 'task') {
        return {
          type: 'task', title: fill(item.title),
          project: fill(item.project) || 'Personal',
          priority: item.priority,
          due: dayKey(shiftDays(new Date(d + 'T12:00:00'), item.dueIn || 0)),
        };
      }
      if (item.type === 'capture') return { type: 'capture', text: fill(item.text) };
      return { type: 'note', title: fill(item.title), body: fill(item.body) };
    },

    /* What applying this template WOULD make — the whole bundle, resolved, and
       nothing created. With no answers the holes stay visible. */
    templatePreview(t, day, vars) {
      return ((t && t.items) || []).map(it => this.templateItem(it, day, vars));
    },

    /* "4 tasks · 1 note" — the bundle in words. */
    templateItemSummary(t) {
      const counts = {};
      ((t && t.items) || []).forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });
      const parts = AUTOMATION_ACTIONS
        .filter(a => counts[a.key])
        .map(a => `${counts[a.key]} ${TEMPLATE_NOUNS[a.key]}${counts[a.key] === 1 ? '' : 's'}`);
      return parts.length ? parts.join(' · ') : 'nothing';
    },

    /* The ONLY shape the Templates UI reads. `preview` is resolved for today with
       no answers, which is exactly what the card should show: the shape, with its
       holes still open. */
    templatesList() {
      const rows = (State.templates || []).map(t => ({
        template: t,
        holes: this.templateHoles(t),
        preview: this.templatePreview(t),
        summary: this.templateItemSummary(t),
        count: (t.items || []).length,
      }));
      const tally = key => rows.reduce((n, x) =>
        n + (x.template.items || []).filter(i => i.type === key).length, 0);
      return {
        rows,
        total: rows.length,
        items: rows.reduce((n, x) => n + x.count, 0),
        tasks: tally('task'),
        /* How many templates still need an answer before they can be applied. */
        asking: rows.filter(x => x.holes.length).length,
        kinds: AUTOMATION_ACTIONS
          .map(a => ({ key: a.key, label: a.label, icon: a.icon, count: tally(a.key) }))
          .filter(k => k.count > 0),
        empty: rows.length === 0,
      };
    },

    /* ---- Onboarding (M38) ------------------------------------------------
       The step list is derived from the thing that actually has content (the name
       and the starting points) rather than being a second hardcoded array that
       could drift out of step with what the flow renders. */
    onboardingSteps() {
      return [
        { key: 'welcome', title: 'Welcome to NEXUS',
          lede: 'A personal operating system that lives entirely on this machine.' },
        { key: 'name',    title: 'What should we call you?',
          lede: 'It goes on the dashboard greeting. Nothing else leaves this device.' },
        { key: 'start',   title: 'Where do you want to start?',
          lede: 'Pick as many as you like. NEXUS will take you to one of them when you finish.' },
      ];
    },
    /* The ONE shape the first-run flow reads. `draft` is what makes it safe to
       reuse while the user is still answering: the flow holds the answers in
       memory and writes nothing until it finishes, so it renders the draft while
       the dashboard reads the stored values. One shape, two callers, and they
       cannot disagree about what a step looks like. */
    onboardingView(step, draft) {
      const u = State.user || {};
      const steps = this.onboardingSteps();
      const i = Math.max(0, Math.min(steps.length - 1, Number(step) || 0));
      const name = draft && draft.name != null ? draft.name : (u.name || '');
      const chosen = draft && Array.isArray(draft.focus) ? draft.focus.slice()
                   : (Array.isArray(u.focus) ? u.focus.slice() : []);
      const starts = START_HERE.map(s => ({
        key: s.key, label: s.label, blurb: s.blurb, icon: s.icon, route: s.route,
        on: chosen.indexOf(s.key) !== -1,
      }));
      const picked = starts.filter(s => s.on);
      return {
        steps,
        step: i,
        current: steps[i],
        first: i === 0,
        last: i === steps.length - 1,
        name,
        nameMax: USER_NAME_MAX,
        focus: chosen,
        starts,
        chosenCount: picked.length,
        /* Where the finish button goes: the first thing they picked, so the flow
           ends by taking them somewhere rather than saying "all set". */
        destination: picked.length ? picked[0] : null,
      };
    },
    /* The starting points the user picked, as real destinations. Filtered against
       the live table so a retired key can never produce a dead link. */
    focusRoutes() {
      const u = State.user || {};
      return (Array.isArray(u.focus) ? u.focus : [])
        .map(k => startHere(k))
        .filter(Boolean)
        .map(s => ({ key: s.key, label: s.label, blurb: s.blurb, icon: s.icon, route: s.route }));
    },
    /* Has this workspace never been set up? `null` means never — which is the
       whole reason `onboardedAt` is stored rather than inferred. */
    needsOnboarding() {
      const u = State.user || {};
      return !u.onboardedAt;
    },

    /* The ONLY shape the dashboard reads for its own composition. `wideRows` is
       the wide column grouped into rows — consecutive `half` cards share one, a
       `full` card takes one alone — and it is computed HERE, once, so the
       dashboard and the customise panel cannot lay the same arrangement out two
       different ways. `hidden` is what the panel offers to add; `customised` is
       what decides whether a way back to the default is offered. */
    dashboardCards() {
      const stored = pickDashBoard(Settings.read().dashboard);
      const layout = stored === null ? dashLayout() : stored;
      const keys = layout.wide.concat(layout.side);
      const rows = col => layout[col].map(k => dashCard(k)).filter(Boolean);
      const wideRows = [];
      layout.wide.forEach(k => {
        const c = dashCard(k);
        if (!c) return;
        const last = wideRows[wideRows.length - 1];
        if (c.span === 'half' && last && last.length === 1 && last[0].span === 'half') last.push(c);
        else wideRows.push([c]);
      });
      return {
        layout,
        wide: rows('wide'),
        side: rows('side'),
        wideRows,
        keys,
        all: DASH_CARDS,
        colLabels: DASH_COL_LABELS,
        hidden: DASH_CARDS.filter(c => keys.indexOf(c.key) === -1),
        total: DASH_CARDS.length,
        shown: keys.length,
        customised: stored !== null,
        empty: keys.length === 0,
      };
    },
    settingsView() {
      const u = State.user || {};
      const pro = State.isPro;
      return {
        name: u.name || '',
        nameMax: USER_NAME_MAX,
        joined: u.joined || null,
        joinedLabel: u.joined ? this.longDay(u.joined) : null,
        focus: this.focusRoutes(),
        onboardedAt: u.onboardedAt || null,
        onboarded: !!u.onboardedAt,
        pro,
        plan: State.planLabel,
        theme: (document.documentElement.dataset.theme || 'midnight'),
        themeLabel: (THEMES[document.documentElement.dataset.theme] || THEMES.midnight).label,
        /* What the page can offer to export, read off the live records so the
           card and the file can never disagree about how much there is. */
        workspace: this.workspaceSummary(),
      };
    },

    /* --- Export / import (Milestone 39) -----------------------------------
       What the workspace holds, and what a file claims to hold. Both are read
       off the records themselves, so neither can drift from the data — the
       envelope stores no count of its own. */

    /* The manifest of the LIVE workspace. `kinds` keeps only the non-empty
       collections: a list padded with fifteen zeroes tells you less than one
       that names what is actually there.

       Takes an optional workspace so the reset confirmation can describe the one
       it is about to install (`workspaceSummary(State.demoWorkspace())`) through
       exactly the same rule as the one it is about to destroy — a second summary
       would be a second answer to "how much is there". */
    workspaceSummary(data) {
      const d = data || State.data || {};
      const rows = EXPORT_COLLECTIONS.map(c => {
        const list = Array.isArray(d[c.key]) ? d[c.key] : [];
        return { key: c.key, label: c.label, count: list.length };
      });
      const files = Array.isArray(d.files) ? d.files : [];
      const fileBytes = files.reduce((n, f) => n + ((f.blob && f.blob.size) || 0), 0);
      /* What the envelope carries besides the records — picked through the SAME
         validator an import uses, so the export screen cannot promise to carry a
         preference the import would drop. */
      const prefs = pickPreferences(Settings.read());
      return {
        rows,
        kinds: rows.filter(r => r.count > 0),
        emptyKinds: rows.filter(r => r.count === 0).length,
        records: rows.reduce((n, r) => n + r.count, 0),
        files: files.length,
        fileBytes,
        fileSizeLabel: this.fileSize(fileBytes),
        preferences: prefs,
        prefRows: EXPORT_PREFS
          .filter(p => prefs[p.key] != null)
          .map(p => ({ key: p.key, label: p.label, value: p.value(prefs[p.key]) })),
        plan: State.planLabel,
      };
    },

    /* Validate a parsed export and describe it, WITHOUT applying anything.
       A refusal is a first-class answer: an import that half-applies is worse
       than one that refuses, so every failure returns the same shape with an
       `error` and no counts to act on. */
    importPreview(payload) {
      const fail = error => ({
        ok: false, error, rows: [], kinds: [], records: 0,
        files: 0, fileBytes: 0, fileSizeLabel: this.fileSize(0),
        exportedAt: null, name: null, preferences: null,
      });
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return fail('That file is not a NEXUS export — it does not contain a workspace.');
      }
      if (payload.app !== 'NEXUS') {
        return fail('That file is not a NEXUS export — it is missing the NEXUS marker.');
      }
      const format = Number(payload.format);
      if (!isFinite(format) || format < 1) {
        return fail('That export does not say which format it is, so it cannot be read safely.');
      }
      if (format > EXPORT_FORMAT) {
        return fail(`That export was made by a newer version of NEXUS (format ${format}); this one reads up to ${EXPORT_FORMAT}.`);
      }
      const data = payload.data;
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return fail('That export has no workspace inside it.');
      }
      /* Every collection must be present AND a list. `_reconcile` treats a
         MISSING collection as "never hydrated" and falls back to the demo
         records, so a file that omitted one would silently restore demo data.
         Refused here instead: this is a restore, not a merge. */
      for (const c of EXPORT_COLLECTIONS) {
        const v = data[c.key];
        if (v === undefined || v === null) {
          return fail(`That export is incomplete — it has no ${c.label.toLowerCase()}.`);
        }
        if (!Array.isArray(v)) {
          return fail(`That export is damaged — its ${c.label.toLowerCase()} are not a list.`);
        }
      }
      const files = Array.isArray(data.files) ? data.files : [];
      /* The profile and the finance preferences must be present for the same
         reason: `_reconcile` falls back to the demo record for a missing one, so
         a file that omitted the profile would silently rename you "Alex". */
      if (!data.user || typeof data.user !== 'object' || Array.isArray(data.user)) {
        return fail('That export is incomplete — it has no profile.');
      }
      if (!data.finance || typeof data.finance !== 'object' || Array.isArray(data.finance)) {
        return fail('That export is incomplete — it has no money preferences.');
      }
      /* A file record must carry its bytes, or the restored workspace would
         contain a file that cannot be opened. */
      const broken = files.find(f => !f || typeof f.data !== 'string');
      if (broken) {
        return fail(`That export is damaged — “${String((broken && broken.name) || 'a file')}” has no contents.`);
      }
      const rows = EXPORT_COLLECTIONS.map(c => {
        const list = Array.isArray(data[c.key]) ? data[c.key] : [];
        return { key: c.key, label: c.label, count: list.length };
      });
      /* The size is DERIVED from the encoded bytes, not declared beside them,
         so a file cannot claim a size its contents do not have. */
      const fileBytes = files.reduce((n, f) => n + base64Bytes(f.data), 0);
      /* Preferences are validated here, not applied — the confirm step shows what
         would change, and a value the app cannot use is dropped rather than
         stored. */
      const prefs = pickPreferences(payload.preferences);
      return {
        ok: true, error: null,
        rows, kinds: rows.filter(r => r.count > 0),
        records: rows.reduce((n, r) => n + r.count, 0),
        files: files.length, fileBytes, fileSizeLabel: this.fileSize(fileBytes),
        exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : null,
        name: (data.user && data.user.name) || null,
        preferences: Object.keys(prefs).length ? prefs : null,
        prefRows: EXPORT_PREFS
          .filter(p => prefs[p.key] != null)
          .map(p => ({ key: p.key, label: p.label, value: p.value(prefs[p.key]) })),
      };
    },

    /* --- Notifications (Milestone 36) ------------------------------------
       The fold. Every alert is read off an EXISTING derivation — `overdueTasks`,
       `habitStreak`, `financeBudgets`, `inboxAgeDays`, `journalStreak`,
       `automationPending` — so the bell can never disagree with the page it is
       telling you about. Nothing here is stored and nothing is authored; each
       alert carries the `until` that lets a stored decision expire (see the
       block above the kinds). */
    notifications() {
      const out = [];
      const today = todayKey();
      const add = (kind, key, until, title, detail, at, type, id) => {
        const meta = notificationKind(kind);
        out.push({
          key, kind, kindLabel: meta.label, icon: meta.icon, color: meta.color,
          rank: meta.rank, route: meta.route, until,
          title, detail, at: at || today, type: type || null, id: id || null,
        });
      };

      /* 1 — A task is late. `overdueTasks()` is the ONE definition of lateness
         (M34), so this cannot drift from the Tasks page or the NEXUS Score. */
      this.overdueTasks().forEach(t => {
        const late = this.overdueDays(t);
        add('overdue', 'overdue:' + t.id, null,
          t.title, `${late} day${late === 1 ? '' : 's'} late · ${t.project || 'Personal'}`,
          t.due, 'task', t.id);
      });

      /* 2 — A budget is over its target THIS month. Only "over", never "close":
         close is a judgement, over is a fact. */
      const now = new Date();
      const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      this.financeBudgets(now.getFullYear(), now.getMonth()).rows
        .filter(r => r.over)
        .forEach(r => add('budget', 'budget:' + r.name + ':' + monthKey,
          firstOfNextMonth(monthKey),
          `${r.name} is over budget`,
          `${this.money(r.spent - r.target)} over · ${Math.round(r.pct * 100)}% of ${this.money(r.target)}`,
          today, null, null));

      /* 3 — A habit you already keep has not been logged today. Only a habit
         with a LIVE streak is worth nudging: an unbroken one is a habit you have
         not started, and telling you about it every day is nagging, not help.
         Day-scoped, so today's decision cannot silence tomorrow's. */
      (State.habits || []).forEach(h => {
        const streak = this.habitStreak(h);
        if (streak > 0 && !h.history.includes(today)) {
          add('habit', 'habit:' + h.id + ':' + today, dayKey(shiftDays(new Date(), 1)),
            h.name, `${streak}-day streak · not logged today`, today, 'habit', h.id);
        }
      });

      /* 4 — Captures that have been sitting in the queue. Record-scoped: the
         condition is the same condition until the capture is dealt with. */
      this.inboxOpen().forEach(it => {
        const days = this.inboxAgeDays(it);
        if (days >= NOTIFICATION_WAIT_DAYS) {
          add('inbox', 'inbox:' + it.id, null,
            it.text.length > 70 ? it.text.slice(0, 69) + '…' : it.text,
            `Waiting ${days} days`, it.createdAt, 'inbox', it.id);
        }
      });

      /* 5 — A journal streak is open and today is unwritten. Only fires for
         someone who journals; it protects a habit rather than inventing one. */
      const jStreak = this.journalStreak();
      if (jStreak > 0 && !this.journalList().todayWritten) {
        add('journal', 'journal:' + today, dayKey(shiftDays(new Date(), 1)),
          'Your journal streak is open',
          `${jStreak}-day streak · nothing written today`, today, null, null);
      }

      /* 6 — A rule has occurrences waiting. Gated: nagging about a feature that
         is switched off is not a notification, it is an advert. */
      if (FeatureAccess.allows('automation')) {
        this.automationSummary().rows
          .filter(x => x.rule.enabled && x.pending.length)
          .forEach(x => add('automation', 'automation:' + x.rule.id, null,
            x.rule.name,
            `${x.pending.length} occurrence${x.pending.length === 1 ? '' : 's'} waiting`,
            today, null, null));
      }

      /* Most important first, then most recent. Ties break on the key so the
         order is stable between renders — a list that reshuffles on every
         repaint is a list you cannot read. */
      out.sort((a, b) => b.rank - a.rank
        || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)
        || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return out;
    },

    /* The ONLY shape the Notifications UI reads. `filter` is 'all', 'unread' or
       a kind key. Dismissed alerts are gone from every view — that is what
       dismissing means — and are counted separately so the panel can offer to
       bring them back. */
    notificationView(filter) {
      const all = this.notifications();
      const f = filter || 'all';
      const decisions = k => State.notificationDecision(k);
      const kept = all.filter(n => !decisions(n.key).dismissed);
      const unread = kept.filter(n => !decisions(n.key).read);
      let items = f === 'unread' ? unread
        : f === 'all' ? kept
        : kept.filter(n => n.kind === f);

      const counts = {};
      NOTIFICATION_KINDS.forEach(k => { counts[k.key] = kept.filter(n => n.kind === k.key).length; });
      return {
        items,
        filter: f,
        counts,
        kinds: NOTIFICATION_KINDS.filter(k => counts[k.key] > 0),
        total: kept.length,
        unread: unread.length,
        dismissed: all.length - kept.length,
        empty: kept.length === 0,
        /* Every kind the bell is watching, so the empty state can say what it
           would have told you about rather than just "nothing here". */
        watching: NOTIFICATION_KINDS.map(k => k.label),
      };
    },

    /* --- Focus (Milestone 21) -------------------------------------------
       A focus session is a record of something that actually happened: it
       began at a moment, ended at a moment, and lasted `minutes`. Every focus
       figure in the UI — today's total, the week, the month, the streak, the
       score's focus component, the dashboard ring — is computed from that log.
       Breaks are stored too (they are real time) but never count as deep work. */
    _focusOnly() {
      return (State.focus || []).filter(s => s.mode !== 'break');
    },
    focusDay(key) {
      return this._focusOnly().filter(s => s.day === key)
        .reduce((n, s) => n + s.minutes, 0);
    },
    focusSessionsDay(key) {
      return (State.focus || []).filter(s => s.day === key)
        .sort((a, b) => a.startedAt - b.startedAt);
    },
    focusToday() { return this.focusDay(todayKey()); },
    focusBreakToday() {
      return (State.focus || [])
        .filter(s => s.day === todayKey() && s.mode === 'break')
        .reduce((n, s) => n + s.minutes, 0);
    },
    /* A dense window of day rows ending today — the shape every chart reads. */
    focusRange(days) {
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = shiftDays(new Date(), -i);
        const key = dayKey(d);
        out.push({
          key,
          minutes: this.focusDay(key),
          dow: (d.getDay() + 6) % 7,        // 0 = Monday, matching the calendar
          isToday: i === 0,
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
        });
      }
      return out;
    },
    focusWindow(days) {
      const keys = new Set(this.focusRange(days).map(x => x.key));
      return this._focusOnly().filter(s => keys.has(s.day))
        .reduce((n, s) => n + s.minutes, 0);
    },
    focusWeek()  { return this.focusWindow(7); },
    focusMonth() {
      const ym = todayKey().slice(0, 7);
      return this._focusOnly().filter(s => s.day.slice(0, 7) === ym)
        .reduce((n, s) => n + s.minutes, 0);
    },
    focusTotal() { return this._focusOnly().reduce((n, s) => n + s.minutes, 0); },
    /* Consecutive days with at least one block, ending today or yesterday —
       the same "a run stays live until you actually miss a day" rule as habits. */
    focusStreak() {
      const has = new Set(this._focusOnly().map(s => s.day));
      if (!has.size) return 0;
      let start = 0;
      if (!has.has(todayKey())) {
        if (!has.has(dayKey(shiftDays(new Date(), -1)))) return 0;
        start = 1;
      }
      let n = 0;
      for (let i = start; i <= 400; i++) {
        if (!has.has(dayKey(shiftDays(new Date(), -i)))) break;
        n++;
      }
      return n;
    },
    focusBestDay() {
      const by = new Map();
      this._focusOnly().forEach(s => by.set(s.day, (by.get(s.day) || 0) + s.minutes));
      let best = null;
      by.forEach((minutes, key) => { if (!best || minutes > best.minutes) best = { key, minutes }; });
      return best;
    },
    focusByTask(limit = 6) {
      const by = new Map();
      this._focusOnly().forEach(s => {
        if (!s.taskId) return;
        by.set(s.taskId, (by.get(s.taskId) || 0) + s.minutes);
      });
      return [...by.entries()]
        .map(([taskId, minutes]) => {
          const t = State.tasks.find(x => x.id === taskId);
          return {
            taskId, minutes,
            title: t ? t.title : 'Removed task',
            project: t ? t.project : null,
            gone: !t,
          };
        })
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, limit);
    },
    focusByProject(limit = 6) {
      const by = new Map();
      this._focusOnly().forEach(s => {
        const t = s.taskId ? State.tasks.find(x => x.id === s.taskId) : null;
        if (!t || !t.project) return;
        by.set(t.project, (by.get(t.project) || 0) + s.minutes);
      });
      return [...by.entries()].map(([project, minutes]) => ({ project, minutes }))
        .sort((a, b) => b.minutes - a.minutes).slice(0, limit);
    },
    /* The daily target is a preference, so it lives in Settings (localStorage),
       never in the session log. */
    focusTarget() {
      const t = Number(((State.data && State.data.settings) || {}).focusTarget);
      return isFinite(t) && t > 0 ? t : 120;
    },
    focusSummary() {
      const target  = this.focusTarget();
      const range   = this.focusRange(14);
      const total   = this.focusTotal();
      const sessions = this._focusOnly().length;
      const activeDays = new Set(this._focusOnly().map(s => s.day)).size;
      const todayMin = this.focusToday();
      const monthMin = this.focusMonth();
      const weekMin  = this.focusWeek();
      return {
        target, todayMin, weekMin, monthMin, totalMin: total,
        breakMin: this.focusBreakToday(),
        sessions, activeDays,
        avgMin: sessions ? Math.round(total / sessions) : 0,
        perActiveDay: activeDays ? Math.round(total / activeDays) : 0,
        best: this.focusBestDay(),
        streak: this.focusStreak(),
        progress: clamp(todayMin / target, 0, 1),
        hoursToday: Math.round(todayMin / 6) / 10,
        hoursWeek:  Math.round(weekMin / 6) / 10,
        hoursMonth: Math.round(monthMin / 6) / 10,
        hoursTotal: Math.round(total / 6) / 10,
        range,
        maxRange: Math.max(1, ...range.map(r => r.minutes)),
        byTask: this.focusByTask(),
        byProject: this.focusByProject(),
        today: this.focusSessionsDay(todayKey()),
      };
    },
    /* The dashboard's "Day streak" tile: the longest *live* habit streak.
       Derived from the real history log — never a stored counter. */
    currentStreak() {
      const hs = this.habitSummary();
      return hs.habits.length ? Math.max(...hs.habits.map(x => x.streak)) : 0;
    },

    /* --- Notes (Milestone 22) -------------------------------------------
       A note is user-authored content, so its body is stored — but everything
       *about* the collection (tag counts, how many are tagged, the sort order,
       the search ranking) is computed here, never persisted. */
    note(id) {
      return (State.notes || []).find(n => n.id === id) || null;
    },
    /* Every tag in use, with a real usage count, most-used first. */
    noteTags() {
      const by = new Map();
      (State.notes || []).forEach(n => (n.tags || []).forEach(t => by.set(t, (by.get(t) || 0) + 1)));
      return [...by.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    },
    /* Pinned first, then most recently edited. Ties break by title so the order
       is deterministic rather than dependent on insertion. */
    notesSorted() {
      return [...(State.notes || [])].sort((a, b) =>
        (b.pinned - a.pinned) ||
        (new Date(b.updatedAt) - new Date(a.updatedAt)) ||
        a.title.localeCompare(b.title));
    },
    /* Word count over the body — the only "size" figure a note honestly has. */
    noteWords(n) {
      const text = (n && n.body) ? n.body.trim() : '';
      return text ? text.split(/\s+/).length : 0;
    },
    noteExcerpt(n, len = 140) {
      const text = (n && n.body) ? n.body.replace(/\s+/g, ' ').trim() : '';
      if (!text) return '';
      return text.length > len ? text.slice(0, len - 1).trimEnd() + '…' : text;
    },
    /* Scored search across title, body and tags. Title hits rank highest, then
       tags, then body; an exact substring beats scattered letters. */
    noteSearch(q, list) {
      const src = list || this.notesSorted();
      const needle = String(q || '').trim().toLowerCase();
      if (!needle) return src.map(n => ({ note: n, score: 0 }));
      return src
        .map(n => {
          const title = n.title.toLowerCase();
          const tags = (n.tags || []).join(' ').toLowerCase();
          const body = (n.body || '').toLowerCase();
          let score = 0;
          if (title.startsWith(needle)) score += 100;
          else if (title.includes(needle)) score += 70;
          if (tags.includes(needle)) score += 40;
          const inBody = body.indexOf(needle);
          if (inBody !== -1) score += 20;
          if (!score) return { note: n, score: -1 };
          // Nudge toward more recently edited notes when scores tie — but never
          // enough to push a real match negative.
          const ageDays = Math.floor((Date.now() - new Date(n.updatedAt)) / 86400000);
          return { note: n, score: score + clamp(9 - ageDays, 0, 9) };
        })
        .filter(r => r.score >= 0)
        .sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title));
    },
    notesList() {
      const list = this.notesSorted();
      const tags = this.noteTags();
      const words = list.reduce((n, x) => n + this.noteWords(x), 0);
      return {
        list,
        tags,
        total: list.length,
        favorites: list.filter(n => n.favorite).length,
        pinned: list.filter(n => n.pinned).length,
        tagged: list.filter(n => (n.tags || []).length).length,
        untagged: list.filter(n => !(n.tags || []).length).length,
        empty: list.filter(n => !n.body.trim()).length,
        words,
        lastEdited: list.length ? list[0] : null,
      };
    },
    /* Shared day-key formatters. Journal and Finance both label real days, so
       the wording lives in one place rather than being re-implemented per page. */
    longDay(key) {
      const d = new Date(key + 'T12:00:00');
      const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
      return `${dow}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    },
    shortDay(key) {
      const d = new Date(key + 'T12:00:00');
      return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
    },
    /* Human "when" for a note: minutes, hours, then a date. */
    relTime(iso) {
      const t = new Date(iso).getTime();
      if (!isFinite(t)) return '';
      const mins = Math.floor((Date.now() - t) / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return mins + 'm ago';
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      const days = Math.floor(hrs / 24);
      if (days === 1) return 'Yesterday';
      if (days < 7) return days + 'd ago';
      const d = new Date(t);
      return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    },

    /* --- Knowledge (Milestone 23) ----------------------------------------
       The hierarchy is one field — `note.parentId` — and nothing else. Depth,
       paths, breadcrumbs, child counts and rolled-up sizes are all computed
       here, so moving a note can never leave a stale number behind.

       Wiki links are DERIVED from the body text (`[[Some Title]]`). Nothing is
       stored, which means a renamed note cannot leave a stale link table: a
       link either resolves to a real note or is honestly reported as broken. */
    noteChildren(id) {
      const pid = id || null;
      return this.notesSorted().filter(n => n.parentId === pid);
    },
    /* Root → … → parent. Empty array for a root note. */
    notePath(id) {
      const byId = new Map((State.notes || []).map(n => [n.id, n]));
      const out = [];
      const seen = new Set([id]);
      let cur = byId.get(id);
      while (cur && cur.parentId && !seen.has(cur.parentId)) {
        seen.add(cur.parentId);
        const p = byId.get(cur.parentId);
        if (!p) break;
        out.unshift(p);
        cur = p;
      }
      return out;
    },
    noteDepth(id) { return this.notePath(id).length; },
    /* Every descendant, depth-first. Safe because the hierarchy is a forest
       (repairNoteHierarchy runs on load, setNoteParent refuses cycles). */
    noteDescendants(id) {
      const out = [];
      const walk = (pid) => {
        this.noteChildren(pid).forEach(c => { out.push(c); walk(c.id); });
      };
      walk(id);
      return out;
    },
    /* A parent's size includes everything filed under it. */
    noteSubtreeWords(id) {
      const self = State.noteById(id);
      return (self ? this.noteWords(self) : 0)
        + this.noteDescendants(id).reduce((n, c) => n + this.noteWords(c), 0);
    },

    /* Titles referenced from a body, in first-seen order, de-duplicated. */
    noteLinkTargets(n) {
      if (!n || !n.body) return [];
      const out = [];
      const re = /\[\[([^\[\]\n]{1,140})\]\]/g;
      let m;
      while ((m = re.exec(n.body)) !== null) {
        const title = m[1].trim();
        if (title && out.indexOf(title) === -1) out.push(title);
      }
      return out;
    },
    /* Outgoing links, each resolved (or honestly marked broken). Resolution is
       by title, case-insensitively, first match in sort order — the standard
       wiki-link trade-off. */
    noteLinks(n) {
      return this.noteLinkTargets(n).map(title => {
        const hit = (State.notes || []).find(x =>
          x.title.toLowerCase() === title.toLowerCase());
        return { title, note: hit || null, broken: !hit };
      });
    },
    noteBacklinks(id) {
      const n = State.noteById(id);
      if (!n) return [];
      const t = n.title.toLowerCase();
      return (State.notes || []).filter(x =>
        x.id !== id && this.noteLinkTargets(x).some(l => l.toLowerCase() === t));
    },
    /* Most-linked notes across the workspace — a real "what matters here". */
    noteMostLinked(limit = 5) {
      return (State.notes || [])
        .map(n => ({ note: n, count: this.noteBacklinks(n.id).length }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count || a.note.title.localeCompare(b.note.title))
        .slice(0, limit);
    },
    /* Resolve a note's pointers into real objects. A pointer whose target is
       gone is reported as missing rather than silently dropped. */
    noteRefs(n) {
      if (!n) return [];
      const find = (type, id) => {
        if (type === 'task')    return State.tasks.find(x => x.id === id) || null;
        if (type === 'project') return State.projects.find(x => x.id === id) || null;
        if (type === 'goal')    return State.goals.find(x => x.id === id) || null;
        return null;
      };
      return (n.refs || []).map(r => {
        const obj = find(r.type, r.id);
        let meta = '';
        if (obj) {
          if (r.type === 'task')    meta = obj.project || 'Personal';
          if (r.type === 'project') meta = this.projectStats(obj.name).progress + '%';
          if (r.type === 'goal')    meta = obj.area || 'Goal';
        }
        return {
          type: r.type, id: r.id, obj,
          missing: !obj,
          label: obj ? (obj.title || obj.name) : 'Missing ' + r.type,
          meta,
        };
      });
    },
    knowledgeList() {
      const notes = this.notesSorted();
      const roots = notes.filter(n => !n.parentId);
      const depths = notes.map(n => this.noteDepth(n.id));
      let broken = 0, linkCount = 0;
      const brokenLinks = [];
      notes.forEach(n => {
        this.noteLinks(n).forEach(l => {
          linkCount++;
          if (l.broken) { broken++; brokenLinks.push({ note: n, title: l.title }); }
        });
      });
      const withChildren = notes.filter(n => this.noteChildren(n.id).length);
      return {
        notes, roots, brokenLinks,
        total: notes.length,
        rootCount: roots.length,
        maxDepth: depths.length ? Math.max(...depths) : 0,
        parents: withChildren.length,
        leaves: notes.length - withChildren.length,
        linked: notes.filter(n => this.noteLinkTargets(n).length).length,
        linkCount,
        broken,
        withRefs: notes.filter(n => (n.refs || []).length).length,
        refCount: notes.reduce((a, n) => a + (n.refs || []).length, 0),
        /* Roots that hold nothing — the honest "unfiled" list. */
        unfiled: roots.filter(n => !this.noteChildren(n.id).length),
        words: notes.reduce((a, n) => a + this.noteWords(n), 0),
      };
    },

    /* --- Journal (Milestone 24) ------------------------------------------
       Everything below is derived from `State.journal` on every call. Nothing is
       cached and nothing is stored, so an edit can never leave a stale streak or
       a stale average behind. */
    journalWordCount(e) {
      const t = ((e && e.body) || '').trim();
      return t ? t.split(/\s+/).length : 0;
    },
    journalExcerpt(e, n = 220) {
      const t = ((e && e.body) || '').replace(/\s+/g, ' ').trim();
      if (!t) return '';
      return t.length > n ? t.slice(0, n).replace(/[\s,.;:!?-]+$/, '') + '…' : t;
    },
    /* An entry is only real if it says something — a body with words, or at
       least one rating. A record that was opened and abandoned must not count
       towards the streak or the averages, and must not appear in the timeline. */
    journalMeaningful(e) {
      return !!e && (this.journalWordCount(e) > 0
        || typeof e.mood === 'number'
        || typeof e.energy === 'number'
        || typeof e.productivity === 'number');
    },
    _journalReal() { return (State.journal || []).filter(e => this.journalMeaningful(e)); },
    journalSorted() {
      return this._journalReal().slice()
        .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
    },
    journalTags() {
      const counts = new Map();
      this._journalReal().forEach(e => (e.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
      return [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : 1));
    },
    /* Consecutive days written, ending today OR yesterday — a live run is not
       lost just because today's entry has not been written yet. */
    journalStreak() {
      const days = new Set(this._journalReal().map(e => e.day));
      if (!days.size) return 0;
      let cur = days.has(todayKey()) ? todayKey() : dayKey(shiftDays(new Date(), -1));
      let n = 0;
      while (days.has(cur)) {
        n++;
        // Noon anchor keeps the arithmetic clear of DST edges at midnight.
        cur = dayKey(shiftDays(new Date(cur + 'T12:00:00'), -1));
      }
      return n;
    },
    /* The longest run the journal has ever had — gap detection over the sorted
       unique days, so duplicates cannot inflate it. */
    journalBestStreak() {
      const days = [...new Set(this._journalReal().map(e => e.day))].sort();
      let best = 0, run = 0, prev = null;
      days.forEach(d => {
        run = (prev && dayKey(shiftDays(new Date(prev + 'T12:00:00'), 1)) === d) ? run + 1 : 1;
        prev = d;
        if (run > best) best = run;
      });
      return best;
    },
    /* Mean of one axis over the entries that actually rated it, on the 1–5
       scale. Unrated days are excluded rather than counted as a 3 — an average
       that treats silence as "okay" is a lie. */
    journalAvg(key) {
      const vals = this._journalReal()
        .map(e => e[key])
        .filter(v => typeof v === 'number' && v >= 1 && v <= 5);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    },
    /* Dense day rows ending today — the shape the 30-day strip reads. */
    journalRange(days = 30) {
      const byDay = new Map(this._journalReal().map(e => [e.day, e]));
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const key = dayKey(shiftDays(new Date(), -i));
        const e = byDay.get(key) || null;
        out.push({
          day: key, entry: e,
          mood: e ? e.mood : null,
          energy: e ? e.energy : null,
          productivity: e ? e.productivity : null,
        });
      }
      return out;
    },
    /* A month of journal coverage: a Monday-start cell grid plus that month's
       own rollup. Same grid convention as the calendar, so the two agree. */
    journalMonth(year, month) {
      const lead = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysIn = new Date(year, month + 1, 0).getDate();
      const byDay = new Map(this._journalReal().map(e => [e.day, e]));
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(null);
      for (let d = 1; d <= daysIn; d++) {
        const key = dayKey(new Date(year, month, d));
        cells.push({ day: key, date: d, entry: byDay.get(key) || null });
      }
      while (cells.length % 7) cells.push(null);
      const entries = cells.filter(c => c && c.entry).map(c => c.entry);
      const mean = key => {
        const v = entries.map(e => e[key]).filter(x => typeof x === 'number');
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
      };
      return {
        year, month, cells, entries,
        count: entries.length,
        daysIn,
        /* How much of the month is written — the honest coverage figure. */
        coverage: daysIn ? entries.length / daysIn : 0,
        mood: mean('mood'), energy: mean('energy'), productivity: mean('productivity'),
        words: entries.reduce((a, e) => a + this.journalWordCount(e), 0),
        rated: entries.filter(e => typeof e.mood === 'number'
          || typeof e.energy === 'number' || typeof e.productivity === 'number').length,
      };
    },
    /* Scored across the day key, title, tags and body — deliberately the same
       shape as the note search, so the two feel like one product. */
    journalSearch(q) {
      const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      const out = [];
      this.journalSorted().forEach(e => {
        const title = (e.title || '').toLowerCase();
        const body = (e.body || '').toLowerCase();
        const tags = (e.tags || []).join(' ');
        let score = 0;
        terms.forEach(t => {
          if (title.includes(t)) score += 100;
          if (title.startsWith(t)) score += 20;
          if (tags.includes(t)) score += 40;
          if (body.includes(t)) score += 20;
          if (e.day.includes(t)) score += 60;
        });
        if (score > 0) out.push({ entry: e, score });
      });
      return out.sort((a, b) => b.score - a.score || (a.entry.day < b.entry.day ? 1 : -1));
    },
    journalSummary() {
      const real = this._journalReal();
      const days = [...new Set(real.map(e => e.day))].sort();
      const first = days.length ? days[0] : null;
      const monthPrefix = todayKey().slice(0, 7);
      const spanDays = first
        ? Math.round((new Date(todayKey() + 'T12:00:00') - new Date(first + 'T12:00:00')) / 86400000) + 1
        : 0;
      const hasRating = e => typeof e.mood === 'number'
        || typeof e.energy === 'number' || typeof e.productivity === 'number';
      return {
        total: real.length,
        streak: this.journalStreak(),
        best: this.journalBestStreak(),
        mood: this.journalAvg('mood'),
        energy: this.journalAvg('energy'),
        productivity: this.journalAvg('productivity'),
        rated: real.filter(hasRating).length,
        words: real.reduce((a, e) => a + this.journalWordCount(e), 0),
        thisMonth: real.filter(e => e.day.slice(0, 7) === monthPrefix).length,
        withBody: real.filter(e => this.journalWordCount(e) > 0).length,
        firstDay: first,
        spanDays,
        /* Coverage of the journal's own span — not of all time. */
        coverage: spanDays ? real.length / spanDays : 0,
      };
    },
    /* The only shape the Journal UI reads. */
    journalList() {
      const summary = this.journalSummary();
      const today = (State.journal || []).find(e => e.day === todayKey()) || null;
      return {
        entries: this.journalSorted(),
        tags: this.journalTags(),
        summary,
        today,
        todayWritten: this.journalMeaningful(today),
        range: this.journalRange(30),
        empty: summary.total === 0,
      };
    },

    /* --- Inbox (Milestone 25) --------------------------------------------
       Everything below is derived from `State.inbox` on every call. Nothing is
       cached, so triaging a capture can never leave a stale count behind. */
    inboxOpen() { return (State.inbox || []).filter(x => x.status === 'inbox'); },
    inboxDone() { return (State.inbox || []).filter(x => x.status === 'processed'); },
    /* Open captures first (newest first), then the processed tail — the queue
       the user still has to deal with always comes first. */
    inboxSorted() {
      const rank = x => (x.status === 'inbox' ? 0 : 1);
      return (State.inbox || []).slice().sort((a, b) =>
        rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
    inboxAgeDays(it) {
      if (!it) return 0;
      return Math.max(0, Math.floor((Date.now() - new Date(it.createdAt).getTime()) / 86400000));
    },
    inboxAge(it) { return it ? this.relTime(it.createdAt) : ''; },
    /* Open captures per kind — the filter row and the aside both read this. */
    inboxCounts() {
      const out = {};
      INBOX_KINDS.forEach(k => { out[k.key] = 0; });
      this.inboxOpen().forEach(x => { out[x.kind] = (out[x.kind] || 0) + 1; });
      return out;
    },
    /* Resolve a conversion pointer to the real record, flagging a target that has
       since been deleted rather than dropping the row silently. */
    inboxConverted(it) {
      const c = it && it.convertedTo;
      if (!c) return null;
      const dest = INBOX_DESTS.find(d => d.type === c.type)
        || { type: c.type, label: c.type, icon: 'inbox' };
      let record = null, title = '';
      if (c.type === 'task') {
        record = State.tasks.find(x => x.id === c.id) || null;
        title = record ? record.title : '';
      } else if (c.type === 'note') {
        record = State.noteById(c.id);
        title = record ? record.title : '';
      } else if (c.type === 'project') {
        record = State.projects.find(x => x.id === c.id) || null;
        title = record ? record.name : '';
      } else if (c.type === 'goal') {
        record = State.goals.find(x => x.id === c.id) || null;
        title = record ? record.name : '';
      } else if (c.type === 'journal') {
        record = State.journalById(c.id);
        title = record ? record.day : '';
      }
      return { ...dest, record, title, missing: !record };
    },
    /* Scored across the text, the URL and the kind name — the same shape as the
       note and journal searches, so all three feel like one product. */
    inboxSearch(q) {
      const terms = String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      const out = [];
      this.inboxSorted().forEach(it => {
        const text = (it.text || '').toLowerCase();
        const url = (it.url || '').toLowerCase();
        const kind = (INBOX_KINDS.find(k => k.key === it.kind) || {}).label || '';
        let score = 0;
        terms.forEach(t => {
          if (text.includes(t)) score += 100;
          if (text.startsWith(t)) score += 40;
          if (url.includes(t)) score += 30;
          if (kind.toLowerCase() === t) score += 40;
        });
        if (score > 0) out.push({ item: it, score });
      });
      return out.sort((a, b) => b.score - a.score
        || (a.item.createdAt < b.item.createdAt ? 1 : -1));
    },
    inboxSummary() {
      const all = State.inbox || [];
      const open = this.inboxOpen();
      const counts = this.inboxCounts();
      const today = todayKey();
      const oldest = open.length
        ? open.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b))
        : null;
      return {
        total: all.length,
        open: open.length,
        done: all.length - open.length,
        counts,
        today: all.filter(x => dayKey(new Date(x.createdAt)) === today).length,
        oldest,
        oldestDays: this.inboxAgeDays(oldest),
        /* How many kinds are actually in use — drives the "By kind" card. */
        kindsUsed: INBOX_KINDS.filter(k => (counts[k.key] || 0) > 0).length,
      };
    },
    /* The only shape the Inbox UI reads. */
    inboxList() {
      const summary = this.inboxSummary();
      return {
        items: this.inboxSorted(),
        summary,
        empty: summary.total === 0,
      };
    },

    /* --- Files (Milestone 28) --------------------------------------------
       A file stores a name, a label, its pointers and its bytes — nothing else.
       Size, mime type, kind and extension are all read off the Blob here, and
       every count, total and percentage below is computed from the collection.
       These helpers are the only place that happens, so the page, the preview
       panel and the tests all agree on what a file "is". */
    fileSize(bytes) {
      const n = Math.max(0, Number(bytes) || 0);
      if (n < 1024) return n + ' B';
      const units = ['KB', 'MB', 'GB', 'TB'];
      let v = n / 1024, i = 0;
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
      return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + units[i];
    },
    /* The derived descriptor of one file. Nothing here is stored. */
    fileMeta(f) {
      if (!f) return null;
      const size = (f.blob && typeof f.blob.size === 'number') ? f.blob.size : 0;
      const type = (f.blob && f.blob.type) ? String(f.blob.type) : '';
      const dot = String(f.name || '').lastIndexOf('.');
      return {
        size, type,
        ext: dot > 0 ? String(f.name).slice(dot + 1).toLowerCase() : '',
        kind: fileKind(type, f.name),
        sizeLabel: this.fileSize(size),
      };
    },
    /* Resolve a file's pointers into real records. A pointer whose target is gone
       is reported as missing rather than silently dropped — the same rule notes
       and inbox captures follow. */
    fileRefs(f) {
      if (!f) return [];
      const find = (type, id) => {
        if (type === 'task')    return State.tasks.find(x => x.id === id) || null;
        if (type === 'project') return State.projects.find(x => x.id === id) || null;
        if (type === 'note')    return State.noteById(id);
        if (type === 'journal') return State.journal.find(x => x.id === id) || null;
        return null;
      };
      return (f.refs || []).map(r => {
        const obj = find(r.type, r.id);
        const meta = FILE_REF_META.find(m => m.type === r.type) || { label: 'File', icon: 'file', route: 'files' };
        let sub = '';
        if (obj) {
          if (r.type === 'task')    sub = obj.project || 'Personal';
          if (r.type === 'project') sub = this.projectStats(obj.name).progress + '% done';
          if (r.type === 'note')    sub = (obj.tags && obj.tags.length) ? obj.tags.slice(0, 2).join(' · ') : 'Note';
          if (r.type === 'journal') sub = obj.title || longDay(obj.day);
        }
        return {
          type: r.type, id: r.id, obj, sub,
          missing: !obj,
          label: obj ? (obj.title || obj.name || obj.day || 'Untitled') : 'Missing ' + meta.label.toLowerCase(),
          icon: meta.icon, route: meta.route,
        };
      });
    },
    /* The inverse pointer: which files are attached to a given record. Derived
       by scanning the collection, so it can never fall out of sync. */
    filesFor(type, id) {
      const rid = String(id);
      return (State.files || []).filter(f =>
        (f.refs || []).some(r => r.type === type && r.id === rid));
    },
    filesSorted() {
      return [...(State.files || [])].sort((a, b) =>
        (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
        || String(a.name || '').localeCompare(String(b.name || '')));
    },
    /* Per-kind count and byte total, biggest first — the aside's breakdown. The
       percentage is derived from the byte total, never stored. */
    fileKindRows() {
      const metas = (State.files || []).map(f => this.fileMeta(f));
      const total = metas.reduce((s, m) => s + m.size, 0);
      return FILE_KIND_META
        .map(k => {
          const mine = metas.filter(m => m.kind === k.kind);
          const bytes = mine.reduce((s, m) => s + m.size, 0);
          return {
            kind: k.kind, label: k.label, icon: k.icon, color: k.color,
            count: mine.length, bytes, sizeLabel: this.fileSize(bytes),
            pct: total ? bytes / total : 0,
          };
        })
        .filter(r => r.count > 0)
        .sort((a, b) => b.bytes - a.bytes || b.count - a.count);
    },
    fileStats() {
      const files = State.files || [];
      const metas = files.map(f => this.fileMeta(f));
      const bytes = metas.reduce((s, m) => s + m.size, 0);
      const refLists = files.map(f => this.fileRefs(f));
      const linked = refLists.filter(l => l.length).length;
      const kinds = this.fileKindRows();
      const sorted = this.filesSorted();
      const biggest = metas.length
        ? metas.reduce((a, b) => (b.size > a.size ? b : a))
        : null;
      const biggestFile = biggest ? sorted.find(f => this.fileMeta(f).size === biggest.size) : null;
      return {
        total: files.length,
        bytes,
        sizeLabel: this.fileSize(bytes),
        linked,
        unlinked: files.length - linked,
        refCount: refLists.reduce((s, l) => s + l.length, 0),
        broken: refLists.reduce((s, l) => s + l.filter(r => r.missing).length, 0),
        kinds,
        kindsUsed: kinds.length,
        biggest: biggestFile,
        biggestLabel: biggest ? biggest.sizeLabel : '—',
        newest: sorted.length ? sorted[0] : null,
        avgLabel: files.length ? this.fileSize(Math.round(bytes / files.length)) : '—',
      };
    },
    /* Scored across name (100/50) → label (60) → extension (40) → linked record
       (50) → kind name (30). A file with no terms matches nothing. */
    fileSearch(q, list) {
      const src = list || this.filesSorted();
      const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return src;
      const out = [];
      src.forEach(f => {
        const m = this.fileMeta(f);
        const name = String(f.name || '').toLowerCase();
        const label = String(f.label || '').toLowerCase();
        const kind = fileKindMeta(m.kind).label.toLowerCase();
        const refs = this.fileRefs(f).map(r => String(r.label || '').toLowerCase());
        let score = 0;
        terms.forEach(t => {
          if (name.includes(t)) score += 100;
          if (name.startsWith(t)) score += 50;
          if (label.includes(t)) score += 60;
          if (m.ext && m.ext === t) score += 40;
          if (kind === t) score += 30;
          if (refs.some(l => l.includes(t))) score += 50;
        });
        if (score > 0) out.push({ file: f, score });
      });
      return out.sort((a, b) => b.score - a.score
        || (a.file.createdAt < b.file.createdAt ? 1 : -1)).map(r => r.file);
    },
    /* The only shape the Files UI reads. */
    filesList() {
      const stats = this.fileStats();
      return {
        files: this.filesSorted(),
        stats,
        empty: stats.total === 0,
      };
    },

    /* --- Search (Milestone 29) -------------------------------------------
       One query across every collection the workspace holds. The index is built
       fresh from State on every call — nothing is cached, so a record that
       changes is immediately searchable and a deleted one is immediately gone.
       Each entry exposes three weighted fields: `primary` (its name),
       `secondary` (its structured context) and `body` (its long text). */
    searchIndex() {
      const out = [];
      /* The three weighted fields are kept in their ORIGINAL case so a result can
         quote itself, and lowercased once into `*Lower` for matching. Lowercasing
         here rather than per term means a long journal entry is folded once per
         keystroke, not once per word. */
      const push = (key, id, label, primary, secondary, body, meta, at) => {
        const p = String(primary == null ? '' : primary);
        const s = String(secondary == null ? '' : secondary);
        const b = String(body == null ? '' : body);
        out.push({
          key, id, label: String(label == null ? '' : label),
          primary: p, primaryLower: p.toLowerCase(),
          secondary: s, secondaryLower: s.toLowerCase(),
          body: b, bodyLower: b.toLowerCase(),
          meta: String(meta == null ? '' : meta),
          at: at || null,
        });
      };

      (State.tasks || []).forEach(t => push('task', t.id, t.title, t.title,
        [t.project, (t.tags || []).join(' ')].filter(Boolean).join(' '),
        t.description,
        t.done ? 'Done' : this.dueLabel(t.due),
        t.updatedAt || t.createdAt));

      (State.projects || []).forEach(p => {
        const st = this.projectStats(p.name);
        push('project', p.id, p.name, p.name, p.status || '', '',
          `${st.progress}% · ${st.done}/${st.total} done`, null);
      });

      (this.allGoals() || []).forEach(g => push('goal', g.id, g.name, g.name, g.area || '', '',
        g.total ? `${g.progress}% · ${g.done}/${g.total} done` : 'No work linked', null));

      (State.notes || []).forEach(n => push('note', n.id, n.title, n.title,
        (n.tags || []).join(' '), n.body,
        `${this.noteWords(n)} words · edited ${this.relTime(n.updatedAt)}`, n.updatedAt));

      (State.journal || []).forEach(e => push('journal', e.id,
        e.title || this.longDay(e.day), `${e.title || ''} ${e.day}`,
        (e.tags || []).join(' '), e.body,
        `${this.shortDay(e.day)} · ${this.journalWordCount(e)} words`, e.updatedAt));

      (State.inbox || []).forEach(it => push('inbox', it.id, it.text, it.text,
        [it.url, (INBOX_KINDS.find(k => k.key === it.kind) || {}).label].filter(Boolean).join(' '),
        '', `${this.inboxAge(it)} · ${it.status === 'processed' ? 'Moved' : 'Waiting'}`, it.createdAt));

      (State.transactions || []).forEach(t => push('transaction', t.id, t.label, t.label,
        `${t.category} ${t.type}`, t.note,
        `${this.money(t.amount)} · ${this.shortDay(t.day)}`, null));

      (State.files || []).forEach(f => {
        const m = this.fileMeta(f);
        push('file', f.id, f.name, f.name,
          [f.label, m.ext, this.fileRefs(f).map(r => r.label).join(' ')]
            .filter(Boolean).join(' '),
          '', `${m.sizeLabel} · ${fileKindMeta(m.kind).label}`, f.createdAt);
      });

      (this.habitSummary().habits || []).forEach(h => push('habit', h.id, h.name, h.name, '', '',
        `${h.streak}d streak · ${h.rate30}% in 30 days`, null));

      (State.upcoming || []).forEach(u => push('event', u.id, u.title, u.title, u.time, '', '', null));

      (State.activity || []).forEach(a => push('activity', a.id, a.text, a.text, a.kind, '',
        this.activityTime(a), a.createdAt));

      return out;
    },
    /* A term scores by the strongest field it lands in, and EVERY term must land
       somewhere — so a two-word query means both words are present, not either. */
    searchScore(e, terms) {
      let score = 0;
      for (let i = 0; i < terms.length; i++) {
        const t = terms[i];
        let hit = 0;
        const at = e.primaryLower.indexOf(t);
        if (at !== -1)                               hit = at === 0 ? 160 : 100;
        else if (e.secondaryLower.indexOf(t) !== -1) hit = 50;
        else if (e.bodyLower.indexOf(t) !== -1)      hit = 25;
        if (!hit) return 0;
        score += hit;
      }
      return score;
    },
    /* A window of the long text around the first real match, so a result explains
       itself. Falls back to the record's structured context, in its real case. */
    searchSnippet(e, terms) {
      const body = e.body || '';
      if (body) {
        const lower = e.bodyLower;
        for (let i = 0; i < terms.length; i++) {
          const at = lower.indexOf(terms[i]);
          if (at === -1) continue;
          const start = Math.max(0, at - 44);
          const end = Math.min(body.length, at + terms[i].length + 66);
          return (start > 0 ? '…' : '') +
                 body.slice(start, end).replace(/\s+/g, ' ').trim() +
                 (end < body.length ? '…' : '');
        }
      }
      return e.secondary ? e.secondary.slice(0, 120) : '';
    },
    /* The most recently touched record in each area. One per kind, so the card
       stays a useful shortcut instead of five rows from whichever collection
       happens to be the most recently written. */
    searchRecent(index, n) {
      const seen = {};
      return (index || []).filter(e => e.at)
        .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
        .filter(e => (seen[e.key] ? false : (seen[e.key] = true)))
        .slice(0, n || 5);
    },
    /* Browsing one kind with no query — the same index, unscored, newest first.
       Keeps the scope chips meaningful before anything is typed. */
    searchBrowse(scope, limit) {
      const s = searchSource(scope);
      const all = this.searchIndex()
        .filter(e => e.key === scope)
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))
          || a.label.localeCompare(b.label));
      return {
        key: s.key, label: s.label, icon: s.icon, color: s.color, route: s.route,
        total: all.length,
        rows: all.slice(0, limit || 50).map(e => ({ key: e.key, id: e.id, label: e.label, meta: e.meta })),
      };
    },
    /* The ONLY shape the Search UI reads. */
    searchAll(q, scope, limit) {
      const query = String(q == null ? '' : q);
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const index = this.searchIndex();
      const perGroup = limit || 5;

      const counts = {};
      index.forEach(e => { counts[e.key] = (counts[e.key] || 0) + 1; });
      const sources = SEARCH_SOURCES.map(s => ({ ...s, indexed: counts[s.key] || 0 }));

      if (!terms.length) {
        return {
          query, terms, hasQuery: false, sources, indexed: index.length,
          groups: [], matches: {}, total: 0, empty: true, truncated: false,
          recent: this.searchRecent(index, 5),
        };
      }

      const hits = [];
      index.forEach(e => {
        const score = this.searchScore(e, terms);
        if (score > 0) hits.push({ e, score });
      });

      const matches = {};
      hits.forEach(h => { matches[h.e.key] = (matches[h.e.key] || 0) + 1; });

      const order = k => SEARCH_SOURCES.findIndex(s => s.key === k);
      const groups = SEARCH_SOURCES
        .filter(s => !scope || scope === 'all' || s.key === scope)
        .map(s => {
          const mine = hits.filter(h => h.e.key === s.key)
            .sort((a, b) => b.score - a.score || a.e.label.localeCompare(b.e.label));
          if (!mine.length) return null;
          return {
            key: s.key, label: s.label, icon: s.icon, color: s.color, route: s.route,
            total: mine.length, shown: Math.min(mine.length, perGroup), best: mine[0].score,
            hits: mine.slice(0, perGroup).map(h => ({
              key: h.e.key, id: h.e.id, label: h.e.label, meta: h.e.meta,
              snippet: this.searchSnippet(h.e, terms), score: h.score,
            })),
          };
        })
        .filter(Boolean)
        /* Most relevant kind first; ties fall back to the canonical order, so the
           result list is deterministic rather than dependent on insertion. */
        .sort((a, b) => b.best - a.best || order(a.key) - order(b.key));

      return {
        query, terms, hasQuery: true, sources, indexed: index.length,
        groups, matches, total: hits.length,
        empty: groups.length === 0,
        truncated: groups.some(g => g.total > g.shown),
        recent: [],
      };
    },

    /* --- Activity (Milestone 30) -----------------------------------------
       Every mutation appends one entry: a kind, the sentence describing what
       happened, and a real timestamp. The age string, the day it belongs to, the
       per-kind counts, the day grouping and every summary figure are derived
       here — the log stores none of them. */
    activityTime(a) {
      return (a && a.createdAt) ? this.relTime(a.createdAt) : '';
    },
    activityDay(a) {
      return (a && a.createdAt) ? dayKey(new Date(a.createdAt)) : todayKey();
    },
    activitySorted() {
      return [...(State.activity || [])].sort((a, b) =>
        (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    },
    activityCounts() {
      const counts = {};
      (State.activity || []).forEach(a => { counts[a.kind] = (counts[a.kind] || 0) + 1; });
      return counts;
    },
    /* Scored across the sentence (100/50) then the kind's own name (40). */
    activitySearch(q, list) {
      const src = list || this.activitySorted();
      const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
      if (!terms.length) return src;
      const out = [];
      src.forEach(a => {
        const text = String(a.text || '').toLowerCase();
        const kind = activityKind(a.kind).label.toLowerCase();
        let score = 0;
        terms.forEach(t => {
          if (text.includes(t)) score += 100;
          if (text.startsWith(t)) score += 50;
          if (kind === t) score += 40;
        });
        if (score > 0) out.push({ a, score });
      });
      return out.sort((x, y) => y.score - x.score
        || (x.a.createdAt < y.a.createdAt ? 1 : -1)).map(r => r.a);
    },
    /* 'today' and 'week' are real windows over real timestamps. */
    activityRange(list, range) {
      const src = list || this.activitySorted();
      if (range === 'today') {
        const key = todayKey();
        return src.filter(a => this.activityDay(a) === key);
      }
      if (range === 'week') {
        const cutoff = Date.now() - 7 * 86400000;
        return src.filter(a => new Date(a.createdAt).getTime() >= cutoff);
      }
      return src;
    },
    /* The filtered rows the page shows, before grouping. */
    activityRows(filters) {
      const f = filters || {};
      let list = this.activityRange(this.activitySorted(), f.range || 'all');
      if (f.kind && f.kind !== 'all') list = list.filter(a => a.kind === f.kind);
      return this.activitySearch(f.q, list);
    },
    /* Rows grouped into day buckets, newest day first. */
    activityDays(rows) {
      const order = [];
      const byDay = {};
      (rows || []).forEach(a => {
        const day = this.activityDay(a);
        if (!byDay[day]) { byDay[day] = []; order.push(day); }
        byDay[day].push(a);
      });
      return order.map(day => ({
        day, label: this.longDay(day), short: this.shortDay(day),
        items: byDay[day], count: byDay[day].length,
      }));
    },
    activityStats() {
      const all = State.activity || [];
      const today = todayKey();
      const cutoff = Date.now() - 7 * 86400000;
      const counts = this.activityCounts();
      const days = this.activityDays(this.activitySorted());
      const busiest = days.reduce((a, b) => (!a || b.count > a.count ? b : a), null);
      const oldest = all.length ? all[all.length - 1] : null;   // the log is newest-first
      return {
        total: all.length,
        today: all.filter(a => this.activityDay(a) === today).length,
        week: all.filter(a => new Date(a.createdAt).getTime() >= cutoff).length,
        counts,
        kindsUsed: ACTIVITY_KINDS.filter(k => (counts[k.key] || 0) > 0).length,
        days: days.length,
        busiest,
        firstDay: oldest ? this.activityDay(oldest) : null,
        spanDays: oldest
          ? Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 86400000) + 1 : 0,
      };
    },
    /* The only shape the Activity UI reads.
       `baseCounts` is the per-kind tally inside the current RANGE and search but
       before the kind filter, so a filter chip counts what selecting it would
       actually show rather than promising rows that are not there. */
    activityList(filters) {
      const f = filters || {};
      const searched = this.activitySearch(f.q, this.activityRange(this.activitySorted(), f.range || 'all'));
      const rows = (f.kind && f.kind !== 'all')
        ? searched.filter(a => a.kind === f.kind) : searched;
      const baseCounts = {};
      searched.forEach(a => { baseCounts[a.kind] = (baseCounts[a.kind] || 0) + 1; });
      const stats = this.activityStats();
      return {
        rows,
        days: this.activityDays(rows),
        stats,
        counts: stats.counts,        // all time
        baseCounts,                  // within range + search
        baseTotal: searched.length,
        filtered: rows.length !== stats.total,
        empty: stats.total === 0,
        noMatch: rows.length === 0 && stats.total > 0,
      };
    },

    /* --- Analytics (Milestone 31) ----------------------------------------
       Trends over the records that already exist. Nothing is stored and nothing
       is estimated: every figure is a fold over real records inside a real date
       range, and a week that has not finished yet is measured against the days
       that have actually happened. */
    /* Monday of the week containing a date, as a day key — the same week
       convention the calendar and the journal month grid already use. */
    weekStart(date) {
      const d = new Date(date);
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return dayKey(d);
    },
    /* "1–7 Sep", or a full range when the week spans two months. */
    weekLabel(startKey) {
      const start = new Date(startKey + 'T12:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return start.getMonth() === end.getMonth()
        ? `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`
        : `${this.shortDay(dayKey(start))} – ${this.shortDay(dayKey(end))}`;
    },
    /* Fold every collection over an explicit set of days. This is the ONE place a
       period becomes figures, so a finished week, a week in progress and "the
       same days of last week" are all measured by exactly the same rule. */
    periodFigures(days) {
      const set = new Set(days);
      const tasks = State.tasks || [];
      const focus = (State.focus || []).filter(s => s.mode !== 'break');
      const habits = State.habits || [];
      const activity = State.activity || [];
      const journal = (State.journal || []).filter(e => this.journalMeaningful(e));
      const txs = State.transactions || [];

      const done = tasks.filter(t => t.done && t.completedAt
        && set.has(dayKey(new Date(t.completedAt))));
      const logged = habits.reduce((a, h) =>
        a + (h.history || []).filter(k => set.has(k)).length, 0);
      const possible = habits.length * days.length;
      return {
        dayCount: days.length,
        tasksDone: done.length,
        taskMinutes: done.reduce((a, t) => a + (t.estimate || 0), 0),
        focusMin: focus.filter(s => set.has(s.day)).reduce((a, s) => a + (s.minutes || 0), 0),
        habitLogged: logged,
        habitPossible: possible,
        habitRate: possible ? logged / possible : 0,
        activity: activity.filter(a => set.has(this.activityDay(a))).length,
        journal: journal.filter(e => set.has(e.day)).length,
        spend: txs.filter(t => t.type === 'expense' && set.has(t.day))
          .reduce((a, t) => a + t.amount, 0),
      };
    },
    /* The last n weeks, oldest first, each with its own derived figures. */
    weekSeries(n) {
      const todayK = todayKey();
      const thisWeek = this.weekStart(new Date());
      const base = new Date(thisWeek + 'T12:00:00');
      const weeks = [];
      for (let i = n - 1; i >= 0; i--) {
        const start = dayKey(shiftDays(base, -i * 7));
        const startDate = new Date(start + 'T12:00:00');
        /* Only days that have actually happened count towards the week — a week
           in progress is not a week that failed. */
        const days = [];
        for (let d = 0; d < 7; d++) {
          const k = dayKey(shiftDays(startDate, d));
          if (k > todayK) break;
          days.push(k);
        }
        weeks.push({
          key: start, start, end: dayKey(shiftDays(startDate, 6)), days,
          label: this.weekLabel(start), isCurrent: start === thisWeek,
          ...this.periodFigures(days),
        });
      }
      return weeks;
    },
    /* Focus minutes by weekday over a window — the shape of the week.
       An explicit 0 means an empty window; only a missing argument defaults. */
    focusWeekday(days) {
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const range = this.focusRange(typeof days === 'number' ? days : 28);
      const rows = labels.map((label, i) => ({ dow: i, label, minutes: 0, seen: 0, active: 0, avg: 0 }));
      range.forEach(d => {
        const r = rows[d.dow];
        r.seen++;
        r.minutes += d.minutes;
        if (d.minutes > 0) r.active++;
      });
      rows.forEach(r => { r.avg = r.seen ? Math.round(r.minutes / r.seen) : 0; });
      return rows;
    },
    /* A contribution grid: one column per week, seven cells per column, shaded by
       how much happened that day. The same 0–4 scale the habit heatmap uses. */
    activityHeat(weeks) {
      const counts = {};
      (State.activity || []).forEach(a => {
        const k = this.activityDay(a);
        counts[k] = (counts[k] || 0) + 1;
      });
      const thisWeek = this.weekStart(new Date());
      const base = new Date(thisWeek + 'T12:00:00');
      const todayK = todayKey();
      const keys = Object.keys(counts);
      const max = keys.length ? keys.reduce((m, k) => Math.max(m, counts[k]), 1) : 1;
      const cols = [];
      for (let i = weeks - 1; i >= 0; i--) {
        const start = dayKey(shiftDays(base, -i * 7));
        const startDate = new Date(start + 'T12:00:00');
        const cells = [];
        for (let d = 0; d < 7; d++) {
          const k = dayKey(shiftDays(startDate, d));
          const n = counts[k] || 0;
          cells.push({
            key: k, n, future: k > todayK,
            level: (k > todayK || !n) ? 0 : Math.min(4, Math.ceil(n / max * 4)),
          });
        }
        cols.push({ start, cells });
      }
      return { cols, max, total: keys.reduce((a, k) => a + counts[k], 0) };
    },
    /* The only shape the Analytics UI reads. */
    analyticsList() {
      const now = new Date();
      const weeks = this.weekSeries(9);
      const cur = weeks[weeks.length - 1] || null;
      const prev = weeks.length > 1 ? weeks[weeks.length - 2] : null;
      /* A week still in progress is compared with the SAME days of the previous
         week, never with a full seven — otherwise every Monday reads as a
         collapse in every metric. */
      const prevToDate = (cur && prev)
        ? this.periodFigures(prev.days.slice(0, cur.dayCount))
        : null;
      const tasks = State.tasks || [];
      const habit = this.habitSummary();
      const focusDays = this.focusRange(30);
      const focus30 = focusDays.reduce((a, d) => a + d.minutes, 0);
      const journal = this.journalRange(30);
      const mean = key => {
        const vals = journal.map(d => d[key]).filter(v => v != null);
        return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
      };
      const bestFocus = focusDays.reduce((a, d) => (d.minutes > a.minutes ? d : a),
        focusDays[0] || { key: null, minutes: 0 });
      return {
        weeks, current: cur, previous: prev, previousToDate: prevToDate,
        deltas: (cur && prevToDate) ? {
          tasksDone: cur.tasksDone - prevToDate.tasksDone,
          focusMin: cur.focusMin - prevToDate.focusMin,
          habitRate: cur.habitRate - prevToDate.habitRate,
          activity: cur.activity - prevToDate.activity,
          spend: cur.spend - prevToDate.spend,
        } : null,
        tasks: { done: tasks.filter(t => t.done).length, total: tasks.length },
        focus: {
          days: focusDays, total30: focus30,
          active: focusDays.filter(d => d.minutes > 0).length,
          avg: focusDays.length ? Math.round(focus30 / focusDays.length) : 0,
          best: bestFocus,
          weekday: this.focusWeekday(28),
          streak: this.focusStreak(),
          byProject: this.focusByProject().slice(0, 5),
          target: this.focusTarget(),
        },
        habits: {
          rows: habit.habits,
          weekRate: habit.weekRate,
          bestStreak: habit.bestStreak,
          active: habit.active,
          rate30: habit.habits.length
            ? habit.habits.reduce((a, h) => a + h.rate30, 0) / (habit.habits.length * 30) : 0,
        },
        money: {
          month: this.financeMonth(now.getFullYear(), now.getMonth()),
          trend: this.financeTrend(6),
          budgets: this.financeBudgets(now.getFullYear(), now.getMonth()),
        },
        journal: {
          days: journal,
          entries: journal.filter(d => d.entry).length,
          rated: journal.filter(d => d.mood != null).length,
          mood: mean('mood'), energy: mean('energy'), productivity: mean('productivity'),
          words: journal.reduce((a, d) => a + (d.entry ? this.journalWordCount(d.entry) : 0), 0),
        },
        score: this.nexusScore(),
        heat: this.activityHeat(12),
      };
    },

    /* --- Reviews (Milestone 32) ------------------------------------------
       A review stores the period and the user's words. Everything shown beside it
       — the range it covers, the figures, the coverage — is derived, and the
       figures come from `periodFigures`, the same fold Analytics uses, so a review
       and the Analytics page can never disagree about the same week. */
    /* The real extent of a period, and the days of it that have happened. Accepts
       a review record or a plain `{ kind, start }`, so the composer can ask about
       a period that has no review yet. */
    reviewPeriod(r) {
      if (!r) return null;
      const kind = reviewKind(r.kind);
      const start = r.start;
      const d = new Date(start + 'T12:00:00');
      const todayK = todayKey();
      const days = [];
      if (r.kind === 'month') {
        const y = d.getFullYear(), m = d.getMonth();
        const last = new Date(y, m + 1, 0).getDate();
        for (let i = 1; i <= last; i++) {
          const k = dayKey(new Date(y, m, i, 12));
          if (k > todayK) break;
          days.push(k);
        }
      } else {
        for (let i = 0; i < 7; i++) {
          const k = dayKey(shiftDays(d, i));
          if (k > todayK) break;
          days.push(k);
        }
      }
      const end = r.kind === 'month'
        ? dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))
        : dayKey(shiftDays(d, 6));
      return {
        kind: r.kind, meta: kind, start, end, days, elapsed: days.length,
        label: r.kind === 'month'
          ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
          : this.weekLabel(start),
        short: r.kind === 'month'
          ? `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
          : this.shortDay(start),
        isCurrent: start === reviewStart(r.kind, new Date()),
      };
    },
    /* The figures for a review's period — the SAME fold Analytics uses. */
    reviewFigures(r) {
      const p = this.reviewPeriod(r);
      return p ? this.periodFigures(p.days) : null;
    },
    /* A review counts only once the user has actually said something. */
    reviewMeaningful(r) {
      return !!(r && (String(r.body || '').trim() || r.rating != null));
    },
    reviewWords(r) {
      const t = String((r && r.body) || '').trim();
      return t ? t.split(/\s+/).filter(Boolean).length : 0;
    },
    reviewExcerpt(r, max) {
      const t = String((r && r.body) || '').replace(/\s+/g, ' ').trim();
      const n = max || 150;
      return t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') + '…' : t;
    },
    reviewSorted() {
      return [...(State.reviews || [])].sort((a, b) =>
        (a.start < b.start ? 1 : a.start > b.start ? -1 : 0)
        || (a.kind < b.kind ? 1 : a.kind > b.kind ? -1 : 0));
    },
    /* Every period of a cadence from the first review to now. A period with no
       review is one the user skipped, and the count says so rather than hiding it.
       Only a review the user actually wrote counts as written. */
    reviewCoverage(kind) {
      const currentStart = reviewStart(kind, new Date());
      const mine = (State.reviews || []).filter(r => r.kind === kind && this.reviewMeaningful(r));
      const oldest = mine.reduce((a, r) => (!a || r.start < a ? r.start : a), null);
      if (!oldest) return { kind, total: 0, written: 0, missed: [], periods: [] };
      const periods = [];
      const stop = new Date(oldest + 'T12:00:00');
      const d = new Date(currentStart + 'T12:00:00');
      let guard = 0;
      while (d >= stop && guard++ < 600) {
        periods.push(dayKey(d));
        if (kind === 'month') d.setMonth(d.getMonth() - 1);
        else d.setDate(d.getDate() - 7);
      }
      const has = new Set(mine.map(r => r.start));
      const missed = periods.filter(p => !has.has(p));
      return { kind, total: periods.length, written: periods.length - missed.length, missed, periods };
    },
    reviewStats() {
      const all = State.reviews || [];
      const rated = all.filter(r => r.rating != null);
      const best = rated.reduce((a, r) => (!a || r.rating > a.rating ? r : a), null);
      return {
        total: all.length,
        written: all.filter(r => this.reviewMeaningful(r)).length,
        weeks: all.filter(r => r.kind === 'week' && this.reviewMeaningful(r)).length,
        months: all.filter(r => r.kind === 'month' && this.reviewMeaningful(r)).length,
        rated: rated.length,
        avgRating: rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : null,
        best,
        words: all.reduce((a, r) => a + this.reviewWords(r), 0),
        weekCoverage: this.reviewCoverage('week'),
        monthCoverage: this.reviewCoverage('month'),
        firstStart: all.reduce((a, r) => (!a || r.start < a ? r.start : a), null),
      };
    },
    /* The only shape the Reviews UI reads. The list carries only the reviews the
       user actually wrote — a period they opened and left blank is not a review. */
    reviewList() {
      const stats = this.reviewStats();
      return {
        reviews: this.reviewSorted().filter(r => this.reviewMeaningful(r)),
        stats,
        empty: stats.written === 0,
      };
    },

    /* --- Time Machine (Milestone 33) -------------------------------------
       The workspace as of a chosen day. Every figure is a fold over records that
       carry a real date, CUT at that day: a record counts as "then" only if its
       own date is on or before the day being viewed. Nothing is stored, and
       nothing is projected forward — a day the workspace has no record for is
       shown as empty rather than guessed at. */
    /* Every day the workspace has a record for, first to today. */
    timeWindow() {
      const today = todayKey();
      const stamps = [];
      (State.tasks || []).forEach(t => { if (t.createdAt) stamps.push(dayKey(new Date(t.createdAt))); });
      (State.focus || []).forEach(s => { if (s.day) stamps.push(s.day); });
      (State.transactions || []).forEach(t => { if (t.day) stamps.push(t.day); });
      (State.journal || []).forEach(e => { if (e.day) stamps.push(e.day); });
      (State.activity || []).forEach(a => stamps.push(this.activityDay(a)));
      (State.files || []).forEach(f => { if (f.createdAt) stamps.push(dayKey(new Date(f.createdAt))); });
      (State.reviews || []).forEach(r => { if (r.start) stamps.push(r.start); });
      const first = stamps.length ? stamps.reduce((a, b) => (a < b ? a : b)) : today;
      return { first, today, span: this.timeDays(first, today).length };
    },
    timeDays(from, to) {
      const out = [];
      const d = new Date(from + 'T12:00:00');
      const stop = new Date(to + 'T12:00:00');
      let guard = 0;
      while (d <= stop && guard++ < 4000) { out.push(dayKey(d)); d.setDate(d.getDate() + 1); }
      return out;
    },
    timeAsOf(day) {
      const key = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : todayKey();
      const by = k => !!k && k <= key;
      const tasks = State.tasks || [];
      const doneBy = tasks.filter(t => t.done && t.completedAt && by(dayKey(new Date(t.completedAt))));
      const existed = tasks.filter(t => !t.createdAt || by(dayKey(new Date(t.createdAt))));
      const focusRows = (State.focus || []).filter(s => s.mode !== 'break' && by(s.day));
      const txs = (State.transactions || []).filter(t => by(t.day));
      const income = txs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const spent = txs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
      return {
        day: key,
        tasksDone: doneBy.length,
        tasksKnown: existed.length,
        tasksOpen: existed.length - doneBy.length,
        focusMin: focusRows.reduce((a, s) => a + (s.minutes || 0), 0),
        sessions: focusRows.length,
        checkins: (State.habits || []).reduce((a, h) =>
          a + (h.history || []).filter(k => by(k)).length, 0),
        income, spent, net: income - spent,
        journal: (State.journal || []).filter(e => this.journalMeaningful(e) && by(e.day)).length,
        files: (State.files || []).filter(f => by(dayKey(new Date(f.createdAt)))).length,
        activity: (State.activity || []).filter(a => by(this.activityDay(a))).length,
        reviews: (State.reviews || []).filter(r => this.reviewMeaningful(r) && by(r.start)).length,
      };
    },
    /* What a single day actually holds. */
    timeDay(day) {
      const key = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : todayKey();
      const entries = (State.activity || []).filter(a => this.activityDay(a) === key)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      const done = (State.tasks || []).filter(t => t.done && t.completedAt
        && dayKey(new Date(t.completedAt)) === key);
      const focusRows = (State.focus || []).filter(s => s.mode !== 'break' && s.day === key);
      const txs = (State.transactions || []).filter(t => t.day === key);
      const spent = txs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
      const earned = txs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const focusMin = focusRows.reduce((a, s) => a + (s.minutes || 0), 0);
      return {
        day: key, label: this.longDay(key), short: this.shortDay(key),
        entries, done, focusMin, spent, earned,
        quiet: !entries.length && !done.length && !focusRows.length && !txs.length,
      };
    },
    /* The only shape the Time Machine reads. */
    timeMachine(day) {
      const win = this.timeWindow();
      const key = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : win.today;
      const days = this.timeDays(win.first, win.today);
      const idx = days.indexOf(key);
      const asOf = this.timeAsOf(key);
      const now = this.timeAsOf(win.today);
      return {
        window: win, day: key, days, index: idx,
        isFirst: idx <= 0, isLast: key >= win.today,
        asOf, now,
        dayDetail: this.timeDay(key),
        since: {
          days: idx >= 0 ? days.length - 1 - idx : 0,
          tasksDone: now.tasksDone - asOf.tasksDone,
          focusMin: now.focusMin - asOf.focusMin,
          checkins: now.checkins - asOf.checkins,
          spent: now.spent - asOf.spent,
          net: now.net - asOf.net,
          activity: now.activity - asOf.activity,
        },
      };
    },
  };

  /* --- SHELL ------------------------------------------------------------- */
  const Shell = {
    renderNav() {
      const nav = $('#sideNav');
      nav.innerHTML = NAV.map(group => `
        <div class="nav-group">
          <div class="nav-label">${group.label}</div>
          ${group.items.map(it => `
            <button class="nav-item ${it.pro ? 'tip' : ''}" data-route="${it.route}"
              ${it.pro ? `data-tip="${it.label} · Pro"` : ''}
              aria-label="${it.label}">
              <span class="nav-ic">${icon(it.icon)}</span>
              <span class="nav-txt">${it.label}</span>
              ${it.pro ? '<span class="nav-pro">PRO</span>' : ''}
            </button>`).join('')}
        </div>`).join('');

      $('#bottomNav').innerHTML = MOBILE_NAV.map(it => `
        <button class="bn-item" data-route="${it.route}" aria-label="${it.label}">
          <span class="bn-ic">${icon(it.icon, 20)}</span>
          <span>${it.label}</span>
        </button>`).join('');

      $$('.nav-item[data-route], .bn-item[data-route]').forEach(btn => {
        btn.addEventListener('click', () => {
          Router.go(btn.dataset.route);
          Shell.closeDrawer();
        });
      });
    },

    openDrawer() {
      $('#sidebar').classList.add('is-open');
      if (!$('.backdrop')) {
        const bd = el('div', { class: 'backdrop' });
        bd.addEventListener('click', () => Shell.closeDrawer());
        document.body.append(bd);
      }
    },
    closeDrawer() {
      $('#sidebar').classList.remove('is-open');
      const bd = $('.backdrop'); if (bd) bd.remove();
    },

    bindControls() {
      $('#navToggle').addEventListener('click', () => Shell.openDrawer());
      $('#searchTrigger').addEventListener('click', () => Palette.show());
      $('#searchTrigger').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Palette.show(); }
      });
      $('#notifBtn').addEventListener('click', () => Notifications.open());
      $('#themeBtn').addEventListener('click', () => Shell.openThemePicker());
      /* This used to toast "arrives in a later milestone" — a visible control that
         went nowhere. M38 built the page it was promising. */
      $('#profileBtn').addEventListener('click', () => Router.go('settings'));
      /* The workspace switcher is a Pro touchpoint, and before M46 it was a dead
         end: it asserted "Multiple workspaces are a NEXUS Pro feature" and then
         there was nowhere to go, because no pricing page existed to go to. Now
         the sentence has a place to land — the panel shows what a workspace is,
         what the one unlocked workspace holds, and the single control that opens
         pricing. */
      $('#wsSwitch').addEventListener('click', () => Shell.openWorkspacePanel());
    },

    /* The workspace panel. This is a VIEW of the entitlement plus the one
       workspace that exists — the demo has exactly one, so the honest panel shows
       one real workspace (with its live record counts) and the locked slots that
       Pro would fill, rather than a list of fictional ones. */
    openWorkspacePanel() {
      const pro = State.isPro;
      /* The workspace's description is the SAME summary the export screen and the
         reset dialog read — one answer to "how much is in here", so the panel
         cannot claim a different total from the export beside it. */
      const s = Derive.workspaceSummary();
      const bits = s.kinds.slice(0, 3).map(k => `${k.count} ${k.label.toLowerCase()}`);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div><div class="t-eyebrow">Workspaces</div>
            <h2 class="t-h2" style="margin-top:6px">Switch workspace</h2></div>
          <button class="iconbtn" data-close aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="t-sm t-muted">A workspace is a separate set of records on this device — its own
          tasks, notes, projects and log. Useful for keeping work and home apart.</p>
        <div class="ws-list" style="margin-top:var(--sp-4)">
          <button class="ws-row is-active" data-close>
            <span class="ws-mark">P</span>
            <span class="ws-row-meta"><b>Personal</b><small>${esc(bits.join(' · '))}</small></span>
            <span class="ws-row-state">${icon('check', 14)} Active</span>
          </button>
          ${pro
            ? `<div class="ws-add">
                <span class="ws-mark ws-mark-add">${icon('plus', 13)}</span>
                <span class="ws-row-meta"><b>New workspace</b>
                  <small>Not built in this demo — a second workspace would need its own store.</small></span>
              </div>`
            : `<div class="ws-row is-locked">
                <span class="ws-mark ws-mark-lock">${icon('layers', 13)}</span>
                <span class="ws-row-meta"><b>Add a workspace</b>
                  <small>Keep work, home or a side project in its own space.</small></span>
                <span class="badge badge-pro">✦ PRO</span>
              </div>`}
        </div>
        ${pro ? '' : `<div class="ws-cta" style="margin-top:var(--sp-5)">
          <div><b>Multiple workspaces are part of NEXUS Pro.</b>
            <p>One price, and the whole workspace gains Time Machine, Automation, Templates and the premium themes with it.</p></div>
          <button class="btn btn-primary btn-sm" data-ws-pro>
            ${icon('sparkles', 13)} See pricing</button>
        </div>`}
      `);
      wrap.addEventListener('click', ev => {
        if (ev.target.closest('[data-close]')) return Overlay.close();
        if (ev.target.closest('[data-ws-pro]')) {
          Overlay.close();
          Router.go('pro');
        }
      });
    },

    openThemePicker() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Appearance</div>
            <h2 class="t-h2" style="margin-top:6px">Choose a theme</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="t-sm t-muted">Core themes are free. Premium themes unlock with NEXUS Pro.</p>
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px" id="themeGrid"></div>
      `);
      const grid = $('#themeGrid', wrap);
      grid.innerHTML = Object.entries(THEMES).map(([k, t]) => `
        <button class="card card-interactive" data-theme-pick="${k}"
          style="padding:14px;text-align:left;${document.documentElement.dataset.theme === k ? 'border-color:var(--accent)' : ''}">
          <div class="row-between">
            <b class="t-sm">${t.label}</b>
            ${t.pro ? '<span class="badge badge-pro">✦ PRO</span>' : '<span class="badge">FREE</span>'}
          </div>
          <div class="row gap-1" style="margin-top:12px">
            ${['--bg-deep','--surface-2','--accent','--violet','--cyan','--magenta']
              .map(v => `<span style="width:18px;height:18px;border-radius:6px;border:1px solid var(--line-2);background:var(--${v.replace('--','')})"></span>`).join('')}
          </div>
        </button>`).join('');

      wrap.addEventListener('click', e => {
        if (e.target.closest('[data-close]')) return Overlay.close();
        const pick = e.target.closest('[data-theme-pick]');
        if (!pick) return;
        const key = pick.dataset.themePick;
        /* A Pro theme goes through the same one gate as every other feature. */
        if (THEMES[key].pro && !FeatureAccess.allows('themes')) {
          Overlay.close();
          FeatureAccess.request('themes');
          return;
        }
        Theme.apply(key);
        Overlay.close();
      });
    },

    /* The plan is DERIVED from the entitlement, so every surface that shows it
       re-reads `State.planLabel` instead of carrying its own copy. The two
       sidebar chips used to be static markup — "Free plan" and "NEXUS Free" —
       with no writer at all, so activating Pro unlocked the page but left the
       sidebar still claiming Free. `entitlement:change` had no subscriber. */
    syncPlan() {
      if (!State.data) return;
      const pro = State.isPro;
      const label = $('#profilePlan'), chip = $('#wsPlan');
      if (label) label.textContent = State.planLabel;
      if (chip) chip.textContent = pro ? `${planMeta(State.billing).label} · ${planMeta(State.billing).cadence || 'plan'}` : 'Free plan';
      /* The profile line is the one place the BILLING PERIOD belongs — `wsPlan`
         says which tier, this says what it costs, and neither guesses at the
         other. A Pro licence with no recorded period reads as monthly, which is
         what `State.billing` already resolves and what `normalizeEntitlement`
         writes back on load. */
      if (label) label.classList.toggle('is-pro', pro);
      /* The header's upgrade button is shown by the same fact that colours the
         chips, so the two can never disagree about whether Pro is active. */
    },

    /* The profile chip's name is a view of `State.user.name`, never a copy of it.
       It shipped as static markup — `<b id="profileName">Alex</b>` — with no
       writer at all, which was invisible only while the name could not be
       changed. Milestone 38 made it editable and the chip immediately began
       lying: the greeting said "Priya" while the sidebar still said "Alex". The
       exact defect documented above for the plan chips. */
    syncUserName() {
      if (!State.data) return;
      const name = State.user.name || '';
      const el = $('#profileName');
      if (el) el.textContent = name;
      /* The initial is DERIVED from the name, so it cannot drift from it. The
         avatar shipped as a hardcoded "A" sitting next to a hardcoded "Alex" —
         two copies of one fact, both wrong the moment the name changed. */
      const av = $('#profileAv');
      if (av) av.textContent = (name.charAt(0) || '?').toUpperCase();
    },

    /* The bell badge is a VIEW of the derived alert list, never a stored count —
       the same rule `syncPlan()` follows. Recomputed on the shared state signal
       so it follows every mutation, including one made from inside the panel. */
    syncNotifications() {
      const btn = $('#notifBtn');
      if (!btn || !State.data) return;
      const n = Derive.notificationView('all').unread;
      const badge = $('#notifBadge', btn);
      if (badge) {
        badge.textContent = n > 9 ? '9+' : String(n);
        badge.hidden = n === 0;
      }
      /* The count is also the label, so a screen reader is told the number
         rather than just "Notifications". */
      btn.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
    },

    setHeader(title, crumb) {
      $('#headerTitle').textContent = title;
      $('#headerCrumb').textContent = crumb;
    },
  };

  /* ======================================================================
     COMMAND PALETTE — Milestone 13
     Ctrl+K / Cmd+K. Searches real stored data and runs real commands.
     Full keyboard control: ↑ ↓ to move, Enter to run, Esc to close, Tab wraps.
     ====================================================================== */
  const Palette = {
    open: false,
    items: [],        // flattened, selectable rows
    active: 0,

    /* Fuzzy subsequence match — returns a score, or -1 for no match.
       Consecutive matches and word-start matches score higher, so
       "fin" ranks "Finish dashboard UI" above "Refactor score engine". */
    fuzzy(needle, hay) {
      if (!needle) return 0;
      const n = needle.toLowerCase(), h = hay.toLowerCase();
      let hi = 0, score = 0, streak = 0;
      for (let i = 0; i < n.length; i++) {
        const c = n[i];
        const found = h.indexOf(c, hi);
        if (found === -1) return -1;
        // Bonus for adjacency and for matching at a word boundary.
        if (found === hi) streak++; else streak = 0;
        score += 10 + streak * 6;
        if (found === 0 || /[\s\-_/]/.test(h[found - 1])) score += 8;
        hi = found + 1;
      }
      // Prefer shorter haystacks when scores tie.
      return score - Math.min(h.length * 0.4, 24);
    },

    /* Build the full command + entity list from live state. */
    build() {
      const cmds = [];

      // --- Actions -------------------------------------------------------
      const actions = [
        { label: 'Create task',      icon: 'plus',   hint: 'Action', run: () => Dashboard.openAddTask() },
        { label: 'Create note',      icon: 'note',   hint: 'Action', run: () => {
            Router.go('notes');
            setTimeout(() => NotesPage.createNote(), 60);
          } },
        { label: 'Create project',   icon: 'layers', hint: 'Action', run: () => {
            Router.go('projects');
            setTimeout(() => ProjectsPage.openNew(), 60);
          } },
        { label: 'Create goal',      icon: 'target', hint: 'Action', run: () => {
            Router.go('goals');
            setTimeout(() => GoalsPage.openNew(), 60);
          } },
        { label: 'Write a journal entry', icon: 'book', hint: 'Action', run: () => Router.go('journal') },
        { label: 'Capture to inbox', icon: 'inbox', hint: 'Action', run: () => Router.go('inbox') },
        { label: 'Start focus session', icon: 'focus', hint: 'Action', run: () => {
            Router.go('focus');
            setTimeout(() => { if (!Focus.running) Focus.start(); }, 60);
          } },
        { label: 'Add expense',      icon: 'wallet', hint: 'Action', run: () => {
            Router.go('finance');
            setTimeout(() => FinancePage.openNew('expense'), 60);
          } },
        { label: 'Add income',       icon: 'wallet', hint: 'Action', run: () => {
            Router.go('finance');
            setTimeout(() => FinancePage.openNew('income'), 60);
          } },
        { label: 'Open calendar',    icon: 'calendar', hint: 'Navigate', run: () => Router.go('calendar') },
        { label: 'Open settings',    icon: 'settings', hint: 'Navigate', run: () => Router.go('settings') },
        { label: 'Search everything', icon: 'search', hint: 'Action', run: () => Router.go('search') },
        { label: 'Write a weekly review', icon: 'star', hint: 'Action', run: () => Router.go('reviews', { kind: 'week' }) },
        { label: 'Write a monthly review', icon: 'star', hint: 'Action', run: () => Router.go('reviews', { kind: 'month' }) },
      ];
      actions.forEach(a => cmds.push({ ...a, group: a.hint === 'Navigate' ? 'Navigate' : 'Actions' }));

      // --- Navigate to every module --------------------------------------
      NAV.flatMap(g => g.items).forEach(it => {
        cmds.push({
          label: `Go to ${it.label}`, icon: it.icon, group: 'Navigate',
          hint: it.pro ? 'Pro' : '', pro: !!it.pro,
          run: () => Router.go(it.route),
        });
      });

      // --- Real entities from State --------------------------------------
      State.tasks.forEach(t => cmds.push({
        label: t.title, group: 'Tasks', icon: 'check',
        hint: t.done ? 'Done' : Derive.dueLabel(t.due), entity: t,
        run: () => revealRecord('task', t.id),
      }));
      State.projects.forEach(p => {
        const st = Derive.projectStats(p.name);
        cmds.push({
          label: p.name, group: 'Projects', icon: 'layers',
          hint: st.progress + '%', run: () => revealRecord('project', p.id),
        });
      });
      Derive.allGoals().forEach(g => cmds.push({
        label: g.name, group: 'Goals', icon: 'target',
        hint: g.total ? g.progress + '%' : 'No work linked',
        run: () => revealRecord('goal', g.id),
      }));
      Derive.habitSummary().habits.forEach(h => cmds.push({
        label: h.name, group: 'Habits', icon: h.icon,
        hint: h.streak ? `${h.streak}d streak` : (h.doneToday ? 'Done today' : 'Not done today'),
        run: () => Router.go('habits'),
      }));
      State.upcoming.forEach(u => cmds.push({
        label: u.title, group: 'Upcoming', icon: 'calendar',
        hint: u.time.split('–')[0].trim(), run: () => Router.go('calendar'),
      }));
      State.notes.forEach(n => cmds.push({
        label: n.title, group: 'Notes', icon: 'note',
        hint: Derive.relTime(n.updatedAt),
        run: () => revealRecord('note', n.id),
      }));
      Derive.journalSorted().forEach(e => cmds.push({
        label: e.title || JournalPage._longDay(e.day),
        group: 'Journal', icon: 'book',
        hint: JournalPage._relDay(e.day),
        run: () => revealRecord('journal', e.id),
      }));
      State.inbox.forEach(it => cmds.push({
        label: it.text.slice(0, 70), group: 'Inbox', icon: 'inbox',
        hint: it.status === 'processed' ? 'Moved'
          : ((INBOX_KINDS.find(k => k.key === it.kind) || {}).label || 'Captured'),
        run: () => {
          Router.go('inbox');
          setTimeout(() => InboxPage.searchFor(it.text.slice(0, 40)), 60);
        },
      }));
      State.transactions.forEach(t => cmds.push({
        label: t.label, group: 'Finance', icon: 'wallet',
        hint: `${t.category} · ${t.type === 'income' ? '+' : '−'}${Derive.money(t.amount)}`,
        run: () => {
          Router.go('finance');
          setTimeout(() => FinancePage.openEdit(t.id), 60);
        },
      }));
      State.files.forEach(f => {
        const fm = Derive.fileMeta(f);
        cmds.push({
          label: f.name, group: 'Files', icon: fileKindMeta(fm.kind).icon,
          hint: `${fm.sizeLabel} · ${fileKindMeta(fm.kind).label}`,
          run: () => revealRecord('file', f.id),
        });
      });
      return cmds;
    },

    /* Rank + filter. Empty query shows the curated default list. */
    query(q) {
      const all = this.all || (this.all = this.build());
      if (!q.trim()) {
        // Default view: actions first, then a taste of each entity group.
        const order = { Actions: 0, Navigate: 1, Tasks: 2, Projects: 3, Goals: 4, Habits: 5, Upcoming: 6 };
        return all
          .filter(i => i.group === 'Actions')
          .concat(all.filter(i => i.group === 'Navigate').slice(0, 4))
          .slice(0, 9);
      }
      const ranked = all
        .map(i => ({ i, s: this.fuzzy(q, i.label + ' ' + i.group) }))
        .filter(x => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 20)
        .map(x => x.i);

      /* Always offer the full search first, so a query that matches nothing in
         the palette is a way forward rather than a dead end. The palette jumps
         to a record; the Search page looks through everything. */
      const term = q.trim();
      ranked.unshift({
        label: `Search everything for “${term}”`, icon: 'search', group: 'Search',
        hint: 'Search', run: () => Router.go('search', { q: term }),
      });
      return ranked;
    },

    render(q = '') {
      const list = this.query(q);
      this.items = list;
      this.active = 0;
      const box = $('#palResults');
      if (!box) return;

      if (!list.length) {
        box.innerHTML = `<div class="empty" style="min-height:150px">
          <div class="empty-ic">${icon('search', 20)}</div>
          <h4>No results for “${esc(q)}”</h4>
          <p>Try a task, project, goal, habit or command name.</p>
        </div>`;
        return;
      }

      let html = '', lastGroup = null;
      list.forEach((it, i) => {
        if (it.group !== lastGroup) {
          html += `<div class="pal-group">${it.group}</div>`;
          lastGroup = it.group;
        }
        html += `
          <button class="pal-item ${i === 0 ? 'is-active' : ''}" data-pal-index="${i}" role="option">
            <span class="pal-ic">${icon(it.icon, 14)}</span>
            <span class="t-truncate">${esc(it.label)}</span>
            ${it.hint ? `<span class="pal-meta">${esc(it.hint)}</span>` : ''}
          </button>`;
      });
      box.innerHTML = html;
    },

    move(delta) {
      if (!this.items.length) return;
      this.active = (this.active + delta + this.items.length) % this.items.length;
      $$('.pal-item', $('#palResults')).forEach((n, i) =>
        n.classList.toggle('is-active', i === this.active));
      const cur = $(`.pal-item[data-pal-index="${this.active}"]`);
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    },

    run(i = this.active) {
      const item = this.items[i];
      if (!item) return;
      this.close();
      // Let the close animation frame settle before the action mutates the DOM.
      setTimeout(() => item.run(), 0);
    },

    close() {
      this.open = false;
      this.all = null;
      Overlay.close();
    },

    show() {
      this.open = true;
      this.all = null;

      const wrap = Overlay.root;
      wrap.innerHTML = `
        <div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <div class="palette-box">
            <div class="palette-input">
              <span style="color:var(--text-3);display:flex">${icon('search', 18)}</span>
              <input id="palSearch" type="text" placeholder="Search NEXUS…"
                     autocomplete="off" spellcheck="false" aria-label="Search NEXUS"
                     role="combobox" aria-expanded="true" aria-controls="palResults">
              <kbd>Esc</kbd>
            </div>
            <div class="palette-list" id="palResults" role="listbox"></div>
            <div class="palette-foot">
              <span class="pf"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span class="pf"><kbd>↵</kbd> select</span>
              <span class="pf"><kbd>Esc</kbd> close</span>
            </div>
          </div>
        </div>`;

      const input = $('#palSearch');
      const pal = $('.palette');

      // Close on backdrop click.
      pal.addEventListener('mousedown', e => { if (e.target === pal) this.close(); });

      // Live filtered search (debounced for long lists).
      let tmr = null;
      input.addEventListener('input', () => {
        clearTimeout(tmr);
        const v = input.value;
        tmr = setTimeout(() => this.render(v), 45);
      });

      // Keyboard navigation.
      input.addEventListener('keydown', e => {
        switch (e.key) {
          case 'ArrowDown': e.preventDefault(); this.move(1); break;
          case 'ArrowUp':   e.preventDefault(); this.move(-1); break;
          case 'Tab':       e.preventDefault(); this.move(e.shiftKey ? -1 : 1); break;
          case 'Enter':     e.preventDefault(); this.run(); break;
          case 'Escape':    e.preventDefault(); this.close(); break;
          case 'Home':      e.preventDefault(); this.active = 0; this.move(0); break;
          case 'End':       e.preventDefault(); this.active = this.items.length - 1; this.move(0); break;
        }
      });

      // Mouse selection.
      $('#palResults').addEventListener('click', e => {
        const btn = e.target.closest('[data-pal-index]');
        if (btn) this.run(Number(btn.dataset.palIndex));
      });
      $('#palResults').addEventListener('mousemove', e => {
        const btn = e.target.closest('[data-pal-index]');
        if (!btn) return;
        const i = Number(btn.dataset.palIndex);
        if (i === this.active) return;
        this.active = i;
        $$('.pal-item').forEach((n, k) => n.classList.toggle('is-active', k === i));
      });

      this.render('');
      setTimeout(() => input.focus(), 30);
    },

    /* Global hotkey — registered once. */
    initHotkey() {
      document.addEventListener('keydown', e => {
        const k = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && k === 'k') {
          e.preventDefault();
          this.open ? this.close() : this.show();
          return;
        }
        // Esc also closes any open overlay (modals included) for consistency.
        if (e.key === 'Escape' && this.open) { e.preventDefault(); this.close(); }
      });
    },
  };

  /* ======================================================================
     NOTIFICATIONS PANEL — Milestone 36
     The surface behind the header bell. It renders `Derive.notificationView()`
     and NOTHING else: every count, every row and every filter chip comes from
     that one shape, so the panel cannot show an alert the derivation does not
     know about. Reading and dismissing are its only writes, and both go through
     State — which is why the bell badge follows without the panel telling it to.
     ====================================================================== */
  const Notifications = {
    filter: 'all',

    open() {
      const panel = Overlay.panel(this._html());
      this._bind(panel);
      return panel;
    },

    _html() {
      const v = Derive.notificationView(this.filter);
      return `
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">Workspace</div>
            <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
              <span class="nf-title">Notifications</span>
              ${v.unread ? `<span class="badge badge-bad badge-dot">${v.unread} unread</span>` : ''}
            </div>
            <div class="card-sub" style="margin-top:6px">${esc(this._summaryLine(v))}</div>
          </div>
          <button class="iconbtn" data-close aria-label="Close notifications">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          ${v.kinds.length > 1 ? `<div class="nf-tabs">${this._tabsHtml(v)}</div>` : ''}
          ${this._bodyHtml(v)}
        </div>

        <div class="panel-foot">
          <button class="btn btn-ghost btn-sm" data-nf-readall ${v.unread ? '' : 'disabled'}>
            ${icon('checkAll', 13)} Mark all read</button>
          <button class="btn btn-ghost btn-sm" data-nf-restore style="margin-left:auto"
            ${v.dismissed ? '' : 'disabled'}>
            ${icon('reset', 13)} ${v.dismissed ? `Restore ${v.dismissed} dismissed` : 'Restore dismissed'}</button>
        </div>`;
    },

    _summaryLine(v) {
      if (v.empty) return 'Nothing needs you right now.';
      const parts = [`${v.total} alert${v.total === 1 ? '' : 's'}`];
      if (v.unread) parts.push(`${v.unread} unread`);
      if (v.dismissed) parts.push(`${v.dismissed} dismissed`);
      return parts.join(' · ');
    },

    _tabsHtml(v) {
      const tab = (key, label, n) =>
        `<button class="chip ${v.filter === key ? 'is-on' : ''}" data-nf-filter="${esc(key)}">
           ${esc(label)}<span class="nf-count">${n}</span></button>`;
      return tab('all', 'All', v.total) + tab('unread', 'Unread', v.unread)
        + v.kinds.map(k => tab(k.key, k.label, v.counts[k.key])).join('');
    },

    _bodyHtml(v) {
      if (v.empty) return this._emptyHtml();
      if (!v.items.length) {
        return `<div class="empty" style="min-height:180px">
          <div class="empty-ic">${icon('check', 20)}</div>
          <h4>Nothing in this filter</h4>
          <p>Every alert of that kind has been dealt with.</p>
        </div>`;
      }
      /* Split by whether it still needs you. The first group is the whole point
         of a bell; a read alert is context, not a task. */
      const unread = v.items.filter(n => !State.notificationDecision(n.key).read);
      const read = v.items.filter(n => State.notificationDecision(n.key).read);
      let html = '';
      if (unread.length) {
        html += `<div class="p-label">Needs attention</div>`
          + unread.map(n => this._rowHtml(n, false)).join('');
      }
      if (read.length) {
        html += `<div class="p-label" style="margin-top:var(--sp-5)">Already seen</div>`
          + read.map(n => this._rowHtml(n, true)).join('');
      }
      return html;
    },

    _emptyHtml() {
      const v = Derive.notificationView('all');
      return `<div class="empty" style="min-height:240px">
        <div class="empty-ic">${icon('check', 22)}</div>
        <h4>Nothing needs you</h4>
        <p>No overdue task, no unlogged streak, no budget over target and nothing
           waiting in the queue. This stays empty until something is actually true.</p>
        <div class="nf-watch">Watching ${v.watching.map(w => esc(w)).join(' · ')}</div>
      </div>`;
    },

    _rowHtml(n, isRead) {
      return `
        <div class="nf-row ${isRead ? 'is-read' : ''}" data-nf-key="${esc(n.key)}">
          <button class="nf-main" data-nf-open="${esc(n.key)}">
            <span class="nf-ic" style="color:${n.color}">${icon(n.icon, 15)}</span>
            <span class="nf-text">
              <span class="nf-t">${esc(n.title)}</span>
              <span class="nf-d">${esc(n.detail)}</span>
            </span>
          </button>
          <button class="nf-x" data-nf-dismiss="${esc(n.key)}" aria-label="Dismiss alert">${icon('x', 13)}</button>
        </div>`;
    },

    _bind(panel) {
      if (!panel) return;
      panel.addEventListener('click', ev => {
        const f = ev.target.closest('[data-nf-filter]');
        if (f) { this.filter = f.dataset.nfFilter; this.refresh(); return; }

        const d = ev.target.closest('[data-nf-dismiss]');
        if (d) {
          const item = this._find(d.dataset.nfDismiss);
          State.dismissNotification(d.dataset.nfDismiss, item ? item.until : null);
          Toast.show('Alert dismissed', 'default');
          this.refresh();
          return;
        }

        const o = ev.target.closest('[data-nf-open]');
        if (o) { this._go(o.dataset.nfOpen); return; }

        if (ev.target.closest('[data-nf-readall]')) {
          const n = State.markAllNotificationsRead();
          Toast.show(n ? `Marked ${n} as read` : 'Nothing was unread', n ? 'good' : 'default');
          this.refresh();
          return;
        }

        if (ev.target.closest('[data-nf-restore]')) {
          const n = State.clearNotificationState();
          Toast.show(n ? `Restored ${n} alert${n === 1 ? '' : 's'}` : 'Nothing was hidden', 'default');
          this.refresh();
          return;
        }
      });
    },

    _find(key) { return Derive.notifications().find(n => n.key === key) || null; },

    /* Opening an alert marks it read and takes you to the record it is about —
       an alert you cannot act on is a decoration. */
    _go(key) {
      const n = this._find(key);
      if (!n) return;
      State.markNotificationRead(n.key, n.until);
      if (n.type && n.id) { revealRecord(n.type, n.id); return; }
      Overlay.close();
      Router.go(n.route);
    },

    refresh() {
      const panel = $('.panel');
      if (!panel) return;
      const body = $('.panel-body', panel);
      const scroll = body ? body.scrollTop : 0;
      panel.outerHTML = `<aside class="panel" role="dialog" aria-modal="true">${this._html()}</aside>`;
      const next = $('.panel');
      if (next) this._bind(next);
      const nb = next ? $('.panel-body', next) : null;
      if (nb) nb.scrollTop = scroll;
    },
  };

  /* ======================================================================
     WIDGETS — Milestones 5–12
     Reusable cards. Each reads from State and re-renders on state change.
     ====================================================================== */
  /* The dashboard's daily reminder, chosen by the calendar day rather than at
     random, so it holds still while you look at it and has moved on tomorrow. */
  const DAILY_LINES = [
    'Discipline today creates the freedom tomorrow.',
    'Small steps, taken daily, outrun the occasional sprint.',
    'You do not need more time. You need fewer open loops.',
    'Finish something today that you started yesterday.',
    'The work you avoid is usually the work that matters.',
    'A plan you can see beats a plan you remember.',
    'Progress is quieter than it looks from the inside.',
    'Start where you are, with what you have, today.',
  ];

  const Widgets = {

    /* Shared ring renderer */
    ring(pct, { size = 92, stroke = 7, label = '', sub = '', color = 'var(--accent)', id = '', grad = null } = {}) {
      const r = (size - stroke) / 2;
      const c = 2 * Math.PI * r;
      const off = c * (1 - clamp(pct, 0, 1));
      const gid = grad ? `ringGrad_${grad}` : null;
      const strokeVal = gid ? `url(#${gid})` : color;
      return `
        <div class="ring" style="width:${size}px;height:${size}px" ${id ? `id="${id}"` : ''}>
          <svg width="${size}" height="${size}">
            ${gid ? `<defs>
              <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
                ${grad === 'focus'
                  ? '<stop stop-color="#8B5CF6"/><stop offset=".6" stop-color="#6366F1"/><stop offset="1" stop-color="#06B6D4"/>'
                  : '<stop stop-color="#8B5CF6"/><stop offset="1" stop-color="#EC4899"/>'}
              </linearGradient>
            </defs>` : ''}
            <circle class="ring-track" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"/>
            <circle class="ring-val" cx="${size/2}" cy="${size/2}" r="${r}" stroke-width="${stroke}"
              stroke="${strokeVal}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
              style="--ring-c:${c.toFixed(1)};--ring-off:${off.toFixed(1)}"/>
          </svg>
          <div class="ring-center">
            <div>
              <div class="t-num" style="font-size:${Math.round(size*0.24)}px;font-weight:700">${label}</div>
              ${sub ? `<div class="t-faint" style="font-size:10px;margin-top:3px">${sub}</div>` : ''}
            </div>
          </div>
        </div>`;
    },

    /* --- Summary stat tiles (Milestone 5) -------------------------------- */
    statTile({ icon: ic, label, value, meta, accent = 'var(--accent)' }) {
      return `
        <div class="card stat-tile">
          <div class="row-between">
            <div class="t-eyebrow">${label}</div>
            <span class="stat-ic" style="color:${accent}">${icon(ic, 16)}</span>
          </div>
          <div class="t-display" style="margin-top:12px">${value}</div>
          <div class="card-sub" style="margin-top:6px">${meta}</div>
        </div>`;
    },

    /* The ONE place a card key becomes a card. `DASH_CARDS` says what exists and
       where it goes; this says how to draw it. A key with no renderer would be a
       table entry nobody can ever see, so the suite renders every key and asserts
       each one produces a card — the two lists must stay in step. */
    card(key) {
      switch (key) {
        case 'todaysfocus': return this.todaysFocus();
        case 'habits':      return this.habitTracker(Derive.habitSummary());
        case 'money':       return this.financeSnapshot();
        case 'journal':     return this.journalCard();
        case 'inbox':       return this.inboxCard();
        case 'activity':    return this.activityCard();
        case 'focus':       return this.focusCard();
        case 'upcoming':    return this.upcomingCard();
        case 'goals':       return this.goalCard();
        case 'score':       return this.scoreCard();
        case 'quote':       return this.quoteCard();
        default:            return '';
      }
    },

    /* --- Today's Focus (Milestone 6) ------------------------------------ */
    todaysFocus() {
      const items = Derive.todayFocusTasks(5);
      const s = Derive.taskSummary();
      const prioClass = p => p === 'High' ? 'prio-high' : p === 'Medium' ? 'prio-med' : 'prio-low';

      return `
        <section class="card" id="w-todaysfocus">
          <div class="card-head">
            <div>
              <div class="card-title">Today's Focus</div>
              <div class="card-sub">${s.todayTotal} tasks · ${s.todayDone} done</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-route="tasks">View all</button>
          </div>
          <div class="task-list">
            ${items.map(t => `
              <div class="task-row ${t.done ? 'is-done' : ''}" data-task="${t.id}">
                <button class="check ${t.done ? 'is-done' : ''}" data-toggle-task="${t.id}"
                  role="checkbox" aria-checked="${t.done}" aria-label="Complete ${esc(t.title)}">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </button>
                <div class="grow">
                  <div class="task-title">${esc(t.title)}</div>
                  <div class="task-meta">
                    <span class="task-project">${esc(t.project)}</span>
                  </div>
                </div>
                <div class="task-side">
                  <span class="badge ${t.priority === 'High' ? 'badge-bad' : t.priority === 'Medium' ? 'badge-warn' : ''}">${t.priority}</span>
                  <span class="task-due">${esc(Derive.dueLabel(t.due))}</span>
                </div>
              </div>`).join('')}
          </div>
          <button class="task-add" id="quickAddTask">
            <span class="task-add-ic">${icon('plus', 13)}</span>
            <span>Add task</span>
          </button>
        </section>`;
    },

    /* --- Focus Mode (Milestone 7, derived in Milestone 21) ---------------
       Every figure here comes from the session log via Derive.focusSummary(),
       so logging a block anywhere moves the ring, the hours, the month and the
       streak together. The ring itself is the live timer, driven by the engine. */
    focusCard() {
      const fs = Derive.focusSummary();
      return `
        <section class="card focus-card" id="w-focus">
          <div class="focus-bg" aria-hidden="true"></div>
          <div class="focus-inner">
            <div class="row-between">
              <div class="card-title">Focus Mode</div>
              <span class="badge badge-dot" style="color:var(--good)">${esc(Focus.label())}</span>
            </div>
            <div class="focus-center">
              ${this.ring(1, { size: 128, stroke: 8, label: clock(Focus.remaining), sub: 'remaining',
                grad: 'focus', id: 'focusRing', color: '#8B5CF6' })}
            </div>
            <div class="row gap-2" style="justify-content:center;margin-top:16px">
              <button class="btn btn-primary btn-sm" id="focusToggle" data-focus-toggle>
                ${Focus.running ? icon('pause', 13) + 'Pause' : icon('play', 13) + 'Start'}
              </button>
              <button class="iconbtn tip" data-tip="Reset timer" id="focusReset" aria-label="Reset timer">${icon('reset', 14)}</button>
            </div>
            <div class="focus-foot">
              <span>${fs.hoursToday}h today</span>
              <span class="dot-sep"></span>
              <span>${fs.hoursMonth}h this month</span>
              <span class="dot-sep"></span>
              <span>${fs.streak} day streak</span>
            </div>
            <button class="btn btn-ghost btn-sm btn-block" style="margin-top:14px" data-route="focus">
              Open Focus
            </button>
          </div>
        </section>`;
    },

    /* --- Habit Tracker (Milestone 8, derived in Milestone 20) ------------
       `ns` is Derive.habitSummary() — every streak and count here is computed
       from the real toggle history, not a stored counter. */
    habitTracker(ns) {
      const h = ns || Derive.habitSummary();
      const rows = h.habits.slice(0, 4);
      return `
        <section class="card" id="w-habits">
          <div class="card-head">
            <div>
              <div class="card-title">Habit Tracker</div>
              <div class="card-sub">${h.done} of ${h.total} complete today</div>
            </div>
            <div class="row gap-2" style="align-items:center">
              <span class="badge badge-dot" style="color:var(--good)">${Math.round(h.progress*100)}%</span>
              <button class="btn btn-sm btn-ghost" data-route="habits">Open</button>
            </div>
          </div>
          ${rows.length ? `<div class="habit-list">
            ${rows.map(hab => {
              const pct = clamp((hab.doneToday ? 1 : 0), 0, 1);
              return `
                <div class="habit-row">
                  <button class="habit-toggle ${hab.doneToday ? 'is-done' : ''}" data-toggle-habit="${hab.id}"
                    aria-pressed="${hab.doneToday}" aria-label="Toggle ${esc(hab.name)}">
                    ${icon(hab.icon, 13)}
                  </button>
                  <div class="grow">
                    <div class="row-between" style="gap:8px">
                      <span class="habit-name">${esc(hab.name)}</span>
                      <span class="habit-count t-num">${hab.streak}d</span>
                    </div>
                    <div class="bar bar-sm" style="margin-top:7px">
                      <div class="bar-fill ${hab.doneToday ? 'good' : ''}" style="width:${pct*100}%"></div>
                    </div>
                  </div>
                  <span class="habit-streak tip" data-tip="${hab.streak} day streak">
                    ${icon('flame', 12)}<span class="t-num">${hab.streak}</span>
                  </span>
                </div>`;
            }).join('')}
          </div>`
          : `<div class="empty" style="padding:var(--sp-5) 0">
               <div class="empty-ic">${icon('repeat', 18)}</div>
               <h4 style="font-size:var(--fs-sm)">No habits yet</h4>
              <p>Track something you want to do daily.</p>
             </div>`}
        </section>`;
    },

    /* --- Finance Snapshot (Milestone 9) --------------------------------- */
    financeSnapshot() {
      const f = Derive.financeSummary();
      /* The seven bars used to be a frozen array stored on the finance record —
         a number that could not be recomputed and never moved when a
         transaction was added. They are now the last seven real days. */
      const week = Derive.financeRange(7);
      const max = Math.max(...week.map(d => d.spend), 1);
      const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      return `
        <section class="card" id="w-finance">
          <div class="card-head">
            <div>
              <div class="card-title">Finance Snapshot</div>
              <div class="card-sub">${esc(f.monthLabel)} · this month</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-route="finance">Details</button>
          </div>
          <div class="fin-grid">
            <div>
              <div class="t-eyebrow">Income</div>
              <div class="fin-val" style="color:var(--good)">${Derive.money(f.income)}</div>
            </div>
            <div>
              <div class="t-eyebrow">Expenses</div>
              <div class="fin-val" style="color:var(--bad)">${Derive.money(f.expenses)}</div>
            </div>
          </div>
          <div class="row-between" style="margin-top:12px">
            <span class="t-eyebrow">Savings</span>
            <b class="t-num" style="font-size:15px">${Derive.money(f.savings)}</b>
          </div>
          <div class="bar" style="margin-top:8px">
            <div class="bar-fill good" style="width:${Math.round(clamp(f.savingsRate, 0, 1) * 100)}%"></div>
          </div>
          <div class="chart-bars alt" style="height:74px;margin-top:16px">
            ${week.map(d => `<div class="cb tip" data-tip="${esc(Derive.money(d.spend))} on ${esc(d.day)}">
              <i style="height:${Math.round((d.spend / max) * 100)}%"></i>
              <small>${dow[new Date(d.day + 'T12:00:00').getDay()]}</small></div>`).join('')}
          </div>
        </section>`;
    },

    /* --- Goal Progress (Milestone 10, derived in Milestone 18) ---------- */
    /* Shows the *focus goal* — the active goal closest to completion, which is
       the one worth showing on a dashboard. Falls back through active goals,
       then any goal, then nothing. All figures come from Derive.allGoals(). */
    goalCard() {
      const list = Derive.allGoals();
      const active = list.filter(g => g.status === 'Active');
      /* Prefer a goal that actually has work behind it (most advanced first) —
         a dashboard should lead with measurable progress. Only fall back to an
         unstarted goal when nothing is linked anywhere. */
      const withWork = (active.length ? active : list).filter(x => x.total > 0);
      const g = withWork.sort((a, b) => b.progress - a.progress)[0]
        || (active[0] || list[0]);
      if (!g) return '';

      /* Colour the badge by real health, not a stored string. */
      const badgeCls = g.overdue > 0 ? 'badge-warn'
        : g.progress >= 80 ? 'badge-good'
        : g.total === 0 ? 'badge' : '';

      const meta = g.total
        ? `${g.done} of ${g.total} task${g.total === 1 ? '' : 's'} complete`
        : 'No tasks linked yet';

      return `
        <section class="card" id="w-goal">
          <div class="card-head">
            <div class="card-title">Goal Progress</div>
            <span class="badge badge-dot ${badgeCls}">${esc(g.health)}</span>
          </div>
          <div class="row gap-4" style="align-items:center">
            ${this.ring(g.progress/100, { size: 84, stroke: 7, label: g.progress + '%', grad: 'goal' })}
            <div class="grow" style="min-width:0">
              <div style="font-size:15px;font-weight:600" class="t-truncate">${esc(g.name)}</div>
              <div class="card-sub" style="margin-top:5px">${esc(meta)}${g.deadline ? ' · due ' + esc(g.deadline) : ''}</div>
              <div class="bar bar-sm" style="margin-top:12px">
                <div class="bar-fill brand" style="width:${g.progress}%"></div>
              </div>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost btn-block" style="margin-top:14px" data-goal-open="${esc(g.id)}">View goal</button>
        </section>`;
    },

    /* --- NEXUS Score (Milestone 11, rebuilt in 34) ---------------------- */
    scoreCard() {
      const n = Derive.nexusScore();
      /* The sparkline draws the SAME derived history the delta is read from, so
         the two can never disagree. It may be short on a brand-new workspace. */
      const hist = n.history.map(x => x.score);
      const w = 200, h = 46, pad = 3;
      const min = Math.min(...hist), max = Math.max(...hist), span = Math.max(1, max - min);
      const pts = hist.map((v, i) => [
        pad + (hist.length > 1 ? i / (hist.length - 1) : 0.5) * (w - pad * 2),
        h - pad - ((v - min) / span) * (h - pad * 2),
      ]);
      const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      const area = `${line} L${w-pad} ${h} L${pad} ${h} Z`;
      const d = n.delta;

      return `
        <section class="card" id="w-score">
          <div class="card-head">
            <div class="card-title">NEXUS Score</div>
            <span class="badge ${d > 0 ? 'badge-good' : d < 0 ? 'badge-bad' : 'badge-info'}">${d > 0 ? '+' : ''}${d} since yesterday</span>
          </div>
          <div class="row gap-4" style="align-items:flex-start">
            <div style="text-align:center;min-width:84px">
              <div class="t-grad t-num" style="font-size:40px;font-weight:800;line-height:1">${n.score}</div>
              <div class="t-faint" style="font-size:11px;margin-top:4px">out of 100</div>
            </div>
            <div class="grow" style="min-width:0">
              <svg class="chart-line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:46px">
                <defs>
                  <linearGradient id="nexusLineStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop stop-color="#8B5CF6"/><stop offset="1" stop-color="#06B6D4"/>
                  </linearGradient>
                  <linearGradient id="nexusLineFill" x1="0" y1="0" x2="0" y2="1">
                    <stop stop-color="rgba(109,106,248,.34)"/><stop offset="1" stop-color="rgba(109,106,248,0)"/>
                  </linearGradient>
                </defs>
                <path class="cl-area" d="${area}"/>
                <path class="cl-path" d="${line}"/>
                <circle class="cl-dot" cx="${pts[pts.length-1][0].toFixed(1)}" cy="${pts[pts.length-1][1].toFixed(1)}" r="3.2"/>
              </svg>
              <div class="score-parts">
                ${n.parts.slice(0, 4).map(p => `
                  <div class="score-part" ${p.value === null ? 'title="nothing to measure yet"' : ''}>
                    <span>${p.label}</span>
                    <span class="t-num">${p.value === null ? '—' : p.value}</span>
                  </div>`).join('')}
              </div>
            </div>
          </div>
          ${n.parts[4].penalty ? `<div class="alert alert-warn" style="margin-top:14px;font-size:12px">
            ${icon('pulse', 13)} ${n.parts[4].value} overdue task${n.parts[4].value > 1 ? 's' : ''} reducing your score by ${n.parts[4].penalty} points.
          </div>` : ''}
          ${n.unmeasured.length ? `<p class="t-faint t-sm" style="margin:10px 0 0">
            Not counted yet: ${n.unmeasured.join(', ')} — a term with nothing to measure is
            left out rather than scored as zero.
          </p>` : ''}
          <button class="btn btn-sm btn-ghost btn-block" style="margin-top:10px" data-route="analytics">See breakdown</button>
        </section>`;
    },

    /* --- Upcoming (Milestone 12) --------------------------------------- */
    /* Upcoming — now date-aware (Milestone 19). Sorted by the real event date
       and labelled relative to today, so the dashboard never shows a stale
       order or a bare time with no sense of *when*. */
    upcomingCard() {
      const tk = todayKey();
      const tomo = dayKey(shiftDays(new Date(), 1));
      const rows = [...State.upcoming]
        .filter(u => u.date >= tk)                       // today and forward only
        .sort((a, b) => (a.date.localeCompare(b.date)) || a.time.localeCompare(b.time))
        .slice(0, 5);

      const when = d => d === tk ? 'Today' : d === tomo ? 'Tomorrow'
        : `${new Date(d + 'T00:00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}`;

      return `
        <section class="card" id="w-upcoming">
          <div class="card-head">
            <div class="card-title">Upcoming</div>
            <button class="btn btn-sm btn-ghost" data-route="calendar">See all</button>
          </div>
          ${rows.length ? `<div class="timeline">
            ${rows.map(u => `
              <div class="tl-row" data-route="calendar">
                <span class="tl-dot" style="background:${u.color};box-shadow:0 0 10px ${u.color}55"></span>
                <div class="grow">
                  <div class="tl-title">${esc(u.title)}</div>
                  <div class="tl-time">${esc(when(u.date))} · ${esc(u.time)}</div>
                </div>
              </div>`).join('')}
          </div>`
          : `<div class="empty" style="padding:var(--sp-5) 0">
               <div class="empty-ic">${icon('calendar', 18)}</div>
               <h4 style="font-size:var(--fs-sm)">Nothing coming up</h4>
               <p>Your schedule is clear.</p>
             </div>`}
        </section>`;
    },

    /* --- Inspiration quote (matches reference) ------------------------- */
    /* A "Daily reminder" that shows the same line every day is a static copy
       wearing a promise. The line is chosen by the DAY: deterministic, so it is
       the same line all day and a different one tomorrow, and derived, so nothing
       is stored. (A random pick would be a fabricated rotation — it would change
       on every repaint, which is worse than never changing.) */
    quoteCard() {
      const d = new Date();
      const idx = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000)
        % DAILY_LINES.length;
      return `
        <section class="card quote-card" id="w-quote">
          <div class="quote-mark">”</div>
          <p>${esc(DAILY_LINES[idx])}</p>
          <div class="card-sub" style="margin-top:10px">Daily reminder</div>
        </section>`;
    },

    /* --- Journal (Milestone 41) -----------------------------------------
       "How was today?" — read off today's entry through the same derivations the
       Journal page uses, so the card cannot disagree with the page it opens.
       A rating is `null` when the user did not rate that axis, and an unrated
       axis shows as unrated rather than as a middle-of-the-road 3: counting
       silence as an opinion is the mistake the journal already refuses to make. */
    journalCard() {
      const jl = Derive.journalList();
      const t = jl.today;
      const s = jl.summary;
      const axes = [
        { key: 'mood',         label: 'Mood',   color: 'var(--violet)' },
        { key: 'energy',       label: 'Energy', color: 'var(--cyan)' },
        { key: 'productivity', label: 'Focus',  color: 'var(--accent)' },
      ];
      const pips = v => [1, 2, 3, 4, 5].map(i =>
        `<span class="jp${typeof v === 'number' && i <= v ? ' is-on' : ''}"></span>`).join('');
      return `
        <section class="card" id="w-journal">
          <div class="card-head">
            <div>
              <div class="card-title">Journal</div>
              <div class="card-sub">${jl.todayWritten ? 'Written today' : 'Nothing written today yet'}</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-route="journal">${jl.todayWritten ? 'Open' : 'Write'}</button>
          </div>
          ${jl.todayWritten ? `
            <div class="jr-axes">
              ${axes.map(a => `<div class="jr-axis">
                <span class="jr-axis-l">${a.label}</span>
                <span class="jp-row" style="--jp:${a.color}">${pips(t && t[a.key])}</span>
              </div>`).join('')}
            </div>
            ${t && Derive.journalWordCount(t) ? `<p class="jr-excerpt">${esc(Derive.journalExcerpt(t, 84))}</p>` : ''}`
            : `<p class="card-sub" style="margin:0">A line about today, and how it felt.</p>`}
          <div class="jr-foot">
            <span>${s.streak} day streak</span>
            <span class="dot-sep"></span>
            <span>${s.thisMonth} this month</span>
          </div>
        </section>`;
    },

    /* --- Inbox (Milestone 41) -------------------------------------------
       What is still waiting on you. Every figure comes from the same
       `inboxSummary()` the Inbox page reads, and the age is derived from
       `createdAt` — never a stored string, which is what lets it stay true. */
    inboxCard() {
      const s = Derive.inboxSummary();
      const kinds = INBOX_KINDS.filter(k => (s.counts[k.key] || 0) > 0).slice(0, 4);
      const age = s.oldestDays === 0 ? 'from today'
        : s.oldestDays === 1 ? '1 day old' : `${s.oldestDays} days old`;
      return `
        <section class="card" id="w-inbox">
          <div class="card-head">
            <div>
              <div class="card-title">Inbox</div>
              <div class="card-sub">${s.open
                ? `${s.open} waiting${s.today ? ` · ${s.today} captured today` : ''}`
                : 'Nothing waiting'}</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-route="inbox">${s.open ? 'Triage' : 'Capture'}</button>
          </div>
          ${s.open ? `
            <div class="set-chips">
              ${kinds.map(k => `<span class="chip">${esc(k.label)} <b>${s.counts[k.key]}</b></span>`).join('')}
            </div>
            ${s.oldest ? `<p class="card-sub" style="margin:var(--sp-3) 0 0">Oldest is <b>${age}</b>.</p>` : ''}`
            : `<p class="card-sub" style="margin:0">Everything captured has been dealt with.</p>`}
        </section>`;
    },

    /* --- Activity feed --------------------------------------------------
       A summary line derived from the log (today / this week) over the five most
       recent entries, read through `activitySorted()` rather than off the stored
       array, so the card and the Activity page cannot disagree about the order. */
    activityCard() {
      const s = Derive.activityStats();
      const rows = Derive.activitySorted().slice(0, 5);
      return `
        <section class="card" id="w-activity">
          <div class="card-head">
            <div>
              <div class="card-title">Activity</div>
              <div class="card-sub">${s.total
                ? `${s.today} today · ${s.week} this week`
                : 'Nothing logged yet'}</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-route="activity">View all</button>
          </div>
          ${rows.length ? `<div class="feed">
            ${rows.map(a => `
              <div class="feed-row">
                <span class="feed-ic" style="color:${activityKind(a.kind).color}">${icon(activityKind(a.kind).icon, 12)}</span>
                <div class="grow">
                  <div class="feed-txt">${esc(a.text)}</div>
                  <div class="feed-at">${esc(Derive.activityTime(a))}</div>
                </div>
              </div>`).join('')}
          </div>` : `<p class="card-sub" style="margin:0">Every change you make is recorded here.</p>`}
        </section>`;
    },
  };

  /* --- FOCUS TIMER ENGINE (Milestone 7, rebuilt in Milestone 21) ----------
     A pomodoro timer with real modes. The timer holds NO history: completing a
     block appends a record to the session log (State.logSession), and every
     figure in the UI — the dashboard ring, the Focus page totals, the NEXUS
     Score's focus component — is derived from that log. One engine drives both
     the dashboard card and the Focus page; only one of them is ever mounted,
     and both use the same element ids. */
  const FOCUS_MODES = [
    { id: 'focus', label: 'Focus',       minutes: 25, icon: 'focus', brk: false },
    { id: 'short', label: 'Short break', minutes: 5,  icon: 'clock', brk: true  },
    { id: 'long',  label: 'Long break',  minutes: 15, icon: 'clock', brk: true  },
  ];

  const Focus = {
    mode: 'focus',
    custom: 25,               // user-chosen length for a focus block
    running: false,
    remaining: 25 * 60,
    taskId: null,             // the task this block is attributed to
    _id: null,
    _startedAt: null,

    def() { return FOCUS_MODES.find(m => m.id === this.mode) || FOCUS_MODES[0]; },
    isBreak() { return !!this.def().brk; },
    label() { return this.def().label; },
    minutes() {
      return this.mode === 'focus' && this.custom
        ? clamp(Math.round(this.custom), 1, 180)
        : this.def().minutes;
    },
    duration() { return this.minutes() * 60; },

    setMode(id, custom) {
      if (!FOCUS_MODES.some(m => m.id === id)) return;
      if (this.running) this.pause();
      this.mode = id;
      if (typeof custom === 'number' && custom > 0) {
        this.custom = clamp(Math.round(custom), 1, 180);
      }
      this.remaining = this.duration();
      this._repaint();
    },

    /* Start a block against a specific task (or none). */
    startWith(taskId) {
      if (taskId !== undefined) this.taskId = taskId || null;
      this.start();
    },

    start() {
      if (this.running) return;
      this.running = true;
      this._startedAt = Date.now();
      this._id = setInterval(() => this.tick(), 1000);
      this.sync();
    },

    tick() {
      this.remaining -= 1;
      this.syncRing();
      if (this.remaining <= 0) this.complete();
    },

    pause() {
      this.running = false;
      clearInterval(this._id); this._id = null;
      this.sync();
    },

    reset() {
      this.pause();
      this.remaining = this.duration();
      this._repaint();
    },

    /* Completing a block writes one real record. Breaks are recorded too —
       they are real time — but they never count as deep work. */
    complete() {
      const minutes = this.minutes();
      const mode = this.isBreak() ? 'break' : 'focus';
      const startedAt = this._startedAt || (Date.now() - minutes * 60000);
      this.pause();
      State.logSession({
        mode, minutes, startedAt,
        taskId: mode === 'focus' ? this.taskId : null,
      });
      this.remaining = this.duration();
      Toast.show(mode === 'break'
        ? `Break complete · ${minutes} min`
        : `Focus session complete · ${minutes} min logged`, 'good');
      this._repaint();
    },

    /* --- DOM sync ------------------------------------------------------
       Called after every tick and after every render, so a page that mounts
       mid-session immediately shows the correct ring, clock and button. */
    sync() { this.syncButton(); this.syncRing(); this.syncModes(); },

    syncRing() {
      const ring  = $('#focusRing .ring-val');
      const label = $('#focusRing .ring-center .t-num');
      if (label) label.textContent = clock(Math.max(0, this.remaining));
      if (!ring) return;
      const r = Number(ring.getAttribute('r')) || 1;
      const c = 2 * Math.PI * r;
      const pct = clamp(this.remaining / this.duration(), 0, 1);
      // The ring drains as the block progresses.
      ring.setAttribute('stroke-dashoffset', (c * (1 - pct)).toFixed(1));
    },

    syncButton() {
      $$('[data-focus-toggle]').forEach(btn => {
        btn.innerHTML = this.running
          ? icon('pause', 13) + 'Pause'
          : icon('play', 13) + 'Start';
      });
    },

    syncModes() {
      $$('[data-focus-mode]').forEach(b => {
        const on = b.dataset.focusMode === this.mode;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    },

    /* Repaint whichever page is showing the timer. */
    _repaint() {
      if (Router.current === 'focus') FocusPage.render();
      else Dashboard.render();
    },
  };

  /* --- DASHBOARD (Milestones 5–12) --------------------------------------- */
  const Dashboard = {
    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      /* Every page paints into the shared #page-mount, so a background refresh
         (e.g. a cascade trigger firing while the user is on Goals) must not
         clobber whatever page is actually on screen. Only paint when the router
         is really showing the dashboard. */
      if (Router.current !== 'dashboard') return;
      // State hydrates asynchronously; show a skeleton rather than crashing.
      if (!State.data) { mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Opening your workspace…</p></div></div></div>'; return; }
      const s = Derive.taskSummary();
      const proj = Derive.projectList();
      const streak = Derive.currentStreak();
      /* The composition comes from the one table, so the page never decides what
         a dashboard contains — it only draws what the arrangement resolves to. */
      const cards = Derive.dashboardCards();

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="page-head">
          <div>
            <div class="t-eyebrow">${todayMeta.label} · Personal workspace</div>
            <h1>${greeting()}, ${esc(State.user.name)} 👋</h1>
            <div class="sub">Small steps every day lead to big results.</div>
          </div>
        </div>

        ${this._setupOffer()}
        ${this._focusStrip()}

        <div class="grid grid-stats" id="dash-stats">
          ${Widgets.statTile({ icon:'check', label:'Tasks today', value:s.todayTotal,
            meta:`${s.todayDone} done · ${s.todayTotal - s.todayDone} open`, accent:'var(--accent)' })}
          ${Widgets.statTile({ icon:'layers', label:'Projects active', value:proj.active,
            meta: proj.atRisk ? `${proj.atRisk} need attention` : `${proj.openTasks} open tasks`,
            accent: proj.atRisk ? 'var(--bad)' : 'var(--cyan)' })}
          ${Widgets.statTile({ icon:'flame', label:'Day streak', value:streak,
            meta:'Keep going', accent:'var(--warn)' })}
          ${Widgets.statTile({ icon:'calendar', label:'Events today', value:Derive.dayItems(todayKey()).events.length,
            meta:`${State.upcoming.length} scheduled`, accent:'var(--violet)' })}
        </div>

        <div class="dash-bar">
          <span class="dash-bar-t">Your dashboard</span>
          <span class="dash-bar-sub">${cards.shown} of ${cards.total} cards${cards.customised ? ' · arranged by you' : ''}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-dash-customise>${icon('grid', 13)} Customise</button>
        </div>

        ${cards.empty ? this._emptyDash() : `
        <div class="grid grid-dash">
          <div class="dash-col">
            ${cards.wideRows.map(row => row.length === 1
              ? Widgets.card(row[0].key)
              : `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
                  ${row.map(c => Widgets.card(c.key)).join('')}
                </div>`).join('')}
          </div>
          <div class="dash-col">
            ${cards.side.map(c => Widgets.card(c.key)).join('')}
          </div>
        </div>`}
      ` }));

      this.bind();
      Shell.setHeader('Dashboard', 'Command Center');
    },

    /* The first-run offer. Rendered only while the workspace has never been set
       up, so it costs nothing once it has been answered or skipped. */
    _setupOffer() {
      if (!Derive.needsOnboarding()) return '';
      return `<div class="ob-banner">
        <span class="ob-banner-ic">${icon('sparkles', 17)}</span>
        <div>
          <div class="ob-banner-t">Set this workspace up</div>
          <p class="ob-banner-b">Two questions — what to call you, and where you want to start. You can skip it now and do it later from Settings.</p>
        </div>
        <div class="row">
          <button type="button" class="btn btn-primary btn-sm" data-ob-open>Start</button>
          <button type="button" class="btn btn-ghost btn-sm" data-ob-dismiss>Not now</button>
        </div>
      </div>`;
    },

    /* What the user said they wanted to start with, read back on the first screen
       they see. This is the payoff that keeps onboarding from being a survey: if
       nothing consumed the answers, asking for them would be theatre. */
    _focusStrip() {
      const f = Derive.focusRoutes();
      if (!f.length) return '';
      return `<div class="ob-focus">
        <div class="ob-focus-head">
          <span class="t-eyebrow">Your focus</span>
          <button type="button" class="btn btn-ghost btn-sm" data-ob-open>Change</button>
        </div>
        <div class="ob-strip">
          ${f.map(x => `<button type="button" class="ob-tile" data-route="${x.route}">
            <span class="ob-tile-ic">${icon(x.icon, 15)}</span>
            <span class="ob-tile-body">
              <span class="ob-tile-t">${esc(x.label)}</span>
              <span class="ob-tile-b">${esc(x.blurb)}</span>
            </span>
          </button>`).join('')}
        </div>
      </div>`;
    },

    /* --- Arranging the dashboard (M41) -----------------------------------
       The panel edits the preference and repaints BOTH itself and the dashboard
       behind it, so a move is visible while it is made — a customiser that only
       shows the result once you close it is a form, not a tool. */

    /* Every card hidden is a real answer, so it gets a real state rather than a
       blank page — and the way back is the control that got you here. The copy
       names what is NOT hidden, because the headline numbers above are part of
       the page rather than of the arrangement: saying "every card is hidden"
       beside four visible tiles would be a small lie. */
    _emptyDash() {
      return `<div class="card">
        <div class="empty" style="padding:var(--sp-6) var(--sp-4)">
          <h4>Your dashboard is empty</h4>
          <p>Every card is hidden. Nothing has been deleted, and the headline numbers above
            stay put — bring some back whenever you like.</p>
          <button type="button" class="btn btn-primary" data-dash-customise>Choose cards</button>
        </div>
      </div>`;
    },

    customise() {
      const v = Derive.dashboardCards();
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Dashboard</div>
            <h2 class="t-h2" style="margin-top:6px">Arrange your dashboard</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted">The wide column carries the work; the side column is a stack of
          summaries. Two half-width cards beside each other share a row.</p>
        <div id="dash-panel" tabindex="-1">${this._panelHtml(v)}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="dash-reset"${v.customised ? '' : ' disabled'}>Reset to the default</button>
          <button class="btn btn-primary" data-close>Done</button>
        </div>`, { cls: 'modal-lg' });
      this._bindCustomiser(wrap);
      /* The first control in the list is the top card's "up", which is disabled —
         a disabled button cannot take focus, so focusing "the first button" would
         leave focus on the document and a keyboard user tabbing from the top. */
      const first = $('#dash-panel button:not([disabled])', wrap);
      if (first) first.focus();
    },

    _panelHtml(v) {
      const row = (c, col, i, n) => {
        const other = col === 'wide' ? 'side' : 'wide';
        return `
        <div class="dc-row" data-dc="${c.key}">
          <div class="grow">
            <div class="dc-t">${esc(c.label)}</div>
            <div class="dc-b">${esc(c.blurb)}</div>
          </div>
          <div class="dc-act">
            <button type="button" class="iconbtn" data-dc-up="${c.key}" data-dc-col="${col}"
              aria-label="Move ${esc(c.label)} up"${i === 0 ? ' disabled' : ''}>${icon('chevU', 13)}</button>
            <button type="button" class="iconbtn" data-dc-down="${c.key}" data-dc-col="${col}"
              aria-label="Move ${esc(c.label)} down"${i === n - 1 ? ' disabled' : ''}>${icon('chevD', 13)}</button>
            <button type="button" class="iconbtn" data-dc-move="${c.key}" data-dc-col="${col}"
              aria-label="Move ${esc(c.label)} to the ${other} column">${icon(other === 'wide' ? 'arrowL' : 'arrowR', 13)}</button>
            <button type="button" class="btn btn-sm btn-ghost" data-dc-hide="${c.key}">Hide</button>
          </div>
        </div>`;
      };
      const group = col => `
        <div class="dc-group">
          <div class="dc-head">${esc(DASH_COL_LABELS[col])} <span class="dc-count">${v.layout[col].length}</span></div>
          ${v.layout[col].length
            ? v.layout[col].map((k, i) => row(dashCard(k), col, i, v.layout[col].length)).join('')
            : `<p class="card-sub" style="margin:0">Empty — move a card here, or show one below.</p>`}
        </div>`;
      return `
        ${group('wide')}
        ${group('side')}
        <div class="dc-group">
          <div class="dc-head">Hidden <span class="dc-count">${v.hidden.length}</span></div>
          ${v.hidden.length
            ? v.hidden.map(c => `
              <div class="dc-row is-off" data-dc="${c.key}">
                <div class="grow">
                  <div class="dc-t">${esc(c.label)}</div>
                  <div class="dc-b">${esc(c.blurb)}</div>
                </div>
                <div class="dc-act">
                  <button type="button" class="btn btn-sm btn-ghost" data-dc-show="${c.key}">Show</button>
                </div>
              </div>`).join('')
            : `<p class="card-sub" style="margin:0">Every card is on the dashboard.</p>`}
        </div>`;
    },

    _bindCustomiser(wrap) {
      wrap.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const v = Derive.dashboardCards();
        const next = { wide: v.layout.wide.slice(), side: v.layout.side.slice() };
        let focus = null;

        if (btn.id === 'dash-reset') {
          State.setDashboardCards(null);
        } else if (btn.dataset.dcUp || btn.dataset.dcDown) {
          const up = !!btn.dataset.dcUp;
          const key = btn.dataset.dcUp || btn.dataset.dcDown;
          const col = btn.dataset.dcCol;
          const i = next[col].indexOf(key), j = up ? i - 1 : i + 1;
          if (i === -1 || j < 0 || j >= next[col].length) return;
          next[col][i] = next[col][j];
          next[col][j] = key;
          State.setDashboardCards(next);
          /* Focus the SAME control, not merely the same card: pressing "down"
             twice must move the card twice, which it cannot do if the first press
             hands focus to the "up" button beside it. */
          focus = { attr: up ? 'dcUp' : 'dcDown', key };
        } else if (btn.dataset.dcMove) {
          const key = btn.dataset.dcMove, col = btn.dataset.dcCol;
          const other = col === 'wide' ? 'side' : 'wide';
          next[col] = next[col].filter(k => k !== key);
          next[other].push(key);
          State.setDashboardCards(next);
          focus = { attr: 'dcMove', key };
        } else if (btn.dataset.dcHide) {
          const key = btn.dataset.dcHide;
          DASH_COLS.forEach(c => { next[c] = next[c].filter(k => k !== key); });
          State.setDashboardCards(next);
          focus = { attr: 'dcShow', key };
        } else if (btn.dataset.dcShow) {
          const key = btn.dataset.dcShow;
          next[dashCard(key).col].push(key);
          State.setDashboardCards(next);
          focus = { attr: 'dcHide', key };
        } else {
          return;
        }

        this._repaintPanel(focus);
        /* The dashboard is mounted behind the modal, so a move is visible as it is
           made rather than only on close. */
        this.render();
      });
    },

    /* Repainting the list destroys the button that was just pressed, so focus has
       to be put back deliberately — otherwise a keyboard user is dropped at the
       top of the document after every move. Prefer the same control on the same
       card; fall back to that card's row; only then give up on the panel. */
    _repaintPanel(focus) {
      const host = $('#dash-panel');
      if (!host) return;
      const v = Derive.dashboardCards();
      host.innerHTML = this._panelHtml(v);
      const reset = $('#dash-reset');
      if (reset) reset.disabled = !v.customised;
      if (!focus) return;
      const attr = focus.attr.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      const same = host.querySelector('[data-' + attr + '="' + focus.key + '"]');
      if (same && !same.disabled) { same.focus(); return; }
      const row = host.querySelector('[data-dc="' + focus.key + '"]');
      const any = row && row.querySelector('button:not([disabled])');
      if (any) any.focus();
      else host.focus();
    },

    bind() {
      const mount = $('#page-mount');

      /* The first-run offer (M38). It is a BANNER, not a blocking wizard: this
         workspace already holds demo data, so there is nothing a visitor must
         answer before they can look around. Both the banner and the "Change" on
         the focus strip open the same flow. */
      $$('[data-ob-open]', mount).forEach(b => b.addEventListener('click', () => Onboarding.open(0)));
      const obDismiss = $('[data-ob-dismiss]', mount);
      if (obDismiss) obDismiss.addEventListener('click', () => {
        State.completeOnboarding({});
        Toast.show('You can set this up any time in Settings', 'default');
        this.render();
      });

      /* Arranging the dashboard (M41). The control appears in the head and again
         in the empty state, so both go through the one handler. */
      $$('[data-dash-customise]', mount).forEach(b =>
        b.addEventListener('click', () => this.customise()));

      // Task completion — cascades through every dependent system.
      $$('[data-toggle-task]', mount).forEach(btn => {
        btn.addEventListener('click', () => {
          const t = State.toggleTask(btn.dataset.toggleTask);
          if (t) {
            Toast.show(t.done ? `Completed “${t.title}”` : `Reopened “${t.title}”`,
              t.done ? 'good' : 'default');
          }
          this.render();          // dashboard reflects new data
        });
      });

      // Habit completion
      $$('[data-toggle-habit]', mount).forEach(btn => {
        btn.addEventListener('click', () => {
          const h = State.toggleHabit(btn.dataset.toggleHabit);
          if (h) {
            const v = Derive.habitView(h);
            Toast.show(v.doneToday
              ? (v.streak > 1 ? `${h.name} · ${v.streak} day streak` : `${h.name} · done today`)
              : `${h.name} · unchecked`, v.doneToday ? 'good' : 'default');
          }
          this.render();
        });
      });

      // Add task inline
      const add = $('#quickAddTask', mount);
      if (add) add.addEventListener('click', () => this.openAddTask());

      // Focus controls
      const tog = $('#focusToggle', mount); if (tog) tog.addEventListener('click', () =>
        Focus.running ? Focus.pause() : Focus.start());
      const rst = $('#focusReset', mount); if (rst) rst.addEventListener('click', () => {
        Focus.reset(); Toast.show('Timer reset', 'default');
      });
      // A block may already be running — show its real clock/ring/state, not
      // the values baked in at render time.
      Focus.sync();

      // Route shortcuts inside cards
      $$('[data-route]', mount).forEach(b => b.addEventListener('click', () => Router.go(b.dataset.route)));

      // "View goal" — opens the goal detail panel directly, so the button does
      // what it says instead of dumping the user on a list.
      $$('[data-goal-open]', mount).forEach(b => b.addEventListener('click', () =>
        GoalsPage.openGoal(b.dataset.goalOpen)));
    },

    openAddTask() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Quick add</div>
            <h2 class="t-h2" style="margin-top:6px">New task</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('plus', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Title</span>
            <input class="field" id="nt-title" placeholder="What needs attention?" autofocus>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Priority</span>
              <select class="select" id="nt-prio">
                <option>High</option><option selected>Medium</option><option>Low</option>
              </select>
            </label>
            <label class="field-group">
              <span class="field-label">Due</span>
              <select class="select" id="nt-due">
                <option selected>Today</option><option>Tonight</option><option>Tomorrow</option><option>This week</option>
              </select>
            </label>
          </div>
          <label class="field-group">
            <span class="field-label">Project</span>
            <select class="select" id="nt-proj">
              ${State.projects.map(p => `<option>${esc(p.name)}</option>`).join('')}<option>Personal</option>
            </select>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="nt-save">Create task</button>
        </div>`, { cls: 'modal-sm' });

      const titleEl = $('#nt-title', wrap);
      const save = () => {
        const title = titleEl.value.trim();
        if (!title) { titleEl.focus(); Toast.show('Add a title first', 'warn'); return; }
        State.addTask(title, {
          priority: $('#nt-prio', wrap).value,
          due: $('#nt-due', wrap).value,
          project: $('#nt-proj', wrap).value,
        });
        Overlay.close();
        Toast.show('Task created', 'good');
        this.render();
      };
      $('#nt-save', wrap).addEventListener('click', save);
      titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => titleEl.focus(), 40);
    },
  };

  /* ======================================================================
     PROJECTS PAGE — Milestone 17
     A project is a container for real work, so nothing here is hardcoded:
     progress, counts, health and the "next up" list all come from the tasks
     that carry the project's name. Completing a task moves its project.
     ====================================================================== */
  const ProjectsPage = {
    filter: 'all',      // all | active | risk | complete
    query: '',

    _colorVar(name) {
      const c = Derive._autoColor(name);
      return `var(--${c})`;
    },

    _filtered() {
      let list = Derive.allProjects();
      if (this.filter === 'active')   list = list.filter(p => p.status === 'Active');
      if (this.filter === 'complete') list = list.filter(p => p.status === 'Complete');
      if (this.filter === 'risk')     list = list.filter(p => p.overdue > 0);
      if (this.query) {
        const q = this.query.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(q));
      }
      return list;
    },

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      // Never repaint over a different page (see Dashboard.render).
      if (Router.current !== 'projects') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Loading projects…</p></div></div></div>';
        return;
      }

      const s = Derive.projectList();
      const list = this._filtered();

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>Projects</h1>
            <div class="sub">${s.active} active · ${s.openTasks} open tasks · ${s.avg}% average progress</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary btn-sm" id="pj-new">${icon('plus', 14)} New project</button>
          </div>
        </div>

        <div class="proj-stats" style="margin-top:var(--sp-4)">
          ${Widgets.statTile({ icon:'layers', label:'Active projects', value:s.active,
            meta:`${s.list.length} total`, accent:'var(--accent)' })}
          ${Widgets.statTile({ icon:'list', label:'Open tasks', value:s.openTasks,
            meta:`${s.doneTasks} completed`, accent:'var(--cyan)' })}
          ${Widgets.statTile({ icon:'pulse', label:'Average progress', value:s.avg + '%',
            meta:'Across all projects', accent:'var(--violet)' })}
          ${Widgets.statTile({ icon:'flag', label:'Needs attention', value:s.atRisk,
            meta:s.atRisk ? 'Overdue work' : 'All on schedule',
            accent: s.atRisk ? 'var(--bad)' : 'var(--good)' })}
        </div>

        <div class="viewtabs" role="tablist" style="margin-top:var(--sp-4)">
          ${[
            ['all', 'All', s.list.length],
            ['active', 'Active', s.active],
            ['risk', 'Needs attention', s.atRisk],
            ['complete', 'Complete', s.list.filter(p => p.status === 'Complete').length],
          ].map(([k, label, n]) => `
            <button class="viewtab ${this.filter === k ? 'is-active' : ''}" data-pjfilter="${k}"
              role="tab" aria-selected="${this.filter === k}">
              ${label}<span class="vt-count">${n}</span>
            </button>`).join('')}
        </div>

        <div style="margin-top:var(--sp-4)">
          ${list.length ? `<div class="proj-grid">${list.map(p => this._card(p)).join('')}</div>`
            : `<section class="card"><div class="empty">
                 <div class="empty-ic">${icon('layers', 22)}</div>
                 <h4>${this.filter === 'all' ? 'No projects yet' : 'Nothing in this view'}</h4>
                 <p>${this.filter === 'all'
                   ? 'Projects group your tasks. Create one, or assign a task to a new project from the task panel.'
                   : 'Try a different filter — or create a project to get started.'}</p>
                 <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-pj-new>
                   ${icon('plus', 14)} New project
                 </button>
               </div></section>`}
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Projects', `${s.active} active · ${s.openTasks} open`);
    },

    _card(p) {
      const color = this._colorVar(p.name);
      const next = State.tasks
        .filter(t => t.project === p.name && !t.done && !t.archived)
        .sort((a, b) => {
          const rank = { High: 0, Medium: 1, Low: 2 };
          return rank[a.priority] - rank[b.priority];
        })
        .slice(0, 3);

      const healthClass = p.overdue > 0 ? 'badge-bad'
        : p.status === 'Complete' ? 'badge-good' : 'badge-info';

      return `
        <section class="card proj-card" data-pj="${esc(p.name)}">
          <div class="proj-card-top">
            <span class="proj-dot" style="background:${color}"></span>
            <div class="proj-id">
              <div class="proj-name" data-pj-open="${esc(p.name)}" role="button" tabindex="0">${esc(p.name)}</div>
              <div class="proj-sub">
                <span class="badge ${healthClass}">${p.status === 'Complete' ? 'Complete' : p.health}</span>
                ${p.overdue ? `<span class="badge badge-bad">${p.overdue} overdue</span>` : ''}
                ${p.high ? `<span class="badge badge-warn">${p.high} high</span>` : ''}
              </div>
            </div>
          </div>

          <div class="proj-prog">
            <div class="proj-prog-head">
              <span class="proj-pct" style="color:${color}">${p.progress}%</span>
              <span class="t-faint t-sm">${p.done}<span style="opacity:.5"> / </span>${p.total} tasks</span>
            </div>
            <div class="proj-bar">
              <div class="proj-bar-fill" style="width:${p.progress}%;background:${color}"></div>
            </div>
          </div>

          <div class="proj-counts">
            <span class="proj-count is-open"><span class="pc-num">${p.open}</span><span class="pc-lbl">Open</span></span>
            <span class="proj-count is-done"><span class="pc-num">${p.done}</span><span class="pc-lbl">Done</span></span>
            ${p.openMinutes ? `<span class="proj-count"><span class="pc-num">${p.openMinutes}</span><span class="pc-lbl">min left</span></span>` : ''}
          </div>

          <div class="proj-next">
            ${next.length
              ? next.map(t => `
                  <div class="proj-next-item prio-${t.priority.toLowerCase()}" data-pj-task="${t.id}">
                    <span class="pni-dot"></span>
                    <span class="pni-title">${esc(t.title)}</span>
                    <span class="pni-due">${esc(Derive.dueLabel(t.due))}</span>
                  </div>`).join('')
              : `<div class="proj-clear">${icon('check', 13)} ${p.total ? 'All tasks complete' : 'No tasks yet'}</div>`}
          </div>

          <div class="proj-foot">
            <span class="proj-deadline">
              ${icon('calendar', 12)} ${p.deadline ? 'Due ' + esc(p.deadline) : 'No deadline'}
            </span>
            <div class="row gap-1">
              ${p.open ? `<button class="btn btn-ghost btn-sm" data-pj-resume="${esc(p.name)}">Resume</button>` : ''}
              <button class="iconbtn" data-pj-detail="${esc(p.name)}" aria-label="Project details">${icon('arrowR', 14)}</button>
            </div>
          </div>
        </section>`;
    },

    bind() {
      const mount = $('#page-mount');

      $$('[data-pjfilter]', mount).forEach(b => b.addEventListener('click', () => {
        this.filter = b.dataset.pjfilter;
        this.render();
      }));

      const nu = $('#pj-new', mount);
      if (nu) nu.addEventListener('click', () => this.openNew());
      $$('[data-pj-new]', mount).forEach(b => b.addEventListener('click', () => this.openNew()));

      // Open the project detail panel
      $$('[data-pj-detail]', mount).forEach(b => b.addEventListener('click', () =>
        ProjectDetail.open(b.dataset.pjDetail)));
      $$('[data-pj-open]', mount).forEach(b => {
        b.addEventListener('click', () => ProjectDetail.open(b.dataset.pjOpen));
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ProjectDetail.open(b.dataset.pjOpen); }
        });
      });

      // Resume → jump to this project's open work on the Tasks page
      $$('[data-pj-resume]', mount).forEach(b => b.addEventListener('click', () => {
        TasksPage.projFilter = b.dataset.pjResume;
        TasksPage.view = 'all';
        Router.go('tasks');
        Toast.show(`Showing open work for ${b.dataset.pjResume}`, 'default');
      }));

      // A task in the "next up" list opens its detail panel
      $$('[data-pj-task]', mount).forEach(b => b.addEventListener('click', () =>
        TaskDetail.open(b.dataset.pjTask)));
    },

    openNew() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">New project</div>
            <h2 class="t-h2" style="margin-top:6px">Create a project</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Name</span>
            <input class="field" id="np-name" placeholder="e.g. Portfolio redesign" autofocus>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Status</span>
              <select class="select" id="np-status"><option>Active</option><option>On hold</option></select>
            </label>
            <label class="field-group">
              <span class="field-label">Deadline <span class="t-faint">(optional)</span></span>
              <input class="field" id="np-deadline" placeholder="30 Sep">
            </label>
          </div>
          <p class="t-sm t-muted" style="margin:0">
            Progress is calculated from the tasks assigned to this project, so it
            starts at 0% until you add work.
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="np-save">Create project</button>
        </div>`, { cls: 'modal-md' });

      const nameEl = $('#np-name', wrap);
      const save = () => {
        const name = nameEl.value.trim();
        if (!name) { nameEl.focus(); Toast.show('Give the project a name', 'warn'); return; }
        if (State.projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
          Toast.show('A project with that name already exists', 'warn');
          return;
        }
        State.addProject({
          name,
          status: $('#np-status', wrap).value,
          deadline: $('#np-deadline', wrap).value.trim() || null,
          color: Derive._autoColor(name),
        });
        Overlay.close();
        Toast.show(`Project “${name}” created`, 'good');
        this.render();
      };
      $('#np-save', wrap).addEventListener('click', save);
      nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => nameEl.focus(), 40);
    },
  };

  /* ======================================================================
     PROJECT DETAIL PANEL — Milestone 17
     Reuses the side-panel shell. Shows the derived breakdown, the tasks that
     make up the number, and lets you rename / re-date / delete the project.
     ====================================================================== */
  const ProjectDetail = {
    name: null,

    open(name) {
      const proj = Derive.allProjects().find(p => p.name === name);
      if (!proj) { Toast.show('That project no longer exists', 'warn'); return; }
      this.name = name;
      const panel = Overlay.panel(this._html(proj), { wide: true });
      this._bind(panel);
      return panel;
    },

    close() { Overlay.close(); this.name = null; },

    refresh() {
      const panel = $('.panel');
      if (!panel || !this.name) return;
      const proj = Derive.allProjects().find(p => p.name === this.name);
      if (!proj) { this.close(); return; }
      const body = $('.panel-body', panel);
      const scroll = body ? body.scrollTop : 0;
      panel.outerHTML = `<aside class="panel panel-wide" role="dialog" aria-modal="true">${this._html(proj)}</aside>`;
      const next = $('.panel');
      this._bind(next);
      const nb = $('.panel-body', next);
      if (nb) nb.scrollTop = scroll;
    },

    _html(p) {
      const color = `var(--${Derive._autoColor(p.name)})`;
      const tasks = State.tasks
        .filter(t => t.project === p.name && !t.archived)
        .sort((a, b) => (a.done - b.done) || a.title.localeCompare(b.title));
      const open = tasks.filter(t => !t.done);
      const done = tasks.filter(t => t.done);

      return `
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">Project</div>
            <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
              <span class="badge ${p.overdue ? 'badge-bad' : p.status === 'Complete' ? 'badge-good' : 'badge-info'}">
                ${p.status === 'Complete' ? 'Complete' : p.health}
              </span>
              <span class="badge">${p.progress}% complete</span>
              ${p.overdue ? `<span class="badge badge-bad">${p.overdue} overdue</span>` : ''}
            </div>
          </div>
          <button class="iconbtn" data-pjd-close aria-label="Close project details">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          <input class="panel-title" id="pjd-name" value="${esc(p.name)}"
            aria-label="Project name" placeholder="Project name">

          <div class="p-sec">
            <div class="p-label">Progress</div>
            <div class="proj-prog">
              <div class="proj-prog-head">
                <span class="proj-pct" style="color:${color}">${p.progress}%</span>
                <span class="t-faint t-sm">${p.done} of ${p.total} tasks</span>
              </div>
              <div class="proj-bar"><div class="proj-bar-fill" style="width:${p.progress}%;background:${color}"></div></div>
            </div>
            <div class="proj-counts" style="margin-top:var(--sp-4)">
              <span class="proj-count is-open"><span class="pc-num">${p.open}</span><span class="pc-lbl">Open</span></span>
              <span class="proj-count is-done"><span class="pc-num">${p.done}</span><span class="pc-lbl">Done</span></span>
              <span class="proj-count ${p.overdue ? 'is-risk' : ''}"><span class="pc-num">${p.overdue}</span><span class="pc-lbl">Overdue</span></span>
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Details</div>
            <div class="p-row">
              <span class="p-key">Status</span>
              <span class="p-val">
                <select class="select" id="pjd-status" style="height:30px;padding:0 26px 0 10px;font-size:var(--fs-xs);width:auto">
                  ${['Active', 'On hold', 'Complete'].map(s =>
                    `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Deadline</span>
              <span class="p-val">
                <input class="field" id="pjd-deadline" value="${esc(p.deadline || '')}"
                  placeholder="—" style="height:30px;width:120px;text-align:right;font-size:var(--fs-xs)">
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Estimated work left</span>
              <span class="p-val">${p.openMinutes ? p.openMinutes + ' min' : '—'}</span>
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Tasks · ${tasks.length}</div>
            ${tasks.length ? `
              <div class="pd-breakdown">
                ${tasks.map(t => `
                  <div class="pd-bd-row ${t.done ? 'is-done' : ''}" data-pjd-task="${t.id}">
                    <span class="pd-bd-left">
                      <button class="check ${t.done ? 'is-done' : ''}" data-pjd-toggle="${t.id}"
                        role="checkbox" aria-checked="${t.done}" aria-label="Toggle ${esc(t.title)}">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                      <span class="pd-bd-title">${esc(t.title)}</span>
                    </span>
                    <span class="t-faint t-sm" style="flex:0 0 auto">${esc(Derive.dueLabel(t.due))}</span>
                  </div>`).join('')}
              </div>`
              : `<div class="card-sub">No tasks assigned to this project yet. Open a task and set its project, or create one below.</div>`}
          </div>
        </div>

        <div class="panel-foot">
          <button class="btn btn-ghost btn-sm" data-pjd-addtask>${icon('plus', 13)} Add task</button>
          <button class="btn btn-ghost btn-sm" data-pjd-tasks>${icon('list', 13)} Open in Tasks</button>
          <button class="btn btn-ghost btn-sm act-danger" data-pjd-del style="margin-left:auto">${icon('trash', 13)} Delete project</button>
        </div>`;
    },

    _bind(panel) {
      if (!panel) return;
      const name = () => this.name;

      panel.addEventListener('click', e => {
        if (e.target.closest('[data-pjd-close]')) return this.close();

        const st = e.target.closest('[data-pjd-task]');
        if (st && !e.target.closest('[data-pjd-toggle]')) {
          const id = st.dataset.pjdTask;
          this.close();
          return TaskDetail.open(id);
        }

        const tg = e.target.closest('[data-pjd-toggle]');
        if (tg) {
          const t = State.toggleTask(tg.dataset.pjdToggle);
          if (t) Toast.show(t.done ? `Completed “${t.title}”` : `Reopened “${t.title}”`,
            t.done ? 'good' : 'default');
          ProjectsPage.render();
          return this.refresh();
        }

        if (e.target.closest('[data-pjd-tasks]')) {
          TasksPage.projFilter = name();
          TasksPage.view = 'all';
          this.close();
          Router.go('tasks');
          return;
        }

        if (e.target.closest('[data-pjd-addtask]')) return this._addTask();

        if (e.target.closest('[data-pjd-del]')) {
          const proj = Derive.projectStats(name());
          const wrap = Overlay.open(`
            <div class="modal-head">
              <div>
                <div class="t-eyebrow">Delete project</div>
                <h2 class="t-h2" style="margin-top:6px">Remove “${esc(name())}”?</h2>
              </div>
              <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
            </div>
            <p class="t-sm t-muted">
              ${proj.linked
                ? `The ${proj.linked} task${proj.linked === 1 ? '' : 's'} in this project will be kept and moved to <b>Personal</b>.`
                : 'This project has no tasks.'}
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" data-close>Cancel</button>
              <button class="btn btn-danger" id="pjd-del-yes">${icon('trash', 14)} Delete project</button>
            </div>`, { cls: 'modal-sm' });
          $('#pjd-del-yes', wrap).addEventListener('click', () => {
            State.deleteProject(name());
            Overlay.close();
            this.name = null;
            ProjectsPage.render();
            Toast.show('Project deleted · tasks moved to Personal', 'default');
          });
          return;
        }
      });

      // Rename
      const nameEl = $('#pjd-name', panel);
      if (nameEl) nameEl.addEventListener('blur', () => {
        const v = nameEl.value.trim();
        if (!v || v === name()) { nameEl.value = name(); return; }
        State.renameProject(name(), v);
        this.name = v;
        ProjectsPage.render();
        this.refresh();
        Toast.show('Project renamed', 'good');
      });

      const stEl = $('#pjd-status', panel);
      if (stEl) stEl.addEventListener('change', () => {
        State.updateProject(name(), { status: stEl.value });
        ProjectsPage.render();
        this.refresh();
      });

      const dlEl = $('#pjd-deadline', panel);
      if (dlEl) dlEl.addEventListener('change', () => {
        State.updateProject(name(), { deadline: dlEl.value.trim() || null });
        ProjectsPage.render();
      });
    },

    _addTask() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">${esc(this.name)}</div>
            <h2 class="t-h2" style="margin-top:6px">Add a task</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Title</span>
            <input class="field" id="pat-title" placeholder="What needs doing?" autofocus>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Priority</span>
              <select class="select" id="pat-prio"><option>High</option><option selected>Medium</option><option>Low</option></select>
            </label>
            <label class="field-group">
              <span class="field-label">Due</span>
              <select class="select" id="pat-due">
                <option selected>Today</option><option>Tonight</option><option>Tomorrow</option><option>This week</option>
              </select>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="pat-save">Add task</button>
        </div>`, { cls: 'modal-md' });

      const titleEl = $('#pat-title', wrap);
      const save = () => {
        const title = titleEl.value.trim();
        if (!title) { titleEl.focus(); Toast.show('Add a title first', 'warn'); return; }
        State.addTask(title, {
          priority: $('#pat-prio', wrap).value,
          due: $('#pat-due', wrap).value,
          project: this.name,
        });
        Overlay.close();
        ProjectsPage.render();
        TasksPage.render();
        Toast.show('Task added to project', 'good');
        // Re-open the panel so the new task is visible in context.
        const keep = this.name;
        setTimeout(() => this.open(keep), 60);
      };
      $('#pat-save', wrap).addEventListener('click', save);
      titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => titleEl.focus(), 40);
    },
  };

  /* ======================================================================
     GOALS PAGE — Milestone 18
     A goal is a *direction*, not a container. Nothing about its progress is
     stored: every percentage, count and health read on this page is derived
     from the tasks linked to it via task.goalId (set from the Task panel).
     Link a task to a goal and the goal moves — everywhere, at once.
     ====================================================================== */
  /* `HORIZONS` and `LIFE_AREAS` moved up to the entity layer (M39) — they are
     the goal vocabulary, and `normalizeGoal` has to validate against them. */

  const GoalsPage = {
    filter: 'all',      // all | active | risk | unlinked | complete

    _colorVar(g) { return `var(--${g.color || Derive._autoColor(g.name)})`; },

    _filtered() {
      let list = Derive.allGoals();
      if (this.filter === 'active')   list = list.filter(g => g.status === 'Active');
      if (this.filter === 'complete') list = list.filter(g => g.status === 'Complete');
      if (this.filter === 'risk')     list = list.filter(g => g.overdue > 0);
      if (this.filter === 'unlinked') list = list.filter(g => g.total === 0);
      return list;
    },

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      // Never repaint over a different page (see Dashboard.render).
      if (Router.current !== 'goals') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Loading goals…</p></div></div></div>';
        return;
      }

      const s = Derive.goalList();
      const list = this._filtered();

      /* Group by horizon so the page reads as a hierarchy of intent:
         this quarter → this year → someday. */
      const groups = HORIZONS
        .map(h => ({ h, items: list.filter(g => (g.horizon || 'Quarter') === h) }))
        .filter(gr => gr.items.length);

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>Goals</h1>
            <div class="sub">${s.active} active · ${s.openTasks} task${s.openTasks === 1 ? '' : 's'} linked · ${s.avg}% average progress</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary btn-sm" id="gl-new">${icon('plus', 14)} New goal</button>
          </div>
        </div>

        <div class="proj-stats" style="margin-top:var(--sp-4)">
          ${Widgets.statTile({ icon:'target', label:'Active goals', value:s.active,
            meta:`${s.list.length} total`, accent:'var(--accent)' })}
          ${Widgets.statTile({ icon:'list', label:'Linked tasks', value:s.openTasks,
            meta:`${s.doneTasks} completed`, accent:'var(--cyan)' })}
          ${Widgets.statTile({ icon:'pulse', label:'Average progress', value:s.avg + '%',
            meta:'Across goals with work', accent:'var(--violet)' })}
          ${Widgets.statTile({ icon:'flag', label:'Needs attention', value:s.atRisk,
            meta:s.atRisk ? 'Overdue linked work' : (s.unlinked ? s.unlinked + ' with no work yet' : 'All on schedule'),
            accent: s.atRisk ? 'var(--bad)' : (s.unlinked ? 'var(--warn)' : 'var(--good)') })}
        </div>

        <div class="viewtabs" role="tablist" style="margin-top:var(--sp-4)">
          ${[
            ['all', 'All', s.list.length],
            ['active', 'Active', s.active],
            ['risk', 'Needs attention', s.atRisk],
            ['unlinked', 'No work linked', s.unlinked],
            ['complete', 'Complete', s.list.filter(g => g.status === 'Complete').length],
          ].map(([k, label, n]) => `
            <button class="viewtab ${this.filter === k ? 'is-active' : ''}" data-glfilter="${k}"
              role="tab" aria-selected="${this.filter === k}">
              ${label}<span class="vt-count">${n}</span>
            </button>`).join('')}
        </div>

        <div style="margin-top:var(--sp-4)">
          ${list.length ? groups.map(gr => `
            <div class="goal-group">
              <div class="goal-group-head">
                <span class="goal-horizon">${gr.h}</span>
                <span class="goal-group-line"></span>
                <span class="t-faint t-sm">${gr.items.length}</span>
              </div>
              <div class="proj-grid">${gr.items.map(g => this._card(g)).join('')}</div>
            </div>`).join('')
            : `<section class="card"><div class="empty">
                 <div class="empty-ic">${icon('target', 22)}</div>
                 <h4>${this.filter === 'all' ? 'No goals yet' : 'Nothing in this view'}</h4>
                 <p>${this.filter === 'all'
                   ? 'A goal is a direction. Create one, then link tasks to it from the task panel — progress follows automatically.'
                   : 'Try a different filter.'}</p>
                 <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-gl-new>
                   ${icon('plus', 14)} New goal
                 </button>
               </div></section>`}
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Goals', `${s.active} active · ${s.avg}% average`);
    },

    _card(g) {
      const color = this._colorVar(g);
      const healthClass = g.overdue > 0 ? 'badge-bad'
        : g.status === 'Complete' ? 'badge-good'
        : g.total === 0 ? 'badge' : 'badge-info';

      /* The three highest-priority open tasks that make up this number —
         the goal's progress should be inspectable, not a black box. */
      const next = State.tasks
        .filter(t => t.goalId === g.id && !t.done && !t.archived)
        .sort((a, b) => {
          const rank = { High: 0, Medium: 1, Low: 2 };
          return (rank[a.priority] - rank[b.priority]) || a.title.localeCompare(b.title);
        })
        .slice(0, 3);

      return `
        <section class="card proj-card goal-card" data-gl="${esc(g.id)}">
          <div class="proj-card-top">
            <span class="proj-dot" style="background:${color}"></span>
            <div class="proj-id">
              <div class="proj-name" data-gl-open="${esc(g.id)}" role="button" tabindex="0">${esc(g.name)}</div>
              <div class="proj-sub">
                <span class="badge ${healthClass}">${g.status === 'Complete' ? 'Complete' : g.health}</span>
                ${g.area ? `<span class="badge">${esc(g.area)}</span>` : ''}
                ${g.overdue ? `<span class="badge badge-bad">${g.overdue} overdue</span>` : ''}
              </div>
            </div>
          </div>

          <div class="proj-prog">
            <div class="proj-prog-head">
              <span class="proj-pct" style="color:${color}">${g.progress}%</span>
              <span class="t-faint t-sm">
                ${g.total ? `${g.done}<span style="opacity:.5"> / </span>${g.total} tasks` : 'no linked work'}
              </span>
            </div>
            <div class="proj-bar">
              <div class="proj-bar-fill" style="width:${g.progress}%;background:${color}"></div>
            </div>
          </div>

          <div class="proj-counts">
            <span class="proj-count is-open"><span class="pc-num">${g.open}</span><span class="pc-lbl">Open</span></span>
            <span class="proj-count is-done"><span class="pc-num">${g.done}</span><span class="pc-lbl">Done</span></span>
            ${g.openMinutes ? `<span class="proj-count"><span class="pc-num">${g.openMinutes}</span><span class="pc-lbl">min left</span></span>` : ''}
          </div>

          <div class="proj-next">
            ${next.length
              ? next.map(t => `
                  <div class="proj-next-item prio-${t.priority.toLowerCase()}" data-gl-task="${t.id}">
                    <span class="pni-dot"></span>
                    <span class="pni-title">${esc(t.title)}</span>
                    <span class="pni-due">${esc(Derive.dueLabel(t.due))}</span>
                  </div>`).join('')
              : `<div class="proj-clear">${icon('target', 13)} ${
                  g.total ? 'Everything linked is complete'
                          : 'Link a task from the task panel to start tracking'}</div>`}
          </div>

          <div class="proj-foot">
            <span class="proj-deadline">
              ${icon('calendar', 12)} ${g.deadline ? 'Target ' + esc(g.deadline) : 'No target date'}
            </span>
            <div class="row gap-1">
              <button class="btn btn-ghost btn-sm" data-gl-link="${esc(g.id)}">Link tasks</button>
              <button class="iconbtn" data-gl-detail="${esc(g.id)}" aria-label="Goal details">${icon('arrowR', 14)}</button>
            </div>
          </div>
        </section>`;
    },

    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      $$('[data-glfilter]', mount).forEach(b => b.addEventListener('click', () => {
        this.filter = b.dataset.glfilter;
        this.render();
      }));

      const nu = $('#gl-new', mount);
      if (nu) nu.addEventListener('click', () => this.openNew());
      $$('[data-gl-new]', mount).forEach(b => b.addEventListener('click', () => this.openNew()));

      $$('[data-gl-detail]', mount).forEach(b => b.addEventListener('click', () =>
        this.openGoal(b.dataset.glDetail)));
      $$('[data-gl-open]', mount).forEach(b => {
        b.addEventListener('click', () => this.openGoal(b.dataset.glOpen));
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openGoal(b.dataset.glOpen); }
        });
      });

      /* "Link tasks" is the core action of this page — it opens the task picker
         so a goal can actually be given work without a detour through Tasks. */
      $$('[data-gl-link]', mount).forEach(b => b.addEventListener('click', () =>
        GoalDetail.openLinker(b.dataset.glLink)));

      $$('[data-gl-task]', mount).forEach(b => b.addEventListener('click', () =>
        TaskDetail.open(b.dataset.glTask)));
    },

    openGoal(id) {
      if (!State.goals.some(g => g.id === id)) {
        Toast.show('That goal no longer exists', 'warn');
        return;
      }
      return GoalDetail.open(id);
    },

    openNew() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">New goal</div>
            <h2 class="t-h2" style="margin-top:6px">What are you working toward?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Goal</span>
            <input class="field" id="ng-name" placeholder="e.g. Run a half marathon" autofocus>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Horizon</span>
              <select class="select" id="ng-horizon">
                ${HORIZONS.map(h => `<option${h === 'Quarter' ? ' selected' : ''}>${h}</option>`).join('')}
              </select>
            </label>
            <label class="field-group">
              <span class="field-label">Life area</span>
              <select class="select" id="ng-area">
                ${LIFE_AREAS.map(a => `<option>${a}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Target date <span class="t-faint">(optional)</span></span>
              <input class="field" id="ng-deadline" placeholder="31 Dec">
            </label>
            <label class="field-group">
              <span class="field-label">Colour</span>
              <select class="select" id="ng-color">
                ${['violet','cyan','magenta','indigo','blue'].map(c =>
                  `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="field-group">
            <span class="field-label">Why this matters <span class="t-faint">(optional)</span></span>
            <textarea class="textarea" id="ng-why" rows="2" placeholder="The reason you'll keep going when it gets boring"></textarea>
          </label>
          <p class="t-sm t-muted" style="margin:0">
            Progress is calculated from the tasks linked to this goal, so it starts at
            0% until you link work.
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="ng-save">Create goal</button>
        </div>`, { cls: 'modal-md' });

      const nameEl = $('#ng-name', wrap);
      const save = () => {
        const name = nameEl.value.trim();
        if (!name) { nameEl.focus(); Toast.show('Give the goal a name', 'warn'); return; }
        const g = State.addGoal({
          name,
          horizon: $('#ng-horizon', wrap).value,
          area: $('#ng-area', wrap).value,
          deadline: $('#ng-deadline', wrap).value.trim() || null,
          color: $('#ng-color', wrap).value,
          why: $('#ng-why', wrap).value.trim(),
        });
        Overlay.close();
        Toast.show(`Goal “${name}” created`, 'good');
        this.render();
        // Straight into the details so the user can link work to it.
        setTimeout(() => GoalDetail.open(g.id), 80);
      };
      $('#ng-save', wrap).addEventListener('click', save);
      nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => nameEl.focus(), 40);
    },
  };

  /* ======================================================================
     GOAL DETAIL PANEL — Milestone 18
     The same drawer pattern as ProjectDetail: the derived breakdown, the tasks
     that produce the number (with inline completion), and editing of the goal
     itself. Deleting a goal unlinks its tasks rather than destroying work.
     ====================================================================== */
  const GoalDetail = {
    id: null,

    open(id) {
      const g = Derive.allGoals().find(x => x.id === id);
      if (!g) { Toast.show('That goal no longer exists', 'warn'); return; }
      this.id = id;
      const panel = Overlay.panel(this._html(g), { wide: true });
      this._bind(panel);
      return panel;
    },

    close() { Overlay.close(); this.id = null; },

    refresh() {
      const panel = $('.panel');
      if (!panel || !this.id) return;
      const g = Derive.allGoals().find(x => x.id === this.id);
      if (!g) { this.close(); return; }
      const body = $('.panel-body', panel);
      const scroll = body ? body.scrollTop : 0;
      panel.outerHTML = `<aside class="panel panel-wide" role="dialog" aria-modal="true">${this._html(g)}</aside>`;
      const next = $('.panel');
      this._bind(next);
      const nb = $('.panel-body', next);
      if (nb) nb.scrollTop = scroll;
    },

    _html(g) {
      const color = `var(--${g.color || Derive._autoColor(g.name)})`;
      const tasks = State.tasks
        .filter(t => t.goalId === g.id && !t.archived)
        .sort((a, b) => (a.done - b.done) || a.title.localeCompare(b.title));

      const linkedProjects = [...new Set(tasks.map(t => t.project).filter(Boolean))];
      const healthClass = g.overdue ? 'badge-bad'
        : g.status === 'Complete' ? 'badge-good'
        : g.total === 0 ? 'badge' : 'badge-info';

      /* How many unlinked tasks are available to link — so the empty state can
         tell the user exactly how much work is sitting right there. */
      const linkable = State.tasks.filter(t => !t.archived && !t.goalId).length;

      return `
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">Goal${g.area ? ' · ' + esc(g.area) : ''}</div>
            <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
              <span class="badge ${healthClass}">${g.status === 'Complete' ? 'Complete' : g.health}</span>
              <span class="badge">${g.progress}% complete</span>
              ${g.horizon ? `<span class="badge">${esc(g.horizon)}</span>` : ''}
              ${g.overdue ? `<span class="badge badge-bad">${g.overdue} overdue</span>` : ''}
            </div>
          </div>
          <button class="iconbtn" data-gld-close aria-label="Close goal details">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          <input class="panel-title" id="gld-name" value="${esc(g.name)}"
            aria-label="Goal name" placeholder="Goal name">

          ${g.why ? `<p class="goal-why">“${esc(g.why)}”</p>` : ''}

          <div class="p-sec">
            <div class="p-label">Progress</div>
            <div class="proj-prog">
              <div class="proj-prog-head">
                <span class="proj-pct" style="color:${color}">${g.progress}%</span>
                <span class="t-faint t-sm">${g.total ? `${g.done} of ${g.total} tasks` : 'no linked work yet'}</span>
              </div>
              <div class="proj-bar"><div class="proj-bar-fill" style="width:${g.progress}%;background:${color}"></div></div>
            </div>
            <div class="proj-counts" style="margin-top:var(--sp-4)">
              <span class="proj-count is-open"><span class="pc-num">${g.open}</span><span class="pc-lbl">Open</span></span>
              <span class="proj-count is-done"><span class="pc-num">${g.done}</span><span class="pc-lbl">Done</span></span>
              <span class="proj-count ${g.overdue ? 'is-risk' : ''}"><span class="pc-num">${g.overdue}</span><span class="pc-lbl">Overdue</span></span>
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Details</div>
            <div class="p-row">
              <span class="p-key">Horizon</span>
              <span class="p-val">
                <select class="select" id="gld-horizon" style="height:30px;padding:0 26px 0 10px;font-size:var(--fs-xs);width:auto">
                  ${HORIZONS.map(h => `<option ${g.horizon === h ? 'selected' : ''}>${h}</option>`).join('')}
                </select>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Life area</span>
              <span class="p-val">
                <select class="select" id="gld-area" style="height:30px;padding:0 26px 0 10px;font-size:var(--fs-xs);width:auto">
                  ${LIFE_AREAS.map(a => `<option ${g.area === a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Target date</span>
              <span class="p-val">
                <input class="field" id="gld-deadline" value="${esc(g.deadline || '')}"
                  placeholder="—" style="height:30px;width:120px;text-align:right;font-size:var(--fs-xs)">
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Estimated work left</span>
              <span class="p-val">${g.openMinutes ? g.openMinutes + ' min' : '—'}</span>
            </div>
            <div class="p-row">
              <span class="p-key">Contributing projects</span>
              <span class="p-val">${linkedProjects.length ? esc(linkedProjects.join(', ')) : '—'}</span>
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Linked tasks · ${tasks.length}</div>
            ${tasks.length ? `
              <div class="pd-breakdown">
                ${tasks.map(t => `
                  <div class="pd-bd-row ${t.done ? 'is-done' : ''}" data-gld-task="${t.id}">
                    <span class="pd-bd-left">
                      <button class="check ${t.done ? 'is-done' : ''}" data-gld-toggle="${t.id}"
                        role="checkbox" aria-checked="${t.done}" aria-label="Toggle ${esc(t.title)}">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </button>
                      <span class="pd-bd-title">${esc(t.title)}</span>
                    </span>
                    <span class="t-faint t-sm" style="flex:0 0 auto">${esc(t.project || Derive.dueLabel(t.due))}</span>
                  </div>`).join('')}
              </div>`
              : `<div class="card-sub">
                   Nothing is linked to this goal yet.${linkable
                     ? ` You have ${linkable} unlinked task${linkable === 1 ? '' : 's'} waiting.`
                     : ''}
                 </div>`}
          </div>
        </div>

        <div class="panel-foot">
          <button class="btn btn-ghost btn-sm" data-gld-link>${icon('target', 13)} Link tasks</button>
          <button class="btn btn-ghost btn-sm act-danger" data-gld-del style="margin-left:auto">${icon('trash', 13)} Delete goal</button>
        </div>`;
    },

    _bind(panel) {
      if (!panel) return;

      panel.addEventListener('click', e => {
        if (e.target.closest('[data-gld-close]')) return this.close();

        const row = e.target.closest('[data-gld-task]');
        if (row && !e.target.closest('[data-gld-toggle]')) {
          const id = row.dataset.gldTask;
          this.close();
          return TaskDetail.open(id);
        }

        const tg = e.target.closest('[data-gld-toggle]');
        if (tg) {
          const t = State.toggleTask(tg.dataset.gldToggle);
          if (t) Toast.show(t.done ? `Completed “${t.title}”` : `Reopened “${t.title}”`,
            t.done ? 'good' : 'default');
          GoalsPage.render();
          Dashboard.render();
          return this.refresh();
        }

        if (e.target.closest('[data-gld-link]')) return this.openLinker(this.id);

        if (e.target.closest('[data-gld-del]')) {
          const g = Derive.goalStats(this.id);
          const wrap = Overlay.open(`
            <div class="modal-head">
              <div>
                <div class="t-eyebrow">Delete goal</div>
                <h2 class="t-h2" style="margin-top:6px">Remove this goal?</h2>
              </div>
              <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
            </div>
            <p class="t-sm t-muted">
              ${g.linked
                ? `The ${g.linked} linked task${g.linked === 1 ? '' : 's'} will be kept and simply unlinked.`
                : 'This goal has no linked tasks.'}
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" data-close>Cancel</button>
              <button class="btn btn-danger" id="gld-del-yes">${icon('trash', 14)} Delete goal</button>
            </div>`, { cls: 'modal-sm' });
          $('#gld-del-yes', wrap).addEventListener('click', () => {
            State.deleteGoal(this.id);
            Overlay.close();
            this.id = null;
            GoalsPage.render();
            Dashboard.render();
            Toast.show('Goal deleted · tasks kept and unlinked', 'default');
          });
          return;
        }
      });

      // Inline rename. The page *behind* the drawer must repaint too, otherwise
      // the card keeps the old name until the panel is closed.
      const nameEl = $('#gld-name', panel);
      if (nameEl) {
        let settled = false;
        const current = () => (Derive.allGoals().find(x => x.id === this.id) || {}).name;
        const commit = () => {
          if (settled) return;
          const v = nameEl.value.trim();
          if (!v || v === current()) return;
          settled = true;
          State.updateGoal(this.id, { name: v });
          GoalsPage.render();
          Dashboard.render();
          this.refresh();
          Toast.show('Goal renamed', 'good');
        };
        nameEl.addEventListener('blur', commit);
        nameEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
          if (e.key === 'Escape') { settled = true; nameEl.value = current() || ''; nameEl.blur(); }
        });
      }

      const hz = $('#gld-horizon', panel);
      if (hz) hz.addEventListener('change', () => {
        State.updateGoal(this.id, { horizon: hz.value });
        GoalsPage.render();
        this.refresh();
      });

      const ar = $('#gld-area', panel);
      if (ar) ar.addEventListener('change', () => {
        State.updateGoal(this.id, { area: ar.value });
        GoalsPage.render();
        this.refresh();
      });

      const dl = $('#gld-deadline', panel);
      if (dl) dl.addEventListener('change', () => {
        State.updateGoal(this.id, { deadline: dl.value.trim() || null });
        GoalsPage.render();
      });
    },

    /* ---- Task linker -----------------------------------------------------
       A searchable picker of the user's tasks with checkboxes. This is how a
       goal gets work attached to it — and therefore how its progress moves. */
    openLinker(goalId) {
      const goal = Derive.allGoals().find(g => g.id === goalId);
      if (!goal) { Toast.show('That goal no longer exists', 'warn'); return; }

      const candidates = State.tasks.filter(t => !t.archived);

      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">${esc(goal.name)}</div>
            <h2 class="t-h2" style="margin-top:6px">Link tasks to this goal</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <label class="field-group" style="margin-bottom:var(--sp-3)">
          <input class="field" id="lk-search" placeholder="Search tasks…" autofocus>
        </label>
        <div class="link-list" id="lk-list"></div>
        <div class="modal-actions">
          <span class="t-sm t-faint" id="lk-count" style="margin-right:auto"></span>
          <button class="btn btn-primary" data-close>Done</button>
        </div>`, { cls: 'modal-lg' });

      const listEl = $('#lk-list', wrap);
      const countEl = $('#lk-count', wrap);

      const paint = (q = '') => {
        const term = q.trim().toLowerCase();
        const rows = candidates
          .filter(t => !term || t.title.toLowerCase().includes(term) ||
            (t.project || '').toLowerCase().includes(term))
          .sort((a, b) => {
            const al = a.goalId === goalId ? 0 : 1, bl = b.goalId === goalId ? 0 : 1;
            return (al - bl) || (a.done - b.done) || a.title.localeCompare(b.title);
          });

        listEl.innerHTML = rows.length ? rows.map(t => `
          <label class="link-row ${t.goalId === goalId ? 'is-linked' : ''}">
            <input type="checkbox" data-lk="${t.id}" ${t.goalId === goalId ? 'checked' : ''}>
            <span class="link-row-main">
              <span class="link-row-title ${t.done ? 'is-done' : ''}">${esc(t.title)}</span>
              <span class="link-row-meta">
                ${t.project ? `<span class="badge">${esc(t.project)}</span>` : ''}
                <span class="t-faint t-sm">${esc(Derive.dueLabel(t.due))}</span>
                ${t.goalId && t.goalId !== goalId
                  ? `<span class="badge badge-warn">linked elsewhere</span>` : ''}
              </span>
            </span>
          </label>`).join('')
          : `<div class="empty" style="padding:var(--sp-5) 0">
               <h4 style="font-size:var(--fs-sm)">No tasks match “${esc(q)}”</h4>
               <p>Try another search term.</p>
             </div>`;

        const n = candidates.filter(t => t.goalId === goalId).length;
        countEl.textContent = `${n} linked`;

        $$('[data-lk]', listEl).forEach(cb => cb.addEventListener('change', () => {
          State.updateTask(cb.dataset.lk, { goalId: cb.checked ? goalId : null });
          listEl.querySelectorAll('.link-row').forEach(r => r.classList.remove('is-linked'));
          $$('[data-lk]', listEl).forEach(c => { if (c.checked) c.closest('.link-row').classList.add('is-linked'); });
          const m = candidates.filter(t => t.goalId === goalId).length;
          countEl.textContent = `${m} linked`;
          GoalsPage.render();
          Dashboard.render();
        }));
      };

      paint();
      const searchEl = $('#lk-search', wrap);
      searchEl.addEventListener('input', () => paint(searchEl.value));
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });

      /* When the picker closes, repaint the page and re-open the goal so the
         change is visible in context. We watch the overlay root itself and
         treat "root emptied" as the close signal — independent of which
         dismissal path was used (Done, backdrop, Escape, or a nested panel). */
      const root = $('#overlay-root');
      if (root) {
        const obs = new MutationObserver(() => {
          if (root.children.length) return;      // still open, or reopened
          obs.disconnect();
          GoalsPage.render();
          Dashboard.render();
          if (State.goals.some(g => g.id === goalId)) GoalDetail.open(goalId);
        });
        obs.observe(root, { childList: true });
      }

      setTimeout(() => searchEl.focus(), 40);
    },
  };

  /* ======================================================================
     HABITS — Milestone 20
     Every figure on this page is derived from each habit's `history` log of
     completion days. Nothing is stored: the streak, the best-ever run, the
     7/30-day rates and the 14-day strip are all read out of real history, so
     they cannot drift and they cannot be faked.
     ====================================================================== */
  const HABIT_ICONS = ['repeat','book','flame','focus','drop','bolt','star','target','pulse','heart'];
  const HABIT_COLORS = ['cyan','violet','magenta','indigo','blue'];

  const HabitsPage = {
    filter: 'all',      // all | strong | slipping | unstarted

    _filtered() {
      let list = Derive.habitSummary().habits;
      if (this.filter === 'strong')    list = list.filter(h => h.rate7 >= 6);
      if (this.filter === 'slipping')  list = list.filter(h => h.rate7 > 0 && h.rate7 <= 3);
      if (this.filter === 'unstarted') list = list.filter(h => h.total === 0);
      return list;
    },

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'habits') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Loading habits…</p></div></div></div>';
        return;
      }

      const s = Derive.habitSummary();
      const list = this._filtered();
      const doneToday = s.habits.filter(h => h.doneToday).length;

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>Habits</h1>
            <div class="sub">${doneToday} of ${s.total} done today · ${s.weekRate}% over the last 7 days · best run ${s.bestEver} day${s.bestEver === 1 ? '' : 's'}</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary btn-sm" id="hb-new">${icon('plus', 14)} New habit</button>
          </div>
        </div>

        <div class="proj-stats" style="margin-top:var(--sp-4)">
          ${Widgets.statTile({ icon:'check', label:'Done today', value:doneToday + '/' + s.total,
            meta: Math.round(s.progress * 100) + '% complete', accent:'var(--accent)' })}
          ${Widgets.statTile({ icon:'flame', label:'Longest live streak', value:s.bestStreak,
            meta: s.bestStreak ? 'days in a row' : 'nothing running', accent:'var(--warn)' })}
          ${Widgets.statTile({ icon:'pulse', label:'7-day rate', value:s.weekRate + '%',
            meta:'Across all habits', accent:'var(--cyan)' })}
          ${Widgets.statTile({ icon:'star', label:'Best ever', value:s.bestEver,
            meta:'Personal record', accent:'var(--violet)' })}
        </div>

        <div class="viewtabs" role="tablist" style="margin-top:var(--sp-4)">
          ${[
            ['all', 'All', s.total],
            ['strong', 'Strong', s.habits.filter(h => h.rate7 >= 6).length],
            ['slipping', 'Slipping', s.habits.filter(h => h.rate7 > 0 && h.rate7 <= 3).length],
            ['unstarted', 'Not started', s.habits.filter(h => h.total === 0).length],
          ].map(([k, label, n]) => `
            <button class="viewtab ${this.filter === k ? 'is-active' : ''}" data-hbfilter="${k}"
              role="tab" aria-selected="${this.filter === k}">
              ${label}<span class="vt-count">${n}</span>
            </button>`).join('')}
        </div>

        <div class="grid habit-grid" style="margin-top:var(--sp-4)">
          ${list.length ? list.map(h => this._card(h)).join('')
            : `<section class="card"><div class="empty">
                 <div class="empty-ic">${icon('repeat', 22)}</div>
                 <h4>${this.filter === 'all' ? 'No habits yet' : 'Nothing in this view'}</h4>
                 <p>${this.filter === 'all'
                   ? 'Habits are the things you do every day. Add one and check it off — streaks build themselves from real history.'
                   : 'Try a different filter.'}</p>
                 <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-hb-new>
                   ${icon('plus', 14)} New habit
                 </button>
               </div></section>`}
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Habits', `${doneToday}/${s.total} today`);
    },

    _card(h) {
      const color = `var(--${h.color || 'cyan'})`;
      const healthCls = h.health === 'At risk' ? 'badge-bad'
        : h.health === 'Slipping' ? 'badge-warn'
        : h.health === 'Unstarted' ? 'badge'
        : 'badge-good';

      return `
        <section class="card habit-card" data-hb="${esc(h.id)}">
          <div class="habit-card-top">
            <button class="habit-toggle habit-toggle-lg ${h.doneToday ? 'is-done' : ''}"
              data-hb-toggle="${esc(h.id)}" aria-pressed="${h.doneToday}"
              aria-label="Mark ${esc(h.name)} ${h.doneToday ? 'not done' : 'done'} today">
              ${icon(h.icon, 15)}
            </button>
            <div class="habit-card-id">
              <div class="habit-card-name" data-hb-open="${esc(h.id)}" role="button" tabindex="0">${esc(h.name)}</div>
              <div class="habit-card-sub">
                <span class="badge ${healthCls}">${esc(h.health)}</span>
                <span class="t-faint t-sm">${h.total} day${h.total === 1 ? '' : 's'} logged</span>
              </div>
            </div>
            <span class="habit-streak-lg" style="color:${color}" title="${h.streak} day streak">
              ${icon('flame', 13)}<span class="t-num">${h.streak}</span>
            </span>
          </div>

          <!-- 14-day strip: real history, one cell per day, oldest on the left -->
          <div class="hb-strip" aria-label="Last 14 days">
            ${h.strip.map(d => `
              <span class="hb-cell ${d.on ? 'is-on' : ''} ${d.isToday ? 'is-today' : ''}"
                style="${d.on ? `background:${color}` : ''}"
                title="${d.key}${d.isToday ? ' (today)' : ''}"></span>`).join('')}
          </div>

          <div class="hb-rates">
            <span class="hb-rate"><b class="t-num">${h.rate7}</b><small>last 7d</small></span>
            <span class="hb-rate"><b class="t-num">${h.rate30}</b><small>last 30d</small></span>
            <span class="hb-rate"><b class="t-num">${h.best}</b><small>best run</small></span>
          </div>

          <div class="proj-foot">
            <span class="proj-deadline">
              ${icon('calendar', 12)} ${h.doneToday ? 'Done today' : 'Not done today'}
            </span>
            <div class="row gap-1">
              <button class="btn btn-ghost btn-sm" data-hb-detail="${esc(h.id)}">Details</button>
              <button class="iconbtn" data-hb-open="${esc(h.id)}" aria-label="Habit details">${icon('arrowR', 14)}</button>
            </div>
          </div>
        </section>`;
    },

    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      $$('[data-hbfilter]', mount).forEach(b => b.addEventListener('click', () => {
        this.filter = b.dataset.hbfilter;
        this.render();
      }));

      const nu = $('#hb-new', mount);
      if (nu) nu.addEventListener('click', () => this.openNew());
      $$('[data-hb-new]', mount).forEach(b => b.addEventListener('click', () => this.openNew()));

      $$('[data-hb-toggle]', mount).forEach(b => b.addEventListener('click', () => {
        const h = State.toggleHabit(b.dataset.hbToggle);
        if (h) {
          const v = Derive.habitView(h);
          Toast.show(v.doneToday
            ? (v.streak > 1 ? `${h.name} · ${v.streak} day streak` : `${h.name} · done today`)
            : `${h.name} · unchecked`, v.doneToday ? 'good' : 'default');
        }
        this.render();
        Dashboard.render();
      }));

      $$('[data-hb-detail]', mount).forEach(b => b.addEventListener('click', () =>
        HabitDetail.open(b.dataset.hbDetail)));
      $$('[data-hb-open]', mount).forEach(b => {
        b.addEventListener('click', () => HabitDetail.open(b.dataset.hbOpen));
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); HabitDetail.open(b.dataset.hbOpen); }
        });
      });
    },

    openNew() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">New habit</div>
            <h2 class="t-h2" style="margin-top:6px">What will you do daily?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Habit</span>
            <input class="field" id="nh-name" placeholder="e.g. Walk 8,000 steps" autofocus>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Icon</span>
              <select class="select" id="nh-icon">
                ${HABIT_ICONS.map(i => `<option value="${i}">${i}</option>`).join('')}
              </select>
            </label>
            <label class="field-group">
              <span class="field-label">Colour</span>
              <select class="select" id="nh-color">
                ${HABIT_COLORS.map(c => `<option value="${c}">${c[0].toUpperCase() + c.slice(1)}</option>`).join('')}
              </select>
            </label>
          </div>
          <p class="t-sm t-muted" style="margin:0">
            Streaks and completion rates are calculated from the days you check
            off, so this starts with no history.
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="nh-save">Create habit</button>
        </div>`, { cls: 'modal-md' });

      const nameEl = $('#nh-name', wrap);
      const save = () => {
        const name = nameEl.value.trim();
        if (!name) { nameEl.focus(); Toast.show('Give the habit a name', 'warn'); return; }
        const h = State.addHabit({
          name,
          icon: $('#nh-icon', wrap).value,
          color: $('#nh-color', wrap).value,
        });
        Overlay.close();
        Toast.show(`Tracking “${name}”`, 'good');
        this.render();
        Dashboard.render();
        void h;
      };
      $('#nh-save', wrap).addEventListener('click', save);
      nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => nameEl.focus(), 40);
    },
  };

  /* ======================================================================
     HABIT DETAIL PANEL — Milestone 20
     The derived breakdown plus a real editable day strip: any past day can be
     toggled, so a missed day can be filled in honestly. Future days are
     rejected — you cannot have completed tomorrow.
     ====================================================================== */
  const HabitDetail = {
    id: null,
    days: 28,          // how much history the interactive strip shows

    open(id) {
      const h = State.habits.find(x => x.id === id);
      if (!h) { Toast.show('That habit no longer exists', 'warn'); return; }
      this.id = id;
      const panel = Overlay.panel(this._html(), { wide: true });
      this._bind(panel);
      return panel;
    },

    close() { Overlay.close(); this.id = null; },

    refresh() {
      const panel = $('.panel');
      if (!panel || !this.id) return;
      if (!State.habits.some(x => x.id === this.id)) { this.close(); return; }
      const body = $('.panel-body', panel);
      const scroll = body ? body.scrollTop : 0;
      panel.outerHTML = `<aside class="panel panel-wide" role="dialog" aria-modal="true">${this._html()}</aside>`;
      const next = $('.panel');
      this._bind(next);
      const nb = $('.panel-body', next);
      if (nb) nb.scrollTop = scroll;
    },

    _html() {
      const v = Derive.habitView(State.habits.find(x => x.id === this.id));
      const color = `var(--${v.color || 'cyan'})`;
      const healthCls = v.health === 'At risk' ? 'badge-bad'
        : v.health === 'Slipping' ? 'badge-warn'
        : v.health === 'Unstarted' ? 'badge' : 'badge-good';

      /* Interactive strip — every cell is a real toggle. */
      const cells = [];
      for (let i = this.days - 1; i >= 0; i--) {
        const d = shiftDays(new Date(), -i);
        const k = dayKey(d);
        const on = v.history.includes(k);
        cells.push({ key: k, on, day: d.getDate(),
          isToday: k === todayKey(),
          label: d.toLocaleDateString([], { weekday: 'short' }) });
      }

      /* 90-day heatmap, oldest-first, aligned so columns are weekdays. */
      const heat = [];
      const startOffset = 89;
      for (let i = startOffset; i >= 0; i--) {
        const d = shiftDays(new Date(), -i);
        const k = dayKey(d);
        heat.push({ key: k, on: v.history.includes(k), dow: (d.getDay() + 6) % 7 });
      }

      return `
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">Habit</div>
            <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
              <span class="badge ${healthCls}">${esc(v.health)}</span>
              ${v.streak ? `<span class="badge badge-good">${v.streak} day streak</span>` : ''}
              <span class="badge">${v.total} logged</span>
            </div>
          </div>
          <button class="iconbtn" data-hbd-close aria-label="Close habit details">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          <input class="panel-title" id="hbd-name" value="${esc(v.name)}"
            aria-label="Habit name" placeholder="Habit name">

          <div class="p-sec">
            <div class="p-label">Today</div>
            <button class="btn ${v.doneToday ? 'btn-ghost' : 'btn-primary'} btn-block" data-hbd-today>
              ${icon(v.doneToday ? 'x' : 'check', 14)}
              ${v.doneToday ? 'Mark as not done today' : 'Mark as done today'}
            </button>
          </div>

          <div class="p-sec">
            <div class="p-label">Streak</div>
            <div class="proj-prog">
              <div class="proj-prog-head">
                <span class="proj-pct" style="color:${color}">${v.streak}<span class="t-faint t-sm" style="font-weight:500"> day${v.streak === 1 ? '' : 's'}</span></span>
                <span class="t-faint t-sm">best ${v.best}</span>
              </div>
              <div class="proj-bar"><div class="proj-bar-fill" style="width:${v.best ? (v.streak / v.best) * 100 : 0}%;background:${color}"></div></div>
            </div>
            <div class="proj-counts" style="margin-top:var(--sp-4)">
              <span class="proj-count is-done"><span class="pc-num">${v.rate7}</span><span class="pc-lbl">last 7d</span></span>
              <span class="proj-count is-open"><span class="pc-num">${v.rate30}</span><span class="pc-lbl">last 30d</span></span>
              <span class="proj-count"><span class="pc-num">${v.best}</span><span class="pc-lbl">best run</span></span>
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Last ${this.days} days · tap to edit</div>
            <div class="hbd-strip">
              ${cells.map(c => `
                <button class="hbd-cell ${c.on ? 'is-on' : ''} ${c.isToday ? 'is-today' : ''}"
                  style="${c.on ? `background:${color};border-color:${color}` : ''}"
                  data-hbd-day="${c.key}"
                  aria-pressed="${c.on}"
                  aria-label="${c.label} ${c.day}${c.on ? ' completed' : ' not completed'}"
                  title="${c.key}"><span>${c.day}</span></button>`).join('')}
            </div>
            <div class="hbd-legend t-faint t-sm" style="margin-top:10px">
              Click any past day to fill it in or undo it. Future days cannot be logged.
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Last 90 days</div>
            <div class="hbd-heat" aria-label="90 day heatmap">
              ${heat.map(d => `<span class="hbd-heat-cell ${d.on ? 'is-on' : ''}"
                style="${d.on ? `background:${color}` : ''}" title="${d.key}"></span>`).join('')}
            </div>
          </div>
        </div>

        <div class="panel-foot">
          <button class="btn btn-ghost btn-sm" data-hbd-edit>${icon('edit', 13)} Rename</button>
          <button class="btn btn-ghost btn-sm act-danger" data-hbd-del style="margin-left:auto">${icon('trash', 13)} Delete habit</button>
        </div>`;
    },

    _bind(panel) {
      if (!panel) return;

      panel.addEventListener('click', e => {
        if (e.target.closest('[data-hbd-close]')) return this.close();

        if (e.target.closest('[data-hbd-today]')) {
          State.toggleHabit(this.id);
          HabitsPage.render();
          Dashboard.render();
          return this.refresh();
        }

        const cell = e.target.closest('[data-hbd-day]');
        if (cell) {
          const key = cell.dataset.hbdDay;
          const h = State.toggleHabitDay(this.id, key);
          if (!h) { Toast.show('You cannot log a future day', 'warn'); return; }
          HabitsPage.render();
          Dashboard.render();
          return this.refresh();
        }

        if (e.target.closest('[data-hbd-edit]')) {
          const el2 = $('#hbd-name', panel);
          if (el2) { el2.focus(); el2.select(); }
          return;
        }

        if (e.target.closest('[data-hbd-del]')) {
          const v = Derive.habitView(State.habits.find(x => x.id === this.id));
          const wrap = Overlay.open(`
            <div class="modal-head">
              <div>
                <div class="t-eyebrow">Delete habit</div>
                <h2 class="t-h2" style="margin-top:6px">Remove “${esc(v.name)}”?</h2>
              </div>
              <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
            </div>
            <p class="t-sm t-muted">
              ${v.total
                ? `This deletes ${v.total} logged day${v.total === 1 ? '' : 's'} of history, including a best run of ${v.best} day${v.best === 1 ? '' : 's'}. This cannot be undone.`
                : 'This habit has no logged history.'}
            </p>
            <div class="modal-actions">
              <button class="btn btn-ghost" data-close>Cancel</button>
              <button class="btn btn-danger" id="hbd-del-yes">${icon('trash', 14)} Delete habit</button>
            </div>`, { cls: 'modal-sm' });
          $('#hbd-del-yes', wrap).addEventListener('click', () => {
            State.deleteHabit(this.id);
            Overlay.close();
            this.id = null;
            HabitsPage.render();
            Dashboard.render();
            Toast.show('Habit deleted', 'default');
          });
          return;
        }
      });

      // Inline rename — repaint the page behind the drawer too.
      const nameEl = $('#hbd-name', panel);
      if (nameEl) {
        let settled = false;
        const current = () => (State.habits.find(x => x.id === this.id) || {}).name;
        const commit = () => {
          if (settled) return;
          const val = nameEl.value.trim();
          if (!val || val === current()) return;
          settled = true;
          State.updateHabit(this.id, { name: val });
          HabitsPage.render();
          Dashboard.render();
          this.refresh();
          Toast.show('Habit renamed', 'good');
        };
        nameEl.addEventListener('blur', commit);
        nameEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
          if (e.key === 'Escape') { settled = true; nameEl.value = current() || ''; nameEl.blur(); }
        });
      }
    },
  };

  /* ======================================================================
     CALENDAR — Milestone 19
     A real month grid built from workspace data: every event in
     State.upcoming, plus open tasks whose due token resolves to a day. Nothing
     here is a decoration — clicking a day shows exactly what is on it, and
     clicking an item opens the same detail panels used elsewhere.
     ====================================================================== */
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const EVENT_KINDS = ['event','review','health','learning','focus'];
  const EVENT_COLORS = ['#6366F1','#8B5CF6','#06B6D4','#4ADE9B','#F59E0B','#EC4899'];

  /* ======================================================================
     FOCUS PAGE — Milestone 21
     The Focus subsystem in full: a real pomodoro engine, a session log that
     persists, and analytics derived entirely from that log.

     Nothing on this page is stored. Today's total, the week, the month, the
     streak, the trend bars and the per-task / per-project breakdowns are all
     recomputed from State.focus on every render — which is why logging a
     single block moves the dashboard ring, this page, and the NEXUS Score's
     focus component together.
     ====================================================================== */
  const FocusPage = {
    logDays: 7,        // how many days of session history the log shows

    /* Minutes → a short human duration: 45m · 2h · 1h 20m */
    _dur(min) {
      const m = Math.max(0, Math.round(Number(min) || 0));
      if (m < 60) return m + 'm';
      const h = Math.floor(m / 60), r = m % 60;
      return r ? h + 'h ' + r + 'm' : h + 'h';
    },

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'focus') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Loading focus…</p></div></div></div>';
        return;
      }

      const fs = Derive.focusSummary();
      const pct = Math.round(fs.progress * 100);

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>Focus</h1>
            <div class="sub">${this._dur(fs.todayMin)} today · ${fs.streak} day streak · ${this._dur(fs.monthMin)} this month</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary btn-sm" data-focus-toggle>
              ${Focus.running ? icon('pause', 14) + ' Pause' : icon('play', 14) + ' Start'}
            </button>
          </div>
        </div>

        <div class="proj-stats" style="margin-top:var(--sp-4)">
          ${Widgets.statTile({ icon:'focus', label:'Focused today', value:this._dur(fs.todayMin),
            meta:`${pct}% of a ${this._dur(fs.target)} target`, accent:'var(--violet)' })}
          ${Widgets.statTile({ icon:'pulse', label:'This week', value:this._dur(fs.weekMin),
            meta:`${fs.sessions} block${fs.sessions === 1 ? '' : 's'} logged`, accent:'var(--cyan)' })}
          ${Widgets.statTile({ icon:'clock', label:'Average block', value:fs.avgMin + 'm',
            meta: fs.activeDays ? `${this._dur(fs.perActiveDay)} per active day` : 'No sessions yet', accent:'var(--indigo)' })}
          ${Widgets.statTile({ icon:'flame', label:'Day streak', value:fs.streak,
            meta: fs.best ? `best day ${this._dur(fs.best.minutes)}` : 'nothing running', accent:'var(--warn)' })}
        </div>

        <div class="focus-layout" style="margin-top:var(--sp-4)">
          <div class="focus-main">
            ${this._hero(fs)}
            ${this._trend(fs)}
            ${this._log()}
          </div>
          <div class="focus-side">
            ${this._target(fs)}
            ${this._byTask(fs)}
            ${this._byProject(fs)}
          </div>
        </div>
      ` }));

      this.bind();
      // A block may already be running — show its real clock, ring and state.
      Focus.sync();
      Shell.setHeader('Focus', `${this._dur(fs.todayMin)} today`);
    },

    /* --- The cinematic timer -------------------------------------------- */
    _hero(fs) {
      const mode = Focus.mode;
      return `
        <section class="card focus-card" id="focus-hero">
          <div class="focus-bg" aria-hidden="true"></div>
          <div class="focus-inner">
            <div class="row-between">
              <div class="card-title">Focus Mode</div>
              <span class="badge badge-dot" style="color:var(--good)">${esc(Focus.label())}</span>
            </div>

            <div class="focus-modes" role="group" aria-label="Session length">
              ${FOCUS_MODES.map(m => `
                <button class="focus-mode ${mode === m.id ? 'is-active' : ''}"
                  data-focus-mode="${m.id}" aria-pressed="${mode === m.id}">
                  ${icon(m.icon, 12)} ${m.label}
                  <span class="fm-min">${m.id === 'focus' ? Focus.minutes() : m.minutes}m</span>
                </button>`).join('')}
            </div>

            <div class="focus-center">
              ${Widgets.ring(1, { size: 156, stroke: 9, label: clock(Focus.remaining), sub: 'remaining',
                grad: 'focus', id: 'focusRing', color: '#8B5CF6' })}
            </div>

            <div class="row gap-2" style="justify-content:center;margin-top:18px">
              <button class="btn btn-primary" data-focus-toggle>
                ${Focus.running ? icon('pause', 14) + ' Pause' : icon('play', 14) + ' Start'}
              </button>
              <button class="btn btn-ghost" data-focus-reset>${icon('reset', 14)} Reset</button>
              <button class="iconbtn tip" data-tip="Custom length" data-focus-custom
                aria-label="Set a custom session length">${icon('settings', 15)}</button>
            </div>

            <div class="focus-link">
              <span class="t-eyebrow" style="flex:0 0 auto">Working on</span>
              <select class="select" id="focusTask" aria-label="Task this session is attributed to">
                ${this._linkOptions()}
              </select>
            </div>

            <div class="focus-foot">
              <span>${this._dur(fs.todayMin)} today</span>
              <span class="dot-sep"></span>
              <span>${this._dur(fs.monthMin)} this month</span>
              <span class="dot-sep"></span>
              <span>${fs.streak} day streak</span>
            </div>
          </div>
        </section>`;
    },

    /* Open tasks a session can be attributed to. A task that was deleted while
       selected is surfaced honestly instead of silently vanishing. */
    _linkOptions() {
      const open = State.tasks.filter(t => !t.done && !t.archived);
      const cur = Focus.taskId;
      const known = open.some(t => t.id === cur);
      return '<option value="">No task — just focus</option>'
        + (cur && !known ? `<option value="${esc(cur)}" selected>(removed task)</option>` : '')
        + open.map(t => `<option value="${esc(t.id)}"${t.id === cur ? ' selected' : ''}>`
            + `${esc(t.title)} · ${esc(t.project || 'Personal')}</option>`).join('');
    },

    /* --- 14-day trend --------------------------------------------------- */
    _trend(fs) {
      const max = fs.maxRange;
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Last 14 days</div>
              <div class="card-sub">${this._dur(fs.weekMin)} in the last 7 · ${this._dur(fs.monthMin)} this month</div>
            </div>
            <span class="badge badge-dot">${fs.activeDays} active day${fs.activeDays === 1 ? '' : 's'}</span>
          </div>
          <div class="focus-trend">
            ${fs.range.map(d => `
              <div class="ft tip ${d.isToday ? 'is-today' : ''} ${d.minutes ? '' : 'is-empty'}"
                data-tip="${d.key} · ${this._dur(d.minutes)}">
                <i style="height:${d.minutes ? Math.max(5, Math.round(d.minutes / max * 100)) : 3}%"></i>
                <small>${DOW[d.dow][0]}</small>
              </div>`).join('')}
          </div>
        </section>`;
    },

    /* --- Session log ---------------------------------------------------- */
    _log() {
      const byDay = new Map();
      (State.focus || []).slice().sort((a, b) => b.startedAt - a.startedAt).forEach(s => {
        if (!byDay.has(s.day)) byDay.set(s.day, []);
        byDay.get(s.day).push(s);
      });
      const days = [...byDay.keys()].sort().reverse().slice(0, this.logDays);
      const total = (State.focus || []).length;

      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Session log</div>
              <div class="card-sub">Every block you completed — real records, removable</div>
            </div>
            <span class="badge badge-dot">${total} record${total === 1 ? '' : 's'}</span>
          </div>
          ${days.length ? `<div class="flog">${days.map(key => `
            <div class="flog-day">
              <span>${esc(this._dayLabel(key))}</span>
              <span class="t-num">${this._dur(Derive.focusDay(key))}</span>
            </div>
            ${byDay.get(key).map(s => this._logRow(s)).join('')}
          `).join('')}</div>` : `<div class="empty">
            <div class="empty-ic">${icon('focus', 22)}</div>
            <h4>No sessions yet</h4>
            <p>Start the timer and finish a block. It gets recorded here, and every
               figure on this page — today, the week, the streak, the score — updates
               from that record.</p>
          </div>`}
        </section>`;
    },

    _logRow(s) {
      const t = s.taskId ? State.tasks.find(x => x.id === s.taskId) : null;
      const brk = s.mode === 'break';
      const time = new Date(s.startedAt);
      const hh = time.getHours();
      const h12 = ((hh % 12) || 12) + ':' + String(time.getMinutes()).padStart(2, '0')
        + ' ' + (hh < 12 ? 'AM' : 'PM');
      const meta = brk ? 'Break'
        : (t ? (t.project ? esc(t.project) : 'Personal') : 'Not linked to a task');
      return `
        <div class="flog-row ${brk ? 'is-break' : ''}">
          <span class="flog-ic">${icon(brk ? 'clock' : 'focus', 13)}</span>
          <div class="grow" style="min-width:0">
            <div class="t-truncate t-sm" style="font-weight:var(--fw-medium)">
              ${brk ? 'Break' : (t ? esc(t.title) : 'Focus block')}
            </div>
            <div class="t-faint t-sm">${h12} · ${meta}</div>
          </div>
          <span class="t-num t-sm">${s.minutes}m</span>
          <button class="iconbtn flog-del" data-focus-del="${esc(s.id)}"
            aria-label="Delete this session">${icon('x', 14)}</button>
        </div>`;
    },

    _dayLabel(key) {
      if (key === todayKey()) return 'Today';
      if (key === dayKey(shiftDays(new Date(), -1))) return 'Yesterday';
      const parts = key.split('-').map(Number);
      return `${parts[2]} ${MONTHS[parts[1] - 1]}`;
    },

    /* --- Aside: target, by task, by project ----------------------------- */
    _target(fs) {
      const pct = Math.round(fs.progress * 100);
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Daily target</div>
            <button class="btn btn-sm btn-ghost" data-focus-target>Change</button>
          </div>
          <div class="row gap-4" style="align-items:center">
            ${Widgets.ring(fs.progress, { size: 84, stroke: 7, label: pct + '%', grad: 'goal' })}
            <div class="grow" style="min-width:0">
              <div style="font-size:15px;font-weight:600">${this._dur(fs.todayMin)} of ${this._dur(fs.target)}</div>
              <div class="card-sub" style="margin-top:5px">${pct >= 100
                ? 'Target reached — anything more is a bonus.'
                : this._dur(fs.target - fs.todayMin) + ' to go today'}</div>
            </div>
          </div>
          <div class="fstat"><span class="t-muted t-sm">Sessions logged</span><b class="t-num">${fs.sessions}</b></div>
          <div class="fstat"><span class="t-muted t-sm">Active days</span><b class="t-num">${fs.activeDays}</b></div>
          <div class="fstat"><span class="t-muted t-sm">All-time focus</span><b class="t-num">${this._dur(fs.totalMin)}</b></div>
        </section>`;
    },

    _byTask(fs) {
      const rows = fs.byTask;
      const max = Math.max(1, ...rows.map(r => r.minutes));
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Time by task</div>
            <span class="badge badge-dot">${rows.length}</span>
          </div>
          ${rows.length ? rows.map(r => `
            <div class="fstat" style="display:block">
              <div class="row-between" style="gap:8px">
                <span class="t-truncate t-sm ${r.gone ? 't-faint' : ''}">${esc(r.title)}</span>
                <b class="t-num t-sm">${this._dur(r.minutes)}</b>
              </div>
              <div class="bar bar-sm" style="margin-top:7px">
                <div class="bar-fill brand" style="width:${Math.round(r.minutes / max * 100)}%"></div>
              </div>
            </div>`).join('')
            : `<div class="t-faint t-sm" style="padding:var(--sp-2) 0">
                 No session has been linked to a task yet. Pick one under
                 “Working on” and it will show up here.
               </div>`}
        </section>`;
    },

    _byProject(fs) {
      const rows = fs.byProject;
      const max = Math.max(1, ...rows.map(r => r.minutes));
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Time by project</div>
            <span class="badge badge-dot">${rows.length}</span>
          </div>
          ${rows.length ? rows.map(r => `
            <div class="fstat" style="display:block">
              <div class="row-between" style="gap:8px">
                <span class="t-truncate t-sm">${esc(r.project)}</span>
                <b class="t-num t-sm">${this._dur(r.minutes)}</b>
              </div>
              <div class="bar bar-sm" style="margin-top:7px">
                <div class="bar-fill" style="width:${Math.round(r.minutes / max * 100)}%"></div>
              </div>
            </div>`).join('')
            : `<div class="t-faint t-sm" style="padding:var(--sp-2) 0">
                 Link a session to a task and its project total appears here.
               </div>`}
        </section>`;
    },

    /* --- Wiring --------------------------------------------------------- */
    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      $$('[data-focus-mode]', mount).forEach(b => b.addEventListener('click', () =>
        Focus.setMode(b.dataset.focusMode)));

      $$('[data-focus-toggle]', mount).forEach(b => b.addEventListener('click', () =>
        (Focus.running ? Focus.pause() : Focus.start())));

      const rst = $('[data-focus-reset]', mount);
      if (rst) rst.addEventListener('click', () => {
        Focus.reset(); Toast.show('Timer reset', 'default');
      });

      const sel = $('#focusTask', mount);
      if (sel) sel.addEventListener('change', () => {
        Focus.taskId = sel.value || null;
        Toast.show(sel.value ? 'Sessions will be attributed to this task'
                             : 'Sessions will be unlinked', 'default');
      });

      const tgt = $('[data-focus-target]', mount);
      if (tgt) tgt.addEventListener('click', () => this.openTarget());

      $$('[data-focus-custom]', mount).forEach(b =>
        b.addEventListener('click', () => this.openCustom()));

      $$('[data-focus-del]', mount).forEach(b => b.addEventListener('click', () => {
        const s = State.deleteSession(b.dataset.focusDel);
        if (!s) return;
        Toast.show(`Removed a ${s.minutes} min session`, 'default');
        this.render();
        Dashboard.render();
      }));
    },

    /* Custom block length — the "custom timer" path of the pomodoro engine. */
    openCustom() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Custom timer</div>
            <h2 class="t-h2" style="margin-top:6px">How long is this block?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Minutes</span>
            <input class="field" id="fc-min" type="number" min="1" max="180" step="5" value="${Focus.minutes()}">
          </label>
          <p class="t-sm t-muted" style="margin:0">
            Focus blocks run 1–180 minutes. Choosing a length switches the timer to
            Focus mode with that length; it does not change anything already logged.
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="fc-save">Set length</button>
        </div>`, { cls: 'modal-sm' });

      const input = $('#fc-min', wrap);
      const save = () => {
        const n = Math.round(Number(input.value));
        if (!(n >= 1 && n <= 180)) {
          Toast.show('Pick between 1 and 180 minutes', 'warn'); input.focus(); return;
        }
        Overlay.close();
        Focus.setMode('focus', n);
        Toast.show(`Focus block set to ${n} minutes`, 'good');
      };
      $('#fc-save', wrap).addEventListener('click', save);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => input.focus(), 40);
    },

    /* The daily target is a preference — it lives in Settings, and changing it
       never touches a single logged session. */
    openTarget() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Daily target</div>
            <h2 class="t-h2" style="margin-top:6px">How much focus is a good day?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Minutes per day</span>
            <input class="field" id="ft-min" type="number" min="15" max="720" step="15" value="${Derive.focusTarget()}">
          </label>
          <p class="t-sm t-muted" style="margin:0">
            This only moves the goal line — it never changes the sessions you have
            already logged.
          </p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="ft-save">Save target</button>
        </div>`, { cls: 'modal-sm' });

      const input = $('#ft-min', wrap);
      const save = () => {
        const n = State.setFocusTarget(input.value);
        if (n == null) { Toast.show('Pick between 15 and 720 minutes', 'warn'); input.focus(); return; }
        Overlay.close();
        Toast.show(`Daily target set to ${this._dur(n)}`, 'good');
        this.render();
        Dashboard.render();
      };
      $('#ft-save', wrap).addEventListener('click', save);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => input.focus(), 40);
    },
  };

  /* ======================================================================
     NOTES PAGE — Milestone 22
     Notes are the first genuinely authored content in NEXUS, so a note's body
     is stored rather than derived. Everything *about* the collection — tag
     counts, favourite counts, sort order, search ranking — is computed at
     render time.

     Desktop is a two-pane editor; on a phone the list fills the screen and a
     note opens in a full-height panel. Both paths share one editor markup
     builder and one binding function, so there is only ever one editor to keep
     correct. The editor is never re-rendered on save — the list is repainted
     instead — so the caret is never disturbed and no blur/commit double-fire
     is possible.
     ====================================================================== */
  const NotesPage = {
    q: '',
    filter: 'all',      // all | fav | pinned | untagged
    tag: null,          // active tag filter
    selected: null,     // note id shown in the editor pane
    readMode: false,    // body shown as rendered text (wiki links live) vs raw
    _saveTimer: null,

    /* --- selection ------------------------------------------------------ */
    _visible() {
      let list = Derive.notesSorted();
      if (this.tag) list = list.filter(n => (n.tags || []).includes(this.tag));
      if (this.filter === 'fav')      list = list.filter(n => n.favorite);
      if (this.filter === 'pinned')   list = list.filter(n => n.pinned);
      if (this.filter === 'untagged') list = list.filter(n => !(n.tags || []).length);
      if (this.q.trim()) list = Derive.noteSearch(this.q, list).map(r => r.note);
      return list;
    },
    /* The note the editor shows: the selection if it is still visible,
       otherwise the first note in the current view. */
    _current() {
      const list = this._visible();
      if (!list.length) return null;
      return list.find(n => n.id === this.selected) || list[0];
    },
    _isMobile() { return window.matchMedia('(max-width: 1080px)').matches; },

    /* --- render --------------------------------------------------------- */
    render(opts) {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'notes') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Opening your notes…</p></div></div></div>';
        return;
      }

      /* `open` lets another page (Knowledge, the palette) say "show me this
         note". It must be applied before _current() picks the selection. */
      if (opts && opts.open && State.noteById(opts.open)) this.selected = opts.open;

      const s = Derive.notesList();
      const cur = this._current();
      this.selected = cur ? cur.id : null;

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div id="nt-top">${this._topHtml()}</div>

        <div class="notes-layout" style="margin-top:var(--sp-4)">
          <div class="notes-listpane">
            <div class="nt-count" id="nt-count">${this._countLine(s)}</div>
            <div class="notes-list" id="notes-list">${this._listHtml()}</div>
          </div>
          <div class="notes-editpane" id="note-editor">${this._editorHtml(cur)}</div>
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Notes', `${s.total} note${s.total === 1 ? '' : 's'}`);
      // On a phone the editor is a panel, so "open this note" has to open one.
      if (opts && opts.open && this._isMobile()) this.openPanel(this.selected);
    },

    /* Head + tiles + toolbar + tag row. Kept as one repaintable region so that
       adding a tag updates the tag row and the counts WITHOUT touching the
       editor — the body textarea must never be rebuilt while it has focus. */
    _topHtml() {
      const s = Derive.notesList();
      return `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Knowledge</div>
            <h1>Notes</h1>
            <div class="sub">${this._summaryLine(s)}</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary btn-sm" id="nt-new">${icon('plus', 14)} New note</button>
          </div>
        </div>

        <div class="proj-stats" style="margin-top:var(--sp-4)">
          ${Widgets.statTile({ icon:'note', label:'Notes', value:s.total,
            meta:`${fmt(s.words)} words written`, accent:'var(--accent)' })}
          ${Widgets.statTile({ icon:'star', label:'Favourites', value:s.favorites,
            meta:'kept close', accent:'var(--warn)' })}
          ${Widgets.statTile({ icon:'tag', label:'Tagged', value:s.tagged,
            meta:`${s.tags.length} tag${s.tags.length === 1 ? '' : 's'} in use`, accent:'var(--cyan)' })}
          ${Widgets.statTile({ icon:'clock', label:'Last edited',
            value: s.lastEdited ? Derive.relTime(s.lastEdited.updatedAt) : '—',
            meta: s.lastEdited ? s.lastEdited.title : 'nothing yet', accent:'var(--violet)' })}
        </div>

        <div class="notes-tools" style="margin-top:var(--sp-4)">
          <label class="notes-search">
            ${icon('search', 14)}
            <input id="nt-search" type="search" placeholder="Search notes…"
              value="${esc(this.q)}" aria-label="Search notes" autocomplete="off">
          </label>
          <div class="viewtabs" role="tablist">
            ${[['all', 'All', s.total], ['fav', 'Favourites', s.favorites],
               ['pinned', 'Pinned', s.pinned], ['untagged', 'Untagged', s.untagged]]
              .map(([k, label, n]) => `
                <button class="viewtab ${this.filter === k ? 'is-active' : ''}" data-nt-filter="${k}"
                  role="tab" aria-selected="${this.filter === k}">${label}<span class="vt-count">${n}</span></button>`).join('')}
          </div>
        </div>

        <div class="nt-tagrow" role="group" aria-label="Filter by tag">
          <button class="nt-tag ${this.tag ? '' : 'is-on'}" data-nt-tag="">All tags</button>
          ${s.tags.map(t => `
            <button class="nt-tag ${this.tag === t.tag ? 'is-on' : ''}" data-nt-tag="${esc(t.tag)}">
              ${esc(t.tag)}<span class="nt-tag-n">${t.count}</span>
            </button>`).join('')}
          ${s.tags.length ? '' : '<span class="t-faint t-sm">No tags yet — add one in the editor.</span>'}
        </div>`;
    },

    /* Repaint the head/tiles/toolbar/tag row only. */
    renderTop() {
      const mount = $('#page-mount');
      if (!mount) return;
      const top = $('#nt-top', mount);
      if (!top) return;
      top.innerHTML = this._topHtml();
      this._bindTop(mount);
      const s = Derive.notesList();
      Shell.setHeader('Notes', `${s.total} note${s.total === 1 ? '' : 's'}`);
    },

    _summaryLine(s) {
      if (!s.total) return 'Capture ideas, plans and research — searchable, and yours alone.';
      const bits = [`${s.total} note${s.total === 1 ? '' : 's'}`];
      if (s.favorites) bits.push(`${s.favorites} favourite${s.favorites === 1 ? '' : 's'}`);
      if (s.tags.length) bits.push(`${s.tags.length} tag${s.tags.length === 1 ? '' : 's'}`);
      bits.push(`${fmt(s.words)} words`);
      return bits.join(' · ');
    },

    _countLine(s) {
      const n = this._visible().length;
      if (n === s.total) return `${s.total} note${s.total === 1 ? '' : 's'}`;
      return `${n} of ${s.total} shown`;
    },

    /* --- list ----------------------------------------------------------- */
    _listHtml() {
      const list = this._visible();
      if (!list.length) {
        const filtered = !!(this.q.trim() || this.tag || this.filter !== 'all');
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon(filtered ? 'search' : 'note', 22)}</div>
          <h4>${filtered ? 'Nothing matches' : 'No notes yet'}</h4>
          <p>${filtered
            ? 'Try a different search, tag or filter.'
            : 'Notes are where the thinking lives — ideas, plans, research. Write one and it is searchable instantly.'}</p>
          ${filtered ? '' : `<button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-nt-new>${icon('plus', 14)} New note</button>`}
        </div></div>`;
      }
      return list.map(n => this._card(n)).join('');
    },

    _card(n) {
      const words = Derive.noteWords(n);
      const tags = n.tags || [];
      const path = Derive.notePath(n.id);
      const kids = Derive.noteChildren(n.id).length;
      const refs = (n.refs || []).length;
      /* Files attached to this note, read the same way the note's own panel and
         the Files page read them — by scanning the file collection's pointers —
         so the three cannot disagree. (M42) */
      const files = Derive.filesFor('note', n.id).length;
      return `
        <article class="note-card ${n.id === this.selected ? 'is-sel' : ''}" data-nt-open="${esc(n.id)}"
          role="button" tabindex="0" aria-label="Open note ${esc(n.title)}">
          <div class="nc-top">
            <h3 class="nc-title">${esc(n.title)}</h3>
            <span class="nc-marks">
              ${n.pinned ? `<span class="nc-mark" title="Pinned">${icon('flag', 11)}</span>` : ''}
              ${n.favorite ? `<span class="nc-mark is-fav" title="Favourite">${icon('star', 11)}</span>` : ''}
            </span>
          </div>
          ${path.length ? `<div class="nc-path">${path.map(p => esc(p.title)).join(' / ')}</div>` : ''}
          ${n.body.trim()
            ? `<p class="nc-excerpt">${esc(Derive.noteExcerpt(n))}</p>`
            : '<p class="nc-excerpt is-empty">No content yet</p>'}
          <div class="nc-foot">
            <span class="nc-tags">
              ${tags.slice(0, 3).map(t => `<span class="tagpill">${esc(t)}</span>`).join('')}
              ${tags.length > 3 ? `<span class="tagpill">+${tags.length - 3}</span>` : ''}
              ${kids ? `<span class="tagpill nc-kids">${icon('folder', 9)} ${kids}</span>` : ''}
              ${refs ? `<span class="tagpill nc-refs">${icon('layers', 9)} ${refs}</span>` : ''}
              ${files ? `<span class="tagpill nc-files" title="${files} attached file${files === 1 ? '' : 's'}">${icon('clip', 9)} ${files}</span>` : ''}
            </span>
            <span class="nc-time">${esc(Derive.relTime(n.updatedAt))}${words ? ' · ' + words + 'w' : ''}</span>
          </div>
        </article>`;
    },

    /* --- editor --------------------------------------------------------- */
    _editorHtml(n) {
      if (!n) {
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon('note', 22)}</div>
          <h4>Nothing selected</h4>
          <p>Pick a note from the list, or start a new one.</p>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-nt-new>${icon('plus', 14)} New note</button>
        </div></div>`;
      }
      const words = Derive.noteWords(n);
      return `
        <div class="card note-editor" data-nt-editor="${esc(n.id)}">
          <div class="ne-head">
            <input class="ne-title" value="${esc(n.title)}" placeholder="Untitled note"
              aria-label="Note title" autocomplete="off">
            <div class="row gap-1">
              <button class="btn btn-sm btn-ghost" data-ne-readtoggle>
                ${this.readMode ? icon('edit', 13) + ' Write' : icon('book', 13) + ' Read'}
              </button>
              <button class="iconbtn ${n.favorite ? 'is-on' : ''}" data-ne-fav
                aria-pressed="${n.favorite}"
                aria-label="${n.favorite ? 'Remove from favourites' : 'Add to favourites'}">${icon('star', 15)}</button>
              <button class="iconbtn ${n.pinned ? 'is-on' : ''}" data-ne-pin
                aria-pressed="${n.pinned}"
                aria-label="${n.pinned ? 'Unpin note' : 'Pin note'}">${icon('flag', 15)}</button>
              <button class="iconbtn" data-ne-del aria-label="Delete note">${icon('trash', 15)}</button>
            </div>
          </div>

          <div class="p-chips ne-tags" data-ne-tags>
            ${(n.tags || []).map(t => `
              <span class="tagpill">${esc(t)}<button class="ne-tagx" data-ne-untag="${esc(t)}"
                aria-label="Remove tag ${esc(t)}">${icon('x', 10)}</button></span>`).join('')}
            <input class="field ne-tagin" placeholder="Add tag…" aria-label="Add a tag" autocomplete="off">
          </div>

          ${this.readMode
            ? this._renderBody(n)
            : `<textarea class="textarea ne-body" placeholder="Start writing…"
                 aria-label="Note body">${esc(n.body)}</textarea>`}

          ${this._relationsHtml(n)}

          <div class="ne-foot">
            <span class="t-faint t-sm">${words} word${words === 1 ? '' : 's'}</span>
            <span class="dot-sep"></span>
            <span class="t-faint t-sm">Edited ${esc(Derive.relTime(n.updatedAt))}</span>
            <span class="grow"></span>
            <span class="ne-status t-faint t-sm" data-ne-status></span>
          </div>
        </div>`;
    },

    /* Rendered read view. `[[Title]]` becomes a real link when a note has that
       title and a dashed, honest placeholder when it does not — the text is
       escaped piece by piece, so a note containing markup cannot inject it. */
    _renderBody(n) {
      const text = String(n.body || '').replace(/\r\n?/g, '\n').trim();
      if (!text) return '<div class="ne-read is-empty">Nothing written yet.</div>';

      const inline = (raw) => {
        let out = '', last = 0, m;
        const re = /\[\[([^\[\]\n]{1,140})\]\]/g;
        while ((m = re.exec(raw)) !== null) {
          out += esc(raw.slice(last, m.index));
          const title = m[1].trim();
          const hit = (State.notes || []).find(x => x.title.toLowerCase() === title.toLowerCase());
          out += hit
            ? `<button class="ne-wikilink" data-ne-goto="${esc(hit.id)}">${esc(title)}</button>`
            : `<span class="ne-wikilink is-broken" title="No note has this title yet">${esc(title)}</span>`;
          last = m.index + m[0].length;
        }
        out += esc(raw.slice(last));
        return out;
      };

      const paras = text.split(/\n{2,}/)
        .map(p => `<p>${p.split('\n').map(inline).join('<br>')}</p>`)
        .join('');
      return `<div class="ne-read">${paras}</div>`;
    },

    /* Location + links + related objects. All three are derived from the note
       and the rest of the workspace, so they cannot drift. */
    _relationsHtml(n) {
      const path = Derive.notePath(n.id);
      const links = Derive.noteLinks(n);
      const back = Derive.noteBacklinks(n.id);
      const refs = Derive.noteRefs(n);
      const kids = Derive.noteChildren(n.id);
      /* Files pointed at this note. The Files page has been able to attach to a
         note since M28 and `filesFor('note', …)` has always resolved it, but the
         note itself never showed them — a connection visible from one side only.
         (M42) */
      const files = Derive.filesFor('note', n.id);

      return `
        <div class="ne-relations">
          <div class="ne-rel">
            <span class="ne-rel-label">Lives in</span>
            <div class="ne-rel-body">
              ${path.length ? `<div class="ne-path">${path.map(p =>
                `<button class="ne-crumb" data-ne-goto="${esc(p.id)}">${esc(p.title)}</button>`).join('<span class="ne-crumb-sep">/</span>')}</div>` : ''}
              <select class="select ne-parent" aria-label="Parent note">
                ${this._parentOptions(n)}
              </select>
            </div>
          </div>

          <div class="ne-rel">
            <span class="ne-rel-label">Links</span>
            <div class="ne-rel-body" data-ne-links>
              ${links.length ? links.map(l => l.broken
                ? `<span class="ne-chip is-broken" title="No note with this title yet">${icon('note', 11)} ${esc(l.title)}</span>`
                : `<button class="ne-chip" data-ne-goto="${esc(l.note.id)}">${icon('note', 11)} ${esc(l.title)}</button>`
              ).join('') : '<span class="t-faint t-sm">Write <code>[[Another Note]]</code> to link one.</span>'}
            </div>
          </div>

          <div class="ne-rel">
            <span class="ne-rel-label">Linked from</span>
            <div class="ne-rel-body" data-ne-backlinks>
              ${back.length ? back.map(b =>
                `<button class="ne-chip" data-ne-goto="${esc(b.id)}">${icon('arrowR', 11)} ${esc(b.title)}</button>`
              ).join('') : '<span class="t-faint t-sm">Nothing links here yet.</span>'}
            </div>
          </div>

          <div class="ne-rel">
            <span class="ne-rel-label">Related</span>
            <div class="ne-rel-body">
              <div class="p-chips" data-ne-refs>
                ${refs.map(r => `
                  <span class="tagpill ne-ref ${r.missing ? 'is-missing' : ''}"
                    title="${r.missing ? 'This ' + esc(r.type) + ' no longer exists' : esc(r.meta)}">
                    ${icon(r.type === 'task' ? 'check' : r.type === 'project' ? 'layers' : 'target', 10)}
                    ${esc(r.label)}
                    <button class="ne-tagx" data-ne-unref="${esc(r.type)}:${esc(r.id)}"
                      aria-label="Unlink ${esc(r.label)}">${icon('x', 10)}</button>
                  </span>`).join('')}
              </div>
              <select class="select ne-refpick" aria-label="Link a workspace object">
                ${this._refOptions(n)}
              </select>
            </div>
          </div>

          <div class="ne-rel">
            <span class="ne-rel-label">Attached${files.length ? ` · ${files.length}` : ''}</span>
            <div class="ne-rel-body" data-ne-files>
              ${files.length
                ? `<div class="fb-list">${files.map(f => {
                    const fm = Derive.fileMeta(f), fk = fileKindMeta(fm.kind);
                    return `<button type="button" class="fb-row" data-ne-file="${esc(f.id)}"
                      aria-label="Open ${esc(f.name)} in Files">
                      <span class="fb-ic" style="color:${fk.color}">${icon(fk.icon, 12)}</span>
                      <span class="fb-name">${esc(f.name)}</span>
                      <span class="t-faint">${fm.sizeLabel}</span>
                    </button>`;
                  }).join('')}</div>`
                : '<span class="t-faint t-sm">Nothing attached to this note yet.</span>'}
              <input type="file" data-ne-filein multiple hidden>
              <button type="button" class="p-subadd" data-ne-fileadd>
                <span class="task-add-ic">${icon('plus', 12)}</span>
                <span>Attach a file</span>
              </button>
            </div>
          </div>

          ${kids.length ? `<div class="ne-rel">
            <span class="ne-rel-label">Contains</span>
            <div class="ne-rel-body" data-ne-kids>
              ${kids.map(c => `<button class="ne-chip" data-ne-goto="${esc(c.id)}">${icon('folder', 11)} ${esc(c.title)}</button>`).join('')}
            </div>
          </div>` : ''}
        </div>`;
    },

    /* Candidate parents: every note except this one and its own subtree, which
       is exactly what setNoteParent would refuse anyway — so the UI never
       offers a move that cannot happen. */
    _parentOptions(n) {
      const banned = new Set([n.id, ...Derive.noteDescendants(n.id).map(d => d.id)]);
      const rows = [];
      const walk = (pid, depth) => {
        Derive.noteChildren(pid).forEach(c => {
          if (banned.has(c.id)) return;
          rows.push({ id: c.id, label: '— '.repeat(depth) + c.title });
          walk(c.id, depth + 1);
        });
      };
      walk(null, 0);
      return '<option value="">Top level</option>'
        + rows.map(r => `<option value="${esc(r.id)}"${r.id === n.parentId ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
    },

    /* Candidate objects, grouped by kind, with anything already linked removed. */
    _refOptions(n) {
      const has = new Set((n.refs || []).map(r => r.type + ':' + r.id));
      const opt = (type, id, label) => (has.has(type + ':' + id) ? ''
        : `<option value="${type}:${esc(id)}">${esc(label)}</option>`);
      const groups = [
        ['Tasks', State.tasks.filter(t => !t.done).slice(0, 40).map(t => opt('task', t.id, t.title))],
        ['Projects', State.projects.map(p => opt('project', p.id, p.name))],
        ['Goals', State.goals.map(g => opt('goal', g.id, g.name))],
      ].filter(([, opts]) => opts.join('').length);
      if (!groups.length) return '<option value="">Nothing left to link</option>';
      return '<option value="">Link an object…</option>'
        + groups.map(([label, opts]) => `<optgroup label="${label}">${opts.join('')}</optgroup>`).join('');
    },

    /* --- binding -------------------------------------------------------- */
    bind() {
      const mount = $('#page-mount');
      if (!mount) return;
      this._bindTop(mount);
      this._bindList(mount);
      const pane = $('#note-editor', mount);
      if (pane) this._bindEditor(pane);
    },

    _bindTop(mount) {
      if (!mount) return;

      $$('[data-nt-filter]', mount).forEach(b => b.addEventListener('click', () => {
        this.filter = b.dataset.ntFilter;
        this.render();
      }));

      $$('[data-nt-tag]', mount).forEach(b => b.addEventListener('click', () => {
        const t = b.dataset.ntTag || null;
        this.tag = (this.tag === t) ? null : t;      // click again to clear
        this.render();
      }));

      /* Search repaints only the list, so the input keeps focus and the caret. */
      const search = $('#nt-search', mount);
      if (search) search.addEventListener('input', () => {
        this.q = search.value;
        this.renderList();
      });

      const nu = $('#nt-new', mount);
      if (nu) nu.addEventListener('click', () => this.createNote());
    },

    _bindList(mount) {
      if (!mount) return;
      $$('[data-nt-new]', mount).forEach(b => b.addEventListener('click', () => this.createNote()));
      $$('[data-nt-open]', mount).forEach(b => {
        const open = () => this.openNote(b.dataset.ntOpen);
        b.addEventListener('click', open);
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });
    },

    /* Repaint the list + its count line without touching the toolbar, the
       search box or the editor. */
    renderList() {
      const mount = $('#page-mount');
      if (!mount) return;
      const list = $('#notes-list', mount);
      if (list) list.innerHTML = this._listHtml();
      const count = $('#nt-count', mount);
      if (count) count.textContent = this._countLine(Derive.notesList());
      this._bindList(mount);
    },

    /* `root` is whichever container holds the editor — the page pane or a
       panel. Every lookup is scoped to it, so two editors can never collide. */
    _bindEditor(root) {
      const ed = root.querySelector('.note-editor');
      if (!ed) return;
      const id = ed.dataset.ntEditor;
      const status = ed.querySelector('[data-ne-status]');
      const titleEl = ed.querySelector('.ne-title');
      const bodyEl = ed.querySelector('.ne-body');

      /* Autosave. Debounced so typing does not write on every keystroke; the
         editor is never re-rendered here, only the list. */
      const flush = () => {
        const cur = State.noteById(id);
        if (!cur) return;
        const patch = { title: titleEl ? titleEl.value : cur.title };
        if (bodyEl) patch.body = bodyEl.value;      // read mode has no textarea
        State.updateNote(id, patch);
        this.renderList();
      };
      const schedule = () => {
        if (status) status.textContent = 'Saving…';
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
          flush();
          if (status) status.textContent = 'Saved';
        }, 500);
      };
      [titleEl, bodyEl].filter(Boolean).forEach(el => {
        el.addEventListener('input', schedule);
        el.addEventListener('blur', () => {
          clearTimeout(this._saveTimer);
          flush();
          if (status) status.textContent = 'Saved';
        });
      });

      /* Read / Write. Flush first so a half-typed sentence is never lost by the
         re-render that the toggle causes. */
      const readTog = ed.querySelector('[data-ne-readtoggle]');
      if (readTog) readTog.addEventListener('click', () => {
        clearTimeout(this._saveTimer);
        flush();
        this.readMode = !this.readMode;
        this._refreshEditor(root, id);
      });
      // Wiki links rendered inside the body navigate like any other link.
      [...ed.querySelectorAll('.ne-read [data-ne-goto]')].forEach(b =>
        b.addEventListener('click', () => this.openNote(b.dataset.neGoto)));

      const fav = ed.querySelector('[data-ne-fav]');
      fav.addEventListener('click', () => {
        clearTimeout(this._saveTimer); flush();
        const n = State.toggleNoteFavorite(id);
        if (n) {
          fav.classList.toggle('is-on', n.favorite);
          fav.setAttribute('aria-pressed', String(n.favorite));
        }
        this.renderTop();      // the Favourites tab count moved
        this.renderList();
      });

      const pin = ed.querySelector('[data-ne-pin]');
      pin.addEventListener('click', () => {
        clearTimeout(this._saveTimer); flush();
        const n = State.toggleNotePin(id);
        if (n) {
          pin.classList.toggle('is-on', n.pinned);
          pin.setAttribute('aria-pressed', String(n.pinned));
        }
        this.renderTop();      // the Pinned tab count moved
        this.renderList();
      });

      ed.querySelector('[data-ne-del]').addEventListener('click', () => this.confirmDelete(id));

      this._bindTags(ed, id);
      this._bindRelations(root, id);
    },

    /* Location, wiki links and related objects. Nothing here re-renders the
       textarea: the relations block is replaced in place and re-bound.
       `root` is the CONTAINER (the page pane or the panel), not the editor card
       — passing the card would make _refreshRelations unable to find the editor
       again after the first refresh, so only the first render would be live. */
    _bindRelations(root, id) {
      const self = this;
      const ed = root.querySelector('.note-editor');
      if (!ed) return;
      const rel = ed.querySelector('.ne-relations');
      if (!rel) return;

      /* Open another note. On desktop the editor pane swaps; on a phone the
         panel is replaced, so the page behind it is repainted too. */
      [...rel.querySelectorAll('[data-ne-goto]')].forEach(b =>
        b.addEventListener('click', () => self.openNote(b.dataset.neGoto)));

      const parent = rel.querySelector('.ne-parent');
      if (parent) parent.addEventListener('change', () => {
        const moved = State.setNoteParent(id, parent.value || null);
        if (!moved) {
          Toast.show('A note cannot live inside itself', 'warn');
          parent.value = State.noteById(id).parentId || '';
          return;
        }
        Toast.show(parent.value ? 'Note moved' : 'Note moved to the top level', 'good');
        self.renderTop();          // breadcrumbs on the cards moved
        self.renderList();
        self._refreshRelations(root, id);
      });

      const pick = rel.querySelector('.ne-refpick');
      if (pick) pick.addEventListener('change', () => {
        const v = pick.value;
        if (!v) return;
        const i = v.indexOf(':');
        State.addNoteRef(id, v.slice(0, i), v.slice(i + 1));
        pick.value = '';
        self._refreshRelations(root, id);
        self.renderList();
      });

      [...rel.querySelectorAll('[data-ne-unref]')].forEach(b =>
        b.addEventListener('click', () => {
          const v = b.dataset.neUnref;
          const i = v.indexOf(':');
          State.removeNoteRef(id, v.slice(0, i), v.slice(i + 1));
          self._refreshRelations(root, id);
          self.renderList();
        }));

      /* Files attached to this note (M42). The same shape as the task panel's
         block — attach here, or follow a row to the file — so the two surfaces
         behave alike, and following a pointer goes through `revealRecord`, the one
         table that says where a record of each kind lives. */
      const fileIn = rel.querySelector('[data-ne-filein]');
      const fileAdd = rel.querySelector('[data-ne-fileadd]');
      if (fileIn && fileAdd) {
        fileAdd.addEventListener('click', () => fileIn.click());
        fileIn.addEventListener('change', () => {
          const picked = Array.from(fileIn.files || []);
          fileIn.value = '';
          if (!picked.length) return;
          const added = FilesPage.attachTo('note', id, picked);
          Toast.show(added ? `Attached ${added} file${added === 1 ? '' : 's'}` : 'Nothing was attached',
            added ? 'good' : 'warn');
          self._refreshRelations(root, id);
          self.renderList();      // the card's paperclip count has to follow
        });
      }
      [...rel.querySelectorAll('[data-ne-file]')].forEach(b =>
        b.addEventListener('click', () => revealRecord('file', b.dataset.neFile)));
    },

    /* Repaint only the relations block — the body and title keep their focus. */
    _refreshRelations(root, id) {
      const n = State.noteById(id);
      if (!n) return;
      const rel = root.querySelector('.ne-relations');
      if (!rel) return;
      rel.outerHTML = this._relationsHtml(n);
      const ed = root.querySelector('.note-editor');
      if (ed) this._bindRelations(root, id);
    },

    /* Replace the whole editor card — used by Read/Write, where the body markup
       itself changes. Unlike a tag edit, a full editor rebuild is intended. */
    _refreshEditor(root, id) {
      const n = State.noteById(id);
      if (!n) return;
      const ed = root.querySelector('.note-editor');
      if (!ed) return;
      ed.outerHTML = this._editorHtml(n);
      this._bindEditor(root);
    },

    /* Tag add/remove mutates the row in place rather than re-rendering it, so
       the body textarea never loses focus and no blur/commit double-fire is
       possible. */
    _bindTags(ed, id) {
      const row = ed.querySelector('[data-ne-tags]');
      if (!row) return;
      const self = this;

      const removeTag = (tag) => {
        const n = State.noteById(id);
        if (!n) return;
        State.updateNote(id, { tags: n.tags.filter(t => t !== tag) });
        [...row.querySelectorAll('[data-ne-untag]')].forEach(b => {
          if (b.dataset.neUntag === tag) {
            const pill = b.closest('.tagpill');
            if (pill) pill.remove();
          }
        });
        self.renderTop();      // the tag row + Tagged count must follow
        self.renderList();
      };
      const wire = (btn) => btn.addEventListener('click', () => removeTag(btn.dataset.neUntag));
      [...row.querySelectorAll('[data-ne-untag]')].forEach(wire);

      const input = row.querySelector('.ne-tagin');
      if (!input) return;
      const commit = () => {
        const v = input.value.trim().toLowerCase();
        input.value = '';
        if (!v) return;
        const n = State.noteById(id);
        if (!n || n.tags.includes(v)) return;
        State.updateNote(id, { tags: [...n.tags, v] });
        const pill = el('span', { class: 'tagpill' });
        pill.innerHTML = esc(v) + '<button class="ne-tagx" data-ne-untag="' + esc(v) +
          '" aria-label="Remove tag ' + esc(v) + '">' + icon('x', 10) + '</button>';
        row.insertBefore(pill, input);
        wire(pill.querySelector('[data-ne-untag]'));
        self.renderTop();      // the new tag joins the filter row
        self.renderList();
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
      });
      input.addEventListener('blur', commit);
    },

    /* --- navigation ----------------------------------------------------- */
    openNote(id) {
      if (!State.noteById(id)) { Toast.show('That note no longer exists', 'warn'); return; }
      this.selected = id;
      /* Called from somewhere that is not the Notes page (a link in Knowledge,
         the palette)? Route there first, so the note actually becomes visible
         instead of the call silently doing nothing. */
      if (Router.current !== 'notes') { Router.go('notes', { open: id }); return; }
      if (this._isMobile()) { this.openPanel(id); return; }
      const mount = $('#page-mount');
      const pane = mount ? $('#note-editor', mount) : null;
      if (pane) {
        pane.innerHTML = this._editorHtml(State.noteById(id));
        this._bindEditor(pane);
      }
      $$('[data-nt-open]', mount).forEach(b =>
        b.classList.toggle('is-sel', b.dataset.ntOpen === id));
    },

    openPanel(id) {
      const panel = Overlay.panel(`
        <div class="panel-head">
          <div class="panel-head-main"><div class="panel-title">Note</div></div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="panel-body">${this._editorHtml(State.noteById(id))}</div>`,
        { wide: true });
      panel.querySelector('[data-close]').addEventListener('click', () => Overlay.close());
      this._bindEditor(panel);
      return panel;
    },

    createNote() {
      const n = State.addNote({ title: 'Untitled note', body: '', tags: this.tag ? [this.tag] : [] });
      this.q = '';
      this.filter = 'all';
      this.selected = n.id;
      this.render();
      if (this._isMobile()) this.openPanel(n.id);
      Toast.show('New note created', 'good');
      // Put the caret in the title with the placeholder selected, so the user
      // can simply start typing.
      const t = document.querySelector('.note-editor .ne-title');
      if (t) { t.focus(); t.select(); }
      return n;
    },

    confirmDelete(id) {
      const n = State.noteById(id);
      if (!n) return;
      const words = Derive.noteWords(n);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete note</div>
            <h2 class="t-h2" style="margin-top:6px">Delete “${esc(n.title)}”?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin:0">
          This removes the note${words ? ` and its ${words} words` : ''}. There is no undo.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Keep it</button>
          <button class="btn btn-danger" id="nt-del-ok">${icon('trash', 14)} Delete note</button>
        </div>`, { cls: 'modal-sm' });

      $('#nt-del-ok', wrap).addEventListener('click', () => {
        State.deleteNote(id);
        Overlay.close();
        Toast.show('Note deleted', 'default');
        this.selected = null;
        this.render();
      });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
    },
  };

  /* ======================================================================
     KNOWLEDGE PAGE — Milestone 23
     The shape of the notes collection, made visible: a real tree built from
     `note.parentId`, the wiki-link graph between notes (derived from bodies,
     never stored) and the objects each note points at.

     Everything on this page is computed from the notes and the rest of the
     workspace, so moving a note or renaming one is reflected immediately and
     no count can go stale.

     The visual knowledge *graph* is deliberately NOT here — the instruction is
     explicit that the graph comes last, once the underlying management works.
     ====================================================================== */
  const KnowledgePage = {
    q: '',
    collapsed: null,          // Set of note ids whose subtree is folded

    _fold() {
      if (!this.collapsed) this.collapsed = new Set();
      return this.collapsed;
    },

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'knowledge') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Mapping your knowledge…</p></div></div></div>';
        return;
      }

      const k = Derive.knowledgeList();
      const searching = !!this.q.trim();
      const parents = k.notes.filter(n => Derive.noteChildren(n.id).length);
      const anyOpen = parents.some(n => !this._fold().has(n.id));

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Knowledge</div>
            <h1>Knowledge</h1>
            <div class="sub">${this._summaryLine(k)}</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-ghost btn-sm" id="kn-expand">
              ${icon('checkAll', 14)} ${anyOpen ? 'Collapse all' : 'Expand all'}
            </button>
            <button class="btn btn-primary btn-sm" id="kn-new">${icon('plus', 14)} New note</button>
          </div>
        </div>

        <div class="proj-stats" style="margin-top:var(--sp-4)">
          ${Widgets.statTile({ icon:'note', label:'Notes', value:k.total,
            meta:`${k.rootCount} at the top level`, accent:'var(--accent)' })}
          ${Widgets.statTile({ icon:'folder', label:'Topics', value:k.parents,
            meta:`${k.leaves} note${k.leaves === 1 ? '' : 's'} with no children`, accent:'var(--cyan)' })}
          ${Widgets.statTile({ icon:'layers', label:'Depth', value:k.maxDepth + 1,
            meta: k.maxDepth ? `${k.maxDepth} level${k.maxDepth === 1 ? '' : 's'} of nesting` : 'flat for now', accent:'var(--violet)' })}
          ${Widgets.statTile({ icon:'brain', label:'Links', value:k.linkCount,
            meta: k.broken ? `${k.broken} broken` : `${k.linked} note${k.linked === 1 ? '' : 's'} linked`, accent: k.broken ? 'var(--bad)' : 'var(--good)' })}
        </div>

        <div class="notes-tools" style="margin-top:var(--sp-4)">
          <label class="notes-search">
            ${icon('search', 14)}
            <input id="kn-search" type="search" placeholder="Search the knowledge base…"
              value="${esc(this.q)}" aria-label="Search knowledge" autocomplete="off">
          </label>
        </div>

        <div class="kn-layout" style="margin-top:var(--sp-4)">
          <div class="kn-main">
            ${searching ? `<div class="kn-flat">${this._searchHtml()}</div>` : `<div class="kn-tree">${this._treeHtml()}</div>`}
          </div>
          <div class="kn-side">
            ${this._unfiledCard(k)}
            ${this._brokenCard(k)}
            ${this._mostLinkedCard()}
            ${this._relatedCard(k)}
          </div>
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Knowledge', `${k.total} note${k.total === 1 ? '' : 's'} · ${k.linkCount} link${k.linkCount === 1 ? '' : 's'}`);
    },

    _summaryLine(k) {
      if (!k.total) return 'Build a second brain: file notes inside each other, link them together, and connect them to your work.';
      const bits = [`${k.total} note${k.total === 1 ? '' : 's'}`];
      if (k.parents) bits.push(`${k.parents} topic${k.parents === 1 ? '' : 's'}`);
      bits.push(`${k.linkCount} link${k.linkCount === 1 ? '' : 's'}`);
      if (k.refCount) bits.push(`${k.refCount} object link${k.refCount === 1 ? '' : 's'}`);
      bits.push(`${fmt(k.words)} words`);
      return bits.join(' · ');
    },

    /* --- the tree -------------------------------------------------------- */
    _treeHtml() {
      const k = Derive.knowledgeList();
      if (!k.total) {
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon('brain', 22)}</div>
          <h4>Nothing to map yet</h4>
          <p>Write a note and it appears here. File notes inside each other to build
             topics, and write <code>[[Another Note]]</code> to link them.</p>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-kn-new>${icon('plus', 14)} New note</button>
        </div></div>`;
      }
      const fold = this._fold();
      const walk = (pid, depth) => Derive.noteChildren(pid).map(n => {
        const kids = Derive.noteChildren(n.id);
        const open = !fold.has(n.id);
        const words = Derive.noteSubtreeWords(n.id);
        const refs = (n.refs || []).length;
        return `
          <div class="kn-node" style="--depth:${depth}">
            <div class="kn-row">
              ${kids.length
                ? `<button class="kn-caret ${open ? 'is-open' : ''}" data-kn-toggle="${esc(n.id)}"
                     aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(n.title)}">${icon('chevR', 12)}</button>`
                : '<span class="kn-caret is-leaf" aria-hidden="true"></span>'}
              <button class="kn-title" data-kn-open="${esc(n.id)}">
                ${icon(kids.length ? 'folder' : 'note', 13)}
                <span class="kn-name">${esc(n.title)}</span>
              </button>
              <span class="kn-badges">
                ${n.favorite ? `<span class="kn-mark is-fav" title="Favourite">${icon('star', 10)}</span>` : ''}
                ${(n.tags || []).slice(0, 2).map(t => `<span class="tagpill">${esc(t)}</span>`).join('')}
              </span>
              <span class="kn-meta">
                ${kids.length ? `${kids.length} item${kids.length === 1 ? '' : 's'} · ` : ''}${refs ? refs + ' linked · ' : ''}${words}w
              </span>
            </div>
            ${kids.length && open ? `<div class="kn-kids">${walk(n.id, depth + 1)}</div>` : ''}
          </div>`;
      }).join('');

      const roots = walk(null, 0);
      return roots || `<div class="card"><div class="empty">
        <div class="empty-ic">${icon('brain', 22)}</div>
        <h4>Nothing to map yet</h4>
        <p>Write a note and it appears here.</p>
      </div></div>`;
    },

    /* A flat, ranked result list — a tree is the wrong shape for a search. */
    _searchHtml() {
      const rows = Derive.noteSearch(this.q);
      if (!rows.length) {
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon('search', 22)}</div>
          <h4>Nothing matches</h4>
          <p>No note title, tag or body contains “${esc(this.q.trim())}”.</p>
        </div></div>`;
      }
      return rows.map(r => {
        const n = r.note;
        const path = Derive.notePath(n.id);
        return `
          <div class="kn-node" style="--depth:0">
            <div class="kn-row">
              <span class="kn-caret is-leaf" aria-hidden="true"></span>
              <button class="kn-title" data-kn-open="${esc(n.id)}">
                ${icon('note', 13)}<span class="kn-name">${esc(n.title)}</span>
              </button>
              <span class="kn-meta">${path.length ? esc(path.map(p => p.title).join(' / ')) : 'Top level'}</span>
            </div>
          </div>`;
      }).join('');
    },

    /* --- aside ----------------------------------------------------------- */
    _unfiledCard(k) {
      const rows = k.unfiled;
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Unfiled</div>
            <span class="badge badge-dot">${rows.length}</span>
          </div>
          ${rows.length ? rows.slice(0, 6).map(n => `
            <button class="kn-mini" data-kn-open="${esc(n.id)}">
              ${icon('note', 12)}<span class="t-truncate">${esc(n.title)}</span>
            </button>`).join('')
            : '<div class="t-faint t-sm" style="padding:var(--sp-2) 0">Every note is either a topic or filed under one.</div>'}
        </section>`;
    },

    _brokenCard(k) {
      if (!k.broken) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Broken links</div>
            <span class="badge badge-bad">${k.broken}</span>
          </div>
          ${k.brokenLinks.slice(0, 6).map(b => `
            <button class="kn-mini" data-kn-open="${esc(b.note.id)}">
              ${icon('note', 12)}<span class="t-truncate">${esc(b.note.title)}</span>
              <span class="t-faint">→ ${esc(b.title)}</span>
            </button>`).join('')}
          <p class="t-faint t-sm" style="margin:var(--sp-2) 0 0">
            These point at a title no note has. Rename a note back, or write it.
          </p>
        </section>`;
    },

    _mostLinkedCard() {
      const rows = Derive.noteMostLinked(5);
      if (!rows.length) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Most linked</div>
            <span class="badge badge-dot">${rows.length}</span>
          </div>
          ${rows.map(r => `
            <button class="kn-mini" data-kn-open="${esc(r.note.id)}">
              ${icon('note', 12)}<span class="t-truncate">${esc(r.note.title)}</span>
              <span class="t-faint" title="Notes linking here">← ${r.count}</span>
            </button>`).join('')}
        </section>`;
    },

    _relatedCard(k) {
      const rows = Derive.notesSorted().filter(n => (n.refs || []).length);
      if (!rows.length) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Linked to work</div>
            <span class="badge badge-dot">${k.refCount}</span>
          </div>
          ${rows.slice(0, 6).map(n => `
            <button class="kn-mini" data-kn-open="${esc(n.id)}">
              ${icon('layers', 12)}<span class="t-truncate">${esc(n.title)}</span>
              <span class="t-faint">${(n.refs || []).length}</span>
            </button>`).join('')}
        </section>`;
    },

    /* --- wiring ---------------------------------------------------------- */
    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      $$('[data-kn-toggle]', mount).forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.knToggle;
        const fold = this._fold();
        if (fold.has(id)) fold.delete(id); else fold.add(id);
        this.render();
      }));

      $$('[data-kn-open]', mount).forEach(b => {
        const go = () => Router.go('notes', { open: b.dataset.knOpen });
        b.addEventListener('click', go);
        b.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
      });

      const search = $('#kn-search', mount);
      if (search) search.addEventListener('input', () => {
        this.q = search.value;
        // Repaint only the tree area so the input keeps focus and the caret.
        const main = $('.kn-main', mount);
        if (main) {
          const searching = !!this.q.trim();
          main.innerHTML = searching
            ? `<div class="kn-flat">${this._searchHtml()}</div>`
            : `<div class="kn-tree">${this._treeHtml()}</div>`;
          this._bindRows(main);
        }
      });

      const ex = $('#kn-expand', mount);
      if (ex) ex.addEventListener('click', () => {
        const fold = this._fold();
        const open = Derive.knowledgeList().notes
          .filter(n => Derive.noteChildren(n.id).length)
          .some(n => !fold.has(n.id));
        if (open) {
          Derive.knowledgeList().notes.forEach(n => {
            if (Derive.noteChildren(n.id).length) fold.add(n.id);
          });
        } else {
          fold.clear();
        }
        this.render();
      });

      const nu = $('#kn-new', mount);
      if (nu) nu.addEventListener('click', () => this.createNote(null));
      $$('[data-kn-new]', mount).forEach(b => b.addEventListener('click', () => this.createNote(null)));
    },

    /* Rows are re-bound after a partial repaint. */
    _bindRows(root) {
      $$('[data-kn-open]', root).forEach(b => b.addEventListener('click', () =>
        Router.go('notes', { open: b.dataset.knOpen })));
    },

    createNote(parentId) {
      const n = State.addNote({ title: 'Untitled note', body: '', parentId: parentId || null });
      this.render();
      Toast.show('New note created', 'good');
      Router.go('notes', { open: n.id });
      return n;
    },
  };

  /* ======================================================================
     JOURNAL — Milestone 24
     A journal entry is the one record in NEXUS the user authors by hand: a body
     plus three self-ratings (mood / energy / focus). Those are stored because
     nothing else can produce them. Everything the page says *about* the
     collection — the streak, the averages, the month coverage, the search
     ranking — is derived from those records at render time, so an edit can never
     leave a stale number behind.

     Two mounts share one editor markup: the composer card at the top of the page
     (always today) and the drawer that opens a past entry. Because the composer
     contains a live textarea, the page repaints in REGIONS — tiles and header
     separately from the list — so typing never loses the caret. The textarea is
     flushed before any repaint that would destroy it, and on blur, so a debounce
     cannot swallow the last keystrokes.
     ====================================================================== */
  const JournalPage = {
    q: '',
    view: 'timeline',        // 'timeline' | 'month'
    year: null,
    month: null,             // 0-based
    openId: null,            // entry currently open in the drawer

    /* The three rating axes: label, the word for each point on the scale, and
       the icon used when the rating appears as a chip in the timeline. */
    SCALES: [
      { key: 'mood',         label: 'Mood',   icon: 'flame',
        words: ['Rough', 'Low', 'Okay', 'Good', 'Great'] },
      { key: 'energy',       label: 'Energy', icon: 'bolt',
        words: ['Drained', 'Tired', 'Steady', 'Fresh', 'Charged'] },
      { key: 'productivity', label: 'Focus',  icon: 'target',
        words: ['Scattered', 'Slow', 'Steady', 'Sharp', 'Locked in'] },
    ],

    /* Deterministic 1–5 colour ramp. The number is always shown too, so the
       meaning never depends on colour alone. */
    _rateColor(v) {
      return ['var(--bad)', 'var(--warn)', 'var(--text-2)', 'var(--accent-2)', 'var(--good)'][v - 1]
        || 'var(--accent)';
    },

    _ensureMonth() {
      if (this.year === null) {
        const n = new Date();
        this.year = n.getFullYear();
        this.month = n.getMonth();
      }
    },

    /* --- date formatting -------------------------------------------------- */
    _longDay(key) { return Derive.longDay(key); },
    _shortDay(key) { return Derive.shortDay(key); },
    _relDay(key) {
      const today = todayKey();
      if (key === today) return 'Today';
      const diff = Math.round((new Date(today + 'T12:00:00') - new Date(key + 'T12:00:00')) / 86400000);
      if (diff === 1) return 'Yesterday';
      if (diff > 1 && diff < 7) return `${diff} days ago`;
      return this._shortDay(key);
    },
    _monthLabel(prefix) {
      const bits = prefix.split('-');
      return `${MONTHS[Number(bits[1]) - 1]} ${bits[0]}`;
    },

    /* --- render ----------------------------------------------------------- */
    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'journal') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Opening your journal…</p></div></div></div>';
        return;
      }
      // Never let a debounce swallow the last keystrokes on the way out.
      this._flushBody($('#jr-today'));
      this._ensureMonth();

      const j = Derive.journalList();

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Journal</div>
            <h1>Journal</h1>
            <div class="sub" id="jr-sub">${esc(this._summaryLine(j.summary))}</div>
          </div>
          <div class="viewtabs" role="tablist" aria-label="Journal view">
            <button class="viewtab ${this.view === 'timeline' ? 'is-active' : ''}"
              data-jr-view="timeline" role="tab" aria-selected="${this.view === 'timeline'}">
              ${icon('list', 14)} Timeline <span class="vt-count">${j.summary.total}</span>
            </button>
            <button class="viewtab ${this.view === 'month' ? 'is-active' : ''}"
              data-jr-view="month" role="tab" aria-selected="${this.view === 'month'}">
              ${icon('calendar', 14)} Month
            </button>
          </div>
        </div>

        <div class="proj-stats" id="jr-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(j)}</div>

        <div id="jr-today-wrap" style="margin-top:var(--sp-4)">${this.view === 'month'
          ? this._todayStrip(j)
          : this._todayCard(j)}</div>

        <div class="jr-layout" id="jr-list" style="margin-top:var(--sp-4)">
          <div class="jr-main">${this.view === 'month' ? this._monthCard() : this._timelineCard()}</div>
          <div class="jr-side" id="jr-side">${this._asideHtml()}</div>
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Journal', `${j.summary.total} entr${j.summary.total === 1 ? 'y' : 'ies'} · ${j.summary.streak}-day streak`);
    },

    _summaryLine(s) {
      if (!s.total) {
        return 'A private daily record: how the day felt, what it cost in energy, and what you actually got done.';
      }
      const bits = [`${s.total} entr${s.total === 1 ? 'y' : 'ies'}`];
      if (s.streak) bits.push(`${s.streak}-day streak`);
      if (s.best > s.streak) bits.push(`best ${s.best}`);
      if (s.spanDays) bits.push(`${Math.round(s.coverage * 100)}% of ${s.spanDays} days`);
      if (s.words) bits.push(`${fmt(s.words)} words`);
      return bits.join(' · ');
    },

    _tilesHtml(j) {
      const s = j.summary;
      return `
        ${Widgets.statTile({ icon: 'book', label: 'Entries', value: s.total,
          meta: s.total ? `${s.thisMonth} written this month` : 'nothing written yet',
          accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'flame', label: 'Streak', value: `${s.streak}d`,
          meta: s.best ? `longest run ${s.best} day${s.best === 1 ? '' : 's'}` : 'start one today',
          accent: s.streak ? 'var(--warn)' : 'var(--text-3)' })}
        ${Widgets.statTile({ icon: 'pulse', label: 'Mood', value: s.mood ? s.mood.toFixed(1) : '—',
          meta: s.rated ? `from ${s.rated} rated day${s.rated === 1 ? '' : 's'}` : 'nothing rated yet',
          accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'note', label: 'Words', value: fmt(s.words),
          meta: s.withBody ? `${s.withBody} with writing` : 'no words yet',
          accent: 'var(--violet)' })}`;
    },

    /* --- today, in two sizes ---------------------------------------------
       Timeline view is the writing flow, so Today gets the full composer.
       Month view is a review lens — a full composer there pushed the grid
       below the fold, so Today collapses to one line and the grid fits. The
       affordance stays visible and switches straight back. */
    _todayCard(j) {
      return `
        <section class="card" id="jr-today">
          <div class="card-head">
            <div>
              <div class="card-title">Today</div>
              <div class="card-sub">${esc(this._longDay(todayKey()))}</div>
            </div>
            <span class="badge ${j.todayWritten ? 'badge-good' : ''}" id="jr-today-badge">${j.todayWritten ? 'Written' : 'Not written yet'}</span>
          </div>
          ${this._editorHtml(j.today, { composer: true })}
        </section>`;
    },

    _todayStrip(j) {
      const t = j.today;
      const rated = t ? this.SCALES.filter(sc => typeof t[sc.key] === 'number').length : 0;
      return `
        <section class="card jr-stripcard">
          <span class="stat-ic" style="color:var(--accent)">${icon('book', 16)}</span>
          <div class="grow">
            <div class="card-title">Today · ${esc(this._longDay(todayKey()))}</div>
            <div class="card-sub">${j.todayWritten
              ? `${rated} of 3 rated · ${Derive.journalWordCount(t)} word${Derive.journalWordCount(t) === 1 ? '' : 's'} written`
              : 'Not written yet'}</div>
          </div>
          <button class="btn btn-primary btn-sm" data-jr-write>${icon('edit', 13)} Write</button>
        </section>`;
    },

    /* Swap the Today area for the current view. The composer may be destroyed
       here, so it is flushed first by the caller. */
    _renderComposer() {
      const wrap = $('#jr-today-wrap');
      if (!wrap || Router.current !== 'journal') return;
      const j = Derive.journalList();
      wrap.innerHTML = this.view === 'month' ? this._todayStrip(j) : this._todayCard(j);
      this._bindWriteButton();
      if (this.view !== 'month') {
        this._bindEditor($('#jr-today'), {
          onChange: () => { this.renderTop(); this.renderList(); },
        });
      }
    },

    _bindWriteButton() {
      const b = $('[data-jr-write]');
      if (!b || b.dataset.jrBound) return;
      b.dataset.jrBound = '1';
      b.addEventListener('click', () => {
        this.view = 'timeline';
        const mount = $('#page-mount');
        if (mount) $$('[data-jr-view]', mount).forEach(x => {
          const on = x.dataset.jrView === 'timeline';
          x.classList.toggle('is-active', on);
          x.setAttribute('aria-selected', String(on));
        });
        this._renderComposer();
        this.renderList();
        const body = $('#jr-today .jr-body');
        if (body) body.focus();
      });
    },

    /* --- the shared editor ------------------------------------------------ */
    _editorHtml(e, { composer = false } = {}) {
      const day = e ? e.day : todayKey();
      const words = e ? Derive.journalWordCount(e) : 0;
      return `
        <div class="jr-editor">
          <input class="jr-title" data-jr-title data-jr-title-day="${esc(day)}"
            value="${esc(e ? e.title || '' : '')}"
            placeholder="Give the day a title (optional)" aria-label="Entry title">

          <div class="jr-scales">
            ${this.SCALES.map(sc => {
              const cur = e ? e[sc.key] : null;
              return `
                <div class="jr-scale">
                  <span class="jr-scale-label">${sc.label}</span>
                  <div class="jr-dots" role="group" aria-label="${sc.label}, 1 to 5">
                    ${[1, 2, 3, 4, 5].map(v => `
                      <button type="button" class="jr-dot ${cur === v ? 'is-on' : ''}"
                        data-jr-rate="${sc.key}" data-jr-value="${v}" data-jr-day="${esc(day)}"
                        aria-pressed="${cur === v}"
                        title="${sc.label} ${v} of 5 — ${sc.words[v - 1]}"
                        ${cur === v ? `style="--c:${this._rateColor(v)}"` : ''}>${v}</button>`).join('')}
                  </div>
                  <span class="jr-scale-val">${cur ? sc.words[cur - 1] : 'Not rated'}</span>
                </div>`;
            }).join('')}
          </div>

          <textarea class="textarea jr-body" data-jr-body="${e ? esc(e.id) : ''}"
            data-jr-day="${esc(day)}" aria-label="Entry text"
            placeholder="${composer
              ? 'How was today? What did you do, decide, notice or feel?'
              : 'What happened that day?'}">${e ? esc(e.body) : ''}</textarea>

          ${this._tagRow(e, day)}

          <div class="jr-foot">
            <span class="jr-words" data-jr-words>${words} word${words === 1 ? '' : 's'}</span>
            <span class="jr-status" data-jr-status>${e
              ? `Saved ${esc(Derive.relTime(e.updatedAt))}`
              : 'Nothing saved yet'}</span>
          </div>
        </div>`;
    },

    _tagRow(e, day) {
      return `
        <div class="jr-tagrow" data-jr-tagrow data-jr-tagrow-day="${esc(day)}">
          ${icon('tag', 13)}
          <span class="jr-tagchips" data-jr-tagchips>${this._tagChips(e, day)}</span>
          <input class="field jr-tagin" data-jr-tagin data-jr-tag-day="${esc(day)}"
            placeholder="Add tag…" aria-label="Add tag" autocomplete="off">
        </div>`;
    },
    _tagChips(e, day) {
      return ((e && e.tags) || []).map(t => `
        <span class="tagpill">${esc(t)}<button type="button" class="jr-tagx"
          data-jr-untag="${esc(t)}" data-jr-untag-day="${esc(day)}"
          aria-label="Remove tag ${esc(t)}">${icon('x', 9)}</button></span>`).join('');
    },

    /* --- timeline / search ------------------------------------------------ */
    _timelineCard() {
      return `
        <div class="notes-tools">
          <label class="notes-search">
            ${icon('search', 14)}
            <input id="jr-search" type="search" placeholder="Search your journal…"
              value="${esc(this.q)}" aria-label="Search journal" autocomplete="off">
          </label>
          <span class="t-faint t-sm" id="jr-count"></span>
        </div>
        <div id="jr-rows" style="margin-top:var(--sp-4)">${this._rowsHtml()}</div>`;
    },

    _rowsHtml() {
      if (this.q.trim()) {
        const hits = Derive.journalSearch(this.q);
        if (!hits.length) {
          return `<div class="card"><div class="empty">
            <div class="empty-ic">${icon('search', 22)}</div>
            <h4>Nothing matches</h4>
            <p>No date, title, tag or line in your journal contains “${esc(this.q.trim())}”.</p>
          </div></div>`;
        }
        return `<div class="jr-timeline">${hits.map(r => this._entryHtml(r.entry)).join('')}</div>`;
      }

      const entries = Derive.journalSorted();
      if (!entries.length) {
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon('book', 22)}</div>
          <h4>Your journal starts today</h4>
          <p>Rate the day and write a few lines. NEXUS turns that into mood over time,
             where your energy goes, and what your good days have in common.</p>
        </div></div>`;
      }

      let last = '';
      const parts = [];
      entries.forEach(e => {
        const m = e.day.slice(0, 7);
        if (m !== last) { last = m; parts.push(`<div class="jr-monthhead">${esc(this._monthLabel(m))}</div>`); }
        parts.push(this._entryHtml(e));
      });
      return `<div class="jr-timeline">${parts.join('')}</div>`;
    },

    _entryHtml(e) {
      const marks = this.SCALES
        .filter(sc => typeof e[sc.key] === 'number')
        .map(sc => `<span class="jr-mark" style="--c:${this._rateColor(e[sc.key])}"
          title="${sc.label} ${e[sc.key]} of 5 — ${sc.words[e[sc.key] - 1]}">${icon(sc.icon, 11)}${e[sc.key]}</span>`);
      const words = Derive.journalWordCount(e);
      const excerpt = Derive.journalExcerpt(e);
      return `
        <article class="jr-entry ${e.day === todayKey() ? 'is-today' : ''}"
          data-jr-open="${esc(e.id)}" tabindex="0" role="button"
          aria-label="Open the journal entry for ${esc(this._longDay(e.day))}">
          <div class="jr-e-top">
            <span class="jr-e-day">${esc(this._longDay(e.day))}</span>
            <span class="jr-e-when">${esc(this._relDay(e.day))}</span>
            <span class="jr-e-marks">${marks.length ? marks.join('')
              : '<span class="jr-mark is-none">Not rated</span>'}</span>
          </div>
          ${e.title ? `<div class="jr-e-title">${esc(e.title)}</div>` : ''}
          <p class="jr-e-excerpt ${excerpt ? '' : 'is-empty'}">${excerpt
            ? esc(excerpt)
            : 'No words — just the ratings.'}</p>
          <div class="jr-e-foot">
            ${(e.tags || []).map(t => `<span class="tagpill">${esc(t)}</span>`).join('')}
            <span class="jr-e-words">${words} word${words === 1 ? '' : 's'}</span>
          </div>
        </article>`;
    },

    /* --- month view ------------------------------------------------------- */
    _monthCard() {
      this._ensureMonth();
      const m = Derive.journalMonth(this.year, this.month);
      const today = todayKey();
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">${MONTHS[this.month]} ${this.year}</div>
              <div class="card-sub">${m.count
                ? `${m.count} of ${m.daysIn} days written · ${Math.round(m.coverage * 100)}% coverage`
                : 'nothing written this month'}</div>
            </div>
            <div class="row gap-2">
              <button class="iconbtn" data-jr-nav="-1" aria-label="Previous month">${icon('chevL', 14)}</button>
              <button class="btn btn-ghost btn-sm" data-jr-nav="today">Today</button>
              <button class="iconbtn" data-jr-nav="1" aria-label="Next month">${icon('chevR', 14)}</button>
            </div>
          </div>

          <div class="jr-dow">${DOW.map(d => `<span>${d[0]}</span>`).join('')}</div>
          <div class="jr-months">
            ${m.cells.map(c => {
              if (!c) return '<span class="jr-cell"></span>';
              const has = !!c.entry;
              const dot = has && typeof c.entry.mood === 'number'
                ? `<span class="jr-cell-dot" style="background:${this._rateColor(c.entry.mood)}"></span>`
                : (has ? '<span class="jr-cell-dot"></span>' : '');
              return `<button type="button"
                class="jr-cell ${has ? 'has-entry' : ''} ${c.day === today ? 'is-today' : ''}"
                ${has ? `data-jr-open="${esc(c.entry.id)}"` : 'disabled'}
                aria-label="${esc(this._longDay(c.day))}${has ? ' — entry written' : ' — no entry'}">
                <span class="jr-cell-n">${c.date}</span>${dot}
              </button>`;
            }).join('')}
          </div>

          <div class="jr-avg" style="margin-top:var(--sp-4)">
            ${this._avgRow('Mood', m.mood, 'var(--cyan)')}
            ${this._avgRow('Energy', m.energy, 'var(--warn)')}
            ${this._avgRow('Focus', m.productivity, 'var(--violet)')}
          </div>
          <div class="t-faint t-sm" style="margin-top:var(--sp-3)">
            ${m.words} word${m.words === 1 ? '' : 's'}${m.rated < m.count
              ? ` · ${m.count - m.rated} entr${m.count - m.rated === 1 ? 'y' : 'ies'} left unrated`
              : ''}
          </div>
        </section>`;
    },

    /* --- aside ------------------------------------------------------------ */
    _asideHtml() {
      const j = Derive.journalList();
      return `${this._averagesCard(j)}${this._stripCard(j)}${this._tagsCard(j)}`;
    },

    _avgRow(name, value, color) {
      const pct = value ? (value / 5) * 100 : 0;
      return `
        <div class="jr-avg-row">
          <div class="jr-avg-top">
            <span class="jr-avg-name">${name}</span>
            <span class="jr-avg-num">${value ? value.toFixed(1) + ' / 5' : '—'}</span>
          </div>
          <div class="jr-avg-bar"><div class="jr-avg-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
        </div>`;
    },

    _averagesCard(j) {
      const s = j.summary;
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Averages</div>
              <div class="card-sub">${s.rated
                ? `across ${s.rated} rated day${s.rated === 1 ? '' : 's'}`
                : 'no days rated yet'}</div>
            </div>
          </div>
          <div class="jr-avg">
            ${this._avgRow('Mood', s.mood, 'var(--cyan)')}
            ${this._avgRow('Energy', s.energy, 'var(--warn)')}
            ${this._avgRow('Focus', s.productivity, 'var(--violet)')}
          </div>
          ${s.spanDays ? `<div class="t-faint t-sm" style="margin-top:var(--sp-3)">
            ${s.total} of ${s.spanDays} days written since ${esc(this._shortDay(s.firstDay))}
            — ${Math.round(s.coverage * 100)}% coverage.
          </div>` : ''}
        </section>`;
    },

    _stripCard(j) {
      const rows = j.range;
      const written = rows.filter(r => r.entry).length;
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Last 30 days</div>
              <div class="card-sub">${written} written · ${rows.length - written} blank</div>
            </div>
          </div>
          <div class="jr-strip">
            ${rows.map(r => {
              const bg = !r.entry ? 'var(--surface-2)'
                : (typeof r.mood === 'number' ? this._rateColor(r.mood) : 'var(--surface-3)');
              return `<span title="${esc(this._longDay(r.day))} — ${r.entry
                ? (typeof r.mood === 'number' ? `mood ${r.mood} of 5` : 'written, not rated')
                : 'no entry'}"
                style="background:${bg};border-color:${r.entry ? 'transparent' : 'var(--line-1)'}"></span>`;
            }).join('')}
          </div>
          <div class="jr-legend">
            <i style="background:var(--bad)"></i>
            <i style="background:var(--warn)"></i>
            <i style="background:var(--text-2)"></i>
            <i style="background:var(--accent-2)"></i>
            <i style="background:var(--good)"></i>
            <span>mood 1 → 5</span>
            <i style="background:var(--surface-2);border:1px solid var(--line-1)"></i>
            <span>no entry</span>
          </div>
        </section>`;
    },

    _tagsCard(j) {
      if (!j.tags.length) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Tags</div>
            <span class="badge badge-dot">${j.tags.length}</span>
          </div>
          <div class="jr-tagrow">
            ${j.tags.slice(0, 14).map(t => `
              <button type="button" class="nt-tag" data-jr-tag="${esc(t.tag)}">
                ${esc(t.tag)}<span class="nt-tag-n">${t.count}</span>
              </button>`).join('')}
          </div>
        </section>`;
    },

    /* --- partial repaints -------------------------------------------------
       Regions, not whole-page renders: the composer holds a live textarea, so a
       full re-render would destroy the caret mid-sentence. */
    renderTop() {
      const mount = $('#page-mount');
      if (!mount || Router.current !== 'journal') return;
      const j = Derive.journalList();
      const sub = $('#jr-sub', mount);
      if (sub) sub.textContent = this._summaryLine(j.summary);
      const tiles = $('#jr-tiles', mount);
      if (tiles) tiles.innerHTML = this._tilesHtml(j);
      const badge = $('#jr-today-badge', mount);
      if (badge) {
        badge.className = 'badge' + (j.todayWritten ? ' badge-good' : '');
        badge.textContent = j.todayWritten ? 'Written' : 'Not written yet';
      }
      const tab = $('[data-jr-view="timeline"] .vt-count', mount);
      if (tab) tab.textContent = j.summary.total;
      Shell.setHeader('Journal', `${j.summary.total} entr${j.summary.total === 1 ? 'y' : 'ies'} · ${j.summary.streak}-day streak`);
    },

    renderList() {
      const host = $('#jr-list');
      if (!host || Router.current !== 'journal') return;
      host.innerHTML = `
        <div class="jr-main">${this.view === 'month' ? this._monthCard() : this._timelineCard()}</div>
        <div class="jr-side" id="jr-side">${this._asideHtml()}</div>`;
      this._bindList();
    },

    /* --- wiring ----------------------------------------------------------- */
    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      /* View tabs flip in place rather than re-rendering the page, so the
         composer keeps whatever the user has typed. */
      $$('[data-jr-view]', mount).forEach(b => b.addEventListener('click', () => {
        this._flushBody($('#jr-today'));      // commit before it can be swapped away
        this.view = b.dataset.jrView;
        $$('[data-jr-view]', mount).forEach(x => {
          const on = x.dataset.jrView === this.view;
          x.classList.toggle('is-active', on);
          x.setAttribute('aria-selected', String(on));
        });
        this._renderComposer();
        this.renderList();
      }));

      this._bindWriteButton();
      if (this.view !== 'month') {
        this._bindEditor($('#jr-today'), {
          onChange: () => { this.renderTop(); this.renderList(); },
        });
      }
      this._bindList();
    },

    /* Every handler below is bound once per node (`data-jr-bound`), because a
       partial repaint can hand us a container whose other children are still
       live — binding those twice would double-fire every action. */
    _bindList() {
      const host = $('#jr-list');
      if (!host) return;

      this._bindEntries(host);

      $$('[data-jr-nav]', host).forEach(b => {
        if (b.dataset.jrBound) return;
        b.dataset.jrBound = '1';
        b.addEventListener('click', () => {
          const v = b.dataset.jrNav;
          if (v === 'today') {
            const n = new Date();
            this.year = n.getFullYear();
            this.month = n.getMonth();
          } else {
            let m = this.month + Number(v);
            let y = this.year;
            while (m < 0) { m += 12; y--; }
            while (m > 11) { m -= 12; y++; }
            this.month = m;
            this.year = y;
          }
          this.renderList();
        });
      });

      $$('[data-jr-tag]', host).forEach(b => {
        if (b.dataset.jrBound) return;
        b.dataset.jrBound = '1';
        b.addEventListener('click', () => {
          this.q = b.dataset.jrTag;
          this.view = 'timeline';
          const mount = $('#page-mount');
          if (mount) $$('[data-jr-view]', mount).forEach(x => {
            const on = x.dataset.jrView === 'timeline';
            x.classList.toggle('is-active', on);
            x.setAttribute('aria-selected', String(on));
          });
          this._renderComposer();
          this.renderList();
          const si = $('#jr-search');
          if (si) si.focus();
        });
      });

      const search = $('#jr-search', host);
      if (search && !search.dataset.jrBound) {
        search.dataset.jrBound = '1';
        let timer = null;
        search.addEventListener('input', () => {
          this.q = search.value;
          clearTimeout(timer);
          // Debounced, and repaints only the rows — never the input itself,
          // which would drop focus on every keystroke.
          timer = setTimeout(() => {
            const rows = $('#jr-rows');
            if (!rows) return;
            rows.innerHTML = this._rowsHtml();
            this._bindEntries(rows);
            this._syncCount();
          }, 140);
        });
      }

      this._syncCount();
    },

    _bindEntries(root) {
      $$('[data-jr-open]', root).forEach(b => {
        if (b.dataset.jrBound) return;
        b.dataset.jrBound = '1';
        const go = () => this.openEntry(b.dataset.jrOpen);
        b.addEventListener('click', go);
        b.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
        });
      });
    },

    _syncCount() {
      const countEl = $('#jr-count');
      if (!countEl) return;
      const term = this.q.trim();
      if (term) {
        const n = Derive.journalSearch(term).length;
        countEl.textContent = `${n} match${n === 1 ? '' : 'es'}`;
      } else {
        const n = Derive.journalSorted().length;
        countEl.textContent = `${n} entr${n === 1 ? 'y' : 'ies'}`;
      }
    },

    /* --- the editor's own wiring ------------------------------------------ */
    _bindEditor(root, { onChange } = {}) {
      if (!root) return;

      $$('[data-jr-rate]', root).forEach(b => {
        if (b.dataset.jrBound) return;
        b.dataset.jrBound = '1';
        b.addEventListener('click', () => {
          const key = b.dataset.jrRate;
          const day = b.dataset.jrDay;
          const v = Number(b.dataset.jrValue);
          const current = State.journalByDay(day);
          // Clicking the active dot clears the rating — an honest toggle, and
          // the only way to say "I would rather not rate this".
          const next = (current && current[key] === v) ? null : v;
          const rec = State.rateJournalDay(day, key, next);
          if (!rec) return;
          this._syncRating(root, key, next);
          this._syncStatus(root, rec);
          if (onChange) onChange();
        });
      });

      const body = $('[data-jr-body]', root);
      if (body && !body.dataset.jrBound) {
        body.dataset.jrBound = '1';
        let timer = null;
        const commit = () => {
          clearTimeout(timer);
          timer = null;
          const rec = this._flushBody(root);
          if (!rec) return;
          this._syncWords(root, rec);
          this._syncStatus(root, rec);
          if (onChange) onChange();
        };
        body.addEventListener('input', () => {
          this._markDirty(root);
          clearTimeout(timer);
          timer = setTimeout(commit, 400);
        });
        // Blur covers every dismissal path — backdrop, Escape, or clicking a
        // nav link — so nothing typed is ever lost to the debounce window.
        body.addEventListener('blur', commit);
      }

      const title = $('[data-jr-title]', root);
      if (title && !title.dataset.jrBound) {
        title.dataset.jrBound = '1';
        const day = title.dataset.jrTitleDay || todayKey();
        let last = title.value;
        const commit = () => {
          const v = title.value;
          if (v === last) return;
          last = v;
          let e = State.journalByDay(day);
          if (!e) {
            if (!v.trim()) return;
            e = State.ensureJournalEntry(day);
          }
          const rec = State.updateJournalEntry(e.id, { title: v });
          if (rec) this._syncStatus(root, rec);
          if (onChange) onChange();
        };
        title.addEventListener('blur', commit);
        title.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); title.blur(); }
        });
      }

      this._bindTags(root, onChange);
    },

    _bindTags(root, onChange) {
      const tagIn = $('[data-jr-tagin]', root);
      if (tagIn && !tagIn.dataset.jrBound) {
        tagIn.dataset.jrBound = '1';
        const day = tagIn.dataset.jrTagDay || todayKey();
        tagIn.addEventListener('keydown', ev => {
          if (ev.key !== 'Enter') return;
          ev.preventDefault();
          const v = tagIn.value.trim();
          if (!v) return;
          let e = State.journalByDay(day);
          if (!e) e = State.ensureJournalEntry(day);
          State.updateJournalEntry(e.id, { tags: [...(e.tags || []), v] });
          tagIn.value = '';
          this._repaintTags(root, e.id);
          if (onChange) onChange();
        });
      }

      $$('[data-jr-untag]', root).forEach(b => {
        if (b.dataset.jrBound) return;
        b.dataset.jrBound = '1';
        b.addEventListener('click', () => {
          const day = b.dataset.jrUntagDay || todayKey();
          const e = State.journalByDay(day);
          if (!e) return;
          State.updateJournalEntry(e.id, { tags: (e.tags || []).filter(t => t !== b.dataset.jrUntag) });
          this._repaintTags(root, e.id);
          if (onChange) onChange();
        });
      });
    },

    /* Repaint only the chip strip — the surrounding row (and the tag input the
       user may be typing into) stays put. */
    _repaintTags(root, id) {
      const chips = $('[data-jr-tagchips]', root);
      const e = State.journalById(id);
      if (!chips || !e) return;
      const row = $('[data-jr-tagrow]', root);
      const day = (row && row.dataset.jrTagrowDay) || e.day;
      chips.innerHTML = this._tagChips(e, day);
      this._bindTags(root, null);
    },

    /* --- in-place sync helpers -------------------------------------------- */
    _markDirty(root) {
      const st = $('[data-jr-status]', root);
      if (!st) return;
      st.classList.remove('is-saved');
      st.classList.add('is-dirty');
      st.textContent = 'Unsaved…';
    },
    _syncStatus(root, rec) {
      const st = $('[data-jr-status]', root);
      if (!st || !rec) return;
      st.classList.remove('is-dirty');
      st.classList.add('is-saved');
      st.textContent = `Saved ${Derive.relTime(rec.updatedAt)}`;
    },
    _syncWords(root, rec) {
      const w = $('[data-jr-words]', root);
      if (!w || !rec) return;
      const n = Derive.journalWordCount(rec);
      w.textContent = `${n} word${n === 1 ? '' : 's'}`;
    },
    _syncRating(root, key, value) {
      const dots = $$('[data-jr-rate="' + key + '"]', root);
      if (!dots.length) return;
      dots.forEach(b => {
        const on = Number(b.dataset.jrValue) === value;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
        if (on) b.style.setProperty('--c', this._rateColor(Number(b.dataset.jrValue)));
        else b.style.removeProperty('--c');
      });
      const sc = this.SCALES.find(x => x.key === key);
      const row = dots[0].closest('.jr-scale');
      const val = row ? row.querySelector('.jr-scale-val') : null;
      if (val) val.textContent = value ? sc.words[value - 1] : 'Not rated';
    },

    /* Commit the live textarea inside `root`, creating the day's entry on the
       first real keystroke. Called before any repaint that would destroy the
       node, and on blur. */
    _flushBody(root) {
      const host = root || $('#page-mount');
      const ta = host && host.querySelector('[data-jr-body]');
      if (!ta) return null;
      const text = ta.value;
      const id = ta.dataset.jrBody;
      const day = ta.dataset.jrDay || todayKey();

      if (id) {
        const e = State.journalById(id);
        /* The entry was deleted from under this editor (from the drawer, or by
           an import). Drop the binding instead of resurrecting the record from a
           stale textarea — a deleted entry must stay deleted. */
        if (!e) { ta.dataset.jrBody = ''; return null; }
        return State.updateJournalEntry(e.id, { body: text });
      }

      if (!text.trim()) return null;            // nothing worth a record yet
      const created = State.ensureJournalEntry(day);
      ta.dataset.jrBody = created.id;
      return State.updateJournalEntry(created.id, { body: text });
    },

    /* --- the drawer ------------------------------------------------------- */
    openEntry(id) {
      const e = State.journalById(id);
      if (!e) { Toast.show('That entry no longer exists', 'warn'); return; }
      this.openId = id;
      const panel = Overlay.panel(this._panelHtml(e));
      this._bindPanel(panel);
      return panel;
    },

    close() {
      this._flushBody($('#overlay-root'));
      Overlay.close();
      this.openId = null;
    },

    refreshPanel() {
      const panel = $('.panel');
      if (!panel || !this.openId) return;
      const e = State.journalById(this.openId);
      if (!e) { this.close(); return; }
      const body = $('.panel-body', panel);
      const scroll = body ? body.scrollTop : 0;
      panel.outerHTML = `<aside class="panel" role="dialog" aria-modal="true">${this._panelHtml(e)}</aside>`;
      const next = $('.panel');
      this._bindPanel(next);
      const nb = $('.panel-body', next);
      if (nb) nb.scrollTop = scroll;
    },

    _panelHtml(e) {
      const words = Derive.journalWordCount(e);
      return `
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">Journal</div>
            <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
              <span class="badge">${esc(this._longDay(e.day))}</span>
              <span class="badge">${esc(this._relDay(e.day))}</span>
              <span class="badge">${words} word${words === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button class="iconbtn" data-jrd-close aria-label="Close entry">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">${this._editorHtml(e)}</div>

        <div class="panel-foot">
          <button class="btn btn-ghost btn-sm" data-jrd-today>${icon('book', 13)} Today's entry</button>
          <button class="btn btn-ghost btn-sm act-danger" data-jrd-del style="margin-left:auto">${icon('trash', 13)} Delete entry</button>
        </div>`;
    },

    _bindPanel(panel) {
      if (!panel) return;

      panel.addEventListener('click', ev => {
        if (ev.target.closest('[data-jrd-close]')) return this.close();
        if (ev.target.closest('[data-jrd-today]')) {
          this._flushBody(panel);
          this.close();
          Router.go('journal');
          Toast.show('Jumped to today', 'default');
          return;
        }
        if (ev.target.closest('[data-jrd-del]')) {
          // Flush first: opening the confirm modal replaces the drawer, and the
          // textarea goes with it.
          this._flushBody(panel);
          return this.confirmDelete(this.openId);
        }
      });

      this._bindEditor(panel, {
        onChange: () => { this.renderTop(); this.renderList(); },
      });

      /* Closing the drawer by any path repaints the page behind it, so the
         timeline and the tiles never lag the entry the user just edited. We
         watch the overlay root and treat "root emptied" as the signal. */
      const root = $('#overlay-root');
      if (root) {
        const obs = new MutationObserver(() => {
          if (root.children.length) return;      // still open, or reopened
          obs.disconnect();
          this.openId = null;
          this.renderTop();
          this.renderList();
        });
        obs.observe(root, { childList: true });
      }
    },

    confirmDelete(id) {
      const e = State.journalById(id);
      if (!e) return;
      const words = Derive.journalWordCount(e);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete entry</div>
            <h2 class="t-h2" style="margin-top:6px">Remove this day's entry?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted">
          ${esc(this._longDay(e.day))} — ${words
            ? `${words} word${words === 1 ? '' : 's'} and its ratings will be removed permanently.`
            : 'Its ratings will be removed permanently.'}
          Nothing else in your workspace refers to this entry.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="jr-del-yes">${icon('trash', 14)} Delete entry</button>
        </div>`, { cls: 'modal-sm' });

      $('#jr-del-yes', wrap).addEventListener('click', () => {
        State.deleteJournalEntry(id);
        Overlay.close();
        this.openId = null;
        this.render();
        Toast.show('Journal entry deleted', 'default');
      });
    },
  };

  /* ======================================================================
     INBOX — Milestone 25
     A capture is raw on purpose: you dump it now and decide later. So the page is
     built around one job — get the thought out of your head — and one follow-up —
     put it somewhere real.

     The capture box is a live textarea, so the page repaints in REGIONS: the
     tiles, the head actions and the list are separate from the capture card, and
     an unsent draft is carried across any full repaint (the palette can rebuild
     this page while the box holds something).

     Triage is a real conversion: `State.convertInboxItem` creates the target
     through the same methods every other page uses, so a converted capture is an
     ordinary task / note / project / goal — not an Inbox-only copy. Undoing a
     conversion returns the capture to the queue and leaves the work alone.
     ====================================================================== */
  const InboxPage = {
    q: '',
    tab: 'open',          // 'open' | 'processed' | 'all'
    kind: 'all',          // 'all' | one of INBOX_KINDS
    draft: '',            // unsent capture text, carried across repaints
    draftKind: 'thought',
    draftUrl: '',
    hitId: null,          // briefly highlighted after arriving from the palette

    _kind(key) { return INBOX_KINDS.find(k => k.key === key) || INBOX_KINDS[5]; },
    _kindColor(key) {
      return {
        task: 'var(--accent)', idea: 'var(--warn)', note: 'var(--cyan)',
        link: 'var(--accent-2)', reminder: 'var(--magenta)', thought: 'var(--violet)',
      }[key] || 'var(--text-2)';
    },
    /* Only ever link out over http(s) — a capture could hold anything, and a
       `javascript:` href would be a real hole. */
    _safeUrl(u) {
      const s = String(u || '');
      return /^https?:\/\//i.test(s) ? s : '';
    },

    _visible() {
      let rows = Derive.inboxList().items;
      if (this.tab === 'open') rows = rows.filter(x => x.status === 'inbox');
      else if (this.tab === 'processed') rows = rows.filter(x => x.status === 'processed');
      if (this.kind !== 'all') rows = rows.filter(x => x.kind === this.kind);
      return rows;
    },

    /* --- render ----------------------------------------------------------- */
    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'inbox') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Opening your inbox…</p></div></div></div>';
        return;
      }
      // Never lose an unsent capture to a repaint.
      this._syncDraft();

      const s = Derive.inboxSummary();

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Inbox</div>
            <h1>Inbox</h1>
            <div class="sub" id="ib-sub">${esc(this._summaryLine(s))}</div>
          </div>
          <div class="row gap-2" id="ib-headacts">${this._headActions(s)}</div>
        </div>

        <section class="card ib-capture" id="ib-capture" style="margin-top:var(--sp-4)">
          ${this._captureHtml()}
        </section>

        <div class="proj-stats" id="ib-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(s)}</div>

        <div class="ib-layout" id="ib-list" style="margin-top:var(--sp-4)">
          <div class="ib-main">${this._mainHtml()}</div>
          <div class="ib-side" id="ib-side">${this._asideHtml()}</div>
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Inbox', `${s.open} open · ${s.done} processed`);
    },

    _summaryLine(s) {
      if (!s.total) return 'A place to put things before they have a home. Capture first, decide later.';
      const bits = [s.open ? `${s.open} waiting` : 'inbox zero'];
      if (s.done) bits.push(`${s.done} moved`);
      if (s.today) bits.push(`${s.today} captured today`);
      if (s.oldest) bits.push(`oldest ${s.oldestDays} day${s.oldestDays === 1 ? '' : 's'}`);
      return bits.join(' · ');
    },

    _headActions(s) {
      if (!s.done) return '';
      return `<button class="btn btn-ghost btn-sm" id="ib-clear">${icon('trash', 13)} Clear ${s.done} processed</button>`;
    },

    _tilesHtml(s) {
      return `
        ${Widgets.statTile({ icon: 'inbox', label: 'Open', value: s.open,
          meta: s.open ? `${s.kindsUsed} kind${s.kindsUsed === 1 ? '' : 's'} waiting` : 'inbox zero',
          accent: s.open ? 'var(--accent)' : 'var(--good)' })}
        ${Widgets.statTile({ icon: 'plus', label: 'Captured today', value: s.today,
          meta: s.today ? 'in the last day' : 'nothing captured yet today',
          accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'clock', label: 'Oldest', value: s.oldest ? `${s.oldestDays}d` : '—',
          meta: s.oldest ? 'waiting the longest' : 'nothing waiting',
          accent: s.oldestDays >= 7 ? 'var(--bad)' : 'var(--text-3)' })}
        ${Widgets.statTile({ icon: 'check', label: 'Processed', value: s.done,
          meta: s.done ? 'moved into your workspace' : 'none triaged yet',
          accent: 'var(--good)' })}`;
    },

    /* --- the capture box -------------------------------------------------- */
    _captureHtml() {
      const k = this._kind(this.draftKind);
      const placeholder = k.hint + ' — press Enter to capture';
      return `
        <div class="card-head">
          <div>
            <div class="card-title">Quick capture</div>
            <div class="card-sub">Get it out of your head. Decide where it lives later.</div>
          </div>
        </div>
        <textarea class="textarea ib-input" id="ib-draft"
          placeholder="${esc(placeholder)}" aria-label="Capture anything">${esc(this.draft)}</textarea>
        <div class="ib-capfoot">
          <div class="ib-kinds" role="group" aria-label="What kind of thing is this">
            ${INBOX_KINDS.map(kk => `
              <button type="button" class="ib-kind ${kk.key === this.draftKind ? 'is-on' : ''}"
                data-ib-pick="${kk.key}" aria-pressed="${kk.key === this.draftKind}"
                title="${esc(kk.hint)}">${icon(kk.icon, 12)} ${kk.label}</button>`).join('')}
          </div>
          <span class="ib-hint">Enter captures · Shift + Enter adds a line</span>
          <button class="btn btn-primary btn-sm" id="ib-save">${icon('plus', 13)} Capture</button>
        </div>
        <div class="ib-urlfield" id="ib-urlwrap" ${this.draftKind === 'link' ? '' : 'hidden'}>
          <label class="field-label" for="ib-url">Link</label>
          <input class="field" id="ib-url" type="url" placeholder="https://…"
            value="${esc(this.draftUrl)}" style="margin-top:6px">
        </div>`;
    },

    /* Repaint only the chips and the placeholder — the textarea keeps the caret. */
    _syncKindChips() {
      const cap = $('#ib-capture');
      if (!cap) return;
      $$('[data-ib-pick]', cap).forEach(b => {
        const on = b.dataset.ibPick === this.draftKind;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const ta = $('#ib-draft', cap);
      if (ta) ta.placeholder = this._kind(this.draftKind).hint + ' — press Enter to capture';
      const uw = $('#ib-urlwrap', cap);
      if (uw) uw.hidden = this.draftKind !== 'link';
    },

    /* --- list ------------------------------------------------------------- */
    _mainHtml() {
      return `
        <div class="ib-tools">
          <div class="viewtabs" role="tablist" aria-label="Inbox filter">
            ${this._tabBtn('open', 'Open')}
            ${this._tabBtn('processed', 'Processed')}
            ${this._tabBtn('all', 'All')}
          </div>
        </div>
        <label class="notes-search" style="margin-top:var(--sp-3);max-width:none">
          ${icon('search', 14)}
          <input id="ib-search" type="search" placeholder="Search your captures…"
            value="${esc(this.q)}" aria-label="Search captures" autocomplete="off">
        </label>
        <div class="ib-kindrow" role="group" aria-label="Filter by kind">
          <button type="button" class="ib-kind ${this.kind === 'all' ? 'is-on' : ''}"
            data-ib-kind="all" aria-pressed="${this.kind === 'all'}">All kinds</button>
          ${INBOX_KINDS.map(k => {
            const n = Derive.inboxCounts()[k.key] || 0;
            return `<button type="button" class="ib-kind ${this.kind === k.key ? 'is-on' : ''}"
              data-ib-kind="${k.key}" aria-pressed="${this.kind === k.key}" ${n ? '' : 'disabled'}
              title="${esc(k.hint)}">${icon(k.icon, 12)} ${k.label}
              <span class="ib-kind-n">${n}</span></button>`;
          }).join('')}
        </div>
        <div id="ib-rows">${this._rowsHtml()}</div>`;
    },

    _tabBtn(key, label) {
      const s = Derive.inboxSummary();
      const n = key === 'open' ? s.open : key === 'processed' ? s.done : s.total;
      return `<button class="viewtab ${this.tab === key ? 'is-active' : ''}"
        data-ib-tab="${key}" role="tab" aria-selected="${this.tab === key}">
        ${label} <span class="vt-count">${n}</span></button>`;
    },

    _rowsHtml() {
      if (this.q.trim()) {
        const hits = Derive.inboxSearch(this.q);
        if (!hits.length) {
          return `<div class="card"><div class="empty">
            <div class="empty-ic">${icon('search', 22)}</div>
            <h4>Nothing matches</h4>
            <p>No capture contains “${esc(this.q.trim())}”.</p>
          </div></div>`;
        }
        return `<div class="ib-list">${hits.map(r => this._itemHtml(r.item)).join('')}</div>`;
      }
      const rows = this._visible();
      if (!rows.length) return this._emptyHtml();
      return `<div class="ib-list">${rows.map(it => this._itemHtml(it)).join('')}</div>`;
    },

    _emptyHtml() {
      const s = Derive.inboxSummary();
      if (!s.total) {
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon('inbox', 22)}</div>
          <h4>Nothing captured yet</h4>
          <p>For anything that would otherwise sit in your head or a notes app: a task you
             cannot start yet, a link to read, a thought worth keeping. Capture it above and
             decide where it belongs later.</p>
        </div></div>`;
      }
      if (this.tab === 'open' && !s.open) {
        return `<div class="card"><div class="empty ib-zero">
          <div class="empty-ic">${icon('check', 22)}</div>
          <h4>Inbox zero</h4>
          <p>Every capture has been dealt with — ${s.done} moved into your workspace, nothing
             waiting on you here.</p>
          <button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-4)" data-ib-tab="processed">See what moved</button>
        </div></div>`;
      }
      return `<div class="card"><div class="empty">
        <div class="empty-ic">${icon('filter', 22)}</div>
        <h4>Nothing in this view</h4>
        <p>No capture matches the current tab and kind filter.</p>
        <button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-4)" data-ib-reset>Show everything</button>
      </div></div>`;
    },

    _itemHtml(it) {
      const k = this._kind(it.kind);
      const conv = Derive.inboxConverted(it);
      const done = it.status === 'processed';
      const url = this._safeUrl(it.url);
      return `
        <article class="ib-item ${done ? 'is-done' : ''} ${this.hitId === it.id ? 'is-hit' : ''}"
          data-ib-item="${esc(it.id)}">
          <div class="ib-body">
            <div class="ib-line">
              <span class="ib-kindtag" style="--c:${this._kindColor(it.kind)}"
                title="${esc(k.hint)}">${icon(k.icon, 11)} ${k.label}</span>
              <span class="ib-text">${esc(it.text)}</span>
            </div>
            ${url ? `<a class="ib-url" href="${esc(url)}" target="_blank"
              rel="noopener noreferrer">${esc(url)}</a>` : ''}
            ${conv ? `<span class="ib-conv ${conv.missing ? 'is-missing' : ''}">
                ${icon(conv.icon, 11)} ${conv.missing
                  ? `Moved to ${conv.label} — since deleted`
                  : `Moved to ${conv.label}: ${esc(conv.title || '')}`}
              </span>` : ''}
            <div class="ib-meta">captured ${esc(Derive.inboxAge(it))}${done && it.processedAt
              ? ` · triaged ${esc(Derive.relTime(it.processedAt))}` : ''}</div>
          </div>
          <div class="ib-actions">
            ${done
              ? `${conv && !conv.missing ? `<button class="btn btn-ghost btn-sm" data-ib-open="${esc(it.id)}">${icon('arrowR', 12)} Open</button>` : ''}
                 <button class="btn btn-ghost btn-sm" data-ib-reopen="${esc(it.id)}">${icon('reset', 12)} Undo</button>`
              : `<button class="btn btn-primary btn-sm" data-ib-convert="${esc(it.id)}">${icon('arrowR', 12)} Move</button>`}
            <button class="btn btn-ghost btn-sm" data-ib-edit="${esc(it.id)}" aria-label="Edit capture">${icon('edit', 12)}</button>
            <button class="btn btn-ghost btn-sm act-danger" data-ib-del="${esc(it.id)}" aria-label="Discard capture">${icon('trash', 12)}</button>
          </div>
        </article>`;
    },

    /* --- aside ------------------------------------------------------------ */
    _asideHtml() {
      return `${this._byKindCard()}${this._oldestCard()}${this._movedCard()}`;
    },

    _byKindCard() {
      const s = Derive.inboxSummary();
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">By kind</div>
            <span class="badge badge-dot">${s.open}</span>
          </div>
          ${INBOX_KINDS.map(k => `
            <button class="kn-mini" data-ib-kind="${k.key}" ${s.counts[k.key] ? '' : 'disabled'}>
              ${icon(k.icon, 12)}<span class="t-truncate">${k.label}</span>
              <span class="t-faint">${s.counts[k.key] || 0}</span>
            </button>`).join('')}
          <p class="t-faint t-sm" style="margin:var(--sp-2) 0 0">Open captures only.</p>
        </section>`;
    },

    _oldestCard() {
      const open = Derive.inboxOpen().slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)).slice(0, 4);
      if (!open.length) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Waiting longest</div>
              <div class="card-sub">oldest open captures</div>
            </div>
          </div>
          ${open.map(it => `
            <button class="kn-mini" data-ib-focus="${esc(it.id)}">
              ${icon(this._kind(it.kind).icon, 12)}
              <span class="t-truncate">${esc(it.text)}</span>
              <span class="t-faint">${Derive.inboxAgeDays(it)}d</span>
            </button>`).join('')}
        </section>`;
    },

    _movedCard() {
      const all = Derive.inboxDone();
      if (!all.length) return '';
      const rows = all.slice()
        .sort((a, b) => String(b.processedAt || '').localeCompare(String(a.processedAt || '')))
        .slice(0, 4);
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">Recently moved</div>
            <span class="badge badge-dot">${all.length}</span>
          </div>
          ${rows.map(it => {
            const conv = Derive.inboxConverted(it);
            return `<button class="kn-mini" data-ib-focus="${esc(it.id)}">
              ${icon(conv ? conv.icon : 'inbox', 12)}
              <span class="t-truncate">${esc(conv && conv.title ? conv.title : it.text)}</span>
              <span class="t-faint">${esc(conv ? conv.label : '')}</span>
            </button>`;
          }).join('')}
        </section>`;
    },

    /* --- partial repaints -------------------------------------------------
       Regions, not whole-page renders: the capture card holds a live textarea. */
    renderTop() {
      const mount = $('#page-mount');
      if (!mount || Router.current !== 'inbox') return;
      const s = Derive.inboxSummary();
      const sub = $('#ib-sub', mount);
      if (sub) sub.textContent = this._summaryLine(s);
      const tiles = $('#ib-tiles', mount);
      if (tiles) tiles.innerHTML = this._tilesHtml(s);
      const acts = $('#ib-headacts', mount);
      if (acts) {
        acts.innerHTML = this._headActions(s);
        const clear = $('#ib-clear', mount);
        if (clear) clear.addEventListener('click', () => this.confirmClear());
      }
      Shell.setHeader('Inbox', `${s.open} open · ${s.done} processed`);
    },

    renderList() {
      const main = $('#ib-list .ib-main');
      if (!main || Router.current !== 'inbox') return;
      main.innerHTML = this._mainHtml();
      const side = $('#ib-side');
      if (side) side.innerHTML = this._asideHtml();
      this._bindList();
    },

    /* --- wiring ----------------------------------------------------------- */
    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      const draft = $('#ib-draft', mount);
      if (draft) {
        draft.addEventListener('keydown', ev => {
          if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.capture(); }
        });
      }
      const url = $('#ib-url', mount);
      if (url) url.addEventListener('input', () => { this.draftUrl = url.value; });

      $$('[data-ib-pick]', mount).forEach(b => {
        if (b.dataset.ibBound) return;
        b.dataset.ibBound = '1';
        b.addEventListener('click', () => {
          this.draftKind = b.dataset.ibPick;
          this._syncKindChips();
        });
      });

      const save = $('#ib-save', mount);
      if (save) save.addEventListener('click', () => this.capture());

      const clear = $('#ib-clear', mount);
      if (clear) clear.addEventListener('click', () => this.confirmClear());

      this._bindList();
    },

    _bindList() {
      const host = $('#ib-list');
      if (!host) return;

      const bind = (sel, fn) => $$(sel, host).forEach(b => {
        if (b.dataset.ibBound) return;
        b.dataset.ibBound = '1';
        b.addEventListener('click', () => fn(b));
      });

      bind('[data-ib-tab]', b => { this.tab = b.dataset.ibTab; this.renderList(); });
      bind('[data-ib-kind]', b => { this.kind = b.dataset.ibKind; this.renderList(); });
      bind('[data-ib-reset]', () => {
        this.tab = 'open'; this.kind = 'all'; this.q = '';
        this.renderList();
      });

      const search = $('#ib-search', host);
      if (search && !search.dataset.ibBound) {
        search.dataset.ibBound = '1';
        let timer = null;
        search.addEventListener('input', () => {
          this.q = search.value;
          clearTimeout(timer);
          // Debounced, and repaints only the rows — the input keeps focus.
          timer = setTimeout(() => {
            const rows = $('#ib-rows');
            if (!rows) return;
            rows.innerHTML = this._rowsHtml();
            this._bindRows(rows);
          }, 140);
        });
      }

      this._bindRows(host);
    },

    /* Bind once per node: a rows-only repaint leaves the aside and the tools
       live, so re-binding the container must not double-fire them. */
    _bindRows(root) {
      const bind = (sel, fn) => $$(sel, root).forEach(b => {
        if (b.dataset.ibBound) return;
        b.dataset.ibBound = '1';
        b.addEventListener('click', () => fn(b));
      });
      bind('[data-ib-convert]', b => this.openConvert(b.dataset.ibConvert));
      bind('[data-ib-reopen]', b => {
        State.reopenInboxItem(b.dataset.ibReopen);
        Toast.show('Back in the queue', 'default');
        this.renderTop();
        this.renderList();
      });
      bind('[data-ib-open]', b => this._openTarget(b.dataset.ibOpen));
      bind('[data-ib-edit]', b => this.openEdit(b.dataset.ibEdit));
      bind('[data-ib-del]', b => this.confirmDelete(b.dataset.ibDel));
      bind('[data-ib-focus]', b => this.focusItem(b.dataset.ibFocus));
    },

    /* --- actions ---------------------------------------------------------- */
    /* Keep an unsent capture across a full repaint — the palette can rebuild this
       page while the box holds something the user has not sent yet. */
    _syncDraft() {
      const ta = $('#ib-draft');
      if (ta) this.draft = ta.value;
      const u = $('#ib-url');
      if (u) this.draftUrl = u.value;
    },

    capture() {
      const ta = $('#ib-draft');
      if (!ta) return null;
      const text = ta.value.trim();
      if (!text) { Toast.show('Nothing to capture yet', 'warn'); return null; }
      const it = State.addInboxItem({
        text,
        kind: this.draftKind,
        url: this.draftKind === 'link' ? this.draftUrl : '',
      });
      if (!it) return null;
      ta.value = '';
      this.draft = '';
      this.draftUrl = '';
      const urlEl = $('#ib-url');
      if (urlEl) urlEl.value = '';
      ta.focus();
      // A new capture always lands in the open queue, so make sure it is visible.
      if (this.tab !== 'open') this.tab = 'open';
      if (this.kind !== 'all' && this.kind !== it.kind) this.kind = 'all';
      this.renderTop();
      this.renderList();
      Toast.show('Captured', 'good');
      return it;
    },

    /* Arriving from the palette: search for a capture and put it in view. */
    searchFor(q) {
      this._syncDraft();
      this.q = q;
      this.tab = 'all';
      this.kind = 'all';
      this.render();
      const si = $('#ib-search');
      if (si) si.focus();
    },

    focusItem(id) {
      const it = State.inboxById(id);
      if (!it) return;
      this.q = '';
      this.tab = it.status === 'processed' ? 'processed' : 'open';
      this.kind = 'all';
      this.hitId = id;
      this.renderList();
      const row = $('[data-ib-item="' + id + '"]');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(() => {
        if (this.hitId !== id) return;
        this.hitId = null;
        this.renderList();
      }, 2200);
    },

    _openTarget(id) {
      const it = State.inboxById(id);
      const conv = it ? Derive.inboxConverted(it) : null;
      if (!conv || !conv.record) { Toast.show('That record no longer exists', 'warn'); return; }
      if (conv.type === 'task') return TaskDetail.open(conv.record.id);
      if (conv.type === 'note') return Router.go('notes', { open: conv.record.id });
      if (conv.type === 'project') return ProjectDetail.open(conv.record.name);
      if (conv.type === 'goal') return GoalDetail.open(conv.record.id);
      if (conv.type === 'journal') return Router.go('journal');
    },

    openConvert(id) {
      const it = State.inboxById(id);
      if (!it) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Move this capture</div>
            <h2 class="t-h2" style="margin-top:6px">Where should it live?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">${esc(it.text)}</p>
        <div class="p-sec">
          ${INBOX_DESTS.map(d => `
            <button class="kn-mini" data-ib-dest="${d.type}" style="padding:10px var(--sp-2)">
              <span style="color:${this._kindColor(it.kind)};display:inline-flex">${icon(d.icon, 14)}</span>
              <span style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;min-width:0">
                <span style="font-size:var(--fs-sm);font-weight:var(--fw-medium)">${d.label}</span>
                <span class="t-faint t-sm">${esc(d.blurb)}</span>
              </span>
              <span class="t-faint" style="margin-left:auto;display:inline-flex;flex:0 0 auto">${icon('chevR', 13)}</span>
            </button>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
        </div>`, { cls: 'modal-md' });

      $$('[data-ib-dest]', wrap).forEach(b => b.addEventListener('click', () => {
        const type = b.dataset.ibDest;
        const res = State.convertInboxItem(id, type);
        Overlay.close();
        if (!res) { Toast.show('Could not move that capture', 'warn'); return; }
        const dest = INBOX_DESTS.find(d => d.type === type);
        Toast.show(`Moved to ${dest.label}`, 'good');
        this.renderTop();
        this.renderList();
      }));
    },

    openEdit(id) {
      const it = State.inboxById(id);
      if (!it) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Edit capture</div>
            <h2 class="t-h2" style="margin-top:6px">Captured ${esc(Derive.inboxAge(it))}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="ib-edit-text">Capture</label>
          <textarea class="textarea" id="ib-edit-text" aria-label="Capture text">${esc(it.text)}</textarea>
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <span class="field-label">Kind</span>
          <div class="ib-kinds" role="group" aria-label="Kind">
            ${INBOX_KINDS.map(k => `
              <button type="button" class="ib-kind ${it.kind === k.key ? 'is-on' : ''}"
                data-ib-editkind="${k.key}" aria-pressed="${it.kind === k.key}">${icon(k.icon, 12)} ${k.label}</button>`).join('')}
          </div>
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="ib-edit-url">Link (optional)</label>
          <input class="field" id="ib-edit-url" type="url" value="${esc(it.url)}" placeholder="https://…">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="ib-edit-save">${icon('check', 14)} Save</button>
        </div>`, { cls: 'modal-md' });

      let kind = it.kind;
      $$('[data-ib-editkind]', wrap).forEach(b => b.addEventListener('click', () => {
        kind = b.dataset.ibEditkind;
        $$('[data-ib-editkind]', wrap).forEach(x => {
          const on = x.dataset.ibEditkind === kind;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', String(on));
        });
      }));

      $('#ib-edit-save', wrap).addEventListener('click', () => {
        const text = $('#ib-edit-text', wrap).value;
        if (!text.trim()) { Toast.show('A capture needs some text', 'warn'); return; }
        State.updateInboxItem(id, { text, kind, url: $('#ib-edit-url', wrap).value });
        Overlay.close();
        Toast.show('Capture updated', 'good');
        this.renderTop();
        this.renderList();
      });
    },

    confirmDelete(id) {
      const it = State.inboxById(id);
      if (!it) return;
      const conv = Derive.inboxConverted(it);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Discard capture</div>
            <h2 class="t-h2" style="margin-top:6px">Throw this away?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">${esc(it.text)}</p>
        ${conv ? `<p class="t-sm t-muted" style="margin-top:var(--sp-2)">${conv.missing
          ? `It pointed at a ${conv.label.toLowerCase()} that no longer exists.`
          : `The ${conv.label.toLowerCase()} it became — “${esc(conv.title)}” — is kept. Only this capture is removed.`}</p>` : ''}
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="ib-del-yes">${icon('trash', 14)} Discard</button>
        </div>`, { cls: 'modal-sm' });

      $('#ib-del-yes', wrap).addEventListener('click', () => {
        State.deleteInboxItem(id);
        Overlay.close();
        Toast.show('Capture discarded', 'default');
        this.renderTop();
        this.renderList();
      });
    },

    confirmClear() {
      const s = Derive.inboxSummary();
      if (!s.done) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Clear processed</div>
            <h2 class="t-h2" style="margin-top:6px">Clear ${s.done} processed capture${s.done === 1 ? '' : 's'}?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          Only the capture records are removed. Every task, note, project and goal they
          became stays exactly where it is.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="ib-clear-yes">${icon('trash', 14)} Clear ${s.done}</button>
        </div>`, { cls: 'modal-sm' });

      $('#ib-clear-yes', wrap).addEventListener('click', () => {
        const n = State.clearProcessedInbox();
        Overlay.close();
        Toast.show(`Cleared ${n} processed capture${n === 1 ? '' : 's'}`, 'default');
        this.renderTop();
        this.renderList();
      });
    },
  };

  /* ======================================================================
     FINANCE — Milestone 26
     The transaction log is the truth. Every figure this page and the dashboard
     snapshot show — the month totals, the category breakdown and its
     percentages, the savings rate, the trend, the seven bars on the dashboard —
     is derived from `State.transactions` on every render.

     That is a correction, not a nicety: the previous demo stored a category
     breakdown with per-category `value` and `pct`, a frozen seven-day spending
     array and a `spendPercent`. None of them could be recomputed and none of them
     moved when a transaction changed. They are gone.

     Amounts are stored as positive magnitudes; `type` carries the sign, so a
     "-500 expense" and a "500 refund" can never be confused for each other.
     ====================================================================== */
  const FinancePage = {
    view: 'month',          // 'month' | 'trend' | 'all'
    year: null,
    month: null,            // 0-based
    q: '',
    typeFilter: 'all',      // 'all' | 'expense' | 'income'
    catFilter: 'all',
    limit: 60,              // the All view pages in, rather than rendering 200 rows

    _ensureMonth() {
      if (this.year === null) {
        const n = new Date();
        this.year = n.getFullYear();
        this.month = n.getMonth();
      }
    },
    _cat(name) {
      return FINANCE_CATEGORIES.find(c => c.name === name)
        || { name, color: 'var(--text-2)', icon: 'more' };
    },
    _prevMonth() {
      const d = new Date(this.year, this.month - 1, 1);
      return Derive.financeMonth(d.getFullYear(), d.getMonth());
    },

    /* --- render ----------------------------------------------------------- */
    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'finance') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Adding up…</p></div></div></div>';
        return;
      }
      this._ensureMonth();
      const j = Derive.financeList();
      const m = Derive.financeMonth(this.year, this.month);

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Finance</div>
            <h1>Finance</h1>
            <div class="sub" id="fin-sub">${esc(this._summaryLine(j, m))}</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary btn-sm" id="fin-new">${icon('plus', 13)} Add transaction</button>
          </div>
        </div>

        <div class="proj-stats" id="fin-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(m, this._prevMonth())}</div>

        <div class="fin-layout" id="fin-list" style="margin-top:var(--sp-4)">
          <div class="fin-main">${this._mainHtml()}</div>
          <div class="fin-side" id="fin-side">${this._asideHtml(j, m)}</div>
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Finance', `${Derive.money(m.expenses)} out · ${Derive.money(m.income)} in this month`);
    },

    _summaryLine(j, m) {
      if (!j.summary.total) {
        return 'A real ledger: record what comes in and what goes out, and every total, breakdown and rate follows.';
      }
      const bits = [`${j.summary.total} transactions`];
      if (j.summary.months) bits.push(`across ${j.summary.months} month${j.summary.months === 1 ? '' : 's'}`);
      if (j.summary.firstDay) bits.push(`since ${esc(Derive.shortDay(j.summary.firstDay))}`);
      return bits.join(' · ');
    },

    _tilesHtml(m, prev) {
      const delta = (cur, was) => {
        if (!was) return cur ? 'nothing to compare with' : 'nothing recorded';
        const d = cur - was;
        if (!d) return 'unchanged from last month';
        return `${d > 0 ? '+' : '−'}${Derive.money(Math.abs(d))} vs last month`;
      };
      return `
        ${Widgets.statTile({ icon: 'arrowR', label: 'Income', value: Derive.money(m.income),
          meta: delta(m.income, prev.income), accent: 'var(--good)' })}
        ${Widgets.statTile({ icon: 'wallet', label: 'Expenses', value: Derive.money(m.expenses),
          meta: delta(m.expenses, prev.expenses), accent: 'var(--bad)' })}
        ${Widgets.statTile({ icon: 'target', label: 'Net', value: Derive.money(m.net),
          meta: m.count ? `${m.count} transaction${m.count === 1 ? '' : 's'}` : 'none this month',
          accent: m.net >= 0 ? 'var(--good)' : 'var(--bad)' })}
        ${Widgets.statTile({ icon: 'chart', label: 'Savings rate',
          value: m.income ? Math.round(m.savingsRate * 100) + '%' : '—',
          meta: m.income ? 'of this month’s income' : 'no income this month',
          accent: 'var(--accent)' })}`;
    },

    /* --- views ------------------------------------------------------------ */
    _mainHtml() {
      return `
        <div class="fin-tools">
          <div class="viewtabs" role="tablist" aria-label="Finance view">
            ${this._tabBtn('month', 'Month')}
            ${this._tabBtn('trend', 'Trend')}
            ${this._tabBtn('budgets', 'Budgets')}
            ${this._tabBtn('insights', 'Insights')}
            ${this._tabBtn('all', 'All')}
          </div>
        </div>
        ${this.view === 'month' ? this._monthHtml()
          : this.view === 'trend' ? this._trendHtml()
          : this.view === 'budgets' ? this._budgetsHtml()
          : this.view === 'insights' ? this._insightsHtml()
          : this._allHtml()}`;
    },

    /* Shared month stepper — the month lens is the same wherever it appears. */
    _monthNav() {
      return `<div class="row gap-2">
        <button class="iconbtn" data-fin-nav="-1" aria-label="Previous month">${icon('chevL', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-fin-nav="today">This month</button>
        <button class="iconbtn" data-fin-nav="1" aria-label="Next month">${icon('chevR', 14)}</button>
      </div>`;
    },

    _tabBtn(key, label) {
      return `<button class="viewtab ${this.view === key ? 'is-active' : ''}"
        data-fin-view="${key}" role="tab" aria-selected="${this.view === key}">${label}</button>`;
    },

    _monthHtml() {
      const m = Derive.financeMonth(this.year, this.month);
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head">
            <div>
              <div class="card-title">${MONTHS[this.month]} ${this.year}</div>
              <div class="card-sub">${m.count
                ? `${m.count} transaction${m.count === 1 ? '' : 's'} · ${Derive.money(m.perTransaction)} typical`
                : 'nothing recorded this month'}</div>
            </div>
            ${this._monthNav()}
          </div>

          <div class="fin-sum">
            ${this._sumItem('In', m.income, 'var(--good)')}
            ${this._sumItem('Out', m.expenses, 'var(--bad)')}
            ${this._sumItem('Net', m.net, m.net >= 0 ? 'var(--good)' : 'var(--bad)')}
            ${this._sumItem('Avg / day', m.avgPerDay, 'var(--text-1)')}
          </div>

          ${m.count ? `
            <div class="fin-cats">
              ${m.byCategory.map(c => this._catRow(c)).join('')}
            </div>
            ${m.byDay.map(g => `
              <div class="fin-day">
                <div class="fin-dayhead">${esc(Derive.longDay(g.day))}
                  <b>${g.spend ? Derive.money(-g.spend) : Derive.money(g.earned)}</b></div>
                <div class="tx-list">${g.rows.map(t => this._txRow(t, false)).join('')}</div>
              </div>`).join('')}
          ` : `<div class="empty" style="padding:var(--sp-5) 0">
            <div class="empty-ic">${icon('wallet', 22)}</div>
            <h4>Nothing in ${MONTHS[this.month]}</h4>
            <p>No transactions are recorded for this month. Add one, or step back to a
               month that has some.</p>
          </div>`}
        </section>`;
    },

    _sumItem(key, value, color) {
      return `<div class="fin-sum-item">
        <span class="fin-sum-key">${key}</span>
        <span class="fin-sum-val" style="color:${color}">${Derive.money(value)}</span>
      </div>`;
    },

    _catRow(c) {
      return `
        <div class="fin-cat">
          <div class="fin-cat-top">
            <span class="fin-cat-name">${esc(c.name)}</span>
            <span class="fin-cat-n">${c.count}×</span>
            <span class="fin-cat-val">${Derive.money(c.value)} · ${Math.round(c.pct * 100)}%</span>
          </div>
          <div class="fin-cat-bar">
            <div class="fin-cat-fill" style="width:${(c.pct * 100).toFixed(1)}%;background:${c.color}"></div>
          </div>
        </div>`;
    },

    _sumRaw(key, text, color) {
      return `<div class="fin-sum-item">
        <span class="fin-sum-key">${key}</span>
        <span class="fin-sum-val" style="color:${color}">${text}</span>
      </div>`;
    },

    /* --- budgets ---------------------------------------------------------- */
    _budgetsHtml() {
      const b = Derive.financeBudgets(this.year, this.month);
      const monthName = MONTHS[this.month];
      const tone = b.pct > 1 ? 'var(--bad)' : b.pct >= 0.8 ? 'var(--warn)' : 'var(--good)';
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head">
            <div>
              <div class="card-title">Budgets · ${monthName}</div>
              <div class="card-sub">${b.set
                ? `${b.set} target${b.set === 1 ? '' : 's'} · ${Derive.money(b.totalSpent)} of ${Derive.money(b.totalTarget)} used`
                : 'no targets set yet'}</div>
            </div>
            ${this._monthNav()}
          </div>

          ${b.set ? `
            <div class="fin-sum">
              ${this._sumItem('Budgeted', b.totalTarget, 'var(--text-1)')}
              ${this._sumItem('Used', b.totalSpent, b.pct > 1 ? 'var(--bad)' : 'var(--text-1)')}
              ${this._sumRaw('Left', b.totalRemaining >= 0
                ? Derive.money(b.totalRemaining) : '−' + Derive.money(-b.totalRemaining),
                b.totalRemaining >= 0 ? 'var(--good)' : 'var(--bad)')}
              ${this._sumRaw('Consumed', Math.round(b.pct * 100) + '%', tone)}
            </div>` : ''}

          <div class="fin-cats">
            ${b.all.map(r => this._budgetRow(r)).join('')}
          </div>

          <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
            Targets are the one thing about money that cannot be derived — they are what
            you meant to spend. Everything measured against them comes from the log, so
            editing a transaction moves these bars immediately.
          </p>
        </section>`;
    },

    _budgetRow(r) {
      const pct = r.target ? r.pct : 0;
      const tone = r.over ? 'var(--bad)' : pct >= 0.8 ? 'var(--warn)' : 'var(--good)';
      return `
        <div class="fin-cat fin-budget ${r.over ? 'is-over' : ''}" data-fin-budget="${esc(r.name)}">
          <div class="fin-cat-top">
            <span class="fin-cat-name">${icon(r.icon, 12)} ${esc(r.name)}</span>
            <span class="fin-cat-n">${r.count ? r.count + '×' : '—'}</span>
            <span class="fin-cat-val">${r.target
              ? `${Derive.money(r.spent)} of ${Derive.money(r.target)}`
              : `${Derive.money(r.spent)} · no target`}</span>
          </div>
          ${r.target ? `<div class="fin-cat-bar">
            <div class="fin-cat-fill" style="width:${Math.min(100, pct * 100).toFixed(1)}%;background:${tone}"></div>
          </div>` : ''}
          <div class="fin-cat-foot">
            <span class="t-faint t-sm">${!r.target
              ? 'Nothing budgeted for this'
              : r.over
                ? `Over by ${Derive.money(r.spent - r.target)} · ${Math.round(pct * 100)}% used`
                : `${Derive.money(r.remaining)} left · ${Math.round(pct * 100)}% used`}</span>
            <button class="btn btn-ghost btn-sm" data-fin-setbudget="${esc(r.name)}">
              ${r.target ? 'Edit target' : 'Set target'}</button>
          </div>
        </div>`;
    },

    /* --- insights --------------------------------------------------------- */
    _insightsHtml() {
      const rows = Derive.financeInsights(this.year, this.month);
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head">
            <div>
              <div class="card-title">Insights · ${MONTHS[this.month]} ${this.year}</div>
              <div class="card-sub">read straight off your own log — nothing estimated</div>
            </div>
            ${this._monthNav()}
          </div>
          <div class="fin-insights">
            ${rows.map(i => `
              <div class="fin-insight is-${esc(i.tone)}">
                <span class="fin-insight-ic">${icon(i.icon, 14)}</span>
                <p>${esc(i.text)}</p>
              </div>`).join('')}
          </div>
        </section>`;
    },

    openBudget(category) {
      const cat = FINANCE_CATEGORIES.find(c => c.name === category && c.type === 'expense');
      if (!cat) return;
      const cur = ((State.finance || {}).budgets || {})[category] || 0;
      const spent = Derive.financeMonth(this.year, this.month).byCategory
        .find(x => x.name === category);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Monthly budget</div>
            <h2 class="t-h2" style="margin-top:6px">${esc(cat.name)}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          A target you set once and measure against every month. It is an intention, not a
          total — the spending side comes from your transactions.${
            spent ? ` You have spent ${esc(Derive.money(spent.value))} on this so far in ${esc(MONTHS[this.month])}.` : ''}
        </p>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="fin-budget">Target per month</label>
          <input class="field" id="fin-budget" type="number" min="0" step="1" inputmode="decimal"
            placeholder="0" value="${cur || ''}">
        </div>
        <div class="modal-actions">
          ${cur ? `<button class="btn btn-ghost act-danger" id="fin-budget-clear" style="margin-right:auto">Remove target</button>` : ''}
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="fin-budget-save">${icon('check', 14)} Save</button>
        </div>`, { cls: 'modal-sm' });

      $('#fin-budget-save', wrap).addEventListener('click', () => {
        const v = Number($('#fin-budget', wrap).value);
        if (!(v > 0)) { Toast.show('A target above zero, please — or remove it', 'warn'); return; }
        State.setBudget(category, v);
        Overlay.close();
        Toast.show(`${cat.name} budget set to ${Derive.money(v)}`, 'good');
        this.renderList();
      });

      const clr = $('#fin-budget-clear', wrap);
      if (clr) clr.addEventListener('click', () => {
        State.setBudget(category, 0);
        Overlay.close();
        Toast.show(`${cat.name} budget removed`, 'default');
        this.renderList();
      });
    },

    _trendHtml() {
      const trend = Derive.financeTrend(6);
      const range = Derive.financeRange(30);
      const max = Math.max(...trend.map(t => Math.max(t.income, t.expenses)), 1);
      const maxSpend = Math.max(...range.map(d => d.spend), 1);
      const h = v => Math.round((v / max) * 100);
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head">
            <div>
              <div class="card-title">Last six months</div>
              <div class="card-sub">income against spending, month by month</div>
            </div>
          </div>
          <div class="fin-chart">
            ${trend.map(t => `
              <div class="fin-bar ${t.current ? 'is-current' : ''}">
                <div class="fin-bar-pair">
                  <i style="height:${h(t.income)}%;background:var(--good)"
                    title="${esc(MONTHS[t.month])} income ${esc(Derive.money(t.income))}"></i>
                  <i style="height:${h(t.expenses)}%;background:var(--bad)"
                    title="${esc(MONTHS[t.month])} spending ${esc(Derive.money(t.expenses))}"></i>
                </div>
                <span class="fin-bar-lbl">${t.label}</span>
              </div>`).join('')}
          </div>
          <div class="fin-legend">
            <i style="background:var(--good)"></i><span>income</span>
            <i style="background:var(--bad)"></i><span>spending</span>
          </div>

          <div class="fin-table">
            <div class="fin-trow is-head">
              <span>Month</span><span>In</span><span class="fin-thide">Out</span><span>Net</span>
            </div>
            ${trend.slice().reverse().map(t => `
              <div class="fin-trow ${t.current ? 'is-current' : ''}">
                <span>${MONTHS[t.month]} ${String(t.year).slice(2)}${t.current ? ' · now' : ''}</span>
                <span class="t-pos">${Derive.money(t.income)}</span>
                <span class="fin-thide t-neg">${Derive.money(t.expenses)}</span>
                <span class="${t.net >= 0 ? 't-pos' : 't-neg'}">${Derive.money(t.net)}</span>
              </div>`).join('')}
          </div>
        </section>

        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head">
            <div>
              <div class="card-title">Last 30 days</div>
              <div class="card-sub">a column per day, filled by how much went out</div>
            </div>
          </div>
          <div class="fin-strip">
            ${range.map(d => {
              const pct = d.spend / maxSpend;
              const bg = !d.spend ? 'var(--surface-2)'
                : pct > 0.66 ? 'var(--bad)' : pct > 0.33 ? 'var(--warn)' : 'var(--accent)';
              return `<span style="background:${bg};border-color:${d.spend ? 'transparent' : 'var(--line-1)'}"
                title="${esc(Derive.longDay(d.day))} — ${d.spend
                  ? esc(Derive.money(d.spend)) + (d.earned ? ' out, ' + esc(Derive.money(d.earned)) + ' in' : '')
                  : 'nothing recorded'}"></span>`;
            }).join('')}
          </div>
          <div class="fin-legend">
            <i style="background:var(--accent)"></i><span>light</span>
            <i style="background:var(--warn)"></i><span>busy</span>
            <i style="background:var(--bad)"></i><span>heavy</span>
            <i style="background:var(--surface-2);border:1px solid var(--line-1)"></i><span>nothing</span>
          </div>
        </section>`;
    },

    _allHtml() {
      const used = new Set(Derive.transactionsSorted().map(t => t.category));
      return `
        <div class="fin-tools" style="margin-top:var(--sp-4)">
          <label class="notes-search" style="max-width:none">
            ${icon('search', 14)}
            <input id="fin-search" type="search" placeholder="Search labels, categories, amounts, dates…"
              value="${esc(this.q)}" aria-label="Search transactions" autocomplete="off">
          </label>
        </div>
        <div class="fin-filters" role="group" aria-label="Filter transactions">
          ${this._chip('all', 'Everything')}
          ${this._chip('expense', 'Expenses')}
          ${this._chip('income', 'Income')}
          <span class="fin-legend" style="margin:0 0 0 var(--sp-2)"><i style="background:var(--line-1)"></i><span>type</span></span>
        </div>
        <div class="fin-filters" role="group" aria-label="Filter by category">
          <button type="button" class="ib-kind ${this.catFilter === 'all' ? 'is-on' : ''}"
            data-fin-cat="all" aria-pressed="${this.catFilter === 'all'}">All categories</button>
          ${FINANCE_CATEGORIES.filter(c => used.has(c.name)).map(c => `
            <button type="button" class="ib-kind ${this.catFilter === c.name ? 'is-on' : ''}"
              data-fin-cat="${esc(c.name)}" aria-pressed="${this.catFilter === c.name}">
              ${icon(c.icon, 12)} ${esc(c.name)}</button>`).join('')}
        </div>
        <div id="fin-rows" style="margin-top:var(--sp-4)">${this._rowsHtml()}</div>`;
    },

    _chip(key, label) {
      return `<button type="button" class="ib-kind ${this.typeFilter === key ? 'is-on' : ''}"
        data-fin-type-filter="${key}" aria-pressed="${this.typeFilter === key}">${label}</button>`;
    },

    _filtered() {
      let rows = Derive.transactionsSorted();
      if (this.typeFilter !== 'all') rows = rows.filter(t => t.type === this.typeFilter);
      if (this.catFilter !== 'all') rows = rows.filter(t => t.category === this.catFilter);
      return rows;
    },

    _rowsHtml() {
      if (this.q.trim()) {
        const hits = Derive.financeSearch(this.q);
        if (!hits.length) {
          return `<div class="card"><div class="empty">
            <div class="empty-ic">${icon('search', 22)}</div>
            <h4>Nothing matches</h4>
            <p>No label, category, note, amount or date contains “${esc(this.q.trim())}”.</p>
          </div></div>`;
        }
        return `<div class="tx-list">${hits.map(r => this._txRow(r.tx, true)).join('')}</div>`;
      }
      const rows = this._filtered();
      if (!rows.length) {
        const any = Derive.transactionsSorted().length;
        return `<div class="card"><div class="empty">
          <div class="empty-ic">${icon('filter', 22)}</div>
          <h4>Nothing in this view</h4>
          <p>${any ? 'No transaction matches the current filters.' : 'No transactions recorded yet.'}</p>
          ${any ? '<button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-4)" data-fin-reset>Show everything</button>' : ''}
        </div></div>`;
      }
      const shown = rows.slice(0, this.limit);
      return `<div class="tx-list">${shown.map(t => this._txRow(t, true)).join('')}</div>
        ${rows.length > shown.length
          ? `<button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-3)" data-fin-more>
               Show ${Math.min(60, rows.length - shown.length)} more</button>
             <div class="t-faint t-sm" style="margin-top:var(--sp-2)">Showing ${shown.length} of ${rows.length}</div>`
          : `<div class="t-faint t-sm" style="margin-top:var(--sp-3)">${rows.length} transaction${rows.length === 1 ? '' : 's'}</div>`}`;
    },

    _txRow(t, showDate) {
      const cat = this._cat(t.category);
      const out = t.type === 'expense';
      return `
        <div class="tx-row" data-fin-tx="${esc(t.id)}">
          <span class="tx-ic" style="--c:${cat.color}" title="${esc(t.category)}">${icon(cat.icon, 13)}</span>
          <div class="tx-main">
            <div class="tx-label">${esc(t.label)}</div>
            <div class="tx-meta">${esc(t.category)}${showDate ? ' · ' + esc(Derive.shortDay(t.day)) : ''}${
              t.note ? ' · ' + esc(t.note) : ''}</div>
          </div>
          <span class="tx-amt ${out ? '' : 'is-in'}">${out ? '−' : '+'}${Derive.money(t.amount)}</span>
          <span class="tx-acts">
            <button class="btn btn-ghost btn-sm" data-fin-edit="${esc(t.id)}"
              aria-label="Edit ${esc(t.label)}">${icon('edit', 12)}</button>
            <button class="btn btn-ghost btn-sm act-danger" data-fin-del="${esc(t.id)}"
              aria-label="Delete ${esc(t.label)}">${icon('trash', 12)}</button>
          </span>
        </div>`;
    },

    /* --- aside ------------------------------------------------------------ */
    _asideHtml(j, m) {
      return `${this._budgetCard()}${this._topSpendCard(m)}${this._allTimeCard(j)}${this._currencyCard()}`;
    },

    /* Visible from every view, so the budget is never a page you have to remember
       to visit. Hidden entirely until a target exists. */
    _budgetCard() {
      const b = Derive.financeBudgets(this.year, this.month);
      if (!b.set) return '';
      const tone = b.pct > 1 ? 'var(--bad)' : b.pct >= 0.8 ? 'var(--warn)' : 'var(--good)';
      const badge = b.pct > 1 ? 'badge-bad' : b.pct >= 0.8 ? 'badge-warn' : 'badge-good';
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Budget</div>
              <div class="card-sub">${esc(MONTHS[this.month])} · ${b.set} target${b.set === 1 ? '' : 's'}</div>
            </div>
            <span class="badge ${badge}">${Math.round(b.pct * 100)}%</span>
          </div>
          <div class="fin-cat-bar">
            <div class="fin-cat-fill" style="width:${Math.min(100, b.pct * 100).toFixed(1)}%;background:${tone}"></div>
          </div>
          <div class="row-between" style="margin-top:var(--sp-3)">
            <span class="t-sm t-muted">${Derive.money(b.totalSpent)} of ${Derive.money(b.totalTarget)}</span>
            <b class="t-num" style="color:${tone}">${b.totalRemaining >= 0
              ? Derive.money(b.totalRemaining) + ' left'
              : Derive.money(-b.totalRemaining) + ' over'}</b>
          </div>
          <button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-3)" data-fin-view="budgets">
            ${icon('target', 13)} Open budgets</button>
        </section>`;
    },

    _topSpendCard(m) {
      const rows = m.rows.filter(t => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 4);
      if (!rows.length) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Biggest this month</div>
              <div class="card-sub">${esc(MONTHS[this.month])}</div>
            </div>
          </div>
          ${rows.map(t => `
            <button class="kn-mini" data-fin-focus="${esc(t.id)}">
              ${icon(this._cat(t.category).icon, 12)}
              <span class="t-truncate">${esc(t.label)}</span>
              <span class="t-faint">${Derive.money(t.amount)}</span>
            </button>`).join('')}
        </section>`;
    },

    _allTimeCard(j) {
      const s = j.summary;
      if (!s.total) return '';
      return `
        <section class="card">
          <div class="card-head">
            <div class="card-title">All time</div>
            <span class="badge badge-dot">${s.total}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
            <div class="row-between"><span class="t-sm t-muted">In</span>
              <b class="t-num" style="color:var(--good)">${Derive.money(s.income)}</b></div>
            <div class="row-between"><span class="t-sm t-muted">Out</span>
              <b class="t-num" style="color:var(--bad)">${Derive.money(s.expenses)}</b></div>
            <div class="row-between"><span class="t-sm t-muted">Net</span>
              <b class="t-num" style="color:${s.net >= 0 ? 'var(--good)' : 'var(--bad)'}">${Derive.money(s.net)}</b></div>
          </div>
          <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            ${s.total} transaction${s.total === 1 ? '' : 's'} across ${s.months} month${s.months === 1 ? '' : 's'}${
              s.firstDay ? `, from ${esc(Derive.shortDay(s.firstDay))}` : ''}.
          </p>
        </section>`;
    },

    _currencyCard() {
      const cur = (State.finance || {}).currency || 'INR';
      return `
        <section class="card">
          <div class="card-head">
            <div>
              <div class="card-title">Currency</div>
              <div class="card-sub">a display preference, not a record</div>
            </div>
          </div>
          <select class="select" id="fin-currency" aria-label="Currency">
            ${CURRENCIES.map(c => `<option value="${c.code}" ${c.code === cur ? 'selected' : ''}>
              ${c.code} · ${c.symbol}</option>`).join('')}
          </select>
          <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            Changing this reformats every figure. No transaction is altered.
          </p>
        </section>`;
    },

    /* --- partial repaints ------------------------------------------------- */
    renderTop() {
      const mount = $('#page-mount');
      if (!mount || Router.current !== 'finance') return;
      this._ensureMonth();
      const j = Derive.financeList();
      const m = Derive.financeMonth(this.year, this.month);
      const sub = $('#fin-sub', mount);
      if (sub) sub.textContent = this._summaryLine(j, m);
      const tiles = $('#fin-tiles', mount);
      if (tiles) tiles.innerHTML = this._tilesHtml(m, this._prevMonth());
      Shell.setHeader('Finance', `${Derive.money(m.expenses)} out · ${Derive.money(m.income)} in this month`);
    },

    renderList() {
      const main = $('#fin-list .fin-main');
      if (!main || Router.current !== 'finance') return;
      this._ensureMonth();
      main.innerHTML = this._mainHtml();
      const side = $('#fin-side');
      if (side) side.innerHTML = this._asideHtml(Derive.financeList(), Derive.financeMonth(this.year, this.month));
      this._bindList();
    },

    /* --- wiring ----------------------------------------------------------- */
    bind() {
      const mount = $('#page-mount');
      if (!mount) return;
      const nu = $('#fin-new', mount);
      if (nu) nu.addEventListener('click', () => this.openNew('expense'));
      this._bindList();
    },

    _bindList() {
      const host = $('#fin-list');
      if (!host) return;
      const bind = (sel, fn) => $$(sel, host).forEach(b => {
        if (b.dataset.finBound) return;
        b.dataset.finBound = '1';
        b.addEventListener('click', () => fn(b));
      });

      bind('[data-fin-view]', b => { this.view = b.dataset.finView; this.renderList(); });
      bind('[data-fin-nav]', b => {
        const v = b.dataset.finNav;
        if (v === 'today') {
          const n = new Date();
          this.year = n.getFullYear();
          this.month = n.getMonth();
        } else {
          let m = this.month + Number(v);
          let y = this.year;
          while (m < 0) { m += 12; y--; }
          while (m > 11) { m -= 12; y++; }
          this.month = m;
          this.year = y;
        }
        this.renderTop();
        this.renderList();
      });
      bind('[data-fin-type-filter]', b => {
        this.typeFilter = b.dataset.finTypeFilter;
        this.limit = 60;
        this.renderList();
      });
      bind('[data-fin-cat]', b => {
        this.catFilter = b.dataset.finCat;
        this.limit = 60;
        this.renderList();
      });
      bind('[data-fin-reset]', () => {
        this.typeFilter = 'all';
        this.catFilter = 'all';
        this.q = '';
        this.renderList();
      });
      bind('[data-fin-more]', () => { this.limit += 60; this._repaintRows(); });
      bind('[data-fin-edit]', b => this.openEdit(b.dataset.finEdit));
      bind('[data-fin-del]', b => this.confirmDelete(b.dataset.finDel));
      bind('[data-fin-focus]', b => this.openEdit(b.dataset.finFocus));
      bind('[data-fin-setbudget]', b => this.openBudget(b.dataset.finSetbudget));

      const search = $('#fin-search', host);
      if (search && !search.dataset.finBound) {
        search.dataset.finBound = '1';
        let timer = null;
        search.addEventListener('input', () => {
          this.q = search.value;
          clearTimeout(timer);
          // Debounced, and repaints only the rows — the input keeps focus.
          timer = setTimeout(() => this._repaintRows(), 140);
        });
      }

      const cur = $('#fin-currency', host);
      if (cur && !cur.dataset.finBound) {
        cur.dataset.finBound = '1';
        cur.addEventListener('change', () => {
          const code = State.setCurrency(cur.value);
          if (!code) return;
          Toast.show(`Showing figures in ${code}`, 'default');
          // The currency touches every figure on the page, not just this view.
          this.renderTop();
          this.renderList();
        });
      }
    },

    _repaintRows() {
      const rows = $('#fin-rows');
      if (!rows) return;
      rows.innerHTML = this._rowsHtml();
      const host = $('#fin-list');
      if (host) {
        const bind = (sel, fn) => $$(sel, rows).forEach(b => {
          if (b.dataset.finBound) return;
          b.dataset.finBound = '1';
          b.addEventListener('click', () => fn(b));
        });
        bind('[data-fin-edit]', b => this.openEdit(b.dataset.finEdit));
        bind('[data-fin-del]', b => this.confirmDelete(b.dataset.finDel));
        bind('[data-fin-more]', () => { this.limit += 60; this._repaintRows(); });
        bind('[data-fin-reset]', () => {
          this.typeFilter = 'all'; this.catFilter = 'all'; this.q = ''; this.renderList();
        });
      }
    },

    /* --- actions ---------------------------------------------------------- */
    openNew(type = 'expense') { this._form(null, type); },
    openEdit(id) {
      const t = State.transactionById(id);
      if (t) this._form(t);
    },

    _form(tx, initialType) {
      const editing = !!tx;
      let type = tx ? tx.type : (initialType === 'income' ? 'income' : 'expense');
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">${editing ? 'Edit transaction' : 'New transaction'}</div>
            <h2 class="t-h2" style="margin-top:6px">${editing ? 'Update this entry' : 'Record a transaction'}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <span class="field-label">Type</span>
          <div class="viewtabs" id="fin-type" role="group" aria-label="Transaction type">
            <button type="button" class="viewtab" data-fin-pick="expense">${icon('wallet', 13)} Expense</button>
            <button type="button" class="viewtab" data-fin-pick="income">${icon('plus', 13)} Income</button>
          </div>
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="fin-amount">Amount</label>
          <input class="field" id="fin-amount" type="number" min="0.01" step="0.01" inputmode="decimal"
            placeholder="0.00" value="${editing ? tx.amount : ''}">
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="fin-label">What was it?</label>
          <input class="field" id="fin-label" placeholder="Rent, Groceries, Salary…"
            value="${editing ? esc(tx.label) : ''}">
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="fin-cat">Category</label>
          <select class="select" id="fin-cat">${this._catOptions(type, editing ? tx.category : '')}</select>
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="fin-day">Date</label>
          <input class="field" id="fin-day" type="date" value="${editing ? tx.day : todayKey()}">
        </div>
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="fin-note">Note (optional)</label>
          <input class="field" id="fin-note" placeholder="Anything worth remembering"
            value="${editing ? esc(tx.note) : ''}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="fin-save">${icon('check', 14)} ${editing ? 'Save' : 'Add'}</button>
        </div>`, { cls: 'modal-md' });

      /* Categories belong to one side of the ledger, so flipping the type has to
         re-offer the list — an expense can never be filed as "Salary". */
      const syncType = () => {
        $$('[data-fin-pick]', wrap).forEach(b => {
          const on = b.dataset.finPick === type;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', String(on));
        });
        const sel = $('#fin-cat', wrap);
        if (sel) sel.innerHTML = this._catOptions(type, sel.value);
      };
      $$('[data-fin-pick]', wrap).forEach(b => b.addEventListener('click', () => {
        type = b.dataset.finPick;
        syncType();
      }));
      syncType();

      $('#fin-save', wrap).addEventListener('click', () => {
        const amount = Number($('#fin-amount', wrap).value);
        const label = $('#fin-label', wrap).value.trim();
        if (!label) { Toast.show('Give it a name, so future-you knows what it was', 'warn'); return; }
        if (!(amount > 0)) { Toast.show('An amount above zero, please', 'warn'); return; }
        const patch = {
          label, amount, type,
          category: $('#fin-cat', wrap).value,
          day: $('#fin-day', wrap).value || todayKey(),
          note: $('#fin-note', wrap).value,
        };
        const rec = editing ? State.updateTransaction(tx.id, patch) : State.addTransaction(patch);
        if (!rec) { Toast.show('Could not save that transaction', 'warn'); return; }
        Overlay.close();
        Toast.show(editing ? 'Transaction updated'
          : `${type === 'income' ? 'Income' : 'Expense'} recorded`, 'good');
        this.renderTop();
        this.renderList();
      });
    },

    _catOptions(type, selected) {
      return FINANCE_CATEGORIES.filter(c => c.type === type)
        .map(c => `<option value="${esc(c.name)}"${c.name === selected ? ' selected' : ''}>${esc(c.name)}</option>`)
        .join('');
    },

    confirmDelete(id) {
      const t = State.transactionById(id);
      if (!t) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete transaction</div>
            <h2 class="t-h2" style="margin-top:6px">Remove this entry?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          ${esc(t.label)} · ${esc(Derive.shortDay(t.day))} —
          <b style="color:${t.type === 'income' ? 'var(--good)' : 'var(--text-1)'}">${Derive.money(t.amount)}</b>.
          Every total, breakdown and rate recomputes without it.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="fin-del-yes">${icon('trash', 14)} Delete</button>
        </div>`, { cls: 'modal-sm' });

      $('#fin-del-yes', wrap).addEventListener('click', () => {
        State.deleteTransaction(id);
        Overlay.close();
        Toast.show('Transaction deleted', 'default');
        this.renderTop();
        this.renderList();
      });
    },
  };

  /* ======================================================================
     FILES — Milestone 28
     Local file references. A file is a name, an optional label, a set of
     pointers at workspace records, and the bytes themselves — held as a Blob
     on the record, in the same IndexedDB workspace as everything else.

     Nothing is uploaded anywhere. The File API reads a local file and the Blob
     is stored on the device; size, mime type, kind, extension and every count,
     total and percentage below are derived from those records at render time.
     ====================================================================== */
  const FilesPage = {
    view: 'all',        // 'all' | 'recent' | 'linked' | 'unlinked'
    q: '',
    kind: 'all',
    _url: null,         // the single live object URL (the open preview)
    _root: null,
    /* "Recent" is a real window, not a synonym for "all". */
    RECENT_HOURS: 48,

    /* An object URL pins its Blob for the life of the document, so exactly one
       is ever live — the open preview's. Release it before minting the next. */
    _releaseUrl() {
      if (this._url) { try { URL.revokeObjectURL(this._url); } catch (_) {} this._url = null; }
    },
    _objectUrl(f) {
      this._releaseUrl();
      try { this._url = (f && f.blob) ? URL.createObjectURL(f.blob) : null; }
      catch (_) { this._url = null; }
      return this._url || '';
    },

    /* --- filtering — every step derived, nothing cached ------------------ */
    _searchBase() { return Derive.fileSearch(this.q, Derive.filesList().files); },
    _viewFiltered() {
      const base = this._searchBase();
      if (this.view === 'recent') {
        const cutoff = Date.now() - this.RECENT_HOURS * 3600000;
        return base.filter(f => new Date(f.createdAt).getTime() >= cutoff);
      }
      if (this.view === 'linked')   return base.filter(f => (f.refs || []).length > 0);
      if (this.view === 'unlinked') return base.filter(f => (f.refs || []).length === 0);
      return base;
    },
    _filtered() {
      const list = this._viewFiltered();
      return this.kind === 'all' ? list : list.filter(f => Derive.fileMeta(f).kind === this.kind);
    },
    /* The kind chips count what the current view and search actually contain,
       so a chip never promises rows that are not there. */
    _chipKinds() {
      const base = this._viewFiltered();
      return FILE_KIND_META
        .map(k => ({ kind: k.kind, label: k.label, icon: k.icon, color: k.color,
                     count: base.filter(f => Derive.fileMeta(f).kind === k.kind).length }))
        .filter(k => k.count > 0);
    },

    /* --- render ----------------------------------------------------------- */
    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'files') return;
      this._releaseUrl();
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Opening the drawer…</p></div></div></div>';
        return;
      }
      const j = Derive.filesList();
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Files</div>
            <h1>Files</h1>
            <div class="sub" id="fl-sub">${esc(this._summaryLine(j))}</div>
          </div>
          <div class="row gap-2">
            <input type="file" id="fl-input" multiple hidden>
            <button class="btn btn-primary btn-sm" id="fl-add">${icon('upload', 13)} Add files</button>
          </div>
        </div>

        <div class="proj-stats" id="fl-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(j)}</div>

        <div class="fin-layout" style="margin-top:var(--sp-4)">
          <div class="fin-main">
            <div class="fl-tools">
              <div class="viewtabs" id="fl-tabs" role="tablist" aria-label="Files view">${this._tabsHtml()}</div>
            </div>
            <div class="fl-filters" id="fl-kinds">${this._kindsHtml()}</div>
            <div class="fl-searchrow">
              <span class="fl-searchic">${icon('search', 14)}</span>
              <input type="search" id="fl-search" class="fl-search" value="${esc(this.q)}"
                     placeholder="Search files, labels and attachments…" aria-label="Search files">
            </div>
            <div class="fl-drop" id="fl-drop">
              ${icon('upload', 18)}
              <span>Drop files here, or</span>
              <button type="button" class="btn btn-ghost btn-sm" data-fl-browse>browse</button>
            </div>
            <div id="fl-list">${this._listHtml()}</div>
          </div>
          <div class="fin-side" id="fl-side">${this._asideHtml(j)}</div>
        </div>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      this._syncHeader(j);
    },

    _syncHeader(j) {
      Shell.setHeader('Files', j.stats.total
        ? `${j.stats.sizeLabel} across ${j.stats.total} file${j.stats.total === 1 ? '' : 's'}`
        : 'Local file references');
    },

    _summaryLine(j) {
      const s = j.stats;
      if (!s.total) {
        return 'Files stay on this device. Add one and it is stored beside everything else — no upload, no account.';
      }
      const bits = [`${s.total} file${s.total === 1 ? '' : 's'}`, s.sizeLabel];
      if (s.kindsUsed) bits.push(`${s.kindsUsed} kind${s.kindsUsed === 1 ? '' : 's'}`);
      if (s.linked) bits.push(`${s.linked} attached`);
      return bits.join(' · ');
    },

    _tilesHtml(j) {
      const s = j.stats;
      return `
        ${Widgets.statTile({ icon: 'folder', label: 'Files', value: s.total,
          meta: s.total ? `${s.avgLabel} typical` : 'nothing stored yet', accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'archive', label: 'Stored', value: s.sizeLabel,
          meta: s.total ? `largest ${s.biggestLabel}` : 'no bytes yet', accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'layers', label: 'Attached', value: s.linked,
          meta: s.total ? `${s.unlinked} not attached` : 'nothing to attach', accent: 'var(--good)' })}
        ${Widgets.statTile({ icon: 'tag', label: 'Links', value: s.refCount,
          meta: s.broken ? `${s.broken} broken` : 'all resolve',
          accent: s.broken ? 'var(--bad)' : 'var(--violet)' })}`;
    },

    _tabsHtml() {
      const tabs = [['all', 'All'], ['recent', 'Recent'], ['linked', 'Attached'], ['unlinked', 'Unattached']];
      return tabs.map(([k, label]) =>
        `<button class="viewtab ${this.view === k ? 'is-active' : ''}" data-fl-view="${k}"
           role="tab" aria-selected="${this.view === k}">${label}</button>`).join('');
    },

    _kindsHtml() {
      const total = this._viewFiltered().length;
      const chips = this._chipKinds();
      return `<button type="button" class="chip ${this.kind === 'all' ? 'is-on' : ''}"
          data-fl-kind="all" aria-pressed="${this.kind === 'all'}">All kinds <b>${total}</b></button>`
        + chips.map(k =>
          `<button type="button" class="chip ${this.kind === k.kind ? 'is-on' : ''}"
             data-fl-kind="${k.kind}" aria-pressed="${this.kind === k.kind}">
             <span style="color:${k.color};display:inline-flex">${icon(k.icon, 12)}</span>${k.label} <b>${k.count}</b></button>`).join('');
    },

    _listHtml() {
      const list = this._filtered();
      if (!list.length) return this._emptyHtml();
      return `<div class="fl-rows">${list.map(f => this._rowHtml(f)).join('')}</div>`;
    },

    _emptyHtml() {
      const total = Derive.filesList().stats.total;
      if (!total) {
        return `<div class="card" style="margin-top:var(--sp-3)"><div class="empty">
          <div class="empty-ic">${icon('folder', 22)}</div>
          <h4>No files yet</h4>
          <p>Drop a file above, or use <b>Add files</b>. It is stored on this device with
             the rest of your workspace — nothing is uploaded anywhere.</p>
          <button class="btn btn-primary btn-sm" data-fl-browse style="margin-top:var(--sp-3)">
            ${icon('upload', 13)} Add your first file</button>
        </div></div>`;
      }
      const why = this.q ? `No file matches “${esc(this.q)}”` : 'No file is in this view';
      return `<div class="card" style="margin-top:var(--sp-3)"><div class="empty">
        <div class="empty-ic">${icon('search', 22)}</div>
        <h4>Nothing matches</h4>
        <p>${why}${this.kind !== 'all' ? ' with that kind' : ''}. ${total} file${total === 1 ? '' : 's'} in total.</p>
        <button class="btn btn-ghost btn-sm" data-fl-clear style="margin-top:var(--sp-3)">Clear filters</button>
      </div></div>`;
    },

    _rowHtml(f) {
      const m = Derive.fileMeta(f);
      const k = fileKindMeta(m.kind);
      const refs = Derive.fileRefs(f);
      const chips = refs.slice(0, 3).map(r =>
        `<span class="fl-chip ${r.missing ? 'is-missing' : ''}" title="${esc(r.label)}">
           ${icon(r.missing ? 'x' : r.icon, 11)}${esc(r.label)}</span>`).join('');
      const more = refs.length > 3 ? `<span class="fl-chip fl-more">+${refs.length - 3} more</span>` : '';
      return `
        <div class="fl-row" data-fl-open="${esc(f.id)}" tabindex="0" role="button"
             aria-label="Open ${esc(f.name)}">
          <span class="fl-ic" style="color:${k.color}">${icon(k.icon, 18)}</span>
          <div class="fl-body">
            <div class="fl-name">${esc(f.name)}<span class="fl-kind" style="--c:${k.color}">${k.label}</span></div>
            <div class="fl-meta">${m.sizeLabel} · added ${esc(Derive.relTime(f.createdAt))}${f.label ? ' · ' + esc(f.label) : ''}</div>
            <div class="fl-refs">${refs.length ? chips + more : '<span class="fl-chip fl-none">Not attached</span>'}</div>
          </div>
          <div class="fl-acts">
            <button class="iconbtn" data-fl-rename="${esc(f.id)}" aria-label="Rename ${esc(f.name)}">${icon('edit', 14)}</button>
            <button class="iconbtn fl-danger" data-fl-del="${esc(f.id)}" aria-label="Delete ${esc(f.name)}">${icon('trash', 14)}</button>
          </div>
        </div>`;
    },

    _kindRowHtml(k) {
      return `
        <div class="fl-kindrow">
          <span class="fl-kindic" style="color:${k.color}">${icon(k.icon, 13)}</span>
          <span class="fl-kindname">${k.label}</span>
          <span class="fl-kindn">${k.count}</span>
          <span class="fl-kindsz">${k.sizeLabel}</span>
        </div>
        <div class="fl-kindbar"><div class="fl-kindfill" style="width:${(k.pct * 100).toFixed(1)}%;background:${k.color}"></div></div>`;
    },

    _fact(key, value, color) {
      return `<div class="fl-fact"><span class="fl-factk">${key}</span>
        <span class="fl-factv" style="color:${color}">${value}</span></div>`;
    },

    _miniRow(f, count) {
      const m = Derive.fileMeta(f);
      const k = fileKindMeta(m.kind);
      return `<button type="button" class="fl-minirow" data-fl-open="${esc(f.id)}">
        <span class="fl-miniic" style="color:${k.color}">${icon(k.icon, 13)}</span>
        <span class="fl-mininame">${esc(f.name)}</span>
        <span class="fl-minisz">${count != null ? count + ' link' + (count === 1 ? '' : 's') : m.sizeLabel}</span>
      </button>`;
    },

    _asideHtml(j) {
      const s = j.stats;
      if (!s.total) {
        return `<div class="card">
          <div class="card-head"><div class="card-title">How this works</div></div>
          <p class="t-faint t-sm" style="margin:0">Every file is read from your device and stored
            locally — it never leaves it. Attach one to a task, project, note or journal entry and
            both sides stay in step, because the link is derived rather than copied.</p>
        </div>`;
      }
      const recent = j.files.slice(0, 4);
      const top = j.files
        .map(f => ({ f, n: Derive.fileRefs(f).filter(r => !r.missing).length }))
        .filter(r => r.n > 0)
        .sort((a, b) => b.n - a.n || String(a.f.name).localeCompare(String(b.f.name)))
        .slice(0, 3);
      return `
        <div class="card">
          <div class="card-head"><div>
            <div class="card-title">Storage</div>
            <div class="card-sub">${s.total} file${s.total === 1 ? '' : 's'} · ${s.sizeLabel}</div>
          </div></div>
          <div class="fl-kinds">${s.kinds.map(k => this._kindRowHtml(k)).join('')}</div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">Connections</div></div>
          <div class="fl-facts">
            ${this._fact('Attached', s.linked, 'var(--good)')}
            ${this._fact('Unattached', s.unlinked, 'var(--text-2)')}
            ${this._fact('Links', s.refCount, 'var(--accent)')}
            ${this._fact('Broken', s.broken, s.broken ? 'var(--bad)' : 'var(--text-3)')}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title">Recently added</div></div>
          <div class="fl-mini">${recent.map(f => this._miniRow(f)).join('')}</div>
        </div>

        ${top.length ? `<div class="card">
          <div class="card-head"><div class="card-title">Most attached</div></div>
          <div class="fl-mini">${top.map(r => this._miniRow(r.f, r.n)).join('')}</div>
        </div>` : ''}`;
    },

    /* --- partial repaints -------------------------------------------------
       The search box is a live input, so it lives OUTSIDE every repainted
       region: typing repaints the chips and the list, never the field the
       caret is in. */
    renderTop() {
      const root = this._root;
      if (!root) return;
      const j = Derive.filesList();
      const tiles = $('#fl-tiles', root);
      const sub = $('#fl-sub', root);
      if (tiles) tiles.innerHTML = this._tilesHtml(j);
      if (sub) sub.textContent = this._summaryLine(j);
      this._syncHeader(j);
    },
    renderTools() {
      const root = this._root;
      if (!root) return;
      const tabs = $('#fl-tabs', root);
      const kinds = $('#fl-kinds', root);
      if (tabs) tabs.innerHTML = this._tabsHtml();
      if (kinds) kinds.innerHTML = this._kindsHtml();
    },
    renderList() {
      const root = this._root;
      if (!root) return;
      const list = $('#fl-list', root);
      if (list) list.innerHTML = this._listHtml();
    },
    renderSide() {
      const root = this._root;
      if (!root) return;
      const side = $('#fl-side', root);
      if (side) side.innerHTML = this._asideHtml(Derive.filesList());
    },
    /* Everything the page shows, after a change that could move any of it. */
    repaintAll() {
      this.renderTop(); this.renderTools(); this.renderList(); this.renderSide();
    },

    /* --- ingestion -------------------------------------------------------- */
    _ingest(files) {
      let added = 0;
      files.forEach(file => { if (State.addFile({ name: file.name, blob: file })) added++; });
      if (!added) { Toast.show('Nothing could be added from that selection.', 'warn'); return; }
      Toast.show(added === 1 ? `Added “${files[0].name}”` : `Added ${added} files`, 'good');
      /* The user just asked for these files to exist, so show them: drop any
         filter that would hide the thing they just created. */
      this.view = 'all'; this.kind = 'all'; this.q = '';
      const search = $('#fl-search', this._root);
      if (search) search.value = '';
      this.repaintAll();
    },

    /* --- binding ---------------------------------------------------------- */
    /* Attach freshly-picked files to a record in one step: store the bytes, then
       point the new file at the record. Shared by the Files page and by any
       other surface that offers an "attach" affordance, so there is exactly one
       path that creates a file. Returns how many were attached. */
    attachTo(type, id, files) {
      if (FILE_REF_TYPES.indexOf(type) === -1 || !id) return 0;
      let added = 0;
      Array.from(files || []).forEach(file => {
        const rec = State.addFile({ name: file.name, blob: file });
        if (rec && State.addFileRef(rec.id, type, id)) added++;
      });
      return added;
    },

    bind(root) {
      const input = $('#fl-input', root);
      const add = $('#fl-add', root);
      if (add && input) add.addEventListener('click', () => input.click());
      if (input) input.addEventListener('change', () => {
        const picked = Array.from(input.files || []);
        input.value = '';
        if (picked.length) this._ingest(picked);
      });

      const search = $('#fl-search', root);
      if (search) search.addEventListener('input', () => {
        this.q = search.value;
        /* A kind chip that no longer has rows must not stay selected, or the
           list would read as empty while the chip says it is on. */
        const kinds = this._chipKinds().map(k => k.kind);
        if (this.kind !== 'all' && kinds.indexOf(this.kind) === -1) this.kind = 'all';
        this.renderTools();
        this.renderList();
      });

      const zone = $('#fl-drop', root);
      if (zone) {
        const over = e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('is-over'); };
        const out = e => {
          e.preventDefault(); e.stopPropagation();
          if (e.type === 'dragleave' && zone.contains(e.relatedTarget)) return;
          zone.classList.remove('is-over');
        };
        ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, over));
        ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, out));
        zone.addEventListener('drop', e => {
          const dropped = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
          if (dropped.length) this._ingest(dropped);
        });
      }

      root.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);
        const browse = hit('[data-fl-browse]');
        if (browse) { const i = $('#fl-input', root); if (i) i.click(); return; }
        if (hit('[data-fl-clear]')) { this.view = 'all'; this.kind = 'all'; this.q = ''; this.render(); return; }
        const view = hit('[data-fl-view]');
        if (view) { this.view = view.dataset.flView; this.renderTools(); this.renderList(); return; }
        const kind = hit('[data-fl-kind]');
        if (kind) { this.kind = kind.dataset.flKind; this.renderTools(); this.renderList(); return; }
        const ren = hit('[data-fl-rename]');
        if (ren) { e.stopPropagation(); this.openRename(ren.dataset.flRename); return; }
        const del = hit('[data-fl-del]');
        if (del) { e.stopPropagation(); this.confirmDelete(del.dataset.flDel); return; }
        const row = hit('[data-fl-open]');
        if (row) this.openPreview(row.dataset.flOpen);
      });
      root.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target && e.target.closest ? e.target.closest('[data-fl-open]') : null;
        if (row) { e.preventDefault(); this.openPreview(row.dataset.flOpen); }
      });
    },

    /* --- preview panel ---------------------------------------------------- */
    openPreview(id) {
      const f = State.fileById(id);
      if (!f) { Toast.show('That file is no longer here.', 'warn'); return; }
      const m = Derive.fileMeta(f);
      const k = fileKindMeta(m.kind);
      const refs = Derive.fileRefs(f);
      const url = this._objectUrl(f);
      const textish = m.kind === 'text' || m.kind === 'sheet' || m.kind === 'doc';

      const prev = m.kind === 'image'
        ? `<img class="fl-prev-img" src="${esc(url)}" alt="${esc(f.name)}">`
        : m.kind === 'pdf'
          ? `<iframe class="fl-prev-frame" src="${esc(url)}" title="${esc(f.name)}"></iframe>`
          : textish
            ? `<pre class="fl-prev-text" id="fl-prev-text">Reading…</pre>`
            : `<div class="fl-prev-none">${icon('file', 24)}
                 <p>No inline preview for a ${esc(k.label.toLowerCase())} file.
                    Download it to open it in its own app.</p></div>`;

      const panel = Overlay.panel(`
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">${k.label} file</div>
            <h2 class="panel-title">${esc(f.name)}</h2>
            <div class="t-faint t-sm">${m.sizeLabel} · added ${esc(Derive.relTime(f.createdAt))}${m.type ? ' · ' + esc(m.type) : ''}</div>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          <div class="fl-prev">${prev}</div>

          <div class="p-sec">
            <div class="fl-sectitle">Details</div>
            <div class="fl-kv">
              ${this._kv('Size', m.sizeLabel)}
              ${this._kv('Kind', k.label)}
              ${this._kv('Type', m.type || '—')}
              ${this._kv('Extension', m.ext ? '.' + m.ext : '—')}
              ${this._kv('Added', esc(Derive.longDay(dayKey(new Date(f.createdAt)))))}
            </div>
            ${f.label ? `<p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">${esc(f.label)}</p>` : ''}
          </div>

          <div class="p-sec">
            <div class="fl-sectitle">Attached to <span class="fl-count">${refs.length}</span></div>
            ${refs.length
              ? `<div class="fl-attach">${refs.map(r => this._attachHtml(r)).join('')}</div>`
              : `<p class="t-faint t-sm" style="margin:0">Not attached to anything yet. Link it to a
                   task, project, note or journal entry and both sides stay in step.</p>`}
            <button class="btn btn-ghost btn-sm" data-fl-plink style="margin-top:var(--sp-3)">
              ${icon('plus', 12)} Link to a record</button>
          </div>
        </div>

        <div class="panel-foot">
          <a class="btn btn-primary btn-sm" href="${esc(url)}" download="${esc(f.name)}">${icon('download', 13)} Download</a>
          <button class="btn btn-ghost btn-sm" data-fl-prename>${icon('edit', 13)} Rename</button>
          <button class="btn btn-ghost btn-sm act-danger" data-fl-pdel>${icon('trash', 13)} Delete</button>
        </div>`);
      this._bindPreview(panel, f, textish);
    },

    _kv(key, value) {
      return `<div class="fl-kvrow"><span class="fl-kvkey">${esc(key)}</span><span class="fl-kvval">${value}</span></div>`;
    },

    _attachHtml(r) {
      return `
        <div class="fl-att ${r.missing ? 'is-missing' : ''}">
          <span class="fl-attic" style="color:${r.missing ? 'var(--bad)' : 'var(--accent-2)'}">${icon(r.missing ? 'x' : r.icon, 13)}</span>
          <div class="fl-attbody">
            <div class="fl-attname">${esc(r.label)}</div>
            <div class="fl-attsub">${r.missing ? 'This record no longer exists' : esc(r.sub || r.type)}</div>
          </div>
          ${r.missing ? '' : `<button class="iconbtn" data-fl-goto="${esc(r.type)}" data-fl-goto-id="${esc(r.id)}"
             aria-label="Open ${esc(r.label)}">${icon('arrowR', 13)}</button>`}
          <button class="iconbtn" data-fl-unlink="${esc(r.id)}" data-fl-unlink-type="${esc(r.type)}"
            aria-label="Detach ${esc(r.label)}">${icon('x', 13)}</button>
        </div>`;
    },

    _bindPreview(panel, f, textish) {
      if (!panel) return;
      const on = (sel, fn) => { const n = $(sel, panel); if (n) n.addEventListener('click', fn); };
      on('[data-fl-prename]', () => this.openRename(f.id));
      on('[data-fl-plink]', () => this.openLink(f.id));
      on('[data-fl-pdel]', () => { Overlay.close(); this.confirmDelete(f.id); });
      panel.querySelectorAll('[data-fl-unlink]').forEach(b => b.addEventListener('click', () => {
        State.removeFileRef(f.id, b.dataset.flUnlinkType, b.dataset.flUnlink);
        Toast.show('Detached', 'default');
        this.openPreview(f.id);
        this.repaintAll();
      }));
      panel.querySelectorAll('[data-fl-goto]').forEach(b => b.addEventListener('click', () => {
        this._gotoRef(b.dataset.flGoto, b.dataset.flGotoId);
      }));
      if (textish && f.blob && typeof f.blob.text === 'function') {
        const pre = $('#fl-prev-text', panel);
        f.blob.text()
          .then(t => { if (pre && pre.isConnected) pre.textContent = t; })
          .catch(() => { if (pre && pre.isConnected) pre.textContent = 'This file could not be read as text.'; });
      }
    },

    /* Follow a pointer to the record it names. One shared implementation, so
       "open this record" means the same thing here, in search results, and
       anywhere else that follows a pointer. */
    _gotoRef(type, id) { revealRecord(type, id); },

    /* --- rename ----------------------------------------------------------- */
    openRename(id) {
      const f = State.fileById(id);
      if (!f) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Rename</div>
            <h2 class="t-h2" style="margin-top:6px">${esc(f.name)}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <label class="field"><span>Name</span>
          <input type="text" id="fl-rn-name" value="${esc(f.name)}" maxlength="200"></label>
        <label class="field"><span>Label</span>
          <input type="text" id="fl-rn-label" value="${esc(f.label)}" maxlength="160"
                 placeholder="What this file is for (optional)"></label>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="fl-rn-save">${icon('check', 14)} Save</button>
        </div>`, { cls: 'modal-sm' });

      const nameEl = $('#fl-rn-name', wrap);
      const labelEl = $('#fl-rn-label', wrap);
      const save = () => {
        const name = nameEl.value.trim();
        if (!name) { Toast.show('A file needs a name.', 'warn'); nameEl.focus(); return; }
        State.updateFile(id, { name, label: labelEl.value });
        Overlay.close();
        Toast.show('File updated', 'good');
        this.repaintAll();
      };
      $('#fl-rn-save', wrap).addEventListener('click', save);
      nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
      setTimeout(() => { nameEl.focus(); nameEl.select(); }, 40);
    },

    /* --- delete ----------------------------------------------------------- */
    confirmDelete(id) {
      const f = State.fileById(id);
      if (!f) return;
      const m = Derive.fileMeta(f);
      const refs = Derive.fileRefs(f);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete file</div>
            <h2 class="t-h2" style="margin-top:6px">Remove “${esc(f.name)}”?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          ${m.sizeLabel} · ${esc(fileKindMeta(m.kind).label)}. The file leaves this device.
          ${refs.length
            ? `Its ${refs.length} link${refs.length === 1 ? '' : 's'} go with it — the
               ${refs.length === 1 ? 'record' : 'records'} ${refs.length === 1 ? 'it points at is' : 'they point at are'} left untouched.`
            : 'Nothing else in the workspace references it.'}
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="fl-del-yes">${icon('trash', 14)} Delete file</button>
        </div>`, { cls: 'modal-sm' });

      $('#fl-del-yes', wrap).addEventListener('click', () => {
        State.deleteFile(id);
        Overlay.close();
        Toast.show('File deleted', 'default');
        this.repaintAll();
      });
    },

    /* --- link ------------------------------------------------------------- */
    openLink(id) {
      const f = State.fileById(id);
      if (!f) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Link file</div>
            <h2 class="t-h2" style="margin-top:6px">Attach “${esc(f.name)}”</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <label class="field"><span>Attach to</span>
          <select class="select" id="fl-lk-type">
            ${FILE_REF_META.map(m => `<option value="${m.type}">${m.label}</option>`).join('')}
          </select></label>
        <label class="field"><span>Record</span>
          <select class="select" id="fl-lk-rec"></select></label>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="fl-lk-save">${icon('plus', 14)} Attach</button>
        </div>`, { cls: 'modal-sm' });

      const typeEl = $('#fl-lk-type', wrap);
      const recEl = $('#fl-lk-rec', wrap);
      const fill = () => {
        const rows = this._linkCandidates(f, typeEl.value);
        recEl.innerHTML = rows.length
          ? rows.map(r => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('')
          : '<option value="">— nothing left to attach to —</option>';
        recEl.disabled = !rows.length;
      };
      typeEl.addEventListener('change', fill);
      fill();
      $('#fl-lk-save', wrap).addEventListener('click', () => {
        const rid = recEl.value;
        if (!rid) { Toast.show('Nothing to attach to.', 'warn'); return; }
        State.addFileRef(f.id, typeEl.value, rid);
        Overlay.close();
        Toast.show('Linked', 'good');
        this.openPreview(f.id);
        this.repaintAll();
      });
    },
    /* The records of one type this file is not already pointing at. */
    _linkCandidates(f, type) {
      const has = rid => (f.refs || []).some(r => r.type === type && r.id === rid);
      const rows = [];
      if (type === 'task')    State.tasks.forEach(t => rows.push({ id: t.id, label: t.title }));
      if (type === 'project') State.projects.forEach(p => rows.push({ id: p.id, label: p.name }));
      if (type === 'note')    State.notes.forEach(n => rows.push({ id: n.id, label: n.title }));
      if (type === 'journal') State.journal.forEach(e => rows.push({ id: e.id, label: e.title || e.day }));
      return rows.filter(r => r.id && !has(r.id));
    },
  };

  /* ======================================================================
     SEARCH — Milestone 29
     One query across every collection the workspace holds. The index, the
     ranking, the grouping, the per-kind counts and the "what is searchable"
     figures are all derived from State on every keystroke — nothing is cached,
     so the results can never describe a workspace that no longer exists, and a
     record you just changed is already searchable.
     ====================================================================== */
  const SearchPage = {
    q: '',
    scope: 'all',     // 'all' | a SEARCH_SOURCES key
    limit: 5,         // per-group cap until "show all"
    _root: null,

    render(opts) {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'search') return;
      /* Arriving from the palette with a query — "search everything for X". */
      if (opts && typeof opts.q === 'string') { this.q = opts.q; this.scope = 'all'; this.limit = 5; }
      if (opts && typeof opts.scope === 'string') this.scope = opts.scope;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Indexing…</p></div></div></div>';
        return;
      }
      const r = Derive.searchAll(this.q, this.scope, this.limit);
      this._terms = r.terms;
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Search</div>
            <h1>Search</h1>
            <div class="sub" id="sc-sub">${esc(this._summaryLine(r))}</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-ghost btn-sm" id="sc-clear">${icon('reset', 13)} Start over</button>
          </div>
        </div>

        <div class="sc-bar">
          <span class="sc-baric">${icon('search', 17)}</span>
          <input type="search" id="sc-input" class="sc-input" value="${esc(this.q)}"
                 placeholder="Search tasks, projects, notes, journal, inbox, money, files…"
                 autocomplete="off" spellcheck="false" aria-label="Search everything">
          <kbd>Enter</kbd>
        </div>

        <div class="sc-scopes" id="sc-scopes">${this._scopesHtml(r)}</div>

        <div class="fin-layout" style="margin-top:var(--sp-4)">
          <div class="fin-main" id="sc-results">${this._resultsHtml(r)}</div>
          <div class="fin-side" id="sc-side">${this._asideHtml(r)}</div>
        </div>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      this._syncHeader(r);
      const input = $('#sc-input', page);
      if (input) setTimeout(() => input.focus(), 60);
    },

    _syncHeader(r) {
      const kinds = Object.keys(r.matches || {}).length;
      Shell.setHeader('Search', r.hasQuery
        ? `${r.total} match${r.total === 1 ? '' : 'es'} across ${kinds} kind${kinds === 1 ? '' : 's'}`
        : `Searching ${r.indexed} records`);
    },

    _summaryLine(r) {
      if (!r.hasQuery) {
        return `${r.indexed} records are searchable across ${r.sources.filter(s => s.indexed).length} kinds — tasks, projects, goals, notes, journal, inbox, finance, files, habits and the calendar.`;
      }
      if (!r.total) return `Nothing matches “${r.query}”.`;
      const kinds = Object.keys(r.matches).length;
      return `${r.total} match${r.total === 1 ? '' : 'es'} across ${kinds} kind${kinds === 1 ? '' : 's'} for “${r.query}”.`;
    },

    /* Wrap every matched term in a mark. Escaping happens per segment, so a term
       that happens to appear inside the markup we just inserted cannot corrupt it. */
    _hl(text, terms) {
      const s = String(text == null ? '' : text);
      if (!terms || !terms.length) return esc(s);
      const lower = s.toLowerCase();
      const ranges = [];
      let pos = 0;
      while (pos < s.length) {
        let best = -1, bestLen = 0;
        for (let i = 0; i < terms.length; i++) {
          const t = terms[i];
          if (!t) continue;
          const at = lower.indexOf(t, pos);
          if (at !== -1 && (best === -1 || at < best || (at === best && t.length > bestLen))) { best = at; bestLen = t.length; }
        }
        if (best === -1) break;
        ranges.push([best, best + bestLen]);
        pos = best + bestLen;
      }
      if (!ranges.length) return esc(s);
      let out = '', cursor = 0;
      ranges.forEach(([a, b]) => {
        out += esc(s.slice(cursor, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>';
        cursor = b;
      });
      return out + esc(s.slice(cursor));
    },

    _scopesHtml(r) {
      const total = r.hasQuery ? r.total : r.indexed;
      const all = `<button type="button" class="chip ${this.scope === 'all' ? 'is-on' : ''}"
        data-sc-scope="all" aria-pressed="${this.scope === 'all'}">Everything <b>${total}</b></button>`;
      const rest = r.sources
        .map(s => ({ ...s, n: r.hasQuery ? (r.matches[s.key] || 0) : s.indexed }))
        .filter(s => s.n > 0)
        .map(s => `<button type="button" class="chip ${this.scope === s.key ? 'is-on' : ''}"
          data-sc-scope="${s.key}" aria-pressed="${this.scope === s.key}">
          <span style="color:${s.color};display:inline-flex">${icon(s.icon, 12)}</span>${s.label} <b>${s.n}</b></button>`)
        .join('');
      return all + rest;
    },

    _resultsHtml(r) {
      if (r.hasQuery) {
        if (!r.groups.length) return this._noMatchHtml(r);
        return r.groups.map(g => this._groupHtml(g)).join('')
          + (r.truncated
            ? `<div class="sc-more"><button class="btn btn-ghost btn-sm" data-sc-more>${icon('list', 13)} Show all matches</button></div>`
            : '');
      }
      return this.scope === 'all' ? this._browseHtml(r) : this._browseListHtml();
    },

    _browseHtml(r) {
      return `<section class="card">
        <div class="card-head"><div>
          <div class="card-title">Search everything</div>
          <div class="card-sub">${r.indexed} records across ${r.sources.filter(s => s.indexed).length} kinds — type above, or open a kind.</div>
        </div></div>
        <div class="sc-browse">
          ${r.sources.map(s => `
            <button type="button" class="sc-src" data-sc-scope="${s.key}">
              <span class="sc-srcic" style="color:${s.color}">${icon(s.icon, 16)}</span>
              <span class="sc-srcname">${s.label}</span>
              <span class="sc-srcn">${s.indexed}</span>
            </button>`).join('')}
        </div>
        <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
          Every figure here is read from the workspace as you type — the index is never
          cached, so a record you just changed is already searchable.
        </p>
      </section>`;
    },

    _browseListHtml() {
      const b = Derive.searchBrowse(this.scope, 60);
      return `<section class="card sc-group">
        <div class="card-head">
          <div>
            <div class="card-title"><span class="sc-gic" style="color:${b.color}">${icon(b.icon, 14)}</span> ${b.label}</div>
            <div class="card-sub">${b.total} record${b.total === 1 ? '' : 's'}${b.total > b.rows.length ? ` · showing ${b.rows.length}` : ''}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-sc-go="${b.route}">Open ${b.label}</button>
        </div>
        <div class="sc-hits">${b.rows.map(h => `
          <button type="button" class="sc-hit" data-sc-open="${esc(h.key)}" data-sc-id="${esc(h.id)}"
                  aria-label="Open ${esc(h.label)}">
            <span class="sc-hitic" style="color:${b.color}">${icon(b.icon, 14)}</span>
            <span class="sc-hitbody"><span class="sc-hitname">${esc(h.label)}</span></span>
            <span class="sc-hitmeta">${esc(h.meta)}</span>
          </button>`).join('')}</div>
      </section>`;
    },

    _groupHtml(g) {
      return `
        <section class="card sc-group">
          <div class="card-head">
            <div>
              <div class="card-title"><span class="sc-gic" style="color:${g.color}">${icon(g.icon, 14)}</span> ${g.label}</div>
              <div class="card-sub">${g.total} match${g.total === 1 ? '' : 'es'}${g.total > g.shown ? ` · showing the best ${g.shown}` : ''}</div>
            </div>
            ${this.scope === 'all'
              ? `<button class="btn btn-ghost btn-sm" data-sc-scope="${g.key}">Only ${g.label}</button>` : ''}
          </div>
          <div class="sc-hits">${g.hits.map(h => this._hitHtml(h)).join('')}</div>
        </section>`;
    },

    _hitHtml(h) {
      const s = searchSource(h.key);
      return `
        <button type="button" class="sc-hit" data-sc-open="${esc(h.key)}" data-sc-id="${esc(h.id)}"
                aria-label="Open ${esc(h.label)}">
          <span class="sc-hitic" style="color:${s.color}">${icon(s.icon, 14)}</span>
          <span class="sc-hitbody">
            <span class="sc-hitname">${this._hl(h.label, this._terms)}</span>
            ${h.snippet ? `<span class="sc-hitsnip">${this._hl(h.snippet, this._terms)}</span>` : ''}
          </span>
          <span class="sc-hitmeta">${esc(h.meta)}</span>
        </button>`;
    },

    _noMatchHtml(r) {
      return `<section class="card"><div class="empty">
        <div class="empty-ic">${icon('search', 22)}</div>
        <h4>Nothing matches “${esc(r.query)}”</h4>
        <p>${r.indexed} records were searched across ${r.sources.filter(s => s.indexed).length} kinds.
           Try a shorter word, or a different spelling.</p>
        <button class="btn btn-ghost btn-sm" data-sc-reset style="margin-top:var(--sp-3)">Clear the search</button>
      </div></section>`;
    },

    _asideHtml(r) {
      if (!r.hasQuery) {
        return `<div class="card">
          <div class="card-head"><div><div class="card-title">Recently changed</div>
            <div class="card-sub">the newest record in each area</div></div></div>
          ${r.recent.length
            ? `<div class="fl-mini">${r.recent.map(e => {
                const s = searchSource(e.key);
                return `<button type="button" class="fl-minirow" data-sc-open="${esc(e.key)}" data-sc-id="${esc(e.id)}">
                  <span class="fl-miniic" style="color:${s.color}">${icon(s.icon, 13)}</span>
                  <span class="fl-mininame">${esc(e.label)}</span>
                  <span class="fl-minisz">${esc(s.label)}</span>
                </button>`;
              }).join('')}</div>`
            : '<p class="t-faint t-sm" style="margin:0">Nothing has been edited yet.</p>'}
        </div>`;
      }
      const rows = r.sources.filter(s => (r.matches[s.key] || 0) > 0)
        .sort((a, b) => (r.matches[b.key] || 0) - (r.matches[a.key] || 0));
      return `
        <div class="card">
          <div class="card-head"><div>
            <div class="card-title">Matches by kind</div>
            <div class="card-sub">${r.total} in ${rows.length} kind${rows.length === 1 ? '' : 's'}</div>
          </div></div>
          <div class="fl-kinds">
            ${rows.map(s => `
              <button type="button" class="fl-kindrow sc-kindbtn ${this.scope === s.key ? 'is-on' : ''}"
                data-sc-scope="${s.key}" aria-pressed="${this.scope === s.key}">
                <span class="fl-kindic" style="color:${s.color}">${icon(s.icon, 13)}</span>
                <span class="fl-kindname">${s.label}</span>
                <span class="fl-kindn">${r.matches[s.key]}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Indexed</div></div>
          <div class="fl-facts">
            <div class="fl-fact"><span class="fl-factk">Records</span>
              <span class="fl-factv" style="color:var(--text-1)">${r.indexed}</span></div>
            <div class="fl-fact"><span class="fl-factk">Kinds</span>
              <span class="fl-factv" style="color:var(--text-1)">${r.sources.filter(s => s.indexed).length}</span></div>
          </div>
        </div>`;
    },

    /* --- repaint regions --------------------------------------------------
       The search field is a live input, so it lives OUTSIDE every region this
       repaints: typing moves the chips, the results and the aside, never the
       node the caret is in. */
    _terms: [],
    renderResults() {
      const root = this._root;
      if (!root) return;
      const r = Derive.searchAll(this.q, this.scope, this.limit);
      this._terms = r.terms;
      const sub = $('#sc-sub', root);
      const scopes = $('#sc-scopes', root);
      const res = $('#sc-results', root);
      const side = $('#sc-side', root);
      if (sub) sub.textContent = this._summaryLine(r);
      if (scopes) scopes.innerHTML = this._scopesHtml(r);
      if (res) res.innerHTML = this._resultsHtml(r);
      if (side) side.innerHTML = this._asideHtml(r);
      this._syncHeader(r);
    },

    reset(input) {
      this.q = ''; this.scope = 'all'; this.limit = 5;
      const field = input || $('#sc-input', this._root);
      if (field) field.value = '';
      this.renderResults();
      if (field) field.focus();
    },

    bind(root) {
      const input = $('#sc-input', root);
      if (input) {
        input.addEventListener('input', () => {
          this.q = input.value;
          this.limit = 5;
          this.renderResults();
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            const first = $('.sc-hit', root);
            if (first) { e.preventDefault(); first.click(); }
          } else if (e.key === 'Escape' && input.value) {
            e.preventDefault();
            this.reset(input);
          }
        });
      }
      root.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);
        if (hit('[data-sc-reset]') || hit('#sc-clear')) { this.reset(input); return; }
        if (hit('[data-sc-more]')) { this.limit = 50; this.renderResults(); return; }
        const scope = hit('[data-sc-scope]');
        if (scope) { this.scope = scope.dataset.scScope; this.limit = 5; this.renderResults(); return; }
        const go = hit('[data-sc-go]');
        if (go) { Router.go(go.dataset.scGo); return; }
        const open = hit('[data-sc-open]');
        if (open) { revealRecord(open.dataset.scOpen, open.dataset.scId); }
      });
    },
  };

  /* ======================================================================
     ACTIVITY — Milestone 30
     The workspace already logged every mutation; this is the surface that reads
     it. An entry is a kind, a sentence and a real timestamp — the age, the day it
     belongs to, the per-kind counts and the day grouping are all derived, so the
     timeline can never describe a moment that did not happen.
     ====================================================================== */
  const ActivityPage = {
    range: 'all',     // 'all' | 'week' | 'today'
    kind: 'all',
    q: '',
    _root: null,

    _filters() { return { range: this.range, kind: this.kind, q: this.q }; },

    render(opts) {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'activity') return;
      if (opts && typeof opts.kind === 'string') this.kind = opts.kind;
      if (opts && typeof opts.range === 'string') this.range = opts.range;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Reading the log…</p></div></div></div>';
        return;
      }
      const j = Derive.activityList(this._filters());
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Activity</div>
            <h1>Activity</h1>
            <div class="sub" id="ac-sub">${esc(this._summaryLine(j))}</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-ghost btn-sm" id="ac-clear">${icon('reset', 13)} Show everything</button>
          </div>
        </div>

        <div class="proj-stats" id="ac-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(j)}</div>

        <div class="fin-layout" style="margin-top:var(--sp-4)">
          <div class="fin-main">
            <div class="fin-tools">
              <div class="viewtabs" id="ac-ranges" role="tablist" aria-label="Activity range">${this._rangesHtml()}</div>
            </div>
            <div class="fl-filters" id="ac-kinds">${this._kindsHtml(j)}</div>
            <div class="fl-searchrow">
              <span class="fl-searchic">${icon('search', 14)}</span>
              <input type="search" id="ac-search" class="fl-search" value="${esc(this.q)}"
                     placeholder="Search what happened…" aria-label="Search activity">
            </div>
            <div id="ac-list">${this._listHtml(j)}</div>
          </div>
          <div class="fin-side" id="ac-side">${this._asideHtml(j)}</div>
        </div>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      this._syncHeader(j);
    },

    _syncHeader(j) {
      Shell.setHeader('Activity', j.stats.total
        ? `${j.stats.total} entr${j.stats.total === 1 ? 'y' : 'ies'} · ${j.stats.today} today`
        : 'Everything the workspace has done');
    },

    _summaryLine(j) {
      const s = j.stats;
      if (!s.total) {
        return 'Every change you make is recorded here — tasks, habits, focus, money, notes, files.';
      }
      if (j.filtered) return `${j.rows.length} of ${s.total} entries shown.`;
      const bits = [`${s.total} entries`];
      if (s.days) bits.push(`${s.days} day${s.days === 1 ? '' : 's'}`);
      if (s.kindsUsed) bits.push(`${s.kindsUsed} kinds`);
      if (s.spanDays > 1) bits.push(`spanning ${s.spanDays} days`);
      return bits.join(' · ');
    },

    _tilesHtml(j) {
      const s = j.stats;
      return `
        ${Widgets.statTile({ icon: 'pulse', label: 'Entries', value: s.total,
          meta: s.days ? `across ${s.days} day${s.days === 1 ? '' : 's'}` : 'nothing logged yet',
          accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'clock', label: 'Today', value: s.today,
          meta: s.today === 1 ? 'one thing so far' : 'so far today', accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'calendar', label: 'This week', value: s.week,
          meta: 'the last seven days', accent: 'var(--good)' })}
        ${Widgets.statTile({ icon: 'list', label: 'Kinds', value: s.kindsUsed,
          meta: s.busiest ? `busiest ${s.busiest.short}` : 'nothing logged yet',
          accent: 'var(--violet)' })}`;
    },

    _rangesHtml() {
      const tabs = [['all', 'All time'], ['week', 'This week'], ['today', 'Today']];
      return tabs.map(([k, label]) =>
        `<button class="viewtab ${this.range === k ? 'is-active' : ''}" data-ac-range="${k}"
           role="tab" aria-selected="${this.range === k}">${label}</button>`).join('');
    },

    _kindsHtml(j) {
      const all = `<button type="button" class="chip ${this.kind === 'all' ? 'is-on' : ''}"
        data-ac-kind="all" aria-pressed="${this.kind === 'all'}">Everything <b>${j.baseTotal}</b></button>`;
      const rest = ACTIVITY_KINDS
        .map(k => ({ ...k, n: j.baseCounts[k.key] || 0 }))
        .filter(k => k.n > 0)
        .map(k => `<button type="button" class="chip ${this.kind === k.key ? 'is-on' : ''}"
          data-ac-kind="${k.key}" aria-pressed="${this.kind === k.key}">
          <span style="color:${k.color};display:inline-flex">${icon(k.icon, 12)}</span>${k.label} <b>${k.n}</b></button>`)
        .join('');
      return all + rest;
    },

    _listHtml(j) {
      if (j.empty) return this._emptyHtml();
      if (j.noMatch) return this._noMatchHtml(j);
      return j.days.map(d => this._dayHtml(d)).join('');
    },

    _dayHtml(d) {
      const isToday = d.day === todayKey();
      return `
        <section class="card ac-day" data-ac-day="${esc(d.day)}">
          <div class="card-head">
            <div>
              <div class="card-title">${isToday ? 'Today' : esc(d.label)}</div>
              <div class="card-sub">${d.count} entr${d.count === 1 ? 'y' : 'ies'}${isToday ? ` · ${esc(d.label)}` : ''}</div>
            </div>
          </div>
          <div class="ac-rows">${d.items.map(a => this._rowHtml(a)).join('')}</div>
        </section>`;
    },

    _rowHtml(a) {
      const k = activityKind(a.kind);
      return `
        <button type="button" class="ac-row" data-ac-go="${esc(k.route)}"
                title="Open ${esc(k.label)}" aria-label="${esc(a.text)} — open ${esc(k.label)}">
          <span class="ac-ic" style="color:${k.color}">${icon(k.icon, 13)}</span>
          <span class="ac-body">
            <span class="ac-text">${esc(a.text)}</span>
            <span class="ac-meta">${esc(Derive.activityTime(a))} · ${k.label}</span>
          </span>
          <span class="ac-arrow">${icon('arrowR', 12)}</span>
        </button>`;
    },

    _emptyHtml() {
      return `<section class="card"><div class="empty">
        <div class="empty-ic">${icon('pulse', 22)}</div>
        <h4>Nothing has happened yet</h4>
        <p>The log fills itself: complete a task, tick a habit, log a session or add a
           transaction, and it appears here with the moment it happened.</p>
        <button class="btn btn-primary btn-sm" data-ac-go="tasks" style="margin-top:var(--sp-3)">
          ${icon('check', 13)} Go to Tasks</button>
      </div></section>`;
    },

    _noMatchHtml(j) {
      const why = this.q ? `Nothing matches “${esc(this.q)}”` : 'Nothing in this window';
      return `<section class="card"><div class="empty">
        <div class="empty-ic">${icon('search', 22)}</div>
        <h4>${why}</h4>
        <p>${j.stats.total} entr${j.stats.total === 1 ? 'y is' : 'ies are'} in the log —
           try a wider range, or clear the filters.</p>
        <button class="btn btn-ghost btn-sm" data-ac-reset style="margin-top:var(--sp-3)">Show everything</button>
      </div></section>`;
    },

    _asideHtml(j) {
      const s = j.stats;
      if (!s.total) {
        return `<div class="card">
          <div class="card-head"><div class="card-title">How this works</div></div>
          <p class="t-faint t-sm" style="margin:0">Nothing here is written by hand. Every action
            you take appends one entry with the real moment it happened, and this page derives
            the days, the counts and the figures from those entries.</p>
        </div>`;
      }
      const rows = ACTIVITY_KINDS
        .map(k => ({ ...k, n: j.baseCounts[k.key] || 0 }))
        .filter(k => k.n > 0)
        .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
      return `
        <div class="card">
          <div class="card-head"><div>
            <div class="card-title">By kind</div>
            <div class="card-sub">${j.baseTotal} in this window</div>
          </div></div>
          <div class="fl-kinds">
            ${rows.map(k => `
              <button type="button" class="fl-kindrow sc-kindbtn ${this.kind === k.key ? 'is-on' : ''}"
                data-ac-kind="${k.key}" aria-pressed="${this.kind === k.key}">
                <span class="fl-kindic" style="color:${k.color}">${icon(k.icon, 13)}</span>
                <span class="fl-kindname">${k.label}</span>
                <span class="fl-kindn">${k.n}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">At a glance</div></div>
          <div class="fl-facts">
            <div class="fl-fact"><span class="fl-factk">Entries</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.total}</span></div>
            <div class="fl-fact"><span class="fl-factk">Days</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.days}</span></div>
            <div class="fl-fact"><span class="fl-factk">Kinds</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.kindsUsed}</span></div>
            <div class="fl-fact"><span class="fl-factk">Today</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.today}</span></div>
          </div>
          ${s.busiest ? `<p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            Busiest day: <b>${esc(s.busiest.short)}</b> with ${s.busiest.count} entr${s.busiest.count === 1 ? 'y' : 'ies'}${s.firstDay ? ` · the log starts ${esc(Derive.shortDay(s.firstDay))}` : ''}.</p>` : ''}
          <button class="btn btn-ghost btn-sm ac-wipe" data-ac-wipe style="margin-top:var(--sp-3)">
            ${icon('trash', 13)} Clear the log</button>
        </div>`;
    },

    /* Emptying the log is destructive, so it asks first — like every other delete
       in the workspace. */
    confirmClear() {
      const n = State.activity.length;
      if (!n) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Clear the log</div>
            <h2 class="t-h2" style="margin-top:6px">Remove all ${n} entr${n === 1 ? 'y' : 'ies'}?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          The log records what the workspace did, so clearing it removes that history.
          Nothing else is touched — every task, note, session and transaction stays
          exactly as it is.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="ac-wipe-yes">${icon('trash', 14)} Clear the log</button>
        </div>`, { cls: 'modal-sm' });
      $('#ac-wipe-yes', wrap).addEventListener('click', () => {
        const removed = State.clearActivity();
        Overlay.close();
        Toast.show(removed === 1 ? 'Entry removed' : `${removed} entries removed`, 'default');
        this.repaint();
      });
    },

    /* --- repaint regions --------------------------------------------------
       The search field is a live input, so it lives OUTSIDE every region this
       repaints: typing moves the chips, the list and the aside, never the node
       the caret is in. */
    repaint() {
      const root = this._root;
      if (!root) return;
      const j = Derive.activityList(this._filters());
      const sub = $('#ac-sub', root), tiles = $('#ac-tiles', root),
            ranges = $('#ac-ranges', root), kinds = $('#ac-kinds', root),
            list = $('#ac-list', root), side = $('#ac-side', root);
      if (sub) sub.textContent = this._summaryLine(j);
      if (tiles) tiles.innerHTML = this._tilesHtml(j);
      if (ranges) ranges.innerHTML = this._rangesHtml();
      if (kinds) kinds.innerHTML = this._kindsHtml(j);
      if (list) list.innerHTML = this._listHtml(j);
      if (side) side.innerHTML = this._asideHtml(j);
      this._syncHeader(j);
    },

    reset(field) {
      this.range = 'all'; this.kind = 'all'; this.q = '';
      const input = field || $('#ac-search', this._root);
      if (input) input.value = '';
      this.repaint();
    },

    bind(root) {
      const search = $('#ac-search', root);
      if (search) search.addEventListener('input', () => {
        this.q = search.value;
        /* A kind chip that no longer has rows must not stay selected, or the
           list reads as empty while the chip says it is on. */
        const live = Derive.activityList({ range: this.range, kind: 'all', q: this.q }).baseCounts;
        if (this.kind !== 'all' && !live[this.kind]) this.kind = 'all';
        this.repaint();
      });
      root.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);
        if (hit('#ac-clear') || hit('[data-ac-reset]')) { this.reset(search); return; }
        if (hit('[data-ac-wipe]')) { this.confirmClear(); return; }
        const range = hit('[data-ac-range]');
        if (range) { this.range = range.dataset.acRange; this.repaint(); return; }
        const kind = hit('[data-ac-kind]');
        if (kind) { this.kind = kind.dataset.acKind; this.repaint(); return; }
        const go = hit('[data-ac-go]');
        if (go) Router.go(go.dataset.acGo);
      });
    },
  };

  /* ======================================================================
     ANALYTICS — Milestone 31
     Trends over the records the workspace already holds. Nothing is stored for
     this page and nothing is estimated: every bar, rate and average is a fold
     over real records inside a real date range, and a week still in progress is
     measured against the days that have actually happened.
     ====================================================================== */
  const AnalyticsPage = {
    view: 'overview',   // 'overview' | 'momentum' | 'focus' | 'money'
    _root: null,

    render(opts) {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'analytics') return;
      if (opts && typeof opts.view === 'string') this.view = opts.view;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Adding things up…</p></div></div></div>';
        return;
      }
      const a = Derive.analyticsList();
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Analytics</div>
            <h1>Analytics</h1>
            <div class="sub" id="an-sub">${esc(this._summaryLine(a))}</div>
          </div>
        </div>

        <div class="proj-stats" id="an-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(a)}</div>

        <div class="fin-layout" style="margin-top:var(--sp-4)">
          <div class="fin-main">
            <div class="fin-tools">
              <div class="viewtabs" id="an-tabs" role="tablist" aria-label="Analytics view">${this._tabsHtml()}</div>
            </div>
            <div id="an-body">${this._bodyHtml(a)}</div>
          </div>
          <div class="fin-side" id="an-side">${this._asideHtml(a)}</div>
        </div>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      Shell.setHeader('Analytics', `${a.weeks.length} weeks · ${a.tasks.done} of ${a.tasks.total} tasks done`);
    },

    _summaryLine(a) {
      const w = a.current;
      if (!w) return 'Trends over everything the workspace holds.';
      const bits = [`${w.tasksDone} task${w.tasksDone === 1 ? '' : 's'} done this week`];
      bits.push(`${Math.round(w.focusMin / 60 * 10) / 10}h focused`);
      bits.push(`${Math.round(w.habitRate * 100)}% of habit days kept`);
      if (w.activity) bits.push(`${w.activity} changes logged`);
      return bits.join(' · ');
    },

    _tilesHtml(a) {
      const w = a.current;
      /* Each tile describes ONE scope — a period total with a period figure under
         it, never a total with a week delta (which reads as a contradiction). The
         like-for-like week comparison lives in the card below. */
      return `
        ${Widgets.statTile({ icon: 'check', label: 'Tasks done', value: a.tasks.done,
          meta: `${a.tasks.total} in the workspace`, accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'focus', label: 'Focus · 30 days',
          value: (Math.round(a.focus.total30 / 6) / 10) + 'h',
          meta: `${a.focus.active} active day${a.focus.active === 1 ? '' : 's'}`,
          accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'repeat', label: 'Habits · 30 days',
          value: Math.round(a.habits.rate30 * 100) + '%',
          meta: w ? `${Math.round(w.habitRate * 100)}% this week` : 'nothing tracked yet',
          accent: 'var(--good)' })}
        ${Widgets.statTile({ icon: 'wallet', label: 'Saved this month',
          value: a.money.month.income ? Math.round(a.money.month.savingsRate * 100) + '%' : '—',
          meta: `${Derive.money(a.money.month.net)} net`,
          accent: 'var(--violet)' })}`;
    },

    _tabsHtml() {
      const tabs = [['overview', 'Overview'], ['momentum', 'Momentum'], ['focus', 'Focus'], ['money', 'Money']];
      return tabs.map(([k, label]) =>
        `<button class="viewtab ${this.view === k ? 'is-active' : ''}" data-an-view="${k}"
           role="tab" aria-selected="${this.view === k}">${label}</button>`).join('');
    },

    _bodyHtml(a) {
      if (this.view === 'momentum') return this._momentumHtml(a);
      if (this.view === 'focus')    return this._focusHtml(a);
      if (this.view === 'money')    return this._moneyHtml(a);
      return this._overviewHtml(a);
    },

    /* A bar chart from the app's own chart primitives. `value` returns the number
       to draw, `label` the caption under the bar, `tip` the hover text. */
    _bars(rows, { max, cls = '', height = 132, label, tip, value }) {
      const top = Math.max(1, max);
      return `<div class="chart-bars ${cls}" style="height:${height}px">
        ${rows.map((r, i) => `<div class="cb tip" data-tip="${esc(tip(r, i))}">
          <i style="height:${Math.max(0, Math.min(100, Math.round(value(r, i) / top * 100)))}%"></i>
          <small>${esc(label(r, i))}</small></div>`).join('')}
      </div>`;
    },

    _compareRow(label, now, before, unit) {
      const diff = now - before;
      const tone = diff === 0 ? 'var(--text-3)' : diff > 0 ? 'var(--good)' : 'var(--bad)';
      const arrow = diff === 0 ? '' : diff > 0 ? '▲ ' : '▼ ';
      return `<div class="an-cmp">
        <span class="an-cmp-key">${esc(label)}</span>
        <span class="an-cmp-now">${now}${unit}</span>
        <span class="an-cmp-bar"><i style="width:${before ? Math.min(100, Math.round(now / Math.max(now, before) * 100)) : (now ? 100 : 0)}%"></i></span>
        <span class="an-cmp-prev">${before}${unit}</span>
        <span class="an-cmp-delta" style="color:${tone}">${arrow}${diff === 0 ? 'same' : Math.abs(diff) + unit}</span>
      </div>`;
    },

    _overviewHtml(a) {
      const w = a.current, p = a.previousToDate;
      const sc = a.score;
      const n = w ? w.dayCount : 0;
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head">
            <div>
              <div class="card-title">Week to date</div>
              <div class="card-sub">${w ? esc(w.label) : 'no week yet'} · ${n} day${n === 1 ? '' : 's'} elapsed, compared with the same ${n} day${n === 1 ? '' : 's'} of the week before</div>
            </div>
            ${w ? `<button class="btn btn-ghost btn-sm" data-an-review="${esc(w.key)}">${icon('star', 13)} Review this week</button>` : ''}
          </div>
          <div class="an-cmps">
            <div class="an-cmp an-cmp-head">
              <span class="an-cmp-key"></span>
              <span class="an-cmp-now">now</span>
              <span class="an-cmp-bar"></span>
              <span class="an-cmp-prev">before</span>
              <span class="an-cmp-delta">change</span>
            </div>
            ${this._compareRow('Tasks completed', w ? w.tasksDone : 0, p ? p.tasksDone : 0, '')}
            ${this._compareRow('Focus minutes', w ? w.focusMin : 0, p ? p.focusMin : 0, '')}
            ${this._compareRow('Habit check-ins', w ? w.habitLogged : 0, p ? p.habitLogged : 0, '')}
            ${this._compareRow('Changes logged', w ? w.activity : 0, p ? p.activity : 0, '')}
          </div>
          <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
            Comparing a week in progress against a finished one would read as a collapse
            every Monday, so the comparison is like-for-like: the same number of days.
          </p>
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head">
            <div>
              <div class="card-title">NEXUS Score</div>
              <div class="card-sub">${sc.delta === 0 ? 'unchanged since the last reading' : (sc.delta > 0 ? '+' : '−') + Math.abs(sc.delta) + ' since the last reading'}</div>
            </div>
          </div>
          <div class="an-score">
            ${Widgets.ring(sc.score / 100, { size: 108, stroke: 9, label: String(sc.score), sub: 'of 100', grad: 'an' })}
            <div class="an-parts">
              ${sc.parts.map(part => `
                <div class="an-part">
                  <span class="an-part-key">${esc(part.label)}</span>
                  <span class="an-part-bar"><i style="width:${Math.max(0, Math.min(100, part.value))}%;${part.penalty ? 'background:var(--bad)' : ''}"></i></span>
                  <span class="an-part-val">${part.penalty ? '−' + part.penalty : part.value}</span>
                </div>`).join('')}
            </div>
          </div>
          <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
            Weighted from tasks (40%), habits (25%), goals (20%) and today's focus (15%),
            less a penalty for overdue work — the same figure the dashboard shows.
          </p>
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head">
            <div>
              <div class="card-title">The last twelve weeks</div>
              <div class="card-sub">${a.heat.total} changes logged · busiest day ${a.heat.max}</div>
            </div>
          </div>
          <div class="heat an-heat">
            ${a.heat.cols.map(col => `<div class="h-col">${col.cells.map(cell =>
              `<span class="h-cell ${cell.future ? 'is-future' : ''}" data-l="${cell.level}"
                 title="${esc(cell.key)} · ${cell.n} change${cell.n === 1 ? '' : 's'}"></span>`).join('')}</div>`).join('')}
          </div>
          <div class="an-legend">
            <span class="t-faint t-sm">less</span>
            <span class="h-cell" data-l="0"></span><span class="h-cell" data-l="1"></span>
            <span class="h-cell" data-l="2"></span><span class="h-cell" data-l="3"></span>
            <span class="h-cell" data-l="4"></span>
            <span class="t-faint t-sm">more</span>
          </div>
        </section>`;
    },

    _momentumHtml(a) {
      const maxTasks = Math.max.apply(null, a.weeks.map(w => w.tasksDone).concat([1]));
      const maxRate = Math.max.apply(null, a.weeks.map(w => w.habitRate).concat([0.01]));
      const est = a.weeks.reduce((s, w) => s + w.taskMinutes, 0);
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head"><div>
            <div class="card-title">Tasks completed per week</div>
            <div class="card-sub">${a.tasks.done} done in total · ${est} minutes of estimated work</div>
          </div></div>
          ${this._bars(a.weeks, {
            max: maxTasks,
            value: w => w.tasksDone,
            label: w => new Date(w.start + 'T12:00:00').getDate(),
            tip: w => `${w.tasksDone} completed · ${w.taskMinutes} min estimated · week of ${w.label}`,
          })}
          <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            Counted from each task's real completion date, never from its due date.
          </p>
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">Habit consistency per week</div>
            <div class="card-sub">${Math.round(a.habits.weekRate)}% this week · ${a.habits.active} of ${a.habits.rows.length} habits live · best run ${a.habits.bestStreak} days</div>
          </div></div>
          ${this._bars(a.weeks, {
            cls: 'alt',
            max: maxRate,
            value: w => w.habitRate,
            label: w => new Date(w.start + 'T12:00:00').getDate(),
            tip: w => `${Math.round(w.habitRate * 100)}% · ${w.habitLogged} of ${w.habitPossible} check-ins · week of ${w.label}`,
          })}
          <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            The week in progress is measured against the days that have actually happened,
            so it is not judged as a week that failed.
          </p>
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">Each habit · last 30 days</div>
            <div class="card-sub">days kept out of the last thirty</div>
          </div></div>
          <div class="an-rows">
            ${a.habits.rows.map(h => {
              const pct = Math.round(h.rate30 / 30 * 100);
              return `<div class="an-row">
                <span class="an-ic" style="color:${h.color}">${icon(h.icon, 13)}</span>
                <span class="an-name">${esc(h.name)}</span>
                <span class="an-bar"><i style="width:${pct}%;background:${h.color}"></i></span>
                <span class="an-val">${pct}%</span>
                <span class="an-sub">${h.streak}d streak</span>
              </div>`;
            }).join('') || '<p class="t-faint t-sm" style="margin:0">No habits are being tracked yet.</p>'}
          </div>
        </section>`;
    },

    _focusHtml(a) {
      const f = a.focus;
      const maxDay = Math.max.apply(null, f.days.map(d => d.minutes).concat([1]));
      const maxDow = Math.max.apply(null, f.weekday.map(d => d.minutes).concat([1]));
      const maxProj = Math.max.apply(null, f.byProject.map(p => p.minutes).concat([1]));
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head"><div>
            <div class="card-title">Focus minutes · last 30 days</div>
            <div class="card-sub">${f.total30} minutes over ${f.active} active day${f.active === 1 ? '' : 's'} · ${f.avg} min a day on average</div>
          </div></div>
          ${this._bars(f.days, {
            max: maxDay,
            value: d => d.minutes,
            label: d => d.isToday ? '·' : new Date(d.key + 'T12:00:00').getDate(),
            tip: d => `${d.minutes} min · ${Derive.longDay(d.key)}`,
          })}
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">The shape of the week</div>
            <div class="card-sub">minutes by weekday · the last four weeks</div>
          </div></div>
          ${this._bars(f.weekday, {
            cls: 'alt',
            height: 120,
            max: maxDow,
            value: d => d.minutes,
            label: d => d.label,
            tip: d => `${d.minutes} min across ${d.seen} ${d.label}${d.seen === 1 ? '' : 's'} · ${d.avg} min average`,
          })}
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">Where the time goes</div>
            <div class="card-sub">minutes by project · every session that is linked to a task</div>
          </div></div>
          <div class="an-rows">
            ${f.byProject.map(p => `
              <div class="an-row">
                <span class="an-name">${esc(p.project)}</span>
                <span class="an-bar"><i style="width:${Math.round(p.minutes / maxProj * 100)}%;background:var(--accent)"></i></span>
                <span class="an-val">${p.minutes} min</span>
              </div>`).join('') || '<p class="t-faint t-sm" style="margin:0">No session has been linked to a project yet.</p>'}
          </div>
          <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
            Best day: ${f.best.key ? esc(Derive.shortDay(f.best.key)) + ' with ' + f.best.minutes + ' min' : 'nothing logged yet'} ·
            current streak ${f.streak} day${f.streak === 1 ? '' : 's'} · daily target ${f.target} min.
          </p>
        </section>`;
    },

    _moneyHtml(a) {
      const t = a.money.trend;
      const maxBar = Math.max.apply(null, t.map(m => Math.max(m.income, m.expenses)).concat([1]));
      const b = a.money.budgets;
      const maxSpent = Math.max.apply(null, b.all.map(r => Math.max(r.spent, r.target)).concat([1]));
      return `
        <section class="card" style="margin-top:var(--sp-4)">
          <div class="card-head"><div>
            <div class="card-title">Income and spending · six months</div>
            <div class="card-sub">${esc(a.money.month.monthLabel)} so far: ${Derive.money(a.money.month.income)} in, ${Derive.money(a.money.month.expenses)} out</div>
          </div></div>
          <div class="fin-chart">
            ${t.map(m => `<div class="fin-bar tip" data-tip="${esc(m.label)} · ${Derive.money(m.income)} in, ${Derive.money(m.expenses)} out">
              <div class="fin-bar-pair">
                <i style="height:${Math.max(1, Math.round(m.income / maxBar * 100))}%;background:var(--good)"></i>
                <i style="height:${Math.max(1, Math.round(m.expenses / maxBar * 100))}%;background:var(--bad)"></i>
              </div>
              <small class="fin-bar-lbl">${esc(m.label)}</small></div>`).join('')}
          </div>
          <div class="fin-legend">
            <span><i style="background:var(--good)"></i> In</span>
            <span><i style="background:var(--bad)"></i> Out</span>
          </div>
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">Savings rate by month</div>
            <div class="card-sub">the share of each month's income that was kept</div>
          </div></div>
          <div class="an-rows">
            ${t.map(m => `
              <div class="an-row">
                <span class="an-name">${esc(m.label)}${m.current ? ' · so far' : ''}</span>
                <span class="an-bar"><i style="width:${Math.max(0, Math.min(100, Math.round(m.savingsRate * 100)))}%;background:${m.net >= 0 ? 'var(--good)' : 'var(--bad)'}"></i></span>
                <span class="an-val">${m.income ? Math.round(m.savingsRate * 100) + '%' : '—'}</span>
                <span class="an-sub">${Derive.money(m.net)}</span>
              </div>`).join('')}
          </div>
        </section>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">Budgets this month</div>
            <div class="card-sub">${b.set
              ? `${b.set} target${b.set === 1 ? '' : 's'} · ${Derive.money(b.totalSpent)} of ${Derive.money(b.totalTarget)} used${b.overCount ? ` · ${b.overCount} over` : ''}`
              : 'no targets set yet'}</div>
          </div></div>
          <div class="an-rows">
            ${b.all.map(r => {
              const pct = r.target ? Math.round(r.pct * 100) : 0;
              const tone = r.over ? 'var(--bad)' : pct >= 80 ? 'var(--warn)' : 'var(--good)';
              return `<div class="an-row">
                <span class="an-name">${esc(r.name)}</span>
                <span class="an-bar"><i style="width:${r.target ? Math.min(100, Math.round(r.spent / maxSpent * 100)) : Math.round(r.spent / maxSpent * 100)}%;background:${tone}"></i></span>
                <span class="an-val">${Derive.money(r.spent)}</span>
                <span class="an-sub">${r.target ? (r.over ? 'over by ' + Derive.money(-r.remaining) : pct + '% of ' + Derive.money(r.target)) : 'no target'}</span>
              </div>`;
            }).join('')}
          </div>
          <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
            Every figure here comes from the transaction log, so editing a transaction moves
            these bars immediately. The targets themselves are the one thing that is set by hand.
          </p>
        </section>`;
    },

    _asideHtml(a) {
      const s = a.score;
      return `
        <div class="card">
          <div class="card-head"><div><div class="card-title">At a glance</div>
            <div class="card-sub">the whole workspace, right now</div></div></div>
          <div class="fl-facts">
            <div class="fl-fact"><span class="fl-factk">Tasks</span>
              <span class="fl-factv" style="color:var(--text-1)">${a.tasks.done}<small class="an-of">/${a.tasks.total}</small></span></div>
            <div class="fl-fact"><span class="fl-factk">Score</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.score}</span></div>
            <div class="fl-fact"><span class="fl-factk">Focus 30d</span>
              <span class="fl-factv" style="color:var(--text-1)">${(Math.round(a.focus.total30 / 6) / 10)}<small class="an-of">h</small></span></div>
            <div class="fl-fact"><span class="fl-factk">Habits 30d</span>
              <span class="fl-factv" style="color:var(--text-1)">${Math.round(a.habits.rate30 * 100)}<small class="an-of">%</small></span></div>
          </div>
          <div class="an-facts">
            ${this._fact('Journal entries · 30d', a.journal.entries)}
            ${this._fact('Words written · 30d', a.journal.words)}
            ${this._fact('Changes logged · 12w', a.heat.total)}
            ${this._fact('Files stored', (State.files || []).length)}
            ${this._fact('Transactions', (State.transactions || []).length)}
            ${this._fact('Notes', (State.notes || []).length)}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><div><div class="card-title">What this reads</div></div></div>
          <p class="t-faint t-sm" style="margin:0">
            Tasks, habits, focus sessions, goals, the journal, the transaction log, the
            activity log and the files you have stored. Nothing is computed ahead of time
            and nothing is stored for this page — every figure is worked out from those
            records each time it is shown, so it can never disagree with the page it came
            from.
          </p>
        </div>`;
    },

    _fact(key, value) {
      return `<div class="an-fact"><span class="an-factk">${esc(key)}</span>
        <span class="an-factv">${value}</span></div>`;
    },

    /* --- repaint ---------------------------------------------------------- */
    repaint() {
      const root = this._root;
      if (!root) return;
      const a = Derive.analyticsList();
      const sub = $('#an-sub', root), tiles = $('#an-tiles', root),
            tabs = $('#an-tabs', root), body = $('#an-body', root),
            side = $('#an-side', root);
      if (sub) sub.textContent = this._summaryLine(a);
      if (tiles) tiles.innerHTML = this._tilesHtml(a);
      if (tabs) tabs.innerHTML = this._tabsHtml();
      if (body) body.innerHTML = this._bodyHtml(a);
      if (side) side.innerHTML = this._asideHtml(a);
      Shell.setHeader('Analytics', `${a.weeks.length} weeks · ${a.tasks.done} of ${a.tasks.total} tasks done`);
    },

    bind(root) {
      root.addEventListener('click', e => {
        const view = e.target.closest('[data-an-view]');
        if (view) { this.view = view.dataset.anView; this.repaint(); return; }
        const rev = e.target.closest('[data-an-review]');
        if (rev) Router.go('reviews', { kind: 'week', start: rev.dataset.anReview });
      });
    },
  };

  /* ======================================================================
     REVIEWS — Milestone 32
     A period the user closed and thought about. The review itself is only the
     words and a self-rating; every figure beside it is folded from that period's
     records on demand, so a review can never quote a number the workspace no
     longer supports — and editing an old record changes what its review reports,
     because that is what actually happened.
     ====================================================================== */
  const ReviewsPage = {
    kind: 'week',     // the cadence the composer is writing about
    start: null,      // the period's first day (a Monday, or the 1st)
    filter: 'all',    // 'all' | 'week' | 'month'
    _root: null,
    _timer: null,

    _ensurePeriod() {
      const nowStart = reviewStart(this.kind, new Date());
      this.start = this.start
        ? reviewStart(this.kind, new Date(this.start + 'T12:00:00'))
        : nowStart;
      /* A period that has not happened cannot be reviewed. */
      if (this.start > nowStart) this.start = nowStart;
    },
    _period() { return { kind: this.kind, start: this.start }; },
    _record() { const p = this._period(); return State.reviewFor(p.kind, p.start); },

    render(opts) {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'reviews') return;
      if (opts && REVIEW_KINDS.some(k => k.key === opts.kind)) this.kind = opts.kind;
      if (opts && /^\d{4}-\d{2}-\d{2}$/.test(String(opts.start || ''))) this.start = String(opts.start);
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Opening the notebook…</p></div></div></div>';
        return;
      }
      this._ensurePeriod();
      const j = Derive.reviewList();
      const p = Derive.reviewPeriod(this._period());
      const rec = this._record();
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Reviews</div>
            <h1>Reviews</h1>
            <div class="sub" id="rv-sub">${esc(this._summaryLine(j))}</div>
          </div>
        </div>

        <div class="proj-stats" id="rv-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(j)}</div>

        <div class="fin-layout" style="margin-top:var(--sp-4)">
          <div class="fin-main">
            <section class="card rv-composer">
              <div id="rv-head">${this._headHtml(p)}</div>
              <div class="rv-figs" id="rv-figures">${this._figuresHtml(p)}</div>
              <p class="t-faint t-sm rv-fignote">
                Read back from this period's records when the page opens. A review stores none of these numbers.
              </p>
              <input class="rv-title" id="rv-title" maxlength="140"
                     placeholder="Give it a title (optional)" value="${esc(rec ? rec.title : '')}"
                     aria-label="Review title">
              <textarea class="rv-body" id="rv-body" maxlength="20000"
                        placeholder="What moved, what stalled, what to drop…"
                        aria-label="Your review">${esc(rec ? rec.body : '')}</textarea>
              <div class="rv-foot">
                <div class="rv-rating" id="rv-rating">${this._ratingHtml(rec)}</div>
                <span class="rv-saved" id="rv-saved">${esc(this._savedText())}</span>
              </div>
            </section>

            <div class="rv-tools">
              <div class="viewtabs" id="rv-filter" role="tablist" aria-label="Review cadence">${this._filterHtml()}</div>
            </div>
            <div id="rv-list">${this._listHtml(j)}</div>
          </div>
          <div class="fin-side" id="rv-side">${this._asideHtml(j)}</div>
        </div>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      this._syncHeader(j);
    },

    _syncHeader(j) {
      const s = j.stats;
      Shell.setHeader('Reviews', s.written
        ? `${s.written} written · ${s.weekCoverage.written}/${s.weekCoverage.total || 0} weeks covered`
        : 'Close a period and say what happened');
    },

    _savedText() {
      const rec = this._record();
      if (!rec || !Derive.reviewMeaningful(rec)) return 'Nothing written yet';
      return `Saved ${Derive.relTime(rec.updatedAt)}`;
    },

    _summaryLine(j) {
      const s = j.stats;
      if (!s.written) {
        return 'Close a period and say what happened. Every figure beside a review is read back from that period.';
      }
      const bits = [`${s.written} review${s.written === 1 ? '' : 's'} written`];
      if (s.words) bits.push(`${s.words} words`);
      if (s.avgRating != null) bits.push(`${s.avgRating.toFixed(1)} average rating`);
      if (s.weekCoverage.total) bits.push(`${s.weekCoverage.written} of ${s.weekCoverage.total} weeks covered`);
      return bits.join(' · ');
    },

    _tilesHtml(j) {
      const s = j.stats;
      const w = s.weekCoverage, m = s.monthCoverage;
      return `
        ${Widgets.statTile({ icon: 'star', label: 'Reviews written', value: s.written,
          meta: s.total > s.written ? `${s.total - s.written} opened and left blank` : 'none left blank',
          accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'calendar', label: 'Weekly',
          value: w.total ? `${w.written}/${w.total}` : '—',
          meta: w.total ? `${Math.round(w.written / w.total * 100)}% of weeks covered` : 'none started yet',
          accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'chart', label: 'Monthly',
          value: m.total ? `${m.written}/${m.total}` : '—',
          meta: m.total ? `${Math.round(m.written / m.total * 100)}% of months covered` : 'none started yet',
          accent: 'var(--violet)' })}
        ${Widgets.statTile({ icon: 'pulse', label: 'Average rating',
          value: s.avgRating != null ? s.avgRating.toFixed(1) : '—',
          meta: s.rated ? `${s.rated} of ${s.written} rated` : 'nothing rated yet',
          accent: 'var(--good)' })}`;
    },

    _headHtml(p) {
      const k = reviewKind(p.kind);
      const unit = p.kind === 'month' ? `${p.elapsed} day${p.elapsed === 1 ? '' : 's'} elapsed`
                                      : `${p.elapsed} of 7 days elapsed`;
      return `
        <div class="card-head">
          <div>
            <div class="card-title">${esc(p.label)}</div>
            <div class="card-sub">${k.label} review · ${unit}${p.isCurrent ? '' : ' · this period is closed'}</div>
          </div>
          <div class="viewtabs" role="tablist" aria-label="Review cadence">
            ${REVIEW_KINDS.map(x => `
              <button class="viewtab ${this.kind === x.key ? 'is-active' : ''}" data-rv-kind="${x.key}"
                role="tab" aria-selected="${this.kind === x.key}">${x.label}</button>`).join('')}
          </div>
        </div>
        <div class="rv-nav">
          <button class="iconbtn" data-rv-nav="-1" aria-label="Previous period">${icon('chevL', 14)}</button>
          <button class="btn btn-ghost btn-sm" data-rv-now ${p.isCurrent ? 'disabled' : ''}>Back to now</button>
          <button class="iconbtn" data-rv-nav="1" aria-label="Next period" ${p.isCurrent ? 'disabled' : ''}>${icon('chevR', 14)}</button>
        </div>`;
    },

    /* The figures for the period — the SAME fold the Analytics page uses. */
    _figuresHtml(p) {
      const f = Derive.periodFigures(p.days);
      const items = [
        ['Tasks done', String(f.tasksDone)],
        ['Focus', f.focusMin >= 60 ? (Math.round(f.focusMin / 6) / 10) + 'h' : f.focusMin + 'm'],
        ['Habit days', f.habitPossible ? Math.round(f.habitRate * 100) + '%' : '—'],
        ['Spent', Derive.money(f.spend)],
        ['Journal', String(f.journal)],
        ['Changes', String(f.activity)],
      ];
      return items.map(([k, v]) =>
        `<div class="rv-fig"><span class="rv-figk">${esc(k)}</span><span class="rv-figv">${esc(v)}</span></div>`).join('');
    },

    _ratingHtml(rec) {
      const v = rec ? rec.rating : null;
      return `
        <span class="rv-ratelabel">How did it go?</span>
        ${[1, 2, 3, 4, 5].map(n => `
          <button type="button" class="rv-rate ${v != null && n <= v ? 'is-on' : ''}"
            data-rv-rate="${n}" aria-pressed="${v === n}" aria-label="${n} of 5">${icon('star', 14)}</button>`).join('')}
        <span class="rv-rateval">${v != null ? v + '/5' : 'not rated'}</span>`;
    },

    _stars(n) {
      return [1, 2, 3, 4, 5].map(i =>
        `<span class="rv-star-mini ${i <= n ? 'is-on' : ''}">${icon('star', 11)}</span>`).join('');
    },

    _filterHtml() {
      const tabs = [['all', 'All'], ['week', 'Weekly'], ['month', 'Monthly']];
      return tabs.map(([k, label]) =>
        `<button class="viewtab ${this.filter === k ? 'is-active' : ''}" data-rv-filter="${k}"
           role="tab" aria-selected="${this.filter === k}">${label}</button>`).join('');
    },

    _listHtml(j) {
      const all = j.reviews;
      if (!all.length) return this._emptyHtml();
      const list = this.filter === 'all' ? all : all.filter(r => r.kind === this.filter);
      if (!list.length) {
        return `<section class="card" style="margin-top:var(--sp-3)"><div class="empty">
          <div class="empty-ic">${icon('star', 22)}</div>
          <h4>No ${this.filter === 'week' ? 'weekly' : 'monthly'} reviews yet</h4>
          <p>${all.length} review${all.length === 1 ? '' : 's'} in total — switch the filter to see them.</p>
        </div></section>`;
      }
      return `<div class="rv-rows">${list.map(r => this._rowHtml(r)).join('')}</div>`;
    },

    _rowHtml(r) {
      const p = Derive.reviewPeriod(r);
      const f = Derive.reviewFigures(r);
      const k = reviewKind(r.kind);
      const figs = `${f.tasksDone} task${f.tasksDone === 1 ? '' : 's'} · ${f.focusMin} min focus · ` +
        `${f.habitPossible ? Math.round(f.habitRate * 100) + '%' : '—'} habit days · ${Derive.money(f.spend)}`;
      return `
        <button type="button" class="rv-row" data-rv-open="${esc(r.id)}"
                aria-label="Open the review of ${esc(p.label)}">
          <span class="rv-rowic">${icon(k.icon, 14)}</span>
          <span class="rv-rowbody">
            <span class="rv-rowtop">
              <span class="rv-rowtitle">${esc(r.title || p.label)}</span>
              <span class="rv-rowstars">${r.rating != null ? this._stars(r.rating) : 'not rated'}</span>
            </span>
            <span class="rv-rowx">${esc(Derive.reviewExcerpt(r, 120) || 'No words — just a rating.')}</span>
            <span class="rv-rowfigs">${esc(figs)}</span>
          </span>
          <span class="rv-rowarrow">${icon('arrowR', 12)}</span>
        </button>`;
    },

    _emptyHtml() {
      return `<section class="card" style="margin-top:var(--sp-3)"><div class="empty">
        <div class="empty-ic">${icon('star', 22)}</div>
        <h4>No reviews yet</h4>
        <p>Write one above. A review is only your words and a rating — the figures beside it
           are read back from that period's records, so they can never go stale.</p>
      </div></section>`;
    },

    _asideHtml(j) {
      const s = j.stats;
      return `
        <div class="card">
          <div class="card-head"><div><div class="card-title">Coverage</div>
            <div class="card-sub">periods closed since the first review</div></div></div>
          ${this._coverageHtml('week', s.weekCoverage)}
          ${this._coverageHtml('month', s.monthCoverage)}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">At a glance</div></div>
          <div class="fl-facts">
            <div class="fl-fact"><span class="fl-factk">Reviews</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.written}</span></div>
            <div class="fl-fact"><span class="fl-factk">Words</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.words}</span></div>
            <div class="fl-fact"><span class="fl-factk">Weekly</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.weeks}</span></div>
            <div class="fl-fact"><span class="fl-factk">Monthly</span>
              <span class="fl-factv" style="color:var(--text-1)">${s.months}</span></div>
          </div>
          ${s.best ? `<p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            Best rated: <b>${esc(s.best.title || Derive.reviewPeriod(s.best).label)}</b> at ${s.best.rating}/5.</p>` : ''}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">What a review is</div></div>
          <p class="t-faint t-sm" style="margin:0">
            Only two things are kept: what you wrote and how you rated the period. Every
            figure beside a review is folded from that period's records each time the page
            opens, so it can never disagree with the page it came from — and correcting an
            old transaction changes what its review reports, because that is what happened.
          </p>
        </div>`;
    },

    _coverageHtml(kind, c) {
      const k = reviewKind(kind);
      const pct = c.total ? Math.round(c.written / c.total * 100) : 0;
      return `
        <div class="rv-cov">
          <div class="rv-covtop">
            <span class="rv-covname">${k.label}</span>
            <span class="rv-covn">${c.total ? c.written + ' of ' + c.total : 'none yet'}</span>
          </div>
          <div class="rv-covbar"><i style="width:${pct}%"></i></div>
          ${c.total
            ? (c.missed.length
                ? `<div class="rv-covmiss">Skipped ${c.missed.length} · most recent ${esc(Derive.shortDay(c.missed[0]))}</div>`
                : '<div class="rv-covmiss is-clean">Nothing skipped</div>')
            : ''}
        </div>`;
    },

    /* --- repaint regions --------------------------------------------------
       The composer holds a live title and textarea, so both live OUTSIDE every
       region this repaints: typing moves the figures, the list and the aside,
       never the node the caret is in. */
    renderHead() {
      const root = this._root; if (!root) return;
      const box = $('#rv-head', root);
      if (box) box.innerHTML = this._headHtml(Derive.reviewPeriod(this._period()));
    },
    renderFigures() {
      const root = this._root; if (!root) return;
      const box = $('#rv-figures', root);
      if (box) box.innerHTML = this._figuresHtml(Derive.reviewPeriod(this._period()));
    },
    renderRating() {
      const root = this._root; if (!root) return;
      const box = $('#rv-rating', root);
      if (box) box.innerHTML = this._ratingHtml(this._record());
    },
    renderSaved() {
      const root = this._root; if (!root) return;
      const box = $('#rv-saved', root);
      if (box) box.textContent = this._savedText();
    },
    renderList() {
      const root = this._root; if (!root) return;
      const j = Derive.reviewList();
      const list = $('#rv-list', root);
      if (list) list.innerHTML = this._listHtml(j);
      const filter = $('#rv-filter', root);
      if (filter) filter.innerHTML = this._filterHtml();
      const tiles = $('#rv-tiles', root);
      if (tiles) tiles.innerHTML = this._tilesHtml(j);
      const sub = $('#rv-sub', root);
      if (sub) sub.textContent = this._summaryLine(j);
      this._syncHeader(j);
    },
    renderSide() {
      const root = this._root; if (!root) return;
      const box = $('#rv-side', root);
      if (box) box.innerHTML = this._asideHtml(Derive.reviewList());
    },
    /* Everything except the two fields the caret can be in. */
    repaint() {
      this.renderHead(); this.renderFigures(); this.renderRating();
      this.renderSaved(); this.renderList(); this.renderSide();
    },

    /* --- writing ---------------------------------------------------------- */
    _commit(root) {
      const titleEl = $('#rv-title', root);
      const bodyEl = $('#rv-body', root);
      if (!titleEl || !bodyEl) return null;
      const p = this._period();
      const title = titleEl.value, body = bodyEl.value;
      let rec = State.reviewFor(p.kind, p.start);
      /* A period the user typed nothing into keeps no record — but an existing
         review is never destroyed just because its text was cleared by accident. */
      if (!String(title).trim() && !String(body).trim() && !rec) return null;
      if (!rec) rec = State.ensureReview(p.kind, p.start);
      if (!rec) return null;
      State.updateReview(rec.id, { title, body });
      return rec;
    },
    _queue(root) {
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._flush(root), 420);
    },
    _flush(root) {
      clearTimeout(this._timer);
      const rec = this._commit(root);
      if (!rec) return null;
      this.renderSaved();
      this.renderFigures();
      this.renderList();
      this.renderSide();
      return rec;
    },
    /* Load whatever the composer's period currently holds into the two fields. */
    _load() {
      const root = this._root; if (!root) return;
      const rec = this._record();
      const titleEl = $('#rv-title', root);
      const bodyEl = $('#rv-body', root);
      if (titleEl) titleEl.value = rec ? rec.title : '';
      if (bodyEl) bodyEl.value = rec ? rec.body : '';
      this.repaint();
    },
    _shiftPeriod(delta) {
      const d = new Date(this.start + 'T12:00:00');
      if (this.kind === 'month') d.setMonth(d.getMonth() + delta);
      else d.setDate(d.getDate() + delta * 7);
      const next = reviewStart(this.kind, d);
      if (next > reviewStart(this.kind, new Date())) return;
      this._flush(this._root);
      this.start = next;
      this._load();
    },
    _rate(root, v) {
      this._flush(root);            // the words are committed before the rating
      const p = this._period();
      let rec = State.reviewFor(p.kind, p.start);
      if (!rec) rec = State.ensureReview(p.kind, p.start);
      if (!rec) return;
      /* Clicking the rating that is already set clears it — `null` is a real value. */
      State.updateReview(rec.id, { rating: rec.rating === v ? null : v });
      this.renderRating();
      this.renderSaved();
      this.renderList();
      this.renderSide();
    },

    bind(root) {
      const titleEl = $('#rv-title', root);
      const bodyEl = $('#rv-body', root);
      [titleEl, bodyEl].forEach(field => {
        if (!field) return;
        field.addEventListener('input', () => this._queue(root));
        field.addEventListener('blur', () => this._flush(root));
      });

      root.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);
        const kind = hit('[data-rv-kind]');
        if (kind) { this._flush(root); this.kind = kind.dataset.rvKind; this.start = null; this._ensurePeriod(); this._load(); return; }
        const nav = hit('[data-rv-nav]');
        if (nav) { this._shiftPeriod(Number(nav.dataset.rvNav)); return; }
        if (hit('[data-rv-now]')) { this._flush(root); this.start = reviewStart(this.kind, new Date()); this._load(); return; }
        const filter = hit('[data-rv-filter]');
        if (filter) { this.filter = filter.dataset.rvFilter; this.renderList(); return; }
        const rate = hit('[data-rv-rate]');
        if (rate) { this._rate(root, Number(rate.dataset.rvRate)); return; }
        const open = hit('[data-rv-open]');
        if (open) this.openPanel(open.dataset.rvOpen);
      });
    },

    /* --- one review, in full ---------------------------------------------- */
    openPanel(id) {
      const r = State.reviewById(id);
      if (!r) { Toast.show('That review is no longer here.', 'warn'); return; }
      const p = Derive.reviewPeriod(r);
      const k = reviewKind(r.kind);
      const panel = Overlay.panel(`
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">${k.label} review</div>
            <h2 class="panel-title">${esc(r.title || p.label)}</h2>
            <div class="t-faint t-sm">${p.elapsed} day${p.elapsed === 1 ? '' : 's'} · edited ${esc(Derive.relTime(r.updatedAt))}</div>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          <div class="p-sec">
            <div class="rv-figs">${this._figuresHtml(p)}</div>
            <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
              Read back from this period's records just now — the review stores none of these numbers.
            </p>
          </div>
          <div class="p-sec">
            <div class="rv-panelrate">${r.rating != null ? this._stars(r.rating) + ` <b>${r.rating}/5</b>` : 'Not rated'}</div>
            <p class="rv-panelbody">${esc(r.body || 'Nothing was written for this period.')}</p>
          </div>
        </div>

        <div class="panel-foot">
          <button class="btn btn-ghost btn-sm" data-rv-edit>${icon('edit', 13)} Open in the composer</button>
          <button class="btn btn-ghost btn-sm act-danger" data-rv-del style="margin-left:auto">${icon('trash', 13)} Delete</button>
        </div>`);

      const edit = $('[data-rv-edit]', panel);
      if (edit) edit.addEventListener('click', () => {
        Overlay.close();
        this.kind = r.kind;
        this.start = r.start;
        this._load();
        Toast.show(`Composing the review of ${p.label}`, 'default');
      });
      const del = $('[data-rv-del]', panel);
      if (del) del.addEventListener('click', () => { Overlay.close(); this.confirmDelete(r.id); });
    },

    confirmDelete(id) {
      const r = State.reviewById(id);
      if (!r) return;
      const p = Derive.reviewPeriod(r);
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete review</div>
            <h2 class="t-h2" style="margin-top:6px">Remove the review of ${esc(p.label)}?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          Your reflection and its rating are removed. Every record of that period — its
          tasks, sessions, habits and transactions — is left exactly as it is.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="rv-del-yes">${icon('trash', 14)} Delete review</button>
        </div>`, { cls: 'modal-sm' });
      $('#rv-del-yes', wrap).addEventListener('click', () => {
        State.deleteReview(id);
        Overlay.close();
        Toast.show('Review deleted', 'default');
        this._load();
      });
    },
  };

  /* ======================================================================
     TIME MACHINE — Milestone 33 (the first Pro feature)
     Scrub the whole workspace back to any day it has a record for and see exactly
     what it held then: tasks completed by that day, minutes focused, habit
     check-ins, money in and out, the log, and what was still open. Every figure is
     a fold over records dated on or before the day being viewed — nothing is
     stored and nothing is projected forward.
     ====================================================================== */
  const TimeMachinePage = {
    day: null,
    _root: null,

    render(opts) {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'time') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Rewinding…</p></div></div></div>';
        return;
      }
      /* The gate. A page that exists but cannot be used has to say why, and point
         at the one place that changes the answer. */
      if (!FeatureAccess.allows('time')) { renderLocked(mount, 'time'); return; }

      const win = Derive.timeWindow();
      if (opts && /^\d{4}-\d{2}-\d{2}$/.test(String(opts.day || ''))) this.day = String(opts.day);
      if (!this.day || this.day < win.first || this.day > win.today) this.day = win.today;
      const m = Derive.timeMachine(this.day);

      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Time Machine</div>
            <h1>Time Machine</h1>
            <div class="sub" id="tm-sub">${esc(this._summaryLine(m))}</div>
          </div>
          <div class="row gap-2">
            <span class="badge badge-pro">✦ PRO</span>
          </div>
        </div>

        <section class="card tm-scrub" style="margin-top:var(--sp-4)">
          <div id="tm-head">${this._headHtml(m)}</div>
          <input type="range" class="tm-range" id="tm-range" min="0" max="${m.days.length - 1}"
                 value="${m.index}" aria-label="Day to view">
          <div class="tm-scale">
            <span>${esc(Derive.shortDay(m.days[0]))}</span>
            <span>${esc(Derive.shortDay(m.days[m.days.length - 1]))}</span>
          </div>
        </section>

        <div class="proj-stats" id="tm-tiles" style="margin-top:var(--sp-4)">${this._tilesHtml(m)}</div>

        <div class="fin-layout" style="margin-top:var(--sp-4)">
          <div class="fin-main">
            <div id="tm-day">${this._dayHtml(m)}</div>
            <div id="tm-since">${this._sinceHtml(m)}</div>
          </div>
          <div class="fin-side" id="tm-side">${this._asideHtml(m)}</div>
        </div>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      Shell.setHeader('Time Machine', Derive.longDay(this.day));
    },

    _summaryLine(m) {
      const a = m.asOf;
      const ago = m.since.days;
      const when = ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`;
      return `${Derive.longDay(m.day)} · ${when} · ` +
        `${a.tasksDone} task${a.tasksDone === 1 ? '' : 's'} done, ${a.focusMin} min focused, ${Derive.money(a.net)} net.`;
    },

    _headHtml(m) {
      const ago = m.since.days;
      return `
        <div class="card-head">
          <div>
            <div class="card-title">${esc(Derive.longDay(m.day))}</div>
            <div class="card-sub">${ago === 0 ? 'today' : `${ago} day${ago === 1 ? '' : 's'} ago`} · day ${m.index + 1} of ${m.days.length} the workspace has a record for</div>
          </div>
          <div class="row gap-2">
            <button class="iconbtn" data-tm-nav="-1" aria-label="Previous day" ${m.isFirst ? 'disabled' : ''}>${icon('chevL', 14)}</button>
            <button class="btn btn-ghost btn-sm" data-tm-now ${m.isLast ? 'disabled' : ''}>Now</button>
            <button class="iconbtn" data-tm-nav="1" aria-label="Next day" ${m.isLast ? 'disabled' : ''}>${icon('chevR', 14)}</button>
          </div>
        </div>`;
    },

    _tilesHtml(m) {
      const a = m.asOf;
      return `
        ${Widgets.statTile({ icon: 'check', label: 'Done by then', value: a.tasksDone,
          meta: `${a.tasksOpen} still open then`, accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'focus', label: 'Focused by then',
          value: (Math.round(a.focusMin / 6) / 10) + 'h',
          meta: `${a.sessions} session${a.sessions === 1 ? '' : 's'}`, accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'repeat', label: 'Habit check-ins', value: a.checkins,
          meta: 'logged up to that day', accent: 'var(--good)' })}
        ${Widgets.statTile({ icon: 'wallet', label: 'Net by then',
          value: Derive.money(a.net), meta: `${Derive.money(a.spent)} out`,
          accent: a.net >= 0 ? 'var(--good)' : 'var(--bad)' })}`;
    },

    _dayHtml(m) {
      const d = m.dayDetail;
      if (d.quiet) {
        return `<section class="card">
          <div class="card-head"><div><div class="card-title">That day</div>
            <div class="card-sub">${esc(d.label)}</div></div></div>
          <div class="empty" style="padding:var(--sp-5) 0">
            <div class="empty-ic">${icon('clock', 22)}</div>
            <h4>Nothing was recorded on ${esc(d.short)}</h4>
            <p>The log, the focus sessions and the ledger are all empty for that day.
               The workspace does not invent one.</p>
          </div></section>`;
      }
      const bits = [`${d.entries.length} change${d.entries.length === 1 ? '' : 's'}`];
      if (d.done.length) bits.push(`${d.done.length} task${d.done.length === 1 ? '' : 's'} completed`);
      if (d.focusMin) bits.push(`${d.focusMin} min focused`);
      if (d.spent) bits.push(`${Derive.money(d.spent)} spent`);
      if (d.earned) bits.push(`${Derive.money(d.earned)} in`);
      return `<section class="card">
        <div class="card-head"><div><div class="card-title">That day</div>
          <div class="card-sub">${esc(d.label)} · ${esc(bits.join(' · '))}</div></div></div>
        <div class="tm-rows">
          ${d.entries.map(a => {
            const k = activityKind(a.kind);
            return `<div class="tm-row">
              <span class="tm-ic" style="color:${k.color}">${icon(k.icon, 12)}</span>
              <span class="tm-text">${esc(a.text)}</span>
              <span class="tm-at">${esc(Derive.activityTime(a))}</span>
            </div>`;
          }).join('')}
          ${d.entries.length ? '' : '<p class="t-faint t-sm" style="margin:0">The log itself is empty for that day, though other records carry its date.</p>'}
        </div>
      </section>`;
    },

    _sinceHtml(m) {
      const s = m.since;
      if (!s.days) {
        return `<section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div><div class="card-title">Since then</div>
            <div class="card-sub">this is today — there is nothing after it yet</div></div></div>
        </section>`;
      }
      const rows = [
        ['Tasks completed', `${s.tasksDone > 0 ? '+' : ''}${s.tasksDone}`, s.tasksDone],
        ['Focus minutes', `${s.focusMin > 0 ? '+' : ''}${s.focusMin}`, s.focusMin],
        ['Habit check-ins', `${s.checkins > 0 ? '+' : ''}${s.checkins}`, s.checkins],
        ['Money spent', `${s.spent > 0 ? '+' : ''}${Derive.money(s.spent)}`, -s.spent],
        ['Net', `${s.net > 0 ? '+' : ''}${Derive.money(s.net)}`, s.net],
        ['Changes logged', `${s.activity > 0 ? '+' : ''}${s.activity}`, s.activity],
      ];
      return `<section class="card" style="margin-top:var(--sp-3)">
        <div class="card-head"><div><div class="card-title">Since then</div>
          <div class="card-sub">what the workspace gained in the ${s.days} day${s.days === 1 ? '' : 's'} after ${esc(m.dayDetail.short)}</div></div></div>
        <div class="tm-sinces">
          ${rows.map(([label, text, tone]) => `
            <div class="tm-since">
              <span class="tm-sincekey">${esc(label)}</span>
              <span class="tm-sinceval" style="color:${tone > 0 ? 'var(--good)' : tone < 0 ? 'var(--bad)' : 'var(--text-3)'}">${esc(text)}</span>
            </div>`).join('')}
        </div>
        <p class="t-faint t-sm" style="margin:var(--sp-4) 0 0">
          Both ends of this comparison are folded from the same records, so it is exactly
          what the workspace gained — not an estimate.
        </p>
      </section>`;
    },

    _asideHtml(m) {
      const w = m.window;
      const a = m.asOf;
      return `
        <div class="card">
          <div class="card-head"><div><div class="card-title">The window</div>
            <div class="card-sub">every day the workspace has a record for</div></div></div>
          <div class="fl-facts">
            <div class="fl-fact"><span class="fl-factk">First day</span>
              <span class="fl-factv" style="color:var(--text-1)">${esc(Derive.shortDay(w.first))}</span></div>
            <div class="fl-fact"><span class="fl-factk">Days</span>
              <span class="fl-factv" style="color:var(--text-1)">${w.span}</span></div>
          </div>
          <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            The earliest date any record mentions is ${esc(Derive.longDay(w.first))}. Before
            that there is nothing to show, and the machine says so.
          </p>
        </div>
        <div class="card">
          <div class="card-head"><div><div class="card-title">Also true that day</div></div></div>
          <div class="fl-facts">
            <div class="fl-fact"><span class="fl-factk">Journal</span>
              <span class="fl-factv" style="color:var(--text-1)">${a.journal}</span></div>
            <div class="fl-fact"><span class="fl-factk">Files</span>
              <span class="fl-factv" style="color:var(--text-1)">${a.files}</span></div>
            <div class="fl-fact"><span class="fl-factk">Reviews</span>
              <span class="fl-factv" style="color:var(--text-1)">${a.reviews}</span></div>
            <div class="fl-fact"><span class="fl-factk">Log entries</span>
              <span class="fl-factv" style="color:var(--text-1)">${a.activity}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">What this reads</div></div>
          <p class="t-faint t-sm" style="margin:0">
            Tasks, focus sessions, habits, the journal, the ledger, the activity log, files
            and reviews — each cut at the day you are viewing. A record counts as "then" only
            if its own date is on or before that day, so nothing here is a projection.
          </p>
        </div>`;
    },

    /* The scrubber is a live control, so it lives OUTSIDE every region this
       repaints — replacing a range input mid-drag would break the drag. */
    repaint() {
      const root = this._root;
      if (!root) return;
      const m = Derive.timeMachine(this.day);
      const head = $('#tm-head', root), tiles = $('#tm-tiles', root),
            day = $('#tm-day', root), since = $('#tm-since', root),
            side = $('#tm-side', root), sub = $('#tm-sub', root),
            range = $('#tm-range', root);
      if (head) head.innerHTML = this._headHtml(m);
      if (tiles) tiles.innerHTML = this._tilesHtml(m);
      if (day) day.innerHTML = this._dayHtml(m);
      if (since) since.innerHTML = this._sinceHtml(m);
      if (side) side.innerHTML = this._asideHtml(m);
      if (sub) sub.textContent = this._summaryLine(m);
      if (range && Number(range.value) !== m.index) range.value = String(m.index);
      Shell.setHeader('Time Machine', Derive.longDay(m.day));
    },
    _go(delta) {
      const m = Derive.timeMachine(this.day);
      const next = m.index + delta;
      if (next < 0 || next >= m.days.length) return;
      this.day = m.days[next];
      this.repaint();
    },

    bind(root) {
      const range = $('#tm-range', root);
      if (range) range.addEventListener('input', () => {
        const m = Derive.timeMachine(this.day);
        const i = Math.max(0, Math.min(m.days.length - 1, Number(range.value) || 0));
        this.day = m.days[i];
        this.repaint();
      });
      root.addEventListener('click', e => {
        const nav = e.target.closest('[data-tm-nav]');
        if (nav) { this._go(Number(nav.dataset.tmNav)); return; }
        if (e.target.closest('[data-tm-now]')) {
          this.day = Derive.timeWindow().today;
          this.repaint();
        }
      });
    },
  };

  /* ======================================================================
     NEXUS PRO — Milestone 33, rebuilt as a PRICING PAGE — Milestone 46
     ======================================================================
     M33 built this page as a feature list with one switch at the bottom. That
     answered "what does Pro add?" and never answered the question a person
     actually arrives with, which is *"what does it cost, and how do I get it?"*
     The workspace switcher made that concrete: it says "Multiple workspaces are
     a NEXUS Pro feature" and then there is nowhere to go — the sentence names a
     thing you cannot buy.

     So the page is now the pricing surface itself, and it holds to the same four
     rules the rest of the app does:

     1. **A price is data, a comparison is derived.** `PLANS` holds three prices;
        every other number on this page — the saving, the monthly equivalent, the
        renewal date, the day count — is computed from them. Nothing is stored, so
        changing a price cannot leave a stale percentage behind it.
     2. **The comparison table cannot lie about the gate.** Its rows come from
        `FEATURES` plus the live `FeatureAccess.allows()`, so a row and the thing
        it describes are the same fact read twice, not two facts kept in step.
     3. **Nothing is sold that does not exist.** There is a row for cloud sync,
        and it is marked "Planned" on both columns, because the honest version of
        a roadmap is a roadmap, not a checkmark.
     4. **It says what it is.** One line, near the price, not in a footnote: this
        is a local licence with no payment, no account and no server. The switch
        really works and it really can be undone.

     The gate itself is untouched. `allows()` still ignores its key, because there
     is still exactly one thing to be — three prices are three ways to pay for the
     same one, which is why `billing` is a period and not a tier.
     ====================================================================== */
  const ProPage = {
    /* Which plan the page is currently offering. A VISUAL state (which card is
       highlighted, what the confirm overlay will say) and deliberately not the
       entitlement — `State.billing` is what the licence actually is. Selecting a
       card and owning a plan are different facts, and this is the one that can be
       thrown away by navigating off the page. */
    pick: 'yearly',

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'pro') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Checking the licence…</p></div></div></div>';
        return;
      }
      const pro = State.isPro;
      const e = State.entitlement;
      const cards = Derive.planCards();
      const cmp = Derive.planCompare();
      const renews = Derive.planRenews();
      const left = Derive.planDaysLeft();
      const page = el('div', { class: 'page is-active', html: `
        <div class="price-hero">
          <div class="price-hero-in">
            <div class="t-eyebrow">Pricing</div>
            <h1 class="price-h1">${pro ? 'You are on NEXUS Pro' : 'One price. Everything included.'}</h1>
            <p class="price-lede">${pro
              ? `Every feature below is unlocked on this device. ${renews
                  ? `Renews ${esc(fmtDate(renews))}${left != null ? ` · ${left} day${left === 1 ? '' : 's'} left` : ''}.`
                  : 'This licence has no expiry.'}`
              : 'The whole app is free — every core module, every record, no limit. Pro adds the four things that work across your whole workspace.'}</p>
            <div class="price-switch" role="group" aria-label="Billing period">
              <button class="price-sw-btn ${this.pick === 'monthly' ? 'is-on' : ''}" data-bill="monthly">
                Monthly</button>
              <button class="price-sw-btn ${this.pick === 'yearly' ? 'is-on' : ''}" data-bill="yearly">
                Yearly ${cmp.saving ? `<span class="price-save">Save ${Math.round(cmp.saving * 100)}%</span>` : ''}</button>
            </div>
          </div>
        </div>

        <div class="price-grid" style="margin-top:var(--sp-5)">
          ${cards.map(c => this._cardHtml(c, cmp)).join('')}
        </div>

        <p class="price-fine">Prices are shown in USD. This build has no payment processor and
          no account — choosing a plan activates a real licence on this device. You can change it
          or undo it at any time.</p>

        <section class="card price-cmp-card">
          <div class="card-head">
            <div><div class="card-title">What you get</div>
              <div class="card-sub">Read live from the same gate the app uses, not copied from a brochure.</div></div>
            <span class="badge">${cmp.rows.filter(r => !r.planned).length} Pro features</span>
          </div>
          <div class="price-cmp">
            <table class="price-table">
              <thead><tr>
                <th scope="col" class="price-th-l">Feature</th>
                <th scope="col" class="price-th-c">Free</th>
                <th scope="col" class="price-th-c is-pro">Pro</th>
              </tr></thead>
              <tbody>
                ${cmp.free.map(f => `<tr>
                  <th scope="row" class="price-td-l">${esc(f)}</th>
                  <td class="price-td-c">${this._mark(true)}</td>
                  <td class="price-td-c is-pro">${this._mark(true)}</td>
                </tr>`).join('')}
                ${cmp.rows.map(r => `<tr>
                  <th scope="row" class="price-td-l">
                    <span class="price-feat-n">${esc(r.label)}</span>
                    ${r.planned ? '<span class="price-soon">Planned</span>' : ''}
                    <span class="price-feat-b">${esc(r.blurb || '')}</span>
                  </th>
                  <td class="price-td-c">${r.planned ? '<span class="price-dash">—</span>' : this._mark(false)}</td>
                  <td class="price-td-c is-pro">${r.planned ? '<span class="price-dash">—</span>' : this._mark(r.unlocked)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </section>

        ${pro ? this._manageHtml(e, renews, left) : ''}

        <section class="card price-faq">
          <div class="card-head"><div class="card-title">Questions</div></div>
          ${PRICING_FAQ.map(q => `<div class="price-q">
            <b>${esc(q.q)}</b><p>${esc(q.a)}</p></div>`).join('')}
        </section>

        <section class="card price-note">
          <div class="price-note-ic">${icon('sparkles', 16)}</div>
          <div>
            <b>This is a local licence, and it is honest about that.</b>
            <p>There is no payment, no account and no server. The licence is a record stored on
              this device with the rest of your workspace — it really changes what the app will
              let you do, it survives a reload, and it can be undone with one click. Nothing
              here sends anything anywhere.</p>
          </div>
        </section>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      Shell.setHeader('Pricing', pro ? `NEXUS Pro · ${planMeta(e.billing).cadence}` : 'NEXUS Free');
    },

    /* A tick or a dash for one cell. One function, so the two columns cannot
       develop different ideas of what "included" looks like. */
    _mark(on) {
      return on
        ? `<span class="price-yes" aria-label="Included">${icon('check', 14)}</span>`
        : `<span class="price-no" aria-label="Not included">${icon('x', 12)}</span>`;
    },

    _cardHtml(c, cmp) {
      const isFree = c.price <= 0;
      /* Which card is being CONSIDERED. A Pro user still browsing periods sees
         their current one marked, and the highlighted card follows `pick` — the
         two are separate, and saying so on the card avoids a highlighted card
         that looks like it was already bought. */
      const picked = this.pick === c.key;
      const perMonth = c.key === 'yearly' && cmp.perMonth ? cmp.perMonth : null;
      return `<section class="card price-plan ${c.best ? 'is-best' : ''} ${picked && !isFree ? 'is-picked' : ''} ${c.current ? 'is-current' : ''}">
        ${c.best ? '<div class="price-ribbon">Best value</div>' : ''}
        <div class="price-plan-top">
          <div class="price-plan-name">${esc(c.label)}</div>
          ${c.current ? '<span class="badge badge-pro">✦ Current</span>' : ''}
        </div>
        <div class="price-plan-sub">${esc(c.tagline)}</div>
        <div class="price-amount">
          ${isFree ? '<span class="price-num">Free</span>'
                   : `<span class="price-cur">$</span><span class="price-num">${c.price}</span>`}
          ${c.cadence ? `<span class="price-cad">${esc(c.cadence)}</span>` : ''}
        </div>
        <div class="price-plan-note">${perMonth
          ? `That is $${perMonth.toFixed(2)} a month. ${esc(c.note)}`
          : esc(c.note)}</div>
        <button class="btn ${isFree ? 'btn-ghost' : 'btn-primary'} btn-sm price-cta"
          ${isFree && c.current ? 'disabled' : ''}
          data-pick="${c.key}">
          ${isFree ? (c.current ? 'Your current plan' : 'Stay on Free')
                   : (c.current ? 'Switch to this' : esc(c.cta))}
        </button>
        <div class="price-plan-list">
          ${(isFree ? FREE_INCLUDES.slice(0, 5) : [
            'Everything in Free',
            ...FEATURES.map(f => f.label),
            'Multiple workspaces',
          ]).map(x => `<div class="price-plan-li">${this._mark(true)}<span>${esc(x)}</span></div>`).join('')}
        </div>
      </section>`;
    },

    _manageHtml(e, renews, left) {
      const plan = planMeta(e.billing);
      return `<section class="card price-manage" style="margin-top:var(--sp-3)">
        <div class="card-head">
          <div><div class="card-title">Your licence</div>
            <div class="card-sub">Stored on this device · ${esc(e.source || 'local')}</div></div>
          <span class="badge badge-pro">✦ PRO</span>
        </div>
        <div class="fl-facts">
          <div class="fl-fact"><span class="fl-factk">Plan</span>
            <span class="fl-factv" style="color:var(--text-1)">NEXUS ${esc(plan.label)}</span></div>
          <div class="fl-fact"><span class="fl-factk">Billing</span>
            <span class="fl-factv" style="color:var(--text-1)">$${plan.price} ${esc(plan.cadence)}</span></div>
          <div class="fl-fact"><span class="fl-factk">Started</span>
            <span class="fl-factv" style="color:var(--text-1)">${e.startDate ? esc(fmtDate(new Date(e.startDate))) : '—'}</span></div>
          <div class="fl-fact"><span class="fl-factk">${renews ? 'Renews' : 'Expires'}</span>
            <span class="fl-factv" style="color:var(--text-1)">${renews ? esc(fmtDate(renews)) : 'Never'}</span></div>
        </div>
        ${renews && left != null ? `<div class="price-meter" role="img"
          aria-label="${left} of ${plan.days} days left in this period">
          <span style="width:${Math.max(2, Math.min(100, (left / plan.days) * 100)).toFixed(1)}%"></span>
        </div>
        <p class="t-faint t-sm" style="margin:0 0 var(--sp-3)">${left} day${left === 1 ? '' : 's'} left in this period.</p>` : ''}
        <div class="row gap-2" style="flex-wrap:wrap">
          ${e.billing === 'monthly'
            ? `<button class="btn btn-ghost btn-sm" data-switch="yearly">${icon('arrowR', 13)} Switch to yearly</button>`
            : `<button class="btn btn-ghost btn-sm" data-switch="monthly">${icon('arrowR', 13)} Switch to monthly</button>`}
          ${e.licenseId ? `<span class="price-lic">${esc(e.licenseId)}</span>` : ''}
          <button class="btn btn-ghost btn-sm" data-cancel>${icon('reset', 13)} Cancel Pro</button>
        </div>
      </section>`;
    },

    bind(root) {
      root.addEventListener('click', ev => {
        const pick = ev.target.closest('[data-pick]');
        if (pick) return this.choosePlan(pick.dataset.pick);

        const bill = ev.target.closest('[data-bill]');
        if (bill) {
          this.pick = bill.dataset.bill;
          this.render();
          return;
        }
        const open = ev.target.closest('[data-pro-open]');
        if (open) return Router.go(open.dataset.proOpen);

        if (ev.target.closest('[data-switch]')) {
          const to = ev.target.closest('[data-switch]').dataset.switch;
          return this.confirmSwitch(to);
        }
        if (ev.target.closest('[data-cancel]')) return this.confirmCancel();
      });
    },

    /* Selecting a card. Free is not an upgrade — it is a reversion, and it goes
       through the cancel path so a person who clicks the Free card gets the same
       confirmation as a person who clicks Cancel, rather than a silent downgrade. */
    choosePlan(key) {
      const plan = PLANS[key];
      if (!plan) return;
      if (State.billing === key) {
        Toast.show(key === 'free' ? 'You are already on the free plan' : 'That is your current plan', 'default');
        return;
      }
      if (plan.price <= 0) return this.confirmCancel();
      this.pick = key;
      this.confirmUpgrade(key);
    },

    /* The confirm step. A price is a commitment, so it is stated back before it
       is made — plan, price, period, and what happens next, with the honest
       no-payment line on the same screen as the button. */
    confirmUpgrade(key) {
      const plan = PLANS[key];
      const monthly = key === 'monthly';
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Confirm</div>
            <h2 class="t-h2" style="margin-top:6px">Take NEXUS Pro</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="price-confirm">
          <div class="price-confirm-row"><span>Plan</span><b>NEXUS Pro</b></div>
          <div class="price-confirm-row"><span>Billing</span><b>${esc(plan.tagline)}</b></div>
          <div class="price-confirm-row"><span>Price</span><b>$${plan.price} ${esc(plan.cadence)}</b></div>
          <div class="price-confirm-row"><span>Access</span><b>All ${FEATURES.length + 1} Pro features, immediately</b></div>
        </div>
        <p class="t-sm t-muted" style="margin:var(--sp-4) 0 0">
          No card is taken and no account is created — this activates a licence on
          this device, the same way the rest of your workspace is stored. You can
          cancel at any time and nothing is lost.
        </p>
        <div class="row gap-2" style="margin-top:var(--sp-5);justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" data-close>Not now</button>
          <button class="btn btn-primary btn-sm" data-do-upgrade>
            ${icon('sparkles', 13)} Activate NEXUS Pro</button>
        </div>
      `);
      wrap.addEventListener('click', ev => {
        if (ev.target.closest('[data-close]')) return Overlay.close();
        if (ev.target.closest('[data-do-upgrade]')) {
          const res = State.activatePro(key);
          Overlay.close();
          if (res) {
            Toast.show(`NEXUS Pro active · ${PLANS[key].tagline.toLowerCase()}`, 'good');
            this.pick = key;
            this.render();
          }
        }
      });
      /* Focus the confirming button so the keyboard path lands on the decision
         rather than on the close control. */
      const go = $('[data-do-upgrade]', wrap);
      if (go) go.focus();
      void monthly;
    },

    confirmSwitch(to) {
      const plan = PLANS[to];
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div><div class="t-eyebrow">Change billing</div>
            <h2 class="t-h2" style="margin-top:6px">Switch to ${esc(plan.tagline)}</h2></div>
          <button class="iconbtn" data-close aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="t-sm t-muted">Your licence stays the same — same device, same id, same start date.
          Only the period changes, so a new one begins today at <b>$${plan.price} ${esc(plan.cadence)}</b>.</p>
        <div class="row gap-2" style="margin-top:var(--sp-5);justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" data-close>Cancel</button>
          <button class="btn btn-primary btn-sm" data-do-switch>Switch to ${esc(plan.key)}</button>
        </div>
      `);
      wrap.addEventListener('click', ev => {
        if (ev.target.closest('[data-close]')) return Overlay.close();
        if (ev.target.closest('[data-do-switch]')) {
          State.switchBilling(to);
          Overlay.close();
          Toast.show(`Billing switched to ${plan.tagline.toLowerCase()}`, 'good');
          this.pick = to;
          this.render();
        }
      });
    },

    confirmCancel() {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div><div class="t-eyebrow">Cancel</div>
            <h2 class="t-h2" style="margin-top:6px">Return to NEXUS Free?</h2></div>
        </div>
        <p class="t-sm t-muted">The four Pro features lock again — Time Machine, Premium themes,
          Automation and Templates. <b>Nothing else changes:</b> every task, note, project and
          record you made stays exactly where it is, and the free tier keeps every core module.</p>
        <div class="row gap-2" style="margin-top:var(--sp-5);justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" data-close>Keep Pro</button>
          <button class="btn btn-danger btn-sm" data-do-cancel>Return to Free</button>
        </div>
      `);
      wrap.addEventListener('click', ev => {
        if (ev.target.closest('[data-close]')) return Overlay.close();
        if (ev.target.closest('[data-do-cancel]')) {
          State.revertToFree();
          Overlay.close();
          Toast.show('Back on NEXUS Free — your records are untouched', 'default');
          this.pick = 'yearly';
          this.render();
        }
      });
    },
  };

  /* ======================================================================
     AUTOMATION — Milestone 35
     A reading of the fold. Every rule, what it is waiting to make, and what it
     has already made. Nothing on this page is stored: the ledger under each rule
     is the INVERSE of the `origin` stamp on the records themselves, so a record
     deleted by hand simply stops appearing, and nothing has to be kept in sync.
     ====================================================================== */
  const AutomationPage = {
    _root: null,

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'automation') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty">' +
          '<div class="spinner"></div><p style="margin-top:12px">Winding the rules…</p>' +
          '</div></div></div>';
        return;
      }
      /* The gate. A page that exists but cannot be used has to say why, and point
         at the one place that changes the answer. */
      if (!FeatureAccess.allows('automation')) { renderLocked(mount, 'automation'); return; }

      const s = Derive.automationSummary();
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Runs itself</div>
            <h1>Automation</h1>
            <div class="sub">${esc(this._summaryLine(s))}</div>
          </div>
          <div class="row gap-2">
            <span class="badge badge-pro">✦ PRO</span>
            ${s.waiting ? `<button class="btn btn-ghost btn-sm" id="au-runall">
              ${icon('play', 12)} Run ${s.waiting} waiting</button>` : ''}
            <button class="btn btn-primary btn-sm" id="au-new">${icon('plus', 14)} New rule</button>
          </div>
        </div>

        <div class="proj-stats" id="au-tiles" style="margin-top:var(--sp-4)">${this._tiles(s)}</div>
        <div id="au-list" style="margin-top:var(--sp-4)">${this._listHtml(s)}</div>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">How this works</div>
            <div class="card-sub">No background service · no account · no server</div>
          </div></div>
          <p class="t-faint t-sm" style="margin:0">
            A rule runs the next time you open NEXUS, and it makes up every occurrence you
            missed while the app was closed — up to ${AUTOMATION_CATCHUP} in one go, so a long
            absence cannot flood the workspace with work you did not ask for. Anything an
            automated rule makes is an ordinary record: it counts toward its project, moves
            the NEXUS Score, and turns up in search.
          </p>
        </section>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      Shell.setHeader('Automation', s.total ? `${s.enabled} of ${s.total} active` : 'No rules yet');
    },

    _ago(day) {
      const n = Math.round(
        (new Date(todayKey() + 'T12:00:00') - new Date(day + 'T12:00:00')) / 86400000);
      if (n <= 0) return 'today';
      if (n === 1) return 'yesterday';
      if (n < 14) return n + ' days ago';
      return Math.round(n / 7) + ' weeks ago';
    },

    _summaryLine(s) {
      if (!s.total) return 'No rules yet — write one and it will run itself.';
      const bits = [`${s.enabled} of ${s.total} switched on`];
      bits.push(s.waiting ? `${s.waiting} waiting to run` : 'nothing waiting');
      if (s.produced) bits.push(`${s.produced} record${s.produced === 1 ? '' : 's'} made so far`);
      return bits.join(' · ');
    },

    _tiles(s) {
      const last = s.lastRun;
      return `
        ${Widgets.statTile({ icon: 'bolt', label: 'Rules', value: s.total,
          meta: `${s.enabled} switched on`, accent: 'var(--warn)' })}
        ${Widgets.statTile({ icon: 'clock', label: 'Waiting now', value: s.waiting,
          meta: s.waiting ? 'made on the next run' : 'nothing due',
          accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'check', label: 'Records made', value: s.produced,
          meta: 'still in the workspace', accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'pulse', label: 'Last run',
          value: last ? Derive.shortDay(last) : '—',
          meta: last ? this._ago(last) : 'no rule has run yet',
          accent: 'var(--violet)' })}`;
    },

    _listHtml(s) {
      if (!s.total) {
        return `<section class="card"><div class="empty">
          <div class="empty-ic">${icon('bolt', 22)}</div>
          <h4>No rules yet</h4>
          <p>A rule is a schedule plus something to make — recurring work, a standing
             capture, a note that writes itself. Write one and it will run without
             being asked.</p>
          <button class="btn btn-primary btn-sm" data-au-new style="margin-top:var(--sp-3)">
            ${icon('plus', 13)} Write the first rule</button>
        </div></section>`;
      }
      return s.rows.map(row => this._ruleHtml(row)).join('');
    },

    _ruleHtml(row) {
      const r = row.rule;
      const made = row.produced;
      const status = !r.enabled ? 'Switched off'
        : row.pending.length ? `${row.pending.length} waiting`
        : row.next ? `Next ${Derive.shortDay(row.next)}` : 'Nothing scheduled';
      const outIcon = t => (t === 'task' ? 'check' : t === 'note' ? 'note' : 'inbox');
      return `
        <section class="card au-rule ${r.enabled ? '' : 'is-off'}">
          <div class="card-head">
            <div class="au-rule-id">
              <span class="au-rule-ic">${icon('bolt', 16)}</span>
              <div>
                <div class="card-title">${esc(r.name)}</div>
                <div class="card-sub">${esc(Derive.automationSchedule(r))} · ${esc(Derive.automationAct(r))}</div>
              </div>
            </div>
            <div class="row gap-2">
              <button class="chip ${r.enabled ? 'is-on' : ''}" data-au-toggle="${esc(r.id)}"
                aria-pressed="${r.enabled}">${r.enabled ? 'On' : 'Off'}</button>
              <button class="btn btn-ghost btn-sm" data-au-run="${esc(r.id)}" ${r.enabled ? '' : 'disabled'}>
                ${icon('play', 12)} Run now</button>
              <button class="btn btn-ghost btn-sm" data-au-edit="${esc(r.id)}">
                ${icon('edit', 12)} Edit</button>
            </div>
          </div>
          <div class="au-meta">
            <span class="au-pill ${row.pending.length && r.enabled ? 'is-due' : ''}">${esc(status)}</span>
            <span class="t-faint t-sm">${r.lastRun ? 'Last ran ' + esc(this._ago(r.lastRun)) : 'Never run'}</span>
            <span class="t-faint t-sm">${made.length} record${made.length === 1 ? '' : 's'} made</span>
          </div>
          ${made.length ? `<div class="au-out">
            ${made.slice(0, 6).map(m => `
              <button class="au-out-row" data-au-open="${esc(m.type)}:${esc(m.id)}">
                <span class="au-out-ic">${icon(outIcon(m.type), 12)}</span>
                <span class="au-out-t">${esc(m.title)}</span>
                <span class="au-out-d">${esc(Derive.shortDay(m.day))}</span>
              </button>`).join('')}
            ${made.length > 6 ? `<div class="t-faint t-sm" style="padding:6px 2px">+ ${made.length - 6} more</div>` : ''}
          </div>` : `<p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
            Nothing yet. Its first record appears the next time it runs.</p>`}
        </section>`;
    },

    bind(root) {
      const fresh = $('#au-new', root);
      if (fresh) fresh.addEventListener('click', () => this.openEditor(null));
      const all = $('#au-runall', root);
      if (all) all.addEventListener('click', () => {
        const out = State.runDueAutomations();
        Toast.show(out.created
          ? `${out.created} record${out.created === 1 ? '' : 's'} made by ${out.rules} rule${out.rules === 1 ? '' : 's'}`
          : 'Nothing to make up', out.created ? 'good' : 'default');
        this.render();
      });

      root.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);

        if (hit('[data-au-new]')) { this.openEditor(null); return; }

        const run = hit('[data-au-run]');
        if (run) {
          const r = State.automationById(run.dataset.auRun);
          /* `force` is what "Run now" means: bring the rule up to date right now
             rather than waiting for the clock. Without it a rule scheduled for
             21:00 would refuse to do anything at noon. */
          const out = State.runAutomation(run.dataset.auRun, { force: true });
          Toast.show(out.created
            ? `“${r.name}” made ${out.created} record${out.created === 1 ? '' : 's'}` +
              (out.skipped ? ` · skipped ${out.skipped} older` : '')
            : 'Already up to date — nothing to make up',
            out.created ? 'good' : 'default');
          this.render();
          return;
        }

        const tgl = hit('[data-au-toggle]');
        if (tgl) {
          const r = State.toggleAutomation(tgl.dataset.auToggle);
          Toast.show(r.enabled ? `“${r.name}” switched on` : `“${r.name}” switched off`, 'default');
          this.render();
          return;
        }

        const edit = hit('[data-au-edit]');
        if (edit) { this.openEditor(edit.dataset.auEdit); return; }

        const del = hit('[data-au-del]');
        if (del) { this.confirmDelete(del.dataset.auDel); return; }

        const open = hit('[data-au-open]');
        if (open) {
          const parts = open.dataset.auOpen.split(':');
          revealRecord(parts[0], parts.slice(1).join(':'));
        }
      });
    },

    /* The rule editor. `draft` is the working copy: every repaint collects what is
       on screen first, so switching cadence or action never discards typing. */
    openEditor(id) {
      const editing = !!id;
      const src = editing ? State.automationById(id) : null;
      if (editing && !src) return;
      const draft = {
        name: src ? src.name : '',
        every: src ? src.trigger.every : 'weekday',
        dow: src ? src.trigger.dow : 1,
        dom: src ? src.trigger.dom : 1,
        at: src ? src.trigger.at : '08:00',
        type: src ? src.action.type : 'task',
        title: src && src.action.title ? src.action.title : '',
        text: src && src.action.text ? src.action.text : '',
        body: src && src.action.body ? src.action.body : '',
        project: src && src.action.project ? src.action.project : 'Personal',
        priority: src && src.action.priority ? src.action.priority : 'Medium',
        dueIn: src && typeof src.action.dueIn === 'number' ? src.action.dueIn : 0,
      };
      const wrap = Overlay.open('', { cls: 'modal-md' });
      const paint = () => { wrap.innerHTML = this._editorHtml(editing, draft); };
      const collect = () => {
        const v = sel => { const n = $(sel, wrap); return n ? n.value : null; };
        const set = (key, sel, cast) => { const x = v(sel); if (x !== null) draft[key] = cast ? cast(x) : x; };
        set('name', '#au-name'); set('at', '#au-at');
        set('dow', '#au-dow', Number); set('dom', '#au-dom', Number);
        set('title', '#au-title'); set('text', '#au-text'); set('body', '#au-body');
        set('project', '#au-project'); set('priority', '#au-prio');
        set('dueIn', '#au-duein', Number);
      };

      wrap.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);
        const cad = hit('[data-au-cad]');
        if (cad) { collect(); draft.every = cad.dataset.auCad; paint(); return; }
        const act = hit('[data-au-act]');
        if (act) { collect(); draft.type = act.dataset.auAct; paint(); return; }
        if (hit('[data-au-save]')) {
          collect();
          if (!draft.name.trim()) { Toast.show('Give the rule a name', 'warn'); return; }
          const trigger = { every: draft.every, dow: draft.dow, dom: draft.dom, at: draft.at };
          const action = draft.type === 'task'
            ? { type: 'task', title: draft.title, project: draft.project,
                priority: draft.priority, dueIn: draft.dueIn }
            : draft.type === 'capture'
            ? { type: 'capture', text: draft.text }
            : { type: 'note', title: draft.title, body: draft.body };
          if (editing) {
            State.updateAutomation(id, { name: draft.name, trigger, action });
            Toast.show('Rule updated', 'good');
          } else {
            State.addAutomation({ name: draft.name, trigger, action });
            Toast.show('Rule created — it runs the next time you open NEXUS', 'good');
          }
          Overlay.close();
          this.render();
          return;
        }
        if (hit('[data-au-del]')) { Overlay.close(); this.confirmDelete(id); }
      });
      paint();
    },

    _editorHtml(editing, d) {
      const field = (label, id, value, extra = '') => `
        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="${id}">${label}</label>
          <input class="field" id="${id}" value="${esc(value)}" ${extra}>
        </div>`;
      return `
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Automation</div>
            <h2 class="t-h2" style="margin-top:6px">${editing ? 'Edit this rule' : 'Write a rule'}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>

        ${field('Name', 'au-name', d.name, 'maxlength="80" placeholder="Morning plan"')}

        <div class="field-group" style="margin-top:var(--sp-3)">
          <span class="field-label">When</span>
          <div class="viewtabs" role="group" aria-label="Cadence">
            ${AUTOMATION_TRIGGERS.map(t => `
              <button type="button" class="viewtab ${d.every === t.key ? 'is-active' : ''}"
                data-au-cad="${t.key}">${t.label}</button>`).join('')}
          </div>
        </div>

        ${d.every === 'week' ? `
          <div class="field-group" style="margin-top:var(--sp-3)">
            <label class="field-label" for="au-dow">On</label>
            <select class="field" id="au-dow">
              ${DOW_FULL.map((n, i) => `<option value="${i + 1}" ${d.dow === i + 1 ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>` : ''}

        ${d.every === 'month' ? `
          <div class="field-group" style="margin-top:var(--sp-3)">
            <label class="field-label" for="au-dom">On day</label>
            <select class="field" id="au-dom">
              ${Array.from({ length: 28 }, (_, i) => i + 1)
                .map(n => `<option value="${n}" ${d.dom === n ? 'selected' : ''}>${ordinal(n)}</option>`).join('')}
            </select>
          </div>` : ''}

        ${field('At', 'au-at', d.at, 'type="time"')}

        <div class="field-group" style="margin-top:var(--sp-3)">
          <span class="field-label">Then</span>
          <div class="viewtabs" role="group" aria-label="Action">
            ${AUTOMATION_ACTIONS.map(a => `
              <button type="button" class="viewtab ${d.type === a.key ? 'is-active' : ''}"
                data-au-act="${a.key}">${icon(a.icon, 13)} ${a.label}</button>`).join('')}
          </div>
        </div>

        ${d.type === 'task' ? `
          ${field('Task', 'au-title', d.title, 'maxlength="140" placeholder="Plan the day"')}
          ${field('Project', 'au-project', d.project, 'maxlength="60" placeholder="Personal"')}
          <div class="field-group" style="margin-top:var(--sp-3)">
            <label class="field-label" for="au-prio">Priority</label>
            <select class="field" id="au-prio">
              ${PRIORITIES.map(p => `<option ${d.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
          <div class="field-group" style="margin-top:var(--sp-3)">
            <label class="field-label" for="au-duein">Due</label>
            <select class="field" id="au-duein">
              ${[0, 1, 2, 3, 7, 14].map(n => `<option value="${n}" ${d.dueIn === n ? 'selected' : ''}>${
                n === 0 ? 'On the day it runs' : n === 1 ? 'The next day' : `${n} days later`}</option>`).join('')}
            </select>
          </div>`
        : d.type === 'capture' ? `
          ${field('Capture', 'au-text', d.text, 'maxlength="2000" placeholder="Write the weekly review for {date}"')}`
        : `
          ${field('Note title', 'au-title', d.title, 'maxlength="140" placeholder="Monthly reset — {date}"')}
          <div class="field-group" style="margin-top:var(--sp-3)">
            <label class="field-label" for="au-body">Note body</label>
            <textarea class="textarea" id="au-body" rows="4" maxlength="4000">${esc(d.body)}</textarea>
          </div>`}

        <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
          <b>{date}</b> becomes the day the rule runs, so a recurring record is never an
          unidentifiable twin of the last one.
        </p>

        <div class="modal-actions">
          ${editing ? `<button class="btn btn-ghost btn-sm" data-au-del
            style="margin-right:auto;color:var(--bad)">${icon('trash', 13)} Delete</button>` : ''}
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" data-au-save>${editing ? 'Save changes' : 'Create rule'}</button>
        </div>`;
    },

    confirmDelete(id) {
      const r = State.automationById(id);
      if (!r) return;
      const made = Derive.automationOutput(r).length;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete rule</div>
            <h2 class="t-h2" style="margin-top:6px">Delete “${esc(r.name)}”?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          The rule stops running. ${made
            ? `The ${made} record${made === 1 ? '' : 's'} it already made stay exactly where they
               are — deleting a rule never deletes your work.`
            : 'It has not made anything yet.'}
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" data-au-del-yes>Delete the rule</button>
        </div>`, { cls: 'modal-sm' });
      wrap.addEventListener('click', e => {
        if (!e.target.closest('[data-au-del-yes]')) return;
        State.deleteAutomation(id);
        Toast.show('Rule deleted', 'default');
        Overlay.close();
        this.render();
      });
    },
  };

  /* ======================================================================
     TEMPLATES — Milestone 37
     A reading of the shape. Every template, what it would make, and the holes it
     still needs filled before it can. Nothing on this page is stored: the preview
     under each card is `Derive.templatePreview()` — the SAME resolution the apply
     uses — so what the card promises and what the Apply button delivers cannot
     drift apart.
     ====================================================================== */
  const TemplatesPage = {
    _root: null,

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'templates') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty">' +
          '<div class="spinner"></div><p style="margin-top:12px">Opening the templates…</p>' +
          '</div></div></div>';
        return;
      }
      /* The gate. Templates is the third Pro feature, so it uses the one locked
         state every gated page uses. */
      if (!FeatureAccess.allows('templates')) { renderLocked(mount, 'templates'); return; }

      const s = Derive.templatesList();
      const page = el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Shape it once</div>
            <h1>Templates</h1>
            <div class="sub">${esc(this._summaryLine(s))}</div>
          </div>
          <div class="row gap-2">
            <span class="badge badge-pro">✦ PRO</span>
            <button class="btn btn-primary btn-sm" id="tp-new">${icon('plus', 14)} New template</button>
          </div>
        </div>

        <div class="proj-stats" id="tp-tiles" style="margin-top:var(--sp-4)">${this._tiles(s)}</div>
        <div id="tp-list" style="margin-top:var(--sp-4)">${this._listHtml(s)}</div>

        <section class="card" style="margin-top:var(--sp-3)">
          <div class="card-head"><div>
            <div class="card-title">How this works</div>
            <div class="card-sub">A shape, not a copy</div>
          </div></div>
          <p class="t-faint t-sm" style="margin:0">
            A template stores the <b>shape</b> of a piece of work and nothing concrete.
            Every <b>{date}</b> becomes the day you apply it, and every <b>{name}</b> is
            whatever you type at that moment — so the same template written in January still
            makes September work. What it makes are ordinary records: they count toward their
            project, move the NEXUS Score, and turn up in search. Applying one twice makes it
            twice, because a template is something you do, not something that happens to you.
          </p>
        </section>
      ` });
      mount.innerHTML = '';
      mount.append(page);
      this._root = page;
      this.bind(page);
      Shell.setHeader('Templates', s.total ? `${s.total} saved · ${s.items} records` : 'Nothing saved yet');
    },

    _summaryLine(s) {
      if (!s.total) return 'No templates yet — save the shape of work you do more than once.';
      const bits = [`${s.total} template${s.total === 1 ? '' : 's'}`];
      bits.push(`${s.items} record${s.items === 1 ? '' : 's'} between them`);
      if (s.asking) bits.push(`${s.asking} ask a question first`);
      return bits.join(' · ');
    },

    _tiles(s) {
      return `
        ${Widgets.statTile({ icon: 'sparkles', label: 'Templates', value: s.total,
          meta: s.kinds.length ? `${s.kinds.length} kind${s.kinds.length === 1 ? '' : 's'} of record` : 'none saved',
          accent: 'var(--cyan)' })}
        ${Widgets.statTile({ icon: 'layers', label: 'Records each', value: s.items,
          meta: 'made in one click', accent: 'var(--violet)' })}
        ${Widgets.statTile({ icon: 'check', label: 'Tasks', value: s.tasks,
          meta: 'ordinary tasks', accent: 'var(--accent)' })}
        ${Widgets.statTile({ icon: 'edit', label: 'Asks first', value: s.asking,
          meta: s.asking ? 'need an answer' : 'all apply in one click',
          accent: 'var(--warn)' })}`;
    },

    _listHtml(s) {
      if (!s.total) {
        return `<section class="card"><div class="empty">
          <div class="empty-ic">${icon('sparkles', 22)}</div>
          <h4>No templates yet</h4>
          <p>A template is a bundle of records you keep and reuse — a project and its
             starter tasks, a packing list, a weekly routine. Write the shape once and
             apply it whenever you need it.</p>
          <button class="btn btn-primary btn-sm" data-tp-new style="margin-top:var(--sp-3)">
            ${icon('plus', 13)} Save the first template</button>
        </div></section>`;
      }
      return s.rows.map(row => this._cardHtml(row)).join('');
    },

    _cardHtml(row) {
      const t = row.template;
      return `
        <section class="card tp-card">
          <div class="card-head">
            <div class="tp-card-id">
              <span class="tp-card-ic">${icon(t.icon, 16)}</span>
              <div>
                <div class="card-title">${esc(t.name)}</div>
                <div class="card-sub">${esc(row.summary)}</div>
              </div>
            </div>
            <div class="row gap-2">
              <button class="btn btn-primary btn-sm" data-tp-apply="${esc(t.id)}">
                ${icon('play', 12)} Apply</button>
              <button class="btn btn-ghost btn-sm" data-tp-edit="${esc(t.id)}">
                ${icon('edit', 12)} Edit</button>
            </div>
          </div>
          <div class="tp-items">${row.preview.map((p, i) => this._itemHtml(p, i)).join('')}</div>
          ${row.holes.length
            ? `<div class="tp-ask">${icon('sparkles', 12)}
                 Asks for ${row.holes.map(k => `<span class="tp-hole">{${esc(k)}}</span>`).join(' ')}
                 before it makes anything.</div>`
            : `<div class="tp-ask is-ready">${icon('check', 12)}
                 Applies in one click — nothing to ask.</div>`}
        </section>`;
    },

    _itemHtml(p, i) {
      const ic = p.type === 'task' ? 'check' : p.type === 'capture' ? 'inbox' : 'note';
      const label = p.type === 'task'
        ? `${this._holes(p.project)} · ${esc(p.priority)} · ${esc(Derive.shortDay(p.due))}`
        : p.type === 'capture' ? 'Inbox' : 'Note';
      const text = p.type === 'capture' ? p.text : p.title;
      return `
        <div class="tp-item">
          <span class="tp-item-ic">${icon(ic, 12)}</span>
          <span class="tp-item-t">${this._holes(text)}</span>
          <span class="tp-item-m">${label}</span>
        </div>`;
    },

    /* Escape first, then mark every token, so a hole reads as a hole rather than
       as literal punctuation the user forgot to fill in. */
    _holes(str) {
      return esc(str).replace(/\{([a-z]+)\}/gi,
        (m, k) => `<span class="tp-hole">{${esc(k)}}</span>`);
    },

    _holeLabel(k) { return k.charAt(0).toUpperCase() + k.slice(1); },

    bind(root) {
      const fresh = $('#tp-new', root);
      if (fresh) fresh.addEventListener('click', () => this.openEditor(null));
      root.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);
        if (hit('[data-tp-new]')) { this.openEditor(null); return; }
        const ap = hit('[data-tp-apply]');
        if (ap) { this.apply(ap.dataset.tpApply); return; }
        const ed = hit('[data-tp-edit]');
        if (ed) { this.openEditor(ed.dataset.tpEdit); return; }
        const dl = hit('[data-tp-del]');
        if (dl) { this.confirmDelete(dl.dataset.tpDel); }
      });
    },

    /* Applying is an action, so it happens the moment it is asked for — unless the
       template still has a hole, in which case the one thing that can be done
       about it is to ask. */
    apply(id) {
      const t = State.templateById(id);
      if (!t) return;
      const holes = Derive.templateHoles(t);
      if (!holes.length) { this._run(id, {}); return; }
      this._ask(id, holes);
    },

    _ask(id, holes) {
      const t = State.templateById(id);
      if (!t) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Apply template</div>
            <h2 class="t-h2" style="margin-top:6px">“${esc(t.name)}”</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        ${holes.map(k => `
          <div class="field-group" style="margin-top:var(--sp-3)">
            <label class="field-label" for="tp-var-${esc(k)}">${esc(this._holeLabel(k))}</label>
            <input class="field" id="tp-var-${esc(k)}" maxlength="60" placeholder="Type it here">
          </div>`).join('')}
        <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
          Answered now, used once, and never stored — the template keeps its holes.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" data-tp-go>Apply it</button>
        </div>`, { cls: 'modal-sm' });

      const first = $('#tp-var-' + holes[0], wrap);
      if (first) first.focus();
      wrap.addEventListener('click', e => {
        if (!e.target.closest('[data-tp-go]')) return;
        const vars = {};
        holes.forEach(k => { const n = $('#tp-var-' + k, wrap); vars[k] = n ? n.value.trim() : ''; });
        const missing = holes.filter(k => !vars[k]);
        if (missing.length) {
          Toast.show('Fill in ' + missing.map(k => '{' + k + '}').join(', '), 'warn');
          return;
        }
        Overlay.close();
        this._run(id, vars);
      });
    },

    _run(id, vars) {
      const t = State.templateById(id);
      if (!t) return;
      const out = State.applyTemplate(id, todayKey(), vars);
      if (out.missing.length) {
        Toast.show('Fill in ' + out.missing.map(k => '{' + k + '}').join(', '), 'warn');
        return;
      }
      Toast.show(`“${t.name}” made ${out.created} record${out.created === 1 ? '' : 's'}`, 'good');
      this.render();
    },

    /* The editor. `draft` is the working copy and every repaint collects what is
       on screen first, so switching an item's kind or its icon never discards
       typing. */
    openEditor(id) {
      const editing = !!id;
      const src = editing ? State.templateById(id) : null;
      if (editing && !src) return;
      const draft = {
        name: src ? src.name : '',
        icon: src ? src.icon : 'sparkles',
        items: src
          ? src.items.map(i => ({ ...i }))
          : [{ type: 'task', title: '', project: 'Personal', priority: 'Medium', dueIn: 0 }],
      };
      const wrap = Overlay.open('', { cls: 'modal-md' });
      const paint = () => { wrap.innerHTML = this._editorHtml(editing, draft); };
      const val = sel => { const n = $(sel, wrap); return n ? n.value : null; };
      const collect = () => {
        const nm = val('#tp-name');
        if (nm !== null) draft.name = nm;
        draft.items = draft.items.map((it, i) => {
          const t = { type: it.type };
          if (it.type === 'capture') {
            const tx = val('#tp-i' + i + '-text');
            t.text = tx === null ? (it.text || '') : tx;
          } else if (it.type === 'note') {
            const ti = val('#tp-i' + i + '-title');
            const bd = val('#tp-i' + i + '-body');
            t.title = ti === null ? (it.title || '') : ti;
            t.body = bd === null ? (it.body || '') : bd;
          } else {
            const ti = val('#tp-i' + i + '-title');
            const pj = val('#tp-i' + i + '-project');
            const pr = val('#tp-i' + i + '-prio');
            const di = val('#tp-i' + i + '-duein');
            t.title = ti === null ? (it.title || '') : ti;
            t.project = pj === null ? (it.project || '') : pj;
            t.priority = pr || it.priority || 'Medium';
            t.dueIn = di === null ? (typeof it.dueIn === 'number' ? it.dueIn : 0) : Number(di);
          }
          return t;
        });
      };

      wrap.addEventListener('click', e => {
        const hit = sel => e.target.closest(sel);

        const ic = hit('[data-tp-ic]');
        if (ic) { collect(); draft.icon = ic.dataset.tpIc; paint(); return; }

        /* Changing an item's kind carries the text across rather than throwing it
           away — both task and note have a title, and a capture has text, so the
           words a user has already typed survive the switch. */
        const ty = hit('[data-tp-itype]');
        if (ty) {
          collect();
          const i = Number(ty.dataset.i);
          const prev = draft.items[i] || {};
          const next = { type: ty.dataset.tpItype };
          if (next.type === 'capture') {
            next.text = prev.text || prev.title || '';
          } else if (next.type === 'note') {
            next.title = prev.title || prev.text || '';
            next.body = prev.body || '';
          } else {
            next.title = prev.title || prev.text || '';
            next.project = prev.project || 'Personal';
            next.priority = prev.priority || 'Medium';
            next.dueIn = typeof prev.dueIn === 'number' ? prev.dueIn : 0;
          }
          draft.items[i] = next;
          paint();
          return;
        }

        const rm = hit('[data-tp-irm]');
        if (rm) {
          collect();
          draft.items.splice(Number(rm.dataset.i), 1);
          /* A template with nothing in it would make nothing, so the last row
             cannot be removed — it is emptied instead. */
          if (!draft.items.length) draft.items = [{ type: 'task' }];
          paint();
          return;
        }

        if (hit('[data-tp-iadd]')) {
          collect();
          if (draft.items.length < TEMPLATE_MAX_ITEMS) draft.items.push({ type: 'task' });
          paint();
          return;
        }

        if (hit('[data-tp-save]')) {
          collect();
          if (!draft.name.trim()) { Toast.show('Give the template a name', 'warn'); return; }
          const items = draft.items.map(normalizeTemplateItem);
          if (editing) {
            State.updateTemplate(id, { name: draft.name, icon: draft.icon, items });
            Toast.show('Template updated', 'good');
          } else {
            State.addTemplate({ name: draft.name, icon: draft.icon, items });
            Toast.show('Template saved', 'good');
          }
          Overlay.close();
          this.render();
          return;
        }

        if (hit('[data-tp-del]')) { Overlay.close(); this.confirmDelete(id); }
      });
      paint();
    },

    _editorHtml(editing, d) {
      const full = d.items.length >= TEMPLATE_MAX_ITEMS;
      return `
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Templates</div>
            <h2 class="t-h2" style="margin-top:6px">${editing ? 'Edit this template' : 'Save a template'}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>

        <div class="field-group" style="margin-top:var(--sp-3)">
          <label class="field-label" for="tp-name">Name</label>
          <input class="field" id="tp-name" value="${esc(d.name)}" maxlength="80"
            placeholder="New project kickoff">
        </div>

        <div class="field-group" style="margin-top:var(--sp-3)">
          <span class="field-label">Icon</span>
          <div class="tp-icons" role="group" aria-label="Icon">
            ${TEMPLATE_ICONS.map(k => `
              <button type="button" class="tp-icon ${d.icon === k ? 'is-on' : ''}"
                data-tp-ic="${k}" aria-pressed="${d.icon === k}" aria-label="${k}">${icon(k, 15)}</button>`).join('')}
          </div>
        </div>

        <div class="field-group" style="margin-top:var(--sp-4)">
          <span class="field-label">What it makes</span>
          ${d.items.map((it, i) => this._itemEditorHtml(it, i)).join('')}
          <button type="button" class="btn btn-ghost btn-sm" data-tp-iadd
            ${full ? 'disabled' : ''} style="margin-top:var(--sp-2)">
            ${icon('plus', 13)} Add another record</button>
        </div>

        <p class="t-faint t-sm" style="margin:var(--sp-3) 0 0">
          <b>{date}</b> becomes the day you apply it, and <b>{name}</b> is asked for at that
          moment. A template never stores a value, which is why the same one still works next
          year.${full ? ` Up to ${TEMPLATE_MAX_ITEMS} records.` : ''}
        </p>

        <div class="modal-actions">
          ${editing ? `<button class="btn btn-ghost btn-sm" data-tp-del
            style="margin-right:auto;color:var(--bad)">${icon('trash', 13)} Delete</button>` : ''}
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" data-tp-save>${editing ? 'Save changes' : 'Save template'}</button>
        </div>`;
    },

    _itemEditorHtml(it, i) {
      const id = s => `tp-i${i}-${s}`;
      return `
        <div class="tp-row">
          <div class="tp-row-head">
            <div class="viewtabs" role="group" aria-label="Record ${i + 1} kind">
              ${AUTOMATION_ACTIONS.map(a => `
                <button type="button" class="viewtab ${it.type === a.key ? 'is-active' : ''}"
                  data-tp-itype="${a.key}" data-i="${i}">${icon(a.icon, 12)} ${a.label}</button>`).join('')}
            </div>
            <button type="button" class="iconbtn" data-tp-irm="${i}"
              aria-label="Remove this record">${icon('x', 13)}</button>
          </div>
          ${it.type === 'capture' ? `
            <div class="field-group">
              <label class="field-label" for="${id('text')}">Capture</label>
              <input class="field" id="${id('text')}" value="${esc(it.text || '')}" maxlength="2000"
                placeholder="Write the weekly review for {date}">
            </div>`
          : it.type === 'note' ? `
            <div class="field-group">
              <label class="field-label" for="${id('title')}">Note title</label>
              <input class="field" id="${id('title')}" value="${esc(it.title || '')}" maxlength="140"
                placeholder="{name} — kickoff notes">
            </div>
            <div class="field-group" style="margin-top:var(--sp-2)">
              <label class="field-label" for="${id('body')}">Note body</label>
              <textarea class="textarea" id="${id('body')}" rows="3" maxlength="4000">${esc(it.body || '')}</textarea>
            </div>`
          : `
            <div class="tp-row-grid">
              <div class="field-group">
                <label class="field-label" for="${id('title')}">Task</label>
                <input class="field" id="${id('title')}" value="${esc(it.title || '')}" maxlength="140"
                  placeholder="Write the brief for {name}">
              </div>
              <div class="field-group">
                <label class="field-label" for="${id('project')}">Project</label>
                <input class="field" id="${id('project')}" value="${esc(it.project || '')}" maxlength="60"
                  placeholder="Personal">
              </div>
              <div class="field-group">
                <label class="field-label" for="${id('prio')}">Priority</label>
                <select class="field" id="${id('prio')}">
                  ${PRIORITIES.map(p => `<option ${it.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
              </div>
              <div class="field-group">
                <label class="field-label" for="${id('duein')}">Due</label>
                <select class="field" id="${id('duein')}">
                  ${[0, 1, 2, 3, 7, 14].map(n => `<option value="${n}" ${it.dueIn === n ? 'selected' : ''}>${
                    n === 0 ? 'The day it is applied'
                      : n === 1 ? 'The next day' : `${n} days later`}</option>`).join('')}
                </select>
              </div>
            </div>`}
        </div>`;
    },

    confirmDelete(id) {
      const t = State.templateById(id);
      if (!t) return;
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete template</div>
            <h2 class="t-h2" style="margin-top:6px">Delete “${esc(t.name)}”?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted" style="margin-top:var(--sp-3)">
          The template goes. Every record it ever made stays exactly where it is —
          deleting a template never deletes your work.
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" data-tp-del-yes>Delete the template</button>
        </div>`, { cls: 'modal-sm' });
      wrap.addEventListener('click', e => {
        if (!e.target.closest('[data-tp-del-yes]')) return;
        State.deleteTemplate(id);
        Toast.show('Template deleted', 'default');
        Overlay.close();
        this.render();
      });
    },
  };

  /* ======================================================================
     ONBOARDING — Milestone 38
     ======================================================================
     The first-run flow. It collects the only two things this app cannot derive:
     what to call you, and where you want to start. Every answer lands in state
     that something else reads — the dashboard greeting, the focus strip — because
     a question whose answer goes nowhere is a survey, not onboarding.

     It is deliberately NOT a blocking wizard on boot. NEXUS ships with a working
     demo workspace, so holding a first-time visitor behind three steps before
     they can look at anything would be the wrong trade. The dashboard offers it
     and Settings can re-run it.

     Nothing is written until the user commits — the flow holds a draft, so half
     an answer never reaches storage. Closing it without choosing is NOT a
     decision: `onboardedAt` stays null and the offer comes back, which is more
     honest than silently recording a setup that never happened.
     ====================================================================== */
  const Onboarding = {
    step: 0,
    _draft: null,

    open(step) {
      this.step = Math.max(0, Number(step) || 0);
      this._draft = {
        name: (State.user && State.user.name) || '',
        focus: ((State.user && State.user.focus) || []).slice(),
      };
      this.paint();
    },

    /* Collect from the live DOM before every repaint — the same rule the editors
       follow, so moving between steps never discards what was typed. */
    _collect() {
      if (!this._draft) return;
      const nameEl = document.querySelector('#ob-name');
      if (nameEl) this._draft.name = nameEl.value;
      const chips = document.querySelectorAll('[data-ob-start]');
      if (chips.length) {
        const on = [];
        chips.forEach(c => { if (c.classList.contains('is-on')) on.push(c.dataset.obStart); });
        this._draft.focus = on;
      }
    },

    go(step) {
      this._collect();
      this.step = Math.max(0, Math.min(Derive.onboardingSteps().length - 1, step));
      this.paint();
    },

    paint() {
      const v = Derive.onboardingView(this.step, this._draft);
      const d = this._draft || { name: '', focus: [] };
      const body = v.current.key === 'welcome' ? this._welcome()
                 : v.current.key === 'name'    ? this._name(d)
                 : this._start(v);
      const label = v.last
        ? (v.destination ? `Start with ${esc(v.destination.label)}` : 'Finish')
        : 'Continue';
      const modal = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Set up</div>
            <h2 class="t-h2" id="ob-title" style="margin-top:6px">${esc(v.current.title)}</h2>
          </div>
          <div class="ob-dots" aria-hidden="true">
            ${v.steps.map((s, i) => `<span class="ob-dot ${i === v.step ? 'is-on' : ''}"></span>`).join('')}
          </div>
        </div>
        <p class="ob-lede">${esc(v.current.lede)}</p>
        ${body}
        <div class="modal-actions">
          <span class="ob-count" style="margin-right:auto">Step ${v.step + 1} of ${v.steps.length}</span>
          <button type="button" class="btn btn-ghost" data-ob-skip>Skip</button>
          ${v.first ? '' : '<button type="button" class="btn btn-ghost" data-ob-back>Back</button>'}
          <button type="button" class="btn btn-primary" data-ob-next>${label}</button>
        </div>
      `, { cls: 'modal-md' });
      /* The modal itself carries the dialog semantics. `Overlay.open` does not add
         them (the panel does), so a screen reader had no idea a modal had opened. */
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'ob-title');
      this.bind(modal);
      /* Land the cursor in the field the step is actually about. */
      if (v.current.key === 'name') {
        const n = modal.querySelector('#ob-name');
        if (n) { n.focus(); n.select(); }
      }
    },

    _welcome() {
      return `<ul class="ob-points">
        <li>${icon('check', 14)}<span>Tasks, projects, goals, habits, focus, notes, journal, money and files — in one place, with no account to make.</span></li>
        <li>${icon('check', 14)}<span>Nothing is uploaded. There is no server for it to go to; everything stays in this browser.</span></li>
        <li>${icon('check', 14)}<span>It works offline, and the core modules are not gated behind a plan.</span></li>
      </ul>
      <p class="ob-note">${icon('flag', 13)}<span>This workspace already holds a full set of demo records, so there is nothing you have to fill in first. None of it is real — change it, delete it, or leave it exactly as it is.</span></p>`;
    },

    _name(d) {
      return `<div class="field-group">
        <label class="field-label" for="ob-name">Your name</label>
        <input class="field" id="ob-name" type="text" maxlength="${USER_NAME_MAX}"
          autocomplete="off" spellcheck="false" value="${esc(d.name)}" placeholder="Alex">
        <p class="ob-hint">It goes on the dashboard greeting, and nowhere else. There is no account, so this is the only place it is kept.</p>
      </div>`;
    },

    _start(v) {
      return `<div class="ob-starts">
        ${v.starts.map(s => `
          <button type="button" class="ob-start ${s.on ? 'is-on' : ''}" data-ob-start="${s.key}"
            aria-pressed="${s.on ? 'true' : 'false'}">
            <span class="ob-start-ic">${icon(s.icon, 15)}</span>
            <span class="ob-start-t">${esc(s.label)}</span>
            <span class="ob-start-b">${esc(s.blurb)}</span>
          </button>`).join('')}
      </div>
      <p class="ob-hint">${v.chosenCount
        ? `${v.chosenCount} chosen — the dashboard keeps them within reach, and the button above names where you will land.`
        : 'Pick none and NEXUS simply takes you to the dashboard.'}</p>`;
    },

    bind(modal) {
      modal.addEventListener('click', e => {
        const chip = e.target.closest('[data-ob-start]');
        if (chip) {
          this._collect();
          const k = chip.dataset.obStart;
          const i = this._draft.focus.indexOf(k);
          if (i === -1) this._draft.focus.push(k); else this._draft.focus.splice(i, 1);
          this.paint();
          return;
        }
        if (e.target.closest('[data-ob-next]')) { this._next(); return; }
        if (e.target.closest('[data-ob-back]')) { this.go(this.step - 1); return; }
        if (e.target.closest('[data-ob-skip]')) { this.skip(); return; }
      });
      /* Enter moves on rather than submitting nothing — there is no form here. */
      modal.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target && e.target.tagName === 'INPUT') {
          e.preventDefault(); this._next();
        }
      });
    },

    _next() {
      this._collect();
      if (this.step < Derive.onboardingSteps().length - 1) { this.go(this.step + 1); return; }
      this.finish();
    },

    /* Finishing writes both answers and then GOES somewhere — the last thing a
       first run does is take you to work, not say "all set". */
    finish() {
      const d = this._draft || { name: '', focus: [] };
      const v = Derive.onboardingView(this.step, d);
      State.completeOnboarding({ name: d.name, focus: d.focus });
      const name = State.user.name;
      Overlay.close();
      this._draft = null;
      this.step = 0;
      if (v.destination) {
        Router.go(v.destination.route);
        Toast.show(`Set up for ${name} — starting with ${v.destination.label}`, 'good');
      } else {
        Router.go('dashboard');
        Toast.show(`All set, ${name}`, 'good');
      }
    },

    /* Skipping is a real decision, so it is recorded — but it changes nothing
       else. A skip must never leave a half-set-up workspace. */
    skip() {
      State.completeOnboarding({});
      Overlay.close();
      this._draft = null;
      this.step = 0;
      Toast.show('Skipped — you can set this up any time in Settings', 'default');
    },
  };

  /* ======================================================================
     WORKSPACE EXPORT / IMPORT — Milestone 39
     ======================================================================
     The Settings page owns this, and it is the only place a file enters or
     leaves the workspace. Two rules shape it:

     · **An export is the user's DATA in one file.** The envelope stores no count
       of its own, so a hand-edited file cannot claim a count its contents do not
       support; and it does not carry the plan, because an entitlement is live
       state — a file that could grant Pro would make the gate (invariant 13)
       meaningless.
     · **An import is a RESTORE, not a merge.** It replaces the workspace, so it
       confirms first and names both sides, and it refuses anything it cannot read
       whole rather than half-applying it.

     `_ord` is deliberately stripped on the way out: it is storage bookkeeping
     that `persistAll` re-stamps on every save, and a file has no business
     carrying it.
     ====================================================================== */
  const Workspace = {
    _busy: false,

    /* Build the envelope. Async because file contents have to be read out of
       their Blobs — a Blob becomes `{}` under JSON.stringify, so the bytes travel
       as base64 beside their mime type, and come back as a real Blob on import. */
    async buildPayload() {
      const d = State.data || {};
      const data = {};
      EXPORT_COLLECTIONS.forEach(c => {
        data[c.key] = (Array.isArray(d[c.key]) ? d[c.key] : []).map(r => {
          const { _ord, ...rest } = r;
          return rest;
        });
      });
      data.files = await Promise.all((Array.isArray(d.files) ? d.files : []).map(async f => {
        const { blob, ...rest } = f;
        const bytes = blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array(0);
        return {
          ...rest,
          mime: (blob && blob.type) || 'application/octet-stream',
          data: bytesToBase64(bytes),
        };
      }));
      data.user = d.user || null;
      data.finance = d.finance || null;
      return {
        app: 'NEXUS',
        format: EXPORT_FORMAT,
        exportedAt: nowIso(),
        /* Written for a human who opens the file without the app. */
        about: 'A NEXUS workspace export: records and preferences. The plan is not included.',
        preferences: pickPreferences(Settings.read()),
        data,
      };
    },

    filename() { return `nexus-workspace-${todayKey()}.json`; },

    /* Hand the file to the browser through a temporary object URL. */
    async download() {
      if (this._busy) return null;
      this._busy = true;
      try {
        const payload = await this.buildPayload();
        const text = JSON.stringify(payload);
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = el('a', { href: url, download: this.filename() });
        document.body.append(a);
        a.click();
        a.remove();
        /* Revoke on a delay: revoking synchronously can beat the download. */
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return { bytes: text.length, payload };
      } finally {
        this._busy = false;
      }
    },

    readFile(file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ''));
        fr.onerror = () => reject(fr.error || new Error('That file could not be read.'));
        fr.readAsText(file);
      });
    },
  };

  /* ======================================================================
     SETTINGS — Milestone 38
     ======================================================================
     The home of the profile onboarding creates, and the first real page behind
     the `settings` route (it was a stub). It is deliberately small and honest:
     it shows what exists, offers the one action that changes it, and NAMES the
     things that are not built yet rather than showing a dead toggle.
     ====================================================================== */
  const SettingsPage = {
    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'settings') return;
      const v = Derive.settingsView();
      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="page-head">
          <div>
            <div class="t-eyebrow">Workspace</div>
            <h1>Settings</h1>
            <div class="sub">Everything here is kept in this browser, and nowhere else.</div>
          </div>
        </div>

        <div class="set-grid">
          <section class="card">
            <div class="card-head"><div>
              <div class="t-eyebrow">You</div>
              <h3>Your profile</h3>
            </div></div>
            <div class="field-group">
              <label class="field-label" for="set-name">Your name</label>
              <input class="field" id="set-name" type="text" maxlength="${v.nameMax}"
                autocomplete="off" spellcheck="false" value="${esc(v.name)}">
              <p class="ob-hint">Shown in the dashboard greeting.</p>
            </div>
            <div class="set-meta">
              <span>${icon('calendar', 12)} Joined ${esc(v.joinedLabel || 'today')}</span>
              <span>${icon('sparkles', 12)} ${esc(v.plan)}</span>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-set-rerun>${icon('reset', 13)} Run the setup again</button>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div>
              <div class="t-eyebrow">Starting points</div>
              <h3>Where you wanted to start</h3>
            </div></div>
            ${v.focus.length ? `<div class="set-chips">
              ${v.focus.map(f => `<button type="button" class="chip" data-set-go="${f.route}">${icon(f.icon, 12)} ${esc(f.label)}</button>`).join('')}
            </div>
            <p class="card-sub" style="margin-top:var(--sp-3)">The dashboard keeps these within reach. Change them by running the setup again.</p>`
            : `<div class="empty" style="padding:var(--sp-5) var(--sp-3)">
                <h4>No starting points yet</h4>
                <p>Run the setup and pick what you want to work on first.</p>
                <button type="button" class="btn btn-primary" data-set-rerun>Set up the workspace</button>
              </div>`}
          </section>

          <section class="card">
            <div class="card-head"><div>
              <div class="t-eyebrow">Appearance</div>
              <h3>Theme</h3>
            </div></div>
            <p class="card-sub">Currently <b>${esc(v.themeLabel)}</b>. Eight themes ship with NEXUS — two are free and six are Pro.</p>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-set-theme>${icon('sun', 13)} Choose a theme</button>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><div>
              <div class="t-eyebrow">Your data</div>
              <h3>Take it with you</h3>
            </div></div>
            <p class="card-sub">${v.workspace.records} record${v.workspace.records === 1 ? '' : 's'}
              across ${v.workspace.kinds.length} kind${v.workspace.kinds.length === 1 ? '' : 's'}${v.workspace.files
                ? `, including ${v.workspace.files} file${v.workspace.files === 1 ? '' : 's'} (${esc(v.workspace.fileSizeLabel)})` : ''}.</p>
            ${v.workspace.kinds.length
              ? `<div class="set-chips">${v.workspace.kinds.map(k =>
                  `<span class="chip">${esc(k.label)} <b>${k.count}</b></span>`).join('')}</div>`
              : `<p class="card-sub">Nothing to export yet — the workspace is empty.</p>`}
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" data-set-export>${icon('download', 13)} Export everything</button>
              <button type="button" class="btn btn-ghost" data-set-import>${icon('upload', 13)} Import a file</button>
              <input type="file" id="set-filein" accept="application/json,.json" hidden>
            </div>
            <p class="ob-hint">One JSON file, written to your downloads. It carries your records and
              your preferences — <b>not</b> your plan: a file cannot grant Pro, so importing never
              changes it. Importing <b>replaces</b> this workspace, and asks first.</p>
          </section>

          <section class="card">
            <div class="card-head"><div>
              <div class="t-eyebrow">The demo</div>
              <h3>Put the demo back</h3>
            </div></div>
            <p class="card-sub">Restores the demo workspace — its tasks, projects, goals, habits,
              notes, journal, money, files and history. Everything here now is replaced, and
              cannot be brought back.</p>
            <div class="modal-actions">
              <button type="button" class="btn btn-danger" data-set-reset>${icon('reset', 13)} Reset to the demo</button>
            </div>
            <p class="ob-hint">Your name, your plan, your theme and your focus target stay yours.
              What you get is the same workspace a first run would have made.</p>
          </section>
        </div>
      `}));
      this.bind(mount);
    },

    bind(mount) {
      /* The name commits on blur and on Enter. `settled` blocks RE-ENTRANCY (a
         repaint that detaches the field fires a second blur), but it is released
         once the write is done — otherwise the flag stays set for the whole visit
         and a second rename silently does nothing while the field shows the new
         name. A control that only works once is not a working control. */
      const nameEl = $('#set-name', mount);
      if (nameEl) {
        let settled = false;
        const commit = () => {
          if (settled) return;
          settled = true;
          try {
            const was = State.user.name;
            const saved = State.setUserName(nameEl.value);
            if (!saved) { nameEl.value = was; Toast.show('A name cannot be blank', 'warn'); return; }
            if (saved.name !== nameEl.value.trim()) nameEl.value = saved.name;
            /* Only claim a rename when the name actually changed: blurring the
               field without editing it must not announce something that never
               happened. */
            if (saved.name !== was) Toast.show(`Calling you ${saved.name} from now on`, 'good');
            Dashboard.render();
          } finally { settled = false; }
        };
        nameEl.addEventListener('blur', commit);
        nameEl.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
        });
      }
      /* --- Export / import (M39) ----------------------------------------- */
      const fileIn = $('#set-filein', mount);
      const importBtn = $('[data-set-import]', mount);
      if (importBtn && fileIn) importBtn.addEventListener('click', () => fileIn.click());
      if (fileIn) fileIn.addEventListener('change', () => {
        const picked = (fileIn.files || [])[0];
        fileIn.value = '';            // so picking the same file twice still fires
        if (picked) this._readImport(picked);
      });

      mount.addEventListener('click', e => {
        if (e.target.closest('[data-set-rerun]')) {
          State.resetOnboarding();
          Onboarding.open(0);
          return;
        }
        if (e.target.closest('[data-set-theme]')) { Shell.openThemePicker(); return; }
        if (e.target.closest('[data-set-export]')) { this._export(); return; }
        if (e.target.closest('[data-set-reset]')) { this._confirmReset(); return; }
        const go = e.target.closest('[data-set-go]');
        if (go) { Router.go(go.dataset.setGo); return; }
      });
    },

    /* An export writes a file, so the only honest feedback is what went out. */
    async _export() {
      try {
        const out = await Workspace.download();
        if (!out) return;
        Toast.show(`Exported ${Derive.fileSize(out.bytes)} to ${Workspace.filename()}`, 'good');
      } catch (err) {
        Toast.show('That export could not be written', 'bad');
      }
    },

    /* Read the picked file, then either refuse it (saying why) or confirm. A
       refusal never touches state — that is the whole point of validating first. */
    async _readImport(file) {
      let payload;
      try {
        payload = JSON.parse(await Workspace.readFile(file));
      } catch (err) {
        this._refuse(`“${file.name}” is not JSON, so it cannot be a NEXUS export.`);
        return;
      }
      const p = Derive.importPreview(payload);
      if (!p.ok) { this._refuse(p.error); return; }
      this._confirmImport(p, payload);
    },

    _refuse(message) {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Import</div>
            <h2 class="t-h2" style="margin-top:6px">That file cannot be read</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted">${esc(message)}</p>
        <p class="t-sm t-muted">Nothing has changed — your workspace is exactly as it was.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" data-close>Close</button>
        </div>`, { cls: 'modal-sm' });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
    },

    /* Replacing a workspace destroys work, so the confirm names BOTH sides: what
       is here now, and what the file would put in its place. And it offers to
       export first — the one action that makes the replacement reversible. */
    _confirmImport(p, payload) {
      const now = Derive.workspaceSummary();
      const prefs = p.prefRows.length
        ? `<p class="t-sm t-muted">It also carries ${p.prefRows
            .map(r => `${esc(r.label.toLowerCase())} <b>${esc(r.value)}</b>`).join(' and ')}.</p>`
        : '';
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Import</div>
            <h2 class="t-h2" style="margin-top:6px">Replace this workspace?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted">The file holds <b>${esc(recordSummaryLine(p))}</b>${p.name ? ` for <b>${esc(p.name)}</b>` : ''}${p.exportedAt ? `, exported ${esc(Derive.relTime(p.exportedAt))}` : ''}.</p>
        <p class="t-sm t-muted">This workspace holds <b>${esc(recordSummaryLine(now))}</b>. Importing replaces all of
          it: the records here now are not merged, and cannot be brought back.</p>
        ${prefs}
        <p class="ob-hint">Your plan is not in the file, so it will not change.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-ghost" id="set-export-first">${icon('download', 13)} Export first</button>
          <button class="btn btn-danger" id="set-import-yes">${icon('upload', 13)} Replace it</button>
        </div>`, { cls: 'modal-md' });

      $('#set-export-first', wrap).addEventListener('click', () => this._export());
      $('#set-import-yes', wrap).addEventListener('click', async () => {
        const btn = $('#set-import-yes', wrap);
        if (btn.disabled) return;
        btn.disabled = true;
        const res = await State.importWorkspace(payload);
        Overlay.close();
        if (!res.ok) { this._refuse(res.error); return; }
        Toast.show(`Imported ${res.preview.records} record${res.preview.records === 1 ? '' : 's'}`
          + (res.preview.files ? `, including ${res.preview.files} file${res.preview.files === 1 ? '' : 's'}` : ''), 'good');
        /* The shell chips and the bell ride the shared state signal, so only this
           page has to repaint itself. */
        this.render();
      });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
    },

    /* Resetting destroys work, so it is confirmed first and offers an export —
       the same shape as the import confirmation, because it is the same kind of
       act: replacing the whole workspace. Unlike a file, the replacement is
       knowable, so the modal names BOTH sides through the same summary rule. */
    _confirmReset() {
      const now = Derive.workspaceSummary();
      const demo = Derive.workspaceSummary(State.demoWorkspace());
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Reset</div>
            <h2 class="t-h2" style="margin-top:6px">Put the demo back?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted">This workspace holds <b>${esc(recordSummaryLine(now))}</b>. Resetting
          replaces all of it: the records here now are not merged, and cannot be brought back.</p>
        <p class="t-sm t-muted">The demo holds <b>${esc(recordSummaryLine(demo))}</b>.</p>
        <p class="ob-hint">Your name, your plan, your theme and your focus target are not touched.
          Nothing from what is here now is kept.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-ghost" id="set-reset-export">${icon('download', 13)} Export first</button>
          <button class="btn btn-danger" id="set-reset-yes">${icon('reset', 13)} Reset it</button>
        </div>`, { cls: 'modal-md' });

      $('#set-reset-export', wrap).addEventListener('click', () => this._export());
      $('#set-reset-yes', wrap).addEventListener('click', async () => {
        const btn = $('#set-reset-yes', wrap);
        if (btn.disabled) return;
        btn.disabled = true;
        const res = await State.resetToDemo();
        Overlay.close();
        Toast.show(`The demo is back — ${res.after.records} records across ${res.after.kinds.length} kinds`, 'good');
        this.render();
      });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
    },
  };

  const CalendarPage = {
    year: null,
    month: null,      // 0-based
    selected: null,   // day key
    showTasks: true,
    showEvents: true,

    _ensure() {
      if (this.year === null) {
        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth();
        this.selected = todayKey();
      }
    },

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      if (Router.current !== 'calendar') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Loading calendar…</p></div></div></div>';
        return;
      }
      this._ensure();

      const sun = Derive.calendarSummary(this.year, this.month);
      const sel = this.selected || todayKey();
      const selItems = Derive.dayItems(sel);
      const selEvents = this.showEvents ? selItems.events : [];
      const selTasks = this.showTasks ? selItems.tasks : [];

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>Calendar</h1>
            <div class="sub">${sun.eventCount} event${sun.eventCount === 1 ? '' : 's'} · ${sun.taskCount} task due · ${sun.busy} busy day${sun.busy === 1 ? '' : 's'} this month</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-ghost btn-sm" id="cal-today">Today</button>
            <button class="btn btn-primary btn-sm" id="cal-new">${icon('plus', 14)} New event</button>
          </div>
        </div>

        <div class="cal-layout" style="margin-top:var(--sp-4)">
          <section class="card cal-card">
            <div class="cal-head">
              <div class="row gap-2" style="align-items:center">
                <button class="iconbtn" id="cal-prev" aria-label="Previous month">${icon('chevL', 15)}</button>
                <button class="iconbtn" id="cal-next" aria-label="Next month">${icon('chevR', 15)}</button>
                <div class="cal-month">${MONTHS[this.month]} <span class="t-faint">${this.year}</span></div>
              </div>
              <div class="row gap-2">
                <button class="btn btn-ghost btn-sm ${this.showEvents ? 'is-on' : ''}" data-cal-toggle="events" aria-pressed="${this.showEvents}">
                  <span class="cal-dot" style="background:var(--accent)"></span> Events
                </button>
                <button class="btn btn-ghost btn-sm ${this.showTasks ? 'is-on' : ''}" data-cal-toggle="tasks" aria-pressed="${this.showTasks}">
                  <span class="cal-dot" style="background:var(--cyan)"></span> Tasks
                </button>
              </div>
            </div>

            <div class="cal-grid" role="grid" aria-label="${MONTHS[this.month]} ${this.year}">
              ${DOW.map(d => `<div class="cal-dow" role="columnheader">${d}</div>`).join('')}
              ${sun.weeks.flat().map(d => this._cell(d, sel)).join('')}
            </div>
          </section>

          <aside class="card cal-side">
            ${this._sidePanel(sel, selEvents, selTasks)}
          </aside>
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Calendar', `${MONTHS[this.month]} ${this.year}`);
    },

    _cell(d, sel) {
      const evs = this.showEvents ? d.events : [];
      const tks = this.showTasks ? d.tasks : [];
      const shown = [...evs, ...tks];
      const MAX = 3;
      const extra = shown.length - MAX;

      return `
        <div class="cal-cell ${d.inMonth ? '' : 'is-out'} ${d.isToday ? 'is-today' : ''} ${d.key === sel ? 'is-sel' : ''} ${d.isWeekend ? 'is-weekend' : ''}"
             role="gridcell" data-cal-day="${d.key}" tabindex="0"
             aria-label="${d.day} ${MONTHS[d.date.getMonth()]}, ${shown.length} item${shown.length === 1 ? '' : 's'}">
          <div class="cal-daynum">${d.day}</div>
          <div class="cal-items">
            ${shown.slice(0, MAX).map(it => `
              <div class="cal-pill ${it.type === 'task' ? 'is-task' : ''} ${it.done ? 'is-done' : ''}"
                   data-cal-item="${it.type}" data-cal-id="${it.id}"
                   title="${esc(it.title)}">
                ${it.type === 'event'
                  ? `<span class="cal-dot" style="background:${it.color}"></span>`
                  : `<span class="cal-dot cal-dot-task"></span>`}
                <span class="cal-pill-t">${esc(it.title)}</span>
              </div>`).join('')}
            ${extra > 0 ? `<div class="cal-more" data-cal-day="${d.key}">+${extra} more</div>` : ''}
          </div>
        </div>`;
    },

    _sidePanel(sel, events, tasks) {
      const d = new Date(sel + 'T00:00:00');
      const label = isNaN(d) ? sel : `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
      const isToday = sel === todayKey();
      const total = events.length + tasks.length;

      return `
        <div class="cal-side-head">
          <div>
            <div class="t-eyebrow">${isToday ? 'Today' : 'Selected day'}</div>
            <div class="cal-side-date">${label}</div>
          </div>
          <button class="iconbtn" id="cal-dayadd" aria-label="Add event on this day">${icon('plus', 15)}</button>
        </div>

        ${total ? `
          ${events.length ? `
            <div class="p-sec">
              <div class="p-label">Events · ${events.length}</div>
              <div class="cal-list">
                ${events.map(u => `
                  <div class="cal-row" data-cal-event="${u.id}">
                    <span class="cal-row-bar" style="background:${u.color}"></span>
                    <span class="cal-row-main">
                      <span class="cal-row-title">${esc(u.title)}</span>
                      <span class="cal-row-time">${esc(u.time)}</span>
                    </span>
                    <button class="iconbtn" data-cal-event-open="${u.id}" aria-label="Event details">${icon('arrowR', 13)}</button>
                  </div>`).join('')}
              </div>
            </div>` : ''}

          ${tasks.length ? `
            <div class="p-sec">
              <div class="p-label">Tasks due · ${tasks.length}</div>
              <div class="cal-list">
                ${tasks.map(t => `
                  <div class="cal-row is-task ${t.raw.done ? 'is-done' : ''}">
                    <button class="check ${t.raw.done ? 'is-done' : ''}" data-cal-task-toggle="${t.id}"
                      role="checkbox" aria-checked="${!!t.raw.done}" aria-label="Complete ${esc(t.title)}">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </button>
                    <span class="cal-row-main" data-cal-task="${t.id}" role="button" tabindex="0">
                      <span class="cal-row-title">${esc(t.title)}</span>
                      <span class="cal-row-time">${esc(t.raw.project || t.raw.priority || '')}${t.time ? ' · ' + esc(t.time) : ''}</span>
                    </span>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        ` : `
          <div class="empty" style="padding:var(--sp-6) 0">
            <div class="empty-ic">${icon('calendar', 20)}</div>
            <h4 style="font-size:var(--fs-sm)">Nothing scheduled</h4>
            <p>${isToday ? 'Your day is clear.' : 'This day is free.'}</p>
            <button class="btn btn-ghost btn-sm" style="margin-top:var(--sp-3)" data-cal-addhere>${icon('plus', 13)} Add an event</button>
          </div>`}

        <div class="cal-side-foot">
          <button class="btn btn-ghost btn-sm btn-block" id="cal-dayview">${icon('list', 13)} Open this day in Tasks</button>
        </div>`;
    },

    bind() {
      const mount = $('#page-mount');
      if (!mount) return;

      const prev = $('#cal-prev', mount);
      if (prev) prev.addEventListener('click', () => this._shift(-1));
      const next = $('#cal-next', mount);
      if (next) next.addEventListener('click', () => this._shift(1));
      const today = $('#cal-today', mount);
      if (today) today.addEventListener('click', () => {
        const now = new Date();
        this.year = now.getFullYear(); this.month = now.getMonth();
        this.selected = todayKey();
        this.render();
      });

      const nu = $('#cal-new', mount);
      if (nu) nu.addEventListener('click', () => this.openEvent(null, this.selected));

      $$('[data-cal-toggle]', mount).forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.calToggle;
        if (k === 'events') this.showEvents = !this.showEvents;
        if (k === 'tasks') this.showTasks = !this.showTasks;
        this.render();
      }));

      // Clicking a day selects it (and switches month if it belongs to another).
      $$('[data-cal-day]', mount).forEach(c => {
        const pick = () => {
          const key = c.dataset.calDay;
          const dt = new Date(key + 'T00:00:00');
          if (!isNaN(dt)) { this.year = dt.getFullYear(); this.month = dt.getMonth(); }
          this.selected = key;
          this.render();
        };
        c.addEventListener('click', pick);
        c.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });
      });

      // Items on the grid open their own detail surfaces.
      $$('[data-cal-item]', mount).forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const id = b.dataset.calId;
        if (b.dataset.calItem === 'task') TaskDetail.open(id);
        else this.openEvent(id);
      }));

      $$('[data-cal-event-open]', mount).forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        this.openEvent(b.dataset.calEventOpen);
      }));

      $$('[data-cal-task]', mount).forEach(b => {
        const go = () => TaskDetail.open(b.dataset.calTask);
        b.addEventListener('click', go);
        b.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      });

      $$('[data-cal-task-toggle]', mount).forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const t = State.toggleTask(b.dataset.calTaskToggle);
        if (t) Toast.show(t.done ? `Completed “${t.title}”` : `Reopened “${t.title}”`,
          t.done ? 'good' : 'default');
        this.render();
      }));

      const addHere = $('[data-cal-addhere]', mount);
      if (addHere) addHere.addEventListener('click', () => this.openEvent(null, this.selected));
      const dayAdd = $('#cal-dayadd', mount);
      if (dayAdd) dayAdd.addEventListener('click', () => this.openEvent(null, this.selected));

      const dv = $('#cal-dayview', mount);
      if (dv) dv.addEventListener('click', () => {
        TasksPage.view = 'all';
        Router.go('tasks');
        Toast.show('Showing all tasks', 'default');
      });
    },

    _shift(n) {
      let m = this.month + n, y = this.year;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      this.month = m; this.year = y;
      this.render();
    },

    /* Create / edit an event. Passing an id edits; null creates on `dateKey`. */
    openEvent(id, dateKey) {
      const ev = id ? State.upcoming.find(u => u.id === id) : null;
      const editing = !!ev;
      const date = ev ? ev.date : (dateKey || todayKey());

      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">${editing ? 'Edit event' : 'New event'}</div>
            <h2 class="t-h2" style="margin-top:6px">${editing ? esc(ev.title) : 'Schedule something'}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Title</span>
            <input class="field" id="ce-title" value="${editing ? esc(ev.title) : ''}"
              placeholder="e.g. Design review" autofocus>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Date</span>
              <input class="field" type="date" id="ce-date" value="${date}">
            </label>
            <label class="field-group">
              <span class="field-label">Time</span>
              <input class="field" id="ce-time" value="${editing ? esc(ev.time) : ''}"
                placeholder="02:00 PM – 03:00 PM">
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Kind</span>
              <select class="select" id="ce-kind">
                ${EVENT_KINDS.map(k => `<option ${editing && ev.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
              </select>
            </label>
            <label class="field-group">
              <span class="field-label">Colour</span>
              <select class="select" id="ce-color">
                ${EVENT_COLORS.map(c => `<option value="${c}" ${editing && ev.color === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="field-group">
            <span class="field-label">Notes <span class="t-faint">(optional)</span></span>
            <textarea class="textarea" id="ce-notes" rows="2" placeholder="Anything to remember">${editing ? esc(ev.notes || '') : ''}</textarea>
          </label>
        </div>
        <div class="modal-actions">
          ${editing ? `<button class="btn btn-ghost act-danger" id="ce-del" style="margin-right:auto">${icon('trash', 13)} Delete</button>` : ''}
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="ce-save">${editing ? 'Save changes' : 'Add event'}</button>
        </div>`, { cls: 'modal-md' });

      const titleEl = $('#ce-title', wrap);
      const save = () => {
        const title = titleEl.value.trim();
        if (!title) { titleEl.focus(); Toast.show('Give the event a title', 'warn'); return; }
        const fields = {
          title,
          date: $('#ce-date', wrap).value || todayKey(),
          time: $('#ce-time', wrap).value.trim() || 'All day',
          kind: $('#ce-kind', wrap).value,
          color: $('#ce-color', wrap).value,
          notes: $('#ce-notes', wrap).value.trim(),
        };
        if (editing) {
          State.updateEvent(id, fields);
          Toast.show('Event updated', 'good');
        } else {
          State.addEvent(fields);
          Toast.show(`“${title}” added`, 'good');
        }
        Overlay.close();
        // Make sure the new/edited event is visible: jump to its month + day.
        const dt = new Date(fields.date + 'T00:00:00');
        if (!isNaN(dt)) { this.year = dt.getFullYear(); this.month = dt.getMonth(); }
        this.selected = fields.date;
        this.render();
        Dashboard.render();
      };

      $('#ce-save', wrap).addEventListener('click', save);
      titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });

      const del = $('#ce-del', wrap);
      if (del) del.addEventListener('click', () => {
        State.deleteEvent(id);
        Overlay.close();
        this.render();
        Dashboard.render();
        Toast.show('Event deleted', 'default');
      });

      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => titleEl.focus(), 40);
    },
  };

  /* ======================================================================
     TASK DETAIL PANEL — Milestone 16
     A right-edge drawer showing everything about one task: inline-editable
     title and notes, status/priority, dates, project, goal, tags, subtasks,
     a time estimate vs. actual read-out, an activity trail, and the full
     action set (Complete / Duplicate / Move / Archive / Delete).
     Every edit writes through State, so all dependent systems stay in sync.
     ====================================================================== */
  const TaskDetail = {
    taskId: null,
    tagDraft: '',
    /* Local (this-session) trail for the open task, newest first. We do not
       invent history: the panel merges this with real workspace activity
       that references the task, plus the task's own timestamps. */
    _trail: [],

    open(id) {
      const t = State.tasks.find(x => x.id === id);
      if (!t) { Toast.show('That task no longer exists', 'warn'); return; }
      this.taskId = id;
      this._trail = [];
      const panel = Overlay.panel(this._html(t), { wide: true });
      this._bind(panel);
      return panel;
    },

    close() { Overlay.close(); this.taskId = null; },

    /* Re-render in place, preserving scroll position so the panel does not
       jump when a subtask is ticked. */
    refresh() {
      const panel = $('.panel');
      if (!panel || !this.taskId) return;
      const t = State.tasks.find(x => x.id === this.taskId);
      if (!t) { this.close(); return; }
      const body = $('.panel-body', panel);
      const scroll = body ? body.scrollTop : 0;
      panel.outerHTML = this._panelMarkup(t);
      const next = $('.panel');
      this._bind(next);
      const nb = $('.panel-body', next);
      if (nb) nb.scrollTop = scroll;
    },

    _panelMarkup(t) {
      return `<aside class="panel panel-wide" role="dialog" aria-modal="true">${this._html(t)}</aside>`;
    },

    _html(t) {
      const prio = t.priority || 'Medium';
      const status = t.archived ? 'Archived' : (t.done ? 'Completed' : 'Active');
      const proj = t.project || 'Personal';
      const subTotal = (t.subtasks || []).length;
      const subDone = (t.subtasks || []).filter(s => s.done).length;
      const pct = subTotal ? Math.round(subDone / subTotal * 100) : 0;
      const created = this._fmtStamp(t.createdAt);
      const updated = this._fmtStamp(t.updatedAt);
      const completed = t.completedAt ? this._fmtStamp(t.completedAt) : null;
      /* Files attached to this task — derived by scanning the file collection,
         so the two sides can never disagree. */
      const files = Derive.filesFor('task', t.id);

      /* Trail: merges this session's edits for the task with real workspace
         activity that references it, plus its own timestamps. Ordered
         newest-first; each entry carries a real timestamp, never a guess. */
      const refRe = new RegExp(t.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const related = (State.activity || [])
        .filter(a => a.kind === 'task' && refRe.test(a.text || ''))
        .slice(0, 4)
        .map(a => ({ text: a.text, at: Derive.activityTime(a) }));

      const trail = [
        ...this._trail,
        ...(t.done && t.completedAt ? [{ text: 'Task completed', at: completed }] : []),
        ...related,
        ...(t.archived ? [{ text: 'Task archived', at: updated }] : []),
        { text: 'Last updated', at: updated },
        { text: 'Task created', at: created },
      ];

      return `
        <div class="panel-head">
          <div class="panel-head-main">
            <div class="t-eyebrow">Task detail</div>
            <div class="row gap-2" style="margin-top:8px;flex-wrap:wrap">
              <span class="badge ${t.done ? 'badge-good' : t.archived ? '' : 'badge-brand'}">${status}</span>
              <span class="badge ${prio === 'High' ? 'badge-bad' : prio === 'Medium' ? 'badge-warn' : ''}">${prio} priority</span>
              ${subTotal ? `<span class="badge">${subDone}/${subTotal} subtasks</span>` : ''}
            </div>
          </div>
          <button class="iconbtn" data-pd-close aria-label="Close details">${icon('x', 15)}</button>
        </div>

        <div class="panel-body">
          <textarea class="panel-title" id="pd-title" rows="2"
            aria-label="Task title" placeholder="Untitled task">${esc(t.title)}</textarea>

          <div class="p-sec">
            <div class="p-label">Notes</div>
            <textarea class="p-desc" id="pd-desc"
              aria-label="Task notes" placeholder="Add context, links, or acceptance criteria…">${esc(t.description || '')}</textarea>
          </div>

          <div class="p-sec">
            <div class="p-label">Status</div>
            <div class="p-chips">
              ${[
                ['active', 'Active'],
                ['done', t.done ? 'Completed ✓' : 'Completed'],
                ['archived', 'Archived'],
              ].map(([k, label]) => {
                const on = (k === 'active' && !t.done && !t.archived)
                        || (k === 'done' && t.done)
                        || (k === 'archived' && t.archived);
                return `<button class="p-chip ${on ? 'is-on' : ''}" data-pd-status="${k}">${label}</button>`;
              }).join('')}
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Priority</div>
            <div class="p-chips">
              ${['High', 'Medium', 'Low'].map(p => `
                <button class="p-chip ${prio === p ? 'is-on' : ''}" data-pd-prio="${p}">${p}</button>`).join('')}
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Details</div>
            <div class="p-row">
              <span class="p-key">Project</span>
              <span class="p-val">
                <select class="select" id="pd-proj" style="height:30px;padding:0 26px 0 10px;font-size:var(--fs-xs);width:auto">
                  ${this._projectOptions(proj)}
                </select>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Due</span>
              <span class="p-val">
                <select class="select" id="pd-due" style="height:30px;padding:0 26px 0 10px;font-size:var(--fs-xs);width:auto">
                  ${['Today', 'Tomorrow', 'This week', 'No date'].map(d =>
                    `<option ${Derive.dueLabel(t.due) === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Estimate</span>
              <span class="p-val">
                <input class="field" id="pd-est" type="number" min="0" step="5"
                  value="${t.estimate ?? ''}" placeholder="—"
                  style="height:30px;width:84px;text-align:right;font-size:var(--fs-xs)">
                <span class="t-faint t-sm" style="margin-left:6px">min</span>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Goal</span>
              <span class="p-val">
                <select class="select" id="pd-goal" style="height:30px;padding:0 26px 0 10px;font-size:var(--fs-xs);width:auto">
                  <option value="" ${!t.goalId ? 'selected' : ''}>Not linked</option>
                  ${State.goals.map(g =>
                    `<option value="${g.id}" ${t.goalId === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
                </select>
              </span>
            </div>
            <div class="p-row">
              <span class="p-key">Recurrence</span>
              <span class="p-val t-muted">${t.recurrence ? esc(t.recurrence) : 'Does not repeat'}</span>
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">Tags</div>
            <div class="p-chips" id="pd-tags">
              ${(t.tags || []).map(tag => `
                <span class="tagpill">${esc(tag)}<button class="task-act" style="width:auto;height:auto;padding:0 0 0 4px"
                  data-pd-untag="${esc(tag)}" aria-label="Remove tag ${esc(tag)}">${icon('x', 10)}</button></span>`).join('')}
              <input class="field" id="pd-tagin" placeholder="Add tag…"
                style="height:26px;width:104px;font-size:var(--fs-xs)" aria-label="Add a tag">
            </div>
          </div>

          <div class="p-sec">
            <div class="p-label">
              Subtasks${subTotal ? ` · ${pct}%` : ''}
            </div>
            ${subTotal ? `<div class="meter" style="margin:0 0 var(--sp-3)"><div class="meter-fill" style="width:${pct}%"></div></div>` : ''}
            <div id="pd-subs">
              ${(t.subtasks || []).map(s => `
                <div class="p-sub ${s.done ? 'is-done' : ''}">
                  <button class="check ${s.done ? 'is-done' : ''}" data-pd-subtoggle="${s.id}"
                    role="checkbox" aria-checked="${s.done}" aria-label="Toggle subtask ${esc(s.title)}">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </button>
                  <span class="p-sub-title">${esc(s.title)}</span>
                  <button class="task-act act-danger p-sub-del" data-pd-subdel="${s.id}"
                    aria-label="Delete subtask ${esc(s.title)}">${icon('trash', 13)}</button>
                </div>`).join('')}
            </div>
            <button class="p-subadd" id="pd-subadd">
              <span class="task-add-ic">${icon('plus', 12)}</span>
              <span>Add subtask</span>
            </button>
          </div>

          <div class="p-sec">
            <div class="p-label">Files${files.length ? ` · ${files.length}` : ''}</div>
            ${files.length
              ? `<div class="fb-list">${files.map(f => {
                  const fm = Derive.fileMeta(f), fk = fileKindMeta(fm.kind);
                  return `<button type="button" class="fb-row" data-pd-file="${esc(f.id)}"
                    aria-label="Open ${esc(f.name)} in Files">
                    <span class="fb-ic" style="color:${fk.color}">${icon(fk.icon, 12)}</span>
                    <span class="fb-name">${esc(f.name)}</span>
                    <span class="t-faint">${fm.sizeLabel}</span>
                  </button>`;
                }).join('')}</div>`
              : `<p class="t-faint t-sm" style="margin:0">Nothing attached to this task yet.</p>`}
            <input type="file" id="pd-filein" multiple hidden>
            <button class="p-subadd" data-pd-fileadd>
              <span class="task-add-ic">${icon('plus', 12)}</span>
              <span>Attach a file</span>
            </button>
          </div>

          <div class="p-sec">
            <div class="p-label">Activity</div>
            <div class="p-feed">
              ${trail.map(ev => `
                <div class="p-feed-item">
                  <span class="p-feed-dot"></span>
                  <div>
                    <div class="p-feed-txt">${esc(ev.text)}</div>
                    <div class="p-feed-time">${esc(ev.at || '')}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="panel-foot">
          <button class="btn ${t.done ? 'btn-ghost' : 'btn-primary'} btn-sm" data-pd-complete>
            ${t.done ? icon('reset', 13) + ' Reopen' : icon('check', 13) + ' Complete'}
          </button>
          <button class="btn btn-ghost btn-sm" data-pd-dup>${icon('copy', 13)} Duplicate</button>
          <button class="btn btn-ghost btn-sm" data-pd-archive>${icon('archive', 13)} ${t.archived ? 'Unarchive' : 'Archive'}</button>
          <button class="btn btn-ghost btn-sm act-danger" data-pd-del style="margin-left:auto">${icon('trash', 13)} Delete</button>
        </div>`;
    },

    _projectOptions(current) {
      const names = [...new Set([
        ...State.projects.map(p => p.name),
        ...State.tasks.map(t => t.project).filter(Boolean),
        'Personal',
      ])];
      return names.map(n => `<option ${n === current ? 'selected' : ''}>${esc(n)}</option>`).join('');
    },

    _goalName(goalId) {
      if (!goalId) return 'Not linked';
      const g = State.goals.find(x => x.id === goalId);
      return g ? g.name : 'Not linked';
    },

    _fmtStamp(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (sameDay) return `Today · ${time}`;
      return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${time}`;
    },

    /* Record a local trail entry and refresh the feed. */
    _log(text) {
      this._trail.unshift({ text, at: this._fmtStamp(new Date().toISOString()) });
    },

    _bind(panel) {
      if (!panel) return;
      const id = this.taskId;
      const t = () => State.tasks.find(x => x.id === id);

      panel.addEventListener('click', e => {
        // Close
        if (e.target.closest('[data-pd-close]')) return this.close();

        // Complete / reopen
        if (e.target.closest('[data-pd-complete]')) {
          const task = State.toggleTask(id);
          if (task) Toast.show(task.done ? `Completed “${task.title}”` : `Reopened “${task.title}”`,
            task.done ? 'good' : 'default');
          TasksPage.render();
          return this.refresh();
        }

        // Status chips
        const st = e.target.closest('[data-pd-status]');
        if (st) {
          const v = st.dataset.pdStatus;
          if (v === 'active') {
            const task = t();
            State.updateTask(id, { done: false });
            State.setTaskStatus(id, 'today');
            if (task) task.archived = false;
            State.emit('task:status');
          } else if (v === 'done') {
            State.updateTask(id, { done: true });
            State.setTaskStatus(id, 'done');
          } else {
            State.setTaskStatus(id, 'archived');
          }
          TasksPage.render();
          return this.refresh();
        }

        // Priority chips
        const pr = e.target.closest('[data-pd-prio]');
        if (pr) {
          State.updateTask(id, { priority: pr.dataset.pdPrio });
          this._log(`Priority set to ${pr.dataset.pdPrio}`);
          TasksPage.render();
          return this.refresh();
        }

        // Subtask toggle / delete
        const stg = e.target.closest('[data-pd-subtoggle]');
        if (stg) {
          State.toggleSubtask(id, stg.dataset.pdSubtoggle);
          TasksPage.render();
          return this.refresh();
        }
        const sdl = e.target.closest('[data-pd-subdel]');
        if (sdl) {
          State.removeSubtask(id, sdl.dataset.pdSubdel);
          this._log('Subtask removed');
          TasksPage.render();
          return this.refresh();
        }

        // Untag
        const unt = e.target.closest('[data-pd-untag]');
        if (unt) {
          const task = t();
          State.updateTask(id, { tags: (task.tags || []).filter(x => x !== unt.dataset.pdUntag) });
          this._log(`Tag “${unt.dataset.pdUntag}” removed`);
          TasksPage.render();
          return this.refresh();
        }

        // Duplicate
        if (e.target.closest('[data-pd-dup]')) {
          const copy = State.duplicateTask(id);
          TasksPage.render();
          if (copy) {
            Toast.show('Task duplicated', 'good');
            return this.open(copy.id);   // jump to the copy
          }
          return;
        }

        // Archive / unarchive
        if (e.target.closest('[data-pd-archive]')) {
          const task = t();
          const toArchive = !task.archived;
          State.setTaskStatus(id, toArchive ? 'archived' : (task.done ? 'done' : 'today'));
          Toast.show(toArchive ? 'Task archived' : 'Task restored', toArchive ? 'default' : 'good');
          TasksPage.render();
          return this.refresh();
        }

        // Delete
        if (e.target.closest('[data-pd-del]')) {
          const task = t();
          const title = task ? task.title : 'this task';
          const wrap = Overlay.open(`
            <div class="modal-head">
              <div>
                <div class="t-eyebrow">Delete task</div>
                <h2 class="t-h2" style="margin-top:6px">Remove “${esc(title)}”?</h2>
              </div>
              <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
            </div>
            <p class="t-sm t-muted">This removes the task from your workspace. This cannot be undone.</p>
            <div class="modal-actions">
              <button class="btn btn-ghost" data-close>Cancel</button>
              <button class="btn btn-danger" id="pd-del-yes">${icon('trash', 14)} Delete task</button>
            </div>`, { cls: 'modal-sm' });
          $('#pd-del-yes', wrap).addEventListener('click', () => {
            State.deleteTask(id);
            Overlay.close();
            this.taskId = null;
            TasksPage.render();
            Toast.show('Task deleted', 'default');
          });
          return;
        }
      });

      // Inline title — save on blur and on Enter.
      const titleEl = $('#pd-title', panel);
      if (titleEl) {
        const saveTitle = () => {
          const v = titleEl.value.trim();
          const task = t();
          if (!task) return;
          if (!v) { titleEl.value = task.title; return; }
          if (v !== task.title) {
            State.updateTask(id, { title: v });
            this._log('Title updated');
            TasksPage.render();
            this.refresh();
          }
        };
        titleEl.addEventListener('blur', saveTitle);
        titleEl.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); titleEl.blur(); }
        });
      }

      // Inline notes — save on blur.
      const descEl = $('#pd-desc', panel);
      if (descEl) {
        descEl.addEventListener('blur', () => {
          const task = t();
          if (!task) return;
          const v = descEl.value;
          if (v !== (task.description || '')) {
            State.updateTask(id, { description: v });
            this._log('Notes updated');
          }
        });
      }

      // Project / due / estimate
      const projEl = $('#pd-proj', panel);
      if (projEl) projEl.addEventListener('change', () => {
        State.updateTask(id, { project: projEl.value });
        this._log(`Moved to ${projEl.value}`);
        TasksPage.render();
      });
      const dueEl = $('#pd-due', panel);
      if (dueEl) dueEl.addEventListener('change', () => {
        State.updateTask(id, { due: parseDueToken(dueEl.value) });
        this._log(`Due set to ${dueEl.value}`);
        TasksPage.render();
      });
      const estEl = $('#pd-est', panel);
      if (estEl) estEl.addEventListener('change', () => {
        State.updateTask(id, { estimate: Number(estEl.value) || null });
        this._log('Estimate updated');
      });
      const goalEl = $('#pd-goal', panel);
      if (goalEl) goalEl.addEventListener('change', () => {
        const gid = goalEl.value || null;
        State.updateTask(id, { goalId: gid });
        this._log(gid ? `Linked to goal “${this._goalName(gid)}”` : 'Goal link removed');
        TasksPage.render();
        this.refresh();
      });

      // Tag input
      const tagIn = $('#pd-tagin', panel);
      if (tagIn) tagIn.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = tagIn.value.trim();
        if (!v) return;
        const task = t();
        const tags = [...new Set([...(task.tags || []), v])];
        State.updateTask(id, { tags });
        this._log(`Tag “${v}” added`);
        TasksPage.render();
        this.refresh();
      });

      // Files attached to this task — attach here, or open one in Files.
      const fileIn = $('#pd-filein', panel);
      const fileAdd = $('[data-pd-fileadd]', panel);
      if (fileIn && fileAdd) {
        fileAdd.addEventListener('click', () => fileIn.click());
        fileIn.addEventListener('change', () => {
          const picked = Array.from(fileIn.files || []);
          fileIn.value = '';
          if (!picked.length) return;
          const n = FilesPage.attachTo('task', id, picked);
          Toast.show(n ? `Attached ${n} file${n === 1 ? '' : 's'}` : 'Nothing was attached',
            n ? 'good' : 'warn');
          this.refresh();
        });
      }
      panel.querySelectorAll('[data-pd-file]').forEach(b => b.addEventListener('click', () => {
        /* Following a pointer goes through `revealRecord`, the one table that says
           where a record of each kind lives — this block used to hand-roll the
           same close-then-navigate, which meant "open this file" had two
           implementations and only one of them knew the route was already open. */
        revealRecord('file', b.dataset.pdFile);
      }));

      // Add subtask
      const subAdd = $('#pd-subadd', panel);
      if (subAdd) subAdd.addEventListener('click', () => {
        const row = el('div', { class: 'p-sub' });
        row.innerHTML = `<span class="check" aria-hidden="true">${icon('plus', 10)}</span>
          <input class="field" style="height:28px;font-size:var(--fs-sm)" placeholder="Subtask title…">`;
        const subs = $('#pd-subs', panel);
        subs.append(row);
        const input = $('input', row);
        input.focus();
        /* commit() re-renders the panel, which detaches this input and fires
           its blur handler. `settled` makes the post-commit blur a no-op so a
           single Enter can never create the subtask twice. */
        let settled = false;
        const commit = () => {
          if (settled) return;
          settled = true;
          const v = input.value.trim();
          if (v) {
            State.addSubtask(id, v);
            this._log(`Subtask “${v}” added`);
            TasksPage.render();
          }
          this.refresh();
        };
        const cancel = () => { if (settled) return; settled = true; this.refresh(); };
        input.addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
          if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
        });
        input.addEventListener('blur', () => { if (input.value.trim()) commit(); else cancel(); });
      });

      // Esc closes the panel
      panel.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !e.target.closest('input,textarea,select')) this.close();
      });
    },
  };

  /* ======================================================================
     TASKS PAGE — Milestone 15
     Views: Today · Upcoming · All · Completed.
     Filters (priority, project), sorting, grouping, inline completion,
     subtask progress, and row actions. Every control is live: the page
     renders from State and every mutation re-renders from real data —
     completion cascades to the dashboard, score, projects and analytics.
     ====================================================================== */
  const TasksPage = {
    view: 'today',          // today | upcoming | all | completed
    prioFilter: 'All',      // All | High | Medium | Low
    projFilter: null,       // project name or null
    sort: 'smart',          // smart | due | priority | created | alpha
    query: '',

    /* --- Data selection -------------------------------------------------- */

    /* Which tasks belong to the active view?
       Archived tasks are intentionally excluded from every normal view — an
       archive is a "put it away" action, not a completion state. They remain
       reachable through the task they belonged to (project/goal history) and
       in Analytics, and the detail panel can always restore one. */
    _inView(t) {
      if (t.archived) return false;
      switch (this.view) {
        case 'today':     return !t.done && t.due === todayKey();
        case 'upcoming':  return !t.done && t.due !== todayKey();
        case 'completed': return !!t.done;
        case 'all':
        default:          return true;
      }
    },

    /* Apply the toolbar filters on top of the view. */
    _filtered() {
      let list = State.tasks.filter(t => this._inView(t));
      if (this.prioFilter !== 'All') list = list.filter(t => t.priority === this.prioFilter);
      if (this.projFilter) list = list.filter(t => t.project === this.projFilter);
      if (this.query) {
        const q = this.query.toLowerCase();
        list = list.filter(t =>
          t.title.toLowerCase().includes(q) ||
          (t.project || '').toLowerCase().includes(q) ||
          (t.tags || []).some(tag => tag.toLowerCase().includes(q)));
      }
      return this._sort(list);
    },

    _sort(list) {
      const rank = { High: 0, Medium: 1, Low: 2 };
      /* Due proximity is a real comparison against the calendar now: late work
         first, then today, then anything dated, then work with no date at all. */
      const today = todayKey();
      const dueRank = d => !d ? 3 : d < today ? 0 : d === today ? 1 : 2;
      const l = [...list];
      switch (this.sort) {
        case 'priority': return l.sort((a, b) => rank[a.priority] - rank[b.priority]);
        case 'alpha':    return l.sort((a, b) => a.title.localeCompare(b.title));
        case 'created':  return l.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        case 'due':      return l.sort((a, b) => dueRank(a.due) - dueRank(b.due));
        case 'smart':
        default:
          // Incomplete first, priority, then due proximity — mirrors the
          // dashboard's ranking so the two views never disagree.
          return l.sort((a, b) =>
            (a.done - b.done) ||
            (rank[a.priority] - rank[b.priority]) ||
            (dueRank(a.due) - dueRank(b.due)));
      }
    },

    /* Group label for a task within the current view. Late work gets its own
       group rather than being filed under "Later", which is what a past date
       used to fall through to. */
    _groupOf(t) {
      if (t.done) return 'Completed';
      if (Derive.isOverdue(t)) return 'Overdue';
      if (t.due === todayKey()) return 'Today';
      if (t.due === dayKey(shiftDays(new Date(), 1))) return 'Tomorrow';
      return 'Later';
    },

    _counts() {
      const all = State.tasks;
      const isToday = t => t.due === todayKey();
      return {
        today:     all.filter(t => !t.done && isToday(t)).length,
        upcoming:  all.filter(t => !t.done && !isToday(t)).length,
        all:       all.length,
        completed: all.filter(t => t.done).length,
      };
    },

    /* --- Render ---------------------------------------------------------- */

    render() {
      const mount = $('#page-mount');
      if (!mount) return;
      // Never repaint over a different page (see Dashboard.render).
      if (Router.current !== 'tasks') return;
      if (!State.data) {
        mount.innerHTML = '<div class="page is-active"><div class="card"><div class="empty"><div class="spinner"></div><p style="margin-top:12px">Loading tasks…</p></div></div></div>';
        return;
      }

      const c = this._counts();
      const list = this._filtered();
      const s = Derive.taskSummary();

      mount.innerHTML = '';
      mount.append(el('div', { class: 'page is-active', html: `
        <div class="tasks-head page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>Tasks</h1>
            <div class="sub">${s.done} of ${s.total} complete · ${c.today} scheduled for today</div>
          </div>
          <div class="row gap-2">
            <button class="btn btn-ghost btn-sm" id="tp-complete-all" ${list.some(t => !t.done) ? '' : 'disabled'}>
              ${icon('checkAll', 14)} Complete view
            </button>
            <button class="btn btn-primary btn-sm" id="tp-new">
              ${icon('plus', 14)} New task
            </button>
          </div>
        </div>

        <div class="viewtabs" role="tablist" style="margin-top:var(--sp-4)">
          ${[
            ['today', 'Today', c.today],
            ['upcoming', 'Upcoming', c.upcoming],
            ['all', 'All', c.all],
            ['completed', 'Completed', c.completed],
          ].map(([k, label, n]) => `
            <button class="viewtab ${this.view === k ? 'is-active' : ''}" data-view="${k}"
              role="tab" aria-selected="${this.view === k}">
              ${label}<span class="vt-count">${n}</span>
            </button>`).join('')}
        </div>

        <div class="tasks-layout" style="margin-top:var(--sp-4)">
          <div>
            <section class="card" style="padding:0">
              <div class="toolbar">
                <div class="tb-group">
                  <span class="tb-label">Priority</span>
                  ${['All', 'High', 'Medium', 'Low'].map(p => `
                    <button class="chip ${this.prioFilter === p ? 'is-on' : ''}" data-prio="${p}">
                      ${p !== 'All' ? `<span class="chip-dot"></span>` : ''}${p}
                    </button>`).join('')}
                </div>
                <div class="tb-group" style="margin-left:auto">
                  ${this.projFilter ? `
                    <button class="chip is-on" data-clear-proj>
                      ${esc(this.projFilter)} ${icon('x', 11)}
                    </button>` : ''}
                  <div class="sortwrap">
                    <select class="sortsel" id="tp-sort" aria-label="Sort tasks">
                      ${[
                        ['smart', 'Smart order'],
                        ['due', 'Due soonest'],
                        ['priority', 'Priority'],
                        ['created', 'Recently created'],
                        ['alpha', 'A → Z'],
                      ].map(([k, l]) => `<option value="${k}" ${this.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            ${this._renderList(list)}
          </div>

          ${this._renderAside()}
        </div>
      ` }));

      this.bind();
      Shell.setHeader('Tasks', `${c.all} total · ${c.completed} done`);
    },

    /* Group the filtered list and render each section. */
    _renderList(list) {
      if (!list.length) {
        return `
          <section class="card" style="margin-top:var(--sp-4)">
            <div class="empty">
              <div class="empty-ic">${icon('check', 22)}</div>
              <h4>Nothing here</h4>
              <p>${this.view === 'completed'
                  ? 'No tasks completed yet — tick something off and it will appear here.'
                  : 'No tasks match the current view and filters.'}</p>
              <button class="btn btn-primary btn-sm" style="margin-top:var(--sp-4)" data-new-task>
                ${icon('plus', 14)} Add a task
              </button>
            </div>
          </section>`;
      }

      // Preserve a meaningful order of groups per view.
      const order = this.view === 'completed'
        ? ['Completed']
        : ['Overdue', 'Today', 'Tomorrow', 'Later', 'Completed'];
      const groups = new Map();
      list.forEach(t => {
        const g = this._groupOf(t);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(t);
      });

      return [...groups.keys()]
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))
        .map(name => {
          const items = groups.get(name);
          const isOverdue = name === 'Overdue';
          return `
            <div class="task-group ${isOverdue ? 'is-overdue' : ''}">
              <div class="task-group-head">
                <span class="tg-title">${name}</span>
                <span class="tg-line"></span>
                <span class="tg-count">${items.length}${items.length === 1 ? ' task' : ' tasks'}</span>
              </div>
              ${items.map(t => this._row(t)).join('')}
            </div>`;
        }).join('');
    },

    /* A single rich task row. */
    _row(t) {
      const rail = t.priority === 'High' ? 'prio-rail-high'
                 : t.priority === 'Medium' ? 'prio-rail-med' : 'prio-rail-low';
      const subTotal = (t.subtasks || []).length;
      const subDone = (t.subtasks || []).filter(s => s.done).length;
      const overdue = Derive.isOverdue(t);

      return `
        <div class="task-row is-rich ${t.done ? 'is-done' : ''} ${rail}" data-task="${t.id}">
          <button class="check ${t.done ? 'is-done' : ''}" data-toggle-task="${t.id}"
            role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Reopen' : 'Complete'} ${esc(t.title)}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </button>

          <div class="grow" style="min-width:0">
            <div class="task-title" data-open-task="${t.id}" role="button" tabindex="0">${esc(t.title)}</div>
            <div class="task-inline">
              <span class="ti-item">${icon('layers', 12)}${esc(t.project || 'Personal')}</span>
              ${t.due ? `<span class="ti-item ${overdue ? 'is-overdue' : (t.due === todayKey() ? 'is-due-soon' : '')}">
                ${icon('clock', 12)}${esc(Derive.dueLabel(t.due))}</span>` : ''}
              ${t.estimate ? `<span class="ti-item">${icon('clock', 12)}${t.estimate}m</span>` : ''}
              ${(t.tags || []).slice(0, 2).map(tag => `<span class="tagpill">${esc(tag)}</span>`).join('')}
            </div>
            ${subTotal ? `
              <div class="subprog">
                <span class="subprog-track"><span class="subprog-fill" style="width:${Math.round(subDone / subTotal * 100)}%"></span></span>
                <span class="subprog-txt">${subDone}/${subTotal} subtasks</span>
              </div>` : ''}
          </div>

          <div class="task-acts">
            <button class="task-act" data-open-task="${t.id}" aria-label="Open details" title="Details">${icon('edit', 14)}</button>
            <button class="task-act" data-dup-task="${t.id}" aria-label="Duplicate" title="Duplicate">${icon('copy', 14)}</button>
            <button class="task-act act-danger" data-del-task="${t.id}" aria-label="Delete" title="Delete">${icon('trash', 14)}</button>
          </div>
        </div>`;
    },

    /* Right-hand sidebar: progress + breakdowns that double as filters. */
    _renderAside() {
      const s = Derive.taskSummary();
      const c = this._counts();
      const pct = Math.round(s.progress * 100);
      const all = State.tasks;

      const byPrio = ['High', 'Medium', 'Low'].map(p => ({
        p, n: all.filter(t => !t.done && t.priority === p).length,
      }));

      const projects = [...new Set(all.map(t => t.project).filter(Boolean))]
        .map(name => ({ name, n: all.filter(t => t.project === name && !t.done).length }))
        .filter(x => x.n > 0)
        .sort((a, b) => b.n - a.n);

      const prioDot = p => p === 'High' ? 'var(--bad)' : p === 'Medium' ? 'var(--warn)' : 'var(--info)';

      return `
        <aside class="tasks-aside">
          <section class="card">
            <div class="card-title">Overall progress</div>
            <div class="row-between" style="margin-top:var(--sp-3)">
              <span class="t-num" style="font-size:30px;font-weight:700">${pct}%</span>
              <span class="t-faint t-sm">${s.done}/${s.total}</span>
            </div>
            <div class="meter"><div class="meter-fill" style="width:${pct}%"></div></div>
            <div class="card-sub" style="margin-top:var(--sp-3)">
              ${c.today} open today · ${c.completed} completed
            </div>
          </section>

          <section class="card">
            <div class="card-title">By priority</div>
            <div class="breakdown">
              ${byPrio.map(x => `
                <div class="bd-row ${this.prioFilter === x.p ? 'is-on' : ''}" data-prio="${x.p}">
                  <span class="bd-left">
                    <span class="bd-key" style="background:${prioDot(x.p)}"></span>${x.p}
                  </span>
                  <span class="bd-val">${x.n}</span>
                </div>`).join('')}
              ${this.prioFilter !== 'All' ? `
                <div class="bd-row" data-prio="All">
                  <span class="bd-left">${icon('x', 13)} Clear filter</span>
                </div>` : ''}
            </div>
          </section>

          <section class="card">
            <div class="card-title">By project</div>
            ${projects.length ? `
              <div class="breakdown">
                ${projects.map(x => `
                  <div class="bd-row ${this.projFilter === x.name ? 'is-on' : ''}" data-proj="${esc(x.name)}">
                    <span class="bd-left">${icon('layers', 13)}<span class="t-truncate">${esc(x.name)}</span></span>
                    <span class="bd-val">${x.n}</span>
                  </div>`).join('')}
              </div>`
              : '<div class="card-sub" style="margin-top:var(--sp-3)">No open tasks by project.</div>'}
          </section>
        </aside>`;
    },

    /* --- Events ---------------------------------------------------------- */

    bind() {
      const mount = $('#page-mount');

      // View tabs
      $$('[data-view]', mount).forEach(b => b.addEventListener('click', () => {
        this.view = b.dataset.view;
        this.render();
      }));

      // Priority filter (toolbar chips + sidebar breakdown rows)
      $$('[data-prio]', mount).forEach(b => b.addEventListener('click', () => {
        this.prioFilter = b.dataset.prio;
        this.render();
      }));

      // Project filter
      $$('[data-proj]', mount).forEach(b => b.addEventListener('click', () => {
        this.projFilter = this.projFilter === b.dataset.proj ? null : b.dataset.proj;
        this.render();
      }));
      const clearProj = $('[data-clear-proj]', mount);
      if (clearProj) clearProj.addEventListener('click', () => { this.projFilter = null; this.render(); });

      // Sort
      const sort = $('#tp-sort', mount);
      if (sort) sort.addEventListener('change', () => { this.sort = sort.value; this.render(); });

      // Completion — the cascade point.
      $$('[data-toggle-task]', mount).forEach(b => b.addEventListener('click', () => {
        const t = State.toggleTask(b.dataset.toggleTask);
        if (t) Toast.show(t.done ? `Completed “${t.title}”` : `Reopened “${t.title}”`,
          t.done ? 'good' : 'default');
        this.render();
      }));

      // Row actions
      $$('[data-dup-task]', mount).forEach(b => b.addEventListener('click', () => {
        const t = State.duplicateTask(b.dataset.dupTask);
        if (t) { Toast.show('Task duplicated', 'good'); this.render(); }
      }));
      $$('[data-del-task]', mount).forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.delTask;
        const t = State.tasks.find(x => x.id === id);
        if (!t) return;
        this._confirmDelete(t);
      }));

      // Open detail (Milestone 16 — side panel).
      $$('[data-open-task]', mount).forEach(b => b.addEventListener('click', () => this.openEdit(b.dataset.openTask)));
      $$('[data-open-task]', mount).forEach(b => b.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openEdit(b.dataset.openTask); }
      }));
      // Double-clicking anywhere on a row opens its detail too.
      $$('#page-mount .task-row.is-rich', mount).forEach(r => {
        r.addEventListener('dblclick', e => {
          if (e.target.closest('button, input, select, a')) return;
          this.openEdit(r.dataset.task);
        });
      });

      // New task
      const nu = $('#tp-new', mount); if (nu) nu.addEventListener('click', () => this.openNew());
      $$('[data-new-task]', mount).forEach(b => b.addEventListener('click', () => this.openNew()));

      // Complete every open task in the current view
      const all2 = $('#tp-complete-all', mount);
      if (all2) all2.addEventListener('click', () => this.completeView());
    },

    /* Complete every unfinished task currently in view. */
    completeView() {
      const targets = this._filtered().filter(t => !t.done);
      if (!targets.length) { Toast.show('Nothing left to complete here', 'default'); return; }
      targets.forEach(t => {
        t.done = true; t.status = 'done';
        t.completedAt = new Date().toISOString();
        t.updatedAt = new Date().toISOString();
      });
      State.activity.unshift({
        id: uid('a'), kind: 'task',
        text: `Completed ${targets.length} task${targets.length === 1 ? '' : 's'} from ${this.view} view`,
        createdAt: nowIso(),
      });
      State.emit('task:bulk-complete');
      Toast.show(`Completed ${targets.length} task${targets.length === 1 ? '' : 's'}`, 'good');
      this.render();
    },

    _confirmDelete(t) {
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">Delete task</div>
            <h2 class="t-h2" style="margin-top:6px">Remove “${esc(t.title)}”?</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <p class="t-sm t-muted">This removes the task from your workspace. This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-danger" id="tp-del-yes">${icon('trash', 14)} Delete task</button>
        </div>`, { cls: 'modal-sm' });

      $('#tp-del-yes', wrap).addEventListener('click', () => {
        State.deleteTask(t.id);
        Overlay.close();
        Toast.show('Task deleted', 'default');
        this.render();
      });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
    },

    /* --- Create / edit modal (Milestone 15; full panel lands in M16) ------ */

    openNew() { this._form(null); },

    /* Detail (Milestone 16) — the title and the edit action both open the
       side panel. Double-click on a row does too. */
    openEdit(id) { TaskDetail.open(id); },

    _form(existing) {
      const t = existing;
      const isEdit = !!t;
      const projects = [...new Set([...State.projects.map(p => p.name), ...State.tasks.map(x => x.project).filter(Boolean)])];
      const wrap = Overlay.open(`
        <div class="modal-head">
          <div>
            <div class="t-eyebrow">${isEdit ? 'Edit task' : 'New task'}</div>
            <h2 class="t-h2" style="margin-top:6px">${isEdit ? 'Update details' : 'What needs doing?'}</h2>
          </div>
          <button class="iconbtn" data-close aria-label="Close">${icon('x', 15)}</button>
        </div>
        <div class="stack gap-4">
          <label class="field-group">
            <span class="field-label">Title</span>
            <input class="field" id="tf-title" placeholder="e.g. Draft the launch email"
              value="${isEdit ? esc(t.title) : ''}" autofocus>
          </label>
          <label class="field-group">
            <span class="field-label">Notes</span>
            <textarea class="textarea" id="tf-desc" rows="3" placeholder="Optional detail…">${isEdit ? esc(t.description || '') : ''}</textarea>
          </label>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Priority</span>
              <select class="select" id="tf-prio">
                ${['High', 'Medium', 'Low'].map(p => `<option ${isEdit && t.priority === p ? 'selected' : (!isEdit && p === 'Medium' ? 'selected' : '')}>${p}</option>`).join('')}
              </select>
            </label>
            <label class="field-group">
              <span class="field-label">Due</span>
              <select class="select" id="tf-due">
                ${['Today', 'Tomorrow', 'This week', 'No date'].map(d => `<option ${isEdit && Derive.dueLabel(t.due) === d ? 'selected' : (!isEdit && d === 'Today' ? 'selected' : '')}>${d}</option>`).join('')}
              </select>
            </label>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr">
            <label class="field-group">
              <span class="field-label">Project</span>
              <select class="select" id="tf-proj">
                ${projects.map(p => `<option ${isEdit && t.project === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
                <option ${isEdit && !projects.includes(t.project) ? 'selected' : ''}>Personal</option>
              </select>
            </label>
            <label class="field-group">
              <span class="field-label">Estimate (min)</span>
              <input class="field" id="tf-est" type="number" min="0" step="5"
                value="${isEdit && t.estimate ? t.estimate : ''}" placeholder="30">
            </label>
          </div>
          <label class="field-group">
            <span class="field-label">Tags <span class="t-faint">(comma separated)</span></span>
            <input class="field" id="tf-tags" placeholder="design, urgent"
              value="${isEdit ? esc((t.tags || []).join(', ')) : ''}">
          </label>
        </div>
        <div class="modal-actions">
          ${isEdit ? `<button class="btn btn-ghost act-danger" id="tf-del" style="margin-right:auto">${icon('trash', 13)} Delete</button>` : ''}
          <button class="btn btn-ghost" data-close>Cancel</button>
          <button class="btn btn-primary" id="tf-save">${isEdit ? 'Save changes' : 'Create task'}</button>
        </div>`, { cls: 'modal-lg' });

      const titleEl = $('#tf-title', wrap);
      const save = () => {
        const title = titleEl.value.trim();
        if (!title) { titleEl.focus(); Toast.show('Add a title first', 'warn'); return; }
        const patch = {
          title,
          description: $('#tf-desc', wrap).value.trim(),
          priority: $('#tf-prio', wrap).value,
          /* The picker offers tokens; the boundary parser turns the chosen one
             into the real day key that gets stored. */
          due: parseDueToken($('#tf-due', wrap).value),
          project: $('#tf-proj', wrap).value,
          estimate: Number($('#tf-est', wrap).value) || null,
          tags: $('#tf-tags', wrap).value.split(',').map(s => s.trim()).filter(Boolean),
        };

        if (isEdit) {
          State.updateTask(t.id, patch);
          Toast.show('Task updated', 'good');
        } else {
          State.addTask(title, patch);
          Toast.show('Task created', 'good');
        }
        Overlay.close();
        this.render();
      };

      $('#tf-save', wrap).addEventListener('click', save);
      titleEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) save(); });
      const del = $('#tf-del', wrap);
      if (del) del.addEventListener('click', () => {
        Overlay.close();
        this._confirmDelete(t);
      });
      wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) Overlay.close(); });
      setTimeout(() => { titleEl.focus(); titleEl.select(); }, 40);
    },
  };

  /* ======================================================================
     BOOT
     ====================================================================== */
  async function boot() {
    // Paint the shell immediately so the app never flashes blank while the
    // database opens. Data-dependent views render once state is hydrated.
    Theme.init();
    Overlay.init();
    Router.init();
    Shell.renderNav();
    Shell.bindControls();
    Palette.initHotkey();
    Motion.init();

    // Keep the palette's index fresh whenever workspace data changes.
    State.subscribe(() => { Palette.all = null; });

    /* The sidebar's plan chips are a view of the entitlement, not a copy of it,
       so they repaint on the same signal every other derived surface uses.
       The same signal is where the automation engine learns that the gate has
       opened: a workspace that has just become Pro must not need a reload before
       its rules can run. `runDueAutomations` only emits `automation:*`, so this
       cannot recurse. */
    State.subscribe((data, reason) => {
      Shell.syncPlan();
      Shell.syncUserName();
      Shell.syncNotifications();
      if (reason === 'entitlement:change') State.runDueAutomations();
    });

    // Dashboard — Milestones 5–12.
    Router.register('dashboard', () => Dashboard.render());

    // Tasks — Milestone 15.
    Router.register('tasks', () => TasksPage.render());

    // Projects — Milestone 17.
    Router.register('projects', () => ProjectsPage.render());

    // Goals — Milestone 18.
    Router.register('goals', () => GoalsPage.render());

    // Calendar — Milestone 19.
    Router.register('calendar', () => CalendarPage.render());

    // Habits — Milestone 20.
    Router.register('habits', () => HabitsPage.render());

    // Focus — Milestone 21.
    Router.register('focus', () => FocusPage.render());

    // Notes — Milestone 22.
    Router.register('notes', opts => NotesPage.render(opts));

    // Knowledge — Milestone 23.
    Router.register('knowledge', opts => KnowledgePage.render(opts));

    // Journal — Milestone 24.
    Router.register('journal', () => JournalPage.render());

    // Inbox — Milestone 25.
    Router.register('inbox', () => InboxPage.render());

    // Finance — Milestone 26.
    Router.register('finance', () => FinancePage.render());

    // Files — Milestone 28.
    Router.register('files', () => FilesPage.render());

    // Search — Milestone 29. Reached from the palette, and carries a query.
    Router.register('search', opts => SearchPage.render(opts));

    // Activity — Milestone 30.
    Router.register('activity', opts => ActivityPage.render(opts));

    // Analytics — Milestone 31.
    Router.register('analytics', opts => AnalyticsPage.render(opts));

    // Reviews — Milestone 32. Reached from the palette and from Analytics.
    Router.register('reviews', opts => ReviewsPage.render(opts));

    // Time Machine — Milestone 33, the first Pro feature.
    Router.register('time', opts => TimeMachinePage.render(opts));

    // NEXUS Pro — Milestone 33. The one place a gate can change its answer.

    // Automation — Milestone 35, the second Pro feature.
    Router.register('automation', () => AutomationPage.render());

    // Templates — Milestone 37, the third Pro feature.
    Router.register('templates', () => TemplatesPage.render());
    Router.register('settings', () => SettingsPage.render());

    // Fallback route for not-yet-built modules.
    Router.register('__stub', name => {
      const item = NAV.flatMap(g => g.items).find(i => i.route === name);
      const label = item ? item.label : 'Module';
      Shell.setHeader(label, 'Coming in a later milestone');
      return el('div', { class: 'page is-active', html: `
        <div class="page-head">
          <div>
            <div class="t-eyebrow">Personal workspace</div>
            <h1>${label}</h1>
            <div class="sub">This module is scheduled for a later milestone.</div>
          </div>
        </div>
        <div class="card"><div class="empty">
          <div class="empty-ic">${icon(item ? item.icon : 'grid', 22)}</div>
          <h4>${label} is on the roadmap</h4>
          <p>Built one production-quality piece at a time — foundation first.</p>
        </div></div>` });
    });

    // Route every nav item: real routes if registered, else the stub.
    NAV.flatMap(g => g.items).forEach(it => {
      if (!Router.routes[it.route]) Router.register(it.route, () => Router.routes.__stub(it.route));
    });
    /* M38 registered the last one: every route in `NAV` and every route the app
       can reach is now a real page. `__stub` is kept as the safety net for a
       route that is added before its module is (it renders an honest "not yet"
       rather than a blank screen), but nothing reaches it today. */

    // Hydrate the workspace from IndexedDB, then paint real data.
    await State.init();
    /* Then let the rules run — BEFORE the first paint, so the workspace already
       contains what they made. This is the whole "runs itself" promise: there is
       no timer and no background service, just a fold against the calendar on
       every load. It is idempotent, because each rule carries the day of the last
       occurrence it actually made. */
    State.runDueAutomations();
    /* Then drop notification decisions whose day has arrived. They describe
       alerts that can never recur — a past day never becomes current again — so
       the stored map stays bounded instead of growing for the life of the
       workspace. Cheap: it reads one localStorage record. */
    State.pruneNotificationState();
    Shell.syncPlan();
    Shell.syncUserName();
    Shell.syncNotifications();
    Router.render(location.hash.slice(1) || 'dashboard');

    /* Flush pending writes whenever the page might be going away.
       `beforeunload` alone is not enough — the browser can tear the page down
       before an async IndexedDB transaction commits. `pagehide` fires earlier
       in the same teardown, and `visibilitychange` catches the tab being
       backgrounded (and, on mobile, the app being killed). Belt and braces on
       top of the leading-edge flush in scheduleSave(). */
    const flushNow = () => { clearTimeout(State._saveTimer); State.flush(); };
    window.addEventListener('beforeunload', flushNow);
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });
  }

  document.addEventListener('DOMContentLoaded', boot);

  /* Expose the module surface for diagnostics and automated verification.
     Read-only introspection: nothing here changes behaviour. */
  const NEXUS = { CONFIG, NAV, MOBILE_NAV, ICONS, icon, el, $, $$, esc, fmt, clamp, clock, uid,
           Toast, Theme, THEMES, Overlay, Router, Shell,
           State, Derive, DEMO, Task, normalizeTask, parseDueToken, Widgets, Dashboard, TasksPage, TaskDetail,
           ProjectsPage, ProjectDetail, GoalsPage, GoalDetail, HORIZONS, LIFE_AREAS, Focus, Palette,
           CalendarPage, MONTHS, DOW, dayKey, todayKey, shiftDays, normalizeEvent,
           HabitsPage, HabitDetail, HABIT_ICONS, HABIT_COLORS, normalizeHabit,
           FocusPage, FOCUS_MODES, normalizeFocusSession,
           NotesPage, normalizeNote, repairNoteHierarchy, REF_TYPES,
           KnowledgePage,
           JournalPage, normalizeJournal, journalRating,
           InboxPage, normalizeInbox, INBOX_KINDS, INBOX_DESTS,
           FinancePage, normalizeTransaction, normalizeFinance, CURRENCIES,
           FINANCE_CATEGORIES, buildDemoTransactions,
           FilesPage, normalizeFile, fileKind, FILE_REF_META, FILE_KIND_META,
           buildDemoFiles, DEMO_FILES,
           SearchPage, SEARCH_SOURCES, searchSource, revealRecord, RECORD_ROUTES,
           ActivityPage, normalizeActivity, ACTIVITY_KINDS, activityKind,
           AnalyticsPage,
           ReviewsPage, normalizeReview, REVIEW_KINDS, reviewKind, reviewStart, reviewRating,
           FeatureAccess, FEATURES, featureMeta, TimeMachinePage, ProPage, renderLocked,
           PLANS, PLAN_ORDER, planMeta, PRICING_FAQ, PRO_FEATURE_MATRIX, FREE_INCLUDES,
           normalizeEntitlement, fmtDate,
           AutomationPage, normalizeAutomation, AUTOMATION_TRIGGERS, AUTOMATION_ACTIONS,
           automationTrigger, automationAction, AUTOMATION_CATCHUP, normalizeOrigin,
           TemplatesPage, normalizeTemplate, normalizeTemplateItem, TEMPLATE_ICONS,
           TEMPLATE_MAX_ITEMS, TEMPLATE_NOUNS, templateIcon,
           Onboarding, SettingsPage, normalizeUser, START_HERE, startHere, USER_NAME_MAX,
           Workspace, EXPORT_COLLECTIONS, EXPORT_FORMAT, EXPORT_PREFS, exportLabel,
           recordSummaryLine, DASH_CARDS, DASH_KEYS, DASH_COLS, dashCard, pickDashBoard,
           DAILY_LINES,
           pickPreferences, focusTargetLabel, base64Bytes, bytesToBase64, base64ToBytes,
           normalizeProject, normalizeGoal, FOCUS_TARGET_MIN, FOCUS_TARGET_MAX,
           DOW_FULL, ordinal,
           Notifications, NOTIFICATION_KINDS, notificationKind, NOTIFICATION_WAIT_DAYS,
           firstOfNextMonth,
           StorageService, Repo, Settings, todayMeta, greeting, Motion };
  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (location.hash.length > 1 && location.hash !== '#dashboard') {
      window.history.back();
    } else {
      CapApp.exitApp();
    }
  });

  if (typeof window !== 'undefined') window.__NEXUS__ = NEXUS;
  return NEXUS;
})();

