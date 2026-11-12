import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { AtendimentosPage } from './pages/atendimentos/AtendimentosPage';
import { ConfiguracoesPage } from './pages/configuracoes/ConfiguracoesPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OrcamentadorPage } from './pages/orcamentador/OrcamentadorPage';
import { SimulacaoPage } from './pages/simulacao/SimulacaoPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/orcamentador" replace />} />
        <Route path="/orcamentador" element={<OrcamentadorPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="atendimentos" element={<AtendimentosPage />} />
          <Route path="simulacao" element={<SimulacaoPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/orcamentador" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
