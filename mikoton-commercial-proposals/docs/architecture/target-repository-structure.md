# Target Repository Structure

```text
src/
  platform/{errors,identifiers,money,dates,pagination,permissions,localization,logging,compatibility,testing}
  modules/
    sales/{domain,application,infrastructure,presentation,tests}
    catalog/{domain,application,infrastructure,metadata,presentation,tests}
    commercial-proposals/{domain,application,infrastructure,metadata,presentation,tests}
    documents/{domain,application,infrastructure,tests}
    administration/{domain,application,infrastructure,presentation}
  install/{compatibility,migrations,bootstrap}
  shared-ui/
```

The current `domain`, `services`, `logic-functions`, `objects`, `views` and
`front-components` folders are migration sources, not a second architecture.
Files move only when their dependencies are explicit and regression tests stay
green. Universal identifiers move by import path only and never change value.
