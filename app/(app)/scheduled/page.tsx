import { CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountsWithBalances } from "@/lib/books";
import { FREQ_LABEL, listSchedules } from "@/lib/schedules";
import { addSchedule, deleteSchedule, toggleSchedule } from "@/app/actions/schedules";
import { money, prettyDate, today } from "@/lib/format";
import { AccountSelect, Empty, Flash, PageHeader, TypeBadge } from "@/components/ui";

export const metadata = { title: "Scheduled entries" };

export default async function Scheduled({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const d = await db();
  const [rows, accounts] = await Promise.all([listSchedules(d, user.id), accountsWithBalances(d, user.id)]);
  const cash = accounts.find((a) => a.category === "Cash")?.id;
  return (
    <>
      <PageHeader title="Scheduled entries" subtitle="Rent, salaries, bills: set them up once. They're added for you, or you get a reminder to add them." />
      <Flash sp={sp} />
      <form action={addSchedule} className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="flex items-center gap-2 text-lg font-bold sm:col-span-2 lg:col-span-3"><CalendarClock className="h-5 w-5 text-brand" />New scheduled entry</h2>
        <div>
          <label className="label" htmlFor="sc-type">Type</label>
          <select id="sc-type" name="type" className="input" defaultValue="payment">
            <option value="payment">Money Out (payment)</option>
            <option value="receipt">Money In (receipt)</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sc-amount">Amount ({user.currency})</label>
          <input id="sc-amount" name="amount" inputMode="decimal" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="sc-note">Note</label>
          <input id="sc-note" name="note" placeholder="e.g. Shop rent" className="input" />
        </div>
        <div>
          <label className="label">From (money leaves)</label>
          <AccountSelect name="from" accounts={accounts} value={cash} />
        </div>
        <div>
          <label className="label">To (money goes into)</label>
          <AccountSelect name="to" accounts={accounts} />
        </div>
        <div>
          <label className="label" htmlFor="sc-freq">How often</label>
          <select id="sc-freq" name="frequency" className="input" defaultValue="monthly">
            {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sc-start">First date</label>
          <input id="sc-start" type="date" name="start" required defaultValue={today()} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="sc-end">Stop after (optional)</label>
          <input id="sc-end" type="date" name="end" className="input" />
        </div>
        <fieldset>
          <legend className="label">When it&apos;s due</legend>
          <label className="flex items-center gap-2 text-[15px]"><input type="radio" name="auto" value="1" defaultChecked /> Add it automatically</label>
          <label className="flex items-center gap-2 text-[15px]"><input type="radio" name="auto" value="0" /> Remind me, I&apos;ll add it</label>
        </fieldset>
        <div className="sm:col-span-2 lg:col-span-3">
          <button className="btn-primary">Save scheduled entry</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>No scheduled entries yet. Add your rent or salaries above so you never forget them.</Empty>
        ) : (
          <table className="table">
            <thead><tr><th>What</th><th className="hidden sm:table-cell">Type</th><th className="num">Amount</th><th>How often</th><th>Next</th><th>Mode</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                  <td><div className="font-semibold text-ink">{r.note || "Scheduled entry"}</div><div className="text-sm text-muted">{r.from_name} → {r.to_name}</div></td>
                  <td className="hidden sm:table-cell"><TypeBadge type={r.type} /></td>
                  <td className="num font-medium">{money(r.amount)}</td>
                  <td>{FREQ_LABEL[r.frequency]}</td>
                  <td className="whitespace-nowrap">{r.active ? prettyDate(r.next_date) : "Stopped"}</td>
                  <td className="text-sm">{r.auto ? "Automatic" : "Reminder"}</td>
                  <td className="whitespace-nowrap text-right">
                    <form action={toggleSchedule} className="inline">
                      <input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.active ? "0" : "1"} />
                      <button className="inline-flex rounded-md p-1.5 text-ink hover:bg-ink-soft" title={r.active ? "Pause" : "Resume"} aria-label={r.active ? "Pause" : "Resume"}>
                        {r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    </form>
                    <form action={deleteSchedule} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="inline-flex rounded-md p-1.5 text-khata hover:bg-khata-soft" title="Delete" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">Automatic entries are added when you open FinanceChachu on or after the date. Deleting a schedule keeps the entries already added.</p>
    </>
  );
}
