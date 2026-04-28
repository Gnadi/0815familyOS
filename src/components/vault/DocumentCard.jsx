import { format } from 'date-fns';
import {
  CreditCard,
  ExternalLink,
  FileText,
  GraduationCap,
  Heart,
  Home,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { getDocCategory } from '../../constants/documentCategories';

const CATEGORY_ICONS = {
  identity:  CreditCard,
  medical:   Heart,
  insurance: ShieldCheck,
  finance:   Receipt,
  property:  Home,
  school:    GraduationCap,
  other:     FileText,
};

function fileExtBadge(url) {
  if (!url) return null;
  const ext = url.split('.').pop().split('?')[0].toUpperCase();
  const known = ['PDF', 'DOCX', 'XLS', 'XLSX'];
  return known.includes(ext) ? ext : 'FILE';
}

function proxyUrl(fileUrl) {
  if (!fileUrl) return null;
  const m = fileUrl.match(/res\.cloudinary\.com\/[^/]+\/([^/]+)\/upload\/(.+)/);
  if (!m) return fileUrl;
  return `/api/cloudinary-download?path=${encodeURIComponent(m[2])}&rt=${encodeURIComponent(m[1])}`;
}

export default function DocumentCard({ doc, onClick }) {
  const cat = getDocCategory(doc.category);
  const Icon = CATEGORY_ICONS[doc.category] || FileText;

  return (
    <button
      onClick={() => onClick(doc)}
      className="flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cat.iconBg} ${cat.iconColor}`}>
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{doc.title}</p>
          {doc.fileUrl && (
            <a
              href={proxyUrl(doc.fileUrl)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              {fileExtBadge(doc.fileUrl)}
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.chipBg} ${cat.chipText}`}>
            {cat.label}
          </span>
          {doc.date && (
            <span className="text-xs text-slate-400">
              {format(doc.date, 'dd MMM yyyy')}
            </span>
          )}
        </div>

        {doc.notes && (
          <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{doc.notes}</p>
        )}
      </div>
    </button>
  );
}
