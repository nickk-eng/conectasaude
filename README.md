# conectasaude

ConectaSaúde

Aplicação web para alunos, professores e administradores. O servidor é feito com Node.js/Express e os dados são armazenados no PostgreSQL.

## Pré-requisitos

Antes de começar, instale:

- [Node.js](https://nodejs.org/) (versão 20 ou superior recomendada);
- PostgreSQL, com o serviço em execução;
- Um terminal, como PowerShell ou o terminal do VS Code.

## 1. Abra a pasta do projeto

No PowerShell, entre na pasta onde o projeto foi salvo:

```powershell
cd C:\caminho\para\conectSaude
```

## 2. Crie e prepare o banco de dados

Crie um banco chamado `conectasaude` no PostgreSQL. Você pode fazer isso pelo pgAdmin ou pelo terminal do PostgreSQL:

```sql
CREATE DATABASE conectasaude;
```

Depois, conecte-se ao banco `conectasaude` e execute todo o conteúdo do arquivo [`database/init.sql`](database/init.sql). Pelo terminal, um exemplo é:

```powershell
psql -U postgres -d conectasaude -f database/init.sql
```

> Troque `postgres` pelo nome do seu usuário do PostgreSQL, caso necessário. O comando pode solicitar sua senha.

## 3. Configure as variáveis de ambiente

Há um arquivo de exemplo no projeto. Faça uma cópia dele com o nome `.env`:

```powershell
Copy-Item .env.example .env
```

Abra o arquivo `.env` e ajuste os valores conforme a sua instalação:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/conectasaude
ADMIN_EMAIL=admin@conectasaude.com
ADMIN_SENHA=uma-senha-forte
PORT=3000
```

- `DATABASE_URL`: conexão com o seu PostgreSQL. Altere usuário, senha, servidor ou porta se eles forem diferentes.
- `ADMIN_EMAIL` e `ADMIN_SENHA`: dados da conta de administrador criada automaticamente na primeira inicialização.
- `PORT`: porta em que o site será aberto. Use `3000` ou escolha outra porta disponível.

Não compartilhe nem envie o arquivo `.env` para o repositório, pois ele contém sua senha.

## 4. Instale as dependências

```powershell
npm install
```

Esse comando só precisa ser executado novamente quando as dependências do projeto forem alteradas.

## 5. Inicie o projeto

Para iniciar normalmente:

```powershell
npm start
```

Para desenvolvimento, com reinício automático ao salvar alterações:

```powershell
npm run dev
```

Quando aparecer a mensagem abaixo, abra o endereço no navegador:

```text
ConectaSaúde rodando em http://localhost:3000
```

Acesse [http://localhost:3000](http://localhost:3000).

## Primeiro acesso

- Entre como administrador usando o e-mail e a senha definidos no `.env`.
- Usuários públicos podem se cadastrar como **aluno** ou **professor** na tela inicial.
- O administrador pode acessar `http://localhost:3000/admin` após fazer login.
