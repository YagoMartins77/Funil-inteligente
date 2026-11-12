import {
  AnaliseFunilResponse,
  Atendimento,
  ConfiguracaoEstatistica,
  DesfechoCatalogo,
  Etapa,
  ExecucaoSimulacao,
  IntervaloOperacional,
  MotivoDesistencia,
  VisitaEtapa,
} from '../types/funil';

const API_BASE = '/api/v1';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody.erro ?? `Erro HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export function sendBeaconJson(path: string, payload: unknown): boolean {
  const url = `${API_BASE}${path}`;
  const body = JSON.stringify(payload);
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    const ok = navigator.sendBeacon(url, blob);
    if (ok) return true;
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
  return true;
}

export interface FiltrosDashboard {
  sinteticas: boolean;
  dataInicio?: string;
  dataFim?: string;
  desfecho?: string;
  etapa?: number;
  janela?: number;
  k?: number;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== '' && val !== null) {
      qs.set(key, String(val));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listarEtapas: () => requestJson<Etapa[]>('/etapas'),
  listarDesfechos: () => requestJson<DesfechoCatalogo[]>('/desfechos'),
  listarMotivos: () => requestJson<MotivoDesistencia[]>('/desfechos/motivos'),

  criarAtendimento: (payload: {
    uuidExterno: string;
    dispositivo?: 'tablet' | 'desktop' | 'mobile';
    sintetica?: boolean;
  }) =>
    requestJson<Atendimento>('/atendimentos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  obterAtendimento: (id: number) =>
    requestJson<
      Atendimento & {
        visitas: VisitaEtapa[];
        pausas: IntervaloOperacional[];
        esperasOficina: IntervaloOperacional[];
      }
    >(`/atendimentos/${id}`),

  listarAtendimentos: (filtros: FiltrosDashboard & { page?: number; limit?: number }) =>
    requestJson<{
      itens: Atendimento[];
      paginacao: { page: number; limit: number; total: number; totalPaginas: number };
    }>(
      `/atendimentos${buildQuery({
        sinteticas: filtros.sinteticas,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        desfecho: filtros.desfecho,
        etapa: filtros.etapa,
        page: filtros.page ?? 1,
        limit: filtros.limit ?? 15,
      })}`,
    ),

  finalizarAtendimento: (id: number) =>
    requestJson<Atendimento>(`/atendimentos/${id}/finalizar`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  registrarVisita: (payload: Record<string, unknown>) =>
    requestJson<{ ok: boolean; visita: VisitaEtapa }>('/telemetria/visitas', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  registrarEvento: (payload: Record<string, unknown>) =>
    requestJson<{ ok: boolean; duplicado: boolean }>('/telemetria/eventos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  iniciarPausa: (
    id: number,
    payload: { intervaloId: string; etapaOrdem: number; motivoCodigo: string },
  ) =>
    requestJson<IntervaloOperacional>(`/atendimentos/${id}/pausas/iniciar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  finalizarPausa: (id: number, intervaloId?: string) =>
    requestJson<IntervaloOperacional>(`/atendimentos/${id}/pausas/finalizar`, {
      method: 'POST',
      body: JSON.stringify(intervaloId ? { intervaloId } : {}),
    }),

  iniciarEsperaOficina: (
    id: number,
    payload: { intervaloId: string; etapaOrdem: number; motivoCodigo: string },
  ) =>
    requestJson<IntervaloOperacional>(`/atendimentos/${id}/espera-oficina/iniciar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  finalizarEsperaOficina: (id: number, intervaloId?: string) =>
    requestJson<IntervaloOperacional>(`/atendimentos/${id}/espera-oficina/finalizar`, {
      method: 'POST',
      body: JSON.stringify(intervaloId ? { intervaloId } : {}),
    }),

  obterIntervalos: (id: number) =>
    requestJson<{
      pausas: IntervaloOperacional[];
      esperasOficina: IntervaloOperacional[];
      motivosPausa: Array<{ codigo: string; nome: string }>;
      motivosEspera: Array<{ codigo: string; nome: string }>;
    }>(`/atendimentos/${id}/intervalos`),

  registrarDesfecho: (
    id: number,
    payload: {
      desfechoCodigo: string;
      motivoDesistenciaCodigo?: string | null;
      etapaOrdem: number;
    },
  ) =>
    requestJson<Atendimento>(`/atendimentos/${id}/desfecho`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  obterAnaliseFunil: (filtros: FiltrosDashboard) =>
    requestJson<AnaliseFunilResponse>(
      `/analytics/funil${buildQuery({
        sinteticas: filtros.sinteticas,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        desfecho: filtros.desfecho,
        etapa: filtros.etapa,
        janela: filtros.janela,
        k: filtros.k,
      })}`,
    ),

  urlExportarCsv: (filtros: FiltrosDashboard) =>
    `${API_BASE}/analytics/exportar.csv${buildQuery({
      sinteticas: filtros.sinteticas,
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
      desfecho: filtros.desfecho,
      etapa: filtros.etapa,
    })}`,

  executarSimulacao: (payload: {
    regulares: number;
    anomalas: number;
    etapaAnomalia: number;
    semente: number;
    limparAntes: boolean;
  }) =>
    requestJson<{
      ok: boolean;
      execucao: ExecucaoSimulacao;
      comparacao: {
        etapasEsperadas: number[];
        etapasDetectadas: number[];
        verdadeirosPositivos: number;
        falsosPositivos: number;
        falsosNegativos: number;
        precisao: number;
        revocacao: number;
      };
      analise: AnaliseFunilResponse;
    }>('/admin/simular', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listarHistoricoSimulacao: () => requestJson<ExecucaoSimulacao[]>('/admin/simular/historico'),

  limparSinteticos: () =>
    requestJson<{ escopo: string; atendimentosRemovidos: number }>('/admin/dados?escopo=sinteticos', {
      method: 'DELETE',
    }),

  obterConfiguracoes: () => requestJson<ConfiguracaoEstatistica>('/admin/configuracoes'),

  atualizarConfiguracoes: (payload: Partial<ConfiguracaoEstatistica>) =>
    requestJson<ConfiguracaoEstatistica>('/admin/configuracoes', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
