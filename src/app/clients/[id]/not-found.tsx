import Link from "next/link";

export default function ClientNotFound() {
  return (
    <main className="error-page">
      <h1>Relationship not found</h1>
      <p>It may have been deleted in another window.</p>
      <Link className="button primary" href="/?view=customers">
        Back to relationships
      </Link>
    </main>
  );
}
