package main

import (
	"net/http"
	"sync"
	"time"
)

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

// ServerConfig holds the configuration for the Elliott portal server
type ServerConfig struct {
	Port     string
	Username string
	Password string
	Property string
	Years    []string // Years to fetch data for
}
