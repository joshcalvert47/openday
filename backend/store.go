package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite" // pure Go SQLite driver (no CGO)
)

// Event is a calendar event. Start and End are stored as Unix milliseconds (UTC).
type Event struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Color       string    `json:"color"`
	Start       time.Time `json:"start"`
	End         time.Time `json:"end"`
	// Reminders are notification times in minutes before the start (sorted, no duplicates).
	Reminders []int `json:"reminders"`
}

var ErrNotFound = errors.New("not found")

// Store wraps the SQLite database.
type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS events (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	title       TEXT    NOT NULL DEFAULT '',
	description TEXT    NOT NULL DEFAULT '',
	color       TEXT    NOT NULL DEFAULT '',
	start_ms    INTEGER NOT NULL,
	end_ms      INTEGER NOT NULL,
	created_at  INTEGER NOT NULL,
	updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_start_end ON events(start_ms, end_ms);

CREATE TABLE IF NOT EXISTS settings (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`

// OpenStore opens (or creates) the database file and makes sure the tables exist.
func OpenStore(path string) (*Store, error) {
	dsn := "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection keeps SQLite simple and avoids "database is locked" errors.
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("create schema: %w", err)
	}
	if err := migrate(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return &Store{db: db}, nil
}

// migrate adds columns that older databases do not have yet.
func migrate(db *sql.DB) error {
	has, err := hasColumn(db, "events", "reminders")
	if err != nil || has {
		return err
	}
	_, err = db.Exec(`ALTER TABLE events ADD COLUMN reminders TEXT NOT NULL DEFAULT '[]'`)
	return err
}

func hasColumn(db *sql.DB, table, column string) (bool, error) {
	rows, err := db.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}

func encodeReminders(r []int) string {
	if r == nil {
		r = []int{}
	}
	b, _ := json.Marshal(r)
	return string(b)
}

func decodeReminders(s string) []int {
	r := []int{}
	_ = json.Unmarshal([]byte(s), &r)
	return r
}

func (s *Store) Close() error { return s.db.Close() }

func toMs(t time.Time) int64    { return t.UnixMilli() }
func fromMs(ms int64) time.Time { return time.UnixMilli(ms).UTC() }
func nowMs() int64              { return time.Now().UnixMilli() }

// ListEvents returns events that overlap the range [from, to).
func (s *Store) ListEvents(from, to time.Time) ([]Event, error) {
	rows, err := s.db.Query(`
		SELECT id, title, description, color, start_ms, end_ms, reminders
		FROM events
		WHERE start_ms < ? AND end_ms > ?
		ORDER BY start_ms, end_ms DESC, id`, toMs(to), toMs(from))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := []Event{}
	for rows.Next() {
		var e Event
		var start, end int64
		var reminders string
		if err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.Color, &start, &end, &reminders); err != nil {
			return nil, err
		}
		e.Start, e.End = fromMs(start), fromMs(end)
		e.Reminders = decodeReminders(reminders)
		events = append(events, e)
	}
	return events, rows.Err()
}

func (s *Store) GetEvent(id int64) (Event, error) {
	var e Event
	var start, end int64
	var reminders string
	err := s.db.QueryRow(`
		SELECT id, title, description, color, start_ms, end_ms, reminders
		FROM events WHERE id = ?`, id).
		Scan(&e.ID, &e.Title, &e.Description, &e.Color, &start, &end, &reminders)
	if errors.Is(err, sql.ErrNoRows) {
		return e, ErrNotFound
	}
	e.Start, e.End = fromMs(start), fromMs(end)
	e.Reminders = decodeReminders(reminders)
	return e, err
}

func (s *Store) CreateEvent(e Event) (Event, error) {
	now := nowMs()
	res, err := s.db.Exec(`
		INSERT INTO events (title, description, color, start_ms, end_ms, reminders, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.Title, e.Description, e.Color, toMs(e.Start), toMs(e.End), encodeReminders(e.Reminders), now, now)
	if err != nil {
		return e, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return e, err
	}
	return s.GetEvent(id)
}

func (s *Store) UpdateEvent(e Event) (Event, error) {
	res, err := s.db.Exec(`
		UPDATE events
		SET title = ?, description = ?, color = ?, start_ms = ?, end_ms = ?, reminders = ?, updated_at = ?
		WHERE id = ?`,
		e.Title, e.Description, e.Color, toMs(e.Start), toMs(e.End), encodeReminders(e.Reminders), nowMs(), e.ID)
	if err != nil {
		return e, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return e, ErrNotFound
	}
	return s.GetEvent(e.ID)
}

func (s *Store) DeleteEvent(id int64) error {
	res, err := s.db.Exec(`DELETE FROM events WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// Settings are stored as key/value text pairs.
func (s *Store) GetSettings() (map[string]string, error) {
	rows, err := s.db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

func (s *Store) SetSettings(values map[string]string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for k, v := range values {
		if _, err := tx.Exec(`
			INSERT INTO settings (key, value) VALUES (?, ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value`, k, v); err != nil {
			return err
		}
	}
	return tx.Commit()
}
