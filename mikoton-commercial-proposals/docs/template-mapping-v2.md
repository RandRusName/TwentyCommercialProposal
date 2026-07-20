# Template mapping v2

`templates/mikoton-commercial-proposal-v2.xlsx` is a macro-free XLSX template for schema `2.0`, template code `mikoton-commercial-proposal`, version `2`.

| Area | Mapping |
|---|---|
| Header | `G3` number, `I3` date, `A5` title |
| Customer | `A8` company, `A9` contact |
| Contractor | `E8` name, `E9` email |
| Parameters | `H8` validity, `H9` currency |
| Context | `A12` |
| Items | rows `16..65`, columns `A:I` |
| Total | `I66 = SUM(I16:I65)` |
| Stages | rows `69..78` |
| Terms | `A81`, `D81`, `A86` |
| Footer | `A87` |

Item columns are position, block, name, description, quantity, unit, unit price, discount percent and line total. Unused rows are hidden; data is never truncated. The generated workbook is landscape A4 and fitted to one page wide.
