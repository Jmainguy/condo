package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"time"
)

func handleBookings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get year from query parameter, default to current year
	year := r.URL.Query().Get("year")
	if year == "" {
		year = fmt.Sprintf("%d", time.Now().Year())
	}

	cache.mu.RLock()
	bookings := cache.bookings[year]
	lastFetch := cache.lastFetch
	cache.mu.RUnlock()

	// Sort bookings by start date
	sort.Slice(bookings, func(i, j int) bool {
		return bookings[i].StartDate < bookings[j].StartDate
	})

	response := map[string]interface{}{
		"bookings":  bookings,
		"year":      year,
		"lastFetch": lastFetch.Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding bookings response: %v", err)
	}
}

func handleYears(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cache.mu.RLock()
	years := cache.config.Years
	cache.mu.RUnlock()

	response := map[string]interface{}{
		"years":       years,
		"currentYear": time.Now().Year(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding years response: %v", err)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	cache.mu.RLock()
	lastFetch := cache.lastFetch
	cache.mu.RUnlock()

	health := map[string]interface{}{
		"status":    "ok",
		"lastFetch": lastFetch.Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(health); err != nil {
		log.Printf("Error encoding health response: %v", err)
	}
}
