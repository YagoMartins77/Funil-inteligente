import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { Etapa, ExecucaoSimulacao } from '../../types/funil';
import { formatDateTime } from '../../utils/format';

export function SimulacaoPage() {
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [regulares, setRegulares] = useState(80);
  const [anomalas, setAnomalas] = useState(20);
  const [etapaAnomalia, setEtapaAnomalia] = useState(2);
  const [semente, setSemente] = useState(42);
  const [limparAntes, setLimparAntes] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
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
  } | null>(null);
  const [historico, setHistorico] = useState<ExecucaoSimulacao[]>([]);

  const carregar = useCallback(async () => {
    const [etRes, histRes] = await Promise.all([
      api.listarEtapas(),
      api.listarHistoricoSimulacao(),
    ]);
    setEtapas(etRes);
    setHistorico(histRes);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const rodarSimulacao = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecutando(true);
    setErro(null);
    setMensagem(null);
    try {
      const res = await api.executarSimulacao({
        regulares,
        anomalas,
        etapaAnomalia,
        semente,
        limparAntes,
      });
      setResultado({ execucao: res.execucao, comparacao: res.comparacao });
      setMensagem(
        `Simulação concluída: ${res.execucao.totalSessoes} sessões geradas (sintetica: true).`,
      );
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao executar simulação.');
    } finally {
      setExecutando(false);
    }
  };

  const limparSinteticos = async () => {
    setErro(null);
    const res = await api.limparSinteticos();
    setMensagem(
      `${res.atendimentosRemovidos} atendimentos sintéticos removidos. Dados reais preservados.`,
    );
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>Simulação & Homologação Estatística</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Geração de sessões sintéticas isoladas (sintetica: true) para validação do detector de
            anomalias
          </div>
        </div>
        <button className="btn btn-outline-red" onClick={() => void limparSinteticos()}>
          <Trash2 size={14} /> Limpar Apenas Dados Sintéticos
        </button>
      </header>

      <div className="page-content">
        {erro && <div className="alert-banner">{erro}</div>}
        {mensagem && (
          <div className="card" style={{ borderColor: 'rgba(16,185,129,0.45)', color: '#34d399' }}>
            {mensagem}
          </div>
        )}

        <form className="card" onSubmit={(e) => void rodarSimulacao(e)}>
          <div className="card-header">
            <h2 className="card-title">Configurar Cenário Sintético</h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginBottom: 16,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              Atendimentos Regulares
              <input
                type="number"
                className="input"
                min={0}
                max={2000}
                value={regulares}
                onChange={(e) => setRegulares(Number(e.target.value))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              Atendimentos com Anomalia
              <input
                type="number"
                className="input"
                min={0}
                max={2000}
                value={anomalas}
                onChange={(e) => setAnomalas(Number(e.target.value))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              Etapa da Lentidão Induzida
              <select
                className="select"
                value={etapaAnomalia}
                onChange={(e) => setEtapaAnomalia(Number(e.target.value))}
              >
                {etapas.map((et) => (
                  <option key={et.ordem} value={et.ordem}>
                    {et.ordem}. {et.nome}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              Semente Aleatória (Seed)
              <input
                type="number"
                className="input"
                value={semente}
                onChange={(e) => setSemente(Number(e.target.value))}
              />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={limparAntes}
                onChange={(e) => setLimparAntes(e.target.checked)}
              />
              Limpar dados sintéticos anteriores antes de gerar
            </label>

            <button type="submit" className="btn btn-primary" disabled={executando}>
              <FlaskConical size={15} /> {executando ? 'Executando...' : 'Executar Simulação'}
            </button>
          </div>
        </form>

        {resultado && (
          <section className="kpi-grid">
            <div className="kpi-card accent">
              <span className="kpi-label">Precisão</span>
              <span className="kpi-value">{(resultado.comparacao.precisao * 100).toFixed(0)}%</span>
              <span className="kpi-meta">Falsos positivos: {resultado.comparacao.falsosPositivos}</span>
            </div>
            <div className="kpi-card accent">
              <span className="kpi-label">Revocação</span>
              <span className="kpi-value">{(resultado.comparacao.revocacao * 100).toFixed(0)}%</span>
              <span className="kpi-meta">Falsos negativos: {resultado.comparacao.falsosNegativos}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Etapa Esperada</span>
              <span className="kpi-value">
                {resultado.comparacao.etapasEsperadas.join(', ') || 'Nenhuma'}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Etapa Detectada</span>
              <span className="kpi-value">
                {resultado.comparacao.etapasDetectadas.join(', ') || 'Nenhuma'}
              </span>
            </div>
          </section>
        )}

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Histórico de Execuções</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data</th>
                  <th>Seed</th>
                  <th>Total</th>
                  <th>Etapa Alvo</th>
                  <th>Precisão</th>
                  <th>Revocação</th>
                  <th>Falsos Positivos</th>
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ color: 'var(--text-secondary)' }}>
                      Nenhuma simulação executada ainda.
                    </td>
                  </tr>
                ) : (
                  historico.map((h) => (
                    <tr key={h.id}>
                      <td className="mono">#{h.id}</td>
                      <td>{formatDateTime(h.criadoEm)}</td>
                      <td className="mono">{h.semente}</td>
                      <td className="mono">
                        {h.totalSessoes} ({h.regulares}+{h.anomalas})
                      </td>
                      <td className="mono">Etapa {h.etapaAnomalia}</td>
                      <td className="mono">{(h.precisao * 100).toFixed(0)}%</td>
                      <td className="mono">{(h.revocacao * 100).toFixed(0)}%</td>
                      <td className="mono">{h.falsosPositivos}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
