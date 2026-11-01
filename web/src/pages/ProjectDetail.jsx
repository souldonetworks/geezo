import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getRoadmap, getGit } from "../api";
import RoadmapTree from "../components/RoadmapTree";
import GitMilestonePanel from "../components/GitMilestonePanel";
import GsdMigrationPanel from "../components/GsdMigrationPanel";
import ExecutiveBriefPanel from "../components/ExecutiveBriefPanel";
import AnalysisPanel from "../components/AnalysisPanel";
import RunningNowPanel from "../components/RunningNowPanel";

export default function ProjectDetail() {
  const { id } = useParams();
  const [roadmap, setRoadmap] = useState(null);
  const [git, setGit] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [roadmapError, setRoadmapError] = useState("");
  const [gitError, setGitError] = useState("");

  useEffect(() => {
    let live = true;
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
      <div className="page-header">
        <h1>project detail</h1>
      </div>
      <div className="page-content">
        <ExecutiveBriefPanel projectId={id} refreshKey={refreshKey} />
        <AnalysisPanel
          projectId={id}
          onCompleted={() => setRefreshKey((k) => k + 1)}
        />
        <GsdMigrationPanel
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
