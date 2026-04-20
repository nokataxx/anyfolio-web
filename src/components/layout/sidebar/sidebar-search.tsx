import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

type SidebarSearchProps = {
  query: string
  onChange: (value: string) => void
  onClear: () => void
}

export function SidebarSearch({ query, onChange, onClear }: SidebarSearchProps) {
  return (
    <div className="relative px-2 pt-2">
      <Search className="absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search files..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pl-7 pr-7 text-sm"
      />
      {query && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onClear}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
