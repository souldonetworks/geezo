import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { getRoadmap, getGit, listBriefings } from "../api";
import RoadmapTree from "../components/RoadmapTree";
import GitMilestonePanel from "../components/GitMilestonePanel";
import GsdMigrationPanel from "../components/GsdMigrationPanel";
import ExecutiveBriefPanel from "../components/ExecutiveBriefPanel";
import AnalysisPanel from "../components/AnalysisPanel";
import ProjectMetadataPanel from "../components/ProjectMetadataPanel";
import RunningNowPanel from "../components/RunningNowPanel";

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [git, setGit] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const refreshProject = useCallback(() => setDataRefreshKey(k => k + 1), []);
  const [roadmapError, setRoadmapError] = useState("");
  const [gitError, setGitError] = useState("");

  useEffect(() => {
    let live = true;
    listBriefings()
      .then((data) => live && setProject(data.find((p) => p.id === id)))
      .catch(() => {});
    setRoadmap(null);
    setGit(null);
    setRoadmapError("");
    setGitError("");
    getRoadmap(id)
      .then((data) => live && setRoadmap(data))
      .catch((e) => live && setRoadmapError(e.message));
    getGit(id)
      .then((data) => live && setGit(data))
      .catch((e) => live && setGitError(e.message));
    return () => {
      live = false;
    };
  }, [id, dataRefreshKey]);

  return (
    <>
      <div className="detail-heading">
        <Link to="/briefings" className="back-link">
          ← Executive briefings
        </Link>
        <p className="eyebrow">PROJECT INTELLIGENCE</p>
        <h1>{project?.name || "Project detail"}</h1>
        <button className="btn btn-secondary" onClick={refreshProject}>Refresh project</button>
        <p className="page-description">
          Purpose, evidence and delivery — with the unknowns in view.
        </p>
      </div>
      <div className="page-content">
        <ProjectMetadataPanel key={`metadata:${id}`} projectId={id} />
        <ExecutiveBriefPanel key={`brief:${id}`} projectId={id} refreshKey={refreshKey} />
        <AnalysisPanel
          key={`analysis:${id}`}
          projectId={id}
          onCompleted={() => setRefreshKey((k) => k + 1)}
        />
        <GsdMigrationPanel
          key={`migration:${id}`}
          projectId={id}
          onChanged={refreshProject}
        />
        <div className="card">
          <h3>running now</h3>
          <RunningNowPanel key={id} projectId={id} onCompleted={refreshProject} />
        </div>
        <div className="card">
          <h3>milestone</h3>
          {gitError ? (
            <p role="alert">{gitError}</p>
          ) : (
            <GitMilestonePanel git={git} />
          )}
        </div>
        <div className="card">
          <h3>roadmap</h3>
          {roadmapError ? (
            <p role="alert">{roadmapError}</p>
          ) : (
            <RoadmapTree roadmap={roadmap} />
          )}
        </div>
      </div>
    </>
  );
}
