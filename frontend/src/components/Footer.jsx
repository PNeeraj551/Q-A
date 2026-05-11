export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-6 shrink-0 w-full">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-xs text-gray-500 font-medium">
          &copy; {new Date().getFullYear()} AthivaTech. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition">Privacy Policy</a>
          <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition">Terms of Service</a>
          <a href="#" className="text-xs text-gray-400 hover:text-gray-600 transition">Contact Administrator</a>
        </div>
      </div>
    </footer>
  )
}
