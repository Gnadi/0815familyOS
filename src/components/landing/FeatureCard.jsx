export default function FeatureCard({ icon: Icon, iconBg = 'bg-brand-50', iconColor = 'text-brand-500', title, description }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-card">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
        <Icon size={22} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}
