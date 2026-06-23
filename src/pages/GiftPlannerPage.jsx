import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import GiftBudgetCard from '../components/gifts/GiftBudgetCard';
import GiftRecipientSection from '../components/gifts/GiftRecipientSection';
import GiftFormModal from '../components/gifts/GiftFormModal';
import GiftRecipientFormModal from '../components/gifts/GiftRecipientFormModal';
import Spinner from '../components/common/Spinner';
import useAuth from '../hooks/useAuth';
import useGifts from '../hooks/useGifts';
import { updateGift, deleteGift } from '../services/gifts';
import {
  updateGiftBudget,
  addGiftRecipient,
  updateGiftRecipient,
  removeGiftRecipient,
} from '../services/families';

export default function GiftPlannerPage() {
  const { userDoc, family } = useAuth();
  const { gifts, loading } = useGifts(userDoc?.familyId);

  const kids = family?.kids ?? [];
  const recipients = family?.giftRecipients ?? [];
  const allRecipients = [...kids, ...recipients];
  const budget = Number(family?.giftBudget) || 0;

  const [editing, setEditing] = useState(null);
  // `null` = closed, `true` = add new, object = edit that recipient.
  const [recipientModal, setRecipientModal] = useState(null);

  async function handleUpdate(values) {
    await updateGift(editing.id, values);
    setEditing(null);
  }

  async function handleDelete() {
    await deleteGift(editing.id);
    setEditing(null);
  }

  async function handleBudgetSave(amount) {
    await updateGiftBudget(userDoc.familyId, amount);
  }

  async function handleRecipientSubmit(values) {
    if (recipientModal && recipientModal !== true) {
      await updateGiftRecipient(family.id, recipientModal.id, values);
    } else {
      await addGiftRecipient(family.id, values.name, recipients.length, values.birthday);
    }
    setRecipientModal(null);
  }

  async function handleRecipientDelete() {
    const recipient = recipientModal;
    if (!recipient || recipient === true) return;
    // Remove the person's gifts first so none are left orphaned.
    const theirGifts = gifts.filter((g) => g.kidId === recipient.id);
    await Promise.all(theirGifts.map((g) => deleteGift(g.id)));
    await removeGiftRecipient(family.id, recipient);
    setRecipientModal(null);
  }

  return (
    <>
      <TopBar title="Gift Planner" />
      <main className="mx-auto max-w-md px-5 py-5 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gift Planner</h1>
          <p className="text-sm text-slate-500">Organizing the magic for the season.</p>
        </div>

        <GiftBudgetCard
          budget={budget}
          gifts={gifts}
          onBudgetSave={handleBudgetSave}
        />

        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : allRecipients.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-card">
            <p className="font-semibold text-slate-700">No recipients yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Add your children in Settings, or add another person below to start
              planning gifts.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {kids.map((kid) => (
              <GiftRecipientSection
                key={kid.id}
                kid={kid}
                gifts={gifts.filter((g) => g.kidId === kid.id)}
                onEdit={setEditing}
              />
            ))}
            {recipients.map((recipient) => (
              <GiftRecipientSection
                key={recipient.id}
                kid={recipient}
                gifts={gifts.filter((g) => g.kidId === recipient.id)}
                onEdit={setEditing}
                onEditRecipient={setRecipientModal}
              />
            ))}
          </div>
        )}

        {!loading && (
          <button
            type="button"
            onClick={() => setRecipientModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-card transition hover:border-brand-400 hover:text-brand-600"
          >
            <UserPlus size={16} />
            Add person
          </button>
        )}
      </main>

      <GiftFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        initial={editing}
        recipients={allRecipients}
      />

      <GiftRecipientFormModal
        open={Boolean(recipientModal)}
        onClose={() => setRecipientModal(null)}
        onSubmit={handleRecipientSubmit}
        onDelete={recipientModal && recipientModal !== true ? handleRecipientDelete : undefined}
        initial={recipientModal && recipientModal !== true ? recipientModal : null}
      />
    </>
  );
}
