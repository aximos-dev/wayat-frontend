const COUNTRY_CODE = "+91";

/** Strips a leading "+91" (or "91") from a stored phone value, leaving just the local digits —
 *  used to show the right thing in the box regardless of whether the value already has the
 *  prefix (existing data) or not. */
function localDigits(value: string): string {
  const stripped = value.startsWith(COUNTRY_CODE)
    ? value.slice(COUNTRY_CODE.length)
    : value.startsWith("91")
      ? value.slice(2)
      : value;
  return stripped.replace(/\D/g, "").slice(0, 10);
}

/** Phone number input with a fixed, non-removable "+91" prefix — every phone number this app
 *  collects (driver, parent) is a local Indian mobile number, and letting the country code be
 *  edited or left out just invites a malformed value that won't match what OTP login expects.
 *  `value`/`onChange` carry the FULL phone (e.g. "+919900012345"), same shape as before this
 *  component existed, so callers don't need to know about the split. */
export function PhoneInput({
  value,
  onChange,
  required = false,
  placeholder = "9900012345",
}: {
  value: string;
  onChange: (fullPhone: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const digits = localDigits(value);

  function handleChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 10);
    onChange(next.length > 0 ? COUNTRY_CODE + next : "");
  }

  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-bg-base focus-within:border-accent">
      <span className="flex items-center border-r border-border bg-bg-surface px-3 text-text-muted select-none">
        {COUNTRY_CODE}
      </span>
      <input
        required={required}
        type="tel"
        inputMode="numeric"
        value={digits}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-text-primary outline-none"
      />
    </div>
  );
}
