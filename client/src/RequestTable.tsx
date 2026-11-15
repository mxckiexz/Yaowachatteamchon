import { Link } from "react-router-dom";
import type { RequestSummary } from "./api";
import { CATEGORY_LABEL, formatBaht, formatDateTime, StatusBadge } from "./format";

// Shared table of the list screens. It scrolls inside its own box on a narrow screen.
export default function RequestTable({ requests, showRequester, dateLabel }: { requests: RequestSummary[]; showRequester?: boolean; dateLabel: "created" | "submitted" }) {
  return (
    <div className="table-responsive">
      <table className="table align-middle">
        <thead>
          <tr>
            <th>Number</th>
            <th>Item</th>
            {showRequester && <th>Requester</th>}
            <th>Category</th>
            <th>Status</th>
            <th className="text-end">Total</th>
            <th>{dateLabel === "created" ? "Created" : "Submitted"}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/requests/${r.id}`}>{r.requestNumber}</Link></td>
              <td>{r.itemName}</td>
              {showRequester && <td>{r.requester.name}</td>}
              <td>{r.category ? CATEGORY_LABEL[r.category] : ""}</td>
              <td><StatusBadge status={r.status} /></td>
              <td className="text-end">{formatBaht(r.total)}</td>
              <td>{formatDateTime(dateLabel === "created" ? r.createdAt : r.submittedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
