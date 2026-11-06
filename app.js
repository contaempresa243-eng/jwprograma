// ================= UTILITÁRIOS =================
function esc(value) {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function lsGet(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed === null ? fallback : parsed;
    } catch (e) {
        return fallback;
    }
}

function lsSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        alert('Não foi possível guardar os dados (armazenamento cheio ou bloqueado).');
    }
}

function rawGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}

function rawSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignorar */ }
}

function byId(id) {
    return document.getElementById(id);
}

function isShown(id) {
    const el = byId(id);
    return !!el && el.style.display === 'block';
}

// ================= ESTADO =================
let revisitas = lsGet('jw_revisitas', []);
let estudantes = lsGet('jw_estudantes', []);
let lembretes = lsGet('jw_lembretes', []);

// Configurações (guardadas em 'jw_config')
const APP_VERSAO = '2.0';
const CFG_CHAVE = 'jw_config';
const TEXTO_ZOOM = { normal: 1, grande: 1.12, muito: 1.25 };

function normalizeConfig(c) {
    c = (c && typeof c === 'object') ? c : {};
    const i = (c.inicio && typeof c.inicio === 'object') ? c.inicio : {};
    const a = (c.aparencia && typeof c.aparencia === 'object') ? c.aparencia : {};
    const max = Number(i.agendaMax);
    return {
        inicio: {
            reuniao: i.reuniao !== false,
            visitaSC: i.visitaSC !== false,
            revisitas: i.revisitas !== false,
            agenda: i.agenda !== false,
            agendaMax: [1, 2, 3, 5, 10].includes(max) ? max : 3,
            avisoRelatorio: i.avisoRelatorio !== false,
            lembreteCopia: i.lembreteCopia !== false
        },
        aparencia: {
            texto: TEXTO_ZOOM[a.texto] ? a.texto : 'normal',
            tema: ['claro', 'escuro', 'auto'].includes(a.tema) ? a.tema : 'claro',
            telaCheia: a.telaCheia === true
        }
    };
}

let config = normalizeConfig(null);
let relatorios = lsGet('jw_relatorios', []);

// Campos das reuniões: [chave no localStorage, id do input de edição, id do texto de detalhe]
const CAMPOS_MEIO = [
    ['m_dia', 'edit-dia-meio', null],
    ['m_hora', 'edit-hora-meio', null],
    ['m_pres', 'edit-presidente-meio', 'det-pres-meio'],
    ['m_or_ini', 'edit-oracao-ini-meio', 'det-oracao-ini-meio'],
    ['m_t_disc', 'edit-t-disc', 'det-t-disc'],
    ['m_t_perola', 'edit-t-perola', 'det-t-perola'],
    ['m_t_leit', 'edit-t-leit', 'det-t-leit'],
    ['m_emp_1', 'edit-emp-1', 'det-emp-1'],
    ['m_emp_2', 'edit-emp-2', 'det-emp-2'],
    ['m_emp_3', 'edit-emp-3', 'det-emp-3'],
    ['m_emp_4', 'edit-emp-4', 'det-emp-4'],
    ['m_emp_5', 'edit-emp-5', 'det-emp-5'],
    ['m_viv_1', 'edit-viv-1', 'det-viv-1'],
    ['m_viv_2', 'edit-viv-2', 'det-viv-2'],
    ['m_viv_3', 'edit-viv-3', 'det-viv-3'],
    ['m_est_dir', 'edit-est-dir', 'det-est-dir'],
    ['m_est_leit', 'edit-est-leit', 'det-est-leit'],
    ['m_or_fim', 'edit-oracao-fim-meio', 'det-oracao-fim-meio']
];

const CAMPOS_FIM = [
    ['f_dia', 'edit-dia-fim', null],
    ['f_hora', 'edit-hora-fim', null],
    ['f_pres', 'edit-presidente-fim', 'det-pres-fim'],
    ['f_or_ini', 'edit-oracao-ini-fim', 'det-oracao-ini-fim'],
    ['f_orador', 'edit-f-orador', 'det-f-orador'],
    ['f_tema', 'edit-f-tema', 'det-f-tema'],
    ['f_sent_dir', 'edit-sent-dir', 'det-sent-dir'],
    ['f_sent_leit', 'edit-sent-leit', 'det-sent-leit'],
    ['f_or_fim', 'edit-oracao-fim-fim', 'det-oracao-fim-fim']
];


// ---------- Reuniões por semana ----------
// Cada semana (segunda a domingo) tem o seu programa: chave jw_r_<segunda>_<campo>
function isoLocal(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dataDeIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}
function segundaDe(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return isoLocal(x);
}
function semanaAtual() { return segundaDe(new Date()); }
function rKey(k, w) { return 'jw_r_' + (w || semanaAtual()) + '_' + k; }
function rGet(k, w) { return rawGet(rKey(k, w)); }
function rSet(k, v, w) {
    try {
        if (v) localStorage.setItem(rKey(k, w), v); else localStorage.removeItem(rKey(k, w));
    } catch (e) { /* ignorar */ }
}
// segundas-feiras de um mês ("AAAA-MM") = semanas desse mês (4 ou 5)
function semanasDoMes(mes) {
    const m = /^(\d{4})-(\d{2})$/.exec(mes);
    const ano = Number(m[1]), mm = Number(m[2]) - 1;
    const lista = [];
    const d = new Date(ano, mm, 1);
    while (d.getMonth() === mm) {
        if (d.getDay() === 1) lista.push(isoLocal(d));
        d.setDate(d.getDate() + 1);
    }
    return lista;
}
function mesDaSemana(w) { return w.slice(0, 7); }
function nomeSemana(w) {
    const a = dataDeIso(w), b = dataDeIso(w);
    b.setDate(b.getDate() + 6);
    const mn = x => MESES[x.getMonth()].slice(0, 3).toLowerCase();
    return a.getMonth() === b.getMonth()
        ? a.getDate() + ' a ' + b.getDate() + ' de ' + MESES[b.getMonth()].toLowerCase()
        : a.getDate() + ' ' + mn(a) + ' a ' + b.getDate() + ' ' + mn(b);
}
function semanaTemDados(w) {
    return CAMPOS_MEIO.concat(CAMPOS_FIM).some(c => rGet(c[0], w));
}
// Dados antigos (uma só reunião, chaves m_* e f_*) passam para a semana atual
function migrarReunioesAntigas() {
    try {
        const w = semanaAtual();
        CAMPOS_MEIO.concat(CAMPOS_FIM).forEach(c => {
            const v = localStorage.getItem(c[0]);
            if (v === null) return;
            if (v && !rGet(c[0], w)) rSet(c[0], v, w);
            localStorage.removeItem(c[0]);
        });
    } catch (e) { /* ignorar */ }
}

let reunSemana = null; // semana selecionada no ecrã Reuniões
function reunSemanaSel() { return reunSemana || (reunSemana = semanaAtual()); }

// Pré-visualizações: [id do span, chave, texto por defeito]
const PREVIEWS = [
    ['prev-pres-meio', 'm_pres', '-'],
    ['prev-tesouros', 'm_t_disc', '-'],
    ['prev-pres-fim', 'f_pres', '-'],
    ['prev-discurso', 'f_orador', '-']
];

// ================= DIÁLOGOS PERSONALIZADOS (substituem alert/confirm do Chrome) =================
let dialogoFila = Promise.resolve();

function dialogoEsc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Mostra um diálogo e devolve uma Promise com o botão escolhido (true = confirmar)
function mostrarDialogo(msg, o) {
    o = o || {};
    const vez = dialogoFila.then(() => new Promise(resolve => {
        const fundo = document.createElement('div');
        fundo.className = 'app-dialog-fundo';
        const caixa = document.createElement('div');
        caixa.className = 'app-dialog';
        caixa.setAttribute('role', 'dialog');
        caixa.setAttribute('aria-modal', 'true');
        caixa.innerHTML =
            '<div class="app-dialog-icone">' + dialogoEsc(o.icone || (o.cancelar ? '❓' : 'ℹ️')) + '</div>' +
            '<h4>' + dialogoEsc(o.titulo || 'JW Programa') + '</h4>' +
            '<p>' + dialogoEsc(msg).replace(/\n/g, '<br>') + '</p>' +
            '<div class="app-dialog-botoes">' +
            (o.cancelar ? '<button type="button" class="app-dialog-cancelar">' + dialogoEsc(o.cancelar) + '</button>' : '') +
            '<button type="button" class="app-dialog-ok' + (o.perigo ? ' perigo' : '') + '">' + dialogoEsc(o.ok || 'OK') + '</button>' +
            '</div>';
        fundo.appendChild(caixa);
        document.body.appendChild(fundo);
        const fechar = (r) => {
            document.removeEventListener('keydown', tecla, true);
            if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
            resolve(r);
        };
        const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); fechar(false); } };
        document.addEventListener('keydown', tecla, true);
        caixa.querySelector('.app-dialog-ok').addEventListener('click', () => fechar(true));
        const bc = caixa.querySelector('.app-dialog-cancelar');
        if (bc) bc.addEventListener('click', () => fechar(false));
        fundo.addEventListener('click', (e) => { if (e.target === fundo && o.cancelar) fechar(false); });
        setTimeout(() => { const b = caixa.querySelector(o.perigo && bc ? '.app-dialog-cancelar' : '.app-dialog-ok'); if (b && b.focus) b.focus(); }, 0);
    }));
    dialogoFila = vez.catch(() => {});
    return vez;
}

function appConfirm(msg, o) {
    return mostrarDialogo(msg, Object.assign({ cancelar: 'Cancelar', ok: 'OK' }, o || {}));
}

function appAlert(msg, o) {
    return mostrarDialogo(msg, o || {}).then(() => undefined);
}

// Mensagens de sucesso: aviso rápido que desaparece sozinho
function mostrarAviso(msg) {
    try {
        let t = document.getElementById('app-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'app-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('mostrar');
        clearTimeout(mostrarAviso._t);
        mostrarAviso._t = setTimeout(() => t.classList.remove('mostrar'), 2600);
    } catch (e) { /* ignora */ }
}

// alert() do Chrome passa a usar o desenho da aplicação
if (typeof window !== 'undefined') {
    window.alert = function (msg) {
        const m = String(msg);
        if (/sucesso|guardad[oa]\b|atualizada|copiado|salva/i.test(m) && m.length < 80 && !/Ficheiro criado/.test(m)) {
            mostrarAviso(m);
        } else {
            appAlert(m);
        }
    };
}

// ================= NAVEGAÇÃO =================
let voltarPara = null; // ecrã de origem (ex.: Configuração → Termo de uso)

function switchTab(tabId) {
    if (!switchTab._mantem) voltarPara = null;
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    const target = byId(tabId);
    if (target) {
        target.classList.add('active');
    }
    byId('dropdown-menu').classList.remove('show');

    if (tabId !== 'reunioes') {
        if (reunSelecionando) reunSelSair();
        closeMeetingDetail();
    }
    if (tabId !== 'revisitas') {
        closeRevisitaForm();
        hideEstudantesView();
    }
    if (tabId !== 'pregacao') {
        closePregacaoEditor();
    }
    if (tabId !== 'superintendente') {
        resetVisitaSC();
    }
    if (tabId !== 'relatorio') {
        resetRelatorio();
    }
    if (tabId === 'inicio') {
        loadDynamicAgenda();
    }
    if (tabId === 'pregacao') {
        loadPregacaoData();
    }
    if (tabId === 'superintendente') {
        loadVisitaSC();
    }
    if (tabId === 'configuracao') {
        cfgCarregarUI();
    }
    if (tabId === 'programa') {
        renderVisaoGeral();
    }
    if (tabId === 'relatorio') {
        relMostrar('rel-lista-view');
        setRelAba(relAba);
    }
    updateBackBtnVisibility();
}

function openSection(tabId) {
    const ativo = document.querySelector('.tab-content.active');
    const origem = ativo ? ativo.id : null;
    switchTab._mantem = true;
    try { switchTab(tabId); } finally { switchTab._mantem = false; }
    // Só guarda a origem para os textos legais abertos a partir de Configuração
    voltarPara = (origem === 'configuracao' && (tabId === 'termos' || tabId === 'privacidade')) ? origem : null;
    byId('dropdown-menu').classList.remove('show');
}

// Botão de Voltar (Seta <)
function goBack() {
    if (reunSelecionando) {
        reunSelSair();
    } else if (isShown('estudantes-view')) {
        hideEstudantesView();
    } else if (isShown('revisita-form-view')) {
        closeRevisitaForm();
    } else if (isShown('pregacao-editor-view')) {
        closePregacaoEditor();
    } else if (relModalAberto()) {
        closeRelModais();
    } else if (isShown('ativ-form-view')) {
        closeAtivForm();
    } else if (isShown('rel-form-view')) {
        closeRelForm();
    } else if (isShown('sc-form-view')) {
        openScOpcoes();
    } else if (isShown('sc-opcoes-view')) {
        closeScOpcoes();
    } else if (isShown('detalhe-meio-view') || isShown('detalhe-fim-view') ||
               isShown('edit-meio-view') || isShown('edit-fim-view')) {
        closeMeetingDetail();
    } else if (voltarPara) {
        const destino = voltarPara;
        voltarPara = null;
        switchTab(destino);
    } else {
        switchTab('inicio');
    }
}

function updateBackBtnVisibility() {
    const backBtn = byId('back-btn');
    const estudantesBtn = byId('estudantes-btn');
    if (!backBtn || !estudantesBtn) return;

    const activeEl = document.querySelector('.tab-content.active');
    const activeTab = activeEl ? activeEl.id : 'inicio';

    const inSubView = isShown('revisita-form-view') || isShown('estudantes-view') || isShown('pregacao-editor-view');

    const revListVisible = !isShown('estudantes-view') && !isShown('revisita-form-view');
    estudantesBtn.style.display = (activeTab === 'revisitas' && revListVisible) ? 'flex' : 'none';

    backBtn.style.display = (activeTab !== 'inicio' || inSubView) ? 'flex' : 'none';
}

// ================= PREGAÇÃO (MEU PROGRAMA + EDITOR COM CALENDÁRIO) =================
const DIAS_SEMANA = [
    { curto: 'Seg', nome: 'Segunda-feira' },
    { curto: 'Ter', nome: 'Terça-feira' },
    { curto: 'Qua', nome: 'Quarta-feira' },
    { curto: 'Qui', nome: 'Quinta-feira' },
    { curto: 'Sex', nome: 'Sexta-feira' },
    { curto: 'Sáb', nome: 'Sábado' },
    { curto: 'Dom', nome: 'Domingo' }
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Metas mensais em horas, por designação
const METAS_HORAS = { Regular: 50, Especial: 80, Auxiliar: 30 };

const METAS_TEXTO = {
    Regular: 'Meta: 50 h/mês',
    Especial: 'Meta: 80 h/mês',
    Auxiliar: 'Meta: 30 h/mês (15 h em semana de visita do SC)'
};

// Dados do programa (guardados em 'jw_meu_programa' ao carregar em "Salvar Programa"):
//  dias      -> dias da semana marcados em todas as semanas (recorrentes)
//  extras    -> datas avulsas marcadas ('AAAA-MM-DD') em dias que não são recorrentes
//  excluidos -> datas desmarcadas ('AAAA-MM-DD') em dias que são recorrentes
//  designacao-> 'Regular' | 'Especial' | 'Auxiliar' | ''
let progSalvo = normalizeProg(null);   // programa guardado (mostrado em "Meu Programa")
let prog = normalizeProg(null);        // rascunho em edição
let calAno = new Date().getFullYear(); // mês mostrado no editor
let calMes = new Date().getMonth();
let resAno = calAno;                   // mês mostrado em "Meu Programa"
let resMes = calMes;

function normalizeProg(p) {
    p = p || {};
    return {
        dias: Array.isArray(p.dias) ? p.dias.slice() : [],
        extras: Array.isArray(p.extras) ? p.extras.slice() : [],
        excluidos: Array.isArray(p.excluidos) ? p.excluidos.slice() : [],
        designacao: p.designacao || '',
        hora: p.hora || '09:00'
    };
}

function pad2(n) {
    return n < 10 ? '0' + n : String(n);
}

function dateKey(y, m, d) {
    return y + '-' + pad2(m + 1) + '-' + pad2(d);
}

// Segunda-feira = 0 ... Domingo = 6
function weekdayIndex(y, m, d) {
    return (new Date(y, m, d).getDay() + 6) % 7;
}

function keyWeekday(key) {
    const parts = key.split('-').map(Number);
    return weekdayIndex(parts[0], parts[1] - 1, parts[2]);
}

function isRecurring(p, y, m, d) {
    return p.dias.includes(DIAS_SEMANA[weekdayIndex(y, m, d)].nome);
}

function isMarked(p, y, m, d) {
    const key = dateKey(y, m, d);
    if (isRecurring(p, y, m, d)) return !p.excluidos.includes(key);
    return p.extras.includes(key);
}

function countMarkedInMonth(p, y, m) {
    const total = new Date(y, m + 1, 0).getDate();
    let n = 0;
    for (let d = 1; d <= total; d++) {
        if (isMarked(p, y, m, d)) n++;
    }
    return n;
}

function countMarkedInYear(p, y) {
    let n = 0;
    for (let m = 0; m < 12; m++) n += countMarkedInMonth(p, y, m);
    return n;
}

function removeFrom(arr, value) {
    const i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1);
}

function addUnique(arr, value) {
    if (!arr.includes(value)) arr.push(value);
}

function formatHoras(n) {
    return String(Math.round(n * 10) / 10).replace('.', ',');
}

function programaVazio(p) {
    return p.dias.length === 0 && p.extras.length === 0 && !p.designacao;
}

// HTML do resumo (contagem de dias e cálculo das horas) para um programa e um mês
function resumoHtml(p, y, m) {
    const mesTxt = MESES[m] + ' de ' + y;
    const nMes = countMarkedInMonth(p, y, m);
    const nAno = countMarkedInYear(p, y);

    let html =
        '<p><strong>' + nMes + ' dia(s)</strong> marcado(s) em ' + esc(mesTxt) + '</p>' +
        '<p><strong>' + nAno + ' dia(s)</strong> marcado(s) em ' + y + '</p>';

    if (!p.designacao) {
        html += '<p class="cal-hint">Escolha uma designação para ver o cálculo das horas.</p>';
        return html;
    }

    const metaMes = METAS_HORAS[p.designacao] || 0;
    html += '<p><strong>Meta do mês:</strong> ' + metaMes + ' h' +
        (nMes > 0 ? ' · cerca de ' + formatHoras(metaMes / nMes) + ' h por dia marcado' : '') + '</p>';

    // O pioneiro auxiliar tem a meta definida mês a mês, sem meta anual
    if (p.designacao !== 'Auxiliar') {
        const metaAno = metaMes * 12;
        html += '<p><strong>Meta do ano:</strong> ' + metaAno + ' h' +
            (nAno > 0 ? ' · cerca de ' + formatHoras(metaAno / nAno) + ' h por dia marcado' : '') + '</p>';
    }

    if (nMes === 0) {
        html += '<p class="cal-hint">Marque dias no calendário para ver as horas por dia.</p>';
    }
    return html;
}

// ---------- Ecrã "Meu Programa" (resultado guardado) ----------
function renderMeuPrograma() {
    const box = byId('meu-programa-resultado');
    if (!box) return;

    const p = progSalvo;
    if (programaVazio(p)) {
        box.innerHTML =
            '<div class="card">' +
                '<p>Ainda não criou o seu programa de pregação.</p>' +
                '<p class="cal-hint">Toque em + para criar.</p>' +
            '</div>';
        return;
    }

    // Designação
    let html = '<h4 class="sec-label">Designação</h4>';
    if (p.designacao) {
        html += '<div class="desig-card ro"><div><strong>Pioneiro ' + esc(p.designacao) + '</strong><br>' +
            '<span>' + esc(METAS_TEXTO[p.designacao] || '') + '</span></div></div>';
    } else {
        html += '<div class="desig-card ro"><div><strong>Sem designação</strong><br>' +
            '<span>Toque em + para escolher uma.</span></div></div>';
    }

    // Dias de Pregação: dias da semana escolhidos e as datas de cada um no mês mostrado
    const total = new Date(resAno, resMes + 1, 0).getDate();
    const datasPorDia = DIAS_SEMANA.map(() => []);
    for (let d = 1; d <= total; d++) {
        if (isMarked(p, resAno, resMes, d)) datasPorDia[weekdayIndex(resAno, resMes, d)].push(d);
    }
    const nMes = countMarkedInMonth(p, resAno, resMes);

    html += '<h4 class="sec-label">Dias de Pregação</h4>' +
        '<div class="card dias-card">' +
        '<div class="cal-head">' +
            '<button type="button" class="cal-nav" onclick="mudarMesResultado(-1)" aria-label="Mês anterior">◄</button>' +
            '<div class="cal-titulo">' + MESES[resMes] + ' de ' + resAno + '</div>' +
            '<button type="button" class="cal-nav" onclick="mudarMesResultado(1)" aria-label="Mês seguinte">►</button>' +
        '</div>';

    let linhas = '';
    DIAS_SEMANA.forEach((dia, i) => {
        const escolhido = p.dias.includes(dia.nome);
        if (!escolhido && datasPorDia[i].length === 0) return;
        const datas = datasPorDia[i].length > 0 ? datasPorDia[i].join(', ') : 'nenhum dia neste mês';
        linhas += '<div class="dia-linha"><strong>' + dia.nome + '</strong><span>' + datas + '</span></div>';
    });
    html += linhas || '<p class="cal-hint">Nenhum dia marcado.</p>';

    // Meta de hora por dia de pregação
    if (!p.designacao) {
        html += '<p class="cal-hint">Escolha uma designação para ver a meta de horas.</p>';
    } else if (nMes === 0) {
        html += '<p class="cal-hint">Sem dias marcados neste mês.</p>';
    } else {
        const metaMes = METAS_HORAS[p.designacao] || 0;
        html += '<div class="dia-linha meta"><strong>Meta de hora</strong>' +
            '<span>cerca de ' + formatHoras(metaMes / nMes) + ' h por dia</span></div>' +
            '<p class="cal-hint">' + metaMes + ' h do mês ÷ ' + nMes + ' dia(s) marcado(s)</p>';
    }
    html += '</div>';

    // Resumo
    html += '<h4 class="sec-label">Resumo</h4>' +
        '<div class="card resumo-card">' + resumoHtml(p, resAno, resMes) + '</div>';

    box.innerHTML = html;
}

function mudarMesResultado(delta) {
    resMes += delta;
    if (resMes < 0) { resMes = 11; resAno--; }
    if (resMes > 11) { resMes = 0; resAno++; }
    renderMeuPrograma();
}

// Carrega o programa guardado e mostra o ecrã "Meu Programa" (chamado ao abrir a aba Pregação)
function loadPregacaoData() {
    progSalvo = normalizeProg(lsGet('jw_meu_programa', null));
    const hoje = new Date();
    resAno = hoje.getFullYear();
    resMes = hoje.getMonth();

    const lista = byId('pregacao-lista-view');
    const editor = byId('pregacao-editor-view');
    if (lista) lista.style.display = 'block';
    if (editor) editor.style.display = 'none';

    renderMeuPrograma();
    updateBackBtnVisibility();
}

// ---------- Editor (botão "+") ----------
function openPregacaoEditor() {
    prog = normalizeProg(progSalvo);
    const hoje = new Date();
    calAno = hoje.getFullYear();
    calMes = hoje.getMonth();

    byId('pregacao-lista-view').style.display = 'none';
    byId('pregacao-editor-view').style.display = 'block';

    const titulo = byId('editor-titulo');
    if (titulo) titulo.textContent = programaVazio(progSalvo) ? 'Criar programa' : 'Editar programa';

    refreshEditor();
    syncDesignacaoChecks();

    const main = byId('app-container');
    if (main) main.scrollTop = 0;
    updateBackBtnVisibility();
}

// Sai do editor sem guardar
function closePregacaoEditor() {
    const lista = byId('pregacao-lista-view');
    const editor = byId('pregacao-editor-view');
    if (editor) editor.style.display = 'none';
    if (lista) lista.style.display = 'block';
    renderMeuPrograma();
    updateBackBtnVisibility();
}

// Guarda o programa e volta a "Meu Programa" com o resultado
function savePrograma() {
    const p = normalizeProg(prog);
    lsSet('jw_meu_programa', p);
    progSalvo = p;
    const hoje = new Date();
    resAno = hoje.getFullYear();
    resMes = hoje.getMonth();
    alert('Programa de pregação guardado com sucesso!');
    closePregacaoEditor();
    const main = byId('app-container');
    if (main) main.scrollTop = 0;
}

function refreshEditor() {
    renderCalendario();
    renderResumo();
}

// Toque numa data: marca/desmarca só esse dia
function toggleDia(d) {
    const key = dateKey(calAno, calMes, d);
    const marcado = isMarked(prog, calAno, calMes, d);
    const recorrente = isRecurring(prog, calAno, calMes, d);

    if (marcado) {
        if (recorrente) addUnique(prog.excluidos, key);
        else removeFrom(prog.extras, key);
    } else {
        if (recorrente) removeFrom(prog.excluidos, key);
        else addUnique(prog.extras, key);
    }
    refreshEditor();
}

// Toque em Seg, Ter...: marca/desmarca esse dia da semana em todas as semanas
function toggleWeekday(wi) {
    const nome = DIAS_SEMANA[wi].nome;
    if (prog.dias.includes(nome)) removeFrom(prog.dias, nome);
    else prog.dias.push(nome);

    // Limpar exceções desse dia da semana, para o resultado ficar coerente
    prog.extras = prog.extras.filter(k => keyWeekday(k) !== wi);
    prog.excluidos = prog.excluidos.filter(k => keyWeekday(k) !== wi);
    refreshEditor();
}

function mudarMes(delta) {
    calMes += delta;
    if (calMes < 0) { calMes = 11; calAno--; }
    if (calMes > 11) { calMes = 0; calAno++; }
    refreshEditor();
}

function renderCalendario() {
    const titulo = byId('cal-titulo');
    const semana = byId('cal-semana');
    const grelha = byId('cal-dias');
    if (!titulo || !semana || !grelha) return;

    titulo.textContent = MESES[calMes] + ' de ' + calAno;

    semana.innerHTML = DIAS_SEMANA.map((dia, i) =>
        '<button type="button" class="cal-wd' + (prog.dias.includes(dia.nome) ? ' on' : '') +
        '" onclick="toggleWeekday(' + i + ')">' + dia.curto + '</button>'
    ).join('');

    const hoje = new Date();
    const total = new Date(calAno, calMes + 1, 0).getDate();
    const offset = weekdayIndex(calAno, calMes, 1);
    let html = '';

    for (let i = 0; i < offset; i++) {
        html += '<div class="cal-empty"></div>';
    }
    for (let d = 1; d <= total; d++) {
        const ehHoje = hoje.getFullYear() === calAno && hoje.getMonth() === calMes && hoje.getDate() === d;
        const classes = 'cal-day' +
            (isMarked(prog, calAno, calMes, d) ? ' on' : '') +
            (ehHoje ? ' today' : '');
        html += '<button type="button" class="' + classes + '" onclick="toggleDia(' + d + ')">' + d + '</button>';
    }
    grelha.innerHTML = html;
}

function syncDesignacaoChecks() {
    document.querySelectorAll('input[name="designacao-chk"]').forEach(chk => {
        chk.checked = (chk.value === prog.designacao);
    });
}

// Só uma designação ativa de cada vez
function handleDesignationCheck(designationName, checkbox) {
    prog.designacao = checkbox.checked ? designationName : '';
    syncDesignacaoChecks();
    renderResumo();
}

function renderResumo() {
    const el = byId('resumo-pregacao');
    if (el) el.innerHTML = resumoHtml(prog, calAno, calMes);
}

// ================= PESQUISA =================
const PESQUISA_VAZIA = '<p style="color: #64748b; font-size: 0.9rem;">Comece a digitar para ver os resultados...</p>';

function openSearchModal() {
    byId('search-modal').style.display = 'flex';
    byId('search-input').value = '';
    byId('search-results').innerHTML = PESQUISA_VAZIA;
    byId('search-input').focus();
    byId('dropdown-menu').classList.remove('show');
}

function closeSearchModal() {
    byId('search-modal').style.display = 'none';
}

function performSearch(query) {
    const resultsContainer = byId('search-results');
    if (!query.trim()) {
        resultsContainer.innerHTML = PESQUISA_VAZIA;
        return;
    }

    const q = query.toLowerCase();
    let html = '';
    const has = (v) => v && String(v).toLowerCase().includes(q);

    const revsMatched = revisitas.filter(r => has(r.nome) || has(r.morada) || has(r.assunto) || has(r.nota));
    if (revsMatched.length > 0) {
        html += '<h4 style="color: #1e3a8a; margin-top: 5px; font-size: 0.9rem;">💬 Revisitas</h4>';
        revsMatched.forEach(r => {
            html += '<div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">' +
                '<strong>' + esc(r.nome) + '</strong> - ' + esc(r.assunto || 'Sem assunto') + '<br>' +
                '<span style="color: #64748b;">' + esc(r.morada || '') + '</span></div>';
        });
    }

    const estsMatched = estudantes.filter(e => has(e.nome) || has(e.publicacao));
    if (estsMatched.length > 0) {
        html += '<h4 style="color: #1e3a8a; margin-top: 10px; font-size: 0.9rem;">🎓 Estudantes</h4>';
        estsMatched.forEach(e => {
            html += '<div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">' +
                '<strong>' + esc(e.nome) + '</strong> (' + esc(e.publicacao || 'Sem publicação') + ')</div>';
        });
    }

    const lemsMatched = lembretes.filter(l => has(l.texto));
    if (lemsMatched.length > 0) {
        html += '<h4 style="color: #1e3a8a; margin-top: 10px; font-size: 0.9rem;">📌 Agenda</h4>';
        lemsMatched.forEach(l => {
            html += '<div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">• ' + esc(l.texto) + '</div>';
        });
    }

    const relsMatched = relatorios.filter(r => has(r.mes) || has(r.nome) || has(r.nota));
    if (relsMatched.length > 0) {
        html += '<h4 style="color: #1e3a8a; margin-top: 10px; font-size: 0.9rem;">📄 Relatórios</h4>';
        relsMatched.forEach(r => {
            html += '<div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;">' +
                '<strong>' + esc(r.mes) + '</strong>' + (r.nome ? ' – ' + esc(r.nome) : '') + (r.minutos ? ' – ' + esc(fmtMinutos(r.minutos)) : '') + '</div>';
        });
    }

    resultsContainer.innerHTML = html || '<p style="color: #64748b; font-size: 0.9rem;">Nenhum resultado encontrado.</p>';
}

// ================= MENUS =================
function toggleMenu() {
    byId('dropdown-menu').classList.toggle('show');
}

function toggleFabMenu() {
    byId('fab-menu').classList.toggle('show');
}

// Evitar que os links com href="#" saltem para o topo / alterem a URL
document.addEventListener('click', (e) => {
    const link = e.target.closest('#dropdown-menu a, #fab-menu a');
    if (link) e.preventDefault();
});

// Fechar menus ao tocar fora
window.addEventListener('click', (e) => {
    if (!e.target.closest('#menu-btn') && !e.target.closest('#dropdown-menu')) {
        byId('dropdown-menu').classList.remove('show');
    }
    if (!e.target.closest('#fab-container')) {
        const fabMenu = byId('fab-menu');
        if (fabMenu) fabMenu.classList.remove('show');
    }
});

// ================= REUNIÕES =================
function hideAllMeetingViews() {
    ['detalhe-meio-view', 'detalhe-fim-view', 'edit-meio-view', 'edit-fim-view'].forEach(id => {
        byId(id).style.display = 'none';
    });
}

function openMeetingDetail(type) {
    byId('reunioes-main-view').style.display = 'none';
    byId('fab-container').style.display = 'none';
    hideAllMeetingViews();
    byId(type === 'meio' ? 'detalhe-meio-view' : 'detalhe-fim-view').style.display = 'block';
    updateBackBtnVisibility();
}

function openEditMeeting(type) {
    byId('fab-menu').classList.remove('show');
    byId('reunioes-main-view').style.display = 'none';
    byId('fab-container').style.display = 'none';
    hideAllMeetingViews();

    const campos = type === 'meio' ? CAMPOS_MEIO : CAMPOS_FIM;
    campos.forEach(c => {
        byId(c[1]).value = rGet(c[0], reunSemanaSel());
    });

    byId(type === 'meio' ? 'edit-meio-view' : 'edit-fim-view').style.display = 'block';
    updateBackBtnVisibility();
}

// ----- Apagar reunião (pressionar um cartão ativa a seleção) -----
let reunSelecionando = false;
let reunSelSet = new Set();
let reunTimer = null;
let reunIgnorarClique = false; // true entre a pressão longa e o clique que o segue

function reunAtualizarSel() {
    ['meio', 'fim'].forEach(t => {
        const card = byId('card-reun-' + t);
        if (!card) return;
        const sel = reunSelSet.has(t);
        card.classList.toggle('selecionado', sel);
        card.classList.toggle('em-selecao', reunSelecionando);
        const cb = card.querySelector('.sel-check');
        if (cb) cb.checked = sel;
    });
    const bar = byId('reun-sel-bar');
    if (bar) bar.style.display = reunSelecionando ? 'flex' : 'none';
    const cnt = byId('reun-sel-count');
    if (cnt) cnt.textContent = reunSelSet.size + (reunSelSet.size === 1 ? ' selecionada' : ' selecionadas');
    const fab = byId('fab-container');
    const mv = byId('reunioes-main-view');
    if (fab && mv && mv.style.display !== 'none') fab.style.display = reunSelecionando ? 'none' : 'block';
}

function reunSelEntrar(tipo) {
    reunSelecionando = true;
    reunSelSet = new Set([tipo]);
    reunIgnorarClique = true;
    reunAtualizarSel();
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* ignora */ }
}

function reunSelSair() {
    reunSelecionando = false;
    reunSelSet = new Set();
    reunAtualizarSel();
}

async function reunSelApagar() {
    if (!reunSelSet.size) { reunSelSair(); return; }
    const nomes = Array.from(reunSelSet).map(t => t === 'meio' ? 'Meio de Semana' : 'Fim de Semana').join(' e ');
    const ok = await appConfirm('Deseja apagar a reunião de ' + nomes + '?\nTodo o programa preenchido será removido.', { icone: '🗑️', titulo: 'Apagar reunião', ok: 'Apagar', perigo: true });
    if (!ok) return;
    const tipos = Array.from(reunSelSet);
    tipos.forEach(t => {
        (t === 'meio' ? CAMPOS_MEIO : CAMPOS_FIM).forEach(c => {
            rSet(c[0], '', reunSemanaSel());
        });
    });
    reunSelSair();
    loadMeetingPreviews();
    loadDynamicAgenda();
    mostrarAviso(tipos.length > 1 ? 'Reuniões apagadas.' : 'Reunião apagada.');
}

function reunCartaoClique(tipo) {
    if (reunIgnorarClique) { reunIgnorarClique = false; return; }
    if (reunSelecionando) {
        if (reunSelSet.has(tipo)) reunSelSet.delete(tipo); else reunSelSet.add(tipo);
        reunAtualizarSel();
        return;
    }
    openMeetingDetail(tipo);
}

function reunIniciarGestos() {
    ['meio', 'fim'].forEach(tipo => {
        const card = byId('card-reun-' + tipo);
        if (!card) return;
        const limpar = () => { if (reunTimer) { clearTimeout(reunTimer); reunTimer = null; } };
        card.addEventListener('pointerdown', () => {
            limpar();
            reunIgnorarClique = false;
            if (reunSelecionando) return;
            reunTimer = setTimeout(() => { reunTimer = null; reunSelEntrar(tipo); }, 500);
        });
        ['pointerup', 'pointerleave', 'pointercancel', 'pointermove'].forEach(ev => card.addEventListener(ev, limpar));
        card.addEventListener('contextmenu', e => { e.preventDefault(); });
        card.addEventListener('click', () => reunCartaoClique(tipo));
    });
}

function closeMeetingDetail() {
    byId('reunioes-main-view').style.display = 'block';
    byId('fab-container').style.display = 'block';
    hideAllMeetingViews();
    loadMeetingPreviews();
    loadDynamicAgenda();
    updateBackBtnVisibility();
}

function saveMeeting(type) {
    const campos = type === 'meio' ? CAMPOS_MEIO : CAMPOS_FIM;
    const w = reunSemanaSel();
    campos.forEach(c => {
        rSet(c[0], byId(c[1]).value.trim(), w);
    });
    const chk = byId('aplicar-dh-' + type);
    if (chk && chk.checked) {
        const dia = byId(campos[0][1]).value, hora = byId(campos[1][1]).value;
        semanasDoMes(mesDaSemana(w)).forEach(s => {
            if (s === w) return;
            rSet(campos[0][0], dia, s);
            rSet(campos[1][0], hora, s);
        });
    }
    alert('Reunião salva com sucesso!');
    closeMeetingDetail();
}

function loadMeetingPreviews() {
    const w = reunSemanaSel();
    PREVIEWS.forEach(p => {
        const el = byId(p[0]);
        if (el) el.textContent = rGet(p[1], w) || p[2];
    });

    CAMPOS_MEIO.concat(CAMPOS_FIM).forEach(c => {
        const el = c[2] ? byId(c[2]) : null;
        if (el) el.textContent = rGet(c[0], w) || '-';
    });

    const diaHoraMeio = byId('det-dia-hora-meio');
    if (diaHoraMeio) diaHoraMeio.textContent = formatDiaHora(rGet('m_dia', w), rGet('m_hora', w)) || '-';
    const diaHoraFim = byId('det-dia-hora-fim');
    if (diaHoraFim) diaHoraFim.textContent = formatDiaHora(rGet('f_dia', w), rGet('f_hora', w)) || '-';

    document.querySelectorAll('.sem-info').forEach(el => { el.textContent = 'Semana de ' + nomeSemana(w); });
    reunRenderSemanas();
}

// ----- Seletor de semanas (mês com 4 ou 5 semanas) -----
function reunRenderSemanas() {
    const box = byId('reun-semanas');
    if (!box) return;
    const w = reunSemanaSel();
    const mes = mesDaSemana(w);
    const semanas = semanasDoMes(mes);
    const atual = semanaAtual();
    const titulo = byId('reun-mes-titulo');
    if (titulo) titulo.textContent = MESES[Number(mes.slice(5, 7)) - 1] + ' ' + mes.slice(0, 4);
    box.innerHTML = semanas.map((s, i) =>
        '<button type="button" class="sem-chip' + (s === w ? ' ativa' : '') + (s === atual ? ' atual' : '') + '" onclick="reunIrSemana(\'' + s + '\')">' +
        '<b>S' + (i + 1) + '</b><span>' + dataDeIso(s).getDate() + '/' + String(dataDeIso(s).getMonth() + 1).padStart(2, '0') + '</span>' +
        (semanaTemDados(s) ? '<i class="sem-ponto"></i>' : '') + '</button>'
    ).join('');
    const info = byId('reun-sem-nome');
    if (info) {
        const idx = semanas.indexOf(w) + 1;
        info.textContent = 'Semana ' + idx + ' · ' + nomeSemana(w) + (w === atual ? ' (esta semana)' : '');
    }
}

function reunIrSemana(w) {
    if (reunSelecionando) reunSelSair();
    reunSemana = w;
    loadMeetingPreviews();
}

function reunMudarMes(delta) {
    const w = reunSemanaSel();
    const d = new Date(Number(w.slice(0, 4)), Number(w.slice(5, 7)) - 1 + delta, 1);
    const mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const semanas = semanasDoMes(mes);
    const atual = semanaAtual();
    reunIrSemana(semanas.indexOf(atual) >= 0 ? atual : semanas[0]);
}

function reunIrHoje() { reunIrSemana(semanaAtual()); }

// Copiar o programa desta semana para outras semanas do mês
function reunCopiarAbrir() {
    const w = reunSemanaSel();
    const outras = semanasDoMes(mesDaSemana(w)).filter(s => s !== w);
    if (!outras.length) { appAlert('Não há outras semanas neste mês.', { icone: 'ℹ️' }); return; }
    const todas = semanasDoMes(mesDaSemana(w));
    const fundo = document.createElement('div');
    fundo.className = 'app-dialog-fundo';
    const caixa = document.createElement('div');
    caixa.className = 'app-dialog copiar-dialog';
    caixa.innerHTML =
        '<div class="app-dialog-icone">📋</div><h4>Copiar para outras semanas</h4>' +
        '<p>Copiar de <b>' + esc(nomeSemana(w)) + '</b> para:</p>' +
        '<div class="copiar-lista">' + outras.map(s =>
            '<label class="copiar-item"><input type="checkbox" value="' + s + '" checked> <span>S' + (todas.indexOf(s) + 1) + ' · ' + esc(nomeSemana(s)) +
            (semanaTemDados(s) ? ' <em>(tem dados)</em>' : '') + '</span></label>').join('') + '</div>' +
        '<label class="copiar-item"><input type="radio" name="copiar-modo" value="dh" checked> <span>Só o dia e a hora</span></label>' +
        '<label class="copiar-item"><input type="radio" name="copiar-modo" value="tudo"> <span>Todo o programa (substitui o que já existe)</span></label>' +
        '<div class="app-dialog-botoes" style="margin-top:14px"><button type="button" class="app-dialog-cancelar">Cancelar</button><button type="button" class="app-dialog-ok">Copiar</button></div>';
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    const fechar = () => { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); };
    caixa.querySelector('.app-dialog-cancelar').addEventListener('click', fechar);
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    caixa.querySelector('.app-dialog-ok').addEventListener('click', () => {
        const alvos = Array.from(caixa.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
        const modo = caixa.querySelector('input[name=copiar-modo]:checked').value;
        fechar();
        if (!alvos.length) return;
        const campos = modo === 'tudo' ? CAMPOS_MEIO.concat(CAMPOS_FIM)
            : [CAMPOS_MEIO[0], CAMPOS_MEIO[1], CAMPOS_FIM[0], CAMPOS_FIM[1]];
        alvos.forEach(s => campos.forEach(c => rSet(c[0], rGet(c[0], w), s)));
        loadMeetingPreviews();
        loadDynamicAgenda();
        mostrarAviso('Copiado para ' + alvos.length + (alvos.length === 1 ? ' semana.' : ' semanas.'));
    });
}

// "18:30" -> "18h:30"
function formatHoraReuniao(hora) {
    const m = /^(\d{1,2}):(\d{2})/.exec(hora || '');
    return m ? m[1] + 'h:' + m[2] : '';
}

// "Quinta-feira" + "18:30" -> "Quinta-feira, 18h:30"
function formatDiaHora(dia, hora) {
    if (!dia) return '';
    const h = formatHoraReuniao(hora);
    return h ? dia + ', ' + h : dia;
}

// Reuniões a mostrar na agenda: só as que são hoje (nos dias sem reunião não aparece nada)
function reunioesDeHoje(hoje) {
    const hojeIdx = (hoje.getDay() + 6) % 7;
    const lista = [];
    [['m_dia', 'm_hora'], ['f_dia', 'f_hora']].forEach(par => {
        const dia = rGet(par[0], segundaDe(hoje));
        const idx = DIAS_SEMANA.findIndex(d => d.nome === dia);
        if (idx === hojeIdx) lista.push({ dia: dia, hora: rGet(par[1], segundaDe(hoje)) });
    });
    return lista;
}

function temDiaDeReuniaoDefinido() {
    return DIAS_SEMANA.some(d => d.nome === rGet('m_dia') || d.nome === rGet('f_dia'));
}

// ================= AGENDA DINÂMICA =================
// Relatório do mês a entregar: de 25 a 5, se ainda não estiver guardado
function avisoRelatorio(hoje) {
    const d = hoje.getDate();
    let ano = hoje.getFullYear();
    let mes = hoje.getMonth();
    if (d >= 25) {
        // mês atual
    } else if (d <= 5) {
        mes -= 1;
        if (mes < 0) { mes = 11; ano -= 1; }
    } else {
        return null;
    }
    const key = ano + '-' + pad2(mes + 1);
    if (relatorios.some(r => r.mesKey === key)) return null;
    return { mesKey: key, texto: MESES[mes] + ' ' + ano };
}

// Lembrete da cópia de segurança: só se houver dados e passar 1 semana sem cópia
function avisoCopia(agora) {
    const ignorar = ['jw_config', 'jw_ultima_copia', 'jw_rel_nome', 'jw_cronometro', 'jw_foto_perfil', 'jw_foto_orig', 'jw_foto_ajuste'];
    const temDados = backupChaves().some(k => !ignorar.includes(k) && rawGet(k) && rawGet(k) !== '[]' && rawGet(k) !== '{}');
    if (!temDados) return null;
    const ultima = new Date(rawGet('jw_ultima_copia'));
    if (isNaN(ultima.getTime())) return 'Ainda não fez cópia dos seus dados. Toque para fazer.';
    const dias = Math.floor((agora.getTime() - ultima.getTime()) / 86400000);
    return dias >= 7 ? 'Última cópia há ' + dias + ' dias. Toque para fazer outra.' : null;
}

function loadDynamicAgenda() {
    const container = byId('dynamic-agenda-container');
    if (!container) return;

    const items = [];
    const ci = config.inicio;

    const reunioes = ci.reuniao ? reunioesDeHoje(new Date()) : [];
    if (reunioes.length > 0) {
        reunioes.forEach(r => {
            items.push(
                '<div class="event-item"><span class="event-label">📖 Reunião:</span><span>' +
                esc(formatDiaHora(r.dia, r.hora)) + '</span></div>'
            );
        });
    } else if (ci.reuniao && !temDiaDeReuniaoDefinido() && (rGet('m_pres') || rGet('f_pres'))) {
        items.push(
            '<div class="event-item"><span class="event-label">📖 Reunião:</span><span>Programa preenchido</span></div>'
        );
    }

    if (ci.visitaSC) {
        visitaSCDeHoje(new Date()).forEach(v => {
            items.push(
                '<div class="event-item"><span class="event-label">🏛️ Visita SC – ' + esc(v.rotulo) + ':</span><span>' +
                esc(v.texto) + '</span></div>'
            );
        });
    }

    if (ci.revisitas) {
        revisitas.filter(r => !r.concluido && r.datahora).forEach(rev => {
            const dataFormatada = new Date(rev.datahora).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
            items.push(
                '<div class="event-item"><span class="event-label">💬 Revisita (' + esc(rev.nome) + '):</span>' +
                '<span style="color: #2563eb; font-weight: 500;">' + esc(dataFormatada) + '</span></div>'
            );
        });
    }

    if (ci.avisoRelatorio) {
        const av = avisoRelatorio(new Date());
        if (av) {
            items.push('<div class="event-item"><span class="event-label">📄 Relatório:</span><span>Entregar o relatório de ' +
                esc(av.texto) + '</span></div>');
        }
    }

    if (ci.lembreteCopia) {
        const av = avisoCopia(new Date());
        if (av) {
            items.push('<div class="event-item" style="cursor: pointer;" onclick="openSection(\'configuracao\')"><span class="event-label">💾 Cópia:</span><span>' +
                esc(av) + '</span></div>');
        }
    }

    // Agenda: trecho de cada item (até ao máximo escolhido), com "+N" se houver mais
    if (ci.agenda) {
        const AGENDA_MAX_CHARS = 70;
        const agendaVisivel = lembretes.filter(l => l.mostrar);
        agendaVisivel.slice(0, ci.agendaMax).forEach(l => {
            const t = String(l.texto).replace(/\s+/g, ' ').trim();
            const trecho = t.length > AGENDA_MAX_CHARS ? t.slice(0, AGENDA_MAX_CHARS).trim() + '…' : t;
            items.push('<div class="event-item"><span class="event-label">📌 Agenda:</span><span>' + esc(trecho) + '</span></div>');
        });
        if (agendaVisivel.length > ci.agendaMax) {
            items.push('<div class="event-item"><span class="event-label">📌 Agenda:</span><span>+' +
                (agendaVisivel.length - ci.agendaMax) + ' na agenda</span></div>');
        }
    }

    container.innerHTML = items.length === 0
        ? '<div style="text-align: center; color: #64748b; padding: 12px 0; font-size: 0.95rem;">Nenhum resumo ou agenda disponível</div>'
        : items.join('');
}

// ================= VISÃO GERAL (PAINEL DO MÊS) =================
function vgLinha(rotulo, valor) {
    return '<p><strong>' + esc(rotulo) + '</strong> ' + valor + '</p>';
}

function vgCard(icone, titulo, destino, corpo) {
    return '<div class="card vg-card" onclick="openSection(\'' + destino + '\')">' +
        '<div class="vg-cab"><h3>' + icone + ' ' + esc(titulo) + '</h3><span class="vg-seta">›</span></div>' + corpo + '</div>';
}

function vgVazio(txt) {
    return '<p class="cal-hint" style="margin: 4px 0 0;">' + esc(txt) + '</p>';
}

// 1. Horas do mês
function vgHoras(hoje, prog, des) {
    const y = hoje.getFullYear(), m = hoje.getMonth();
    const mesKey = y + '-' + pad2(m + 1);
    const t = ativTotaisMes(mesKey);
    let corpo = '';

    if (!des) {
        corpo += vgLinha('Horas feitas:', esc(fmtMinutos(t.minutos)));
        corpo += vgLinha('Dias de campo:', String(t.dias));
        corpo += vgVazio('Sem meta de horas (publicador). A designação define-se em Pregação.');
        return vgCard('⏱️', 'Horas do mês', 'relatorio', corpo);
    }

    const metaMin = METAS_HORAS[des] * 60;
    const pct = Math.min(100, Math.round(t.minutos / metaMin * 100));
    const falta = Math.max(0, metaMin - t.minutos);
    corpo += '<p class="vg-destaque">' + esc(fmtMinutos(t.minutos)) + ' <span>de ' + METAS_HORAS[des] + 'h (' + pct + '%)</span></p>';
    corpo += '<div class="vg-barra"><div style="width: ' + pct + '%;"></div></div>';
    corpo += vgLinha('Dias de campo:', String(t.dias));

    if (falta === 0) {
        corpo += vgLinha('Meta:', 'atingida 🎉');
    } else {
        corpo += vgLinha('Faltam:', esc(fmtMinutos(falta)));
        const ultimo = new Date(y, m + 1, 0).getDate();
        let restantes = 0;
        for (let d = hoje.getDate(); d <= ultimo; d++) {
            if (isMarked(prog, y, m, d)) restantes++;
        }
        if (restantes > 0) {
            corpo += vgLinha('Por dia de pregação:', esc(fmtMinutos(Math.ceil(falta / restantes))) + ' (' + restantes + (restantes === 1 ? ' dia' : ' dias') + ' marcados até ao fim do mês)');
        } else {
            corpo += vgVazio('Não há dias de pregação marcados até ao fim do mês.');
        }
    }
    return vgCard('⏱️', 'Horas do mês', 'relatorio', corpo);
}

// 2. Reuniões da semana
function vgReunioes() {
    const bloco = (titulo, dKey, hKey, presKey, campos) => {
        const dh = formatDiaHora(rGet(dKey), rGet(hKey));
        const partes = campos.filter(c => c[2]);
        const feitas = partes.filter(c => rGet(c[0])).length;
        let s = '<p class="vg-sub">' + esc(titulo) + '</p>';
        s += vgLinha('Dia e hora:', dh ? esc(dh) : '<span class="vg-nd">por definir</span>');
        s += vgLinha('Presidente:', rGet(presKey) ? esc(rGet(presKey)) : '<span class="vg-nd">por preencher</span>');
        s += vgLinha('Programa:', feitas + ' de ' + partes.length + ' partes preenchidas');
        return s;
    };
    return vgCard('👥', 'Reuniões da semana', 'reunioes',
        bloco('Meio de semana', 'm_dia', 'm_hora', 'm_pres', CAMPOS_MEIO) +
        bloco('Fim de semana', 'f_dia', 'f_hora', 'f_pres', CAMPOS_FIM));
}

// 3. Pregação
function vgPregacao(hoje, prog, des) {
    const y = hoje.getFullYear(), m = hoje.getMonth();
    const marcados = countMarkedInMonth(prog, y, m);
    let corpo = vgLinha('Designação:', des ? esc(REL_DESIG[des]) : 'Publicador');
    if (prog.dias.length === 0 && prog.extras.length === 0) {
        corpo += vgVazio('Ainda não criou o programa de pregação. Toque para criar.');
        return vgCard('🗺️', 'Pregação', 'pregacao', corpo);
    }
    const nomes = DIAS_SEMANA.filter(d => prog.dias.includes(d.nome)).map(d => d.nome.replace('-feira', ''));
    if (nomes.length) corpo += vgLinha('Dias da semana:', esc(nomes.join(', ')));
    corpo += vgLinha('Dias de pregação este mês:', String(marcados));
    if (des && marcados > 0) {
        corpo += vgLinha('Meta por dia:', esc(fmtMinutos(Math.ceil(METAS_HORAS[des] * 60 / marcados))));
    }
    return vgCard('🗺️', 'Pregação', 'pregacao', corpo);
}

// 4. Estudantes e revisitas
function vgEstudantesRevisitas(hoje) {
    const mesKey = hoje.getFullYear() + '-' + pad2(hoje.getMonth() + 1);
    let corpo = vgLinha('Estudantes com estudo este mês:', estudantesDoMes(mesKey) + ' de ' + estudantes.length);
    const pend = revisitas.filter(r => !r.concluido);
    corpo += vgLinha('Revisitas pendentes:', String(pend.length));
    const agora = Date.now();
    const prox = pend.filter(r => r.datahora && new Date(r.datahora).getTime() >= agora)
        .sort((a, b) => new Date(a.datahora) - new Date(b.datahora))[0];
    if (prox) {
        corpo += vgLinha('Próxima:', esc(prox.nome) + ' · ' + esc(new Date(prox.datahora).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })));
    } else if (pend.length === 0 && estudantes.length === 0) {
        corpo += vgVazio('Ainda não registou revisitas nem estudantes.');
    }
    return vgCard('💬', 'Estudantes e revisitas', 'revisitas', corpo);
}

// 5. Relatório do mês (até ao dia 5, o do mês anterior)
function vgRelatorio(hoje) {
    let y = hoje.getFullYear(), m = hoje.getMonth();
    if (hoje.getDate() <= 5) { m -= 1; if (m < 0) { m = 11; y -= 1; } }
    const key = y + '-' + pad2(m + 1);
    const rel = relatorios.find(r => r.mesKey === key);
    let corpo = vgLinha('Mês:', esc(MESES[m] + ' ' + y));
    if (rel) {
        corpo += vgLinha('Estado:', '✅ Guardado' + (rel.nome ? ' (' + esc(rel.nome) + ')' : ''));
        return vgCard('📄', 'Relatório do mês', 'relatorio', corpo);
    }
    corpo += vgLinha('Estado:', '⏳ Por entregar');
    corpo += '<button type="button" class="vg-btn" onclick="event.stopPropagation(); openSection(\'relatorio\'); openRelForm();">Preencher agora</button>';
    return vgCard('📄', 'Relatório do mês', 'relatorio', corpo);
}

// 6. Visita do S.C (só se houver programa)
function vgVisitaSC() {
    const g = lsGet(SC_CHAVE, {});
    const d = (g && typeof g === 'object') ? g : {};
    const r = d.reuniao || {}, s = d.saida || {}, f = d.refeicao || {};
    const linhas = [];
    const meio = formatDiaHora(r.dia, r.hora);
    const fim = formatDiaHora(r.f_dia, r.f_hora);
    if (meio) linhas.push(vgLinha('Meio de semana:', esc(meio)));
    if (fim) linhas.push(vgLinha('Fim de semana:', esc(fim)));
    let irmaos = 0;
    ['manha', 'tarde'].forEach(p => {
        const dp = scPeriodo(s, p);
        SC_LINHAS_SAIDA.forEach(l => { if (dp[l.k]) irmaos += Object.keys(dp[l.k]).filter(k => dp[l.k][k]).length; });
    });
    if (s.hora || irmaos) {
        linhas.push(vgLinha('Saída de campo:', esc((s.hora ? formatHoraReuniao(s.hora) : 'hora por definir') + (irmaos ? ' · ' + irmaos + ' designações' : ''))));
    }
    let familias = 0;
    SC_LINHAS_REFEICAO.forEach(l => { if (f[l.k] && typeof f[l.k] === 'object') familias += Object.keys(f[l.k]).filter(k => f[l.k][k]).length; });
    if (familias) linhas.push(vgLinha('Refeições:', familias + (familias === 1 ? ' família' : ' famílias')));
    if (linhas.length === 0) return '';
    return vgCard('🏛️', 'Visita do S.C', 'superintendente', linhas.join(''));
}

// 7. Agenda (próximos itens)
function vgAgenda() {
    const lista = lembretes.filter(l => l.mostrar);
    let corpo = '';
    if (lista.length === 0) {
        corpo = vgVazio(lembretes.length ? 'Nenhum item com "Mostrar agenda" marcado.' : 'Ainda não há nada na agenda.');
    } else {
        lista.slice(0, 3).forEach(l => {
            const t = String(l.texto).replace(/\s+/g, ' ').trim();
            corpo += '<p>• ' + esc(t.length > 70 ? t.slice(0, 70).trim() + '…' : t) + '</p>';
        });
        if (lista.length > 3) corpo += vgVazio('+' + (lista.length - 3) + ' na agenda');
    }
    return vgCard('📌', 'Agenda', 'lembretes', corpo);
}

function renderVisaoGeral() {
    const box = byId('visao-geral');
    if (!box) return;
    const hoje = new Date();
    const prog = normalizeProg(lsGet('jw_meu_programa', null));
    const des = progDesignacao();
    const ci = config.inicio;

    const mesEl = byId('vg-mes');
    if (mesEl) mesEl.textContent = MESES[hoje.getMonth()] + ' ' + hoje.getFullYear();

    box.innerHTML = [
        vgHoras(hoje, prog, des),
        ci.reuniao ? vgReunioes() : '',
        vgPregacao(hoje, prog, des),
        vgEstudantesRevisitas(hoje),
        vgRelatorio(hoje),
        ci.visitaSC ? vgVisitaSC() : '',
        ci.agenda ? vgAgenda() : ''
    ].join('');
}

// ================= REVISITAS =================
function renderRevisitas() {
    const container = byId('lista-revisitas-container');
    if (!container) return;

    container.innerHTML = '';
    if (revisitas.length === 0) {
        container.innerHTML = '<div class="card"><p>Nenhuma revisita registada.</p></div>';
        return;
    }

    revisitas.forEach((rev, index) => {
        const card = document.createElement('div');
        card.className = 'item-card' + (rev.concluido ? ' completed' : '');
        const quando = rev.datahora ? new Date(rev.datahora).toLocaleString('pt-PT') : '-';
        card.innerHTML =
            '<h3>👤 ' + esc(rev.nome) + '</h3>' +
            '<p><strong>Morada:</strong> ' + esc(rev.morada || '-') + '</p>' +
            '<p><strong>Telefone:</strong> ' + esc(rev.telefone || '-') + '</p>' +
            '<p><strong>Assunto:</strong> ' + esc(rev.assunto || '-') + '</p>' +
            '<p><strong>Texto:</strong> ' + esc(rev.texto || '-') + '</p>' +
            '<p><strong>Dia/Hora:</strong> ' + esc(quando) + '</p>' +
            (rev.nota ? '<p><strong>Nota:</strong> ' + esc(rev.nota) + '</p>' : '') +
            '<p style="margin-top:8px;"><strong>Estado:</strong> ' + (rev.concluido ? '✅ Concluído' : '⏳ Pendente') + '</p>' +
            '<div class="item-actions">' +
                '<button onclick="editRevisita(' + index + ')">Editar</button>' +
                '<button class="btn-secondary" onclick="toggleConcluidoRevisita(' + index + ')">' + (rev.concluido ? 'Marcar Pendente' : 'Concluir') + '</button>' +
                '<button class="btn-danger" onclick="deleteRevisita(' + index + ')">Eliminar</button>' +
            '</div>';
        container.appendChild(card);
    });
}

function openRevisitaForm(index) {
    byId('revisitas-main-view').style.display = 'none';
    byId('estudantes-view').style.display = 'none';
    byId('revisita-form-view').style.display = 'block';

    if (index !== undefined && index !== null) {
        const rev = revisitas[index];
        byId('form-revisita-titulo').textContent = 'Editar Revisita';
        byId('rev-id').value = index;
        byId('rev-nome').value = rev.nome || '';
        byId('rev-morada').value = rev.morada || '';
        byId('rev-telefone').value = rev.telefone || '';
        byId('rev-assunto').value = rev.assunto || '';
        byId('rev-texto').value = rev.texto || '';
        byId('rev-datahora').value = rev.datahora || '';
        byId('rev-nota').value = rev.nota || '';
        byId('rev-concluido').checked = !!rev.concluido;
    } else {
        byId('form-revisita-titulo').textContent = 'Registar Revisita';
        byId('revisita-form').reset();
        byId('rev-id').value = '';
    }
    updateBackBtnVisibility();
}

function closeRevisitaForm() {
    byId('revisita-form-view').style.display = 'none';
    // Só voltar à lista se o ecrã de estudantes não estiver aberto
    if (!isShown('estudantes-view')) {
        byId('revisitas-main-view').style.display = 'block';
    }
    renderRevisitas();
    loadDynamicAgenda();
    updateBackBtnVisibility();
}

function saveRevisita(e) {
    e.preventDefault();
    const id = byId('rev-id').value;
    const revData = {
        nome: byId('rev-nome').value.trim(),
        morada: byId('rev-morada').value.trim(),
        telefone: byId('rev-telefone').value.trim(),
        assunto: byId('rev-assunto').value.trim(),
        texto: byId('rev-texto').value.trim(),
        datahora: byId('rev-datahora').value,
        nota: byId('rev-nota').value.trim(),
        concluido: byId('rev-concluido').checked
    };

    if (id === '') {
        revisitas.push(revData);
    } else {
        revisitas[Number(id)] = revData;
    }

    lsSet('jw_revisitas', revisitas);
    alert('Revisita salva com sucesso!');
    closeRevisitaForm();
}

function editRevisita(index) {
    openRevisitaForm(index);
}

function toggleConcluidoRevisita(index) {
    revisitas[index].concluido = !revisitas[index].concluido;
    lsSet('jw_revisitas', revisitas);
    renderRevisitas();
    loadDynamicAgenda();
}

function deleteRevisita(index) {
    appConfirm('Deseja eliminar esta revisita?', { icone: '🗑️', titulo: 'Eliminar revisita', ok: 'Eliminar', perigo: true }).then(ok => {
        if (!ok) return;
        revisitas.splice(index, 1);
        lsSet('jw_revisitas', revisitas);
        renderRevisitas();
        loadDynamicAgenda();
    });
}

// ================= ESTUDANTES =================
function toggleEstudantesView() {
    estMesKey = '';
    byId('revisitas-main-view').style.display = 'none';
    byId('revisita-form-view').style.display = 'none';
    byId('estudantes-view').style.display = 'block';
    renderEstudantes();
    updateBackBtnVisibility();
}

function hideEstudantesView() {
    byId('estudantes-view').style.display = 'none';
    byId('estudante-form-modal').style.display = 'none';
    if (!isShown('revisita-form-view')) {
        byId('revisitas-main-view').style.display = 'block';
    }
    renderRevisitas();
    updateBackBtnVisibility();
}

// Meses ('AAAA-MM') em que foram dirigidos estudos a cada estudante (caixinha "Estudou em ...")
function mesAtualKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

function mesAtualTxt() {
    const d = new Date();
    return MESES[d.getMonth()] + ' ' + d.getFullYear();
}

function estudouNoMes(est, mesKey) {
    return !!est && Array.isArray(est.meses) && est.meses.includes(mesKey);
}

// Quantos estudantes (pessoas) têm a caixinha marcada nesse mês
function estudantesDoMes(mesKey) {
    return estudantes.filter(e => estudouNoMes(e, mesKey)).length;
}

// Mês mostrado no ecrã Estudantes (por defeito, o mês atual)
let estMesKey = '';

function estMesAtual() {
    return /^\d{4}-\d{2}$/.test(estMesKey) ? estMesKey : mesAtualKey();
}

function mudarMesEstudantes(delta) {
    const p = estMesAtual().split('-').map(Number);
    const d = new Date(p[0], p[1] - 1 + delta, 1);
    estMesKey = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    renderEstudantes();
}

function toggleEstudouMes(index, marcado) {
    const est = estudantes[index];
    if (!est) return;
    const key = estMesAtual();
    const meses = Array.isArray(est.meses) ? est.meses.filter(m => m !== key) : [];
    if (marcado) meses.push(key);
    est.meses = meses;
    lsSet('jw_estudantes', estudantes);
}

function renderEstudantes() {
    const container = byId('lista-estudantes-container');
    if (!container) return;

    const titulo = byId('est-mes-titulo');
    if (titulo) {
        const p = estMesAtual().split('-');
        titulo.textContent = MESES[Number(p[1]) - 1] + ' ' + p[0];
    }

    container.innerHTML = '';
    if (estudantes.length === 0) {
        container.innerHTML = '<div class="card"><p>Nenhum estudante registado.</p></div>';
        return;
    }

    estudantes.forEach((est, index) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML =
            '<h3>🎓 ' + esc(est.nome) + '</h3>' +
            '<p><strong>Telefone:</strong> ' + esc(est.telefone || '-') + '</p>' +
            '<p><strong>Publicação:</strong> ' + esc(est.publicacao || '-') + '</p>' +
            '<p><strong>Lição / Capítulo:</strong> ' + esc(est.licao || '-') + '</p>' +
            '<label class="est-check"><input type="checkbox" onchange="toggleEstudouMes(' + index + ', this.checked)"' +
                (estudouNoMes(est, estMesAtual()) ? ' checked' : '') + '> Estudou em ' + esc(mesTextoDeKey(estMesAtual())) + '</label>' +
            '<div class="item-actions">' +
                '<button onclick="editEstudante(' + index + ')">Editar</button>' +
                '<button class="btn-danger" onclick="deleteEstudante(' + index + ')">Eliminar</button>' +
            '</div>';
        container.appendChild(card);
    });
}

function openEstudanteForm(index) {
    byId('estudante-form-modal').style.display = 'flex';
    if (index !== undefined && index !== null) {
        const est = estudantes[index];
        byId('form-estudante-titulo').textContent = 'Editar Estudante';
        byId('est-id').value = index;
        byId('est-nome').value = est.nome || '';
        byId('est-telefone').value = est.telefone || '';
        byId('est-publicacao').value = est.publicacao || '';
        byId('est-licao').value = est.licao || '';
    } else {
        byId('form-estudante-titulo').textContent = 'Registar Estudante';
        byId('est-id').value = '';
        byId('est-nome').value = '';
        byId('est-telefone').value = '';
        byId('est-publicacao').value = '';
        byId('est-licao').value = '';
    }
}

function closeEstudanteForm() {
    byId('estudante-form-modal').style.display = 'none';
}

function saveEstudante() {
    const id = byId('est-id').value;
    const nome = byId('est-nome').value.trim();
    if (!nome) {
        alert('Por favor, insira o nome do estudante.');
        return;
    }

    const estData = {
        nome: nome,
        telefone: byId('est-telefone').value.trim(),
        publicacao: byId('est-publicacao').value.trim(),
        licao: byId('est-licao').value.trim(),
        meses: (id !== '' && estudantes[Number(id)] && Array.isArray(estudantes[Number(id)].meses)) ? estudantes[Number(id)].meses.slice() : []
    };

    if (id === '') {
        estudantes.push(estData);
    } else {
        estudantes[Number(id)] = estData;
    }

    lsSet('jw_estudantes', estudantes);
    closeEstudanteForm();
    renderEstudantes();
}

function editEstudante(index) {
    openEstudanteForm(index);
}

function deleteEstudante(index) {
    appConfirm('Deseja eliminar este estudante?', { icone: '🗑️', titulo: 'Eliminar estudante', ok: 'Eliminar', perigo: true }).then(ok => {
        if (!ok) return;
        estudantes.splice(index, 1);
        lsSet('jw_estudantes', estudantes);
        renderEstudantes();
    });
}

// ================= VISITA DO SUPERINTENDENTE DE CIRCUITO =================
const SC_CHAVE = 'jw_visita_sc';

// Grupos de campos. Cada campo: k = chave guardada, l = rótulo, tipo = 'text' (por defeito) | 'textarea'.
// O campo k:'diahora' guarda duas chaves: dia e hora (com o prefixo p, se existir, por exemplo 'f_dia' e 'f_hora').
const SC_GRUPOS = {
    reuniao: {
        titulo: 'Editar reunião',
        alerta: 'Reunião guardada com sucesso!',
        secoes: [
            { bloco: 'meio', campos: [
                { k: 'diahora', l: 'Dia e hora' },
                { k: 'presidente', l: 'Presidente' },
                { k: 'oracao_ini', l: 'Oração inicial' }
            ] },
            { bloco: 'meio', titulo: 'Tesouros da Palavra de Deus', icone: '💎', caixa: 'section-tesouros', cor: '#166534', campos: [
                { k: 't_disc', l: 'Discurso' },
                { k: 't_perola', l: 'Pérola Espiritual' },
                { k: 't_leit', l: 'Leitura da Bíblia' }
            ] },
            { bloco: 'meio', titulo: 'Empenhe-se no Ministério', icone: '🌱', caixa: 'section-empenhese', cor: '#1e40af', campos: [
                { k: 'emp_1', l: 'Parte 1' },
                { k: 'emp_2', l: 'Parte 2' },
                { k: 'emp_3', l: 'Parte 3' },
                { k: 'emp_4', l: 'Parte 4' },
                { k: 'emp_5', l: 'Parte 5' }
            ] },
            { bloco: 'meio', titulo: 'Viver como Cristão', icone: '❤️', caixa: 'section-viver', cor: '#991b1b', campos: [
                { k: 'viv_1', l: 'Parte 1' },
                { k: 'viv_2', l: 'Parte 2' },
                { k: 'viv_3', l: 'Parte 3' },
                { k: 'disc_servico', l: 'Discurso de Serviço' },
                { k: 'disc_servico_orador', l: 'Orador' },
                { k: 'oracao_fim', l: 'Oração final' }
            ] },
            { bloco: 'fim', titulo: 'Reunião Fim de Semana', icone: '🎤', caixa: 'section-discurso', cor: '#166534', campos: [
                { k: 'diahora', p: 'f_', l: 'Dia e hora' },
                { k: 'f_oracao_ini', l: 'Oração inicial' },
                { k: 'f_discurso', l: 'Discurso público' },
                { k: 'f_orador', l: 'Orador' }
            ] },
            { bloco: 'fim', titulo: 'Estudo de A Sentinela', icone: '📚', caixa: 'section-sentinela', cor: '#991b1b', campos: [
                { k: 's_dirigente', l: 'Dirigente' },
                { k: 's_disc_final', l: 'Discurso final' },
                { k: 's_disc_final_orador', l: 'Orador' },
                { k: 's_oracao_fim', l: 'Oração final' }
            ] }
        ]
    },
    saida: {
        titulo: 'Editar saída de campo',
        alerta: 'Saída de campo guardada com sucesso!',
        cartao: '🗺️ Saída de campo',
        secoes: [
            { campos: [
                { k: 'hora', l: 'Hora', tipo: 'time' },
                { k: 'dirigente', l: 'Dirigente' }
            ] }
        ],
        tabela: 'saida'
    },
    refeicao: {
        titulo: 'Editar refeição',
        alerta: 'Refeição guardada com sucesso!',
        cartao: '🍽️ Refeição',
        secoes: [],
        tabela: 'refeicao'
    }
};

// Tabela "Dias e Irmãos (ãs) designados (as)" da saída de campo
const SC_DIAS_SAIDA = [
    { nome: 'Quarta-feira', curto: 'Quarta' },
    { nome: 'Quinta-feira', curto: 'Quinta' },
    { nome: 'Sexta-feira', curto: 'Sexta' },
    { nome: 'Sábado', curto: 'Sábado' },
    { nome: 'Domingo', curto: 'Domingo' }
];
const SC_LINHAS_SAIDA = [
    { k: 'sc', l: 'Com o SC:' },
    { k: 'esp', l: 'Com a Esp:' }
];

// Tabela das refeições (famílias que dão cada refeição, por dia)
const SC_DIAS_REFEICAO = [
    { nome: 'Terça-feira', curto: 'Terça' },
    { nome: 'Quarta-feira', curto: 'Quarta' },
    { nome: 'Quinta-feira', curto: 'Quinta' },
    { nome: 'Sexta-feira', curto: 'Sexta' },
    { nome: 'Sábado', curto: 'Sábado' },
    { nome: 'Domingo', curto: 'Domingo' },
    { nome: 'Segunda-feira', curto: 'Segunda' }
];
const SC_LINHAS_REFEICAO = [
    { k: 'matabicho', l: 'Matabicho' },
    { k: 'almoco', l: 'Almoço' },
    { k: 'jantar', l: 'Jantar' }
];

function scTabelaRefeicaoHtml(dados, editavel) {
    let h = '<div class="sc-tabela-wrap"><table class="sc-tabela"><thead><tr><th></th>';
    SC_DIAS_REFEICAO.forEach(d => { h += '<th>' + esc(d.curto) + '</th>'; });
    h += '</tr></thead><tbody>';
    SC_LINHAS_REFEICAO.forEach(linha => {
        const vals = (dados && dados[linha.k] && typeof dados[linha.k] === 'object') ? dados[linha.k] : {};
        h += '<tr><th>' + esc(linha.l) + '</th>';
        SC_DIAS_REFEICAO.forEach((d, i) => {
            if (editavel) {
                h += '<td><input type="text" id="sc-r-' + linha.k + '-' + i + '" placeholder="-"></td>';
            } else {
                h += '<td>' + (vals[d.nome] ? esc(vals[d.nome]) : '-') + '</td>';
            }
        });
        h += '</tr>';
    });
    return h + '</tbody></table></div>';
}

function scRefeicaoTemDados(dados) {
    if (!dados) return false;
    return SC_LINHAS_REFEICAO.some(l => dados[l.k] && typeof dados[l.k] === 'object' && SC_DIAS_REFEICAO.some(d => dados[l.k][d.nome]));
}

const SC_PERIODOS = [
    { k: 'manha', l: 'Manhã' },
    { k: 'tarde', l: 'Tarde' }
];

// Dados de um período (aceita o formato antigo, em que sc/esp estavam na raiz = manhã)
function scPeriodo(dados, per) {
    if (!dados || typeof dados !== 'object') return {};
    const p = dados[per];
    if (p && typeof p === 'object') return p;
    if (per === 'manha' && (dados.sc || dados.esp)) return { sc: dados.sc, esp: dados.esp };
    return {};
}

function scTabelaSaidaHtml(dados, editavel, per) {
    const dp = scPeriodo(dados, per);
    let h = '<div class="sc-tabela-wrap"><table class="sc-tabela"><thead><tr><th></th>';
    SC_DIAS_SAIDA.forEach(d => { h += '<th>' + esc(d.curto) + '</th>'; });
    h += '</tr></thead><tbody>';
    SC_LINHAS_SAIDA.forEach(linha => {
        const vals = (dp[linha.k] && typeof dp[linha.k] === 'object') ? dp[linha.k] : {};
        h += '<tr><th>' + esc(linha.l) + '</th>';
        SC_DIAS_SAIDA.forEach((d, i) => {
            if (editavel) {
                h += '<td><input type="text" id="sc-t-' + per + '-' + linha.k + '-' + i + '" placeholder="-"></td>';
            } else {
                h += '<td>' + (vals[d.nome] ? esc(vals[d.nome]) : '-') + '</td>';
            }
        });
        h += '</tr>';
    });
    return h + '</tbody></table></div>';
}

function scSaidaTemDados(dados) {
    if (!dados) return false;
    if (dados.hora || dados.dirigente) return true;
    return SC_PERIODOS.some(p => {
        const dp = scPeriodo(dados, p.k);
        return SC_LINHAS_SAIDA.some(l => dp[l.k] && SC_DIAS_SAIDA.some(d => dp[l.k][d.nome]));
    });
}

const SC_VISTAS = ['sc-lista-view', 'sc-opcoes-view', 'sc-form-view'];

let scDados = {};
let scGrupo = '';

function scMostrar(id) {
    SC_VISTAS.forEach(v => {
        const el = byId(v);
        if (el) el.style.display = (v === id) ? 'block' : 'none';
    });
    const main = byId('app-container');
    if (main) main.scrollTop = 0;
}

function scValor(dados, campo) {
    if (campo.k === 'diahora') {
        const p = campo.p || '';
        return formatDiaHora(dados[p + 'dia'] || '', dados[p + 'hora'] || '');
    }
    return dados[campo.k] || '';
}

function scSecaoTemDados(dados, secao) {
    return secao.campos.some(c => scValor(dados, c) !== '');
}

function scLinhaHtml(dados, campo) {
    const valor = scValor(dados, campo);
    return '<p><strong>' + esc(campo.l) + ':</strong> ' +
        (valor ? esc(valor).replace(/\n/g, '<br>') : '-') + '</p>';
}

// Cartão com as secções (só as que têm dados) de um grupo/bloco
function scCartaoHtml(titulo, secoes, dados) {
    const comDados = secoes.filter(s => scSecaoTemDados(dados, s));
    if (comDados.length === 0) return '';

    let html = '<div class="card sc-card"><h3>' + esc(titulo) + '</h3>';
    comDados.forEach(s => {
        const linhas = s.campos.map(c => scLinhaHtml(dados, c)).join('');
        if (s.titulo) {
            html += '<div class="section-box ' + s.caixa + '"><h4>' + s.icone + ' ' + esc(s.titulo) + '</h4>' + linhas + '</div>';
        } else {
            html += linhas;
        }
    });
    return html + '</div>';
}

// Ecrã "Programa da Visita": mostra o que foi guardado
function renderVisitaSC() {
    const box = byId('sc-resultado');
    if (!box) return;

    const reuniao = scDados.reuniao || {};
    const secReuniao = SC_GRUPOS.reuniao.secoes;

    let html = '';
    html += scCartaoHtml('👥 Reunião do Meio de Semana', secReuniao.filter(s => s.bloco === 'meio'), reuniao);
    html += scCartaoHtml('👥 Reunião de Fim de Semana', secReuniao.filter(s => s.bloco === 'fim'), reuniao);
    if (scSaidaTemDados(scDados.saida)) {
        const sd = scDados.saida;
        html += '<div class="card sc-card"><h3>' + SC_GRUPOS.saida.cartao + '</h3>' +
            '<p><strong>Hora:</strong> ' + (sd.hora ? esc(formatHoraReuniao(sd.hora)) : '-') + '</p>' +
            '<p><strong>Dirigente:</strong> ' + (sd.dirigente ? esc(sd.dirigente) : '-') + '</p>' +
            SC_PERIODOS.map(p =>
                '<h4 class="sc-sec-titulo">Dias e Irmãos (ãs) designados (as) – ' + p.l + '</h4>' +
                scTabelaSaidaHtml(sd, false, p.k)).join('') + '</div>';
    }
    if (scRefeicaoTemDados(scDados.refeicao)) {
        html += '<div class="card sc-card"><h3>' + SC_GRUPOS.refeicao.cartao + '</h3>' +
            '<h4 class="sc-sec-titulo">Famílias que dão a refeição</h4>' +
            scTabelaRefeicaoHtml(scDados.refeicao, false) + '</div>';
    }

    if (!html) {
        html = '<div class="card">' +
            '<p>Ainda não foi criado o programa da visita.</p>' +
            '<p class="cal-hint">Toque em + para começar.</p>' +
            '</div>';
    }
    box.innerHTML = html;
}

// Abre o ecrã (chamado ao abrir "Visita do S.C")
function loadVisitaSC() {
    const guardado = lsGet(SC_CHAVE, {});
    scDados = (guardado && typeof guardado === 'object') ? guardado : {};
    scGrupo = '';
    scMostrar('sc-lista-view');
    renderVisitaSC();
    updateBackBtnVisibility();
}

// Ao sair do ecrã: volta a deixar a lista como vista inicial
function resetVisitaSC() {
    scGrupo = '';
    scMostrar('sc-lista-view');
}

// Botão "+": ecrã com as opções
function openScOpcoes() {
    scGrupo = '';
    scMostrar('sc-opcoes-view');
    updateBackBtnVisibility();
}

function closeScOpcoes() {
    scMostrar('sc-lista-view');
    renderVisitaSC();
    updateBackBtnVisibility();
}

function scFormHtml(grupo) {
    const dias = DIAS_SEMANA.map(d => '<option value="' + d.nome + '">' + d.nome + '</option>').join('');
    let html = '';

    SC_GRUPOS[grupo].secoes.forEach(sec => {
        if (sec.titulo) {
            html += '<h4 class="sc-sec-titulo" style="color:' + sec.cor + ';">- ' + esc(sec.titulo) + ' -</h4>';
        }
        sec.campos.forEach(c => {
            html += '<label>' + esc(c.l) + ':</label>';
            if (c.k === 'diahora') {
                const p = c.p || '';
                html += '<div class="dia-hora-row">' +
                    '<select id="sc-f-' + p + 'dia"><option value="">Dia da semana</option>' + dias + '</select>' +
                    '<input type="time" id="sc-f-' + p + 'hora">' +
                    '</div>';
            } else if (c.tipo === 'time') {
                html += '<input type="time" id="sc-f-' + c.k + '">';
            } else if (c.tipo === 'textarea') {
                html += '<textarea id="sc-f-' + c.k + '" placeholder="' + esc(c.l) + '..."></textarea>';
            } else {
                html += '<input type="text" id="sc-f-' + c.k + '" placeholder="' + esc(c.l) + '...">';
            }
        });
    });
    if (SC_GRUPOS[grupo].tabela === 'refeicao') {
        html += '<h4 class="sc-sec-titulo" style="color:#1e3a8a;">- Famílias que dão a refeição -</h4>' +
            scTabelaRefeicaoHtml(null, true);
    } else if (SC_GRUPOS[grupo].tabela === 'saida') {
        SC_PERIODOS.forEach(p => {
            html += '<h4 class="sc-sec-titulo" style="color:#1e3a8a;">- Dias e Irmãos (ãs) designados (as) ' + p.l + ' -</h4>' +
                scTabelaSaidaHtml(null, true, p.k);
        });
    }
    return html;
}

// Abre um dos formulários, já preenchido com o que estiver guardado
function openScForm(grupo) {
    if (!SC_GRUPOS[grupo]) return;
    scGrupo = grupo;
    const dados = scDados[grupo] || {};

    byId('sc-form-titulo').textContent = SC_GRUPOS[grupo].titulo;
    byId('sc-form-campos').innerHTML = scFormHtml(grupo);

    SC_GRUPOS[grupo].secoes.forEach(sec => sec.campos.forEach(c => {
        if (c.k === 'diahora') {
            const p = c.p || '';
            byId('sc-f-' + p + 'dia').value = dados[p + 'dia'] || '';
            byId('sc-f-' + p + 'hora').value = dados[p + 'hora'] || '';
        } else {
            byId('sc-f-' + c.k).value = dados[c.k] || '';
        }
    }));

    if (SC_GRUPOS[grupo].tabela === 'refeicao') {
        SC_LINHAS_REFEICAO.forEach(l => SC_DIAS_REFEICAO.forEach((d, i) => {
            const v = dados[l.k] && typeof dados[l.k] === 'object' ? dados[l.k][d.nome] : '';
            byId('sc-r-' + l.k + '-' + i).value = v || '';
        }));
    } else if (SC_GRUPOS[grupo].tabela === 'saida') {
        SC_PERIODOS.forEach(p => {
            const dp = scPeriodo(dados, p.k);
            SC_LINHAS_SAIDA.forEach(l => SC_DIAS_SAIDA.forEach((d, i) => {
                const v = dp[l.k] && typeof dp[l.k] === 'object' ? dp[l.k][d.nome] : '';
                byId('sc-t-' + p.k + '-' + l.k + '-' + i).value = v || '';
            }));
        });
    }

    scMostrar('sc-form-view');
    updateBackBtnVisibility();
}

function saveScForm() {
    const grupo = SC_GRUPOS[scGrupo];
    if (!grupo) return;

    const novo = {};
    grupo.secoes.forEach(sec => sec.campos.forEach(c => {
        if (c.k === 'diahora') {
            const p = c.p || '';
            novo[p + 'dia'] = byId('sc-f-' + p + 'dia').value;
            novo[p + 'hora'] = byId('sc-f-' + p + 'hora').value;
        } else {
            novo[c.k] = byId('sc-f-' + c.k).value.trim();
        }
    }));

    if (grupo.tabela === 'refeicao') {
        SC_LINHAS_REFEICAO.forEach(l => {
            novo[l.k] = {};
            SC_DIAS_REFEICAO.forEach((d, i) => {
                novo[l.k][d.nome] = byId('sc-r-' + l.k + '-' + i).value.trim();
            });
        });
    } else if (grupo.tabela === 'saida') {
        SC_PERIODOS.forEach(p => {
            novo[p.k] = {};
            SC_LINHAS_SAIDA.forEach(l => {
                novo[p.k][l.k] = {};
                SC_DIAS_SAIDA.forEach((d, i) => {
                    novo[p.k][l.k][d.nome] = byId('sc-t-' + p.k + '-' + l.k + '-' + i).value.trim();
                });
            });
        });
    }

    scDados[scGrupo] = novo;
    lsSet(SC_CHAVE, scDados);
    alert(grupo.alerta);

    scGrupo = '';
    scMostrar('sc-lista-view');
    renderVisitaSC();
    updateBackBtnVisibility();
}

// Reuniões da visita do SC que acontecem hoje (saída de campo e refeições não aparecem no Início)
const SC_AGENDA = [
    { grupo: 'reuniao', dia: 'dia', hora: 'hora', rotulo: 'Meio de semana' },
    { grupo: 'reuniao', dia: 'f_dia', hora: 'f_hora', rotulo: 'Fim de semana' }
];

function visitaSCDeHoje(hoje) {
    const guardado = lsGet(SC_CHAVE, {});
    const dados = (guardado && typeof guardado === 'object') ? guardado : {};
    const hojeIdx = (hoje.getDay() + 6) % 7;
    const lista = [];

    SC_AGENDA.forEach(item => {
        const grupo = dados[item.grupo] || {};
        const dia = grupo[item.dia] || '';
        const idx = DIAS_SEMANA.findIndex(d => d.nome === dia);
        if (idx === hojeIdx) {
            lista.push({ rotulo: item.rotulo, hora: grupo[item.hora] || '', texto: formatDiaHora(dia, grupo[item.hora]) });
        }
    });

    // Por ordem da hora (sem hora no fim)
    lista.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));
    return lista;
}

// ================= RELATÓRIO DE CAMPO =================
const REL_DESIG = { Regular: 'Pioneiro Regular', Especial: 'Pioneiro Especial', Auxiliar: 'Pioneiro Auxiliar' };
const CRON_CHAVE = 'jw_cronometro';
const REL_NOME_CHAVE = 'jw_rel_nome';
let relMenuId = null;

// "10:30" -> 630 minutos; "10" -> 600 (horas); NaN se não for válido
function parseHoraRel(txt) {
    const m = String(txt).trim().match(/^(\d+)(?:\s*[:h]\s*:?\s*(\d{1,2}))?\s*(?:min)?$/i);
    if (!m) return NaN;
    const min = Number(m[2] || 0);
    if (min > 59) return NaN;
    return Number(m[1]) * 60 + min;
}

function fmtMinutos(min) {
    min = Math.max(0, Math.round(min || 0));
    return Math.floor(min / 60) + 'h:' + pad2(min % 60);
}

// Lê dois campos (horas e minutos) e devolve o total em minutos; null se inválido (já avisou)
function lerHorasMinutos(idH, idM) {
    const h = byId(idH).value.trim();
    const m = byId(idM).value.trim();
    const hn = h === '' ? 0 : Number(h);
    const mn = m === '' ? 0 : Number(m);
    if (!isFinite(hn) || !isFinite(mn) || hn < 0 || mn < 0 || mn > 59 || hn !== Math.floor(hn) || mn !== Math.floor(mn)) {
        alert('Tempo inválido. Horas: número inteiro. Minutos: de 0 a 59.');
        return null;
    }
    return hn * 60 + mn;
}

function setHorasMinutos(idH, idM, minutos) {
    byId(idH).value = minutos > 0 ? String(Math.floor(minutos / 60)) : '';
    byId(idM).value = minutos > 0 ? String(minutos % 60) : '';
}

function relNumTxt(v) {
    return (v === '' || v == null) ? '' : String(v);
}

// Aceita também os relatórios antigos (mes, horas, notas)
function normalizeRelatorio(r) {
    r = (r && typeof r === 'object') ? r : {};
    let minutos = Number(r.minutos);
    if (!isFinite(minutos)) minutos = r.horas ? (parseHoraRel(r.horas) || 0) : 0;
    return {
        id: r.id ? String(r.id) : novoId(),
        nome: String(r.nome || ''),
        mes: String(r.mes || ''),
        mesKey: String(r.mesKey || ''),
        participou: !!r.participou,
        estudosPub: relNumTxt(r.estudosPub),
        designacao: REL_DESIG[r.designacao] ? r.designacao : '',
        minutos: minutos > 0 ? Math.round(minutos) : 0,
        estudosPio: relNumTxt(r.estudosPio),
        nota: String(r.nota != null ? r.nota : (r.notas || ''))
    };
}

function relTemPublicador(r) {
    return r.participou || r.estudosPub !== '';
}

function relTemPioneiro(r) {
    return !!(r.designacao || r.minutos || r.estudosPio !== '' || r.nota);
}

// ---------- Designação (vem do ecrã Pregação) ----------
function progDesignacao() {
    const p = lsGet('jw_meu_programa', null);
    return (p && typeof p === 'object' && REL_DESIG[p.designacao]) ? p.designacao : '';
}

function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Atividade de campo (dia a dia) ----------
const ATIV_CHAVE = 'jw_atividades';
let atividades = [];
let ativEditId = null;
let ativMenuId = null;
let relAba = 'ativ';

function normalizeAtividade(a) {
    a = (a && typeof a === 'object') ? a : {};
    const min = Math.round(Number(a.minutos));
    const est = Math.round(Number(a.estudos));
    return {
        id: a.id ? String(a.id) : novoId(),
        data: /^\d{4}-\d{2}-\d{2}$/.test(String(a.data)) ? String(a.data) : '',
        minutos: min > 0 ? min : 0,
        estudos: est > 0 ? est : 0
    };
}

function hojeKey() {
    const d = new Date();
    return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function ativGuardar() {
    lsSet(ATIV_CHAVE, atividades);
}

// Soma ao dia se já existir; senão cria
function ativAdicionar(data, minutos, estudos) {
    const ex = atividades.find(a => a.data === data);
    if (ex) {
        ex.minutos += minutos;
        ex.estudos += estudos;
        return ex;
    }
    const nova = normalizeAtividade({ id: novoId(), data: data, minutos: minutos, estudos: estudos });
    atividades.push(nova);
    return nova;
}

// Totais de um mês ('AAAA-MM')
function ativTotaisMes(mesKey) {
    const t = { minutos: 0, estudos: 0, dias: 0 };
    atividades.forEach(a => {
        if (a.data.slice(0, 7) === mesKey && (a.minutos || a.estudos)) {
            t.minutos += a.minutos;
            t.estudos += a.estudos;
            t.dias++;
        }
    });
    return t;
}

function mesTextoDeKey(mesKey) {
    const p = String(mesKey).split('-');
    return (MESES[Number(p[1]) - 1] || '-') + ' ' + p[0];
}

function dataCurta(key) {
    const p = key.split('-').map(Number);
    return DIAS_SEMANA[weekdayIndex(p[0], p[1] - 1, p[2])].curto + ', ' + p[2] + ' ' + MESES[p[1] - 1].slice(0, 3).toLowerCase();
}

function ativValoresTxt(a) {
    const partes = [];
    if (a.minutos) partes.push(fmtMinutos(a.minutos));
    if (a.estudos) partes.push(a.estudos + (a.estudos === 1 ? ' estudo' : ' estudos'));
    return partes.join(' · ') || '-';
}

function renderAtividades() {
    const box = byId('ativ-resultado');
    if (!box) return;

    const lista = atividades.filter(a => a.data && (a.minutos || a.estudos));
    if (lista.length === 0) {
        box.innerHTML = '<div class="card"><p>Ainda não registou nenhuma atividade de campo.</p>' +
            '<p class="cal-hint">Toque em + e escolha "Atividade de campo", ou guarde o cronómetro.</p></div>';
        return;
    }

    const meses = {};
    lista.forEach(a => {
        const k = a.data.slice(0, 7);
        (meses[k] = meses[k] || []).push(a);
    });

    box.innerHTML = Object.keys(meses).sort().reverse().map(k => {
        const t = ativTotaisMes(k);
        let h = '<div class="item-card"><h3>📅 ' + esc(mesTextoDeKey(k)) + '</h3>' +
            '<p><strong>Total de horas:</strong> ' + esc(fmtMinutos(t.minutos)) + '</p>' +
            '<p><strong>Estudantes com estudo dirigido:</strong> ' + estudantesDoMes(k) + '</p>' +
            '<p><strong>Dias de campo:</strong> ' + t.dias + '</p>' +
            '<h4 class="rel-sec-titulo">Dias</h4>';
        meses[k].sort((x, y) => y.data.localeCompare(x.data)).forEach(a => {
            h += '<div class="ativ-linha"><div><div class="ativ-dia">' + esc(dataCurta(a.data)) + '</div>' +
                '<div class="ativ-valores">' + esc(ativValoresTxt(a)) + '</div></div>' +
                '<button type="button" class="rel-menu-btn" aria-label="Mais opções" onclick="openAtivMenu(\'' + esc(a.id) + '\')">⋮</button></div>';
        });
        return h + '</div>';
    }).join('');
}

function openAtivForm(id) {
    closeRelModais();
    ativEditId = null;
    let a = null;
    if (id) {
        a = atividades.find(x => x.id === String(id)) || null;
        if (a) ativEditId = a.id;
    }
    byId('ativ-form-titulo').textContent = a ? 'Editar atividade' : 'Atividade de campo';
    byId('ativ-data').value = a ? a.data : hojeKey();
    setHorasMinutos('ativ-horas', 'ativ-minutos', a ? a.minutos : 0);
    byId('ativ-estudos').value = (a && a.estudos) ? String(a.estudos) : '';
    byId('ativ-form-hint').textContent = a ? 'Os valores guardados são substituídos pelos que escrever aqui.'
                                           : 'Se já registou este dia, os valores são somados.';
    relMostrar('ativ-form-view');
    updateBackBtnVisibility();
}

function closeAtivForm() {
    ativEditId = null;
    relMostrar('rel-lista-view');
    setRelAba('ativ');
    updateBackBtnVisibility();
}

function saveAtivForm() {
    const data = byId('ativ-data').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { alert('Indique a data.'); return; }

    const minutos = lerHorasMinutos('ativ-horas', 'ativ-minutos');
    if (minutos === null) return;
    const estTxt = byId('ativ-estudos').value.trim();
    const estudos = estTxt ? Math.round(Number(estTxt)) : 0;
    if (!isFinite(estudos) || estudos < 0) { alert('Número de estudos inválido.'); return; }
    if (minutos === 0 && estudos === 0) { alert('Indique a hora ou o número de estudos.'); return; }

    const edicao = !!ativEditId;
    if (edicao) atividades = atividades.filter(a => a.id !== ativEditId);
    const dia = ativAdicionar(data, minutos, estudos);
    ativGuardar();

    ativEditId = null;
    closeAtivForm();
    alert(edicao ? 'Atividade atualizada.' : 'Atividade guardada. Total do dia: ' + ativValoresTxt(dia));
}

function openAtivMenu(id) {
    ativMenuId = String(id);
    byId('ativ-menu-modal').style.display = 'flex';
}

function editAtividade() {
    const id = ativMenuId;
    closeRelModais();
    if (id) openAtivForm(id);
}

function deleteAtividade() {
    const a = atividades.find(x => x.id === ativMenuId);
    closeRelModais();
    if (!a) return;
    appConfirm('Deseja eliminar a atividade de ' + dataCurta(a.data) + '?', { icone: '🗑️', titulo: 'Eliminar atividade', ok: 'Eliminar', perigo: true }).then(ok => {
        if (!ok) return;
        atividades = atividades.filter(x => x !== a);
        ativGuardar();
        renderAtividades();
    });
}

function setRelAba(aba) {
    relAba = (aba === 'rel') ? 'rel' : 'ativ';
    byId('ativ-resultado').style.display = relAba === 'ativ' ? 'block' : 'none';
    byId('rel-resultado').style.display = relAba === 'rel' ? 'block' : 'none';
    byId('rel-aba-ativ').className = 'rel-aba' + (relAba === 'ativ' ? ' ativa' : '');
    byId('rel-aba-rel').className = 'rel-aba' + (relAba === 'rel' ? ' ativa' : '');
    renderRelatorios();
}

// ---------- Cronómetro ----------
function cronEstado() {
    const e = lsGet(CRON_CHAVE, {}) || {};
    return { acum: Number(e.acum) > 0 ? Number(e.acum) : 0, inicio: Number(e.inicio) > 0 ? Number(e.inicio) : 0 };
}

function cronMs(e) {
    return e.acum + (e.inicio ? Math.max(0, Date.now() - e.inicio) : 0);
}

function fmtCron(ms) {
    const s = Math.floor(ms / 1000);
    return pad2(Math.floor(s / 3600)) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60);
}

function renderCron() {
    const e = cronEstado();
    const ms = cronMs(e);
    const tempo = byId('cron-tempo');
    if (!tempo) return;
    tempo.textContent = fmtCron(ms);

    const estado = byId('cron-estado');
    estado.textContent = e.inicio ? 'A contar…' : (ms > 0 ? 'Em pausa' : 'Parado');
    estado.className = 'cron-estado' + (e.inicio ? ' ativo' : '');
    byId('cron-btn').textContent = e.inicio ? '⏸ Pausar' : (ms > 0 ? '▶ Retomar' : '▶ Iniciar');
    byId('cron-zerar').disabled = ms === 0;
    byId('cron-guardar').disabled = Math.floor(ms / 60000) < 1;

    const des = progDesignacao();
    byId('cron-destino').textContent = des
        ? 'Será registado como ' + REL_DESIG[des] + ' (definido em Pregação).'
        : 'Será registado como Publicador (sem designação definida em Pregação).';
}

function cronToggle() {
    const e = cronEstado();
    if (e.inicio) {
        e.acum = cronMs(e);
        e.inicio = 0;
    } else {
        e.inicio = Date.now();
    }
    lsSet(CRON_CHAVE, e);
    renderCron();
}

function cronZerar() {
    const zerar = () => { lsSet(CRON_CHAVE, { acum: 0, inicio: 0 }); renderCron(); };
    if (cronMs(cronEstado()) > 0) {
        appConfirm('Zerar o cronómetro?', { icone: '⏱️', titulo: 'Zerar cronómetro', ok: 'Zerar', perigo: true }).then(ok => { if (ok) zerar(); });
    } else {
        zerar();
    }
}

// Soma o tempo (minutos completos) à atividade de hoje; os segundos que sobram ficam no cronómetro
function cronGuardar() {
    const e = cronEstado();
    const ms = cronMs(e);
    const min = Math.floor(ms / 60000);
    if (min < 1) { alert('O cronómetro ainda não chegou a 1 minuto.'); return; }

    const dia = ativAdicionar(hojeKey(), min, 0);
    ativGuardar();
    lsSet(CRON_CHAVE, { acum: ms - min * 60000, inicio: e.inicio ? Date.now() : 0 });

    const des = progDesignacao();
    relMostrar('rel-lista-view');
    setRelAba('ativ');
    alert('Guardado: ' + fmtMinutos(min) + ' (' + (des ? REL_DESIG[des] : 'Publicador') + '). Total de hoje: ' + ativValoresTxt(dia));
}

// ---------- Ecrãs ----------
const REL_VISTAS = ['rel-lista-view', 'rel-form-view', 'ativ-form-view'];
const REL_MODAIS = ['rel-add-modal', 'rel-menu-modal', 'ativ-menu-modal'];

function relMostrar(id) {
    REL_VISTAS.forEach(v => {
        const el = byId(v);
        if (el) el.style.display = (v === id) ? 'block' : 'none';
    });
    const main = byId('app-container');
    if (main) main.scrollTop = 0;
}

function relModalAberto() {
    return REL_MODAIS.some(m => byId(m).style.display === 'flex');
}

function closeRelModais() {
    relMenuId = null;
    ativMenuId = null;
    REL_MODAIS.forEach(m => {
        const el = byId(m);
        if (el) el.style.display = 'none';
    });
}

function resetRelatorio() {
    closeRelModais();
    ativEditId = null;
    relMostrar('rel-lista-view');
}

function renderRelatorios() {
    renderCron();
    renderAtividades();
    const box = byId('rel-resultado');
    if (!box) return;

    if (relatorios.length === 0) {
        box.innerHTML = '<div class="card"><p>Ainda não foi preenchido nenhum relatório.</p>' +
            '<p class="cal-hint">Toque em + e escolha "Relatório de campo".</p></div>';
        return;
    }

    const ordenados = relatorios.slice().sort((a, b) => b.mesKey.localeCompare(a.mesKey));
    box.innerHTML = ordenados.map(r => {
        let h = '<div class="item-card"><div class="rel-cab"><div>' +
            '<h3>📄 ' + esc(r.nome || 'Sem nome') + '</h3>' +
            '<div class="rel-mes-txt">' + esc(r.mes || '-') + '</div></div>' +
            '<button type="button" class="rel-menu-btn" aria-label="Mais opções" onclick="openRelMenu(\'' + esc(r.id) + '\')">⋮</button></div>';

        if (relTemPublicador(r)) {
            h += '<h4 class="rel-sec-titulo">Publicador</h4>';
            if (r.participou) h += '<p><strong>Participou em atividade de campo:</strong> Sim</p>';
            if (r.estudosPub !== '') h += '<p><strong>Estudo dirigido:</strong> ' + esc(r.estudosPub) + '</p>';
        }
        if (relTemPioneiro(r)) {
            h += '<h4 class="rel-sec-titulo">Pioneiro</h4>';
            if (r.designacao) h += '<p><strong>Designação:</strong> ' + esc(REL_DESIG[r.designacao]) + '</p>';
            if (r.minutos) h += '<p><strong>Hora:</strong> ' + esc(fmtMinutos(r.minutos)) + '</p>';
            if (r.estudosPio !== '') h += '<p><strong>Estudo dirigido:</strong> ' + esc(r.estudosPio) + '</p>';
            if (r.nota) h += '<p><strong>Nota:</strong> ' + esc(r.nota).replace(/\n/g, '<br>') + '</p>';
        }
        return h + '</div>';
    }).join('');
}

// Botão "+": escolher entre atividade de campo e relatório de campo
function openRelAdd() {
    byId('rel-add-modal').style.display = 'flex';
}

// ---------- Formulário do relatório (preenchido com os totais das atividades) ----------
function relTotaisDoForm() {
    const mesKey = byId('rel-mes').value;
    const t = ativTotaisMes(mesKey);
    // Estudos dirigidos = nº de estudantes com a caixinha marcada nesse mês (ecrã Estudantes)
    t.estudantes = estudantesDoMes(mesKey);
    return t;
}

function relPreencherPioneiro() {
    const t = relTotaisDoForm();
    if (t.minutos > 0 && !byId('rel-horas').value.trim() && !byId('rel-minutos').value.trim()) {
        setHorasMinutos('rel-horas', 'rel-minutos', t.minutos);
    }
    if (t.estudantes > 0 && !byId('rel-estudos-pio').value.trim()) byId('rel-estudos-pio').value = String(t.estudantes);
}

function relPreencherPublicador() {
    const t = relTotaisDoForm();
    if (t.estudantes > 0 && !byId('rel-estudos-pub').value.trim()) byId('rel-estudos-pub').value = String(t.estudantes);
}

// Limpa os campos automáticos e volta a preenchê-los conforme a designação (ecrã Pregação) e o mês
function relAutoPreencher() {
    byId('rel-participou').checked = false;
    byId('rel-estudos-pub').value = '';
    Object.keys(REL_DESIG).forEach(k => { byId('rel-desig-' + k).checked = false; });
    byId('rel-horas').value = '';
    byId('rel-minutos').value = '';
    byId('rel-estudos-pio').value = '';

    const mesKey = byId('rel-mes').value;
    const t = relTotaisDoForm();
    const des = progDesignacao();

    if (des) {
        byId('rel-desig-' + des).checked = true;
        relPreencherPioneiro();
    } else if (t.dias > 0 || t.estudantes > 0) {
        byId('rel-participou').checked = t.dias > 0;
        relPreencherPublicador();
    }

    byId('rel-auto-hint').textContent = (t.dias > 0 || t.estudantes > 0)
        ? 'Preenchido automaticamente para ' + mesTextoDeKey(mesKey) + ': ' + fmtMinutos(t.minutos) + ' em ' + t.dias +
          (t.dias === 1 ? ' dia' : ' dias') + ' de campo; ' + t.estudantes + (t.estudantes === 1 ? ' estudante' : ' estudantes') +
          ' com estudo dirigido. Pode corrigir.'
        : 'Não há atividades de campo nem estudantes marcados neste mês.';
}

function openRelForm() {
    closeRelModais();
    byId('rel-nome').value = lsGet(REL_NOME_CHAVE, '') || '';
    const hoje = new Date();
    byId('rel-mes').value = hoje.getFullYear() + '-' + pad2(hoje.getMonth() + 1);
    byId('rel-nota').value = '';
    relAutoPreencher();

    relMostrar('rel-form-view');
    updateBackBtnVisibility();
}

function closeRelForm() {
    relMostrar('rel-lista-view');
    setRelAba('rel');
    updateBackBtnVisibility();
}

// Só uma designação de cada vez; ao marcar, preenche hora e estudos com os totais do mês
function relDesig(k) {
    const marcado = byId('rel-desig-' + k).checked;
    Object.keys(REL_DESIG).forEach(o => { byId('rel-desig-' + o).checked = (o === k) && marcado; });
    if (marcado) relPreencherPioneiro();
}

// Ao marcar "Participou", preenche os estudos com o total do mês
function relParticipou() {
    if (byId('rel-participou').checked) relPreencherPublicador();
}

function saveRelForm() {
    const nome = byId('rel-nome').value.trim();
    const mesKey = byId('rel-mes').value;
    if (!nome) { alert('Indique o nome.'); return; }
    if (!/^\d{4}-\d{2}$/.test(mesKey)) { alert('Indique o mês.'); return; }

    const minutos = lerHorasMinutos('rel-horas', 'rel-minutos');
    if (minutos === null) return;

    const rel = normalizeRelatorio({
        id: novoId(),
        nome: nome,
        mes: mesTextoDeKey(mesKey),
        mesKey: mesKey,
        participou: byId('rel-participou').checked,
        estudosPub: byId('rel-estudos-pub').value.trim(),
        designacao: Object.keys(REL_DESIG).find(k => byId('rel-desig-' + k).checked) || '',
        minutos: minutos,
        estudosPio: byId('rel-estudos-pio').value.trim(),
        nota: byId('rel-nota').value.trim()
    });

    if (!relTemPublicador(rel) && !relTemPioneiro(rel)) {
        alert('Preencha pelo menos um campo do relatório.');
        return;
    }

    // Um relatório por mês e nome: se já existir, substitui
    const idx = relatorios.findIndex(r => r.mesKey === rel.mesKey && r.nome.toLowerCase() === rel.nome.toLowerCase());
    if (idx >= 0) relatorios[idx] = rel; else relatorios.push(rel);

    lsSet('jw_relatorios', relatorios);
    lsSet(REL_NOME_CHAVE, nome);

    closeRelForm();
    alert('Relatório guardado com sucesso!');
}

// ---------- Menu de três pontos (relatório) ----------
function openRelMenu(id) {
    relMenuId = String(id);
    byId('rel-menu-modal').style.display = 'flex';
}

function closeRelMenu() {
    closeRelModais();
}

function relAtual() {
    return relatorios.find(r => String(r.id) === relMenuId) || null;
}

function relTextoPartilha(r) {
    const l = ['Relatório de Campo – ' + (r.mes || '-')];
    if (r.nome) l.push('Nome: ' + r.nome);
    if (relTemPublicador(r)) {
        l.push('', 'Publicador');
        if (r.participou) l.push('Participou em atividade de campo: Sim');
        if (r.estudosPub !== '') l.push('Estudo dirigido: ' + r.estudosPub);
    }
    if (relTemPioneiro(r)) {
        l.push('', 'Pioneiro');
        if (r.designacao) l.push('Designação: ' + REL_DESIG[r.designacao]);
        if (r.minutos) l.push('Hora: ' + fmtMinutos(r.minutos));
        if (r.estudosPio !== '') l.push('Estudo dirigido: ' + r.estudosPio);
        if (r.nota) l.push('Nota: ' + r.nota);
    }
    return l.join('\n');
}

function shareRelatorio() {
    const r = relAtual();
    closeRelModais();
    if (!r) return;
    const texto = relTextoPartilha(r);

    if (navigator.share) {
        navigator.share({ text: texto }).catch(() => {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => alert('Relatório copiado.')).catch(() => {
            window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
        });
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    }
}

function deleteRelatorio() {
    const r = relAtual();
    closeRelModais();
    if (!r) return;
    appConfirm('Deseja eliminar o relatório de ' + (r.mes || 'este mês') + '?', { icone: '🗑️', titulo: 'Eliminar relatório', ok: 'Eliminar', perigo: true }).then(ok => {
        if (!ok) return;
        relatorios = relatorios.filter(x => x !== r);
        lsSet('jw_relatorios', relatorios);
        renderRelatorios();
    });
}

// ================= FOTO DE PERFIL =================
const FOTO_CHAVE = 'jw_foto_perfil';

function iniciaisDoNome(nome) {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    const a = p[0].charAt(0), b = p.length > 1 ? p[p.length - 1].charAt(0) : '';
    return (a + b).toUpperCase();
}

const AVATAR_ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';

// Mostra a foto (ou as iniciais, ou um ícone) num elemento .avatar
function pintarAvatar(el) {
    if (!el) return;
    const foto = rawGet(FOTO_CHAVE);
    el.textContent = '';
    if (foto) {
        const img = document.createElement('img');
        img.src = foto;
        img.alt = 'Foto de perfil';
        el.appendChild(img);
    } else {
        const ini = iniciaisDoNome(lsGet(REL_NOME_CHAVE, ''));
        if (ini) el.textContent = ini; else el.innerHTML = AVATAR_ICONE;
    }
}

function atualizarAvatar() {
    pintarAvatar(byId('perfil-avatar'));
    pintarAvatar(byId('cfg-avatar'));
    pintarAvatar(byId('perfil-dialog-avatar'));
    const rm = byId('cfg-foto-remover');
    if (rm) rm.style.display = rawGet(FOTO_CHAVE) ? '' : 'none';
    const aj = byId('cfg-foto-ajustar');
    if (aj) aj.style.display = rawGet(FOTO_CHAVE) ? '' : 'none';
}

// Reduz a foto (máx. 800 px no lado maior) para guardar o original e poder ajustar depois
function processarFoto(ficheiro) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(ficheiro);
        const img = new Image();
        img.onload = () => {
            try {
                const f = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
                const cv = document.createElement('canvas');
                cv.width = Math.max(1, Math.round(img.naturalWidth * f));
                cv.height = Math.max(1, Math.round(img.naturalHeight * f));
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, cv.width, cv.height);
                ctx.drawImage(img, 0, 0, cv.width, cv.height);
                URL.revokeObjectURL(url);
                resolve(cv.toDataURL('image/jpeg', 0.88));
            } catch (e) { URL.revokeObjectURL(url); reject(e); }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
        img.src = url;
    });
}

// ----- Editor de zoom e enquadramento -----
const FOTO_ORIG = 'jw_foto_orig';
const FOTO_AJUSTE = 'jw_foto_ajuste';

function abrirAjusteFoto(fonte, ajuste) {
    const img = new Image();
    img.onload = () => montarEditorFoto(img, fonte, ajuste);
    img.onerror = () => appAlert('Não foi possível abrir a foto.', { icone: '⚠️' });
    img.src = fonte;
}

function montarEditorFoto(img, fonte, ajusteInicial) {
    if (byId('foto-editor')) return;
    const V = Math.min(260, Math.floor(window.innerWidth - 80));
    const base = V / Math.min(img.naturalWidth, img.naturalHeight);
    const ZMAX = 4;
    let z = 1, ox = 0, oy = 0; // ox, oy: deslocamento do centro da imagem, em px do visor
    if (ajusteInicial && typeof ajusteInicial === 'object') {
        z = Math.min(ZMAX, Math.max(1, Number(ajusteInicial.z) || 1));
        ox = (Number(ajusteInicial.x) || 0) * V;
        oy = (Number(ajusteInicial.y) || 0) * V;
    }

    const fundo = document.createElement('div');
    fundo.className = 'app-dialog-fundo';
    fundo.id = 'foto-editor';
    const caixa = document.createElement('div');
    caixa.className = 'app-dialog foto-editor';
    caixa.innerHTML =
        '<h4>Ajustar foto</h4>' +
        '<p>Arraste para mover e use o zoom para aproximar.</p>' +
        '<div class="foto-visor" style="width:' + V + 'px;height:' + V + 'px"><canvas width="' + V * 2 + '" height="' + V * 2 + '" style="width:' + V + 'px;height:' + V + 'px"></canvas></div>' +
        '<div class="foto-zoom"><button type="button" data-z="-">−</button><input type="range" min="100" max="' + ZMAX * 100 + '" value="100" step="1" aria-label="Zoom"><button type="button" data-z="+">+</button></div>' +
        '<div class="app-dialog-botoes"><button type="button" class="app-dialog-cancelar" data-a="cancel">Cancelar</button><button type="button" class="app-dialog-ok" data-a="ok">Guardar</button></div>' +
        '<button type="button" class="perfil-fechar" data-a="reset" style="margin-top:8px;width:100%">Repor enquadramento</button>';
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);

    const cv = caixa.querySelector('canvas');
    const visor = caixa.querySelector('.foto-visor');
    const slider = caixa.querySelector('input[type=range]');

    function limitar() {
        const s = base * z;
        const maxX = Math.max(0, (img.naturalWidth * s - V) / 2);
        const maxY = Math.max(0, (img.naturalHeight * s - V) / 2);
        ox = Math.min(maxX, Math.max(-maxX, ox));
        oy = Math.min(maxY, Math.max(-maxY, oy));
    }
    function desenhar(ctx, tam) {
        const k = tam / V, s = base * z * k;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, tam, tam);
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        ctx.drawImage(img, tam / 2 + ox * k - w / 2, tam / 2 + oy * k - h / 2, w, h);
    }
    function render() {
        limitar();
        desenhar(cv.getContext('2d'), V * 2);
        slider.value = String(Math.round(z * 100));
    }
    function definirZoom(nz) {
        z = Math.min(ZMAX, Math.max(1, nz));
        render();
    }

    // Arrastar (1 dedo) e pinça (2 dedos)
    const ptr = new Map();
    let dist0 = 0, z0 = 1;
    visor.style.touchAction = 'none';
    visor.addEventListener('pointerdown', e => {
        visor.setPointerCapture && visor.setPointerCapture(e.pointerId);
        ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptr.size === 2) {
            const [a, b] = Array.from(ptr.values());
            dist0 = Math.hypot(a.x - b.x, a.y - b.y); z0 = z;
        }
    });
    visor.addEventListener('pointermove', e => {
        if (!ptr.has(e.pointerId)) return;
        const ant = ptr.get(e.pointerId);
        if (ptr.size === 1) {
            ox += e.clientX - ant.x; oy += e.clientY - ant.y;
            ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
            render();
        } else {
            ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const [a, b] = Array.from(ptr.values());
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (dist0 > 0) definirZoom(z0 * d / dist0);
        }
    });
    const solta = e => { ptr.delete(e.pointerId); dist0 = 0; };
    visor.addEventListener('pointerup', solta);
    visor.addEventListener('pointercancel', solta);
    visor.addEventListener('wheel', e => { e.preventDefault(); definirZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
    slider.addEventListener('input', () => definirZoom(Number(slider.value) / 100));

    const fechar = () => { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); };
    caixa.addEventListener('click', e => {
        const t = e.target;
        const zz = t.getAttribute && t.getAttribute('data-z');
        if (zz) { definirZoom(z + (zz === '+' ? 0.25 : -0.25)); return; }
        const a = t.getAttribute && t.getAttribute('data-a');
        if (a === 'cancel') fechar();
        else if (a === 'reset') { z = 1; ox = 0; oy = 0; render(); }
        else if (a === 'ok') {
            try {
                const out = document.createElement('canvas');
                out.width = out.height = 256;
                limitar();
                desenhar(out.getContext('2d'), 256);
                localStorage.setItem(FOTO_CHAVE, out.toDataURL('image/jpeg', 0.88));
                if (fonte !== rawGet(FOTO_CHAVE)) localStorage.setItem(FOTO_ORIG, fonte);
                localStorage.setItem(FOTO_AJUSTE, JSON.stringify({ z: z, x: ox / V, y: oy / V }));
                fechar();
                atualizarAvatar();
                mostrarAviso('Foto de perfil guardada.');
            } catch (er) {
                appAlert('Não foi possível guardar a foto (armazenamento cheio?).', { icone: '⚠️' });
            }
        }
    });
    fundo.addEventListener('click', e => { if (e.target === fundo) fechar(); });
    render();
}

// Reabre o editor com a foto atual (usa o original guardado, se existir)
function ajustarFotoPerfil() {
    const atual = rawGet(FOTO_CHAVE);
    if (!atual) { escolherFotoPerfil(); return; }
    const orig = rawGet(FOTO_ORIG);
    let aj = null;
    try { aj = JSON.parse(rawGet(FOTO_AJUSTE) || 'null'); } catch (e) { aj = null; }
    abrirAjusteFoto(orig || atual, orig ? aj : null);
}

function escolherFotoPerfil() {
    let inp = byId('foto-input');
    if (!inp) {
        inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.id = 'foto-input';
        inp.style.display = 'none';
        inp.addEventListener('change', async () => {
            const f = inp.files && inp.files[0];
            inp.value = '';
            if (!f) return;
            try {
                const dados = await processarFoto(f);
                abrirAjusteFoto(dados, null);
            } catch (e) {
                appAlert('Não foi possível usar essa imagem. Escolha outra foto.', { icone: '⚠️' });
            }
        });
        document.body.appendChild(inp);
    }
    inp.click();
}

async function removerFotoPerfil() {
    if (!rawGet(FOTO_CHAVE)) return;
    const ok = await appConfirm('Deseja remover a foto de perfil?', { icone: '🗑️', titulo: 'Remover foto', ok: 'Remover', perigo: true });
    if (!ok) return;
    try { localStorage.removeItem(FOTO_CHAVE); localStorage.removeItem(FOTO_ORIG); localStorage.removeItem(FOTO_AJUSTE); } catch (e) { /* ignora */ }
    atualizarAvatar();
    const d = byId('perfil-dialog'); if (d) { fecharPerfil(); }
}

function fecharPerfil() {
    const d = byId('perfil-dialog');
    if (d && d.parentNode) d.parentNode.removeChild(d);
}

// Toque na foto do cabeçalho
function abrirPerfil() {
    if (byId('perfil-dialog')) return;
    const nome = lsGet(REL_NOME_CHAVE, '') || '';
    const fundo = document.createElement('div');
    fundo.className = 'app-dialog-fundo';
    fundo.id = 'perfil-dialog';
    const caixa = document.createElement('div');
    caixa.className = 'app-dialog perfil-dialog';
    caixa.innerHTML =
        '<span id="perfil-dialog-avatar" class="avatar enorme"></span>' +
        '<h4>' + esc(nome || 'O seu perfil') + '</h4>' +
        '<p class="perfil-sub">' + (nome ? 'Publicador' : 'Indique o seu nome em Configuração') + '</p>' +
        '<div class="perfil-botoes">' +
        '<button type="button" class="app-dialog-ok" data-a="foto">📷 ' + (rawGet(FOTO_CHAVE) ? 'Alterar foto' : 'Escolher foto') + '</button>' +
        (rawGet(FOTO_CHAVE) ? '<button type="button" class="app-dialog-cancelar" data-a="aj">🔍 Ajustar zoom</button>' : '') +
        (rawGet(FOTO_CHAVE) ? '<button type="button" class="app-dialog-cancelar" data-a="rm">🗑️ Remover foto</button>' : '') +
        '<button type="button" class="app-dialog-cancelar" data-a="cfg">⚙️ Configuração</button>' +
        '<button type="button" class="perfil-fechar" data-a="x">Fechar</button>' +
        '</div>';
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    pintarAvatar(byId('perfil-dialog-avatar'));
    fundo.addEventListener('click', e => {
        const a = e.target && e.target.getAttribute ? e.target.getAttribute('data-a') : null;
        if (e.target === fundo || a === 'x') { fecharPerfil(); return; }
        if (a === 'foto') { fecharPerfil(); escolherFotoPerfil(); }
        else if (a === 'aj') { fecharPerfil(); ajustarFotoPerfil(); }
        else if (a === 'rm') { removerFotoPerfil(); }
        else if (a === 'cfg') { fecharPerfil(); openSection('configuracao'); }
    });
}

// ================= CONFIGURAÇÃO =================
function saveConfiguracao() {
    lsSet(REL_NOME_CHAVE, byId('cfg-nome').value.trim());
    atualizarAvatar();
    alert('Nome guardado com sucesso!');
}

function guardarConfig() {
    lsSet(CFG_CHAVE, config);
}

// Mostra a configuração atual nos controlos
function cfgCarregarUI() {
    const ci = config.inicio;
    byId('cfg-nome').value = lsGet(REL_NOME_CHAVE, '') || '';
    atualizarAvatar();

    const des = progDesignacao();
    byId('cfg-designacao').textContent = 'Designação: ' + (des ? REL_DESIG[des] : 'Publicador');
    byId('cfg-meta').textContent = 'Meta mensal: ' + (des ? METAS_HORAS[des] + ' horas' : 'sem meta de horas');

    byId('cfg-i-reuniao').checked = ci.reuniao;
    byId('cfg-i-visitasc').checked = ci.visitaSC;
    byId('cfg-i-revisitas').checked = ci.revisitas;
    byId('cfg-i-agenda').checked = ci.agenda;
    byId('cfg-i-agendamax').value = String(ci.agendaMax);
    byId('cfg-i-aviso').checked = ci.avisoRelatorio;
    byId('cfg-i-copia').checked = ci.lembreteCopia;
    cfgAtualizarCopia();
    cfgAtualizarProtecao(false);
    byId('cfg-texto').value = config.aparencia.texto;
    byId('cfg-tema').value = config.aparencia.tema;
    byId('cfg-telacheia').checked = config.aparencia.telaCheia;
    byId('cfg-versao').textContent = APP_VERSAO;
}

// Qualquer controlo alterado: lê tudo, guarda e aplica
function cfgMudou() {
    config = normalizeConfig({
        inicio: {
            reuniao: byId('cfg-i-reuniao').checked,
            visitaSC: byId('cfg-i-visitasc').checked,
            revisitas: byId('cfg-i-revisitas').checked,
            agenda: byId('cfg-i-agenda').checked,
            agendaMax: Number(byId('cfg-i-agendamax').value),
            avisoRelatorio: byId('cfg-i-aviso').checked,
            lembreteCopia: byId('cfg-i-copia').checked
        },
        aparencia: {
            texto: byId('cfg-texto').value,
            tema: byId('cfg-tema').value,
            telaCheia: byId('cfg-telacheia').checked
        }
    });
    guardarConfig();
    aplicarAparencia();
    aplicarTelaCheia();
    loadDynamicAgenda();
}

function aplicarAparencia() {
    if (typeof document === 'undefined' || !document.body) return;
    const a = config.aparencia;
    let escuro = a.tema === 'escuro';
    if (a.tema === 'auto') {
        try { escuro = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); } catch (e) { escuro = false; }
    }
    document.body.classList.toggle('tema-escuro', escuro);
    document.body.style.setProperty('--zoom', String(TEXTO_ZOOM[a.texto] || 1));
}

// ---------- Tela cheia ----------
// Se o app foi instalado com display "fullscreen" no manifest, já abre em tela cheia
// e NÃO se chama a API (era ela que fazia o Chrome mostrar o aviso sempre).
function jaEmTelaCheia() {
    try {
        if (document.fullscreenElement) return true;
        if (window.matchMedia) {
            return window.matchMedia('(display-mode: fullscreen)').matches ||
                   window.matchMedia('(display-mode: standalone)').matches;
        }
    } catch (e) { /* ignora */ }
    return false;
}

function aplicarTelaCheia() {
    if (typeof document === 'undefined') return;
    try {
        const el = document.documentElement;
        if (config.aparencia.telaCheia) {
            if (!jaEmTelaCheia() && el.requestFullscreen) {
                const p = el.requestFullscreen({ navigationUI: 'hide' });
                if (p && p.catch) p.catch(() => {});
            }
        } else if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    } catch (e) { /* ignora */ }
}

// Ao abrir no navegador: tenta uma única vez, no primeiro toque
function prepararTelaCheiaAoAbrir() {
    if (typeof document === 'undefined' || !document.addEventListener) return;
    const tentar = () => {
        document.removeEventListener('click', tentar);
        document.removeEventListener('touchend', tentar);
        if (config.aparencia.telaCheia) aplicarTelaCheia();
    };
    if (jaEmTelaCheia()) return;
    document.addEventListener('click', tentar);
    document.addEventListener('touchend', tentar);
}

// ---------- Verificar instalação (PWA) ----------
async function verificarInstalacao() {
    const linhas = [];
    const ok = (t) => linhas.push('✅ ' + t), mau = (t) => linhas.push('❌ ' + t);
    try {
        (location.protocol === 'https:' || location.hostname === 'localhost') ? ok('Ligação segura (HTTPS)') : mau('Não está em HTTPS');
        try {
            const reg = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
            reg && (reg.active || reg.waiting || reg.installing) ? ok('Service worker registado') : mau('Service worker não registado (falta o sw.js no servidor?)');
        } catch (e) { mau('Service worker indisponível'); }
        try {
            const necessarios = ['./index.html', './manifest.json', './192.png', './512.png'];
            const em = [];
            for (const u of necessarios) { if (!(await caches.match(u))) em.push(u.slice(2)); }
            const principal = await caches.match('./index.html');
            if (em.length) mau('Cópia offline incompleta, faltam: ' + em.join(', ') + '. Abra o app com internet e volte a verificar');
            else if (principal && principal.redirected) mau('Cópia offline inválida (redirecionada). Atualize o app com internet');
            else ok('Cópia offline guardada (abre sem internet)');
        } catch (e) { mau('Não foi possível verificar a cópia offline'); }
        let man = null;
        const link = document.querySelector('link[rel="manifest"]');
        if (!link) mau('Falta a ligação ao manifest no index.html');
        else {
            try {
                const r = await fetch(link.href, { cache: 'no-store' });
                const txt = await r.text();
                try { man = JSON.parse(txt); ok('manifest.json encontrado e válido'); }
                catch (e) { mau('manifest.json não existe ou não é JSON (o servidor devolveu a página do app). Envie o ficheiro manifest.json'); }
            } catch (e) { mau('Não foi possível ler o manifest.json'); }
        }
        if (man) {
            (man.name || man.short_name) ? ok('Nome: ' + (man.name || man.short_name)) : mau('Manifest sem nome');
            man.start_url ? ok('start_url: ' + man.start_url) : mau('Manifest sem start_url');
            ['fullscreen', 'standalone', 'minimal-ui'].includes(man.display) ? ok('display: ' + man.display) : mau('display inválido: ' + man.display);
            const icones = Array.isArray(man.icons) ? man.icons : [];
            for (const tam of ['192x192', '512x512']) {
                const ic = icones.find(i => String(i.sizes || '').split(' ').includes(tam));
                if (!ic) { mau('Falta o ícone ' + tam + ' no manifest'); continue; }
                try {
                    const r = await fetch(new URL(ic.src, link.href), { cache: 'no-store' });
                    const tipo = r.headers.get('content-type') || '';
                    r.ok && /image\/png/.test(tipo) ? ok('Ícone ' + tam + ' (' + ic.src + ') encontrado') : mau('Ícone ' + tam + ' (' + ic.src + ') não existe no servidor');
                } catch (e) { mau('Ícone ' + tam + ' não carregou'); }
            }
        }
        const inst = window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches);
        linhas.push(inst ? 'ℹ️ Está a usar o app instalado' : 'ℹ️ Está a usar no navegador (não instalado)');
    } catch (e) { mau('Erro na verificação: ' + e.message); }
    const falhou = linhas.some(l => l.startsWith('❌'));
    appAlert(linhas.join('\n') + '\n\n' + (falhou ? 'Corrija os itens ❌ e publique de novo todos os ficheiros.' : 'Tudo certo. No Chrome (⋮) deve aparecer "Instalar app".'), { icone: falhou ? '⚠️' : '✅', titulo: 'Instalação do app' });
}

// ---------- Cópia de segurança ----------
const BACKUP_PADRAO = /^(jw_|m_|f_)/;

function backupChaves() {
    const ks = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && BACKUP_PADRAO.test(k)) ks.push(k);
        }
    } catch (e) { /* ignorar */ }
    return ks;
}

function backupObjeto() {
    const dados = {};
    backupChaves().forEach(k => { dados[k] = rawGet(k); });
    return { app: 'jw-programa', versao: APP_VERSAO, exportadoEm: new Date().toISOString(), dados: dados };
}

const COPIA_CHAVE = 'jw_ultima_copia';
let copiaAnterior = '';

// Se a cópia não chegou a ser feita (cancelou ou falhou), volta a data da cópia anterior
function copiaDesfazerData() {
    try {
        if (copiaAnterior) localStorage.setItem(COPIA_CHAVE, copiaAnterior);
        else localStorage.removeItem(COPIA_CHAVE);
    } catch (e) { /* ignorar */ }
    cfgAtualizarCopia();
}

function nomeCopia(ext) {
    const hoje = new Date();
    return 'jw-programa-copia-' + hoje.getFullYear() + '-' + pad2(hoje.getMonth() + 1) + '-' + pad2(hoje.getDate()) + '.' + ext;
}

// Conteúdo da cópia (já com a data desta cópia registada)
function copiaTexto() {
    copiaAnterior = rawGet(COPIA_CHAVE);
    rawSet(COPIA_CHAVE, new Date().toISOString());
    const obj = backupObjeto();
    return { texto: JSON.stringify(obj, null, 2), registos: Object.keys(obj.dados).length };
}

function cfgAtualizarCopia() {
    const el = byId('cfg-ultima-copia');
    if (!el) return;
    const d = new Date(rawGet(COPIA_CHAVE));
    el.textContent = isNaN(d.getTime())
        ? 'Última cópia: ainda não fez nenhuma'
        : 'Última cópia: ' + pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}

// Guardar ficheiro .json nas Transferências
function exportarDados() {
    const c = copiaTexto();
    const nome = nomeCopia('json');
    try {
        const blob = new Blob([c.texto], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        cfgAtualizarCopia();
        alert('Ficheiro criado: ' + nome + '\n(' + c.registos + ' registos). Procure-o nas Transferências do telemóvel e guarde-o também fora do telemóvel.');
    } catch (e) {
        copiaDesfazerData();
        alert('Não foi possível criar a cópia neste navegador.');
    }
}

// Abre o menu de partilha do telemóvel (Drive, WhatsApp, email…)
async function partilharCopia() {
    const c = copiaTexto();
    // .txt: o Android só aceita partilhar alguns tipos de ficheiro; o conteúdo continua a ser a cópia
    const ficheiro = (typeof File === 'function') ? new File([c.texto], nomeCopia('txt'), { type: 'text/plain' }) : null;
    try {
        if (ficheiro && navigator.canShare && navigator.canShare({ files: [ficheiro] })) {
            await navigator.share({ files: [ficheiro], title: 'Cópia de segurança JW Programa' });
            cfgAtualizarCopia();
            return;
        }
    } catch (e) {
        if (e && e.name === 'AbortError') {
            // cancelou: a cópia não conta como feita
            copiaDesfazerData();
            return;
        }
    }
    // Sem menu de partilha neste navegador: guarda o ficheiro
    alert('Este navegador não permite partilhar ficheiros. A cópia vai ser guardada no telemóvel; depois envie-a para o Drive ou WhatsApp.');
    exportarDados();
}

// ---------- Proteção do armazenamento (persistente) ----------
async function estadoProtecao(pedir) {
    try {
        if (!navigator.storage || !navigator.storage.persist) return 'indisponivel';
        let p = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        if (!p && pedir) p = await navigator.storage.persist();
        return p ? 'sim' : 'nao';
    } catch (e) {
        return 'indisponivel';
    }
}

function appInstalada() {
    try { return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; }
}

async function cfgAtualizarProtecao(pedir) {
    const el = byId('cfg-protegido');
    if (!el) return 'indisponivel';
    const est = await estadoProtecao(pedir);
    el.textContent = 'Armazenamento protegido: ' + (est === 'sim' ? 'sim ✅' : est === 'nao' ? 'não' : 'indisponível neste navegador');
    byId('cfg-instalada').textContent = 'App instalada no ecrã inicial: ' + (appInstalada() ? 'sim ✅' : 'não');
    byId('cfg-pedir-protecao').style.display = est === 'nao' ? 'block' : 'none';
    return est;
}

async function pedirProtecao() {
    const est = await cfgAtualizarProtecao(true);
    if (est === 'sim') alert('Armazenamento protegido!');
    else alert('O Chrome não aceitou agora. Instale a app no ecrã inicial (menu ⋮ do Chrome → Instalar app) e use-a com frequência; depois tente de novo.');
}

// Valida o conteúdo de uma cópia; devolve o objeto "dados" ou null
function backupValidar(obj) {
    if (!obj || typeof obj !== 'object' || obj.app !== 'jw-programa') return null;
    const d = obj.dados;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const ks = Object.keys(d);
    if (ks.length === 0) return null;
    if (!ks.every(k => BACKUP_PADRAO.test(k) && typeof d[k] === 'string')) return null;
    return d;
}

function restaurarDados(dados) {
    backupChaves().forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignorar */ } });
    Object.keys(dados).forEach(k => rawSet(k, dados[k]));
}

function importarDados(input) {
    const ficheiro = input && input.files && input.files[0];
    if (!ficheiro) return;
    const leitor = new FileReader();
    leitor.onload = () => {
        let dados = null;
        try { dados = backupValidar(JSON.parse(String(leitor.result))); } catch (e) { dados = null; }
        input.value = '';
        if (!dados) {
            alert('Ficheiro inválido. Escolha uma cópia criada por esta aplicação.');
            return;
        }
        appConfirm('Restaurar esta cópia? Os dados atuais serão substituídos.', { icone: '♻️', titulo: 'Restaurar cópia', ok: 'Restaurar' }).then(ok => {
            if (!ok) return;
            restaurarDados(dados);
            appAlert('Dados restaurados com sucesso!', { icone: '✅' }).then(() => location.reload());
        });
    };
    leitor.onerror = () => alert('Não foi possível ler o ficheiro.');
    leitor.readAsText(ficheiro);
}

async function apagarTudo() {
    if (!await appConfirm('Apagar TODOS os dados da aplicação (programas, estudantes, relatórios, agenda…)?\nEsta ação não pode ser desfeita. Faça primeiro uma cópia de segurança.', { icone: '⚠️', titulo: 'Apagar tudo', ok: 'Continuar', perigo: true })) return;
    if (!await appConfirm('Tem a certeza? Tudo será apagado.', { icone: '⚠️', titulo: 'Apagar tudo', ok: 'Apagar tudo', perigo: true })) return;
    backupChaves().forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignorar */ } });
    await appAlert('Todos os dados foram apagados.', { icone: '✅' });
    location.reload();
}

// ---------- Atualizar app (não apaga dados) ----------
async function atualizarApp() {
    if (!await appConfirm('Atualizar a aplicação? Os seus dados não são apagados.', { icone: '🔄', titulo: 'Atualizar app', ok: 'Atualizar' })) return;
    try {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        }
        if (window.caches && caches.keys) {
            const ks = await caches.keys();
            await Promise.all(ks.map(k => caches.delete(k)));
        }
    } catch (e) { /* ignorar */ }
    location.reload();
}

// ================= LEMBRETES (AGENDA) =================
// Cada item: { texto, mostrar } — "mostrar" decide se aparece no resumo do ecrã Início
function normalizeLembrete(x) {
    if (typeof x === 'string') return { texto: x.trim(), mostrar: true };
    x = (x && typeof x === 'object') ? x : {};
    return { texto: String(x.texto || '').trim(), mostrar: x.mostrar !== false };
}

function renderLembretes() {
    const lista = byId('lista-lembretes');
    if (!lista) return;

    if (lembretes.length === 0) {
        lista.innerHTML = '<li style="padding: 8px 0; color: #64748b; list-style: none;">Nada na agenda.</li>';
        return;
    }

    lista.innerHTML = lembretes.map((l, index) =>
        '<li class="agenda-item">' +
            '<div class="agenda-linha"><span>• ' + esc(l.texto) + '</span>' +
            '<button type="button" class="btn-danger" style="width: auto; padding: 6px 10px; font-size: 0.8rem;" onclick="deleteLembrete(' + index + ')">Apagar</button></div>' +
            '<label class="agenda-mostrar"><input type="checkbox" onchange="toggleLembreteMostrar(' + index + ', this.checked)"' +
                (l.mostrar ? ' checked' : '') + '> Mostrar agenda</label>' +
        '</li>'
    ).join('');
}

function addLembrete() {
    const input = byId('novo-lembrete');
    if (!input) return;
    const texto = input.value.trim();
    if (texto === '') return;
    const caixa = byId('novo-lembrete-mostrar');
    lembretes.push({ texto: texto, mostrar: caixa ? !!caixa.checked : true });
    lsSet('jw_lembretes', lembretes);
    input.value = '';
    renderLembretes();
    loadDynamicAgenda();
}

function toggleLembreteMostrar(index, marcado) {
    if (!lembretes[index]) return;
    lembretes[index].mostrar = !!marcado;
    lsSet('jw_lembretes', lembretes);
    loadDynamicAgenda();
}

function deleteLembrete(index) {
    lembretes.splice(index, 1);
    lsSet('jw_lembretes', lembretes);
    renderLembretes();
    loadDynamicAgenda();
}

// ================= CALENDÁRIO =================
function initCalendar() {
    const dateText = byId('current-date-text');
    if (!dateText) return;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dataFormatada = new Date().toLocaleDateString('pt-PT', options);
    dateText.textContent = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
}

// ================= INICIALIZAÇÃO =================
config = normalizeConfig(lsGet(CFG_CHAVE, {}));
aplicarAparencia();
prepararTelaCheiaAoAbrir();
migrarReunioesAntigas();
reunIniciarGestos();
estadoProtecao(true);
atualizarAvatar();
lembretes = (Array.isArray(lembretes) ? lembretes : []).map(normalizeLembrete).filter(l => l.texto);
relatorios = (Array.isArray(relatorios) ? relatorios : []).map(normalizeRelatorio);
{
    const guardadas = lsGet(ATIV_CHAVE, []);
    atividades = (Array.isArray(guardadas) ? guardadas : []).map(normalizeAtividade).filter(a => a.data);
}
if (typeof setInterval === 'function') setInterval(renderCron, 1000);

const addLembreteBtn = byId('add-lembrete');
if (addLembreteBtn) addLembreteBtn.addEventListener('click', addLembrete);

const novoLembreteInput = byId('novo-lembrete');
if (novoLembreteInput) {
    novoLembreteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addLembrete();
        }
    });
}

initCalendar();
loadMeetingPreviews();
renderRevisitas();
renderLembretes();
renderRelatorios();
loadDynamicAgenda();
loadPregacaoData();
updateBackBtnVisibility();

// Service Worker (PWA offline)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker registado com sucesso.'))
            .catch(err => console.log('Erro ao registar Service Worker:', err));
    });
}
