import { useState } from 'react';
import { format } from 'date-fns';
import { Download, Loader2, Trophy, User } from 'lucide-react';
import { getTrophyCategory } from '../../constants/documentCategories';
import { decryptBlob } from '../../utils/encryption';

const EXT_MIME = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls:  'application/vnd.ms-excel',
};

function fileExtBadge(fileName) {
  if (!fileName) return 'FILE';
  const ext = fileName.split('.').pop().toUpperCase();
  return ['PDF', 'DOCX', 'XLS', 'XLSX'].includes(ext) ? ext : 'FILE';
}

export default function TrophyCard({ trophy, onClick, encryptionKey }) {
  const cat = getTrophyCategory(trophy.category);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!encryptionKey || !trophy.fileUrl || downloading) return;
    setDownloading(true);
    try {
      const ext = trophy.fileName?.split('.').pop().toLowerCase() ?? 'pdf';
      const mime = EXT_MIME[ext] ?? 'application/octet-stream';
      const res = await fetch(trophy.fileUrl);
      if (!res.ok) throw new Error('Download failed');
      const buf = await res.arrayBuffer();
      const blob = await decryptBlob(encryptionKey, buf, mime);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: trophy.fileName ?? trophy.title,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Decrypt error:', err);
    } finally {
      setDownloading(false);
    }
  }

  const canDownload = trophy.fileUrl && trophy.fileName && encryptionKey;

  return (
    <button
      onClick={() => onClick(trophy)}
      className={`flex w-full items-start gap-3 rounded-2xl p-4 text-left shadow-sm ring-1 transition hover:shadow-md ${cat.cardBg} ${cat.cardRing}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cat.iconBg} ${cat.iconColor}`}>
        <Trophy size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{trophy.title}</p>
          {canDownload && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium disabled:opacity-50 ${cat.iconBg} ${cat.iconColor}`}
            >
              {fileExtBadge(trophy.fileName)}
              {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            </button>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium shadow-sm ${cat.chipBg} ${cat.chipText}`}>
            {cat.label}
          </span>
          {trophy.date && (
            <span className="text-xs text-slate-400">
              {format(trophy.date, 'dd MMM yyyy')}
            </span>
          )}
        </div>

        {trophy.awardedTo && (
          <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${cat.iconColor}`}>
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
