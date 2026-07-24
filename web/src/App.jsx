import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import geezo from './assets/geezo.png';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import SettingsPage from './pages/SettingsPage';

function NavItem({ to, children, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      {children}
    </NavLink>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="sidebar">
          <div className="geezo-header">
            <img src={geezo} alt="Geezo" title="Still watching." />
            <div className="label">geezo</div>
          </div>
          <NavItem to="/" end>
            projects
          </NavItem>
          <NavItem to="/settings">settings</NavItem>
        </div>
        <div className="main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
