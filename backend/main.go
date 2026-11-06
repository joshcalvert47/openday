// OpenDay is a self-hosted calendar.
//
// This binary serves the JSON API under /api and the embedded React frontend
// for every other path.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Embed the time zone database so the image works without system tzdata.
	_ "time/tzdata"
)

func main() {
	addr := envOr("OPENDAY_ADDR", ":8080")
	dbPath := envOr("OPENDAY_DB", "openday.db")

	store, err := OpenStore(dbPath)
	if err != nil {
		log.Fatalf("open database %q: %v", dbPath, err)
	}
	defer store.Close()

	// Send reminders with Web Push, so they show even when no tab is open.
	pushCtx, stopPush := context.WithCancel(context.Background())
	defer stopPush()
	go NewNotifier(store, envOr("OPENDAY_PUSH_CONTACT", "https://github.com/nikolozlortki/openday")).Run(pushCtx)

	mux := http.NewServeMux()
	NewAPI(store).Register(mux)
	mux.Handle("/", frontendHandler())

	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("OpenDay listening on %s (database: %s)", addr, dbPath)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	// Stop cleanly on Ctrl+C or `docker stop`.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Print("shutting down")
	stopPush()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
