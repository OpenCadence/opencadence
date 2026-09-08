"use client";

import Link from "next/link";
import type { RefObject } from "react";
import {
  CheckCheck,
  CircleHelp,
  FileText,
  FolderClosed,
  Plus,
  Search,
  Sun,
  Users,
  X,
} from "lucide-react";
import type { Project, View } from "@/lib/types";
import { ThemeToggle } from "./theme-toggle";

export const navigation = [
  { id: "today", label: "Today", icon: Sun },
  { id: "tasks", label: "Tasks", icon: CheckCheck },
  { id: "projects", label: "Projects", icon: FolderClosed },
  { id: "customers", label: "Clients", icon: Users },
  { id: "notes", label: "Notes", icon: FileText },
] as const;

export function WorkspaceNavigation({
  view,
  projectId,
  openTaskCount,
  activeProjects,
  mobileOpen,
  modifier,
  panelRef,
  closeButtonRef,
  close,
  openSearch,
  createProject,
  openHelp,
}: {
  view: View;
  projectId?: string;
  openTaskCount: number;
  activeProjects: Project[];
  mobileOpen: boolean;
  modifier: string;
  panelRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  close: () => void;
  openSearch: () => void;
  createProject: () => void;
  openHelp: () => void;
}) {
  function closeOnMobile() {
    if (mobileOpen) close();
  }

  return (
    <aside
      ref={panelRef}
      id="workspace-navigation"
      className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
    >
      <button
        ref={closeButtonRef}
        className="icon-button mobile-nav-close"
        aria-label="Close navigation"
        onClick={close}
      >
        <X size={20} />
      </button>
      <Link
        href="/"
        className="brand"
        aria-label="OpenCadence home"
        onClick={closeOnMobile}
      >
        <img
          className="brand-logo brand-logo-light"
          src="/brand/logo-horizontal-primary.svg"
          alt="OpenCadence"
        />
        <img
          className="brand-logo brand-logo-dark"
          src="/brand/logo-horizontal-white.svg"
          alt="OpenCadence"
        />
      </Link>
      <button className="search-trigger" onClick={openSearch}>
        <Search size={16} />
        <span>Search…</span>
        <kbd>{modifier} K</kbd>
      </button>
      <nav aria-label="Main navigation">
        {navigation.map((item) => (
          <Link
            key={item.id}
            href={item.id === "today" ? "/" : `/?view=${item.id}`}
            onClick={closeOnMobile}
            aria-current={view === item.id ? "page" : undefined}
            className={`nav-item ${view === item.id ? "selected" : ""}`}
          >
            <item.icon size={18} strokeWidth={1.7} />
            <span>{item.label}</span>
            {item.id === "tasks" && openTaskCount > 0 && (
              <span className="nav-count">{openTaskCount}</span>
            )}
            {item.id === "today" && <span className="nav-active-dot" />}
          </Link>
        ))}
      </nav>
      <div className="sidebar-projects">
        <div className="nav-heading">
          ACTIVE PROJECTS
          <button
            className="icon-button"
            aria-label="New project"
            onClick={createProject}
          >
            <Plus size={14} />
          </button>
        </div>
        {activeProjects.slice(0, 5).map((project) => (
          <Link
            key={project.id}
            href={`/projects/${encodeURIComponent(project.id)}`}
            prefetch={true}
            className="sidebar-project"
            aria-current={projectId === project.id ? "page" : undefined}
            onClick={closeOnMobile}
          >
            <span className={`dot ${project.color}`} />
            <span title={project.name}>{project.name}</span>
          </Link>
        ))}
        {!activeProjects.length && (
          <p className="sidebar-empty">No active projects</p>
        )}
      </div>
      <div className="sidebar-bottom">
        <ThemeToggle />
        <button className="nav-item help-button" onClick={openHelp}>
          <CircleHelp size={17} />
          Help
          <span className="shortcut-hint">?</span>
        </button>
      </div>
    </aside>
  );
}
