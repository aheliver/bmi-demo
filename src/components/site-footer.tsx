// No new Date()/Date.now() here — this renders in the prerendered static shell
// (Cache Components), and reading the current time there is a dynamic access that errors.
export function SiteFooter() {
  return (
    <footer className="text-muted-foreground border-t px-6 py-4 text-center text-sm">
      BMI App
    </footer>
  )
}
