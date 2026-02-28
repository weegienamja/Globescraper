export default function Loading() {
  return (
    <main className="container mx-auto max-w-3xl px-4 py-12">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-8 space-y-3">
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-4/6 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </main>
  );
}
