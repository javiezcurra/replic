import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <section className="text-center py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
          Science that{' '}
          <span className="text-brand-600">reproduces.</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
          Replic is an open-source platform for designing, running, and sharing
          reproducible scientific experiments — built for researchers who care about rigor.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/experiments" className="btn-primary text-base px-6 py-3 w-full sm:w-auto justify-center">
            Browse experiments
          </Link>
          <a
            href="https://github.com/javiezcurra/replic"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-base px-6 py-3 w-full sm:w-auto justify-center"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {features.map(({ icon, title, description }) => (
          <div key={title} className="card p-6">
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
        ))}
      </section>

      {/* Status banner */}
      <section className="card p-6 bg-brand-50 border-brand-200 text-center">
        <p className="text-sm font-medium text-brand-800">
          Replic is in early alpha. APIs and features will change.{' '}
          <a
            href="https://github.com/javiezcurra/replic/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            Give feedback on GitHub
          </a>
        </p>
      </section>
    </div>
  )
}

const features = [
  {
    icon: '🔬',
    title: 'Design experiments',
    description: 'Define variables, conditions, and protocols in a structured, version-controlled format.',
  },
  {
    icon: '▶️',
    title: 'Run & track',
    description: 'Execute experiments and log results with full audit trails and timestamped runs.',
  },
  {
    icon: '📤',
    title: 'Share & reproduce',
    description: 'Publish experiments so other researchers can replicate, verify, and build upon your work.',
  },
]
