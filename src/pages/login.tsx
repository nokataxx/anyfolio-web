import { useState, type FormEvent } from "react"
import { Navigate } from "react-router"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<"login" | "signup">("login")

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password)

    if (result.error) {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">anyfolio</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? "..."
                : mode === "login"
                  ? "Sign In"
                  : "Sign Up"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {mode === "login" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    setMode("signup")
                    setError(null)
                  }}
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => {
                    setMode("login")
                    setError(null)
                  }}
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
