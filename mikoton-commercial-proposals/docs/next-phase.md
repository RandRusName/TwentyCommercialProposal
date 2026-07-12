# Next Phase

1. Obtain a Twenty API key for `http://192.168.100.11:3000`.
2. Run `remote:add` and `twenty plan`; stop if destructive changes appear.
3. Apply metadata only after plan review.
4. Run remote smoke:
   - open an Opportunity;
   - run `Create commercial proposal`;
   - confirm the front component shows Opportunity, Company and Amount;
   - create a draft;
   - confirm the `CommercialProposal` record opens and is linked back.
5. Replace adapter assumptions if generated client operation names differ after
   metadata sync.
6. Add document-service contract implementation:
   - request payload from CommercialProposal and related records;
   - authenticated call to external service;
   - store `docxUrl`, `pdfUrl` and files.
7. Harden permissions and add production-level integration tests.
