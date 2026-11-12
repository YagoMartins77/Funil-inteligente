import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { api } from '../../services/api';
import { Atendimento, IntervaloOperacional, VisitaEtapa } from '../../types/funil';
import { formatDateTime, formatMs, labelDesfecho } from '../../utils/format';

export function AtendimentosPage() {
  const [sinteticas, setSinteticas] = useState(false);
  const [desfecho, setDesfecho] = useState('');
  const [page, setPage] = useState(1);
  const [itens, setItens] = useState<Atendimento[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [detalhe, setDetalhe] = useState<
    | (Atendimento & {
        visitas: VisitaEtapa[];
        pausas: IntervaloOperacional[];
        esperasOficina: IntervaloOperacional[];
      })
    | null
  >(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await api.listarAtendimentos({
        sinteticas,
        desfecho: desfecho || undefined,
        page,
        limit: 15,
      });
      setItens(res.itens);
      setTotalPaginas(res.paginacao.totalPaginas);
      setTotal(res.paginacao.total);
    } finally {
      setCarregando(false);
    }
  }, [sinteticas, desfecho, page]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirDetalhe = async (id: number) => {
    const res = await api.obterAtendimento(id);
    setDetalhe(res);
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>Histórico de Atendimentos</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Registros anônimos sem dados pessoais (LGPD) — {total} atendimentos
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="select"
            value={sinteticas ? 'sintetico' : 'real'}
            onChange={(e) => {
              setPage(1);
              setSinteticas(e.target.value === 'sintetico');
            }}
          >
            <option value="real">Dados Reais</option>
            <option value="sintetico">Dados Sintéticos</option>
          </select>

          <select
            className="select"
            value={desfecho}
            onChange={(e) => {
              setPage(1);
              setDesfecho(e.target.value);
            }}
          >
            <option value="">Todos os desfechos</option>
            <option value="convertido">Convertido</option>
            <option value="desistiu">Desistiu</option>
            <option value="nao_fechou">Não fechou</option>
            <option value="interrompido">Interrompido</option>
          </select>
        </div>
      </header>

      <div className="page-content">
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID Anônimo</th>
                  <th>Data / Hora</th>
                  <th>Etapa Atual</th>
                  <th>Tempo Total</th>
                  <th>Tempo Ativo</th>
                  <th>Espera Ofic.</th>
                  <th>Desfecho</th>
                  <th>Tipo</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {carregando ? (
                  <tr>
                    <td colSpan={9}>Carregando atendimentos...</td>
                  </tr>
                ) : itens.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ color: 'var(--text-secondary)' }}>
                      Nenhum atendimento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  itens.map((a) => (
                    <tr key={a.id}>
                      <td className="mono">#{a.id}</td>
                      <td>{formatDateTime(a.iniciadoEm)}</td>
                      <td className="mono">Etapa {a.etapaAtualOrdem}/5</td>
                      <td className="mono">{formatMs(a.tempoTotalMs)}</td>
                      <td className="mono">{formatMs(a.tempoAtivoMs)}</td>
                      <td className="mono">{formatMs(a.tempoEsperaOficinaMs)}</td>
                      <td>
                        <span
                          className={`badge ${
                            a.desfechoCodigo === 'convertido'
                              ? 'badge-ok'
                              : a.desfechoCodigo
                                ? 'badge-red'
                                : 'badge-warn'
                          }`}
                        >
                          {labelDesfecho(a.desfechoCodigo)}
                        </span>
                      </td>
                      <td>
                        <span className="badge">{a.sintetica ? 'Sintético' : 'Real'}</span>
                      </td>
                      <td>
                        <button className="btn" onClick={() => void abrirDetalhe(a.id)}>
                          <Eye size={14} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Página {page} de {totalPaginas}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                className="btn"
                disabled={page >= totalPaginas}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        </div>

        {detalhe && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Linha do Tempo — Atendimento #{detalhe.id}</h2>
                <div className="card-subtitle">
                  Status: {detalhe.status} | Desfecho: {labelDesfecho(detalhe.desfechoCodigo)}
                  {detalhe.motivoDesistenciaCodigo
                    ? ` (${detalhe.motivoDesistenciaCodigo})`
                    : ''}
                </div>
              </div>
              <button className="btn" onClick={() => setDetalhe(null)}>
                Fechar
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ordem</th>
                    <th>Etapa</th>
                    <th>Total</th>
                    <th>Ativo</th>
                    <th>Pausa</th>
                    <th>Espera Oficina</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.visitas.map((v) => (
                    <tr key={v.id}>
                      <td className="mono">{v.ordem}</td>
                      <td>{v.etapaSlug}</td>
                      <td className="mono">{formatMs(v.tempoTotalMs)}</td>
                      <td className="mono">{formatMs(v.tempoAtivoMs)}</td>
                      <td className="mono">{formatMs(v.tempoPausaMs)}</td>
                      <td className="mono">{formatMs(v.tempoEsperaOficinaMs)}</td>
                      <td>{v.resultado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
