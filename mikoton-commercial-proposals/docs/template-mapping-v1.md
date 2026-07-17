# Template Mapping v1

Template: `templates/mikoton-commercial-proposal-v1.xlsm`.

Analysis artifact: `docs/template-analysis-v1.json`.

## Workbook Structure

- Workbook type: XLSM.
- VBA project: present, `xl/vbaProject.bin`.
- Sheet XML path: `xl/worksheets/sheet1.xml`.
- Visual sheet name: `КП`.
- Used range: `A1:I43`.
- Print area: `КП!$A$1:$I$37`.
- Drawing/button parts present:
  - `xl/drawings/drawing1.xml`
  - `xl/drawings/vmlDrawing1.vml`
  - `xl/ctrlProps/ctrlProp1.xml`
  - `xl/printerSettings/printerSettings1.bin`

## Cell Mapping

| Cell | Value |
| --- | --- |
| `G3` | `<CommercialProposal.number>`, for example `КП-005 от 17.07.2026` |
| `I3` | proposal date as fixed Excel date value |
| `B5` | proposal title |
| `C8` | company name |
| `C9` | customer contact or `Не указан` |
| `F8` | contractor name from mapping config |
| `F9` | contractor email from mapping config |
| `I8` | validity period, default `14 дней` |
| `I9` | currency code |
| `B12` | context and goal |
| `B17:I21` | work items |
| `I17:I21` | line total formulas |
| `I22` | `SUM(I17:I21)` |
| `B27:I29` | plan stages |
| `B32:D32` | payment terms |
| `E32:I32` | assumptions |
| `B35:I35` | next step |
| `B37:I37` | footer |

## MVP Limits

- Work items: 1 to 5.
- Plan stages: 1 to 3.
- More than 5 work items are rejected with `PAYLOAD_INVALID`.
- Dynamic row insertion is not implemented in this first version because it must
  preserve merged cells, print area, formulas and drawings.
