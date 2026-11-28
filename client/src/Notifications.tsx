import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ApiError, listNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from "./api";
import { formatDateTime } from "./format";
import type { LayoutContext } from "./Layout";

// The message is built here from the type, the actor and the request. React shows it as text.
function messageOf({ type, actor, request }: AppNotification) {
  const subject = `${request.requestNumber}: ${request.itemName}`;
  const text = {
    SUBMITTED: `${actor.name} submitted ${subject} for review.`,
    APPROVED: `${actor.name} approved ${subject}.`,
    REJECTED: `${actor.name} rejected ${subject}.`,
    RETURNED: `${actor.name} returned ${subject} for editing.`,
  };
  return text[type];
}

// F-12: the caller's notifications, newest first.
export default function Notifications() {
  const { refreshUnread } = useOutletContext<LayoutContext>();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const links = useRef(new Map<number, HTMLAnchorElement>());
  // Focus moves after the next render, when the buttons are enabled again or the list has changed.
  const focusNext = useRef<(() => HTMLElement | null | undefined) | null>(null);

  useEffect(() => {
    if (busy || !focusNext.current) return;
    focusNext.current()?.focus();
    focusNext.current = null;
  }, [busy]);

  function load() {
    setLoadFailed(false);
    setItems(null);
    return listNotifications()
      .then((r) => {
        setItems(r.notifications);
        setUnread(r.unreadCount);
      })
      .catch(() => setLoadFailed(true));
  }
  useEffect(() => {
    void load();
  }, []);

  async function mark(call: () => Promise<void>, button: HTMLButtonElement) {
    setBusy(true);
    setError(null);
    setAnnouncement("");
    try {
      await call();
      refreshUnread();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark the notification as read.");
      focusNext.current = () => button;
    } finally {
      setBusy(false);
    }
  }

  const markOne = (id: number, button: HTMLButtonElement) =>
    mark(async () => {
      const { notification } = await markNotificationRead(id);
      setItems((current) => (current ?? []).map((n) => (n.id === id ? notification : n)));
      setUnread((count) => Math.max(0, count - 1));
      setAnnouncement("Notification marked as read");
      focusNext.current = () => links.current.get(id);
    }, button);

  const markAll = (button: HTMLButtonElement) =>
    mark(async () => {
      const { unreadCount } = await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((current) => (current ?? []).map((n) => (n.readAt ? n : { ...n, readAt: now })));
      setUnread(unreadCount);
      setAnnouncement("All notifications marked as read");
      focusNext.current = () => heading.current;
    }, button);

  // Opening the request also marks the notification; the page opens even if that call fails.
  function opened(n: AppNotification) {
    if (!n.readAt) markNotificationRead(n.id).then(refreshUnread).catch(() => {});
  }

  return (
    <main>
      <h1 className="h4" tabIndex={-1} ref={heading}>Notifications</h1>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

      {loadFailed && (
        <div className="alert alert-danger">
          Unable to load notifications. <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => void load()}>Retry</button>
        </div>
      )}
      {!loadFailed && items === null && <p>Loading notifications...</p>}
      {!loadFailed && items?.length === 0 && <p className="text-muted">No notifications.</p>}

      {!loadFailed && items !== null && unread > 0 && (
        <button className="btn btn-outline-primary btn-sm mb-2" disabled={busy} onClick={(e) => void markAll(e.currentTarget)}>
          Mark all as read
        </button>
      )}
      {error && <div role="alert" className="alert alert-danger">{error}</div>}

      {!loadFailed && items && items.length > 0 && (
        <ul className="list-unstyled">
          {items.map((n) => (
            <li key={n.id} className="border-bottom py-2">
              <div id={`notification-${n.id}`} className="text-break">{messageOf(n)}</div>
              <div className="text-muted small">{formatDateTime(n.createdAt)}</div>
              <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
                {!n.readAt && <span className="badge text-bg-primary">Unread</span>}
                <Link
                  to={`/requests/${n.request.id}`}
                  ref={(el) => {
                    if (el) links.current.set(n.id, el);
                    else links.current.delete(n.id);
                  }}
                  onClick={() => opened(n)}
                >
                  View {n.request.requestNumber}
                </Link>
                {!n.readAt && (
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    aria-describedby={`notification-${n.id}`}
                    disabled={busy}
                    onClick={(e) => void markOne(n.id, e.currentTarget)}
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
