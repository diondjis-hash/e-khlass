import { createSupabaseAdminClient } from '@/lib/supabase/server';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_kyc: 'KYC en attente',
    active: 'Actif',
    suspended: 'Suspendu',
    closed: 'Fermé',
  };
  return labels[status] ?? status;
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    pending_kyc: 'bg-amber-50 text-amber-700 ring-amber-200',
    active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    suspended: 'bg-orange-50 text-orange-700 ring-orange-200',
    closed: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  };
  return classes[status] ?? 'bg-neutral-100 text-neutral-600 ring-neutral-200';
}

export default async function AdminMerchantsPage() {
  const admin = createSupabaseAdminClient();

  const { data: merchants, error } = await admin
    .from('merchants')
    .select(
      'id, name, legal_name, business_type, rc_number, nif, contact_email, contact_phone, city, status, kyc_verified_at, created_at, updated_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Tous les marchands</h1>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger les marchands.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Tous les marchands</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Liste complète des marchands enregistrés sur E-khlass.
          </p>
        </div>

        <div className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700">
          {merchants?.length ?? 0} marchand{(merchants?.length ?? 0) > 1 ? 's' : ''}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="px-4 py-3 font-semibold text-neutral-700">Marchand</th>
                <th className="px-4 py-3 font-semibold text-neutral-700">Contact</th>
                <th className="px-4 py-3 font-semibold text-neutral-700">Ville</th>
                <th className="px-4 py-3 font-semibold text-neutral-700">Statut</th>
                <th className="px-4 py-3 font-semibold text-neutral-700">Créé le</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {(merchants ?? []).map((merchant) => (
                <tr key={merchant.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-neutral-900">
                      {merchant.name}
                    </div>

                    <div className="mt-1 text-xs text-neutral-500">
                      {merchant.legal_name || merchant.business_type || '—'}
                    </div>

                    {(merchant.rc_number || merchant.nif) && (
                      <div className="mt-1 text-xs text-neutral-400">
                        {merchant.rc_number
                          ? `RC: ${merchant.rc_number}`
                          : ''}
                        {merchant.rc_number && merchant.nif ? ' · ' : ''}
                        {merchant.nif ? `NIF: ${merchant.nif}` : ''}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    <div className="text-neutral-800">
                      {merchant.contact_email || '—'}
                    </div>

                    <div className="mt-1 text-xs text-neutral-500">
                      {merchant.contact_phone || '—'}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-neutral-700">
                    {merchant.city || '—'}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusClass(
                        merchant.status
                      )}`}
                    >
                      {statusLabel(merchant.status)}
                    </span>

                    {merchant.kyc_verified_at && (
                      <div className="mt-1 text-xs text-neutral-400">
                        KYC: {formatDate(merchant.kyc_verified_at)}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-neutral-600">
                    {formatDate(merchant.created_at)}
                  </td>
                </tr>
              ))}

              {(merchants ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-neutral-500"
                  >
                    Aucun marchand enregistré pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
