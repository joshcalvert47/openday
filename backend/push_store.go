package main

import (
	"database/sql"
	"errors"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
)

// ---- Web Push data in the database ----

func (s *Store) getMeta(key string) (string, bool, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM meta WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return v, err == nil, err
}

func (s *Store) setMeta(key, value string) error {
	_, err := s.db.Exec(`
		INSERT INTO meta (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	return err
}

// VAPIDKeys returns the server's Web Push keys, and makes them the first time.
func (s *Store) VAPIDKeys() (public, private string, err error) {
	public, ok1, err := s.getMeta("vapidPublicKey")
	if err != nil {
		return "", "", err
	}
	private, ok2, err := s.getMeta("vapidPrivateKey")
	if err != nil {
		return "", "", err
	}
	if ok1 && ok2 {
		return public, private, nil
	}
	private, public, err = webpush.GenerateVAPIDKeys()
	if err != nil {
		return "", "", err
	}
	if err := s.setMeta("vapidPublicKey", public); err != nil {
		return "", "", err
	}
	if err := s.setMeta("vapidPrivateKey", private); err != nil {
		return "", "", err
	}
	return public, private, nil
}

func (s *Store) SaveSubscription(sub webpush.Subscription) error {
	_, err := s.db.Exec(`
		INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
		sub.Endpoint, sub.Keys.P256dh, sub.Keys.Auth, nowMs())
	return err
}

func (s *Store) DeleteSubscription(endpoint string) error {
	_, err := s.db.Exec(`DELETE FROM push_subscriptions WHERE endpoint = ?`, endpoint)
	return err
}

func (s *Store) Subscriptions() ([]webpush.Subscription, error) {
	rows, err := s.db.Query(`SELECT endpoint, p256dh, auth FROM push_subscriptions ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []webpush.Subscription
	for rows.Next() {
		var sub webpush.Subscription
		if err := rows.Scan(&sub.Endpoint, &sub.Keys.P256dh, &sub.Keys.Auth); err != nil {
			return nil, err
		}
		out = append(out, sub)
	}
	return out, rows.Err()
}

func (s *Store) WasSent(key string) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM push_sent WHERE key = ?`, key).Scan(&n)
	return n > 0, err
}

func (s *Store) MarkSent(key string, now time.Time) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO push_sent (key, sent_at) VALUES (?, ?)`, key, toMs(now))
	return err
}

// Snooze is a notification to show again later.
type Snooze struct {
	Key        string
	At         time.Time
	EventID    int64
	EventStart time.Time
}

func (s *Store) SaveSnooze(sn Snooze) error {
	_, err := s.db.Exec(`
		INSERT INTO push_snoozes (key, at_ms, event_id, event_start) VALUES (?, ?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET at_ms = excluded.at_ms`,
		sn.Key, toMs(sn.At), sn.EventID, toMs(sn.EventStart))
	return err
}

func (s *Store) DeleteSnooze(key string) error {
	_, err := s.db.Exec(`DELETE FROM push_snoozes WHERE key = ?`, key)
	return err
}

// DueSnoozes returns snoozes whose time has come.
func (s *Store) DueSnoozes(now time.Time) ([]Snooze, error) {
	rows, err := s.db.Query(`SELECT key, at_ms, event_id, event_start FROM push_snoozes WHERE at_ms <= ?`, toMs(now))
	if err != nil {
		return nil, err
	}
	var out []Snooze
	for rows.Next() {
		var sn Snooze
		var at, start int64
		if err := rows.Scan(&sn.Key, &at, &sn.EventID, &start); err != nil {
			rows.Close()
			return nil, err
		}
		sn.At, sn.EventStart = fromMs(at), fromMs(start)
		out = append(out, sn)
	}
	rows.Close()
	return out, rows.Err()
}

// PruneSent forgets pushed reminders older than the given time.
func (s *Store) PruneSent(before time.Time) error {
	_, err := s.db.Exec(`DELETE FROM push_sent WHERE sent_at < ?`, toMs(before))
	return err
}
