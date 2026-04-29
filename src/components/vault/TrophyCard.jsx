import { format } from 'date-fns';
import { ExternalLink, Trophy, User } from 'lucide-react';
import { getTrophyCategory } from '../../constants/documentCategories';

function fileExtBadge(url) {
  if (!url) return null;
  const ext = url.split('.').pop().split('?')[0].toUpperCase();
  const known = ['PDF', 'DOCX', 'XLS', 'XLSX'];
  return known.includes(ext) ? ext : 'FILE';
}

function proxyUrl(filePublicId, fileUrl) {
  if (!fileUrl) return null;
  const rtM = fileUrl.match(/res\.cloudinary\.com\/[^/]+\/([^/]+)\/upload\//);
  const rt = rtM ? rtM[1] : 'image';
  const fmtM = fileUrl.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const fmt = fmtM ? fmtM[1].toLowerCase() : 'pdf';
  const pid = filePublicId
    || fileUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?$/)?.[1]
    || null;
  if (!pid) return null;
  return `/api/cloudinary-download?pid=${encodeURIComponent(pid)}&rt=${encodeURIComponent(rt)}&fmt=${encodeURIComponent(fmt)}`;
}

export default function TrophyCard({ trophy, onClick }) {
  const cat = getTrophyCategory(trophy.category);

  return (
    <button
      onClick={() => onClick(trophy)}
      className="flex w-full items-start gap-3 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 p-4 text-left shadow-sm ring-1 ring-amber-100 transition hover:shadow-md"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Trophy size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{trophy.title}</p>
          {trophy.fileUrl && (
            <a
              href={proxyUrl(trophy.filePublicId, trophy.fileUrl)}
              onClick={(e) => e.stopPropagation()}
              className="flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200"
            >
              {fileExtBadge(trophy.fileUrl)}
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.chipBg} ${cat.chipText}`}>
            {cat.label}
          </span>
          {trophy.date && (
            <span className="text-xs text-slate-400">
              {format(trophy.date, 'dd MMM yyyy')}
            </span>
          )}
        </div>

        {trophy.awardedTo && (
          <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700">
            <User size={11} />
            {trophy.awardedTo}
          </div>
        )}

        {trophy.notes && (
          <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{trophy.notes}</p>
        )}
      </div>
    </button>
  );
}
