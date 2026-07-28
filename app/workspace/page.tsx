"use client";

import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function WorkspacePage() {
  const today = new Date().toISOString().substring(0, 10);

  // Fire-and-forget usage log — never blocks or fails the tool opening.
  function logToolUsage(toolTitle: string) {
    const user = auth.currentUser;
    if (!user) return;

    addDoc(collection(db, "toolUsage"), {
      userId: user.uid,
      employeeName: user.displayName || "",
      email: user.email,
      tool: toolTitle,
      date: today,
      createdAt: serverTimestamp(),
    }).catch((error) => {
      console.log("Usage log failed:", error);
    });
  }

  function openTool(toolTitle: string, urlOrAction: string | (() => void)) {
    logToolUsage(toolTitle);

    if (typeof urlOrAction === "function") {
      urlOrAction();
    } else {
      window.open(urlOrAction, "_blank");
    }
  }

  const aiTools = [
    {
      title: "Frameo Workspace",
      icon: "🚀",
      description: "Internal AI Workspace",
      badge: "Internal",
      color: "#2563eb",
      action: () => openTool("Frameo Workspace", () => (window.location.href = "/workspace/Frameo")),
    },
    {
      title: "Veo 3",
      icon: "🎥",
      description: "Google's AI video generation model",
      badge: "External",
      color: "#4285f4",
      action: () => openTool("Veo 3", "https://labs.google/veo"),
    },
    {
      title: "Runway",
      icon: "🎞️",
      description: "AI video generation & editing suite",
      badge: "External",
      color: "#8b5cf6",
      action: () => openTool("Runway", "https://runwayml.com"),
    },
    {
      title: "Premiere Pro",
      icon: "🎬",
      description: "Adobe's professional video editor",
      badge: "External",
      color: "#00005b",
      action: () => openTool("Premiere Pro", "https://www.adobe.com/products/premiere.html"),
    },
    {
      title: "Higgsfield",
      icon: "🎬",
      description: "AI Filmmaking Platform",
      badge: "External",
      color: "#8b5cf6",
      action: () => openTool("Higgsfield", "https://higgsfield.ai"),
    },
    {
      title: "Midjourney",
      icon: "🖼️",
      description: "AI image generation",
      badge: "External",
      color: "#0f172a",
      action: () => openTool("Midjourney", "https://www.midjourney.com"),
    },
    {
      title: "ElevenLabs",
      icon: "🔊",
      description: "AI voice generation & cloning",
      badge: "External",
      color: "#0ea5a4",
      action: () => openTool("ElevenLabs", "https://elevenlabs.io"),
    },
    {
      title: "ChatGPT",
      icon: "🤖",
      description: "AI Assistant",
      badge: "Popular",
      color: "#10b981",
      action: () => openTool("ChatGPT", "https://chat.openai.com"),
    },
    {
      title: "Gemini",
      icon: "✨",
      description: "Google AI",
      badge: "New",
      color: "#f59e0b",
      action: () => openTool("Gemini", "https://gemini.google.com"),
    },
  ];

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-4">
      {/* PAGE HEADER */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 mb-6 border border-[#eaf3ff] shadow-sm">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
          🤖 AI Workspace
        </h1>
        <p className="text-base sm:text-lg text-[#444444] mt-3">
          All your communication and AI production tools, in one place.
        </p>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* COMMUNICATION */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#eaf3ff] shadow-sm">
          <h2 className="text-xl font-bold text-[#111]">💬 Communication</h2>

          <a
            href="https://app.slack.com/client"
            target="_blank"
            rel="noreferrer"
            onClick={() => logToolUsage("Slack")}
            className="
              block mt-5 text-center font-semibold text-base
              text-white bg-[#4A154B] rounded-xl px-5 py-4
              hover:opacity-90 transition
            "
          >
            Open Slack
          </a>

          <p className="mt-4 text-[#64748b] text-center text-sm">
            Team Chat • Huddles • Meetings
          </p>
        </div>

        {/* AI TOOLS */}
        <div className="xl:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-[#eaf3ff] shadow-sm">
          <h2 className="text-xl font-bold text-[#111] mb-5">
            🛠️ AI Production Tools
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {aiTools.map((tool, index) => (
              <button
                key={index}
                onClick={tool.action}
                className="
                  text-left bg-[#F8FAFC] text-[#1E293B] rounded-2xl p-5
                  border border-[#E2E8F0] shadow-sm
                  transition-all duration-300 ease-out
                  hover:-translate-y-1.5 hover:shadow-lg
                  cursor-pointer
                "
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: tool.color }}
                  >
                    {tool.icon}
                  </div>

                  <span
                    className="text-white text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ background: tool.color }}
                  >
                    {tool.badge}
                  </span>
                </div>

                <h3 className="mt-4 font-bold text-[#111827]">{tool.title}</h3>

                <p className="mt-2 text-[#64748B] text-sm leading-relaxed">
                  {tool.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



// "use client";

// export default function WorkspacePage() {
//   const aiTools = [
//     {
//       title: "Frameo Workspace",
//       icon: "🚀",
//       description: "Internal AI Workspace",
//       badge: "Internal",
//       color: "#2563eb",
//       action: () => (window.location.href = "/workspace/Frameo"),
//     },
//     {
//       title: "Veo 3",
//       icon: "🎥",
//       description: "Google's AI video generation model",
//       badge: "External",
//       color: "#4285f4",
//       action: () => window.open("https://labs.google/veo", "_blank"),
//     },
//     {
//       title: "Runway",
//       icon: "🎞️",
//       description: "AI video generation & editing suite",
//       badge: "External",
//       color: "#8b5cf6",
//       action: () => window.open("https://runwayml.com", "_blank"),
//     },
//     {
//       title: "Premiere Pro",
//       icon: "🎬",
//       description: "Adobe's professional video editor",
//       badge: "External",
//       color: "#00005b",
//       action: () =>
//         window.open("https://www.adobe.com/products/premiere.html", "_blank"),
//     },
//     {
//       title: "Higgsfield",
//       icon: "🎬",
//       description: "AI Filmmaking Platform",
//       badge: "External",
//       color: "#8b5cf6",
//       action: () => window.open("https://higgsfield.ai", "_blank"),
//     },
//     {
//       title: "Midjourney",
//       icon: "🖼️",
//       description: "AI image generation",
//       badge: "External",
//       color: "#0f172a",
//       action: () => window.open("https://www.midjourney.com", "_blank"),
//     },
//     {
//       title: "ElevenLabs",
//       icon: "🔊",
//       description: "AI voice generation & cloning",
//       badge: "External",
//       color: "#0ea5a4",
//       action: () => window.open("https://elevenlabs.io", "_blank"),
//     },
//     {
//       title: "ChatGPT",
//       icon: "🤖",
//       description: "AI Assistant",
//       badge: "Popular",
//       color: "#10b981",
//       action: () => window.open("https://chat.openai.com", "_blank"),
//     },
//     {
//       title: "Gemini",
//       icon: "✨",
//       description: "Google AI",
//       badge: "New",
//       color: "#f59e0b",
//       action: () => window.open("https://gemini.google.com", "_blank"),
//     },
//   ];

//   return (
//     <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-4">
//       {/* PAGE HEADER */}
//       <section className="bg-white rounded-3xl p-6 sm:p-8 mb-6 border border-[#eaf3ff] shadow-sm">
//         <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111111] tracking-tight">
//           🤖 AI Workspace
//         </h1>
//         <p className="text-base sm:text-lg text-[#444444] mt-3">
//           All your communication and AI production tools, in one place.
//         </p>
//       </section>

//       <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
//         {/* COMMUNICATION */}
//         <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#eaf3ff] shadow-sm">
//           <h2 className="text-xl font-bold text-[#111]">💬 Communication</h2>

//           <a
//             href="https://app.slack.com/client"
//             target="_blank"
//             rel="noreferrer"
//             className="
//               block mt-5 text-center font-semibold text-base
//               text-white bg-[#4A154B] rounded-xl px-5 py-4
//               hover:opacity-90 transition
//             "
//           >
//             Open Slack
//           </a>

//           <p className="mt-4 text-[#64748b] text-center text-sm">
//             Team Chat • Huddles • Meetings
//           </p>
//         </div>

//         {/* AI TOOLS */}
//         <div className="xl:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-[#eaf3ff] shadow-sm">
//           <h2 className="text-xl font-bold text-[#111] mb-5">
//             🛠️ AI Production Tools
//           </h2>

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             {aiTools.map((tool, index) => (
//               <button
//                 key={index}
//                 onClick={tool.action}
//                 className="
//                   text-left bg-[#F8FAFC] text-[#1E293B] rounded-2xl p-5
//                   border border-[#E2E8F0] shadow-sm
//                   transition-all duration-300 ease-out
//                   hover:-translate-y-1.5 hover:shadow-lg
//                   cursor-pointer
//                 "
//               >
//                 <div className="flex items-center justify-between">
//                   <div
//                     className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
//                     style={{ background: tool.color }}
//                   >
//                     {tool.icon}
//                   </div>

//                   <span
//                     className="text-white text-xs font-semibold px-3 py-1 rounded-full"
//                     style={{ background: tool.color }}
//                   >
//                     {tool.badge}
//                   </span>
//                 </div>

//                 <h3 className="mt-4 font-bold text-[#111827]">{tool.title}</h3>

//                 <p className="mt-2 text-[#64748B] text-sm leading-relaxed">
//                   {tool.description}
//                 </p>
//               </button>
//             ))}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }