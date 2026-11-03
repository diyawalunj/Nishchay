import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#2D6A4F]">404</p>
      <h1 className="mt-3 text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-3 max-w-md text-gray-600">That address doesn’t lead to a page on Nishchay Defence.</p>
      <Link to="/" className="mt-6 rounded-lg bg-[#1B4332] px-5 py-3 font-medium text-white hover:bg-[#2D6A4F]">Go to home</Link>
    </section>
  );
}
