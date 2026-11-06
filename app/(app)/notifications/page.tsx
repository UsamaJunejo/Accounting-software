import Link from "next/link";
import { AlertTriangle, BellOff, CreditCard, CalendarClock, CheckCircle2, Clock, Inbox, Mail, Package, Target, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getNotifications, type Notice } from "@/lib/notifications";
import { addReminderNow, skipReminder } from "@/app/actions/schedules";
import { prettyDate, today } from "@/lib/format";
import { Flash, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

const ICON: Record<Notice["kind"], [LucideIcon, string]> = {
  approval: [Inbox, "bg-brand text-white"],
  invite: [Mail, "bg-brand text-white"],
  reminder: [CalendarClock, "bg-marigold-soft text-marigold"],
  overdue: [AlertTriangle, "bg-khata-soft text-khata"],
  budget: [Target, "bg-khata-soft text-khata"],
  auto: [CheckCircle2, "bg-ledger-soft text-ledger"],
  billing: [CreditCard, "bg-brand text-white"],
  stock: [Package, "bg-marigold-soft text-marigold"],
};

export default async function Notifications({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const list = await getNotifications(await db(), user.id, today(), user.is_admin);
  return (
    <>
      <PageHeader title="Notifications" subtitle="Things that need your attention. They disappear once they're dealt with." />
      <Flash sp={sp} />
      {list.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center text-muted">
          <BellOff className="h-8 w-8" />
          Nothing needs your attention right now.
        </div>
      ) : (
        <ul className="card divide-y divide-rule/70 overflow-hidden">
          {list.map((n) => {
            const [Icon, tone] = ICON[n.kind];
            return (
              <li key={n.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon className="h-5 w-5" /></span>
                <Link href={n.href} className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{n.title}</div>
                  <div className="flex items-center gap-1 text-sm text-muted">
                    {n.urgent && <Clock className="h-3.5 w-3.5 text-khata" />}
                    {n.detail}{n.date ? ` (${prettyDate(n.date)})` : ""}
                  </div>
                </Link>
                {n.reminderId && (
                  <div className="flex gap-2">
                    <form action={addReminderNow}><input type="hidden" name="id" value={n.reminderId} /><button className="btn-primary px-3 py-1.5 text-sm">Add now</button></form>
                    <form action={skipReminder}><input type="hidden" name="id" value={n.reminderId} /><button className="btn-ghost px-3 py-1.5 text-sm">Skip</button></form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
