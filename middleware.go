package main

import (
	"log"
	"net/http"
)

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only log requests to the root path
		if r.URL.Path == "/" {
			// Get client IP, checking X-Forwarded-For header first (for proxies)
			clientIP := r.Header.Get("X-Forwarded-For")
			if clientIP == "" {
				clientIP = r.Header.Get("X-Real-IP")
			}
			if clientIP == "" {
				clientIP = r.RemoteAddr
			}

			log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, clientIP)
		}
		next.ServeHTTP(w, r)
	})
}
