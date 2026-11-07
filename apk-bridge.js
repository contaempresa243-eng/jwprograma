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

  /* 6. Lembretes (notificações do Android, funcionam com a app fechada) */
  var LN = P('LocalNotifications');
  var NK = 'jw_apk_notif';
  var NDEF = { rev: true, reun: true, preg: true, rel: true };
  function nCfg() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(NK) || '{}') || {}; } catch (e) {}
    return { rev: c.rev !== false, reun: c.reun !== false, preg: c.preg !== false, rel: c.rel !== false };
  }
  function nSave(c) { try { localStorage.setItem(NK, JSON.stringify(c)); } catch (e) {} }
  function p2(n) { return String(n).padStart(2, '0'); }
  var DIAS = { 'segunda-feira': 0, 'terça-feira': 1, 'quarta-feira': 2, 'quinta-feira': 3, 'sexta-feira': 4, 'sábado': 5, 'domingo': 6 };

  function listaLembretes() {
    var cfg = nCfg(), out = [], agora = Date.now(), lim = agora + 40 * 86400000;
    function add(at, title, body) {
      var t = at.getTime();
      if (t > agora + 20000 && t < lim) out.push({ at: at, title: title, body: body });
    }
    /* revisitas: 30 minutos antes */
    if (cfg.rev) {
      try {
        (JSON.parse(localStorage.getItem('jw_revisitas') || '[]') || []).forEach(function (r) {
          if (!r || r.concluido || !r.datahora) return;
          var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(r.datahora);
          if (!m) return;
          var quando = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
          add(new Date(quando.getTime() - 30 * 60000), 'Revisita às ' + m[4] + ':' + m[5],
              (r.nome || 'Revisita') + (r.assunto ? ' · ' + r.assunto : '') + (r.texto ? ' · ' + r.texto : ''));
        });
      } catch (e) {}
    }
    /* reuniões: 1 hora antes, nas próximas semanas */
    if (cfg.reun) {
      try {
        var seg = dataDeIso(semanaAtual());
        for (var w = 0; w < 6; w++) {
          var iso = isoLocal(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 7 * w));
          [['m', 'Reunião do meio de semana'], ['f', 'Reunião do fim de semana']].forEach(function (k) {
            var dia = DIAS[String(rGet(k[0] + '_dia', iso) || '').toLowerCase()];
            var hora = /^(\d{1,2}):(\d{2})/.exec(rGet(k[0] + '_hora', iso) || '');
            if (dia === undefined || !hora) return;
            var d0 = dataDeIso(iso);
            var quando = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + dia, +hora[1], +hora[2]);
            add(new Date(quando.getTime() - 60 * 60000), k[1] + ' daqui a 1 hora', 'Começa às ' + p2(hora[1]) + ':' + hora[2]);
          });
        }
      } catch (e) {}
    }
    /* pregação: 07:00 nos dias marcados em «Meu Programa» */
    if (cfg.preg) {
      try {
        var pr = (typeof progSalvo !== 'undefined' && progSalvo) ? progSalvo : null;
        if (pr) for (var i = 0; i < 14; i++) {
          var dt = new Date(); dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + i, 7, 0);
          if (isMarked(pr, dt.getFullYear(), dt.getMonth(), dt.getDate())) add(dt, 'Hoje é dia de pregação', 'Bom serviço! Abra o cronómetro quando começar.');
        }
      } catch (e) {}
    }
    /* relatório: 09:00 de 25 a 5, enquanto o do mês não estiver guardado */
    if (cfg.rel) {
      try {
        var rels = JSON.parse(localStorage.getItem('jw_relatorios') || '[]') || [];
        for (var j = 0; j < 40; j++) {
          var h = new Date(); h = new Date(h.getFullYear(), h.getMonth(), h.getDate() + j, 9, 0);
          var dd = h.getDate(), mm = h.getMonth(), aa = h.getFullYear();
          if (dd >= 6 && dd <= 24) continue;
          if (dd <= 5) { mm -= 1; if (mm < 0) { mm = 11; aa -= 1; } }
          var key = aa + '-' + p2(mm + 1);
          if (rels.some(function (r) { return r && r.mesKey === key; })) continue;
          add(h, 'Relatório de campo', 'Falta entregar o relatório de ' + MESES[mm] + ' ' + aa + '.');
        }
      } catch (e) {}
    }
    out.sort(function (a, b) { return a.at - b.at; });
    return out.slice(0, 60);
  }

  var nBusy = false, nAgain = false;
  async function nAgendar() {
    if (!LN) return;
    if (nBusy) { nAgain = true; return; }
    nBusy = true;
    try {
      var perm = await LN.checkPermissions();
      if (perm.display !== 'granted') { nBusy = false; return; }
      try { await LN.createChannel({ id: 'lembretes', name: 'Lembretes', description: 'Revisitas, reuniões, pregação e relatório', importance: 4, visibility: 1 }); } catch (e) {}
      var pend = await LN.getPending();
      if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications });
      var l = listaLembretes();
      if (l.length) await LN.schedule({ notifications: l.map(function (x, i) {
        return { id: 1000 + i, title: x.title, body: x.body, channelId: 'lembretes', schedule: { at: x.at, allowWhileIdle: true } };
      }) });
    } catch (e) {}
    nBusy = false;
    if (nAgain) { nAgain = false; setTimeout(nAgendar, 500); }
  }
  var nTimer = null;
  function nDepois() { clearTimeout(nTimer); nTimer = setTimeout(nAgendar, 2500); }
  async function nPedir() {
    try {
      var p = await LN.checkPermissions();
      if (p.display !== 'granted') p = await LN.requestPermissions();
      return p.display === 'granted';
    } catch (e) { return false; }
  }

  if (LN) {
    /* reagenda sempre que os dados da app mudam */
    var setItemOrig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k) {
      var r = setItemOrig.apply(this, arguments);
      if (/^jw_/.test(String(k))) nDepois();
      return r;
    };
    var removeOrig = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (k) {
      var r = removeOrig.apply(this, arguments);
      if (/^jw_/.test(String(k))) nDepois();
      return r;
    };
    document.addEventListener('visibilitychange', function () { if (document.hidden) nAgendar(); });

    /* cartão nas Configurações */
    function nCartao() {
      var cfgSec = document.getElementById('configuracao');
      if (!cfgSec || document.getElementById('apk-notif-card')) return;
      var alvo = null;
      cfgSec.querySelectorAll('h4.sec-label').forEach(function (h) { if (/^\s*Sobre/.test(h.textContent)) alvo = h; });
      var tit = document.createElement('h4'); tit.className = 'sec-label'; tit.textContent = 'Notificações';
      var card = document.createElement('div'); card.className = 'card'; card.id = 'apk-notif-card';
      var itens = [
        ['rev', 'Revisitas', '30 minutos antes da hora marcada'],
        ['reun', 'Reuniões', '1 hora antes (precisa de dia e hora definidos)'],
        ['preg', 'Pregação', 'Às 7h nos dias marcados em Meu Programa'],
        ['rel', 'Relatório de campo', 'Às 9h, de 25 a 5, se ainda não estiver guardado']
      ];
      var c = nCfg();
      var html = '<p class="cal-hint" style="margin-top:0">Avisos do Android, mesmo com a app fechada.</p>';
      itens.forEach(function (it) {
        html += '<label class="desig-card"><input type="checkbox" data-n="' + it[0] + '"' + (c[it[0]] ? ' checked' : '') + '><div><strong>' + it[1] + '</strong><br><span>' + it[2] + '</span></div></label>';
      });
      html += '<button type="button" id="apk-notif-teste" class="btn-secundario-cfg">🔔 Testar notificação</button><p id="apk-notif-estado" class="cal-hint"></p>';
      card.innerHTML = html;
      cfgSec.insertBefore(tit, alvo); cfgSec.insertBefore(card, alvo);
      card.addEventListener('change', async function (e) {
        var n = e.target && e.target.getAttribute && e.target.getAttribute('data-n');
        if (!n) return;
        var cc = nCfg(); cc[n] = e.target.checked; nSave(cc);
        if (e.target.checked && !(await nPedir())) {
          document.getElementById('apk-notif-estado').textContent = 'Permissão negada. Ative as notificações do JW Programa nas definições do Android.';
        }
        nAgendar();
      });
      document.getElementById('apk-notif-teste').onclick = async function () {
        var est = document.getElementById('apk-notif-estado');
        if (!(await nPedir())) { est.textContent = 'Permissão negada. Ative as notificações do JW Programa nas definições do Android.'; return; }
        try { await LN.createChannel({ id: 'lembretes', name: 'Lembretes', importance: 4, visibility: 1 }); } catch (x) {}
        await LN.schedule({ notifications: [{ id: 999, title: 'JW Programa', body: 'Notificação de teste: está tudo a funcionar.', channelId: 'lembretes', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
        est.textContent = 'Vai aparecer dentro de 5 segundos. Pode fechar a app para testar.';
      };
      var ps = document.getElementById('apk-notif-estado');
      LN.checkPermissions().then(function (p) { if (p.display !== 'granted') ps.textContent = 'As notificações ainda não estão permitidas. Ao marcar uma opção ou testar, o Android vai pedir permissão.'; });
    }
    window.addEventListener('load', function () {
      nCartao();
      setTimeout(async function () {
        var c = nCfg();
        if (c.rev || c.reun || c.preg || c.rel) { if (await nPedir()) nAgendar(); }
      }, 2500);
    });
  }
})();
