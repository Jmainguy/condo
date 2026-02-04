package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

//go:embed static/*
var staticFiles embed.FS

// CalendarEvent represents a booking on the calendar
type CalendarEvent struct {
	Title           string `json:"title"`
	Arrival         string `json:"Arrival"`
	Departure       string `json:"Departure"`
	Booked          string `json:"Booked"`
	Name            string `json:"Name"`
	Rent            string `json:"Rent"`
	Start           string `json:"start"`
	End             string `json:"end"`
	BackgroundColor string `json:"backgroundColor"`
}

// BookingData represents simplified booking info for the public calendar
type BookingData struct {
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Category  string `json:"category"`
	Available bool   `json:"available"`
}

// CalendarCache stores the fetched calendar data and persistent HTTP client
type CalendarCache struct {
	mu         sync.RWMutex
	bookings   map[string][]BookingData // bookings by year
	lastFetch  time.Time
	httpClient *http.Client
	config     ServerConfig
}

var cache = &CalendarCache{}

// ServerConfig holds the configuration for the Elliott portal server
type ServerConfig struct {
	Port     string
	Username string
	Password string
	Property string
	Years    []string // Years to fetch data for
}

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
	http.HandleFunc("/api/debug/reservation-report", handleDebugReservationReport)

	// Serve embedded static files
	staticFS, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}
	http.Handle("/", http.FileServer(http.FS(staticFS)))

	addr := "0.0.0.0:" + config.Port
	log.Printf("Server starting on http://0.0.0.0%s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func initializeHTTPClient(config ServerConfig) error {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return fmt.Errorf("failed to create cookie jar: %w", err)
	}

	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("too many redirects")
			}
			return nil
		},
		Timeout: 30 * time.Second,
	}

	cache.mu.Lock()
	cache.httpClient = client
	cache.config = config
	cache.mu.Unlock()

	// Initial login
	return loginWithClient()
}

func loginWithClient() error {
	cache.mu.RLock()
	client := cache.httpClient
	config := cache.config
	cache.mu.RUnlock()

	if client == nil {
		return fmt.Errorf("HTTP client not initialized")
	}

	log.Println("Logging in to Elliott portal...")
	if err := login(client, config.Username, config.Password); err != nil {
		return fmt.Errorf("login failed: %w", err)
	}
	log.Println("Login successful - session established")
	return nil
}

func login(client *http.Client, username, password string) error {
	loginPageURL := "https://elliottowner.com/index.php"

	formData := url.Values{}
	formData.Set("txtemail", username)
	formData.Set("txtupass", password)
	formData.Set("btn-login", "Log In")

	req, err := http.NewRequest("POST", loginPageURL, strings.NewReader(formData.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to submit login form: %w", err)
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Printf("Warning: failed to close response body: %v", err)
		}
	}()

	// Check if login was successful
	if resp.StatusCode == http.StatusOK && strings.Contains(resp.Request.URL.String(), "home.php") {
		return nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read login response: %w", err)
	}

	bodyStr := string(body)
	if strings.Contains(bodyStr, "Homeowner Login") {
		return fmt.Errorf("login failed - still on login page, check credentials")
	}
	if strings.Contains(strings.ToLower(bodyStr), "invalid") ||
		strings.Contains(strings.ToLower(bodyStr), "incorrect") {
		return fmt.Errorf("login appears to have failed - check credentials")
	}

	return nil
}

func fetchAndCacheCalendar(yearsToFetch []string) error {
	cache.mu.RLock()
	client := cache.httpClient
	config := cache.config
	cache.mu.RUnlock()

	if client == nil {
		return fmt.Errorf("HTTP client not initialized")
	}

	// Use provided years or default to all configured years
	if yearsToFetch == nil {
		yearsToFetch = config.Years
	}

	// Fetch calendar for each year
	for _, year := range yearsToFetch {
		if err := fetchYearCalendar(client, config, year); err != nil {
			log.Printf("Error fetching calendar for year %s: %v", year, err)
			// Continue with other years even if one fails
		}
	}

	cache.mu.Lock()
	cache.lastFetch = time.Now()
	cache.mu.Unlock()

	log.Printf("Calendar data updated for years: %v", yearsToFetch)
	return nil
}

func fetchYearCalendar(client *http.Client, config ServerConfig, year string) error {
	// Fetch calendar with retry logic and session management
	calendarURL := fmt.Sprintf("https://elliottowner.com/calendar.php?property=%s&year=%s", config.Property, year)

	var resp *http.Response
	var body []byte
	var err error
	maxRetries := 3
	needsRelogin := false

	for attempt := 1; attempt <= maxRetries; attempt++ {
		if attempt > 1 {
			waitTime := time.Duration(attempt*2) * time.Second
			log.Printf("Retrying calendar fetch in %v... (attempt %d/%d)", waitTime, attempt, maxRetries)
			time.Sleep(waitTime)
		}

		// Re-login if needed (session expired)
		if needsRelogin {
			log.Println("Session appears expired, re-logging in...")
			if err := loginWithClient(); err != nil {
				log.Printf("Re-login failed: %v", err)
				if attempt == maxRetries {
					return fmt.Errorf("failed to re-login after session expiration: %w", err)
				}
				continue
			}
			needsRelogin = false
		}

		resp, err = client.Get(calendarURL)
		if err != nil {
			if attempt == maxRetries {
				return fmt.Errorf("failed to fetch calendar after %d attempts: %w", maxRetries, err)
			}
			continue
		}

		// Check for session expiration (redirect to login or 401/403)
		if resp.StatusCode == http.StatusUnauthorized ||
			resp.StatusCode == http.StatusForbidden ||
			strings.Contains(resp.Request.URL.String(), "login") {
			if err := resp.Body.Close(); err != nil {
				log.Printf("Warning: failed to close response body: %v", err)
			}
			needsRelogin = true
			if attempt == maxRetries {
				return fmt.Errorf("session expired and re-login failed after %d attempts", maxRetries)
			}
			continue
		}

		// Check status code
		if resp.StatusCode == http.StatusOK {
			body, err = io.ReadAll(resp.Body)
			if closeErr := resp.Body.Close(); closeErr != nil {
				log.Printf("Warning: failed to close response body: %v", closeErr)
			}
			if err != nil {
				return fmt.Errorf("failed to read calendar response: %w", err)
			}

			// Double-check we didn't get redirected to login page
			bodyStr := string(body)
			if strings.Contains(bodyStr, "Homeowner Login") {
				log.Println("Got login page instead of calendar, session expired")
				needsRelogin = true
				if attempt == maxRetries {
					return fmt.Errorf("session expired and re-login failed")
				}
				continue
			}

			break // Success!
		}

		if err := resp.Body.Close(); err != nil {
			log.Printf("Warning: failed to close response body: %v", err)
		}

		// Handle Cloudflare errors (520-523) - worth retrying
		if resp.StatusCode >= 520 && resp.StatusCode <= 523 {
			if attempt == maxRetries {
				return fmt.Errorf("server error (Cloudflare status %d) persisted after %d attempts", resp.StatusCode, maxRetries)
			}
			log.Printf("Got Cloudflare error %d, will retry...", resp.StatusCode)
			continue
		}

		// Other errors - don't retry
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// Extract events
	events, err := extractCalendarEvents(string(body))
	if err != nil {
		return fmt.Errorf("failed to extract events: %w", err)
	}

	// Convert to public booking data
	bookings := make([]BookingData, len(events))
	for i, event := range events {
		bookings[i] = BookingData{
			StartDate: event.Start,
			EndDate:   event.End,
			Category:  getBookingType(event.BackgroundColor),
			Available: false,
		}
	}

	// Update cache for this year
	cache.mu.Lock()
	cache.bookings[year] = bookings
	cache.mu.Unlock()

	log.Printf("Calendar data updated for %s: %d bookings (using existing session)", year, len(bookings))
	return nil
}

func extractCalendarEvents(html string) ([]CalendarEvent, error) {
	// Find the defaultEvents JavaScript array
	re := regexp.MustCompile(`var defaultEvents\s*=\s*(\[.*?\]);`)
	matches := re.FindStringSubmatch(html)
	if len(matches) < 2 {
		return nil, fmt.Errorf("could not find defaultEvents in HTML")
	}

	eventsJS := matches[1]

	// Convert JavaScript object notation to JSON
	eventsJS = regexp.MustCompile(`'([^']*?)'`).ReplaceAllString(eventsJS, `"$1"`)
	eventsJS = regexp.MustCompile(`([{,]\s*)(\w+):`).ReplaceAllString(eventsJS, `$1"$2":`)
	eventsJS = regexp.MustCompile(`,(\s*[}\]])`).ReplaceAllString(eventsJS, "$1")

	var events []CalendarEvent
	if err := json.Unmarshal([]byte(eventsJS), &events); err != nil {
		if writeErr := os.WriteFile("events_debug.json", []byte(eventsJS), 0644); writeErr != nil {
			log.Printf("Warning: failed to write debug file: %v", writeErr)
		}
		return nil, fmt.Errorf("failed to parse events JSON: %w", err)
	}

	return events, nil
}

func getBookingType(color string) string {
	// Normalize color to lowercase for case-insensitive matching
	color = strings.ToLower(color)

	switch color {
	case "#1976d2":
		return "Guest Reservation"
	case "#8bc34a":
		return "Golf Reservation"
	case "#008080":
		return "OTA Booking"
	case "#ff6633":
		return "Owner Reservation"
	case "#8047d1":
		return "Owner Referral"
	case "#ff1493":
		return "Complimentary"
	case "#ffc107":
		return "Guest Reservation Awaiting Payment"
	default:
		// Log unknown colors for debugging
		if color != "" {
			log.Printf("Warning: Unknown booking color: %s (treating as Owner Reservation)", color)
			return "Owner Reservation"
		}
		return "Booked"
	}
}

func refreshCalendarPeriodically() {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// Only refresh current year and next year (past years don't change)
		currentYear := time.Now().Year()
		yearsToRefresh := []string{
			fmt.Sprintf("%d", currentYear),
			fmt.Sprintf("%d", currentYear+1),
		}
		log.Printf("Refreshing calendar data for current and next year: %v (reusing session cookies)...", yearsToRefresh)
		if err := fetchAndCacheCalendar(yearsToRefresh); err != nil {
			log.Printf("Error refreshing calendar: %v", err)
		}
	}
}

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

func handleDebugReservationReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	year := r.URL.Query().Get("year")
	if year == "" {
		year = fmt.Sprintf("%d", time.Now().Year())
	}

	cache.mu.RLock()
	client := cache.httpClient
	property := cache.config.Property
	cache.mu.RUnlock()

	if client == nil {
		http.Error(w, "HTTP client not initialized", http.StatusInternalServerError)
		return
	}

	// Fetch reservation report
	reportURL := fmt.Sprintf("https://elliottowner.com/reservation-report.php?property=%s&year=%s", property, year)
	log.Printf("Fetching reservation report: %s", reportURL)

	resp, err := client.Get(reportURL)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to fetch: %v", err), http.StatusInternalServerError)
		return
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Printf("Warning: failed to close response body: %v", err)
		}
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read: %v", err), http.StatusInternalServerError)
		return
	}

	// Save for debugging
	filename := fmt.Sprintf("reservation-report-%s.html", year)
	if err := os.WriteFile(filename, body, 0644); err != nil {
		log.Printf("Warning: failed to save report: %v", err)
	}

	// Return HTML for inspection
	w.Header().Set("Content-Type", "text/html")
	if _, err := w.Write(body); err != nil {
		log.Printf("Warning: failed to write response: %v", err)
	}
	log.Printf("Reservation report saved to %s and returned", filename)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
