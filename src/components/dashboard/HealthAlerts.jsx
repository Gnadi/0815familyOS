import { Syringe } from 'lucide-react';

export default function HealthAlerts() {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">Health Alerts</h2>
      <div className="mt-3 rounded-2xl bg-red-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
            <Syringe size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upcoming Vaccination</h3>
            <p className="mt-1 text-sm text-slate-600">
              A child is due for a booster shot soon. Schedule an appointment when you can.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Book Appointment
        </button>
      </div>
    </section>
  );
}
