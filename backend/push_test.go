package main

import (
	"context"
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// fakeSub makes a browser-like subscription that points at url.
func fakeSub(t *testing.T, url string) webpush.Subscription {
	t.Helper()
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	auth := make([]byte, 16)
	rand.Read(auth)
	enc := base64.RawURLEncoding.EncodeToString
	return webpush.Subscription{Endpoint: url, Keys: webpush.Keys{P256dh: enc(key.PublicKey().Bytes()), Auth: enc(auth)}}
}

// fakePushService counts pushes and answers with the given status.
func fakePushService(t *testing.T, status int) (*httptest.Server, *atomic.Int32) {
	var n atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" || r.Header.Get("TTL") == "" {
			t.Errorf("push request without VAPID or TTL headers")
		}
		n.Add(1)
		w.WriteHeader(status)
	}))
	t.Cleanup(srv.Close)
	return srv, &n
}

func TestNotifierPush(t *testing.T) {
	store, err := OpenStore(filepath.Join(t.TempDir(), "push.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	ctx := context.Background()
	n := NewNotifier(store, "https://example.com")
	now := time.Now().UTC().Truncate(time.Millisecond)

	ok, okCount := fakePushService(t, http.StatusCreated)
	gone, goneCount := fakePushService(t, http.StatusGone)
	if err := store.SaveSubscription(fakeSub(t, ok.URL)); err != nil {
		t.Fatal(err)
	}
	if err := store.SaveSubscription(fakeSub(t, gone.URL+"/gone")); err != nil {
		t.Fatal(err)
	}

	// Due now (30 minutes before), not due yet (10 minutes before).
	e, err := store.CreateEvent(Event{Title: "Dentist", Start: now.Add(30 * time.Minute), End: now.Add(90 * time.Minute), Reminders: []int{10, 30}})
	if err != nil {
		t.Fatal(err)
	}

	if err := n.Tick(ctx, now); err != nil {
		t.Fatal(err)
	}
	if okCount.Load() != 1 || goneCount.Load() != 1 {
		t.Fatalf("first tick: ok=%d gone=%d", okCount.Load(), goneCount.Load())
	}
	if sent, _ := store.WasSent(reminderKey(e, 30)); !sent {
		t.Fatal("reminder should be marked as sent")
	}
	if sent, _ := store.WasSent(reminderKey(e, 10)); sent {
		t.Fatal("10 minute reminder is not due yet")
	}
	subs, _ := store.Subscriptions()
	if len(subs) != 1 {
		t.Fatalf("410 subscription should be removed, have %d", len(subs))
	}

	// Sent once only.
	if err := n.Tick(ctx, now.Add(20*time.Second)); err != nil {
		t.Fatal(err)
	}
	if okCount.Load() != 1 {
		t.Fatalf("sent again: %d", okCount.Load())
	}

	// A snooze comes back at its time.
	at := now.Add(15 * time.Minute) // before the 10 minute reminder is due
	key := snoozeKey(reminderKey(e, 30), at)
	if err := store.SaveSnooze(Snooze{Key: key, At: at, EventID: e.ID, EventStart: e.Start}); err != nil {
		t.Fatal(err)
	}
	if err := n.Tick(ctx, at.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	if okCount.Load() != 2 {
		t.Fatalf("snooze not sent: %d", okCount.Load())
	}
	if due, _ := store.DueSnoozes(at.Add(time.Hour)); len(due) != 0 {
		t.Fatalf("snooze should be removed after sending: %+v", due)
	}

	// Alerts mode: the server does not push.
	if err := store.SetSettings(map[string]string{"notifications": "alerts"}); err != nil {
		t.Fatal(err)
	}
	if err := n.Tick(ctx, now.Add(20*time.Minute)); err != nil { // 10 minute reminder is due
		t.Fatal(err)
	}
	if okCount.Load() != 2 {
		t.Fatalf("alerts mode should not push: %d", okCount.Load())
	}
}

func TestNotifierFailedPushIsRetried(t *testing.T) {
	store, err := OpenStore(filepath.Join(t.TempDir(), "push.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	now := time.Now().UTC().Truncate(time.Millisecond)
	bad, badCount := fakePushService(t, http.StatusInternalServerError)
	_ = store.SaveSubscription(fakeSub(t, bad.URL))
	e, _ := store.CreateEvent(Event{Title: "x", Start: now.Add(time.Minute), End: now.Add(time.Hour), Reminders: []int{1}})

	n := NewNotifier(store, "https://example.com")
	_ = n.Tick(context.Background(), now)
	_ = n.Tick(context.Background(), now.Add(15*time.Second))
	if badCount.Load() != 2 {
		t.Fatalf("failed push should be tried again: %d", badCount.Load())
	}
	// Not marked as sent, so the open tab shows it instead.
	if sent, _ := store.WasSent(reminderKey(e, 1)); sent {
		t.Fatal("failed push must not be marked as sent")
	}
}

func TestPushAPI(t *testing.T) {
	srv := newTestServer(t)
	code, body := do(t, srv, "GET", "/api/push/key", "")
	if code != http.StatusOK || len(body) < 50 {
		t.Fatalf("key: %d %s", code, body)
	}
	_, body2 := do(t, srv, "GET", "/api/push/key", "")
	if body != body2 {
		t.Fatal("key must stay the same")
	}
	if code, body := do(t, srv, "POST", "/api/push/subscriptions",
		`{"endpoint":"https://push.example.com/abc","expirationTime":null,"keys":{"p256dh":"x","auth":"y"}}`); code != http.StatusNoContent {
		t.Fatalf("subscribe: %d %s", code, body)
	}
	if code, _ := do(t, srv, "POST", "/api/push/subscriptions", `{"endpoint":"http://x","keys":{"p256dh":"x","auth":"y"}}`); code != http.StatusBadRequest {
		t.Fatalf("http endpoint should be refused: %d", code)
	}
	at := time.Now().Add(time.Minute).UnixMilli()
	if code, body := do(t, srv, "POST", "/api/push/snooze",
		`{"key":"1:2:3","at":`+itoa(at)+`,"eventId":1,"eventStart":2}`); code != http.StatusNoContent {
		t.Fatalf("snooze: %d %s", code, body)
	}
	if code, body := do(t, srv, "GET", "/api/push/sent?key=1:2:3", ""); code != http.StatusOK || body != "{\"sent\":false}\n" {
		t.Fatalf("sent: %d %s", code, body)
	}
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }
