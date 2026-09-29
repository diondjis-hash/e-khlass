import { createSupabaseAdminClient } from '@/lib/supabase/server';

const KYC_BUCKET = 'kyc-documents';

export type KycDocumentKey = 'rc_url' | 'nif_url' | 'id_url';

export async function signedUrlFor(
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  const { data } = await admin.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, expiresIn);

  return data?.signedUrl ?? null;
}

export async function createKycUploadUrl(
  merchantId: string,
  documentKey: KycDocumentKey,
  filename: string
): Promise<{
  ok: boolean;
  path?: string;
  token?: string;
  error?: string;
}> {
  const admin = createSupabaseAdminClient();

  const safeName = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-100);

  const path = `${merchantId}/${documentKey}-${crypto.randomUUID()}-${
    safeName || 'document'
  }`;

  const { data, error } = await admin.storage
    .from(KYC_BUCKET)
    .createSignedUploadUrl(path, {
      upsert: false,
    });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    path: data.path,
    token: data.token,
  };
}

export async function removeKycDocs(
  paths: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (!paths.length) {
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin.storage
    .from(KYC_BUCKET)
    .remove(paths);

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return { ok: true };
}

export async function uploadKycDoc(
  merchantId: string,
  filename: string,
  bytes: ArrayBuffer,
  mimeType: string
): Promise<{
  ok: boolean;
  path?: string;
  error?: string;
}> {
  const admin = createSupabaseAdminClient();

  const safeName = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-100);

  const path = `${merchantId}/${Date.now()}-${
    safeName || 'document'
  }`;

  const { error } = await admin.storage
    .from(KYC_BUCKET)
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: true,
    path,
  };
}