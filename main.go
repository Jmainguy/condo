package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

//go:embed static/*
var staticFiles embed.FS

var cache = &CalendarCache{}

func main() {
	// Years: 2023 (when rental started) through current year + next year
	currentYear := time.Now().Year()
	var yearsToFetch []string
	for year := 2023; year <= currentYear+1; year++ {
		yearsToFetch = append(yearsToFetch, fmt.Sprintf("%d", year))
	}

	// Allow override via environment variable
	if yearEnv := os.Getenv("ELLIOTT_YEARS"); yearEnv != "" {
		yearsToFetch = strings.Split(yearEnv, ",")
	}

	config := ServerConfig{
		Port:     getEnv("PORT", "8080"),
		Username: os.Getenv("ELLIOTT_USERNAME"),
		Password: os.Getenv("ELLIOTT_PASSWORD"),
		Property: getEnv("ELLIOTT_PROPERTY", "GRA1901"),
		Years:    yearsToFetch,
	}

	if config.Username == "" || config.Password == "" {
		log.Fatal("ELLIOTT_USERNAME and ELLIOTT_PASSWORD environment variables must be set")
	}

	// Initialize HTTP client with persistent session
	log.Println("Initializing HTTP client and logging in...")
	if err := initializeHTTPClient(config); err != nil {
		log.Fatalf("Failed to initialize: %v", err)
	}

	// Initialize bookings map
	cache.mu.Lock()
	cache.bookings = make(map[string][]BookingData)
	cache.mu.Unlock()

	log.Printf("Using years: %v", config.Years)

	// Initial fetch - get all years
	log.Println("Fetching initial calendar data...")
	if err := fetchAndCacheCalendar(nil); err != nil {
		log.Printf("Warning: initial fetch failed: %v", err)
	}

	// Start background job to refresh calendar data
	go refreshCalendarPeriodically()

	// Setup routes
	http.HandleFunc("/api/bookings", handleBookings)
	http.HandleFunc("/api/years", handleYears)
	http.HandleFunc("/api/health", handleHealth)

	// Serve embedded static files with logging
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	http.Handle("/", loggingMiddleware(http.FileServer(http.FS(staticFS))))

	addr := "0.0.0.0:" + config.Port
	log.Printf("Server starting on http://%s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
