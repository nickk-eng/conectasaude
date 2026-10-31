const { randomUUID } = require('node:crypto');
const { NIVEIS, CATEGORIAS_IST } = require('../Config/constantes');

function criarServicoSalas({ perguntasModel, salvarResultados, agora = Date.now }) {
  const salas = new Map();
  const niveis = NIVEIS;
  const linhas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function falhar(mensagem, status = 400) {
    throw Object.assign(new Error(mensagem), { status });
  }
  function limpar() {
    for (const [codigo, sala] of salas) {
      if (agora() - sala.atualizada > 30 * 60 * 1000) salas.delete(codigo);
    }
  }
  function jogador(usuario, simbolo) {
    return { id: usuario.id, nome: usuario.nome || 'Aluno', simbolo, acertos: 0, erros: 0 };
  }
  function buscar(codigo, usuario, partida) {
    limpar();
    const sala = salas.get(String(codigo || '').trim().toUpperCase());
    if (!sala) falhar('Sala não encontrada ou expirada.', 404);
    if (partida && partida !== sala.id) falhar('Esta sala foi encerrada. O código agora pertence a outra partida.', 404);
    if (!sala.jogadores.some((p) => p.id === usuario.id)) falhar('Você não participa desta sala.', 403);
    sala.atualizada = agora();
    return sala;
  }
  function prazo(sala) {
    sala.prazo = agora() + (sala.fase === 'jogada' ? 30 : { 'Fácil': 20, 'Médio': 15, 'Difícil': 10 }[sala.nivel]) * 1000;
  }
  function passar(sala, mensagem) {
    sala.vez = sala.vez === 0 ? 1 : 0;
    sala.indice++;
    sala.fase = 'pergunta';
    sala.mensagem = mensagem;
    sala.versao++;
    prazo(sala);
  }
  function expirarTurno(sala) {
    if (sala.status !== 'jogando' || agora() < sala.prazo) return;
    if (sala.fase === 'pergunta') sala.jogadores[sala.vez].erros++;
    passar(sala, 'O tempo acabou. A vez passou.');
  }
  async function persistir(sala) {
    if (sala.status !== 'finalizada' || sala.salva) return;
    if (!sala.gravando) {
      sala.gravando = salvarResultados(sala).then(() => { sala.salva = true; }).finally(() => { sala.gravando = null; });
    }
    await sala.gravando;
  }
  function publico(sala, usuario) {
    const pergunta = sala.perguntas[sala.indice % sala.perguntas.length];
    return {
      id: sala.id, codigo: sala.codigo, nivel: sala.nivel, categoriaIst: sala.categoriaIst, status: sala.status, fase: sala.fase,
      jogadores: sala.jogadores.map(({ nome, simbolo, acertos, erros }) => ({ nome, simbolo, acertos, erros })),
      seuSimbolo: sala.jogadores.find((p) => p.id === usuario.id).simbolo,
      criador: sala.jogadores[0].id === usuario.id,
      suaVez: sala.status === 'jogando' && sala.jogadores[sala.vez].id === usuario.id,
      vez: sala.jogadores[sala.vez].simbolo,
      tabuleiro: [...sala.tabuleiro], versao: sala.versao,
      segundos: Math.max(0, Math.ceil((sala.prazo - agora()) / 1000)),
      mensagem: sala.mensagem, resultado: sala.resultado || '', salva: sala.salva,
      pergunta: sala.status === 'jogando' && sala.fase === 'pergunta' && sala.jogadores[sala.vez].id === usuario.id
        ? { texto: pergunta.texto, alternativas: pergunta.alternativas } : null
    };
  }
  return {
    async criar(usuario, nivel, codigoEscolhido, categoriaIst) {
      limpar();
      const codigo = String(codigoEscolhido || '').trim();
      if (!/^[0-9]{1,8}$/.test(codigo)) falhar('Escolha um código com 1 a 8 números.');
      if (salas.has(codigo) && !(salas.get(codigo).status === 'finalizada' && salas.get(codigo).salva)) falhar('Este código já está em uso. Escolha outro.', 409);
      if (!niveis.includes(nivel)) falhar('Escolha uma dificuldade válida.');
      if (categoriaIst && !CATEGORIAS_IST.some((categoria) => categoria.valor === categoriaIst)) falhar('Escolha uma categoria de IST válida.');
      if (salas.size >= 1000) falhar('Há muitas salas abertas. Tente novamente mais tarde.', 503);
      if ([...salas.values()].some((s) => s.status !== 'finalizada' && s.jogadores.some((p) => p.id === usuario.id))) {
        falhar('Você já tem uma sala aberta. Volte à sala ou saia dela antes de criar outra.', 409);
      }
      const perguntas = await perguntasModel.sortearAprovadas(nivel, categoriaIst || null);
      if (!perguntas.length) falhar('Ainda não há perguntas aprovadas nesta dificuldade.');
      // Revalida após a consulta assíncrona para evitar duas criações simultâneas com o mesmo código/aluno.
      if (salas.size >= 1000) falhar('Há muitas salas abertas. Tente novamente mais tarde.', 503);
      if ([...salas.values()].some((s) => s.status !== 'finalizada' && s.jogadores.some((p) => p.id === usuario.id))) {
        falhar('Você já tem uma sala aberta. Volte à sala ou saia dela antes de criar outra.', 409);
      }
      if (salas.has(codigo) && !(salas.get(codigo).status === 'finalizada' && salas.get(codigo).salva)) falhar('Este código já está em uso. Escolha outro.', 409);
      const sala = {
        id: randomUUID(), codigo, nivel, categoriaIst, jogadores: [jogador(usuario, 'X')], perguntas: perguntas.map((p) => ({ ...p,
          alternativas: typeof p.alternativas === 'string' ? JSON.parse(p.alternativas) : p.alternativas })),
        status: 'aguardando', fase: 'pergunta', vez: 0, indice: 0, tabuleiro: Array(9).fill(''),
        versao: 0, prazo: 0, atualizada: agora(), mensagem: 'Compartilhe o código com outro aluno.', salva: false
      };
      salas.set(codigo, sala);
      return publico(sala, usuario);
    },
    entrar(usuario, codigo) {
      limpar();
      const sala = salas.get(String(codigo || '').trim().toUpperCase());
      if (!sala) falhar('Sala não encontrada ou expirada.', 404);
      if (sala.jogadores.some((p) => p.id === usuario.id)) return publico(sala, usuario);
      if (sala.status !== 'aguardando' || sala.jogadores.length === 2) falhar('Esta sala não está disponível.', 409);
      if ([...salas.values()].some((s) => s.status !== 'finalizada' && s.jogadores.some((p) => p.id === usuario.id))) falhar('Saia da sua sala atual antes de entrar em outra.', 409);
      sala.jogadores.push(jogador(usuario, 'O'));
      sala.atualizada = agora();
      sala.versao++;
      return publico(sala, usuario);
    },
    async consultar(usuario, codigo, partida) {
      const sala = buscar(codigo, usuario, partida);
      expirarTurno(sala);
      await persistir(sala);
      return publico(sala, usuario);
    },
    async agir(usuario, codigo, dados) {
      const sala = buscar(codigo, usuario, dados.partida);
      expirarTurno(sala);
      if (dados.acao === 'iniciar') {
        if (sala.jogadores[0].id !== usuario.id || sala.status !== 'aguardando' || sala.jogadores.length !== 2) falhar('Somente o criador pode iniciar, com dois alunos na sala.', 409);
        sala.status = 'jogando';
        sala.versao++;
        sala.mensagem = 'A partida começou!';
        prazo(sala);
      } else if (dados.acao === 'sair') {
        if (sala.status === 'aguardando') {
          if (sala.jogadores[0].id === usuario.id) salas.delete(sala.codigo);
          else { sala.jogadores.pop(); sala.versao++; }
          return { saiu: true };
        }
        if (sala.status === 'jogando') {
          sala.status = 'finalizada';
          sala.resultado = `${sala.jogadores.find((p) => p.id !== usuario.id).simbolo} venceu por desistência.`;
          sala.versao++;
        }
      } else {
        if (sala.status !== 'jogando' || sala.jogadores[sala.vez].id !== usuario.id || dados.versao !== sala.versao) falhar('A partida mudou. Aguarde a atualização da sua vez.', 409);
        if (dados.acao === 'responder' && sala.fase === 'pergunta') {
          if (!Number.isInteger(dados.resposta) || dados.resposta < 0 || dados.resposta > 2) falhar('Resposta inválida.');
          const pergunta = sala.perguntas[sala.indice % sala.perguntas.length];
          if (dados.resposta === pergunta.resposta_correta) {
            sala.jogadores[sala.vez].acertos++;
            sala.fase = 'jogada'; sala.versao++;
            sala.mensagem = 'Resposta correta! Escolha uma casa vazia.';
            prazo(sala);
          } else {
            sala.jogadores[sala.vez].erros++;
            passar(sala, 'Resposta incorreta. A vez passou.');
          }
        } else if (dados.acao === 'jogar' && sala.fase === 'jogada') {
          if (!Number.isInteger(dados.casa) || dados.casa < 0 || dados.casa > 8 || sala.tabuleiro[dados.casa]) falhar('Escolha uma casa vazia.');
          sala.tabuleiro[dados.casa] = sala.jogadores[sala.vez].simbolo;
          const venceu = linhas.some((linha) => linha.every((i) => sala.tabuleiro[i] === sala.jogadores[sala.vez].simbolo));
          if (venceu || sala.tabuleiro.every(Boolean)) {
            sala.status = 'finalizada'; sala.versao++;
            sala.resultado = venceu ? `${sala.jogadores[sala.vez].simbolo} venceu!` : 'Deu velha!';
          } else passar(sala, 'Jogada realizada. A vez passou.');
        } else falhar('Ação inválida para esta etapa.', 409);
      }
      await persistir(sala);
      return publico(sala, usuario);
    }
  };
}

module.exports = { criarServicoSalas };
