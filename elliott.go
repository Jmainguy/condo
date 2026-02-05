package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
)

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
		// Elliott portal returns End as exclusive (first available day)
		// Convert to actual checkout date (last day of stay)
		endDate, err := time.Parse("2006-01-02", event.End)
		if err != nil {
			log.Printf("Warning: failed to parse end date %s: %v", event.End, err)
			endDate = time.Time{}
		} else {
			endDate = endDate.AddDate(0, 0, -1)
		}

		bookings[i] = BookingData{
			StartDate: event.Start,
			EndDate:   endDate.Format("2006-01-02"),
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
