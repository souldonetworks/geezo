const MESSAGES = {
  'not-a-repo': 'Not a git repository.',
  'no-remote': 'No remote configured.',
  'no-tags': 'No tags pushed yet.',
};

export default function GitMilestonePanel({ git }) {
  if (!git) return null;
  if (git.status !== 'ok') {
    return <p className="empty-state">{MESSAGES[git.status] || 'Unknown git state.'}</p>;
  }
  return (
    <div className="stat" style={{ display: 'block' }}>
      <span className="badge">{git.tag}</span>
      <div style={{ marginTop: 'var(--gap-xs)' }}>{git.message}</div>
      <div className="empty-state" style={{ marginTop: 'var(--gap-xs)' }}>
        {git.date}
      </div>
      <p>Commit <code>{git.commitSha}</code></p>
    </div>
  );
}
