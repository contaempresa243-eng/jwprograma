/* JW Programa · ponte para o APK (só é usada dentro da app Android) */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  window.IS_APK = true;
  function P(n) { try { return (C.Plugins && C.Plugins[n]) || C.registerPlugin(n); } catch (e) { return null; } }
  var Share = P('Share'), FS = P('Filesystem'), App = P('App'), JN = P('JwNative');

  function b64(blob) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
      r.onerror = no; r.readAsDataURL(blob);
    });
  }
  function textB64(t) { return b64(new Blob([t], { type: 'text/plain' })); }

  /* 1. Service worker não é preciso: os ficheiros já vão dentro do APK */
  try {
    if (navigator.serviceWorker) navigator.serviceWorker.register = function () { return Promise.resolve(); };
  } catch (e) {}

  /* 2. Partilhar (texto e ficheiros) com o menu do Android */
  navigator.canShare = function (d) { return !!(d && (d.files || d.text || d.url)); };
  navigator.share = async function (d) {
    d = d || {};
    try {
      if (d.files && d.files.length) {
        var f = d.files[0];
        var w = await FS.writeFile({ path: f.name, data: await b64(f), directory: 'CACHE' });
        await Share.share({ title: d.title || f.name, files: [w.uri], dialogTitle: d.title || 'Partilhar' });
      } else {
        await Share.share({ title: d.title, text: d.text, url: d.url, dialogTitle: 'Partilhar' });
      }
    } catch (e) {
      var m = String((e && e.message) || e);
      if (/cancel/i.test(m)) { var er = new Error('cancelado'); er.name = 'AbortError'; throw er; }
      throw e;
    }
  };

  /* 3. Guardar ficheiros (links com «download») nas Transferências */
  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var a = this;
    if (a.download && /^blob:/.test(a.href)) {
      var name = a.download;
      fetch(a.href).then(function (r) { return r.blob(); }).then(async function (blob) {
        var data = await b64(blob);
        try {
          await JN.saveDownload({ name: name, mime: blob.type || 'application/octet-stream', data: data });
        } catch (e) {
          /* sem acesso às Transferências: abre o menu de partilhar para guardar onde quiser */
          var w = await FS.writeFile({ path: name, data: data, directory: 'CACHE' });
          await Share.share({ title: name, files: [w.uri], dialogTitle: 'Guardar ficheiro' });
        }
      }).catch(function () {});
      return;
    }
    return origClick.apply(a, arguments);
  };

  /* 4. Tela cheia a sério (esconde a barra de estado e a de navegação) */
  var fsOn = false;
  try {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: function () { return fsOn ? document.documentElement : null; } });
  } catch (e) {}
  Element.prototype.requestFullscreen = function () {
    fsOn = true;
    try { JN.setFullscreen({ on: true }); } catch (e) {}
    return Promise.resolve();
  };
  document.exitFullscreen = function () {
    fsOn = false;
    try { JN.setFullscreen({ on: false }); } catch (e) {}
    return Promise.resolve();
  };

  /* 5. Botão «voltar» do Android */
  if (App && App.addListener) {
    App.addListener('backButton', function () {
      try {
        var q = function (s) { return document.querySelector(s); };
        var dlg = q('.app-dialog-fundo');
        if (dlg) { var c = dlg.querySelector('.app-dialog-cancelar') || dlg.querySelector('button'); if (c) c.click(); return; }
        var vis = function (el) { return el && getComputedStyle(el).display !== 'none'; };
        if (vis(q('#search-modal'))) { closeSearchModal(); return; }
        if (q('#dropdown-menu.show')) { q('#dropdown-menu').classList.remove('show'); return; }
        var fab = q('#fab-menu.show'); if (fab) { fab.classList.remove('show'); return; }
        var ativo = q('.tab-content.active');
        var back = q('#back-btn');
        if (back && vis(back)) { back.click(); return; }
        if (ativo && ativo.id !== 'inicio') { switchTab('inicio'); return; }
        App.exitApp();
      } catch (e) { try { App.exitApp(); } catch (x) {} }
    });
  }
})();
