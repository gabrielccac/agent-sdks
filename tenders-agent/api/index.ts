import { fetchComprasNetData } from './comprasnet.js';
import type { ApiTenderData } from './types.js';

export type { ApiTenderData, ApiItem, ApiGroup } from './types.js';

// Detect which platform from the tender URL stored in Airtable
function detectPlatform(url: string): 'comprasnet' | 'pncp' | 'unknown' {
  if (url.includes('cnetmobile.estaleiro') || url.includes('comprasnet')) return 'comprasnet';
  if (url.includes('pncp.gov.br'))                                         return 'pncp';
  return 'unknown';
}

export async function fetchTenderApiData(
  codigoCompra: string,
  tenderUrl:    string,
  captcha:      string,
): Promise<ApiTenderData> {
  const platform = detectPlatform(tenderUrl);

  switch (platform) {
    case 'comprasnet':
      return fetchComprasNetData(codigoCompra, captcha);

    case 'pncp':
      // TODO: implement PNCP client
      throw new Error('PNCP API client not yet implemented');

    default:
      throw new Error(`Unknown platform for URL: ${tenderUrl}`);
  }
}
