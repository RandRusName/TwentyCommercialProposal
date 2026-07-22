# Twenty Core Boundary

Twenty Core remains an unmodified platform dependency.

Twenty owns Company, Person, Opportunity, User, Workspace, permissions, API,
UI shell, files and metadata execution. The CRM Application references these
through official SDK/Core API contracts.

The App owns CatalogItem, CommercialProposal and its child/claim metadata,
business validation, UI components and application routes. It may configure a
supported execution driver through deployment settings, but never patches the
Twenty image or source.

Forbidden boundary crossings:

- Twenty fork or source patch;
- direct PostgreSQL business mutation or manual DDL;
- user/session token scraping;
- privileged API keys in frontend code;
- dependence on undocumented internal tables;
- target uninstall as routine upgrade/rollback.
