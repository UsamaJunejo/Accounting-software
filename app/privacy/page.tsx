import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="5 November 2026">
      <p>
        FinanceChachu (&ldquo;we&rdquo;) helps you keep your business accounts. This page explains, in plain words, what
        information we keep and how we look after it.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details you give us: name, email, mobile number, business name, address and NTN (optional).</li>
        <li>Your bookkeeping data: accounts, entries, notes, invoices, projects and any bills or receipts you attach.</li>
        <li>Next-of-kin details, if you choose to add them.</li>
        <li>Basic technical information needed to run the service, such as sign-in times and failed sign-in attempts (to stop password guessing).</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>Only to provide FinanceChachu to you: showing your books, reports, invoices and khata.</li>
        <li>To help you if you lose access (for example, an admin resetting your password at your request).</li>
        <li>We do <b>not</b> sell your data or show you advertising based on it.</li>
      </ul>
      <h2>Who can see your data</h2>
      <ul>
        <li>You, when signed in.</li>
        <li>People you choose to share a specific account with. They only see that account.</li>
        <li>Anyone you send an invoice link to. They only see that invoice.</li>
        <li>FinanceChachu administrators, only when needed to support you or keep the service running.</li>
      </ul>
      <h2>Where it is stored</h2>
      <p>
        Your data is stored with trusted cloud providers (database and hosting services) on secure servers, and
        sent over encrypted connections (HTTPS). Passwords and recovery codes are stored scrambled (hashed) so even we can&apos;t read them.
      </p>
      <h2>Keeping and deleting data</h2>
      <p>
        We keep your data while your account is open. You can download your entries and accounts at any time from
        Settings. To close your account and delete your data, contact us.
      </p>
      <h2>Contact</h2>
      <p>Questions about privacy? Contact FinanceChachu support.</p>
    </LegalPage>
  );
}
