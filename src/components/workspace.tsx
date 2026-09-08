"use client";

import Link from "next/link";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { ProjectPage } from "./project-page";
import { ClientPage } from "./client-page";
import { ClientDetailDialog } from "./client-detail-dialog";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, Menu, Plus, X } from "lucide-react";
import { changeStage, toggleTask } from "@/lib/actions";
import type {
  Workspace as WorkspaceData,
  View,
  ActionResult,
} from "@/lib/types";
import { localDate } from "@/lib/validation";
import { getAttention } from "@/lib/attention";
import { ItemForm, type Editor } from "./item-form";
import { WorkspaceItemsProvider } from "./workspace-items";
import {
  ActivityDraftRecovery,
  emptyActivity,
  useActivityDrafts,
} from "./activity-drafts";
import { ClearExamplesDialog } from "./clear-examples-dialog";
import { WorkspaceSearch } from "./workspace-search";
import { WorkspaceHelp } from "./workspace-help";
import { TodayView } from "./today-view";
import { FirstRunSetup } from "./first-run-setup";
import { WorkspaceNavigation } from "./workspace-navigation";
import { WorkspaceCollectionView } from "./workspace-collection-view";
export function Workspace({
  data,
  view,
  initialToday,
  projectId,
  clientId,
  firstRunPending = false,
  hideExampleBanner = false,
}: {
  data: WorkspaceData;
  view: View;
  initialToday: string;
  projectId?: string;
  clientId?: string;
  firstRunPending?: boolean;
  hideExampleBanner?: boolean;
}) {
  const router = useRouter();
  const selectedProject = data.projects.find((p) => p.id === projectId);
  const selectedClient = data.customers.find((c) => c.id === clientId);
  const createButton = useRef<HTMLButtonElement>(null);
  const [today, setToday] = useState(initialToday);
  const [ready, setReady] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [detail, setDetail] = useState<{
    kind: "customer";
    id: string;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [modifier, setModifier] = useState("Ctrl");
  const activity = useActivityDrafts(data.customers);
  const [activityPending, setActivityPending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const navigationPanel = useRef<HTMLElement>(null);
  function closeNavigation() {
    flushSync(() => setMobileOpen(false));
    mobileMenuButton.current?.focus();
  }
  const mobileCloseButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    mobileCloseButton.current?.focus();
    function handleNavigationKey(event: KeyboardEvent) {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeNavigation();
      }
      if (event.key === "Tab") {
        const controls = [
          ...(navigationPanel.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not(:disabled), input:not(:disabled)",
          ) || []),
        ].filter(
          (element) => element.getClientRects().length && element.tabIndex >= 0,
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    const desktop = window.matchMedia("(min-width: 701px)");
    function closeOnDesktop() {
      if (desktop.matches) setMobileOpen(false);
    }
    window.addEventListener("keydown", handleNavigationKey);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", handleNavigationKey);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [mobileOpen]);
  const [toast, setToast] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTasks = data.tasks.filter((t) => !t.done);
  const { dueFollowUps } = getAttention(data, today);
  const activeProjects = data.projects.filter((p) => p.status === "Active");
  const overdueTaskCount = openTasks.filter(
    (t) => t.due && t.due < today,
  ).length;
  const headerSummary = {
    tasks: openTasks.length
      ? `${openTasks.length} open${overdueTaskCount ? ` · ${overdueTaskCount} overdue` : ""}`
      : "No open tasks",
    projects: activeProjects.length
      ? `${activeProjects.length} active ${activeProjects.length === 1 ? "project" : "projects"}`
      : "No active projects",
    customers: dueFollowUps.length
      ? `${dueFollowUps.length} ${dueFollowUps.length === 1 ? "follow-up" : "follow-ups"} due`
      : "No follow-ups due",
    notes: data.notes.length
      ? `${data.notes.length} ${data.notes.length === 1 ? "note" : "notes"}`
      : "No notes yet",
  };
  const hasExamples = [
    ...data.tasks,
    ...data.projects,
    ...data.customers,
    ...data.notes,
    ...data.activities,
  ].some((item) => item.is_demo);
  useEffect(() => {
    setModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
    setToday(localDate());
    const interval = setInterval(() => setToday(localDate()), 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [view, projectId, clientId]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector("dialog[open]")) {
          setSearchOpen(true);
        }
        return;
      }
      const element = e.target as HTMLElement;
      if (
        element.closest("input,textarea,select,[contenteditable=true]") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditor({ kind: "task", projectId, customerId: clientId });
      }
      if (e.key === "?") setHelpOpen(true);
    }
    window.addEventListener("keydown", handleKey);
    setReady(true);
    return () => window.removeEventListener("keydown", handleKey);
  }, [projectId, clientId]);
  function notify(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  }
  function perform(operation: () => Promise<ActionResult>, message?: string) {
    setActionFeedback(null);
    function report(message: string, error: boolean) {
      if (detail) setActionFeedback({ message, error });
      else notify(message);
    }
    startTransition(async () => {
      try {
        const result = await operation();
        if (!result.ok) report(result.error || "Something went wrong.", true);
        else if (message) report(message, false);
      } catch {
        report("Couldn't reach the server. Please try again.", true);
      }
    });
  }
  function openEditor(value: Editor) {
    if (pending || activityPending) return;
    setActionFeedback(null);
    setDetail(null);
    setSearchOpen(false);
    setEditor(value);
  }
  function openDetail(kind: "project" | "customer", id: string) {
    if (pending || activityPending) return;
    setActionFeedback(null);
    setSearchOpen(false);
    if (kind === "project") {
      setDetail(null);
      setMobileOpen(false);
      router.push(`/projects/${encodeURIComponent(id)}`);
    } else setDetail({ kind, id });
  }
  function closeDetail() {
    if (pending || activityPending) return;
    setActionFeedback(null);
    setDetail(null);
  }
  const singular =
    projectId || clientId
      ? "task"
      : view === "customers"
        ? "customer"
        : view === "projects"
          ? "project"
          : view === "notes"
            ? "note"
            : "task";
  const selectedCustomer =
    detail?.kind === "customer"
      ? data.customers.find((c) => c.id === detail.id)
      : undefined;
  const singularLabel = singular === "customer" ? "client" : singular;

  return (
    <WorkspaceItemsProvider
      value={{
        data,
        today,
        view,
        pending,
        openEditor,
        openDetail,
        onTaskToggle: (task) =>
          perform(
            () => toggleTask(task.id, !task.done),
            task.done ? "Task reopened" : "Task completed",
          ),
      }}
    >
      <div className="app-shell" data-ready={ready}>
        {mobileOpen && (
          <button
            className="sidebar-scrim"
            aria-label="Dismiss navigation"
            tabIndex={-1}
            onClick={closeNavigation}
          />
        )}
        <WorkspaceNavigation
          view={view}
          projectId={projectId}
          openTaskCount={openTasks.length}
          activeProjects={activeProjects}
          mobileOpen={mobileOpen}
          modifier={modifier}
          panelRef={navigationPanel}
          closeButtonRef={mobileCloseButton}
          close={closeNavigation}
          openSearch={() => setSearchOpen(true)}
          createProject={() => setEditor({ kind: "project" })}
          openHelp={() => setHelpOpen(true)}
        />
        <div className="main-shell" inert={mobileOpen}>
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                aria-expanded={mobileOpen}
                aria-controls="workspace-navigation"
                ref={mobileMenuButton}
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>
              {selectedProject || selectedClient ? (
                <>
                  <Link
                    href={
                      selectedProject ? "/?view=projects" : "/?view=customers"
                    }
                  >
                    {selectedProject ? "Projects" : "Clients"}
                  </Link>
                  <span aria-hidden="true">/</span>
                  <strong title={(selectedProject || selectedClient)!.name}>
                    {(selectedProject || selectedClient)!.name}
                  </strong>
                </>
              ) : view === "today" ? (
                <div className="header-context">
                  <CalendarDays
                    size={14}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                  <time dateTime={today}>
                    {new Date(today + "T12:00:00").toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </time>
                </div>
              ) : (
                <div className="header-context">{headerSummary[view]}</div>
              )}
            </div>
            <div className="topbar-actions">
              <button
                className="button primary small-button"
                ref={createButton}
                onClick={() =>
                  setEditor({ kind: singular, projectId, customerId: clientId })
                }
              >
                <Plus size={16} />
                <span>New {singularLabel}</span>
              </button>
            </div>
          </header>
          <main>
            {firstRunPending && <FirstRunSetup />}
            <ActivityDraftRecovery
              drafts={activity.orphaned}
              onDiscard={activity.discard}
              onEmpty={() => createButton.current?.focus()}
            />
            {hasExamples && !firstRunPending && !hideExampleBanner && (
              <div className="example-banner">
                <span>This workspace includes example data.</span>
                <button
                  onClick={() => {
                    setActionFeedback(null);
                    setClearOpen(true);
                  }}
                >
                  Clear examples <X size={13} />
                </button>
              </div>
            )}
            {selectedClient ? (
              <ClientPage
                key={selectedClient.id}
                client={selectedClient}
                data={data}
                openEditor={openEditor}
                draft={activity.drafts[selectedClient.id]}
                onDraftChange={(draft) =>
                  activity.change(selectedClient, draft)
                }
                onActivityPending={setActivityPending}
                notify={notify}
              />
            ) : selectedProject ? (
              <ProjectPage
                key={selectedProject.id}
                project={selectedProject}
                data={data}
                today={today}
                openEditor={openEditor}
                openCustomer={(id) => openDetail("customer", id)}
              />
            ) : view === "today" ? (
              <TodayView data={data} today={today} openEditor={openEditor} />
            ) : (
              <WorkspaceCollectionView
                data={data}
                view={view}
                today={today}
                openEditor={openEditor}
                openClient={(id) =>
                  router.push(`/clients/${encodeURIComponent(id)}`)
                }
              />
            )}
          </main>
        </div>
        {editor && (
          <ItemForm
            key={editor.kind + (editor.id || "new")}
            editor={editor}
            data={data}
            onClose={() => setEditor(null)}
            onSaved={notify}
            hasActivityDraft={
              editor.kind === "customer" &&
              !!activity.drafts[editor.id || ""]?.body
            }
            onDeleted={() => {
              if (editor.kind === "customer" && editor.id)
                activity.discard(editor.id);
              if (editor.kind === "project" && editor.id === projectId)
                router.replace("/?view=projects");
              if (editor.kind === "customer" && editor.id === clientId)
                router.replace("/?view=customers");
            }}
          />
        )}
        {selectedCustomer && (
          <ClientDetailDialog
            customer={selectedCustomer}
            data={data}
            today={today}
            pending={pending}
            activityPending={activityPending}
            feedback={actionFeedback}
            draft={activity.drafts[selectedCustomer.id] || emptyActivity}
            onClose={closeDetail}
            openEditor={openEditor}
            updateStage={(stage) =>
              perform(
                () => changeStage(selectedCustomer.id, stage),
                "Pipeline updated",
              )
            }
            onDraftChange={(draft) => activity.change(selectedCustomer, draft)}
            onActivityPending={setActivityPending}
            onActivitySaved={(message) =>
              setActionFeedback({ message, error: false })
            }
          />
        )}
        {searchOpen && (
          <WorkspaceSearch
            data={data}
            today={today}
            onClose={() => setSearchOpen(false)}
            openEditor={openEditor}
            openDetail={openDetail}
          />
        )}
        {helpOpen && (
          <WorkspaceHelp
            modifier={modifier}
            onClose={() => setHelpOpen(false)}
          />
        )}
        {clearOpen && (
          <ClearExamplesDialog
            hasActivityDrafts={Object.values(activity.drafts).some(
              (draft) => !!draft.body,
            )}
            onClose={() => setClearOpen(false)}
            onCleared={notify}
          />
        )}
        <div
          className={`toast ${toast ? "visible" : ""}`}
          inert={mobileOpen}
          role="status"
          aria-live="polite"
        >
          {toast && (
            <>
              <span className="toast-dot" />
              {toast}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setToast("")}
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </WorkspaceItemsProvider>
  );
}
