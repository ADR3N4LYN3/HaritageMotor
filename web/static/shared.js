/* ============================================================
   Heritage Motor — Shared JS
   Extracted from landing pages (index, contact, privacy, legal, 404)
   Expects: window.i18n object defined BEFORE this script loads.
   ============================================================ */

(function() {
  'use strict';

  /* ==========================================================
     i18n — language switching
     Each page defines `window.i18n` before loading this script.
     ========================================================== */

  // Store original EN content for data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(function(el) { el._origHTML = el.cloneNode(true); });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) { el._origHTML = el.cloneNode(true); });
  document.querySelectorAll('[data-i18n-ph]').forEach(function(el) { el._origPH = el.placeholder; });

  var pageI18n = window.i18n || {};

  /* Update drawer lang button flag + label — safe: hardcoded SVG from data-lang values only */
  function updateDrawerLangBtn(l) {
    var dlFlag = document.getElementById('drawerLangFlag');
    var dlLabel = document.getElementById('drawerLangLabel');
    if (!dlFlag || !dlLabel) return;
    dlLabel.textContent = l.toUpperCase();
    var src = document.querySelector('#drawerLangDrop button[data-lang="' + l + '"] .flag-icon');
    if (src) {
      var clone = src.cloneNode(true);
      clone.setAttribute('width', '16');
      clone.setAttribute('height', '12');
      dlFlag.replaceChildren(clone);
    }
  }

  // Expose for page-specific scripts that need to call it
  window._hmUpdateDrawerLangBtn = updateDrawerLangBtn;

  function setLang(lang) {
    document.documentElement.lang = lang;
    var dict = pageI18n[lang] || {};

    // data-i18n elements
    // Safe: values come from hardcoded i18n dict defined in each page, not user input
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      if (dict[key]) {
        var temp = document.createElement('template');
        temp.innerHTML = dict[key]; /* eslint-disable-line no-unsanitized/property -- trusted hardcoded i18n dict, not user input */
        el.replaceChildren(temp.content);
      } else if (el._origHTML) {
        el.replaceChildren.apply(el, Array.from(el._origHTML.cloneNode(true).childNodes));
      }
    });

    // data-i18n-ph elements (placeholders, e.g. contact form)
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-ph');
      el.placeholder = (dict[key]) || el._origPH || '';
    });

    // Cookie banner i18n — safe: hardcoded dict values only, never user input
    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      var hKey = el.getAttribute('data-i18n-html');
      if (dict[hKey]) {
        var tmpl = document.createElement('template');
        tmpl.innerHTML = dict[hKey]; /* eslint-disable-line no-unsanitized/property -- trusted i18n dict, not user input */
        el.replaceChildren(tmpl.content);
      } else if (el._origHTML) {
        el.replaceChildren.apply(el, Array.from(el._origHTML.cloneNode(true).childNodes));
      }
    });

    // data-lang-block elements (privacy, legal page content blocks)
    document.querySelectorAll('[data-lang-block]').forEach(function(el) {
      el.hidden = el.getAttribute('data-lang-block') !== lang;
    });

    // Update desktop lang switcher
    var langCurrentEl = document.getElementById('langCurrent');
    if (langCurrentEl) {
      langCurrentEl.textContent = lang.toUpperCase();
    }
    document.querySelectorAll('.lang-opt').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    var langSwitchEl = document.getElementById('langSwitch');
    if (langSwitchEl) {
      langSwitchEl.classList.remove('open');
    }

    // Update drawer lang buttons
    document.querySelectorAll('#drawerLangDrop button').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    updateDrawerLangBtn(lang);
    var dl = document.getElementById('drawerLang');
    if (dl) { dl.classList.remove('open'); }

    try { localStorage.setItem('hm-lang', lang); } catch(e) {}
  }

  // Expose setLang for page-specific scripts
  window._hmSetLang = setLang;

  /* ==========================================================
     Desktop language dropdown
     ========================================================== */
  var langSwitchEl = document.getElementById('langSwitch');
  if (langSwitchEl) {
    var langBtn = langSwitchEl.querySelector('.lang-btn');
    function closeLangDrop() {
      langSwitchEl.classList.remove('open');
      if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
    }
    if (langBtn) {
      langBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = langSwitchEl.classList.toggle('open');
        langBtn.setAttribute('aria-expanded', String(isOpen));
      });
    }
    document.querySelectorAll('.lang-opt').forEach(function(btn) {
      btn.addEventListener('click', function() { setLang(this.getAttribute('data-lang')); });
    });
    document.addEventListener('click', closeLangDrop);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeLangDrop(); });
  }

  /* ==========================================================
     Mobile hamburger drawer
     ========================================================== */
  var burger = document.getElementById('navBurger');
  var drawer = document.getElementById('mobileDrawer');
  var drawerOverlay = document.getElementById('drawerOverlay');

  if (burger && drawer && drawerOverlay) {
    function toggleDrawer(open) {
      var isOpen = typeof open === 'boolean' ? open : !drawer.classList.contains('open');
      drawer.classList.toggle('open', isOpen);
      drawerOverlay.classList.toggle('open', isOpen);
      burger.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }
    burger.addEventListener('click', function() { toggleDrawer(); });
    drawerOverlay.addEventListener('click', function() { toggleDrawer(false); });
    drawer.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() { toggleDrawer(false); });
    });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') toggleDrawer(false); });

    // Expose for page-specific scripts
    window._hmToggleDrawer = toggleDrawer;
  }

  /* Drawer lang dropdown — PWA-style toggle */
  var drawerLangEl = document.getElementById('drawerLang');
  var drawerLangBtnEl = document.getElementById('drawerLangBtn');
  if (drawerLangBtnEl && drawerLangEl) {
    drawerLangBtnEl.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = drawerLangEl.classList.toggle('open');
      drawerLangBtnEl.setAttribute('aria-expanded', String(isOpen));
    });
  }
  document.querySelectorAll('#drawerLangDrop button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLang(this.getAttribute('data-lang'));
      if (drawerLangEl) drawerLangEl.classList.remove('open');
      if (drawerLangBtnEl) drawerLangBtnEl.setAttribute('aria-expanded', 'false');
    });
  });

  /* Init drawer flag on load */
  updateDrawerLangBtn(document.documentElement.lang || 'en');

  /* ==========================================================
     Restore saved language
     ========================================================== */
  try {
    var saved = localStorage.getItem('hm-lang');
    if (saved && pageI18n[saved]) setLang(saved);
  } catch(e) {}

  /* ==========================================================
     Cookie Consent Modal
     ========================================================== */
  (function() {
    var overlay = document.getElementById('cookie-overlay');
    var btnAccept = document.getElementById('cookie-accept');
    var btnSave = document.getElementById('cookie-save');
    var analyticsToggle = document.getElementById('cookie-analytics');
    if (!overlay || !btnAccept || !btnSave) return;

    try {
      var consent = localStorage.getItem('hm-cookie-consent');
      if (consent) {
        var prefs = JSON.parse(consent);
        if (prefs && prefs.essential) {
          if (!prefs.analytics) {
            localStorage.setItem('plausible_ignore', 'true');
          } else {
            localStorage.removeItem('plausible_ignore');
          }
          return;
        }
      }
    } catch(e) {}

    overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    function saveConsent(analytics) {
      try {
        localStorage.setItem('hm-cookie-consent', JSON.stringify({
          essential: true,
          analytics: analytics,
          timestamp: new Date().toISOString()
        }));
        if (!analytics) {
          localStorage.setItem('plausible_ignore', 'true');
        } else {
          localStorage.removeItem('plausible_ignore');
        }
      } catch(e) {}
      overlay.hidden = true;
      document.body.style.overflow = '';
    }

    btnAccept.addEventListener('click', function() { saveConsent(true); });
    btnSave.addEventListener('click', function() { saveConsent(analyticsToggle && analyticsToggle.checked); });
  })();

})();
