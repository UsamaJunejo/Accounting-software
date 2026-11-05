import { LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of Use" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Use" updated="5 November 2026">
      <p>By creating an account or using FinanceChachu you agree to these terms.</p>
      <h2>The service</h2>
      <p>
        FinanceChachu is a tool to help you record and organise your business accounts. It is not a substitute for
        professional accounting, tax or legal advice. Please check important figures, especially for tax filing.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>Keep your password and recovery code safe. You are responsible for activity on your account.</li>
        <li>Give correct information when you sign up.</li>
        <li>Don&apos;t use FinanceChachu for anything illegal, or to try to access other people&apos;s data.</li>
      </ul>
      <h2>Your data</h2>
      <ul>
        <li>Your data belongs to you. You can download it at any time.</li>
        <li>When you share an account or send an invoice link, you are choosing to show that information to others.</li>
        <li>We work hard to keep the service running and your data safe, but we recommend keeping your own backup by downloading your data regularly.</li>
      </ul>
      <h2>Free trial and payment</h2>
      <ul>
        <li>New accounts get a free trial. After it, FinanceChachu is a paid monthly plan at the price shown on the website.</li>
        <li>You pay by JazzCash, Easypaisa or bank transfer and submit the transaction ID. Your plan is extended once the payment is checked.</li>
        <li>If your plan ends, your account becomes view-only: you can still see and download all your data, but can&apos;t add new entries until you pay.</li>
        <li>Payments are for time already started and are not refunded, except where the law requires.</li>
      </ul>
      <h2>Changes and availability</h2>
      <p>
        We may improve or change features over time. We may suspend accounts that break these terms. The service is
        provided &ldquo;as is&rdquo;; to the extent the law allows, we are not liable for losses arising from its use.
      </p>
      <h2>Contact</h2>
      <p>Questions about these terms? Contact FinanceChachu support.</p>
    </LegalPage>
  );
}
