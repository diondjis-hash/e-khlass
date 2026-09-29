'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from '@/lib/supabase/server';
import {
  createKycUploadUrl,
  removeKycDocs,
  type KycDocumentKey,
} from '@/lib/storage';

const KYC_KEYS: KycDocumentKey[] = ['rc_url', 'nif_url', 'id_url'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

const MAX_KYC_FILE_SIZE = 10 * 1024 * 1024;

type KycDocuments = {
  rc_url: string;
  nif_url: string;
  id_url: string;
};

type OnboardingPayload = {
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

async function getMerchantContext() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { error: 'Non authentifié' as const };
  }

  const { data: members, error: memErr } = await supabase
    .from('merchant_members')
    .select('merchant_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .limit(1);

  if (memErr || !members || members.length === 0) {
    return {
      error: 'Aucun merchant trouvé pour ce compte' as const,
    };
  }

  return {
    merchantId: members[0].merchant_id,
  };
}

export async function createKycUpload(
  documentKey: KycDocumentKey,
  filename: string,
  mimeType: string,
  size: number
): Promise<{
  ok: boolean;
  path?: string;
  token?: string;
  error?: string;
}> {
  const context = await getMerchantContext();

  if ('error' in context) {
    return {
      ok: false,
      error: context.error,
    };
  }

  if (!KYC_KEYS.includes(documentKey)) {
    return {
      ok: false,
      error: 'Type de document KYC invalide.',
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      ok: false,
      error: 'Format accepté : PDF, JPG ou PNG.',
    };
  }

  if (!size || size > MAX_KYC_FILE_SIZE) {
    return {
      ok: false,
      error: 'Chaque document doit faire au maximum 10 Mo.',
    };
  }

  return createKycUploadUrl(
    context.merchantId,
    documentKey,
    filename
  );
}

export async function cleanupKycUploads(
  paths: string[]
): Promise<{
  ok: boolean;
  error?: string;
}> {
  const context = await getMerchantContext();

  if ('error' in context) {
    return {
      ok: false,
      error: context.error,
    };
  }

  const safePaths = paths.filter((path) =>
    path.startsWith(`${context.merchantId}/`)
  );

  return removeKycDocs(safePaths);
}

export async function submitOnboarding(
  payload: OnboardingPayload,
  kycDocuments: KycDocuments
): Promise<{
  ok: boolean;
  error?: string;
}> {
  const context = await getMerchantContext();

  if ('error' in context) {
    return {
      ok: false,
      error: context.error,
    };
  }

  for (const key of KYC_KEYS) {
    const path = kycDocuments[key];

    if (
      !path ||
      !path.startsWith(`${context.merchantId}/`)
    ) {
      return {
        ok: false,
        error: 'Les trois documents KYC sont obligatoires.',
      };
    }
  }

  const admin = createSupabaseAdminClient();

  const {
    data: currentMerchant,
    error: currentErr,
  } = await admin
    .from('merchants')
    .select('status, kyc_verified_at')
    .eq('id', context.merchantId)
    .maybeSingle();

  if (currentErr || !currentMerchant) {
    return {
      ok: false,
      error: 'Marchand introuvable.',
    };
  }

  const isAlreadyVerified =
    Boolean(currentMerchant.kyc_verified_at);

  const { error: updateErr } = await admin
    .from('merchants')
    .update({
      name: payload.name,
      legal_name: payload.legal_name || null,
      business_type: payload.business_type || null,
      rc_number: payload.rc_number || null,
      nif: payload.nif || null,
      contact_phone: payload.contact_phone || null,
      address: payload.address || null,
      city: payload.city || 'Nouakchott',
      kyc_documents: kycDocuments,

      ...(isAlreadyVerified
        ? {}
        : {
            status: 'pending_kyc',
            kyc_verified_at: null,
            kyc_notes: null,
          }),

      updated_at: new Date().toISOString(),
    })
    .eq('id', context.merchantId);

  if (updateErr) {
    return {
      ok: false,
      error: `Update merchant failed: ${updateErr.message}`,
    };
  }

  const phoneClean = payload.operator_phone.replace(/\s+/g, '');

  const { error: opErr } = await admin
    .from('merchant_operators')
    .insert({
      merchant_id: context.merchantId,
      method: payload.operator_method,
      expected_phone: phoneClean,
      label:
        payload.operator_label ||
        `${payload.operator_method} principal`,
      enabled: true,
    });

  if (opErr && !opErr.message.includes('duplicate')) {
    return {
      ok: false,
      error: `Insert operator failed: ${opErr.message}`,
    };
  }

  revalidatePath('/admin/kyc');
  revalidatePath('/dashboard');

  return {
    ok: true,
  };
}

export async function finishOnboarding(): Promise<never> {
  redirect('/dashboard?welcome=1');
}