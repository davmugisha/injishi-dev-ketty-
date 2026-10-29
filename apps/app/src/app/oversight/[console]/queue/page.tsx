export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Registration queue</h1>
      <p className="text-sm text-muted-foreground">
        The field-verification and approval queues are not on this app build yet. Open the PSF
        membership console at{" "}
        <a className="underline" href="/oversight/membership/overview">
          /oversight/membership
        </a>{" "}
        if that is your posting.
      </p>
    </main>
  );
}
