export default function RootXBadge() {

  return (

    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#050816",
        border: "1px solid rgba(0,255,156,0.3)",
        borderRadius: "10px",
        padding: "14px 18px",
        zIndex: 9999,
        boxShadow: "0 0 20px rgba(0,255,156,0.15)",
        fontFamily: "monospace",
      }}
    >

      <div
        style={{
          color: "#00FF9C",
          fontSize: "0.8rem",
          fontWeight: "bold",
          marginBottom: "6px",
        }}
      >
        🛡 Protected by RootX
      </div>

      <div
        style={{
          color: "#94a3b8",
          fontSize: "0.7rem",
        }}
      >
        Live Threat Monitoring Active
      </div>

    </div>

  );

}