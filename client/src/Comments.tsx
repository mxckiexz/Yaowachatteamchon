import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, addComment, listComments, type RequestComment } from "./api";
import { formatDateTime } from "./format";

// The server message, followed by its message for a field when there is one.
function messageOf(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  return [error.message, ...Object.values(error.fields ?? {})].join(" ");
}

// F-10: the comments of a request, oldest first. canComment is false for the administrator;
// the server checks it again.
export default function Comments({ requestId, canComment }: { requestId: number; canComment: boolean }) {
  const [items, setItems] = useState<RequestComment[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const textArea = useRef<HTMLTextAreaElement>(null);

  function load() {
    setLoadFailed(false);
    return listComments(requestId)
      .then((r) => setItems(r.comments))
      .catch(() => setLoadFailed(true));
  }
  useEffect(() => {
    void load();
  }, [requestId]);

  async function post(event: FormEvent) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError(null);
    setAnnouncement("");
    // The button is disabled while posting, so the focus moves to the text area first.
    textArea.current?.focus();
    try {
      const { comment } = await addComment(requestId, text);
      setItems((current) => [...(current ?? []), comment]);
      setText("");
      setAnnouncement("Comment posted");
    } catch (err) {
      setError(messageOf(err, "Could not post the comment."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4" aria-label="Comments">
      <h2 className="h6">Comments</h2>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

      {loadFailed && (
        <div className="alert alert-danger">
          Unable to load comments. <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!loadFailed && items === null && <p>Loading comments...</p>}
      {!loadFailed && items?.length === 0 && <p className="text-muted">No comments yet.</p>}
      {!loadFailed && items && items.length > 0 && (
        <ol className="list-unstyled">
          {items.map((c) => (
            <li key={c.id} className="border-bottom py-2">
              <div>
                <strong>{c.author.name}</strong>, {formatDateTime(c.createdAt)}
              </div>
              <div className="text-break" style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
            </li>
          ))}
        </ol>
      )}

      {canComment && !loadFailed && items !== null && (
        <form onSubmit={post}>
          <label htmlFor="comment-text" className="form-label">Add a comment</label>
          <textarea
            id="comment-text"
            ref={textArea}
            className="form-control"
            rows={3}
            value={text}
            readOnly={busy}
            aria-describedby={error ? "comment-help comment-error" : "comment-help"}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setText(e.target.value)}
          />
          <div id="comment-help" className="form-text">Up to 1000 characters.</div>
          {error && <div id="comment-error" role="alert" className="alert alert-danger mt-2 mb-0">{error}</div>}
          <button type="submit" className="btn btn-outline-primary mt-2" disabled={busy || !text.trim()}>Post comment</button>
        </form>
      )}
    </section>
  );
}
