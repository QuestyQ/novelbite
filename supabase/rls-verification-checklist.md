# RLS verification checklist

Run this against a separate NovelBite demo project before enabling public sign-in.

1. Create users A and B.
2. Sign in as A and insert one row into each personal table.
3. Sign in as B and confirm selects return zero A rows.
4. Attempt updates and deletes against A row IDs as B; confirm zero rows are affected.
5. Confirm anonymous requests cannot read or write the personal tables.
6. Sign in as A and confirm export and delete actions operate only on A rows.
7. Call `delete_own_account()` as A and confirm A’s personal rows cascade-delete.
8. Remove user B and any remaining test data.

Record the test date, project environment and outcome in the release notes. Never commit test access tokens or service credentials.
