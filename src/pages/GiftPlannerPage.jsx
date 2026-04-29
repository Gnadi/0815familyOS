import { useState } from 'react';
import TopBar from '../components/layout/TopBar';
import GiftBudgetCard from '../components/gifts/GiftBudgetCard';
import GiftRecipientSection from '../components/gifts/GiftRecipientSection';
import GiftFormModal from '../components/gifts/GiftFormModal';
import Spinner from '../components/common/Spinner';
import useAuth from '../hooks/useAuth';
import useGifts from '../hooks/useGifts';
import { updateGift, deleteGift } from '../services/gifts';
import { updateGiftBudget } from '../services/families';

export default function GiftPlannerPage() {
  const { userDoc, family } = useAuth();
  const { gifts, loading } = useGifts(userDoc?.familyId);

  const kids = family?.kids ?? [];
  const budget = Number(family?.giftBudget) || 0;

  const [editing, setEditing] = useState(null);

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
        ) : kids.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-card">
            <p className="font-semibold text-slate-700">No kids added yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Add your children in Settings to start planning gifts.
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
          </div>
        )}
      </main>

      <GiftFormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        initial={editing}
        kids={kids}
      />
    </>
  );
}
