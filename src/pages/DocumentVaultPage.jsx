import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Search, Trophy, X } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import DocumentCard from '../components/vault/DocumentCard';
import TrophyCard from '../components/vault/TrophyCard';
import DocumentFormModal from '../components/vault/DocumentFormModal';
import useAuth from '../hooks/useAuth';
import useT from '../hooks/useT';
import useDocuments from '../hooks/useDocuments';
import { createDocument, updateDocument, deleteDocument } from '../services/documents';

function DocumentsSection({ docs, onAdd, onEdit, encryptionKey }) {
  const { t, tn } = useT();
  return (
    <div className="space-y-3">
      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('vault.noDocuments')}
          description={t('vault.noDocumentsDesc')}
          action={
            <Button variant="secondary" onClick={onAdd}>
              {t('vault.addDocument')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{tn('vault.docCount', docs.length)}</p>
            <Button variant="secondary" onClick={onAdd}>
              {t('vault.addDocument')}
            </Button>
          </div>
          <div className="space-y-2">
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={onEdit} encryptionKey={encryptionKey} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TrophiesSection({ trophies, onAdd, onEdit, encryptionKey }) {
  const { t, tn } = useT();
  return (
    <div className="space-y-3">
      {trophies.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={t('vault.noTrophies')}
          description={t('vault.noTrophiesDesc')}
          action={
            <Button variant="secondary" onClick={onAdd}>
              {t('vault.addTrophy')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{tn('vault.trophyCount', trophies.length)}</p>
            <Button variant="secondary" onClick={onAdd}>
              {t('vault.addTrophy')}
            </Button>
          </div>
          <div className="space-y-2">
            {trophies.map((trophy) => (
              <TrophyCard key={trophy.id} trophy={trophy} onClick={onEdit} encryptionKey={encryptionKey} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DocumentVaultPage() {
  const { user, userDoc, encryptionKey } = useAuth();
  const { t } = useT();
  const { documents, loading } = useDocuments(userDoc?.familyId);
  const outletContext = useOutletContext() || {};
  const { setVaultAdd } = outletContext;

  const [activeTab, setActiveTab] = useState('documents');
  const [modal, setModal] = useState(null); // null | { type, initial? }
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) => {
      const haystack = [d.title, d.category, d.notes, d.kidName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [documents, searchQuery]);

  const docs = filteredDocuments.filter((d) => d.type === 'document');
  const trophies = filteredDocuments.filter((d) => d.type === 'trophy');

  useEffect(() => {
    setVaultAdd?.(() => () =>
      setModal({ type: activeTab === 'trophies' ? 'trophy' : 'document' })
    );
    return () => setVaultAdd?.(null);
  }, [activeTab, setVaultAdd]);

  async function handleSubmit(values) {
    if (modal?.initial) {
      await updateDocument(modal.initial.id, values);
    } else {
      await createDocument({
        familyId: userDoc.familyId,
        userId: user.uid,
        ...values,
      });
    }
    setModal(null);
  }

  async function handleDelete() {
    if (!modal?.initial) return;
    await deleteDocument(modal.initial.id);
    setModal(null);
  }

  return (
    <>
      <TopBar title={t('vault.title')} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('vault.searchPlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label={t('vault.clearSearch')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              activeTab === 'documents'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={16} />
            {t('vault.tabDocuments')}
          </button>
          <button
            onClick={() => setActiveTab('trophies')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              activeTab === 'trophies'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Trophy size={16} />
            {t('vault.tabTrophies')}
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : activeTab === 'documents' ? (
          <DocumentsSection
            docs={docs}
            onAdd={() => setModal({ type: 'document' })}
            onEdit={(doc) => setModal({ type: 'document', initial: doc })}
            encryptionKey={encryptionKey}
          />
        ) : (
          <TrophiesSection
            trophies={trophies}
            onAdd={() => setModal({ type: 'trophy' })}
            onEdit={(trophy) => setModal({ type: 'trophy', initial: trophy })}
            encryptionKey={encryptionKey}
          />
        )}
      </main>

      <DocumentFormModal
        open={Boolean(modal)}
        type={modal?.type}
        initial={modal?.initial}
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
        onDelete={modal?.initial ? handleDelete : undefined}
        encryptionKey={encryptionKey}
      />
    </>
  );
}
