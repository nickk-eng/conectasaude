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
- Campo no painel do professor para registrar nomes dos responsáveis legais do aluno; o dado fica visível para professores e administração e é removido no encerramento da conta.
- Jogo com perguntas por nível de dificuldade.
- Avaliação diagnóstica: pré-teste obrigatório antes de jogar e pós-teste liberado depois de pelo menos uma partida, com as mesmas perguntas, para medir a evolução. O professor vê o resultado por aluno e as médias da turma.
- Envio de perguntas por professores e aprovação ou recusa por administradores.
- Salas multiplayer com código de convite, histórico individual de partidas para alunos, relatórios de partidas por turma e filtros de período, edição do banco de perguntas e ativação ou desativação de contas pelo administrador.
- Perguntas classificadas previamente por tema de IST; alunos podem filtrar a partida pelo tema e professores consultam indicadores do banco de questões por categoria e situação de revisão.
- Solicitações de privacidade e registro de auditoria para administradores.

## Salas multiplayer

No painel do aluno, escolha uma dificuldade e um tema e selecione **Com um colega**. Crie uma sala com um código numérico de até oito dígitos e compartilhe-o com outro aluno. Ambos precisam ter concluído o pré-teste. As partidas usam perguntas aprovadas da dificuldade e do tema selecionados; se escolher “Todos os temas”, a sala pode sortear perguntas de qualquer categoria.

As salas permanecem na memória de uma única instância do servidor e atualizam o estado a cada segundo. Reiniciar o servidor encerra salas abertas; salas sem atividade expiram após 30 minutos. Resultados de partidas concluídas ou desistidas ficam no histórico de cada aluno.

## Estrutura do projeto (MVC)

```text
conectasaude/
├── server.js              # só inicializa: prepara o banco e sobe o servidor
├── app.js                 # configura o Express (JSON, arquivos estáticos, rotas, erros)
├── Config/                # banco.js (Pool do PostgreSQL) e constantes.js
├── Routes/                # URL -> controller (+ middlewares de acesso)
├── Controller/            # recebe a requisição, valida, chama o Model e responde
├── Model/                 # TODO o SQL do projeto; um arquivo por tabela/assunto
├── View/                  # html, css e js do navegador
├── Middleware/            # autenticacao.js (login e perfis) e erros.js
├── Service/               # regras que não são de uma tabela: senha, MFA/TOTP, auditoria
├── db/                    # arquivo.sql e inicializar.js (ajustes de esquema + conta admin)
└── img/
```

Fluxo de uma requisição: `Routes` -> `Middleware` (autenticar/permitir) -> `Controller` -> `Model` -> banco, e o Controller devolve o JSON que a `View` consome.

Regras para manter a organização:

- SQL só em `Model/` (e nos ajustes de esquema em `db/inicializar.js`).
- `Controller/` não escreve SQL e não conhece o `Pool`.
- `Routes/` só liga a URL a um controller; não tem lógica.
- Para criar uma funcionalidade nova: Model (dados) -> Controller (regra e resposta) -> Routes (URL).

## Avaliação diagnóstica (pré e pós-teste)

Fluxo do aluno: **pré-teste -> jogar -> pós-teste**.

- O pré-teste sorteia 5 perguntas aprovadas (`TOTAL_PERGUNTAS_AVALIACAO` em `Config/constantes.js`) e é obrigatório: `GET /api/jogo/perguntas` responde 403 (`PRE_TESTE_PENDENTE`) até ele ser concluído.
- O pós-teste libera depois de `PARTIDAS_PARA_POS_TESTE` partida(s) jogada(s) após o pré-teste e usa as mesmas perguntas.
- A correção é feita no servidor e o gabarito só é mostrado depois do pós-teste.
- Cada teste pode ser feito uma única vez por aluno (tabela `avaliacoes`, `UNIQUE (usuario_id, tipo)`); as partidas ficam na tabela `partidas`.

Endpoints (todos exigem login):

| Método e rota | Quem | O que faz |
| --- | --- | --- |
| `GET /api/avaliacao/status` | aluno | Etapa atual (`pre`, `jogar`, `pos` ou `concluida`) e notas |
| `GET /api/avaliacao/:tipo` | aluno | Inicia ou retoma o teste (`pre` ou `pos`), sem gabarito |
| `POST /api/avaliacao/:tipo/respostas` | aluno | Envia as respostas e recebe o resultado |
| `GET /api/professor/avaliacoes` | professor, admin | Resultado por aluno e médias da turma |

Se o banco já existir, as tabelas novas são criadas automaticamente na próxima inicialização do servidor.
