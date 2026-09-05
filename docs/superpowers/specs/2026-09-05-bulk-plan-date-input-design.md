# Bulk Plan Date Input Design

## Goal

Make the “กำหนดวันที่ที่เลือกทั้งหมด” field easy to type in Thai day-first order while preserving the existing ISO date contract used by the application and Supabase.

## User Experience

- Replace the bulk native date field with a visible text field that accepts `DD/MM/YYYY`, for example `05/09/2026`.
- Keep a calendar button beside the text field. Selecting a date from it updates the visible field in `DD/MM/YYYY` format.
- Applying either typed or calendar-selected input sets the same planned date on every eligible selected instrument.
- Individual instrument date controls remain unchanged; this fix is scoped to the bulk-date field shown in the reported issue.

## Data Flow

The visible value is parsed and validated locally. A valid Gregorian date is normalized to `YYYY-MM-DD` before calling the existing bulk-date update path. The wizard state and RPC payload therefore keep their current ISO format, so no database or Supabase migration is required.

## Validation and Errors

- Empty, malformed, or impossible dates such as `31/02/2026` are rejected.
- Validation feedback explains that the expected format is `วัน/เดือน/ปี`, without changing any selected item date.
- Existing rules for no selection and result-bearing items remain in force.

## Testing

Browser regression tests will cover rendering the typeable day-first field, conversion of a valid typed date to ISO, rejection of an impossible date, calendar synchronization, and preservation of the existing selected-item safeguards. The complete application, syntax, and page test suites will run before delivery.
