export default function Experiments() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Experiments</h1>
        <p className="mt-2 text-gray-600">Browse and discover reproducible scientific experiments.</p>
      </div>

      {/* Placeholder state */}
      <div className="card p-12 flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-4">🔬</div>
        <h2 className="text-lg font-semibold text-gray-900">No experiments yet</h2>
        <p className="mt-2 text-sm text-gray-500 max-w-sm">
          Experiments will appear here once the platform launches. Check back soon or{' '}
          <a
            href="https://github.com/javiezcurra/replic"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            contribute on GitHub
          </a>
          .
        </p>
      </div>
    </div>
  )
}
