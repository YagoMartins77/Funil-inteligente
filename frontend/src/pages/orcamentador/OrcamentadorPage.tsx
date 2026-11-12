import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  MOTIVOS_ESPERA_OFICINA,
  MOTIVOS_PAUSA,
  useOrcamentador,
} from '../../hooks/useOrcamentador';
import { formatClockMs } from '../../utils/format';

export function OrcamentadorPage() {
  const {
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
  } = useOrcamentador();

  const [painelModal, setPainelModal] = useState<'pausa' | 'oficina' | 'desfecho' | null>(null);
  const [desfechoSelecionado, setDesfechoSelecionado] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="tablet-shell">
        <div className="tablet-body">
          <div className="card">Carregando Orçamentador FASTCAR...</div>
        </div>
      </div>
    );
  }

  const etapaAtual = etapas.find((e) => e.ordem === sessao?.etapaOrdem);
  const desfechoDef = desfechos.find((d) => d.codigo === desfechoSelecionado);

  return (
    <div className="tablet-shell">
      <header className="tablet-header">
        <div className="brand">
          <div className="brand-mark">FC</div>
          <div>
            <div className="brand-title">FASTCAR Balcão</div>
            <div className="brand-sub">Orçamentador Tátil — 5 Etapas</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sessao && (
            <>
              <span className="badge badge-red mono">ID #{sessao.atendimentoId}</span>
              <span className="badge mono">
                <Clock size={13} /> {formatClockMs(elapsedMs)}
              </span>
            </>
          )}
          <Link to="/dashboard" className="btn" style={{ textDecoration: 'none' }}>
            Painel Gerencial
          </Link>
        </div>
      </header>

      <main className="tablet-body">
        {erro && (
          <div className="alert-banner">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} /> {erro}
            </span>
            <button className="btn" onClick={() => setErro(null)}>
              Fechar
            </button>
          </div>
        )}

        {feedback && !erro && (
          <div className="card" style={{ borderColor: 'rgba(16,185,129,0.4)', padding: '10px 16px' }}>
            <span style={{ fontSize: 13, color: '#34d399' }}>{feedback}</span>
          </div>
        )}

        {!sessao ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            {ultimoDesfecho && (
              <div
                style={{
                  marginBottom: 24,
                  padding: 16,
                  borderRadius: 10,
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.35)',
                }}
              >
                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: 4 }}>
                  Atendimento #{ultimoDesfecho.atendimentoId} encerrado
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Desfecho registrado: {ultimoDesfecho.desfechoNome}
                </div>
              </div>
            )}

            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              Pronto para novo atendimento presencial
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
              Nenhum dado pessoal do cliente é solicitado. O cronômetro de telemetria inicia
              automaticamente ao tocar abaixo.
            </p>
            <button
              className="btn btn-primary btn-tablet"
              style={{ minWidth: 280 }}
              onClick={() => void iniciarAtendimento()}
            >
              <Play size={20} /> Iniciar Novo Atendimento
            </button>
          </div>
        ) : (
          <>
            {/* Barra de progresso das 5 etapas */}
            <div className="stepper" aria-label="Progresso das 5 etapas">
              {etapas.map((et) => {
                const isCurrent = et.ordem === sessao.etapaOrdem;
                const isDone = et.ordem < sessao.etapaOrdem;
                return (
                  <div
                    key={et.ordem}
                    className={`step-pill ${isCurrent ? 'current' : ''} ${isDone ? 'done' : ''}`}
                  >
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      ETAPA 0{et.ordem}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{et.nome}</span>
                  </div>
                );
              })}
            </div>

            {/* Estado ativo de Pausa ou Espera Técnica */}
            {sessao.emPausa && (
              <div
                className="card"
                style={{
                  borderColor: 'var(--status-warn)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--status-warn)' }}>
                    Pausa Operacional em Andamento
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    O tempo de pausa é contabilizado separadamente do tempo ativo.
                  </div>
                </div>
                <button className="btn btn-primary btn-tablet" onClick={() => void finalizarPausa()}>
                  <Play size={18} /> Retomar Atendimento
                </button>
              </div>
            )}

            {sessao.emEsperaOficina && (
              <div
                className="card"
                style={{
                  borderColor: 'var(--red-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--red-highlight)' }}>
                    Aguardando Retorno Técnico da Oficina
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Período isolado para não distorcer métricas de produtividade do balcão.
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-tablet"
                  onClick={() => void finalizarEsperaOficina()}
                >
                  <CheckCircle2 size={18} /> Oficina Respondeu
                </button>
              </div>
            )}

            {/* Cartão da etapa atual */}
            <div className="card" style={{ padding: 24 }}>
              <div className="card-header">
                <div>
                  <span className="badge badge-red mono">ETAPA {etapaAtual?.ordem} DE 5</span>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{etapaAtual?.nome}</h2>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                {etapaAtual?.descricao}
              </p>

              {/* Navegação principal */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {sessao.etapaOrdem > 1 && (
                  <button
                    className="btn btn-tablet"
                    disabled={sessao.emPausa || sessao.emEsperaOficina}
                    onClick={() => void transicionarEtapa(sessao.etapaOrdem - 1)}
                  >
                    <ArrowLeft size={18} /> Voltar Etapa
                  </button>
                )}

                {sessao.etapaOrdem < 5 ? (
                  <button
                    className="btn btn-primary btn-tablet"
                    style={{ flex: 1 }}
                    disabled={sessao.emPausa || sessao.emEsperaOficina}
                    onClick={() => void transicionarEtapa(sessao.etapaOrdem + 1)}
                  >
                    Avançar para Etapa {sessao.etapaOrdem + 1} <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-tablet"
                    style={{ flex: 1 }}
                    disabled={sessao.emPausa || sessao.emEsperaOficina}
                    onClick={() => {
                      setDesfechoSelecionado(null);
                      setPainelModal('desfecho');
                    }}
                  >
                    <CheckCircle2 size={18} /> Registrar Desfecho Final
                  </button>
                )}
              </div>
            </div>

            {/* Controles rápidos de balcão */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <button
                className="btn btn-tablet"
                disabled={sessao.emPausa || sessao.emEsperaOficina}
                onClick={() => setPainelModal(painelModal === 'pausa' ? null : 'pausa')}
              >
                <Pause size={18} /> Pausa Operacional
              </button>

              <button
                className="btn btn-outline-red btn-tablet"
                disabled={sessao.emPausa || sessao.emEsperaOficina}
                onClick={() => setPainelModal(painelModal === 'oficina' ? null : 'oficina')}
              >
                <Wrench size={18} /> Espera da Oficina
              </button>

              <button
                className="btn btn-tablet"
                disabled={sessao.emPausa || sessao.emEsperaOficina}
                onClick={() => {
                  setDesfechoSelecionado(null);
                  setPainelModal(painelModal === 'desfecho' ? null : 'desfecho');
                }}
              >
                <XCircle size={18} /> Encerrar / Desistência
              </button>
            </div>

            {/* Painel de seleção fechada (Pausa) */}
            {painelModal === 'pausa' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Selecionar Motivo da Pausa</span>
                  <button className="btn" onClick={() => setPainelModal(null)}>
                    Cancelar
                  </button>
                </div>
                <div className="option-grid">
                  {MOTIVOS_PAUSA.map((m) => (
                    <button
                      key={m.codigo}
                      className="option-btn"
                      onClick={() => {
                        setPainelModal(null);
                        void iniciarPausa(m.codigo);
                      }}
                    >
                      {m.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Painel de seleção fechada (Espera Oficina) */}
            {painelModal === 'oficina' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Motivo da Consulta à Oficina</span>
                  <button className="btn" onClick={() => setPainelModal(null)}>
                    Cancelar
                  </button>
                </div>
                <div className="option-grid">
                  {MOTIVOS_ESPERA_OFICINA.map((m) => (
                    <button
                      key={m.codigo}
                      className="option-btn"
                      onClick={() => {
                        setPainelModal(null);
                        void iniciarEsperaOficina(m.codigo);
                      }}
                    >
                      {m.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Painel de Desfecho e Motivos Fechados */}
            {painelModal === 'desfecho' && (
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Registrar Desfecho do Atendimento</span>
                  <button className="btn" onClick={() => setPainelModal(null)}>
                    Cancelar
                  </button>
                </div>

                <div className="option-grid" style={{ marginBottom: 16 }}>
                  {desfechos.map((d) => (
                    <button
                      key={d.codigo}
                      className={`option-btn ${desfechoSelecionado === d.codigo ? 'selected' : ''}`}
                      onClick={() => {
                        if (!d.exigeMotivo) {
                          setPainelModal(null);
                          void encerrarComDesfecho(d.codigo, null);
                        } else {
                          setDesfechoSelecionado(d.codigo);
                        }
                      }}
                    >
                      {d.nome}
                    </button>
                  ))}
                </div>

                {desfechoDef?.exigeMotivo && (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        marginBottom: 10,
                      }}
                    >
                      Selecione o motivo padronizado (LGPD — sem texto livre)
                    </div>
                    <div className="option-grid">
                      {motivos.map((m) => (
                        <button
                          key={m.codigo}
                          className="option-btn"
                          onClick={() => {
                            setPainelModal(null);
                            void encerrarComDesfecho(desfechoDef.codigo, m.codigo);
                          }}
                        >
                          {m.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
