import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Trophy } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import Spinner from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import DocumentCard from '../components/vault/DocumentCard';
import TrophyCard from '../components/vault/TrophyCard';
import DocumentFormModal from '../components/vault/DocumentFormModal';
import useAuth from '../hooks/useAuth';
import useDocuments from '../hooks/useDocuments';
import { createDocument, updateDocument, deleteDocument } from '../services/documents';

function DocumentsSection({ docs, onAdd, onEdit, encryptionKey }) {
  return (
    <div className="space-y-3">
      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Store passports, medical records, insurance policies and more."
          action={
            <Button variant="secondary" onClick={onAdd}>
              Add Document
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">{docs.length} document{docs.length !== 1 ? 's' : ''}</p>
            <Button variant="secondary" onClick={onAdd}>
              Add Document
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
  return (
    <div className="space-y-3">
      {trophies.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No trophies yet"
          description="Celebrate achievements — swim certificates, riding courses, sports medals and more."
          action={
            <Button variant="secondary" onClick={onAdd}>
              Add Trophy
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">{trophies.length} {trophies.length !== 1 ? 'trophies' : 'trophy'}</p>
            <Button variant="secondary" onClick={onAdd}>
              Add Trophy
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
  const { documents, loading } = useDocuments(userDoc?.familyId);
  const outletContext = useOutletContext() || {};
  const { setVaultAdd } = outletContext;

  const [activeTab, setActiveTab] = useState('documents');
  const [modal, setModal] = useState(null); // null | { type, initial? }

  const docs = documents.filter((d) => d.type === 'document');
  const trophies = documents.filter((d) => d.type === 'trophy');

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
      <TopBar title="Document Vault" showBell={false} />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6">
        <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-700">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              activeTab === 'documents'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={16} />
            Documents
          </button>
          <button
            onClick={() => setActiveTab('trophies')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition ${
              activeTab === 'trophies'
                ? 'bg-white text-amber-700 shadow-sm dark:bg-slate-800'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Trophy size={16} />
            Trophies
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
