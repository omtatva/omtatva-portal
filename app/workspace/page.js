"use client";
export default function WorkspacePage() {
    const aiTools = [
      {
        title: "Frameo Workspace",
        icon: "🚀",
        description: "Internal AI Workspace",
        badge: "Internal",
        color: "#2563eb",
        action: () => (window.location.href = "/workspace/Frameo"),
      },
      {
        title: "Higgsfield",
        icon: "🎬",
        description: "AI Filmmaking Platform",
        badge: "External",
        color: "#8b5cf6",
        action: () => window.open("https://higgsfield.ai", "_blank"),
      },
      {
        title: "ChatGPT",
        icon: "🤖",
        description: "AI Assistant",
        badge: "Popular",
        color: "#10b981",
        action: () => window.open("https://chat.openai.com", "_blank"),
      },
      {
        title: "Gemini",
        icon: "✨",
        description: "Google AI",
        badge: "New",
        color: "#f59e0b",
        action: () => window.open("https://gemini.google.com", "_blank"),
      },
    ];
  return (

    
<div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 2fr",
    gap: "20px",
    marginBottom: "30px",
  }}
>
  {/* Slack */}
  <div
    style={{
      background: "#fff",
      padding: "25px",
      borderRadius: "15px",
      boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
    }}
  >
    <h2>💬 Communication</h2>


    <a
      href="https://app.slack.com/client"
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        marginTop: "20px",
        textDecoration: "none",
        background: "#4A154B",
        color: "#fff",
        padding: "18px",
        borderRadius: "12px",
        textAlign: "center",
        fontWeight: "600",
        fontSize: "16px",
      }}
    >
      Open Slack
    </a>

    <p
      style={{
        marginTop: "15px",
        color: "#64748b",
        textAlign: "center",
      }}
    >
      Team Chat • Huddles • Meetings
    </p>
  </div>

  {/* AI Workspace */}
<div
  style={{
    background: "#fff",
    padding: "25px",
    borderRadius: "15px",
    boxShadow: "0 5px 20px rgba(0,0,0,0.08)",
  }}
>
  <h2 style={{ marginBottom: 20 }}>🤖 AI Workspace</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
      gap: "18px",
    }}
  >
    {aiTools.map((tool, index) => (
      <div
        key={index}
        onClick={tool.action}
        style={{
  background: "#F8FAFC",
  color: "#1E293B",
  borderRadius: "18px",
  padding: "22px",
  cursor: "pointer",
  border: "1px solid #E2E8F0",
  transition: "all 0.3s ease",
  boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
}}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-6px)";
          e.currentTarget.style.boxShadow =
          "0 15px 30px rgba(0,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "55px",
              height: "55px",
              borderRadius: "14px",
              background: tool.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            {tool.icon}
          </div>

          <span
            style={{
              background: tool.color,
              padding: "5px 10px",
              borderRadius: "20px",
              fontSize: "12px",
            }}
          >
            {tool.badge}
          </span>
        </div>

        <h3 style={{ marginTop: 20 }}>{tool.title}</h3>

        <p
  style={{
    color: "#64748B",
    marginTop: 10,
    lineHeight: "1.6",
  }}
>
          {tool.description}
        </p>
      </div>
    ))}
  </div>
</div>
</div>
  );
}