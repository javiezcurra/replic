import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto text-center py-24">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 text-gray-600">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6 inline-flex">
        Back to home
      </Link>
    </div>
  )
}
