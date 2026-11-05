import { BadgeCheck, CalendarClock, Clock, Landmark, Lock, Smartphone, Upload } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBillingSettings, METHODS, myPayments } from "@/lib/billing";
import { submitPayment } from "@/app/actions/billing";
import { money, prettyDate } from "@/lib/format";
import { Flash, PageHeader } from "@/components/ui";
import { CodeBox } from "@/components/code-box";

export const metadata = { title: "Plan & billing" };

const STATUS: Record<string, string> = {
  pending: "bg-marigold-soft text-marigold",
  approved: "bg-ledger-soft text-ledger",
  rejected: "bg-khata-soft text-khata",
};

export default async function Billing({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; expired?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const [s, payments] = await Promise.all([getBillingSettings(d), myPayments(d, user.id)]);
  const plan = user.plan;
  const rs = (p: number) => `Rs ${money(p).replace(/\.00$/, "")}`;
  const ways = [
    s.jazzcash && { icon: Smartphone, name: "JazzCash", value: s.jazzcash },
    s.easypaisa && { icon: Smartphone, name: "Easypaisa", value: s.easypaisa },
    s.iban && { icon: Landmark, name: s.bankName || "Bank transfer", value: s.iban },
  ].filter(Boolean) as { icon: typeof Landmark; name: string; value: string }[];

  return (
    <>
      <PageHeader title="Plan & billing" subtitle={`${rs(s.price)} a month after a ${s.trialDays}-day free trial. Pay for one month or several at once.`} />
      <Flash sp={sp} />
      {sp.expired && plan.state === "expired" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-khata/30 bg-khata-soft px-4 py-3 text-[15px] text-khata">
          <Lock className="h-5 w-5 shrink-0" />To add or change entries, please pay for your plan. You can still view and download everything.
        </div>
      )}

      <section className={`mb-6 rounded-2xl p-6 text-white ${plan.state === "expired" ? "bg-khata" : "bg-brand"}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            {plan.state === "expired" ? <Lock className="h-6 w-6" /> : plan.state === "trial" ? <Clock className="h-6 w-6" /> : <BadgeCheck className="h-6 w-6" />}
          </span>
          <div>
            <div className="text-2xl font-bold">
              {plan.state === "free" && "Admin account: free"}
              {plan.state === "trial" && `Free trial: ${plan.daysLeft} ${plan.daysLeft === 1 ? "day" : "days"} left`}
              {plan.state === "active" && "Your plan is active"}
              {plan.state === "expired" && "Your plan has ended"}
            </div>
            <div className="text-white/85">
              {plan.state === "trial" && `Ends ${prettyDate(plan.until!)}. Pay before then to keep adding entries without a break.`}
              {plan.state === "active" && `Paid until ${prettyDate(plan.until!)} (${plan.daysLeft} days left).`}
              {plan.state === "expired" && `Ended ${plan.until ? prettyDate(plan.until) : ""}. Your data is safe; pay below to continue.`}
              {plan.state === "free" && "Admins don't need to pay."}
            </div>
          </div>
        </div>
      </section>

      {plan.state !== "free" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-1 text-lg font-bold">1. Send the money</h2>
            <p className="mb-4 text-sm text-muted">Send {rs(s.price)} for each month to any of these{s.accountTitle ? `, in the name of ${s.accountTitle}` : ""}.</p>
            {ways.length === 0 ? (
              <p className="rounded-lg bg-marigold-soft p-3 text-sm text-marigold">Payment details haven&apos;t been added yet. Please contact FinanceChachu support.</p>
            ) : (
              <ul className="space-y-3">
                {ways.map((w) => (
                  <li key={w.name}>
                    <div className="mb-1 flex items-center gap-2 font-semibold text-ink"><w.icon className="h-4 w-4" />{w.name}</div>
                    <CodeBox value={w.value} />
                  </li>
                ))}
              </ul>
            )}
            {s.instructions && <p className="mt-4 whitespace-pre-line text-sm text-body">{s.instructions}</p>}
          </section>

          <form action={submitPayment} className="card space-y-4 p-5">
            <h2 className="text-lg font-bold">2. Tell us you paid</h2>
            <div>
              <label className="label" htmlFor="months">How many months?</label>
              <select id="months" name="months" className="input" defaultValue="1">
                {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? "month" : "months"}: {rs(s.price * m)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="method">Paid with</label>
              <select id="method" name="method" className="input">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </div>
            <div>
              <label className="label" htmlFor="reference">Transaction ID (TID)</label>
              <input id="reference" name="reference" required minLength={4} maxLength={60} placeholder="From your JazzCash / Easypaisa / bank message" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="proof">Screenshot of the payment (optional)</label>
              <input id="proof" name="proof" type="file" accept="image/*,application/pdf" className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-peacock-soft file:px-3 file:py-2 file:font-semibold file:text-peacock" />
            </div>
            <button className="btn-primary w-full"><Upload className="h-4 w-4" />Send for approval</button>
            <p className="flex items-center gap-1 text-sm text-muted"><CalendarClock className="h-4 w-4" />Usually approved within a day. Paid months start after your current plan or trial ends.</p>
          </form>
        </div>
      )}

      {payments.length > 0 && (
        <section className="card mt-6 overflow-x-auto">
          <h2 className="p-5 pb-2 text-lg font-bold">Your payments</h2>
          <table className="table">
            <thead><tr><th>Sent</th><th>Months</th><th className="num">Amount</th><th>Method</th><th>TID</th><th>Status</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{p.created_at}</td>
                  <td>{p.months}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td>{p.method}</td>
                  <td className="text-sm font-semibold">{p.reference}</td>
                  <td>
                    <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold capitalize ${STATUS[p.status]}`}>{p.status === "pending" ? "Waiting" : p.status}</span>
                    {p.note && <div className="text-sm text-muted">{p.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
