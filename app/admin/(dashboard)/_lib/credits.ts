// Presentational-only mock credit balances — there's no real billing backend
// yet. Shared so the top-bar chips, Overview's hero card, and the
// Invitations cost estimate all read the same numbers.

export const MOCK_SMS_CREDITS = 4180;
export const MOCK_VOICE_MINUTES = 860;

/** Mock cost, in SMS credits, of a single SMS segment. */
export const SMS_CREDIT_COST_PER_SEGMENT = 1;
