# ConectaSaúde

Aplicação web educativa sobre saúde sexual e ISTs. Permite cadastro de alunos e professores, jogo de perguntas, envio e moderação de questões, além de administração de contas, solicitações de privacidade e auditoria de acessos.

O servidor usa Node.js e Express; os dados sao armazenados no PostgreSQL.

## Pré-requisitos

Antes de começar, instale:

- [Node.js](https://nodejs.org/) 20.18 ou superior;
- PostgreSQL, com o serviço em execução;
- Um terminal, como PowerShell ou o terminal do VS Code.

## 1. Abra a pasta do projeto

No PowerShell, entre na pasta do projeto:

```powershell
cd C:\caminho\para\conectasaude
```

## 2. Crie e prepare o banco de dados

Crie um banco chamado `conectasaude` no PostgreSQL:

```sql
CREATE DATABASE conectasaude;
```

Depois, conecte-se ao banco e execute o arquivo [`db/arquivo.sql`](db/arquivo.sql):

```powershell
psql -U postgres -d conectasaude -f db/arquivo.sql
```

Troque `postgres` pelo usuário do seu PostgreSQL, caso necessário. O comando pode solicitar sua senha.

## 3. Configure as variáveis de ambiente

Crie um arquivo chamado `.env` na raiz do projeto e preencha-o com os valores da sua instalação:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/conectasaude
ADMIN_EMAIL=admin@conectasaude.com
ADMIN_SENHA=uma-senha-forte
PORT=3000
MFA_ENCRYPTION_KEY=chave_base64_de_32_bytes
```


- `DATABASE_URL`: conexão com o PostgreSQL. Altere usuário, senha, servidor ou porta quando necessário.
- `ADMIN_EMAIL` e `ADMIN_SENHA`: credenciais da conta de administrador criada na primeira inicialização.
- `PORT`: porta em que o site será aberto. O valor padrão é `3000`.
- `MFA_ENCRYPTION_KEY`: chave usada para proteger os segredos do aplicativo autenticador armazenados no banco. Ela deve ter 32 bytes codificados em Base64.

O arquivo `.env` não deve ser enviado ao repositório, pois contém dados sensíveis.

### Ativar a confirmação em duas etapas

O projeto usa o padrão TOTP, compatível com Google Authenticator, Microsoft Authenticator e Authy. Não precisa criar conta nem usar API externa.

Antes de iniciar o servidor, gere uma chave local e adicione-a ao `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copie o resultado para `MFA_ENCRYPTION_KEY`. Guarde essa chave em segurança: se ela for perdida, os códigos já configurados não poderão ser validados e será necessário configurar o autenticador novamente.

## 4. Instale as dependências

```powershell
npm install
```

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
- Na tela inicial, cadastre usuários como aluno ou professor.
- Depois do login, alunos e professores acessam `/home`; administradores acessam `/admin`.

## Funcionalidades

- Cadastro, login com confirmação por aplicativo autenticador, alteração de senha e encerramento de conta.
- Perfis de aluno, professor e administrador.
- Jogo com perguntas por nível de dificuldade.
- Envio de perguntas por professores e aprovação ou recusa por administradores.
- Solicitações de privacidade e registro de auditoria para administradores.
