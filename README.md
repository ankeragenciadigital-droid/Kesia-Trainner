# KT Kesia Trainner — Guia de Configuração

## 1. Criar projeto no Supabase
- Acesse app.supabase.com → New project

## 2. Criar tabelas e segurança
- SQL Editor → New query → cole o conteúdo de `supabase/schema.sql` → Run

## 3. Configurar variáveis
Crie `.env` na raiz:
```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```
(Project Settings → API no Supabase)

## 4. Rodar
```
npm install
npm run dev
```

## 5. Deploy (Vercel)
```
vercel --prod
```
Adicione as variáveis de ambiente no painel da Vercel.

---

## Fluxo de uso

**Treinadora:** Criar conta → Sou treinadora → copiar código → enviar para os alunos

**Aluno:** Criar conta → Sou aluno(a) → colar código da treinadora → login

## Cálculo de Sobras
A treinadora define meta de peso e % gordura para cada aluno.
O app mostra: quanto falta (sobra) e barra de progresso desde a primeira medição.

## Segurança
- Supabase Auth com JWT
- Row Level Security em TODAS as tabelas (ninguém acessa dados de outra pessoa)
- Storage privado — vídeos servidos via URL assinada (expira em 1h)
- Só a `anon key` pública no front-end — sem segredos expostos
