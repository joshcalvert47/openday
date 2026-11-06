package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// Web Push: the server sends due reminders to subscribed browsers, so
// notifications show even when no calendar tab is open.
// The open tab still checks reminders too (see frontend/src/notifications.js);
// it only shows a desktop notification itself when the server did not push it.

const (
	pushTick       = 15 * time.Second
	pushLateLimit  = 10 * time.Minute // same as the frontend: skip older reminders
	pushTTLSeconds = 10 * 60          // push services drop the message after this
	maxPushKeyLen  = 500
)

// Notifier finds due reminders and pushes them.
type Notifier struct {
	store      *Store
	subscriber string // contact for push services (https URL or e-mail)
	client     *http.Client

	mu     sync.Mutex
	logged map[string]bool // keys whose send error was already logged
}

func NewNotifier(store *Store, subscriber string) *Notifier {
	return &Notifier{
		store:      store,
		subscriber: subscriber,
		client:     &http.Client{Timeout: 15 * time.Second},
		logged:     map[string]bool{},
	}
}

// Run checks for due reminders until ctx is done.
func (n *Notifier) Run(ctx context.Context) {
	t := time.NewTicker(pushTick)
	defer t.Stop()
	for {
		if err := n.Tick(ctx, time.Now()); err != nil {
			log.Printf("push: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// pushItem is one notification to send.
type pushItem struct {
	key     string
	event   Event
	snoozed bool
}

// pushPayload is what the service worker receives (frontend/public/sw.js).
type pushPayload struct {
	Key          string    `json:"key"`
	Event        pushEvent `json:"event"`
	TimeZone     string    `json:"timeZone"`
	DateFormat   string    `json:"dateFormat"`
	TimeFormat   string    `json:"timeFormat"`
	SnoozeBefore int       `json:"snoozeBefore"`
	Sound        bool      `json:"sound"`
}

type pushEvent struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
	Start int64  `json:"start"`
	End   int64  `json:"end"`
}

// reminderKey must match the key the frontend uses ("id:startMs:minutes").
func reminderKey(e Event, minutes int) string {
	return fmt.Sprintf("%d:%d:%d", e.ID, toMs(e.Start), minutes)
}

func snoozeKey(key string, at time.Time) string {
	return fmt.Sprintf("%s:snooze:%d", key, toMs(at))
}

// Tick sends the reminders that are due at now.
func (n *Notifier) Tick(ctx context.Context, now time.Time) error {
	settings, err := loadSettings(n.store)
	if err != nil {
		return err
	}
	if settings.Notifications != "desktop" {
		return nil
	}
	subs, err := n.store.Subscriptions()
	if err != nil || len(subs) == 0 {
		return err
	}

	var items []pushItem
	events, err := n.store.ListEvents(now, now.Add(maxReminderMins*time.Minute+time.Minute))
	if err != nil {
		return err
	}
	for _, e := range events {
		for _, m := range e.Reminders {
			at := e.Start.Add(-time.Duration(m) * time.Minute)
			if !at.After(now) && now.Sub(at) < pushLateLimit && now.Before(e.End) {
				items = append(items, pushItem{key: reminderKey(e, m), event: e})
			}
		}
	}

	snoozes, err := n.store.DueSnoozes(now)
	if err != nil {
		return err
	}
	for _, sn := range snoozes {
		e, err := n.store.GetEvent(sn.EventID)
		stale := errors.Is(err, ErrNotFound) || (err == nil && (!e.Start.Equal(sn.EventStart) || !now.Before(e.End)))
		if stale || now.Sub(sn.At) >= pushLateLimit {
			_ = n.store.DeleteSnooze(sn.Key)
			continue
		}
		if err != nil {
			return err
		}
		items = append(items, pushItem{key: sn.Key, event: e, snoozed: true})
	}

	for _, it := range items {
		sent, err := n.store.WasSent(it.key)
		if err != nil {
			return err
		}
		if sent {
			if it.snoozed {
				_ = n.store.DeleteSnooze(it.key)
			}
			continue
		}
		if n.send(ctx, it, settings, subs) {
			if err := n.store.MarkSent(it.key, now); err != nil {
				return err
			}
			if it.snoozed {
				_ = n.store.DeleteSnooze(it.key)
			}
		}
	}
	return n.store.PruneSent(now.Add(-48 * time.Hour))
}

// send pushes one notification to every browser. It returns true if at least
// one push service accepted it. If none did, the open tab shows it instead.
func (n *Notifier) send(ctx context.Context, it pushItem, s Settings, subs []webpush.Subscription) bool {
	public, private, err := n.store.VAPIDKeys()
	if err != nil {
		log.Printf("push: keys: %v", err)
		return false
	}
	msg, _ := json.Marshal(pushPayload{
		Key: it.key,
		Event: pushEvent{
			ID: it.event.ID, Title: it.event.Title,
			Start: toMs(it.event.Start), End: toMs(it.event.End),
		},
		TimeZone:     s.TimeZone,
		DateFormat:   s.DateFormat,
		TimeFormat:   s.TimeFormat,
		SnoozeBefore: s.SnoozeBefore,
		Sound:        s.NotificationSound,
	})
	ok := false
	for i := range subs {
		res, err := webpush.SendNotificationWithContext(ctx, msg, &subs[i], &webpush.Options{
			HTTPClient:      n.client,
			Subscriber:      n.subscriber,
			VAPIDPublicKey:  public,
			VAPIDPrivateKey: private,
			TTL:             pushTTLSeconds,
			Urgency:         webpush.UrgencyHigh,
		})
		if err != nil {
			n.logOnce(it.key, fmt.Sprintf("push: send to %s: %v", host(subs[i].Endpoint), err))
			continue
		}
		res.Body.Close()
		switch {
		case res.StatusCode == http.StatusNotFound || res.StatusCode == http.StatusGone:
			// The browser unsubscribed (or the subscription expired).
			_ = n.store.DeleteSubscription(subs[i].Endpoint)
		case res.StatusCode >= 200 && res.StatusCode < 300:
			ok = true
		default:
			n.logOnce(it.key, fmt.Sprintf("push: %s answered %d", host(subs[i].Endpoint), res.StatusCode))
		}
	}
	return ok
}

func (n *Notifier) logOnce(key, msg string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.logged) > 1000 {
		n.logged = map[string]bool{}
	}
	if !n.logged[key+msg] {
		n.logged[key+msg] = true
		log.Print(msg)
	}
}

func host(endpoint string) string {
	if u, err := url.Parse(endpoint); err == nil {
		return u.Host
	}
	return "?"
}

// ---- HTTP handlers ----

func (a *API) registerPush(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/push/key", a.pushKey)
	mux.HandleFunc("POST /api/push/subscriptions", a.pushSubscribe)
	mux.HandleFunc("POST /api/push/snooze", a.pushSnooze)
	mux.HandleFunc("GET /api/push/sent", a.pushSent)
}

func (a *API) pushKey(w http.ResponseWriter, r *http.Request) {
	public, _, err := a.store.VAPIDKeys()
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"publicKey": public})
}

func (a *API) pushSubscribe(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Endpoint       string       `json:"endpoint"`
		ExpirationTime *json.Number `json:"expirationTime"`
		Keys           webpush.Keys `json:"keys"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	u, err := url.Parse(in.Endpoint)
	switch {
	case err != nil || u.Scheme != "https" || u.Host == "" || len(in.Endpoint) > 2000:
		writeError(w, http.StatusBadRequest, "endpoint must be an https URL")
		return
	case in.Keys.P256dh == "" || in.Keys.Auth == "" || len(in.Keys.P256dh) > 200 || len(in.Keys.Auth) > 200:
		writeError(w, http.StatusBadRequest, "keys.p256dh and keys.auth are required")
		return
	}
	sub := webpush.Subscription{Endpoint: in.Endpoint, Keys: in.Keys}
	if err := a.store.SaveSubscription(sub); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// pushSnooze is called by the service worker when the user presses Snooze.
// key is the notification's key; at is when to show it again (Unix ms).
func (a *API) pushSnooze(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Key        string `json:"key"`
		At         int64  `json:"at"`
		EventID    int64  `json:"eventId"`
		EventStart int64  `json:"eventStart"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	at := fromMs(in.At)
	if in.Key == "" || len(in.Key) > maxPushKeyLen || in.EventID <= 0 ||
		at.Before(time.Now().Add(-time.Hour)) || at.After(time.Now().Add(maxReminderMins*time.Minute)) {
		writeError(w, http.StatusBadRequest, "invalid snooze")
		return
	}
	err := a.store.SaveSnooze(Snooze{Key: snoozeKey(in.Key, at), At: at, EventID: in.EventID, EventStart: fromMs(in.EventStart)})
	if err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// pushSent tells the open tab whether the server already pushed a notification.
func (a *API) pushSent(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" || len(key) > maxPushKeyLen {
		writeError(w, http.StatusBadRequest, "key is required")
		return
	}
	sent, err := a.store.WasSent(key)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"sent": sent})
}
