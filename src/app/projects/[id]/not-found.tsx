import Link from "next/link";
import { FolderClosed, ArrowLeft } from "lucide-react";

export default function ProjectNotFound() {
  return (
    <main className="error-page">
      <FolderClosed size={32} strokeWidth={1.5} />
      <h1>Project not found</h1>
      <p>This project may have been deleted, or the link is no longer valid.</p>
      <Link className="button primary" href="/?view=projects">
        <ArrowLeft size={15} />
        Back to projects
      </Link>
    </main>
  );
}
