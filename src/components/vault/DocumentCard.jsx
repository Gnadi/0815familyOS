import { useState } from 'react';
import { format } from 'date-fns';
import {
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Heart,
  Home,
  Loader2,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { getDocCategory } from '../../constants/documentCategories';
import { decryptBlob } from '../../utils/encryption';

const CATEGORY_ICONS = {
  identity:  CreditCard,
  medical:   Heart,
  insurance: ShieldCheck,
  finance:   Receipt,
  property:  Home,
  school:    GraduationCap,
  other:     FileText,
};

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

export default function DocumentCard({ doc, onClick, encryptionKey }) {
  const cat = getDocCategory(doc.category);
  const Icon = CATEGORY_ICONS[doc.category] || FileText;
  const [downloading, setDownloading] = useState(false);

  async function handleDownload(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!encryptionKey || !doc.fileUrl || downloading) return;
    setDownloading(true);
    try {
      const ext = doc.fileName?.split('.').pop().toLowerCase() ?? 'pdf';
      const mime = EXT_MIME[ext] ?? 'application/octet-stream';
      const res = await fetch(doc.fileUrl);
      if (!res.ok) throw new Error('Download failed');
      const buf = await res.arrayBuffer();
      const blob = await decryptBlob(encryptionKey, buf, mime);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: doc.fileName ?? doc.title,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Decrypt error:', err);
    } finally {
      setDownloading(false);
    }
  }

  const canDownload = doc.fileUrl && doc.fileName && encryptionKey;

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
          {canDownload && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              {fileExtBadge(doc.fileName)}
              {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            </button>
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
