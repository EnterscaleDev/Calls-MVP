// Credit balances themselves now live in the mock store (db.orgCredits) so
// "Top up" can actually add to them. This file just holds the shared mock
// pricing/package constants that don't belong to any one page.

/** Mock cost, in SMS credits, of a single SMS segment. */
export const SMS_CREDIT_COST_PER_SEGMENT = 1;

export interface TopUpPackage {
  id: string;
  label: string;
  amount: number;
}

// There's no real payment provider wired up — these packages just add mock
// credits to db.orgCredits so the app stays usable while you test sends and
// calls. No charge occurs anywhere.
export const SMS_TOP_UP_PACKAGES: TopUpPackage[] = [
  { id: "sms_1000", label: "1,000 SMS credits", amount: 1000 },
  { id: "sms_5000", label: "5,000 SMS credits", amount: 5000 },
  { id: "sms_20000", label: "20,000 SMS credits", amount: 20000 },
];

export const VOICE_TOP_UP_PACKAGES: TopUpPackage[] = [
  { id: "voice_250", label: "250 voice minutes", amount: 250 },
  { id: "voice_1000", label: "1,000 voice minutes", amount: 1000 },
  { id: "voice_5000", label: "5,000 voice minutes", amount: 5000 },
];
