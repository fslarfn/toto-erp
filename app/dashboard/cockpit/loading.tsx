export default function LoadingCockpit() {
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-4">
          <div className="animate-pulse bg-slate-200 h-10 w-[250px] rounded-md" />
          <div className="animate-pulse bg-slate-200 h-4 w-[350px] rounded-md" />
        </div>
        <div className="animate-pulse bg-slate-200 h-10 w-10 rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card h-[220px] animate-pulse">
            <div className="p-6">
              <div className="bg-slate-100 h-4 w-1/3 rounded-md mb-4" />
              <div className="bg-slate-50 h-32 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
