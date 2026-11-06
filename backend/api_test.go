package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	store, err := OpenStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { store.Close() })
	mux := http.NewServeMux()
	NewAPI(store).Register(mux)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func do(t *testing.T, srv *httptest.Server, method, path, body string) (int, string) {
	t.Helper()
	req, err := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var sb strings.Builder
	buf := make([]byte, 4096)
	for {
		n, err := res.Body.Read(buf)
		sb.Write(buf[:n])
		if err != nil {
			break
		}
	}
	return res.StatusCode, sb.String()
}

func TestEventLifecycle(t *testing.T) {
	srv := newTestServer(t)

	code, body := do(t, srv, "POST", "/api/events",
		`{"title":"Lunch","description":"","color":"#039be5","start":"2026-11-06T12:00:00Z","end":"2026-11-06T13:00:00Z"}`)
	if code != http.StatusCreated {
		t.Fatalf("create: %d %s", code, body)
	}
	var e Event
	if err := json.Unmarshal([]byte(body), &e); err != nil {
		t.Fatal(err)
	}
	if e.ID == 0 || e.Title != "Lunch" {
		t.Fatalf("unexpected event: %+v", e)
	}

	// Overlapping range finds it, other range does not.
	_, body = do(t, srv, "GET", "/api/events?start=2026-11-06T00:00:00Z&end=2026-11-07T00:00:00Z", "")
	if !strings.Contains(body, "Lunch") {
		t.Fatalf("list should contain event: %s", body)
	}
	_, body = do(t, srv, "GET", "/api/events?start=2026-11-07T00:00:00Z&end=2026-11-08T00:00:00Z", "")
	if strings.TrimSpace(body) != "[]" {
		t.Fatalf("list should be empty: %s", body)
	}

	code, body = do(t, srv, "PUT", "/api/events/1",
		`{"title":"Late lunch","description":"x","color":"#d50000","start":"2026-11-06T13:00:00Z","end":"2026-11-06T14:30:00Z"}`)
	if code != http.StatusOK || !strings.Contains(body, "Late lunch") {
		t.Fatalf("update: %d %s", code, body)
	}

	if code, _ = do(t, srv, "DELETE", "/api/events/1", ""); code != http.StatusNoContent {
		t.Fatalf("delete: %d", code)
	}
	if code, _ = do(t, srv, "DELETE", "/api/events/1", ""); code != http.StatusNotFound {
		t.Fatalf("second delete: %d", code)
	}
}

func TestEventValidation(t *testing.T) {
	srv := newTestServer(t)
	bad := []string{
		`{"title":"x","start":"2026-11-06T13:00:00Z","end":"2026-11-06T12:00:00Z"}`,
		`{"title":"x","start":"2026-11-06T13:00:00Z"}`,
		`{"title":"x","color":"red","start":"2026-11-06T12:00:00Z","end":"2026-11-06T13:00:00Z"}`,
		`{"title":"x","unknown":1,"start":"2026-11-06T12:00:00Z","end":"2026-11-06T13:00:00Z"}`,
	}
	for _, b := range bad {
		if code, body := do(t, srv, "POST", "/api/events", b); code != http.StatusBadRequest {
			t.Errorf("expected 400 for %s, got %d %s", b, code, body)
		}
	}
}

func TestSettings(t *testing.T) {
	srv := newTestServer(t)

	_, body := do(t, srv, "GET", "/api/settings", "")
	var s Settings
	if err := json.Unmarshal([]byte(body), &s); err != nil {
		t.Fatal(err)
	}
	if s != defaultSettings {
		t.Fatalf("defaults: got %+v", s)
	}

	code, body := do(t, srv, "PUT", "/api/settings", `{"timeFormat":"24h","timeZone":"Europe/Berlin","defaultDuration":30,"theme":"dark"}`)
	if code != http.StatusOK {
		t.Fatalf("put: %d %s", code, body)
	}
	_ = json.Unmarshal([]byte(body), &s)
	if s.TimeFormat != "24h" || s.TimeZone != "Europe/Berlin" || s.DefaultDuration != 30 || s.Theme != "dark" || s.DateFormat != "MDY" {
		t.Fatalf("after put: %+v", s)
	}

	for _, b := range []string{`{"timeZone":"Mars/Base"}`, `{"defaultDuration":7}`, `{"theme":"blue"}`} {
		if code, _ := do(t, srv, "PUT", "/api/settings", b); code != http.StatusBadRequest {
			t.Errorf("expected 400 for %s, got %d", b, code)
		}
	}
}
