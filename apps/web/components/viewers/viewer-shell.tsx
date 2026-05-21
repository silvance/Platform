export function ViewerError({ message }: { message: string }) {
  return (
    <div
      className="card"
      style={{
        borderColor: "rgba(248, 113, 113, 0.45)",
        background: "rgba(248, 113, 113, 0.06)",
        color: "#f8b4b4",
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
