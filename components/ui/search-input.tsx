import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

interface SearchInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ id, label, value, onChange, placeholder, className }: SearchInputProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? label}
        autoComplete="off"
        className={cn(
          "block h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted/70",
          "hover:border-line-strong focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/30",
        )}
      />
    </div>
  );
}
