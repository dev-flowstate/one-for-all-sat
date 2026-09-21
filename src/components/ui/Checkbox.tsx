interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}

export function Checkbox({ checked, onChange, label, id }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 font-mono text-sm select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      {/* A drawn box rather than the native control, so it matches the ink-stroke language.
          `peer-focus-visible` keeps the focus ring on the visible box. */}
      <span
        aria-hidden="true"
        className="flex h-5 w-5 flex-none items-center justify-center border-2 border-ink bg-paper peer-checked:bg-venice-blue peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-coral"
      >
        <span className={`text-[13px] leading-none font-bold text-merino ${checked ? '' : 'invisible'}`}>×</span>
      </span>
      {label}
    </label>
  );
}
