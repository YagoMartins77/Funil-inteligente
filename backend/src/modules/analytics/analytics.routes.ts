import { Request, Router } from 'express';
import { FiltroAnalytics, IFunilRepository } from '../../database/types';
import { asyncHandler } from '../../shared/asyncHandler';
import { analisarFunilCompleto, resultadoEfetivoVisita } from './analyticsEngine';

function extrairFiltroAnalytics(req: Request): FiltroAnalytics {
  const sintetica = req.query.sinteticas === 'true';
  const desfecho =
    typeof req.query.desfecho === 'string' && req.query.desfecho.trim()
      ? req.query.desfecho.trim()
      : undefined;
  const cenario =
    typeof req.query.cenario === 'string' && req.query.cenario.trim()
      ? req.query.cenario.trim()
      : undefined;
  const etapaNum = req.query.etapa ? Number(req.query.etapa) : undefined;
  const dataInicio =
    typeof req.query.dataInicio === 'string' && req.query.dataInicio
      ? new Date(req.query.dataInicio)
      : undefined;
  const dataFim =
    typeof req.query.dataFim === 'string' && req.query.dataFim
      ? new Date(req.query.dataFim)
      : undefined;

  return {
    sintetica,
    desfecho,
    cenario,
    etapaOrdem: etapaNum && Number.isInteger(etapaNum) && etapaNum >= 1 && etapaNum <= 5 ? etapaNum : undefined,
    dataInicio: dataInicio && !Number.isNaN(dataInicio.getTime()) ? dataInicio : undefined,
    dataFim: dataFim && !Number.isNaN(dataFim.getTime()) ? dataFim : undefined,
  };
}

export function createAnalyticsRouter(repo: IFunilRepository): Router {
  const router = Router();

  async function calcularAnalise(req: Request) {
    const filtro = extrairFiltroAnalytics(req);
    const [cfg, etapas, { atendimentos, visitas }] = await Promise.all([
      repo.obterConfiguracaoEstatistica(),
      repo.listarEtapas(),
      repo.listarVisitasParaAnalytics(filtro),
    ]);

    const janela = req.query.janela !== undefined ? Number(req.query.janela) : cfg.janelaPadrao;
    const k = req.query.k !== undefined ? Number(req.query.k) : cfg.kDesvios;

    return analisarFunilCompleto(atendimentos, visitas, etapas, {
      janela: Number.isFinite(janela) && janela >= 0 ? janela : cfg.janelaPadrao,
      k: Number.isFinite(k) && k > 0 ? k : cfg.kDesvios,
      minBaseline: cfg.minBaseline,
      minJanela: cfg.minJanela,
      timeoutS: cfg.timeoutAbandonoS,
    });
  }

  router.get(
    '/resumo',
    asyncHandler(async (req, res) => {
      const analise = await calcularAnalise(req);
      res.json({
        atualizadoEm: analise.atualizadoEm,
        parametros: analise.parametros,
        janela: analise.janela,
        resumo: analise.resumo,
        overhead: analise.overhead,
      });
    }),
  );

  router.get(
    '/funil',
    asyncHandler(async (req, res) => {
      const analise = await calcularAnalise(req);
      res.json(analise);
    }),
  );

  router.get(
    '/tempos',
    asyncHandler(async (req, res) => {
      const analise = await calcularAnalise(req);
      res.json({
        atualizadoEm: analise.atualizadoEm,
        etapas: analise.funil.map((e) => ({
          ordem: e.ordem,
          slug: e.slug,
          nome: e.nome,
          tempoAtivo: e.tempoAtivo,
          tempoPausaMedioMs: e.tempoPausaMedioMs,
          tempoEsperaOficinaMedioMs: e.tempoEsperaOficinaMedioMs,
          tempoOciosoMedioMs: e.tempoOciosoMedioMs,
        })),
      });
    }),
  );

  router.get(
    '/abandono',
    asyncHandler(async (req, res) => {
      const analise = await calcularAnalise(req);
      res.json({
        atualizadoEm: analise.atualizadoEm,
        taxaAbandonoGeral: analise.resumo.taxaAbandono,
        motivosAbandono: analise.motivosAbandono,
        porEtapa: analise.funil.map((e) => ({
          ordem: e.ordem,
          slug: e.slug,
          nome: e.nome,
          abandonos: e.abandonos,
          taxaAbandono: e.taxaAbandono,
          relacaoTempoAbandono: e.relacaoTempoAbandono,
        })),
      });
    }),
  );

  router.get(
    '/anomalias',
    asyncHandler(async (req, res) => {
      const analise = await calcularAnalise(req);
      res.json({
        atualizadoEm: analise.atualizadoEm,
        parametros: analise.parametros,
        janela: analise.janela,
        alertas: analise.alertas,
        etapas: analise.funil.map((e) => ({
          ordem: e.ordem,
          slug: e.slug,
          nome: e.nome,
          ...e.anomalia,
        })),
      });
    }),
  );

  router.get(
    '/tempo-desfecho',
    asyncHandler(async (req, res) => {
      const analise = await calcularAnalise(req);
      res.json({
        atualizadoEm: analise.atualizadoEm,
        tempoDesfecho: analise.tempoDesfecho,
      });
    }),
  );

  router.get(
    '/exportar.csv',
    asyncHandler(async (req, res) => {
      const filtro = extrairFiltroAnalytics(req);
      const cfg = await repo.obterConfiguracaoEstatistica();
      const { atendimentos, visitas } = await repo.listarVisitasParaAnalytics(filtro);
      const atendimentoMap = new Map(atendimentos.map((a) => [a.id, a]));
      const agora = new Date();

      const header = [
        'atendimento_id',
        'etapa_slug',
        'etapa_ordem',
        'iniciada_em',
        'hora_do_dia',
        'tempo_total_ms',
        'tempo_ativo_ms',
        'tempo_pausa_ms',
        'tempo_espera_oficina_ms',
        'tempo_ocioso_ms',
        'resultado',
        'resultado_efetivo',
        'desfecho_atendimento',
        'motivo_desistencia',
        'dispositivo',
        'cenario',
        'sintetica',
        'overhead_ms',
      ].join(',');

      const lines = visitas.map((v) => {
        const atend = atendimentoMap.get(v.atendimentoId);
        return [
          v.atendimentoId,
          v.etapaSlug,
          v.ordem,
          v.iniciadaEm.toISOString(),
          v.iniciadaEm.getUTCHours(),
          v.tempoTotalMs,
          v.tempoAtivoMs,
          v.tempoPausaMs,
          v.tempoEsperaOficinaMs,
          v.tempoOciosoMs,
          v.resultado,
          resultadoEfetivoVisita(v, agora, cfg.timeoutAbandonoS),
          atend?.desfechoCodigo ?? '',
          atend?.motivoDesistenciaCodigo ?? '',
          atend?.dispositivo ?? 'tablet',
          atend?.cenario ?? '',
          v.sintetica ? 1 : 0,
          v.overheadMs ?? '',
        ].join(',');
      });

      const csv = [header, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="fastcar_funil_visitas.csv"');
      res.send(csv);
    }),
  );

  return router;
}
