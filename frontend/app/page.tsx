export default function Home() {
  return (
    <main className="min-h-screen bg-udemm-light text-slate-900">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 sm:px-12">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-10 shadow-xl shadow-slate-200/50 backdrop-blur">
          <span className="inline-flex items-center rounded-full bg-udemm-orange/10 px-4 py-1 text-sm font-semibold text-udemm-orange">
            Arquitectura Base & Setup Inicial
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-udemm-blue sm:text-5xl">
            UDEMM Global
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
            Plataforma institucional académica/documental diseñada para acompañar los procesos de acreditación CONEAU.
            En esta fase se ha preparado la base técnica escalable, la arquitectura modular y la conexión con PostgreSQL.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Frontend</p>
              <p className="mt-3 font-semibold text-slate-900">Next.js + TailwindCSS</p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Backend</p>
              <p className="mt-3 font-semibold text-slate-900">NestJS + Prisma + PostgreSQL</p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
