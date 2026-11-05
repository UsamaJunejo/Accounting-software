import { ICONS, PICK_COLORS } from "@/lib/look";

/** Colour swatches and an icon grid, as plain radio buttons (works without JavaScript). */
export function LookPicker({ color, icon }: { color?: string | null; icon?: string | null }) {
  const c = color ?? PICK_COLORS[0];
  const i = icon ?? "tag";
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {PICK_COLORS.map((hex) => (
            <label key={hex} className="relative cursor-pointer">
              <input type="radio" name="color" value={hex} defaultChecked={hex === c} className="peer sr-only" />
              <span
                className="block h-8 w-8 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-ink peer-focus-visible:ring-peacock"
                style={{ background: hex }}
                title={hex}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Icon</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {Object.entries(ICONS).map(([key, [Icon, label]]) => (
            <label key={key} className="cursor-pointer" title={label}>
              <input type="radio" name="icon" value={key} defaultChecked={key === i} className="peer sr-only" />
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-rule text-body peer-checked:border-peacock peer-checked:bg-peacock peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-peacock">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <span className="sr-only">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
