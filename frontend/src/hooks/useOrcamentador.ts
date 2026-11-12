import { useCallback, useEffect, useRef, useState } from 'react';
import { api, sendBeaconJson } from '../services/api';
import { DesfechoCatalogo, Etapa, MotivoDesistencia } from '../types/funil';

const STORAGE_KEY = 'fastcar_orcamentador_sessao_v1';
const IDLE_THRESHOLD_MS = 30_000;

export const MOTIVOS_PAUSA = [
  { codigo: 'atendimento_simultaneo', nome: 'Apoio a outro cliente no balcão' },
  { codigo: 'busca_fisica_estoque', nome: 'Busca física de peça no estoque' },
  { codigo: 'consulta_sistema_interno', nome: 'Verificação em sistema de fornecedor' },
  { codigo: 'intervalo_operacional', nome: 'Pausa operacional rápida' },
];

export const MOTIVOS_ESPERA_OFICINA = [
  { codigo: 'compatibilidade_eletrica', nome: 'Compatibilidade elétrica / som' },
  { codigo: 'disponibilidade_box', nome: 'Disponibilidade de box na oficina' },
  { codigo: 'inspecao_presencial_veiculo', nome: 'Inspeção presencial do técnico' },
  { codigo: 'orcamento_mao_de_obra', nome: 'Complexidade de mão de obra' },
];

interface PersistedSession {
  atendimentoId: number;
  uuidExterno: string;
  etapaOrdem: number;
  etapaIniciadaEmMs: number;
  visitaId: string;
  emPausa: boolean;
  emEsperaOficina: boolean;
  pausaId: string | null;
  pausaIniciadaEmMs: number | null;
  esperaId: string | null;
  esperaIniciadaEmMs: number | null;
  acumuladoPausaEtapaMs: number;
  acumuladoEsperaEtapaMs: number;
  acumuladoOciosoEtapaMs: number;
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useOrcamentador() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [desfechos, setDesfechos] = useState<DesfechoCatalogo[]>([]);
  const [motivos, setMotivos] = useState<MotivoDesistencia[]>([]);
  const [sessao, setSessao] = useState<PersistedSession | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [ultimoDesfecho, setUltimoDesfecho] = useState<{
    atendimentoId: number;
    desfechoNome: string;
  } | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const sessaoRef = useRef<PersistedSession | null>(null);
  sessaoRef.current = sessao;

  const etapasRef = useRef<Etapa[]>([]);
  etapasRef.current = etapas;

  // Carrega catálogos e recupera sessão salva se existir
  useEffect(() => {
    let ativo = true;
    async function init() {
      try {
        const [etapasRes, desfechosRes, motivosRes] = await Promise.all([
          api.listarEtapas(),
          api.listarDesfechos(),
          api.listarMotivos(),
        ]);
        if (!ativo) return;
        setEtapas(etapasRes);
        setDesfechos(desfechosRes);
        setMotivos(motivosRes);

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as PersistedSession;
          try {
            const remote = await api.obterAtendimento(saved.atendimentoId);
            if (remote.status !== 'finalizado' && remote.status !== 'abandonado') {
              setSessao(saved);
              setFeedback(`Atendimento #${saved.atendimentoId} recuperado automaticamente.`);
              api
                .registrarEvento({
                  eventoId: genId('ev-rec'),
                  atendimentoId: saved.atendimentoId,
                  tipo: 'sessao_recuperada',
                  etapaOrdem: saved.etapaOrdem,
                })
                .catch(() => {});
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          } catch {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar dados iniciais.');
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    init();
    return () => {
      ativo = false;
    };
  }, []);

  // Persiste sessão no localStorage apenas após o carregamento inicial
  useEffect(() => {
    if (carregando) return;
    if (sessao) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessao));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [sessao, carregando]);

  // Cronômetro visual leve e detecção de ociosidade
  useEffect(() => {
    if (!sessao) {
      setElapsedMs(0);
      return;
    }

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    const interval = window.setInterval(() => {
      const s = sessaoRef.current;
      if (!s) return;
      setElapsedMs(Date.now() - s.etapaIniciadaEmMs);
      if (!s.emPausa && !s.emEsperaOficina) {
        const idle = Date.now() - lastActivityRef.current;
        if (idle > IDLE_THRESHOLD_MS) {
          s.acumuladoOciosoEtapaMs += 1000;
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.clearInterval(interval);
    };
  }, [sessao?.atendimentoId, sessao?.etapaOrdem]);

  const calcularTemposEtapa = useCallback((s: PersistedSession) => {
    const t0 = performance.now();
    const agora = Date.now();
    const totalMs = Math.max(1, agora - s.etapaIniciadaEmMs);
    const pausaAtual =
      s.emPausa && s.pausaIniciadaEmMs ? Math.max(0, agora - s.pausaIniciadaEmMs) : 0;
    const esperaAtual =
      s.emEsperaOficina && s.esperaIniciadaEmMs ? Math.max(0, agora - s.esperaIniciadaEmMs) : 0;
    const tempoPausaMs = s.acumuladoPausaEtapaMs + pausaAtual;
    const tempoEsperaOficinaMs = s.acumuladoEsperaEtapaMs + esperaAtual;
    const tempoOciosoMs = Math.min(
      s.acumuladoOciosoEtapaMs,
      Math.max(0, totalMs - tempoPausaMs - tempoEsperaOficinaMs),
    );
    const tempoAtivoMs = Math.max(
      0,
      totalMs - tempoPausaMs - tempoEsperaOficinaMs - tempoOciosoMs,
    );
    const overheadMs = Number((performance.now() - t0).toFixed(3));
    return {
      tempoTotalMs: totalMs,
      tempoAtivoMs,
      tempoPausaMs,
      tempoEsperaOficinaMs,
      tempoOciosoMs,
      overheadMs,
    };
  }, []);

  // Envio assíncrono via sendBeacon ao sair/ocultar página
  useEffect(() => {
    const enviarParcialBeacon = () => {
      const s = sessaoRef.current;
      const etapa = etapasRef.current.find((e) => e.ordem === s?.etapaOrdem);
      if (!s || !etapa) return;
      const tempos = calcularTemposEtapa(s);
      sendBeaconJson('/telemetria/visitas', {
        visitaId: s.visitaId,
        atendimentoId: s.atendimentoId,
        etapa: etapa.slug,
        ordem: etapa.ordem,
        iniciadaEm: new Date(s.etapaIniciadaEmMs).toISOString(),
        atualizadaEm: new Date().toISOString(),
        ...tempos,
        resultado: 'em_andamento',
        dispositivo: 'tablet',
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        enviarParcialBeacon();
      }
    };
    window.addEventListener('pagehide', enviarParcialBeacon);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', enviarParcialBeacon);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [calcularTemposEtapa]);

  const iniciarAtendimento = async () => {
    setErro(null);
    setUltimoDesfecho(null);
    const uuidExterno = genId('atend');
    const created = await api.criarAtendimento({
      uuidExterno,
      dispositivo: 'tablet',
      sintetica: false,
    });
    const novaSessao: PersistedSession = {
      atendimentoId: created.id,
      uuidExterno,
      etapaOrdem: 1,
      etapaIniciadaEmMs: Date.now(),
      visitaId: `${uuidExterno}:e1:${Date.now()}`,
      emPausa: false,
      emEsperaOficina: false,
      pausaId: null,
      pausaIniciadaEmMs: null,
      esperaId: null,
      esperaIniciadaEmMs: null,
      acumuladoPausaEtapaMs: 0,
      acumuladoEsperaEtapaMs: 0,
      acumuladoOciosoEtapaMs: 0,
    };
    setSessao(novaSessao);
    setFeedback(`Atendimento #${created.id} iniciado.`);
    api
      .registrarEvento({
        eventoId: genId('ev-ini'),
        atendimentoId: created.id,
        tipo: 'etapa_iniciada',
        etapaOrdem: 1,
      })
      .catch(() => {});
  };

  const transicionarEtapa = async (novaOrdem: number) => {
    if (!sessao) return;
    if (sessao.emPausa || sessao.emEsperaOficina) {
      setErro('Finalize a pausa ou espera técnica antes de mudar de etapa.');
      return;
    }
    const etapaAtual = etapas.find((e) => e.ordem === sessao.etapaOrdem);
    if (!etapaAtual) return;

    setErro(null);
    const direcao = novaOrdem > sessao.etapaOrdem ? 'avancou' : 'retornou';
    const tempos = calcularTemposEtapa(sessao);

    await api.registrarVisita({
      visitaId: sessao.visitaId,
      atendimentoId: sessao.atendimentoId,
      etapa: etapaAtual.slug,
      ordem: etapaAtual.ordem,
      iniciadaEm: new Date(sessao.etapaIniciadaEmMs).toISOString(),
      atualizadaEm: new Date().toISOString(),
      finalizadaEm: new Date().toISOString(),
      ...tempos,
      resultado: direcao,
      dispositivo: 'tablet',
    });

    api
      .registrarEvento({
        eventoId: genId('ev-trans'),
        atendimentoId: sessao.atendimentoId,
        tipo: direcao === 'avancou' ? 'etapa_avancada' : 'etapa_retornada',
        etapaOrdem: novaOrdem,
        payloadSeguro: {
          etapaOrigem: sessao.etapaOrdem,
          etapaDestino: novaOrdem,
          overheadMs: tempos.overheadMs,
        },
      })
      .catch(() => {});

    setSessao({
      ...sessao,
      etapaOrdem: novaOrdem,
      etapaIniciadaEmMs: Date.now(),
      visitaId: `${sessao.uuidExterno}:e${novaOrdem}:${Date.now()}`,
      acumuladoPausaEtapaMs: 0,
      acumuladoEsperaEtapaMs: 0,
      acumuladoOciosoEtapaMs: 0,
    });
  };

  const iniciarPausa = async (motivoCodigo: string) => {
    if (!sessao) return;
    setErro(null);
    const intervaloId = genId('pausa');
    await api.iniciarPausa(sessao.atendimentoId, {
      intervaloId,
      etapaOrdem: sessao.etapaOrdem,
      motivoCodigo,
    });
    setSessao({
      ...sessao,
      emPausa: true,
      pausaId: intervaloId,
      pausaIniciadaEmMs: Date.now(),
    });
    setFeedback('Pausa operacional registrada.');
  };

  const finalizarPausa = async () => {
    if (!sessao || !sessao.emPausa) return;
    setErro(null);
    const res = await api.finalizarPausa(sessao.atendimentoId, sessao.pausaId ?? undefined);
    setSessao({
      ...sessao,
      emPausa: false,
      pausaId: null,
      pausaIniciadaEmMs: null,
      acumuladoPausaEtapaMs: sessao.acumuladoPausaEtapaMs + res.duracaoMs,
    });
    setFeedback('Atendimento retomado.');
  };

  const iniciarEsperaOficina = async (motivoCodigo: string) => {
    if (!sessao) return;
    setErro(null);
    const intervaloId = genId('espera');
    await api.iniciarEsperaOficina(sessao.atendimentoId, {
      intervaloId,
      etapaOrdem: sessao.etapaOrdem,
      motivoCodigo,
    });
    setSessao({
      ...sessao,
      emEsperaOficina: true,
      esperaId: intervaloId,
      esperaIniciadaEmMs: Date.now(),
    });
    setFeedback('Aguardando retorno técnico da oficina.');
  };

  const finalizarEsperaOficina = async () => {
    if (!sessao || !sessao.emEsperaOficina) return;
    setErro(null);
    const res = await api.finalizarEsperaOficina(
      sessao.atendimentoId,
      sessao.esperaId ?? undefined,
    );
    setSessao({
      ...sessao,
      emEsperaOficina: false,
      esperaId: null,
      esperaIniciadaEmMs: null,
      acumuladoEsperaEtapaMs: sessao.acumuladoEsperaEtapaMs + res.duracaoMs,
    });
    setFeedback('Retorno da oficina registrado.');
  };

  const encerrarComDesfecho = async (
    desfechoCodigo: string,
    motivoDesistenciaCodigo?: string | null,
  ) => {
    if (!sessao) return;
    if (sessao.emPausa || sessao.emEsperaOficina) {
      setErro('Finalize a pausa ou espera da oficina antes de encerrar o atendimento.');
      return;
    }
    const etapaAtual = etapas.find((e) => e.ordem === sessao.etapaOrdem);
    if (!etapaAtual) return;

    setErro(null);
    const tempos = calcularTemposEtapa(sessao);
    await api.registrarVisita({
      visitaId: sessao.visitaId,
      atendimentoId: sessao.atendimentoId,
      etapa: etapaAtual.slug,
      ordem: etapaAtual.ordem,
      iniciadaEm: new Date(sessao.etapaIniciadaEmMs).toISOString(),
      atualizadaEm: new Date().toISOString(),
      finalizadaEm: new Date().toISOString(),
      ...tempos,
      resultado: desfechoCodigo === 'convertido' ? 'concluiu' : 'abandonou',
      dispositivo: 'tablet',
    });

    await api.registrarDesfecho(sessao.atendimentoId, {
      desfechoCodigo,
      motivoDesistenciaCodigo: motivoDesistenciaCodigo ?? null,
      etapaOrdem: sessao.etapaOrdem,
    });

    await api.finalizarAtendimento(sessao.atendimentoId);

    const def = desfechos.find((d) => d.codigo === desfechoCodigo);
    setUltimoDesfecho({
      atendimentoId: sessao.atendimentoId,
      desfechoNome: def?.nome ?? desfechoCodigo,
    });
    setSessao(null);
    setFeedback(null);
  };

  return {
    etapas,
    desfechos,
    motivos,
    sessao,
    carregando,
    erro,
    feedback,
    elapsedMs,
    ultimoDesfecho,
    setErro,
    iniciarAtendimento,
    transicionarEtapa,
    iniciarPausa,
    finalizarPausa,
    iniciarEsperaOficina,
    finalizarEsperaOficina,
    encerrarComDesfecho,
  };
}
