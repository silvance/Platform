export function ViewerError({ message }: { message: string }) {
  return (
    <div
      className="card"
      style={{
        borderColor: "var(--status-bad-border)",
        background: "var(--status-bad-bg)",
        color: "var(--status-bad-fg)",
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
