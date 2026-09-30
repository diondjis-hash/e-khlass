‘use client’;

import { useEffect, useState } from ‘react’;
import { useRouter } from ‘next/navigation’;
import { createSupabaseBrowserClient } from ‘@/lib/supabase/client’;
import {
cleanupKycUploads,
createKycUpload,
finishOnboarding,
loadOnboardingData,
submitOnboarding,
} from ‘./actions’;

type KycKey = ‘rc_url’ | ‘nif_url’ | ‘id_url’;

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

const operators = [
‘Bankily’,
‘Masrvi’,
‘Sedad’,
‘BIM’,
‘Click’,
];

const businessTypes = [
{ value: ‘sarl’, label: ‘SARL’ },
{ value: ‘sa’, label: ‘SA’ },
{ value: ‘individual’, label: ‘Entreprise individuelle’ },
{ value: ‘association’, label: ‘Association’ },
{ value: ‘public’, label: ‘Entreprise publique’ },
{ value: ‘autre’, label: ‘Autre’ },
];

const emptyForm: FormData = {
name: ‘’,
legal_name: ‘’,
business_type: ‘’,
rc_number: ‘’,
nif: ‘’,
contact_phone: ‘’,
address: ‘’,
city: ‘Nouakchott’,
operator_method: ‘Bankily’,
operator_phone: ‘’,
operator_label: ‘’,
};

const emptyFiles: KycFiles = {
rc_url: null,
nif_url: null,
id_url: null,
};

const documentLabels: Record<KycKey, string> = {
rc_url: ‘Registre de commerce’,
nif_url: ‘NIF’,
id_url: “Pièce d’identité”,
};

export default function MerchantOnboardingPage() {
const router = useRouter();
const supabase = createSupabaseBrowserClient();

const [step, setStep] = useState(1);
const [form, setForm] = useState(emptyForm);
const [files, setFiles] = useState(emptyFiles);

const [selectedFiles, setSelectedFiles] = useState<
Partial<Record<KycKey, File>>

({});

const [loading, setLoading] = useState(true);
const [uploading, setUploading] = useState(false);
const [submitting, setSubmitting] = useState(false);

const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);

useEffect(() => {
let mounted = true;

async function load() {
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
  if (!mounted) return;
  if (!result.ok || !result.form) {
    setError(result.error ?? 'Impossible de charger votre dossier.');
    setLoading(false);
    return;
  }
  setForm({
    name: result.form.name ?? '',
    legal_name: result.form.legal_name ?? '',
    business_type: result.form.business_type ?? '',
    rc_number: result.form.rc_number ?? '',
    nif: result.form.nif ?? '',
    contact_phone: result.form.contact_phone ?? '',
    address: result.form.address ?? '',
    city: result.form.city ?? 'Nouakchott',
    operator_method: result.form.operator_method ?? 'Bankily',
    operator_phone: result.form.operator_phone ?? '',
    operator_label: result.form.operator_label ?? '',
  });
  setFiles({
    rc_url: result.documents?.rc_url ?? null,
    nif_url: result.documents?.nif_url ?? null,
    id_url: result.documents?.id_url ?? null,
  });
  setLoading(false);
}
load();
return () => {
  mounted = false;
};

}, [router, supabase.auth]);

function updateField(
key: K,
value: FormData[K]
) {
setForm(prev => ({
…prev,
[key]: value,
}));
}

function selectFile(key: KycKey, file: File | undefined) {
if (!file) return;

setError(null);
const allowed = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];
if (!allowed.includes(file.type)) {
  setError(
    `${documentLabels[key]} : format accepté PDF, JPG ou PNG.`
  );
  return;
}
if (file.size > 10 * 1024 * 1024) {
  setError(
    `${documentLabels[key]} : taille maximale 10 Mo.`
  );
  return;
}
setSelectedFiles(prev => ({
  ...prev,
  [key]: file,
}));

}

function validateStep(currentStep: number) {
setError(null);

if (currentStep === 1) {
  if (!form.name.trim()) {
    setError('Le nom commercial est obligatoire.');
    return false;
  }
  if (!form.business_type) {
    setError('Veuillez sélectionner la forme juridique.');
    return false;
  }
  return true;
}
if (currentStep === 2) {
  if (!form.contact_phone.trim()) {
    setError('Le numéro de téléphone est obligatoire.');
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
    setError('Veuillez sélectionner un opérateur.');
    return false;
  }
  if (!form.operator_phone.trim()) {
    setError(
      'Le numéro de téléphone de l’opérateur est obligatoire.'
    );
    return false;
  }
  return true;
}
if (currentStep === 4) {
  for (const key of [
    'rc_url',
    'nif_url',
    'id_url',
  ] as KycKey[]) {
    const hasExisting = Boolean(files[key]);
    const hasNew = Boolean(selectedFiles[key]);
    if (!hasExisting && !hasNew) {
      setError(
        `${documentLabels[key]} est obligatoire.`
      );
      return false;
    }
  }
  return true;
}
return true;

}

function nextStep() {
if (!validateStep(step)) return;

setStep(prev => Math.min(5, prev + 1));

}

function previousStep() {
setError(null);
setSuccess(null);
setStep(prev => Math.max(1, prev - 1));
}

async function uploadDocuments(): Promise<KycFiles | null> {
const nextFiles: KycFiles = {
…files,
};

const uploadedPaths: string[] = [];
try {
  for (const key of [
    'rc_url',
    'nif_url',
    'id_url',
  ] as KycKey[]) {
    const file = selectedFiles[key];
    if (!file) continue;
    const result = await createKycUpload(
      key,
      file.name,
      file.type,
      file.size
    );
    if (!result.ok || !result.path || !result.token) {
      throw new Error(
        result.error ??
          `Impossible de préparer ${documentLabels[key]}.`
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
        `Erreur upload ${documentLabels[key]} : ${uploadError.message}`
      );
    }
    nextFiles[key] = result.path;
    uploadedPaths.push(result.path);
  }
  return nextFiles;
} catch (err) {
  if (uploadedPaths.length) {
    await cleanupKycUploads(uploadedPaths);
  }
  throw err;
}

}

async function submit() {
if (!validateStep(4)) {
setStep(4);
return;
}

setSubmitting(true);
setUploading(true);
setError(null);
setSuccess(null);
try {
  const nextFiles = await uploadDocuments();
  if (!nextFiles) {
    throw new Error(
      'Impossible de préparer les documents.'
    );
  }
  setFiles(nextFiles);
  setUploading(false);
  const result = await submitOnboarding(
    {
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
    },
    {
      rc_url: nextFiles.rc_url!,
      nif_url: nextFiles.nif_url!,
      id_url: nextFiles.id_url!,
    }
  );
  if (!result.ok) {
    throw new Error(
      result.error ??
        'Impossible d’enregistrer le dossier.'
    );
  }
  setSuccess(
    'Votre dossier a été enregistré et envoyé pour vérification.'
  );
  setTimeout(() => {
    router.push('/dashboard?welcome=1');
  }, 800);
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : 'Une erreur est survenue.'
  );
} finally {
  setUploading(false);
  setSubmitting(false);
}

}

if (loading) {
return (
Chargement de votre dossier…
);
}

return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => router.push('/dashboard')}
        className="text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Retour au tableau de bord
      </button>
      <div className="mt-4">
        <h1 className="text-2xl font-bold text-neutral-900">
          Mon dossier marchand
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Vérifiez et modifiez vos informations avant de soumettre
          votre dossier.
        </p>
      </div>
    </div>
    <div className="mb-6 grid grid-cols-5 gap-1">
      {[
        'Identité',
        'Contact',
        'Opérateur',
        'Documents',
        'Récapitulatif',
      ].map((label, index) => {
        const number = index + 1;
        const active = number === step;
        const completed = number < step;
        return (
          <div key={label} className="text-center">
            <div
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                active || completed
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-200 text-neutral-500'
              }`}
            >
              {number}
            </div>
            <p
              className={`mt-1 hidden text-[10px] sm:block ${
                active
                  ? 'font-semibold text-neutral-900'
                  : 'text-neutral-500'
              }`}
            >
              {label}
            </p>
          </div>
        );
      })}
    </div>
    {error && (
      <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    )}
    {success && (
      <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
        {success}
      </div>
    )}
    <div className="rounded-xl bg-white p-5 shadow-sm sm:p-8">
      {step === 1 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">
            Identité de l’entreprise
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Informations générales de votre activité.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="Nom commercial *"
              value={form.name}
              onChange={value =>
                updateField('name', value)
              }
              placeholder="Ex : Boutique Amadou"
            />
            <Field
              label="Raison sociale"
              value={form.legal_name}
              onChange={value =>
                updateField('legal_name', value)
              }
              placeholder="Ex : E-khlass SARL"
            />
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Forme juridique *
              </label>
              <select
                value={form.business_type}
                onChange={e =>
                  updateField(
                    'business_type',
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
              >
                <option value="">
                  Sélectionner
                </option>
                {businessTypes.map(type => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="N° Registre de commerce"
              value={form.rc_number}
              onChange={value =>
                updateField('rc_number', value)
              }
              placeholder="RC"
            />
            <Field
              label="NIF"
              value={form.nif}
              onChange={value =>
                updateField('nif', value)
              }
              placeholder="NIF"
            />
          </div>
        </section>
      )}
      {step === 2 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">
            Contact
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Coordonnées du marchand.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field
              label="Téléphone *"
              value={form.contact_phone}
              onChange={value =>
                updateField(
                  'contact_phone',
                  value
                )
              }
              placeholder="+222 ..."
            />
            <Field
              label="Ville *"
              value={form.city}
              onChange={value =>
                updateField('city', value)
              }
              placeholder="Nouakchott"
            />
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-neutral-700">
                Adresse
              </label>
              <textarea
                value={form.address}
                onChange={e =>
                  updateField(
                    'address',
                    e.target.value
                  )
                }
                rows={3}
                placeholder="Adresse du commerce"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
              />
            </div>
          </div>
        </section>
      )}
      {step === 3 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">
            Opérateur de paiement
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Sélectionnez le moyen de paiement utilisé pour recevoir
            vos paiements.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-neutral-700">
                Opérateur *
              </label>
              <select
                value={form.operator_method}
                onChange={e =>
                  updateField(
                    'operator_method',
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
              >
                {operators.map(operator => (
                  <option
                    key={operator}
                    value={operator}
                  >
                    {operator}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Numéro de l’opérateur *"
              value={form.operator_phone}
              onChange={value =>
                updateField(
                  'operator_phone',
                  value
                )
              }
              placeholder="+222 ..."
            />
            <Field
              label="Libellé"
              value={form.operator_label}
              onChange={value =>
                updateField(
                  'operator_label',
                  value
                )
              }
              placeholder="Ex : Compte principal"
            />
          </div>
        </section>
      )}
      {step === 4 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">
            Documents KYC
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Ajoutez les trois documents nécessaires à la vérification.
            PDF, JPG ou PNG — 10 Mo maximum par document.
          </p>
          <div className="mt-6 space-y-4">
            {(
              [
                'rc_url',
                'nif_url',
                'id_url',
              ] as KycKey[]
            ).map(key => (
              <DocumentUpload
                key={key}
                label={documentLabels[key]}
                existingPath={files[key]}
                selectedFile={selectedFiles[key]}
                onSelect={file =>
                  selectFile(key, file)
                }
              />
            ))}
          </div>
        </section>
      )}
      {step === 5 && (
        <section>
          <h2 className="text-lg font-semibold text-neutral-900">
            Récapitulatif
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Vérifiez vos informations avant l’envoi.
          </p>
          <div className="mt-6 space-y-5">
            <SummarySection title="Identité">
              <SummaryRow
                label="Nom commercial"
                value={form.name}
              />
              <SummaryRow
                label="Raison sociale"
                value={form.legal_name}
              />
              <SummaryRow
                label="Forme juridique"
                value={
                  businessTypes.find(
                    x =>
                      x.value ===
                      form.business_type
                  )?.label ??
                  form.business_type
                }
              />
              <SummaryRow
                label="RC"
                value={form.rc_number}
              />
              <SummaryRow
                label="NIF"
                value={form.nif}
              />
            </SummarySection>
            <SummarySection title="Contact">
              <SummaryRow
                label="Téléphone"
                value={form.contact_phone}
              />
              <SummaryRow
                label="Ville"
                value={form.city}
              />
              <SummaryRow
                label="Adresse"
                value={form.address}
              />
            </SummarySection>
            <SummarySection title="Opérateur">
              <SummaryRow
                label="Opérateur"
                value={form.operator_method}
              />
              <SummaryRow
                label="Numéro"
                value={form.operator_phone}
              />
              <SummaryRow
                label="Libellé"
                value={form.operator_label}
              />
            </SummarySection>
            <SummarySection title="Documents">
              {(
                [
                  'rc_url',
                  'nif_url',
                  'id_url',
                ] as KycKey[]
              ).map(key => (
                <SummaryRow
                  key={key}
                  label={documentLabels[key]}
                  value={
                    selectedFiles[key]?.name ??
                    (files[key]
                      ? 'Document déjà enregistré'
                      : 'Non fourni')
                  }
                />
              ))}
            </SummarySection>
          </div>
        </section>
      )}
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={previousStep}
          disabled={step === 1 || submitting}
          className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Précédent
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={nextStep}
            className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white"
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? uploading
                ? 'Envoi des documents…'
                : 'Enregistrement…'
              : 'Confirmer et envoyer'}
          </button>
        )}
      </div>
    </div>
  </div>
</main>

);
}

function Field({
label,
value,
onChange,
placeholder,
}: {
label: string;
value: string;
onChange: (value: string) => void;
placeholder?: string;
}) {
return (
{label}
  <input
    value={value}
    onChange={e =>
      onChange(e.target.value)
    }
    placeholder={placeholder}
    className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
  />
</div>

);
}

function DocumentUpload({
label,
existingPath,
selectedFile,
onSelect,
}: {
label: string;
existingPath: string | null;
selectedFile?: File;
onSelect: (file: File | undefined) => void;
}) {
return (
    <div>
      <p className="text-sm font-medium text-neutral-900">
        {label}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        {selectedFile
          ? `Nouveau fichier : ${selectedFile.name}`
          : existingPath
            ? 'Document déjà enregistré'
            : 'Document obligatoire'}
      </p>
    </div>
    <label className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-4 py-2 text-center text-xs font-medium text-neutral-700 hover:bg-neutral-50">
      {selectedFile
        ? 'Changer'
        : existingPath
          ? 'Remplacer'
          : 'Choisir un fichier'}
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={e =>
          onSelect(
            e.target.files?.[0]
          )
        }
      />
    </label>
  </div>
</div>

);
}

function SummarySection({
title,
children,
}: {
title: string;
children: React.ReactNode;
}) {
return (
{title}
  <div className="mt-3 space-y-2">
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
value: string | null | undefined;
}) {
return (
{label}
  <span className="text-sm text-neutral-900 sm:text-right">
    {value || '—'}
  </span>
</div>

);
}