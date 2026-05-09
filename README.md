# Clave de Sol Game — React + Firebase

Jogo digital para alunos identificarem notas na clave de sol.

## Funcionalidades
- Login de aluno corrigido
- Modo Aprender e Modo Teste
- Tempo ajustável por nível
- Seleção de notas: todas, linhas ou espaços
- Ranking online em tempo real com Firestore
- Relatório individual em CSV
- Interface gamificada

## Como instalar
```bash
npm install
npm run dev
```

## Firebase
1. Cria um projeto em https://console.firebase.google.com/
2. Cria uma Web App.
3. Ativa Cloud Firestore.
4. Copia o `firebaseConfig` para `src/firebase.js`.
5. Publica as regras de segurança em `firestore.rules`.

## Publicar na Vercel
1. Sobe o projeto para GitHub.
2. Vai a https://vercel.com/
3. Importa o repositório.
4. Framework: Vite.
5. Deploy.

Depois recebes um link público para enviar aos alunos.
