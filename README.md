# ConectaSaúde

Aplicação web educativa sobre saúde sexual e ISTs. Permite cadastro de alunos, aprovação de professores pelo administrador, jogo de perguntas, envio e moderação de questões, além de administração de contas, solicitações de privacidade e auditoria de acessos.

O servidor usa Node.js e Express. Os dados são armazenados no PostgreSQL.

## Pré-requisitos

Antes de começar, você precisará de:

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
- Para trocar o e-mail de um administrador existente, defina o novo endereço em `ADMIN_EMAIL` e o antigo em `ADMIN_EMAIL_ANTERIOR`. Ao iniciar, o sistema atualiza a mesma conta, preservando senha e autenticação em duas etapas. Depois da atualização, `ADMIN_EMAIL_ANTERIOR` pode ser removido. Se o novo endereço já pertencer a outra conta ativa, a alteração será recusada.
- Para criar um segundo administrador na inicialização, configure `ADMIN_EMAIL_ADICIONAL` e `ADMIN_SENHA_ADICIONAL` junto às variáveis da conta principal. Use endereços diferentes. Reinicializações preservam as senhas e a autenticação em duas etapas das contas existentes.
- `PORT`: porta em que o site será aberto. O valor padrão é `3000`.
- `MFA_ENCRYPTION_KEY`: chave usada para proteger os segredos do aplicativo autenticador armazenados no banco. Ela deve ter 32 bytes codificados em Base64.

O arquivo `.env` não deve ser enviado ao repositório, pois contém dados sensíveis.

### Ativar a confirmação em duas etapas

O projeto usa o padrão TOTP, compatível com Google Authenticator, Microsoft Authenticator e Authy. Você não precisa criar uma conta nem usar uma API externa.

Antes de iniciar o servidor, gere uma chave local e adicione-a ao `.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copie o resultado para `MFA_ENCRYPTION_KEY`. Guarde essa chave em segurança: se ela for perdida, os códigos já configurados não poderão ser validados e será necessário configurar o autenticador novamente.

### Melhorias para a apresentação

- No login, escolha **Aplicativo autenticador** ou **Código por e-mail**. O e-mail usa a mesma configuração SMTP da recuperação de senha; o código expira em 10 minutos, aceita até cinco tentativas e pode ser reenviado após um minuto ao voltar à tela de login. A autenticação em duas etapas continua obrigatória.
- O cadastro exige repetir o e-mail e a senha. Os requisitos da senha são indicados durante a digitação, inclusive o limite de 72 bytes do bcrypt.
- Em **Política de Privacidade**, usuários autenticados registram e acompanham seus pedidos, inclusive professores com solicitação pendente ou recusada, ou com acesso revogado. Concluir exige resposta, providência, referência de comprovação e confirmação do administrador. Em pedidos de eliminação, uma confirmação adicional executa a exclusão definitiva da conta e dos dados vinculados no banco ativo, preservando um recibo técnico sem vínculo com o titular. Outros tipos exigem que a equipe realize e comprove a providência antes de concluir. Pedidos finalizados não podem ser sobrescritos.
- Perguntas e auditoria exibem até cinco itens por página, com botões Anterior e Próxima. Os totais de perguntas consideram todas as páginas.
- Todas as telas oferecem acesso aos termos e à política de privacidade, inclusive antes do login.

### Configurar o envio de e-mail

Acrescente ao seu `.env` as configurações do seu serviço de e-mail, usando `.env.example` como referência:

```env
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_USER=seu-email@exemplo.com
SMTP_PASS=senha-do-servico-de-email
SMTP_FROM="ConectaSaúde <seu-email@exemplo.com>"
```

Use a senha de aplicativo quando seu provedor exigir. A porta 465 usa TLS direto; as demais exigem STARTTLS. Não substitua as configurações existentes do banco, do administrador e da autenticação em duas etapas pelas de outro integrante.

O fluxo é **Esqueci minha senha → código recebido por e-mail → nova senha**. O código expira em 10 minutos, tem até cinco tentativas e só pode ser validado uma vez. O reenvio exige um intervalo de um minuto por conta. A troca de senha encerra sessões e desafios de login anteriores, preservando o autenticador já configurado. Perder o autenticador ainda exige atendimento administrativo.

Sem SMTP configurado e funcional, a recuperação por e-mail não entrega códigos.

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
- Na tela de cadastro, selecione **Professor** ou **Aluno** em **Perfil de usuário**. Apenas alunos informam o 1º, 2º ou 3º ano do ensino médio. O ano fica fixo após a escolha. Após criar a conta, a tela volta ao login.
- Quem escolhe **Professor** confirma o login com o código por e-mail ou pelo aplicativo autenticador. Somente depois de validar o segundo fator, o servidor registra a solicitação e direciona para `/aguardando-aprovacao`. Essa sessão permite consultar a aprovação, registrar e acompanhar os próprios pedidos de privacidade e sair. O painel e as demais APIs privadas continuam bloqueados até a aprovação.
- O administrador aprova ou recusa as solicitações em **Gestão de usuários**. A página de espera verifica a aprovação a cada dez segundos e abre o painel automaticamente quando o acesso é liberado. Recusa e revogação mantêm a conta bloqueada até uma nova liberação explícita do administrador. Um novo login não recria solicitações recusadas nem reverte uma revogação.
- Alunos não têm botão nem rota para solicitar o perfil de professor. O perfil escolhido no cadastro não concede permissões administrativas nem de professor: o servidor registra a intenção em `status_professor` e só concede o perfil efetivo após a aprovação.
- Depois do login, alunos e professores acessam `/home`; administradores acessam `/admin`.

## Funcionalidades

### Minhas turmas

No painel do professor, clique em **Gerenciar minhas turmas** para abrir `/minha-turma`. Selecione **Criar turma**, escolha o 1º, 2º ou 3º ano do ensino médio e informe uma letra de A a Z. No campo **Escola**, selecione uma das suas escolas cadastradas ou escolha **Cadastrar nova escola** e informe e confirme o nome. Para escolas existentes, não é necessário redigitar o nome. A descrição é opcional e aceita até mil caracteres. A combinação do ano e da letra identifica a turma, por exemplo, **3A**. O mesmo professor não pode criar duas turmas com a mesma identificação na mesma escola.

A página agrupa as turmas pelo nome da escola e exibe um botão por turma. Clique no botão da turma desejada e selecione **Adicionar alunos cadastrados** para pesquisar por nome ou e-mail. A busca apresenta alunos ativos do mesmo ano escolar, ignora acentos e diferenças entre maiúsculas e minúsculas e mostra até cinco alunos por página. Em **Alunos desta turma**, consulte os alunos selecionados e use **Remover da turma** para desfazer apenas esse vínculo.

Cada turma pertence ao professor que a criou. O vínculo não altera o ano escolar nem exclui o cadastro do aluno, que pode participar de outras turmas e de turmas de outros professores. O painel consolida os alunos das turmas do professor sem contar o mesmo aluno duas vezes; médias, avaliações, relatórios e edição dos responsáveis respeitam esses vínculos. A administração mantém sua visão geral dos alunos.

Em **Ver relatórios**, selecione uma escola para consultar os alunos de todas as suas turmas nela. Depois, selecione o ano do ensino médio para restringir a consulta e, se desejar, a letra da turma para visualizar uma sala específica, como **1A**. Os campos seguintes apresentam somente anos e letras cadastrados para a seleção anterior. Os filtros de período continuam disponíveis. Clique em **Aplicar filtros** para atualizar o resultado, que mostra até cinco alunos por página, a escola e a identificação da turma. O resumo considera todos os alunos filtrados e cada partida é contada uma única vez, mesmo que o aluno esteja em mais de uma turma. Vínculos antigos sem escola definida aparecem somente na consulta geral, até serem organizados em uma turma.

As tabelas `escolas`, `turmas` e `turma_alunos` armazenam as escolas de cada professor, suas turmas e os alunos vinculados. A turma referencia o cadastro da escola por identificador; novas turmas da mesma escola são apresentadas junto às anteriores. A confirmação do nome da escola valida o preenchimento e não comprova vínculo profissional. Os nomes são normalizados para desconsiderar espaços adicionais e diferenças entre maiúsculas e minúsculas na identificação de duplicidades. O SQL de instalação e a atualização automática em `db/inicializar.js` incluem essa estrutura; `db/turmas.sql` e `db/escolas.sql` contêm os ajustes correspondentes. A migração cadastra automaticamente as escolas informadas nas turmas existentes, preservando os vínculos e sem criar cópias de uma mesma escola para o mesmo professor.

Os vínculos antigos de `professor_alunos` são preservados e continuam no painel como alunos ainda sem turma definida. Ao adicionar um desses alunos a uma turma do mesmo professor, o vínculo antigo é substituído pelo vínculo com a turma escolhida. A página informa quantos alunos antigos ainda precisam ser organizados. Nenhuma escola ou turma é criada automaticamente com dados presumidos.

### Proteção de acesso

- APIs privadas exigem token Bearer válido, não expirado e vinculado a uma conta ativa. O perfil é consultado no banco em cada requisição, de modo que a revogação de professor tem efeito imediato.
- Cada aba guarda seu token no `sessionStorage`. As telas internas verificam a sessão e o perfil antes de exibir o conteúdo. O servidor valida o token Bearer e as permissões nas chamadas às APIs.
- O administrador não pode desativar nem encerrar sua própria conta, nem alterar seu próprio perfil. O fluxo de aprovação não permite criar administradores.
- Cadastro, login, confirmação TOTP e recuperação de senha têm limites de tentativas por IP. Esses limites ficam na memória de uma instância; múltiplas instâncias exigem um armazenamento compartilhado.
- Recuperar senha exige confirmar o código enviado por e-mail e escolher uma senha forte. Informar apenas o endereço de e-mail não autoriza a troca. O login continua exigindo a confirmação pelo autenticador.
- Professores que já existiam permanecem com seu perfil. O administrador pode revogar o acesso no painel.
- Reinicie o servidor para aplicar as atualizações do banco automaticamente, incluindo `status_professor`. Professores existentes são preservados, e solicitações antigas pendentes passam pelo bloqueio de aprovação.

### Recursos

- Cadastro, login com confirmação por aplicativo autenticador, alteração de senha e encerramento de conta.
- Perfis de aluno, professor e administrador.
- Campo opcional de nomes dos responsáveis legais: permite cadastrar, editar e remover nomes. O dado é restrito ao professor vinculado e à administração e é excluído com a conta do aluno.
- Jogo com perguntas por nível de dificuldade.
- Avaliação diagnóstica: pré-teste obrigatório antes de jogar e pós-teste liberado depois de pelo menos uma partida, com as mesmas perguntas, para medir a evolução. O professor vê o resultado por aluno e as médias da turma.
- Envio de perguntas por professores e aprovação ou recusa por administradores.
- Salas multiplayer com código de convite, histórico individual de partidas para alunos, relatórios de partidas por turma e filtros de período, edição do banco de perguntas e ativação ou desativação de contas pelo administrador.
- Perguntas classificadas previamente por tema de IST; alunos podem filtrar a partida pelo tema e professores consultam indicadores do banco de questões por categoria e situação de revisão.
- Solicitações de privacidade e registro de auditoria para administradores.

## Salas multiplayer

No painel do aluno, selecione **Com um colega** para criar uma sala ou entrar por código. Para entrar, basta o código recebido: a dificuldade será a da sala. Para criar, selecione a dificuldade e um código numérico de até oito dígitos e compartilhe-o com outro aluno. O tema acompanha a seleção do painel. Ambos precisam ter concluído o pré-teste. As partidas usam perguntas aprovadas da dificuldade e do tema selecionados; se escolher “Todos os temas”, a sala pode sortear perguntas de qualquer categoria.

As salas permanecem na memória de uma única instância do servidor. O WebSocket avisa os jogadores quando a sala muda. Se a conexão cair, a página consulta o estado por HTTP enquanto tenta reconectar. Reiniciar o servidor encerra salas abertas; salas sem atividade expiram após 30 minutos. Os resultados de partidas concluídas ou encerradas por desistência ficam no histórico de cada aluno.

## Estrutura do projeto (MVC)

```text
conectasaude/
├── server.js
├── app.js
├── Config/
├── Routes/
├── Controller/
├── Model/
├── View/
├── Middleware/
├── Service/
├── db/
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
- O pós-teste é liberado após o número de partidas definido em `PARTIDAS_PARA_POS_TESTE` e usa as mesmas perguntas do pré-teste.
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

## Privacidade e encerramento de contas

O [registro de operações de tratamento](docs/privacidade.md) reúne inventário,
finalidades, hipóteses legais a validar, retenção e limites. A política pública
em `/privacidade` está na versão 1.1 de 14/11/2026 e descreve o uso do sessionStorage por aba.

Reiniciar aplica a migração idempotente `db/privacidade.sql`, que acrescenta
providência, comprovação e data de confirmação aos pedidos. Ela não apaga contas
existentes nem transforma pedidos antigos em comprovados. O fechamento futuro
remove conta, credenciais, vínculos, avaliações, partidas, pedidos e logs associados
do banco ativo, em transação. Professores também perdem suas escolas e turmas,
preservando as contas dos alunos. Perguntas educativas permanecem sem autoria;
conteúdo identificável e backups exigem procedimento específico.

A instituição ainda precisa validar suas bases legais e responsabilidades,
procedimentos para menores, descarte de logs e backups. Os relatórios de testes
anteriores continuam históricos; a nova execução dos ajustes está em
`entregas/ajustes-privacidade-2026-11-14/resultados.json`.

## Testes e qualidade do código

Use `npm install` para instalar as dependências de desenvolvimento, depois execute os comandos abaixo.

| Comando | Verificação |
| --- | --- |
| `npm test` | Testes unitários e testes de integração HTTP com Express |
| `npm run test:coverage` | Cobertura de linhas, com mínimo de 50% em cada módulo listado em `jest.config.cjs` |
| `npm run lint` | Análise estática com ESLint no servidor, nos scripts do navegador e nos testes |

Os testes automatizados simulam o acesso ao banco. Os testes HTTP passam pelo servidor do Node.js e pelo Express em memória, sem abrir uma porta de rede. O relatório de cobertura em HTML fica em `coverage/index.html`.

Para testar a API manualmente, inicie o servidor com `npm start` em um ambiente de teste e importe o arquivo [insomnia-conectasaude.json](tests/insomnia-conectasaude.json) no Insomnia. Use contas fictícias e preencha as variáveis no ambiente local da coleção. Para obter um token, execute **Login válido** e **Validar segundo fator**. Os testes autenticados usam um token do perfil correspondente. Compare cada resultado com a descrição e registre o código HTTP recebido e o resultado observado.
