import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

export const metadata = {
  title: "Sign in · MindeloAI Dashboard",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            MindeloAI Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the shared passcode to continue.
          </p>
        </div>

        <form action={login} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="passcode">Passcode</Label>
            <Input
              id="passcode"
              name="passcode"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              Incorrect passcode. Please try again.
            </p>
          ) : null}

          <Button type="submit" className="w-full" size="lg">
            Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
