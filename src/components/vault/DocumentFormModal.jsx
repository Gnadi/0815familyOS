import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Check, Paperclip, Plus, X } from 'lucide-react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import useAuth from '../../hooks/useAuth';
import useFamilyMembers from '../../hooks/useFamilyMembers';
import useVaultCategories from '../../hooks/useVaultCategories';
import { DEFAULT_DOC_CATEGORY, DEFAULT_TROPHY_CATEGORY } from '../../constants/documentCategories';
import { COLOR_PALETTE, PALETTE_COLORS } from '../../constants/eventCategories';
import { addVaultCategory, deleteVaultCategory } from '../../services/families';
import { uploadFile, validateFile } from '../../services/cloudinary';

function toDateInput(d) {
  return d ? format(d, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
}

function NewCategoryForm({ onCreated, onCancel, familyId, vaultType }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PALETTE_COLORS[1]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = label.trim();
    if (!trimmed) return setError('Name is required.');
    setError('');
    setSaving(true);
    try {
      const created = await addVaultCategory(familyId, vaultType, { label: trimmed, color });
      onCreated(created);
    } catch (err) {
      setError(err.message || 'Could not add category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">New category</span>
        <button type="button" onClick={onCancel} className="rounded-full p-1 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-600">
          <X size={14} />
        </button>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Tax, Awards, Hobbies"
        maxLength={24}
        autoFocus
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-600 dark:text-white dark:placeholder-slate-400"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {PALETTE_COLORS.map((c) => {
          const active = color === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full ${COLOR_PALETTE[c].swatch} ring-offset-2 transition ${
                active ? 'ring-2 ring-slate-900' : 'hover:opacity-80'
              }`}
            >
              {active && <Check size={14} className="text-white" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleSave} loading={saving}>
          Add category
        </Button>
      </div>
    </div>
  );
}

export default function DocumentFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  initial,
  type,
  encryptionKey,
}) {
  const { userDoc, family } = useAuth();
  const familyMembers = useFamilyMembers();
  const fileInputRef = useRef(null);

  const isTrophy = type === 'trophy';
  const defaultCat = isTrophy ? DEFAULT_TROPHY_CATEGORY : DEFAULT_DOC_CATEGORY;
  const { list: cats } = useVaultCategories(type);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCat);
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(toDateInput(null));
  const [awardedTo, setAwardedTo] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [fileWarning, setFileWarning] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title || '');
      setCategory(initial.category || defaultCat);
      setNotes(initial.notes || '');
      setDate(toDateInput(initial.date));
      setAwardedTo(initial.awardedTo || '');
    } else {
      setTitle('');
      setCategory(defaultCat);
      setNotes('');
      setDate(toDateInput(null));
      setAwardedTo('');
    }
    setFile(null);
    setFileError('');
    setFileWarning('');
    setError('');
    setCreatingCategory(false);
    setDeletingCategoryId(null);
  }, [open, initial, defaultCat]);

  function handleFileChange(e) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFileError('');
    try {
      validateFile(chosen);
      setFile(chosen);
    } catch (err) {
      setFile(null);
      setFileError(err.message);
    }
  }

  function clearFile() {
    setFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteCategory(cat) {
    if (!userDoc?.familyId) return;
    const ok = window.confirm(`Delete category "${cat.label}"? Documents in this category will fall back to Other.`);
    if (!ok) return;
    setDeletingCategoryId(cat.id);
    try {
      await deleteVaultCategory(userDoc.familyId, type, cat);
      if (category === cat.id) setCategory(defaultCat);
    } catch (err) {
      setError(err.message || 'Could not delete category.');
    } finally {
      setDeletingCategoryId(null);
    }
  }

  const peopleOptions = [
    ...familyMembers.map((m) => m.displayName),
    ...(family?.kids?.map((k) => k.name) ?? []),
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Please enter a title.');
    if (!date) return setError('Please pick a date.');
    const [y, m, d] = date.split('-').map(Number);
    const parsedDate = new Date(y, m - 1, d, 9, 0);
    setError('');
    setSaving(true);

    let fileUrl = initial?.fileUrl || null;
    let filePublicId = initial?.filePublicId || null;
    let fileName = initial?.fileName || null;
    setFileWarning('');

    if (file) {
      try {
        const result = await uploadFile(file, encryptionKey || null);
        fileUrl = result.url;
        filePublicId = result.publicId;
        fileName = file.name;
      } catch (err) {
        if (err.message === 'Cloudinary is not configured.') {
          setFileWarning('File upload is not configured — document saved without attachment.');
          fileUrl = null;
          filePublicId = null;
          fileName = null;
        } else {
          setError(err.message);
          setSaving(false);
          return;
        }
      }
    }

    try {
      await onSubmit({
        type,
        title,
        category,
        notes,
        date: parsedDate,
        fileUrl,
        filePublicId,
        fileName,
        awardedTo: isTrophy ? awardedTo : null,
      });
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    const ok = window.confirm('Delete this entry? This cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const isEdit = Boolean(initial);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${isTrophy ? 'Trophy' : 'Document'}` : `New ${isTrophy ? 'Trophy' : 'Document'}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isTrophy ? 'Baby Swim Course Certificate' : 'Passport — Maria'}
          required
          autoFocus
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Category</span>
          <div className="flex flex-wrap gap-2">
            {cats.map((cat) => {
              const active = category === cat.id;
              const isDeletable = cat.id !== defaultCat;
              const isDeleting = deletingCategoryId === cat.id;
              const chip = active
                ? `${cat.chipBg} ${cat.chipText} border-transparent shadow-sm`
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600';
              return (
                <div
                  key={cat.id}
                  className={`flex items-center rounded-full border text-sm font-medium transition ${chip} ${isDeleting ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    disabled={isDeleting}
                    className={`flex items-center gap-2 py-1.5 pl-3 ${isDeletable ? 'pr-1.5' : 'pr-3'}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${cat.dot}`} />
                    {cat.label}
                  </button>
                  {isDeletable && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      disabled={isDeleting}
                      aria-label={`Delete ${cat.label}`}
                      className="mr-1 flex h-6 w-6 items-center justify-center rounded-full opacity-60 hover:bg-black/5 hover:opacity-100 disabled:cursor-not-allowed"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            {!creatingCategory && userDoc?.familyId && (
              <button
                type="button"
                onClick={() => setCreatingCategory(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
              >
                <Plus size={14} /> New
              </button>
            )}
          </div>
          {creatingCategory && userDoc?.familyId && (
            <NewCategoryForm
              familyId={userDoc.familyId}
              vaultType={type}
              onCancel={() => setCreatingCategory(false)}
              onCreated={(cat) => {
                setCategory(cat.id);
                setCreatingCategory(false);
              }}
            />
          )}
        </div>

        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {isTrophy && peopleOptions.length > 0 && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Awarded to <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {peopleOptions.map((name) => {
                const active = awardedTo === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setAwardedTo(active ? '' : name)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'border-amber-400 bg-amber-400 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Attachment <span className="font-normal text-slate-400 dark:text-slate-500">(optional · PDF, DOCX, XLS, XLSX · max 2 GB)</span>
          </span>
          {file ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-700">
              <span className="truncate text-sm text-slate-700 dark:text-slate-200">{file.name}</span>
              <button type="button" onClick={clearFile} className="ml-2 shrink-0 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-50 transition dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
            >
              <Paperclip size={16} />
              {initial?.fileUrl ? 'Replace file' : 'Attach file'}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
          {fileWarning && <p className="mt-1 text-xs text-amber-600">{fileWarning}</p>}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Notes <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
            placeholder={isTrophy ? 'Level 3 completed — June 2025' : 'Expires June 2030'}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          {isEdit && onDelete && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          )}
          <Button type="submit" loading={saving} className="ml-auto">
            {isEdit ? 'Save Changes' : isTrophy ? 'Add Trophy' : 'Add Document'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
