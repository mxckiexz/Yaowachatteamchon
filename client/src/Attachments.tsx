import { useEffect, useRef, useState } from "react";
import { ApiError, attachmentUrl, deleteAttachment, listAttachments, uploadAttachment, type Attachment } from "./api";
import { formatDateTime, formatFileSize } from "./format";

const MAX_ATTACHMENTS = 5;

// The server message, followed by its message for a field when there is one.
function messageOf(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  return [error.message, ...Object.values(error.fields ?? {})].join(" ");
}

// F-09: the files of a request. canChange is true for the owner of a draft; the server checks it again.
export default function Attachments({ requestId, canChange }: { requestId: number; canChange: boolean }) {
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  // Where the keyboard focus goes after the next render.
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const section = useRef<HTMLElement>(null);

  function load() {
    setLoadFailed(false);
    return listAttachments(requestId)
      .then((r) => setItems(r.attachments))
      .catch(() => setLoadFailed(true));
  }
  useEffect(() => {
    setItems(null);
    void load();
  }, [requestId]);

  useEffect(() => {
    if (!focusTarget || busy) return;
    section.current?.querySelector<HTMLElement>(`[data-focus="${focusTarget}"]`)?.focus();
    setFocusTarget(null);
  }, [focusTarget, busy, items, confirming]);

  const atLimit = (items?.length ?? 0) >= MAX_ATTACHMENTS;

  async function upload(input: HTMLInputElement) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setAnnouncement("Uploading");
    try {
      const { attachment } = await uploadAttachment(requestId, file);
      setItems((current) => [...(current ?? []), attachment]);
      setFile(null);
      input.value = "";
      setAnnouncement("Attachment uploaded");
      setFocusTarget("input");
    } catch (err) {
      setAnnouncement("");
      setError(messageOf(err, "Could not upload the file."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(attachment: Attachment) {
    setBusy(true);
    setError(null);
    setAnnouncement("");
    try {
      await deleteAttachment(requestId, attachment.id);
      setItems((current) => (current ?? []).filter((a) => a.id !== attachment.id));
      setConfirming(null);
      setAnnouncement("Attachment deleted");
      setFocusTarget("heading");
    } catch (err) {
      setError(messageOf(err, "Could not delete the file."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section ref={section} className="mt-4" aria-label="Attachments">
      <h2 className="h6" tabIndex={-1} data-focus="heading">Attachments</h2>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

      {loadFailed && (
        <div className="alert alert-danger">
          Unable to load attachments. <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!loadFailed && items === null && <p>Loading attachments...</p>}
      {!loadFailed && items?.length === 0 && <p className="text-muted">No attachments.</p>}
      {!loadFailed && items && items.length > 0 && (
        <ul className="list-unstyled">
          {items.map((a) => (
            <li key={a.id} className="border-bottom py-2">
              <div className="text-break">
                <strong>{a.fileName}</strong> ({formatFileSize(a.sizeBytes)}), uploaded by {a.uploadedBy.name}, {formatDateTime(a.createdAt)}
              </div>
              <div className="d-flex gap-3 flex-wrap align-items-center mt-1">
                <a href={attachmentUrl(requestId, a.id)} download aria-label={`Download ${a.fileName}`}>Download</a>
                {canChange && confirming !== a.id && (
                  <button
                    className="btn btn-sm btn-outline-danger"
                    data-focus={`delete-${a.id}`}
                    aria-label={`Delete ${a.fileName}`}
                    disabled={busy}
                    onClick={() => { setConfirming(a.id); setError(null); setFocusTarget("confirm"); }}
                  >
                    Delete
                  </button>
                )}
              </div>
              {canChange && confirming === a.id && (
                <div className="mt-2">
                  <p className="mb-2 text-break">Delete {a.fileName}?</p>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-danger" data-focus="confirm" disabled={busy} onClick={() => void remove(a)}>Confirm delete</button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={busy}
                      onClick={() => { setConfirming(null); setError(null); setFocusTarget(`delete-${a.id}`); }}
                    >
                      Keep file
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canChange && items !== null && !loadFailed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void upload(e.currentTarget.elements.namedItem("attachment") as HTMLInputElement);
          }}
        >
          <label htmlFor="attachment" className="form-label">Add attachment</label>
          <div className="d-flex gap-2 flex-wrap">
            <input
              id="attachment"
              name="attachment"
              data-focus="input"
              type="file"
              className="form-control w-auto mw-100"
              accept=".pdf,.png,.jpg,.jpeg"
              aria-describedby="attachment-help"
              disabled={atLimit || busy}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
            />
            <button type="submit" className="btn btn-outline-primary" disabled={!file || busy || atLimit}>Upload</button>
          </div>
          <div id="attachment-help" className="form-text">PDF, PNG or JPG, up to 5 MB each, at most 5 files.</div>
          {atLimit && <p className="mb-0">This request already has 5 attachments.</p>}
        </form>
      )}
      {error && <div role="alert" className="alert alert-danger mt-2 mb-0">{error}</div>}
    </section>
  );
}
