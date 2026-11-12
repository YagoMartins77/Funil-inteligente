import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { api, FiltrosDashboard } from '../../services/api';
import { AnaliseFunilResponse, DesfechoCatalogo, Etapa } from '../../types/funil';
import { formatMs, formatPct, labelDesfecho } from '../../utils/format';

export function DashboardPage() {
  const [filtros, setFiltros] = useState<FiltrosDashboard>({
    sinteticas: false,
    dataInicio: '',
    dataFim: '',
    desfecho: '',
    etapa: undefined,
  });
  const [analise, setAnalise] = useState<AnaliseFunilResponse | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [desfechos, setDesfechos] = useState<DesfechoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [anRes, etRes, dfRes] = await Promise.all([
        api.obterAnaliseFunil(filtros),
        api.listarEtapas(),
        api.listarDesfechos(),
      ]);
      setAnalise(anRes);
      setEtapas(etRes);
      setDesfechos(dfRes);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar analytics.');
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const maxEntradas = analise
    ? Math.max(1, ...analise.funil.map((e) => e.entradas))
    : 1;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>Centro de Telemetria — FASTCAR</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Monitoramento do funil presencial de 5 etapas e detecção determinística de gargalos
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            aria-label="Tipo de dados"
            className="select"
            value={filtros.sinteticas ? 'sintetico' : 'real'}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, sinteticas: e.target.value === 'sintetico' }))
            }
          >
            <option value="real">Dados Reais (Balcão)</option>
            <option value="sintetico">Dados Sintéticos (Simulação)</option>
          </select>

          <input
            aria-label="Data inicial"
            type="date"
            className="input"
            value={filtros.dataInicio ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
          />
          <input
            aria-label="Data final"
            type="date"
            className="input"
            value={filtros.dataFim ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
          />

          <select
            aria-label="Filtrar por etapa"
            className="select"
            value={filtros.etapa ?? ''}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                etapa: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Todas as etapas</option>
            {etapas.map((et) => (
              <option key={et.ordem} value={et.ordem}>
                {et.ordem}. {et.nome}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por desfecho"
            className="select"
            value={filtros.desfecho ?? ''}
            onChange={(e) => setFiltros((f) => ({ ...f, desfecho: e.target.value }))}
          >
            <option value="">Todos os desfechos</option>
            {desfechos.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.nome}
              </option>
            ))}
          </select>

          <button className="btn" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw size={14} /> Atualizar
          </button>

          <a
            href={api.urlExportarCsv(filtros)}
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            <Download size={14} /> Exportar CSV
          </a>
        </div>
      </header>

      <div className="page-content">
        {erro && <div className="alert-banner">{erro}</div>}

        {carregando && !analise ? (
          <div className="card">Carregando indicadores de telemetria...</div>
        ) : (
          analise && (
            <>
              {/* KPIs Principais */}
              <section className="kpi-grid" aria-label="Indicadores principais">
                <div className="kpi-card accent">
                  <span className="kpi-label">Total de Atendimentos</span>
                  <span className="kpi-value">{analise.resumo.totalAtendimentos}</span>
                  <span className="kpi-meta">
                    {filtros.sinteticas ? 'Base sintética isolada' : 'Registros reais do balcão'}
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">Taxa de Conversão</span>
                  <span className="kpi-value">{formatPct(analise.resumo.taxaConversao)}</span>
                  <span className="kpi-meta">
                    {analise.resumo.convertidos} convertidos / {analise.resumo.naoConvertidos} não convertidos
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">Taxa de Abandono</span>
                  <span className="kpi-value">{formatPct(analise.resumo.taxaAbandono)}</span>
                  <span className="kpi-meta">{analise.resumo.desistencias} desistências</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">Tempo Médio / Mediana</span>
                  <span className="kpi-value">
                    {formatMs(analise.resumo.tempoMedioAtendimentoMs)}
                  </span>
                  <span className="kpi-meta">
                    Mediana: {formatMs(analise.resumo.medianaAtendimentoMs)} | σ:{' '}
                    {formatMs(analise.resumo.desvioAtendimentoMs)}
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">Espera Oficina / Pausas</span>
                  <span className="kpi-value">
                    {formatMs(analise.resumo.tempoMedioEsperaOficinaMs)}
                  </span>
                  <span className="kpi-meta">
                    Pausa média: {formatMs(analise.resumo.tempoMedioPausaMs)}
                  </span>
                </div>

                <div className="kpi-card accent">
                  <span className="kpi-label">Tempos Atípicos</span>
                  <span className="kpi-value">{analise.resumo.atendimentosAtipicos}</span>
                  <span className="kpi-meta">
                    Alertas de etapa: {analise.alertas.length}
                  </span>
                </div>
              </section>

              {/* Detector de Anomalias */}
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Detector Estatístico de Anomalias</h2>
                    <div className="card-subtitle">
                      Regra: Média recente ({analise.janela.sessoesJanela} sessões) &gt; Mediana
                      histórica ({analise.janela.sessoesHistorico} sessões) +{' '}
                      {analise.parametros.k} × Desvio-padrão
                    </div>
                  </div>
                  {analise.overhead.n > 0 && (
                    <span className={`badge ${analise.overhead.atende ? 'badge-ok' : 'badge-red'}`}>
                      Overhead P95: {analise.overhead.p95Ms} ms (limite {analise.overhead.limiteMs}{' '}
                      ms)
                    </span>
                  )}
                </div>

                {analise.alertas.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      fontSize: 13,
                    }}
                  >
                    <CheckCircle2 size={18} color="#34d399" />
                    <span>
                      Nenhum gargalo estatístico detectado nas etapas com amostra suficiente.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {analise.alertas.map((alerta) => (
                      <div
                        key={alerta.slug}
                        style={{
                          padding: 14,
                          borderRadius: 8,
                          border: '1px solid rgba(225,6,0,0.45)',
                          backgroundColor: 'rgba(225,6,0,0.1)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <strong style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={16} color="#ff2525" />
                            Etapa {alerta.ordem}: {alerta.nome}
                          </strong>
                          <span className="badge badge-red mono">
                            +{alerta.desviosAcimaMediana}σ | Obs: {formatMs(alerta.mediaJanelaMs)} vs
                            Limiar: {formatMs(alerta.limiarMs)}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {alerta.explicacao} (Amostras: {alerta.nHistorico} históricas /{' '}
                          {alerta.nJanela} recentes)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Funil das 5 Etapas + Tempos por Etapa */}
              <div className="grid-2">
                <section className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Funil Presencial (5 Etapas)</h2>
                      <div className="card-subtitle">
                        Continuidade e perda de atendimentos por etapa
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {analise.funil.map((et) => {
                      const widthPct = Math.round((et.entradas / maxEntradas) * 100);
                      return (
                        <div key={et.slug}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 13,
                              marginBottom: 5,
                            }}
                          >
                            <span>
                              <strong>
                                {et.ordem}. {et.nome}
                              </strong>
                            </span>
                            <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                              {et.entradas} entradas | Cont.: {formatPct(et.taxaContinuidade)} |
                              Aband.: {formatPct(et.taxaAbandono)}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 22,
                              backgroundColor: 'var(--bg-deep)',
                              borderRadius: 6,
                              overflow: 'hidden',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${widthPct}%`,
                                backgroundColor:
                                  et.anomalia.status === 'anomalia'
                                    ? 'var(--red-highlight)'
                                    : 'var(--red-primary)',
                                transition: 'width 0.25s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Análise Temporal por Etapa</h2>
                      <div className="card-subtitle">
                        Tempo ativo (sem pausas e sem espera da oficina)
                      </div>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Etapa</th>
                          <th>Média</th>
                          <th>Mediana</th>
                          <th>Desvio</th>
                          <th>Espera Ofic.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.funil.map((et) => (
                          <tr key={et.slug}>
                            <td>
                              {et.ordem}. {et.nome}
                            </td>
                            <td className="mono">{formatMs(et.tempoAtivo.media)}</td>
                            <td className="mono">{formatMs(et.tempoAtivo.mediana)}</td>
                            <td className="mono">{formatMs(et.tempoAtivo.desvio)}</td>
                            <td className="mono">{formatMs(et.tempoEsperaOficinaMedioMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {/* Tempo x Desfecho + Motivos de Desistência */}
              <div className="grid-2">
                <section className="card">
                  <div className="card-header">
                    <h2 className="card-title">Relação Tempo × Desfecho</h2>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Desfecho</th>
                          <th>Qtd</th>
                          <th>Tempo Total Médio</th>
                          <th>Tempo Ativo Médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.tempoDesfecho.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ color: 'var(--text-secondary)' }}>
                              Sem atendimentos registrados para o filtro atual.
                            </td>
                          </tr>
                        ) : (
                          analise.tempoDesfecho.map((td) => (
                            <tr key={td.desfecho}>
                              <td>{labelDesfecho(td.desfecho)}</td>
                              <td className="mono">{td.quantidade}</td>
                              <td className="mono">{formatMs(td.tempoTotal.media)}</td>
                              <td className="mono">{formatMs(td.tempoAtivo.media)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card">
                  <div className="card-header">
                    <h2 className="card-title">Motivos de Desistência (Lista Fechada)</h2>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Motivo</th>
                          <th>Qtd</th>
                          <th>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analise.motivosAbandono.length === 0 ? (
                          <tr>
                            <td colSpan={3} style={{ color: 'var(--text-secondary)' }}>
                              Nenhuma desistência registrada neste recorte.
                            </td>
                          </tr>
                        ) : (
                          analise.motivosAbandono.map((m) => (
                            <tr key={m.codigo}>
                              <td>{m.codigo}</td>
                              <td className="mono">{m.quantidade}</td>
                              <td className="mono">{m.percentual ?? 0}%</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )
        )}
      </div>
    </>
  );
}
