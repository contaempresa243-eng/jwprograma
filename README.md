# JW Programa

Aplicação web progressiva (PWA), offline, em português, para organizar reuniões por semana,
pregação, visita do superintendente de circuito, revisitas, estudantes, relatório de campo e agenda.

> Projeto independente, criado por um programador particular. **Não foi criado, patrocinado nem
> aprovado pelas Testemunhas de Jeová** e não é um recurso oficial.

## Ficheiros

| Ficheiro | Função |
|---|---|
| `index.html` | Estrutura dos ecrãs |
| `style.css` | Estilos (tema claro e escuro) |
| `app.js` | Toda a lógica da aplicação |
| `sw.js` | Service worker (funcionamento sem internet) |
| `manifest.json` | Dados de instalação da PWA |
| `192.png`, `512.png` | Ícones |

## Publicar no GitHub Pages

1. Repositório → **Settings** → **Pages**.
2. Em *Build and deployment* → *Source*: **Deploy from a branch**.
3. *Branch*: `main` e pasta `/ (root)` → **Save**.
4. Em cerca de 1 minuto o app fica em `https://<utilizador>.github.io/<repositório>/`.

O ficheiro `.nojekyll` impede que o GitHub processe os ficheiros com Jekyll.

## Dados

Tudo fica guardado no telemóvel (localStorage). Não há servidor nem base de dados.
Faça cópias de segurança em Configuração → Cópia de segurança.

## Segurança

Não coloque palavras-passe, chaves (`.keystore`, `.jks`) nem dados pessoais neste repositório.
