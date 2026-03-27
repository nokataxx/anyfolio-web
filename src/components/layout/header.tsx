import { LogOut } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"

export function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <h1 className="text-lg font-bold tracking-tight">AnyFolio</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{user?.email}</span>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  )
}
