"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowUpRight, FolderClosed, Mail, MessageSquare } from "lucide-react";
import type { Activity, Project } from "@/lib/types";

export function Timeline({
  activities,
  projects,
  onNavigate,
}: {
  activities: Activity[];
  projects: Project[];
  onNavigate?: ComponentProps<typeof Link>["onNavigate"];
}) {
  if (!activities.length)
    return <p className="detail-empty">No timeline events yet.</p>;
  const projectById = new Map(projects.map((project) => [project.id, project]));
  return activities.map((activity) => {
    const linkedProject = activity.project_id
      ? projectById.get(activity.project_id)
      : undefined;
    return (
      <div className="timeline-item" key={activity.id}>
        <span className="timeline-marker">
          {activity.kind === "Email" ? (
            <Mail size={14} />
          ) : activity.kind === "Project" ? (
            <FolderClosed size={14} />
          ) : (
            <MessageSquare size={14} />
          )}
        </span>
        <div>
          <div className="timeline-meta">
            <strong>{activity.kind}</strong>
            <time dateTime={activity.created_at}>
              {new Date(activity.created_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
          <p>{activity.body}</p>
          {linkedProject && (
            <Link
              className="timeline-link"
              href={`/projects/${encodeURIComponent(linkedProject.id)}`}
              prefetch={true}
              onNavigate={onNavigate}
            >
              <ArrowUpRight size={13} />
              {linkedProject.name}
            </Link>
          )}
        </div>
      </div>
    );
  });
}
