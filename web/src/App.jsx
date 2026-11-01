import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import geezo from "./assets/geezo.png";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import SettingsPage from "./pages/SettingsPage";
import BriefingsPage from "./pages/BriefingsPage";
import AllInPage from "./pages/AllInPage";
import AssessmentLensesPage from "./pages/AssessmentLensesPage";
import RelatedProjectsPage from "./pages/RelatedProjectsPage";
function Shell() {
  const location = useLocation();
  const section = location.pathname.startsWith("/all-in")
    ? "All In portfolio"
    : location.pathname.startsWith("/lenses")
      ? "Assessment lenses"
      : location.pathname.startsWith("/briefings")
        ? "Executive briefings"
        : location.pathname.startsWith("/settings")
          ? "Workspace settings"
          : location.pathname.startsWith("/discover")
            ? "Related projects"
            : location.pathname.startsWith("/project/")
              ? "Project intelligence"
              : "Project portfolio";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="Geezo home">
          <span className="mascot-frame">
            <img src={geezo} alt="Geezo character" width="104" height="104" />
          </span>
          <span className="brand-caption">
            A little oversight. A lot of clarity.
          </span>
        </Link>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {[
            ["/", "Portfolio", "01"],
            ["/all-in", "All In", "02"],
            ["/briefings", "Executive briefings", "03"],
            ["/discover", "Related projects", "04"],
            ["/lenses", "Assessment lenses", "05"],
            ["/settings", "Settings", "06"],
          ].map(([to, label, n]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <span className="nav-number" aria-hidden="true">
                {n}
              </span>
              {label}
              <span aria-hidden="true" className="nav-arrow">
                ↗
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" />
          Local workspace
          <p>
            Your projects. Their purpose.
            <br />
            The evidence behind the next decision.
          </p>
          <a href="https://souldo.net" target="_blank" rel="noreferrer">
            From the Souldo workshop ↗
          </a>
        </div>
      </aside>
      <div className="main">
        <header className="workspace-bar">
          <span>
            <span className="workspace-label">WORKSPACE</span>
            <span className="workspace-divider">/</span>
            {section}
          </span>
          <span className="workspace-status">
            <span className="status-dot" />
            LOCAL · PRIVATE
          </span>
        </header>
        <main id="main-content" tabIndex="-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/briefings" element={<BriefingsPage />} />
            <Route path="/project/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/discover" element={<RelatedProjectsPage />} />
            <Route path="/all-in" element={<AllInPage />} />
            <Route path="/lenses" element={<AssessmentLensesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
