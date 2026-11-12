import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../services/api';
import { ConfiguracaoEstatistica } from '../../types/funil';

export function ConfiguracoesPage() {
  const [cfg, setCfg] = useState<ConfiguracaoEstatistica | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .obterConfiguracoes()
      .then(setCfg)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar configurações.'));
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg) return;
    setErro(null);
    setSalvo(false);
    try {
      const updated = await api.atualizarConfiguracoes({
        janelaPadrao: cfg.janelaPadrao,
        kDesvios: cfg.kDesvios,
        minBaseline: cfg.minBaseline,
        minJanela: cfg.minJanela,
        timeoutAbandonoS: cfg.timeoutAbandonoS,
      });
      setCfg(updated);
      setSalvo(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    }
  };

  return (
    <>
      <header className="topbar">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>Configurações Estatísticas</h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Parâmetros determinísticos do detector de gargalos e timeout de sessões
          </div>
        </div>
      </header>

      <div className="page-content">
        {erro && <div className="alert-banner">{erro}</div>}
        {salvo && (
          <div className="card" style={{ borderColor: 'rgba(16,185,129,0.45)', color: '#34d399' }}>
            Parâmetros atualizados com sucesso.
          </div>
        )}

        {cfg && (
          <form className="card" onSubmit={(e) => void salvar(e)}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
                marginBottom: 20,
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                Tamanho da Janela Recente (N sessões)
                <input
                  type="number"
                  className="input"
                  min={3}
                  max={500}
                  value={cfg.janelaPadrao}
                  onChange={(e) => setCfg({ ...cfg, janelaPadrao: Number(e.target.value) })}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                Sensibilidade (k desvios-padrão)
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  min={0.5}
                  max={10}
                  value={cfg.kDesvios}
                  onChange={(e) => setCfg({ ...cfg, kDesvios: Number(e.target.value) })}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                Mínimo de Amostras Históricas
                <input
                  type="number"
                  className="input"
                  min={2}
                  max={500}
                  value={cfg.minBaseline}
                  onChange={(e) => setCfg({ ...cfg, minBaseline: Number(e.target.value) })}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                Mínimo de Observações Recentes
                <input
                  type="number"
                  className="input"
                  min={1}
                  max={200}
                  value={cfg.minJanela}
                  onChange={(e) => setCfg({ ...cfg, minJanela: Number(e.target.value) })}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                Timeout de Abandono (segundos)
                <input
                  type="number"
                  className="input"
                  min={60}
                  max={86400}
                  value={cfg.timeoutAbandonoS}
                  onChange={(e) => setCfg({ ...cfg, timeoutAbandonoS: Number(e.target.value) })}
                />
              </label>
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={15} /> Salvar Parâmetros
            </button>
          </form>
        )}
      </div>
    </>
  );
}
