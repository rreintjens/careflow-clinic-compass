import type { SelectOption } from "./Select";
import { SearchablePicker } from "./SearchablePicker";

export interface MultiSelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  help?: string | null;
  className?: string;
}

/** Multi-selection uses the same search, grouping and eligibility rules. */
export function MultiSelect(props: MultiSelectProps) {
  return <SearchablePicker {...props} multiple />;
}
