<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use Bofil as the product brand and reserve yellow for revenue; positive balances use green, because this is the approved financial color language.
- Preserve a minimal local offline-session marker after successful authentication and erase it only on sign-out or rejected access, so authorised devices can reopen offline after token refresh becomes unavailable.
- Derive every financial screen from the shared offline finance merger so queued entries and expenses stay consistent across lists, balances, and charts.
- Keep every database table listed in the `TABLES` export of `src/lib/backup.functions.ts`; the admin backup download is the user's only protection against losing records, so a new table left out silently breaks the guarantee.
- Use the shared expandable sector panel for operational forms and long histories, so sector pages remain compact without changing financial behavior.
- Represent sector-entry payment changes as idempotent, authenticated updates and overlay queued changes in the shared finance merger, so offline receipts affect every financial view consistently without duplicate revenue.
