import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import LogoutButton from './components/LogoutButton'
import AdminRedirect from './components/AdminRedirect'

export default async function Home() {
  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('price', { ascending: true })

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <AdminRedirect />
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Nuestros servicios</h1>
            <p className="mt-1 text-sm text-gray-500">Elige el servicio que quieres agendar</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/mis-citas" className="text-sm text-gray-500 underline">
              Ver mis citas
            </Link>
            <LogoutButton />
          </div>
        </div>

        {error && <p className="mt-6 text-red-600">Error: {error.message}</p>}

        <div className="mt-6 space-y-3">
          {services?.length === 0 && (
            <p className="text-gray-500">Todavía no hay servicios cargados.</p>
          )}

          {services?.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200"
            >
              <div>
                <h2 className="font-medium text-gray-900">{s.name}</h2>
                {s.description && <p className="text-sm text-gray-500">{s.description}</p>}
                <p className="text-xs text-gray-400 mt-1">{s.duration_minutes} min</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-semibold text-gray-900">
                  ${Number(s.price).toLocaleString('es-MX')}
                </span>
                <Link
                  href={`/agendar/${s.id}`}
                  className="text-xs font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg"
                >
                  Reservar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}