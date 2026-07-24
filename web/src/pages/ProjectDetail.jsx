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
    <div style={{ padding: '1rem' }}>
      <h1>Project Detail</h1>
      <section>
        <h2>Running Now</h2>
        <RunningNowPanel projectId={id} />
      </section>
      <section>
        <h2>Milestone</h2>
        <GitMilestonePanel git={git} />
      </section>
      <section>
        <h2>Roadmap</h2>
        <RoadmapTree roadmap={roadmap} />
      </section>
    </div>
  );
}
