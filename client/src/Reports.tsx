import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ApiError, CATEGORIES, downloadReport, getReportSummary, type ReportAmount, type ReportSummary, type Status } from "./api";
import { CATEGORY_LABEL, formatBaht } from "./format";

const STATUS_LABEL: Record<Status, string> = { DRAFT: "Draft", SUBMITTED: "Submitted", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled" };
const FIELDS = ["from", "to", "status", "category"] as const;
type Field = (typeof FIELDS)[number];
type Filters = Record<Field, string>;

const EMPTY = "No requests match these filters.";
const totalLine = (s: ReportSummary) => `Requests: ${s.count}, total ${formatBaht(s.total)}`;
const filtersFrom = (params: URLSearchParams) => Object.fromEntries(FIELDS.map((f) => [f, params.get(f) ?? ""])) as Filters;

function AmountTable({ caption, first, rows }: { caption: string; first: string; rows: (ReportAmount & { label: string })[] }) {
  return (
    <div className="table-responsive mb-3">
      <table className="table table-sm">
        <caption className="caption-top fw-semibold text-body">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{first}</th>
            <th scope="col" className="text-end">Requests</th>
            <th scope="col" className="text-end">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="fw-normal">{row.label}</th>
              <td className="text-end">{row.count}</td>
              <td className="text-end text-break">{formatBaht(row.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// F-17: a summary of the requests the signed-in user may see, with filters kept in the address.
export default function Reports() {
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const [form, setForm] = useState<Filters>(() => filtersFrom(params));
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const latest = useRef(0);
  const exportButton = useRef<HTMLButtonElement>(null);
  const refocusExport = useRef(false);

  function load() {
    // Only the answer to the newest call is shown, so a slow earlier filter cannot replace a later one.
    const call = ++latest.current;
    setLoading(true);
    setLoadFailed(false);
    setFieldErrors({});
    setExportError(null);
    setSummary(null);
    setAnnouncement("");
    getReportSummary(search)
      .then(({ summary: result }) => {
        if (call !== latest.current) return;
        setSummary(result);
        setAnnouncement(result.count === 0 ? EMPTY : totalLine(result));
      })
      .catch((error) => {
        if (call !== latest.current) return;
        if (error instanceof ApiError && error.status === 422 && error.fields) setFieldErrors(error.fields);
        else setLoadFailed(true);
      })
      .finally(() => call === latest.current && setLoading(false));
  }

  // The address holds the applied filters, so reload, Back and a shared link give the same report.
  useEffect(() => {
    setForm(filtersFrom(new URLSearchParams(search)));
    load();
  }, [search]);

  // The button is disabled while the export runs; the focus returns to it once it is enabled again.
  useEffect(() => {
    if (exporting || !refocusExport.current) return;
    refocusExport.current = false;
    exportButton.current?.focus();
  }, [exporting]);

  function apply(event: FormEvent) {
    event.preventDefault();
    setParams(Object.fromEntries(FIELDS.filter((f) => form[f]).map((f) => [f, form[f]])));
  }

  async function exportFile() {
    setExporting(true);
    setExportError(null);
    setAnnouncement("");
    refocusExport.current = true;
    try {
      // The applied filters of the address, not changes in the form that were not applied.
      await downloadReport(search);
      setAnnouncement("Report exported");
    } catch (error) {
      setExportError(error instanceof ApiError ? error.message : "Could not export the report.");
    } finally {
      setExporting(false);
    }
  }

  const field = (name: Field, label: string, control: (props: object) => JSX.Element) => (
    <div className="col-12 col-sm-6 col-lg-3">
      <label className="form-label" htmlFor={`report-${name}`}>{label}</label>
      {control({
        id: `report-${name}`,
        value: form[name],
        "aria-invalid": fieldErrors[name] ? true : undefined,
        "aria-describedby": fieldErrors[name] ? `report-${name}-error` : undefined,
        onChange: (e: { target: { value: string } }) => setForm((current) => ({ ...current, [name]: e.target.value })),
      })}
      {fieldErrors[name] && <div id={`report-${name}-error`} className="text-danger small mt-1">{fieldErrors[name]}</div>}
    </div>
  );
  const inputClass = (name: Field, base: string) => `${base}${fieldErrors[name] ? " is-invalid" : ""}`;

  return (
    <main>
      <h1 className="h4">Reports</h1>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

      <form className="row g-2 mb-3" onSubmit={apply} noValidate>
        {field("from", "From", (props) => <input type="date" className={inputClass("from", "form-control")} {...props} />)}
        {field("to", "To", (props) => <input type="date" className={inputClass("to", "form-control")} {...props} />)}
        {field("status", "Status", (props) => (
          <select className={inputClass("status", "form-select")} {...props}>
            <option value="">All</option>
            {Object.entries(STATUS_LABEL).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        ))}
        {field("category", "Category", (props) => (
          <select className={inputClass("category", "form-select")} {...props}>
            <option value="">All</option>
            {CATEGORIES.map((value) => <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>)}
          </select>
        ))}
        <p className="col-12 form-text mb-0">Dates are Thailand time and use the day a request was created.</p>
        <div className="col-12 d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">Apply filters</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setParams({})}>Clear filters</button>
        </div>
      </form>

      {loading && <p>Loading report...</p>}
      {loadFailed && (
        <div className="alert alert-danger">
          Unable to load the report. <button className="btn btn-sm btn-outline-danger ms-2" onClick={load}>Retry</button>
        </div>
      )}
      {summary?.count === 0 && <p className="text-muted">{EMPTY}</p>}
      {summary && summary.count > 0 && (
        <>
          <p className="fs-5 text-break">{totalLine(summary)}</p>
          <AmountTable caption="By status" first="Status" rows={summary.byStatus.map((r) => ({ ...r, label: STATUS_LABEL[r.status] }))} />
          <AmountTable caption="By category" first="Category" rows={summary.byCategory.map((r) => ({ ...r, label: r.category ? CATEGORY_LABEL[r.category] : "No category" }))} />
        </>
      )}

      <button
        ref={exportButton}
        type="button"
        className="btn btn-outline-primary"
        disabled={exporting || !summary || summary.count === 0}
        onClick={() => void exportFile()}
      >
        Export CSV
      </button>
      {exportError && <div role="alert" className="alert alert-danger mt-2">{exportError}</div>}
    </main>
  );
}
