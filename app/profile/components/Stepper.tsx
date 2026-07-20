"use client";

import { useProfile } from "../ProfileContext";
import { sectionCompleted } from "../utils/profileCompletion";

export default function Stepper({
  step,
}: {
  step: number;
}) {
  const { profile } = useProfile();

  const steps = [
    { key: "personal", title: "Personal" },
    { key: "account", title: "Account" },
    { key: "address", title: "Address" },
    { key: "emergency", title: "Emergency" },
    { key: "employment", title: "Employment" },
    { key: "bank", title: "Bank" },
    { key: "documents", title: "Documents" },
    { key: "review", title: "Review" },
  ];

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 40,
        overflowX: "auto",
        paddingBottom: 10,
      }}
    >
      {steps.map((item, index) => {
        const completed = sectionCompleted(
          profile,
          item.key
        );

        const active = index === step;

        return (
          <div
            key={item.key}
            style={{
              flex: 1,
              minWidth: 110,
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* Progress Line */}

            {index !== steps.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  left: "55%",
                  width: "90%",
                  height: 3,
                  background:
                    index < step
                      ? "#16a34a"
                      : "#dbeafe",
                  zIndex: 0,
                }}
              />
            )}

            {/* Circle */}

            <div
              style={{
                width: 42,
                height: 42,
                margin: "auto",
                borderRadius: "50%",
                background: completed
                  ? "#16a34a"
                  : active
                  ? "#2563eb"
                  : "#dbeafe",
                color: "#fff",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontWeight: 700,
                position: "relative",
                zIndex: 1,
                transition: ".3s",
              }}
            >
              {completed ? "✓" : index + 1}
            </div>

            {/* Title */}

            <p
              style={{
                marginTop: 10,
                fontWeight: 600,
                fontSize: 14,
                color: completed
                  ? "#16a34a"
                  : active
                  ? "#2563eb"
                  : "#64748b",
              }}
            >
              {item.title}
            </p>

            {/* Status */}

            <p
              style={{
                marginTop: 4,
                fontSize: 12,
                color: completed
                  ? "#16a34a"
                  : "#94a3b8",
              }}
            >
              {completed
                ? "Completed"
                : active
                ? "In Progress"
                : "Pending"}
            </p>
          </div>
        );
      })}
    </div>
  );
}