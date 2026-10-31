const avaliacaoModel = require('../Model/avaliacaoModel');
const partidaModel = require('../Model/partidaModel');
const perguntaModel = require('../Model/perguntaModel');
const { TOTAL_PERGUNTAS_AVALIACAO, PARTIDAS_PARA_POS_TESTE } = require('../Config/constantes');

// Erro de regra de negócio: o controller o converte em resposta HTTP.
class ErroRegra extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

function percentual(acertos, total) {
  return total ? Math.round((acertos / total) * 100) : 0;
}

// Resultado de uma avaliação concluída (ou null se ainda não foi feita).
function resumo(avaliacao) {
  if (!avaliacao || !avaliacao.concluida_em) return null;
  return { acertos: avaliacao.acertos, total: avaliacao.total, percentual: percentual(avaliacao.acertos, avaliacao.total) };
}

async function preTesteConcluido(usuarioId) {
  return Boolean((await avaliacaoModel.buscar(usuarioId, 'pre'))?.concluida_em);
}

// Em que etapa o aluno está: pre -> jogar -> pos -> concluida.
async function status(usuarioId) {
  const [pre, pos] = await Promise.all([
    avaliacaoModel.buscar(usuarioId, 'pre'),
    avaliacaoModel.buscar(usuarioId, 'pos')
  ]);
  const preConcluido = Boolean(pre?.concluida_em);
  const posConcluido = Boolean(pos?.concluida_em);
  const partidas = preConcluido ? await partidaModel.contarDepoisDoPreTeste(usuarioId) : 0;
  const posLiberado = preConcluido && partidas >= PARTIDAS_PARA_POS_TESTE;

  let proximaEtapa = 'jogar';
  if (!preConcluido) proximaEtapa = 'pre';
  else if (posConcluido) proximaEtapa = 'concluida';
  else if (posLiberado) proximaEtapa = 'pos';

  return {
    proximaEtapa,
    preConcluido,
    posConcluido,
    posLiberado,
    partidas,
    partidasNecessarias: PARTIDAS_PARA_POS_TESTE,
    pre: resumo(pre),
    pos: resumo(pos)
  };
}

async function carregarPerguntas(ids) {
  const linhas = await perguntaModel.buscarPorIds(ids);
  const porId = new Map(linhas.map((linha) => [String(linha.id), linha]));
  return ids.map((id) => porId.get(String(id))).filter(Boolean);
}

async function exigirPosTesteLiberado(usuarioId) {
  const estado = await status(usuarioId);
  if (!estado.preConcluido) {
    throw new ErroRegra(403, 'PRE_TESTE_PENDENTE', 'Faça o pré-teste antes do pós-teste.');
  }
  if (!estado.posLiberado) {
    throw new ErroRegra(403, 'JOGUE_ANTES', 'Jogue pelo menos uma partida antes de fazer o pós-teste.');
  }
}

async function escolherPerguntas(usuarioId, tipo) {
  if (tipo === 'pos') {
    // Mesmas perguntas do pré-teste, para dar para comparar o desempenho.
    return (await avaliacaoModel.buscar(usuarioId, 'pre')).perguntas;
  }
  const ids = await perguntaModel.sortearIdsAprovadas(TOTAL_PERGUNTAS_AVALIACAO);
  if (!ids.length) {
    throw new ErroRegra(409, 'SEM_PERGUNTAS', 'Ainda não há perguntas aprovadas para a avaliação. Tente novamente mais tarde.');
  }
  return ids;
}

// Inicia a avaliação (ou retoma a que está em andamento). Nunca envia o gabarito.
async function iniciar(usuarioId, tipo) {
  let avaliacao = await avaliacaoModel.buscar(usuarioId, tipo);

  if (avaliacao?.concluida_em) {
    const concluida = { concluida: true, tipo, ...resumo(avaliacao) };
    if (tipo === 'pos') {
      concluida.pre = resumo(await avaliacaoModel.buscar(usuarioId, 'pre'));
      concluida.evolucao = concluida.percentual - concluida.pre.percentual;
    }
    return concluida;
  }

  if (tipo === 'pos') await exigirPosTesteLiberado(usuarioId);

  let criada = false;
  if (!avaliacao) {
    const perguntas = await escolherPerguntas(usuarioId, tipo);
    ({ avaliacao, criada } = await avaliacaoModel.criar({ usuarioId, tipo, perguntas }));
  }

  const perguntas = await carregarPerguntas(avaliacao.perguntas);
  return {
    concluida: false,
    criada,
    tipo,
    total: perguntas.length,
    perguntas: perguntas.map((p) => ({ id: String(p.id), texto: p.texto, opcoes: perguntaModel.alternativasDe(p) }))
  };
}

// Corrige no servidor e grava o resultado.
async function responder(usuarioId, tipo, respostas) {
  const avaliacao = await avaliacaoModel.buscar(usuarioId, tipo);
  if (!avaliacao) throw new ErroRegra(404, 'NAO_INICIADA', 'Inicie a avaliação antes de enviar as respostas.');
  if (avaliacao.concluida_em) throw new ErroRegra(409, 'JA_CONCLUIDA', 'Esta avaliação já foi concluída.');

  const perguntas = await carregarPerguntas(avaliacao.perguntas);
  const recebidas = new Map(
    (Array.isArray(respostas) ? respostas : []).map((item) => [String(item?.perguntaId), Number(item?.resposta)])
  );

  const escolhas = {};
  for (const pergunta of perguntas) {
    const escolha = recebidas.get(String(pergunta.id));
    const totalOpcoes = perguntaModel.alternativasDe(pergunta).length;
    if (!Number.isInteger(escolha) || escolha < 0 || escolha >= totalOpcoes) {
      throw new ErroRegra(400, 'RESPOSTAS_INCOMPLETAS', 'Responda todas as perguntas antes de finalizar.');
    }
    escolhas[String(pergunta.id)] = escolha;
  }

  const acertos = perguntas.filter((p) => escolhas[String(p.id)] === p.resposta_correta).length;
  if (!(await avaliacaoModel.concluir(avaliacao.id, escolhas, acertos))) {
    throw new ErroRegra(409, 'JA_CONCLUIDA', 'Esta avaliação já foi concluída.');
  }

  const resultado = { tipo, acertos, total: perguntas.length, percentual: percentual(acertos, perguntas.length) };

  if (tipo === 'pos') {
    resultado.pre = resumo(await avaliacaoModel.buscar(usuarioId, 'pre'));
    resultado.evolucao = resultado.percentual - resultado.pre.percentual;
    // Só depois de concluído o pós-teste é seguro mostrar o gabarito.
    resultado.revisao = perguntas.map((p) => ({
      texto: p.texto,
      opcoes: perguntaModel.alternativasDe(p),
      escolhida: escolhas[String(p.id)],
      correta: p.resposta_correta
    }));
  }
  return resultado;
}

// Visão do professor: resultado por aluno e médias da turma.
function resumirTurma(linhas) {
  const alunos = linhas.map((linha) => {
    const pre = linha.pre_total != null ? { acertos: linha.pre_acertos, total: linha.pre_total, percentual: percentual(linha.pre_acertos, linha.pre_total) } : null;
    const pos = linha.pos_total != null ? { acertos: linha.pos_acertos, total: linha.pos_total, percentual: percentual(linha.pos_acertos, linha.pos_total) } : null;
    return {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      turma: linha.turma,
      pre,
      pos,
      evolucao: pre && pos ? pos.percentual - pre.percentual : null
    };
  });

  const media = (valores) => (valores.length ? Math.round(valores.reduce((soma, v) => soma + v, 0) / valores.length) : null);
  return {
    alunos,
    mediaPre: media(alunos.filter((a) => a.pre).map((a) => a.pre.percentual)),
    mediaPos: media(alunos.filter((a) => a.pos).map((a) => a.pos.percentual)),
    ganhoMedio: media(alunos.filter((a) => a.evolucao !== null).map((a) => a.evolucao))
  };
}

module.exports = { ErroRegra, status, preTesteConcluido, iniciar, responder, resumirTurma };
