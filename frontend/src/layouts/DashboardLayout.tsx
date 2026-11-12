import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Settings,
  Tablet,
} from 'lucide-react';

export function DashboardLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">FC</div>
          <div>
            <div className="brand-title">FASTCAR</div>
            <div className="brand-sub">Telemetria de Funil</div>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegação gerencial">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={17} /> Visão Geral & Funil
          </NavLink>
          <NavLink
            to="/dashboard/atendimentos"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <ListChecks size={17} /> Atendimentos
          </NavLink>
          <NavLink
            to="/dashboard/simulacao"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <FlaskConical size={17} /> Simulação & Validação
          </NavLink>
          <NavLink
            to="/dashboard/configuracoes"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Settings size={17} /> Configurações
          </NavLink>

          <div className="nav-divider" />

          <NavLink to="/orcamentador" className="nav-link">
            <Tablet size={17} /> Orçamentador Tablet
          </NavLink>
        </nav>

        <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Activity size={13} color="#e10600" />
            <span>LGPD Privacy by Design</span>
          </div>
          <span>Dados anonimizados por ID</span>
        </div>
      </aside>

      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}
