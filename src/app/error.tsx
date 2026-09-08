"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Unable to load OpenCadence</h1>
      <p>Please try again. If the problem continues, restart OpenCadence.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
