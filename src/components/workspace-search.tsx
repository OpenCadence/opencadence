"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  FileText,
  FolderClosed,
  Search,
  Users,
} from "lucide-react";
import type { Workspace } from "@/lib/types";
import { getAttention } from "@/lib/attention";
import type { Editor } from "./item-form";
import { Dialog } from "./dialog";

type Result = {
  key: string;
  id: string;
  title: string;
  kind: Editor["kind"];
  subtitle: string;
  group: string;
  followUp?: boolean;
};
export function WorkspaceSearch({
  data,
  today,
  onClose,
  openEditor,
  openDetail,
}: {
  data: Workspace;
  today: string;
  onClose: () => void;
  openEditor: (editor: Editor) => void;
  openDetail: (kind: "project" | "customer", id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const matchingRecords = <T extends { content: string }>(records: T[]) =>
    records
      .filter((record) => record.content.toLowerCase().includes(q))
      .slice(0, 4);
  const records = [
    ...matchingRecords(
      data.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        content: task.title,
        kind: "task" as const,
      })),
    ),
    ...matchingRecords(
      data.projects.map((project) => ({
        id: project.id,
        title: project.name,
        content: `${project.name} ${project.description}`,
        kind: "project" as const,
      })),
    ),
    ...matchingRecords(
      data.customers.map((customer) => ({
        id: customer.id,
        title: customer.name,
        content: `${customer.name} ${customer.contact} ${customer.email} ${customer.details}`,
        kind: "customer" as const,
      })),
    ),
    ...matchingRecords(
      data.notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: `${note.title} ${note.body}`,
        kind: "note" as const,
      })),
    ),
  ];
  const results: Result[] = [
    ...(!q
      ? getAttention(data, today)
          .dueFollowUps.slice(0, 10)
          .map((c) => ({
            key: `follow-up:${c.id}`,
            id: c.id,
            title: c.name,
            kind: "customer" as const,
            subtitle: c.follow_up < today ? "Overdue" : "Due today",
            group: "Follow-ups due",
            followUp: true,
          }))
      : []),
    ...records.map((item) => ({
      ...item,
      key: `${item.kind}:${item.id}`,
      subtitle: item.kind === "customer" ? "client" : item.kind,
      group: q ? "Results" : "Workspace",
    })),
  ];
  const selected = results.length ? Math.min(active, results.length - 1) : -1;
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, query]);
  function activate(result: Result) {
    if (result.kind === "customer" || result.kind === "project")
      openDetail(result.kind, result.id);
    else openEditor({ kind: result.kind, id: result.id });
  }
  return (
    <Dialog
      title="Search"
      subtitle="Search tasks, projects, clients, and notes."
      onClose={onClose}
    >
      <div className="command-search">
        <Search size={20} />
        <input
          data-autofocus
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={
            selected >= 0 ? `${listId}-${selected}` : undefined
          }
          aria-label="Search workspace"
          placeholder="Search…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (results.length)
                setActive(
                  (selected +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    results.length) %
                    results.length,
                );
            } else if (event.key === "Enter" && selected >= 0) {
              event.preventDefault();
              activate(results[selected]);
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <div
        className="search-results"
        id={listId}
        ref={list}
        role="listbox"
        aria-label="Search results"
      >
        {results.map((result, index) => (
          <Fragment key={result.key}>
            {(index === 0 || results[index - 1].group !== result.group) && (
              <span className="search-group-label" role="presentation">
                {result.group}
              </span>
            )}
            <button
              type="button"
              id={`${listId}-${index}`}
              role="option"
              aria-selected={selected === index}
              tabIndex={-1}
              onMouseMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => activate(result)}
            >
              {result.followUp ? (
                <CalendarDays size={17} />
              ) : result.kind === "task" ? (
                <CheckCheck size={17} />
              ) : result.kind === "project" ? (
                <FolderClosed size={17} />
              ) : result.kind === "customer" ? (
                <Users size={17} />
              ) : (
                <FileText size={17} />
              )}
              <span>
                {result.title}
                <small>{result.subtitle}</small>
              </span>
              <ArrowUpRight size={14} />
            </button>
          </Fragment>
        ))}
      </div>
      {!results.length && (
        <p className="search-empty" role="status">
          No results. Try a different search.
        </p>
      )}
      <div className="search-hints">
        <span>
          <kbd>↑ ↓</kbd> Navigate
        </span>
        <span>
          <kbd>Enter</kbd> Open
        </span>
      </div>
    </Dialog>
  );
}
