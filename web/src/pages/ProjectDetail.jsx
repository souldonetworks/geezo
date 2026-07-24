import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRoadmap, getGit } from '../api';
import RoadmapTree from '../components/RoadmapTree';
import GitMilestonePanel from '../components/GitMilestonePanel';
import RunningNowPanel from '../components/RunningNowPanel';

export default function ProjectDetail() {
  const { id } = useParams();
  const [roadmap, setRoadmap] = useState(null);
  const [git, setGit] = useState(null);

  useEffect(() => {
    getRoadmap(id).then(setRoadmap);
    getGit(id).then(setGit);
  }, [id]);

  return (
    <>
      <div className="page-header">
        <h1>project detail</h1>
      </div>
      <div className="page-content">
        <div className="card">
          <h3>running now</h3>
          <RunningNowPanel projectId={id} />
        </div>
        <div className="card">
          <h3>milestone</h3>
          <GitMilestonePanel git={git} />
        </div>
        <div className="card">
          <h3>roadmap</h3>
          <RoadmapTree roadmap={roadmap} />
        </div>
      </div>
    </>
  );
}
