# Weekly Payments Format

## Scope

Weekly Payments is a simple residential operations payment sheet. It does not activate Commercial Accounts, Commercial Payroll, SEO, SEO Kanban, or commercial schedule rules.

## Normal Cleaners

Every cleaner except Juan Romero uses the normal weekly payment format:

| Date | City | Payment |
| --- | --- | ---: |
| 2026-05-20 | Irvine | $120.00 |

Footer:

| TOTAL | Jobs | Payment total |
| --- | ---: | ---: |
| TOTAL | 1 jobs | $120.00 |

Normal cleaners use `payment_mode = residential_only`. Empty payment values count as `0`, negative values are rejected, and Residential / Commercial columns are not shown.

## Juan Romero Mixed Pay

Juan Romero is the only mixed-pay cleaner. His weekly sheet shows:

| Date | City | Residential | Commercial |
| --- | --- | ---: | ---: |
| 2026-05-20 | Costa Mesa | $100.00 | $50.00 |

Footer:

| TOTAL | Jobs | Residential total | Commercial total | Grand total |
| --- | ---: | ---: | ---: | ---: |
| TOTAL | 1 jobs | $100.00 | $50.00 | $150.00 |

Juan uses `payment_mode = mixed`. Mixed pay means Residential + Commercial inside Weekly Payments only. The Commercial amount is a simple add-on and does not enter the old commercial payroll flow.

Juan can have residential only, commercial only, or both in the same row. At least one amount must be greater than `0`.

## Weekly Summary

Residential payments total:

`SUM(normal cleaner payment_amount) + SUM(Juan residential_amount)`

Juan commercial add-on:

`SUM(Juan commercial_amount)`

Grand total:

`residential payments total + Juan commercial add-on`

Pending total:

`SUM(sheet totals where the sheet or any row is pending)`

Paid total:

`SUM(sheet totals where all rows are paid, or the saved weekly payment is paid)`

## Adding A Row

1. Open Residential > Weekly payments.
2. Pick the week with Previous week, Current week, or Next week.
3. Find the cleaner sheet.
4. Fill Date and City.
5. For normal cleaners, enter Payment.
6. For Juan Romero, enter Residential, Commercial, or both.
7. Select Add payment row.

Use Edit to update an existing row and Delete to soft-delete it after confirmation.

## Export

Export weekly payments creates an XLSX workbook:

- `Weekly Summary`: week range, Residential payments total, Juan commercial add-on, Grand total, Pending total, and Paid total.
- `Payments by Cleaner`: normal cleaners export Cleaner, Date, City, Payment, and Total; Juan exports Cleaner, Date, City, Residential, Commercial, and Total.

## Inactive Modules

These modules are intentionally not part of Weekly Payments:

- Commercial Accounts
- Commercial Payroll
- Commercial schedule rules
- SEO dashboard
- SEO Kanban
- SEO tasks
