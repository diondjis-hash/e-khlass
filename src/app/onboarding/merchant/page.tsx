'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  cleanupKycUploads,
  createKycUpload,
  loadOnboardingData,
  submitOnboarding,
} from './actions';

type KycKey = 'rc_url' | 'nif_url' | 'id_url';

type FormData = {
  name: string;
  legal_name: string;
  business_type: string;
  rc_number: string;
  nif: string;
  contact_phone: string;
  address: string;
  city: string;
  operator_method: string;
  operator_phone: string;
  operator_label: string;
};

type KycFiles = {
  rc_url: string | null;
  nif_url: string | null;
  id_url: string | null;
};

type SelectedFiles = {
  rc_url: File | null;
  nif_url: File | null;
  id_url: File | null;
};

const operators = ['Bankily', 'Masrvi', 'Sedad', 'BIM', 'Click'];

const businessTypes = [
  { value: 'sarl', label: 'SARL' },
  { value: 'sa', label: 'SA' },
  { value: 'individual', label: 'Entreprise individuelle' },
  { value: 'association', label: 'Association' },
  { value: 'public', label: 'Organisme public' },
  { value: 'autre', label: 'Autre' },
];

const initialForm: FormData = {
  name: '',
  legal_name: '',
  business_type: '',
  rc_number: '',
  nif: '',
  contact_phone: '',
  address: '',
  city: 'Nouakchott',
  operator_method: 'Bankily',
  operator_phone: '',
  operator_label: '',
};

const initialFiles: KycFiles = {
  rc_url: null,
  nif_url: null,
  id_url: null,
};

const documentLabels: Record<KycKey, string> = {
  rc_url: 'Registre de commerce',
  nif_url: 'NIF',
  id_url: "Piece d'identite",
};

const kycKeys: KycKey[] = ['rc_url', 'nif_url', 'id_url'];

export default function MerchantOnboardingPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [files, setFiles] = useState<KycFiles>(initialFiles);
  const [selectedFiles, setSelectedFiles] =
    useState<SelectedFiles>({
      rc_url: null,
      nif_url: null,
      id_url: null,
    });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const result = await loadOnboardingData();

        if (cancelled) {
          return;
        }

        if (!result.ok) {
          setError(result.error ?? 'Impossible de charger le dossier.');
          return;
        }

        if (result.data) {
          setForm(current => ({
            ...current,
            name: result.data.name ?? current.name,
            legal_name:
              result.data.legal_name ?? current.legal_name,
            business_type:
              result.data.business_type ?? current.business_type,
            rc_number:
              result.data.rc_number ?? current.rc_number,
            nif: result.data.nif ?? current.nif,
            contact_phone:
              result.data.contact_phone ?? current.contact_phone,
            address: result.data.address ?? current.address,
            city: result.data.city ?? current.city,
            operator_method:
              result.data.operator_method ??
              current.operator_method,
            operator_phone:
              result.data.operator_phone ??
              current.operator_phone,
            operator_label:
              result.data.operator_label ??
              current.operator_label,
          }));

          setFiles({
            rc_url: result.data.rc_url ?? null,
            nif_url: result.data.nif_url ?? null,
            id_url: result.data.id_url ?? null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Une erreur est survenue.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  function updateField(
    field: keyof FormData,
    value: string
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  function handleFileChange(
    key: KycKey,
    file: File | null
  ) {
    setError(null);

    if (!file) {
      setSelectedFiles(current => ({
        ...current,
        [key]: null,
      }));
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        `${documentLabels[key]} : format non autorise. Utilisez PDF, JPG ou PNG.`
      );
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        `${documentLabels[key]} : fichier trop volumineux. Maximum 10 MB.`
      );
      return;
    }

    setSelectedFiles(current => ({
      ...current,
      [key]: file,
    }));
  }

  function validateStep(currentStep: number): boolean {
    setError(null);

    if (currentStep === 1) {
      if (!form.name.trim()) {
        setError('Le nom du commerce est obligatoire.');
        return false;
      }

      if (!form.legal_name.trim()) {
        setError('La raison sociale est obligatoire.');
        return false;
      }

      if (!form.business_type) {
        setError('Le type de commerce est obligatoire.');
        return false;
      }

      if (!form.rc_number.trim()) {
        setError('Le numero RC est obligatoire.');
        return false;
      }

      if (!form.nif.trim()) {
        setError('Le NIF est obligatoire.');
        return false;
      }

      return true;
    }

    if (currentStep === 2) {
      if (!form.contact_phone.trim()) {
        setError('Le numero de telephone est obligatoire.');
        return false;
      }

      if (!form.address.trim()) {
        setError("L'adresse est obligatoire.");
        return false;
      }

      if (!form.city.trim()) {
        setError('La ville est obligatoire.');
        return false;
      }

      return true;
    }

    if (currentStep === 3) {
      if (!form.operator_method) {
        setError('Selectionnez un operateur.');
        return false;
      }

      if (!form.operator_phone.trim()) {
        setError(
          "Le numero de telephone de l'operateur est obligatoire."
        );
        return false;
      }

      return true;
    }

    if (currentStep === 4) {
      for (const key of kycKeys) {
        if (!files[key] && !selectedFiles[key]) {
          setError(
            `Veuillez fournir : ${documentLabels[key]}.`
          );
          return false;
        }
      }

      return true;
    }

    return true;
  }

  async function uploadDocuments(): Promise<KycFiles | null> {
    const hasNewFile = kycKeys.some(
      key => selectedFiles[key] !== null
    );

    if (!hasNewFile) {
      return files;
    }

    setUploading(true);
    setError(null);

    const uploadedPaths: string[] = [];
    const nextFiles: KycFiles = {
      ...files,
    };

    try {
      for (const key of kycKeys) {
        const file = selectedFiles[key];

        if (!file) {
          continue;
        }

        const result = await createKycUpload(
          key,
          file.name
        );

        if (!result.ok || !result.path || !result.token) {
          throw new Error(
            result.error ??
              `Impossible de preparer le fichier ${documentLabels[key]}.`
          );
        }

        const { error: uploadError } =
          await supabase.storage
            .from('kyc-documents')
            .uploadToSignedUrl(
              result.path,
              result.token,
              file
            );

        if (uploadError) {
          throw new Error(
            uploadError.message ||
              `Impossible d'uploader ${documentLabels[key]}.`
          );
        }

        uploadedPaths.push(result.path);
        nextFiles[key] = result.path;
      }

      return nextFiles;
    } catch (err) {
      if (uploadedPaths.length > 0) {
        await cleanupKycUploads(uploadedPaths);
      }

      setError(
        err instanceof Error
          ? err.message
          : "Erreur pendant l'upload des documents."
      );

      return null;
    } finally {
      setUploading(false);
    }
  }

  async function goNext() {
    if (!validateStep(step)) {
      return;
    }

    if (step === 4) {
      const uploaded = await uploadDocuments();

      if (!uploaded) {
        return;
      }

      setFiles(uploaded);

      setSelectedFiles({
        rc_url: null,
        nif_url: null,
        id_url: null,
      });
    }

    setStep(current => Math.min(current + 1, 5));
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function goBack() {
    setError(null);
    setMessage(null);

    setStep(current => Math.max(current - 1, 1));

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function submit() {
    if (!validateStep(5)) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const uploaded = await uploadDocuments();

      if (!uploaded) {
        return;
      }

      setFiles(uploaded);

      const result = await submitOnboarding({
        name: form.name.trim(),
        legal_name: form.legal_name.trim(),
        business_type: form.business_type,
        rc_number: form.rc_number.trim(),
        nif: form.nif.trim(),
        contact_phone: form.contact_phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        operator_method: form.operator_method,
        operator_phone: form.operator_phone.trim(),
        operator_label: form.operator_label.trim(),
        rc_url: uploaded.rc_url,
        nif_url: uploaded.nif_url,
        id_url: uploaded.id_url,
      });

      if (!result.ok) {
        setError(
          result.error ??
            'Impossible de soumettre le dossier.'
        );
        return;
      }

      setMessage(
        'Votre dossier a ete soumis avec succes.'
      );

      setTimeout(() => {
        router.push('/dashboard?welcome=1');
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue pendant la soumission.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-neutral-600">
              Chargement de votre dossier...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-lg font-bold text-white">
              E
            </div>

            <span className="text-xl font-bold text-neutral-900">
              khlass
            </span>
          </div>

          <h1 className="text-2xl font-bold text-neutral-900">
            Dossier marchand
          </h1>

          <p className="mt-1 text-sm text-neutral-600">
            Completez ou modifiez les informations de votre
            entreprise.
          </p>
        </div>

        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="grid grid-cols-5 border-b border-neutral-200">
            <StepIndicator
              number={1}
              label="Identite"
              active={step === 1}
              completed={step > 1}
            />

            <StepIndicator
              number={2}
              label="Contact"
              active={step === 2}
              completed={step > 2}
            />

            <StepIndicator
              number={3}
              label="Operateur"
              active={step === 3}
              completed={step > 3}
            />

            <StepIndicator
              number={4}
              label="Documents"
              active={step === 4}
              completed={step > 4}
            />

            <StepIndicator
              number={5}
              label="Recapitulatif"
              active={step === 5}
              completed={false}
            />
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="rounded-xl bg-white p-5 shadow-sm sm:p-8">
          {step === 1 && (
            <section>
              <SectionTitle
                title="Identite de l'entreprise"
                description="Informations legales et commerciales."
              />

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="Nom du commerce"
                  value={form.name}
                  onChange={value =>
                    updateField('name', value)
                  }
                  placeholder="Ex: Boutique E-khlass"
                  required
                />

                <Field
                  label="Raison sociale"
                  value={form.legal_name}
                  onChange={value =>
                    updateField('legal_name', value)
                  }
                  placeholder="Ex: E-khlass SARL"
                  required
                />

                <SelectField
                  label="Type de commerce"
                  value={form.business_type}
                  onChange={value =>
                    updateField('business_type', value)
                  }
                  options={businessTypes}
                  required
                />

                <Field
                  label="Numero RC"
                  value={form.rc_number}
                  onChange={value =>
                    updateField('rc_number', value)
                  }
                  placeholder="Numero du registre de commerce"
                  required
                />

                <Field
                  label="NIF"
                  value={form.nif}
                  onChange={value =>
                    updateField('nif', value)
                  }
                  placeholder="Numero d'identification fiscale"
                  required
                />
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <SectionTitle
                title="Coordonnees"
                description="Comment pouvons-nous vous contacter ?"
              />

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="Telephone"
                  value={form.contact_phone}
                  onChange={value =>
                    updateField('contact_phone', value)
                  }
                  placeholder="+222 ..."
                  type="tel"
                  required
                />

                <Field
                  label="Ville"
                  value={form.city}
                  onChange={value =>
                    updateField('city', value)
                  }
                  placeholder="Nouakchott"
                  required
                />

                <div className="md:col-span-2">
                  <Field
                    label="Adresse"
                    value={form.address}
                    onChange={value =>
                      updateField('address', value)
                    }
                    placeholder="Adresse complete"
                    required
                  />
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <SectionTitle
                title="Operateur de paiement"
                description="Selectionnez votre operateur et indiquez le numero utilise."
              />

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <SelectField
                  label="Operateur"
                  value={form.operator_method}
                  onChange={value =>
                    updateField('operator_method', value)
                  }
                  options={operators.map(operator => ({
                    value: operator,
                    label: operator,
                  }))}
                  required
                />

                <Field
                  label="Telephone de l'operateur"
                  value={form.operator_phone}
                  onChange={value =>
                    updateField('operator_phone', value)
                  }
                  placeholder="+222 ..."
                  type="tel"
                  required
                />

                <div className="md:col-span-2">
                  <Field
                    label="Libelle ou identifiant"
                    value={form.operator_label}
                    onChange={value =>
                      updateField('operator_label', value)
                    }
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-800">
                  Operateurs disponibles
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {operators.map(operator => (
                    <span
                      key={operator}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700"
                    >
                      {operator}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <SectionTitle
                title="Documents KYC"
                description="Ajoutez les documents necessaires a la verification de votre entreprise."
              />

              <div className="mt-6 space-y-5">
                <DocumentUpload
                  label="Registre de commerce"
                  required
                  existingPath={files.rc_url}
                  selectedFile={selectedFiles.rc_url}
                  onChange={file =>
                    handleFileChange('rc_url', file)
                  }
                />

                <DocumentUpload
                  label="NIF"
                  required
                  existingPath={files.nif_url}
                  selectedFile={selectedFiles.nif_url}
                  onChange={file =>
                    handleFileChange('nif_url', file)
                  }
                />

                <DocumentUpload
                  label="Piece d'identite"
                  required
                  existingPath={files.id_url}
                  selectedFile={selectedFiles.id_url}
                  onChange={file =>
                    handleFileChange('id_url', file)
                  }
                />
              </div>

              <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                Formats acceptes : PDF, JPG et PNG.
                <br />
                Taille maximale : 10 MB par document.
              </div>
            </section>
          )}

          {step === 5 && (
            <section>
              <SectionTitle
                title="Recapitulatif"
                description="Verifiez toutes les informations avant de soumettre votre dossier."
              />

              <div className="mt-6 space-y-6">
                <SummarySection title="Identite">
                  <SummaryRow
                    label="Nom du commerce"
                    value={form.name}
                  />

                  <SummaryRow
                    label="Raison sociale"
                    value={form.legal_name}
                  />

                  <SummaryRow
                    label="Type"
                    value={
                      businessTypes.find(
                        type =>
                          type.value === form.business_type
                      )?.label ??
                      form.business_type
                    }
                  />

                  <SummaryRow
                    label="N° RC"
                    value={form.rc_number}
                  />

                  <SummaryRow
                    label="NIF"
                    value={form.nif}
                  />
                </SummarySection>

                <SummarySection title="Coordonnees">
                  <SummaryRow
                    label="Telephone"
                    value={form.contact_phone}
                  />

                  <SummaryRow
                    label="Adresse"
                    value={form.address}
                  />

                  <SummaryRow
                    label="Ville"
                    value={form.city}
                  />
                </SummarySection>

                <SummarySection title="Operateur">
                  <SummaryRow
                    label="Operateur"
                    value={form.operator_method}
                  />

                  <SummaryRow
                    label="Telephone"
                    value={form.operator_phone}
                  />

                  <SummaryRow
                    label="Libelle"
                    value={form.operator_label || '—'}
                  />
                </SummarySection>

                <SummarySection title="Documents">
                  {kycKeys.map(key => (
                    <SummaryRow
                      key={key}
                      label={documentLabels[key]}
                      value={
                        files[key]
                          ? 'Document fourni'
                          : 'Document manquant'
                      }
                    />
                  ))}
                </SummarySection>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  En cliquant sur "Soumettre le dossier",
                  vous envoyez ces informations pour verification
                  KYC.
                </div>
              </div>
            </section>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={saving || uploading}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Retour
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {step < 5 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={uploading}
                  className="w-full rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {uploading
                    ? 'Upload en cours...'
                    : 'Continuer'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving || uploading}
                  className="w-full rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving
                    ? 'Soumission en cours...'
                    : 'Soumettre le dossier'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StepIndicator({
  number,
  label,
  active,
  completed,
}: {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-1 px-1 py-3 text-center sm:flex-row sm:justify-center sm:gap-2 ${
        active
          ? 'bg-neutral-900 text-white'
          : completed
            ? 'bg-neutral-100 text-neutral-800'
            : 'bg-white text-neutral-400'
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active
            ? 'bg-white text-neutral-900'
            : completed
              ? 'bg-neutral-900 text-white'
              : 'bg-neutral-200 text-neutral-500'
        }`}
      >
        {completed ? '✓' : number}
      </span>

      <span className="truncate text-[10px] font-medium sm:text-xs">
        {label}
      </span>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-neutral-900">
        {title}
      </h2>

      <p className="mt-1 text-sm text-neutral-500">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={event =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>

      <select
        value={value}
        onChange={event =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700"
      >
        <option value="">Selectionner</option>

        {options.map(option => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DocumentUpload({
  label,
  required,
  existingPath,
  selectedFile,
  onChange,
}: {
  label: string;
  required?: boolean;
  existingPath: string | null;
  selectedFile: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-800">
            {label}
            {required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </p>

          {existingPath && !selectedFile && (
            <p className="mt-1 text-xs text-emerald-600">
              Document deja fourni.
            </p>
          )}

          {selectedFile && (
            <p className="mt-1 break-all text-xs text-blue-600">
              Nouveau fichier : {selectedFile.name}
            </p>
          )}
        </div>
      </div>

      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={event =>
          onChange(event.target.files?.[0] ?? null)
        }
        className="block w-full cursor-pointer rounded-lg border border-neutral-300 bg-white text-sm text-neutral-600 file:mr-4 file:border-0 file:bg-neutral-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-200"
      />
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-neutral-800">
          {title}
        </h3>
      </div>

      <div className="divide-y divide-neutral-100">
        {children}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>

      <span className="break-all text-sm text-neutral-900 sm:text-right">
        {value || '—'}
      </span>
    </div>
  );
}
