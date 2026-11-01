import { useEffect, useState } from "react";
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
  }, [id]);

  return (
    <>
      <div className="detail-heading">
        <Link to="/briefings" className="back-link">
          ← Executive briefings
        </Link>
        <p className="eyebrow">PROJECT INTELLIGENCE</p>
        <h1>{project?.name || "Project detail"}</h1>
        <p className="page-description">
          Purpose, evidence and delivery — with the unknowns in view.
        </p>
      </div>
      <div className="page-content">
        <ProjectMetadataPanel key={id} projectId={id} />
        <ExecutiveBriefPanel key={id} projectId={id} refreshKey={refreshKey} />
        <AnalysisPanel
          key={id}
          projectId={id}
          onCompleted={() => setRefreshKey((k) => k + 1)}
        />
        <GsdMigrationPanel
          key={id}
          projectId={id}
          onChanged={() => {
            getRoadmap(id)
              .then(setRoadmap)
              .catch((e) => setRoadmapError(e.message));
            getGit(id)
              .then(setGit)
              .catch((e) => setGitError(e.message));
          }}
        />
        <div className="card">
          <h3>running now</h3>
          <RunningNowPanel projectId={id} />
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
