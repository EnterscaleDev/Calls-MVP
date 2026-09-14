/**
 * SMS segment-count estimation — used by the Invitations composer to show
 * "~N SMS segments" as the admin types. Provider-agnostic (GSM-7 vs UCS-2,
 * single vs concatenated-message limits), so it stays here rather than in
 * lib/adapters/sms-dotgo.ts, which is Dotgo-specific.
 */
export function estimateSegments(body: string): number {
  const gsm7 = /^[\x00-\x7F£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#$%&'()*+,\-./0-9:;<=>?A-Z¡ÄÖÑÜ§¿a-zäöñüà]*$/.test(
    body
  );
  const singleLimit = gsm7 ? 160 : 70;
  const multiLimit = gsm7 ? 153 : 67;
  if (body.length === 0) return 0;
  if (body.length <= singleLimit) return 1;
  return Math.ceil(body.length / multiLimit);
}
