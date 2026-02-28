export default function Loading() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-12">
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              <div className="h-40 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
