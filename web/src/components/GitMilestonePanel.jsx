const MESSAGES = {
  'not-a-repo': 'Not a git repository.',
  'no-remote': 'No remote configured.',
  'no-tags': 'No tags pushed yet.',
};

export default function GitMilestonePanel({ git }) {
  if (!git) return null;
  if (git.status !== 'ok') {
    return <p>{MESSAGES[git.status] || 'Unknown git state.'}</p>;
  }
  return (
    <div>
      <strong>{git.tag}</strong> — {git.message}
      <div>{git.date}</div>
    </div>
  );
}
