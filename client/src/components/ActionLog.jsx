export default function ActionLog({ entries }) {
  if (!entries?.length) return null;

  return (
    <div className="action-log">
      {[...entries].reverse().map((entry, i) => (
        <div key={`${entry.at}-${i}`} className={`action-log-entry ${entry.type || ''}`}>
          {entry.message}
        </div>
      ))}
    </div>
  );
}
