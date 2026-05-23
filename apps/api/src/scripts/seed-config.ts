// Helper for the seed script. Lives in its own file so the unit
// test can import it without triggering seed.ts's top-level
// `main().catch(...)` (which would open a Prisma connection just
// from the import).

// Same email for both seed accounts is the foot-gun this guards:
// the seed upserts admin first then user. If both emails resolve
// to the same row, the second upsert flips role from admin → user
// and the deployment is left without an enabled admin. The most
// likely way to hit this is a VPS operator pasting their own
// address into both SEED_*_EMAIL slots.
//
// Compared case-insensitively because the schema's `email` column
// is citext: two strings that differ only in case land on the
// same row, so we must reject them too.
export function assertDistinctSeedEmails(
  adminEmail: string,
  userEmail: string,
): void {
  const a = adminEmail.trim().toLowerCase();
  const u = userEmail.trim().toLowerCase();
  if (a === u) {
    throw new Error(
      `SEED_ADMIN_EMAIL and SEED_USER_EMAIL must be different. ` +
        `Both resolved to "${adminEmail}". Use an alias such as ` +
        `"${suggestAlias(adminEmail)}" for the regular user, ` +
        `or pick a different mailbox.`,
    );
  }
}

// "+user" alias for the suggestion — works on every mailer that
// supports plus-addressing (Gmail, Fastmail, most corporate
// Exchange tenants). Falls back to a generic suggestion if the
// input doesn't look like an email.
function suggestAlias(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    return "trainee@example.local";
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  // Avoid stacking plus-tags ("foo+user+user@…") if the operator
  // already has one in the local-part.
  if (local.includes("+")) return `${local}.user@${domain}`;
  return `${local}+user@${domain}`;
}
