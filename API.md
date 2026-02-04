# API Documentation

## Base URL
```
http://localhost:8080
```

## Endpoints

### GET /api/bookings

Returns all bookings for the configured property and year.

**Response:**
```json
{
  "bookings": [
    {
      "startDate": "2026-03-19",
      "endDate": "2026-03-23",
      "category": "Golf Reservation",
      "available": false
    },
    {
      "startDate": "2026-07-25",
      "endDate": "2026-08-02",
      "category": "Guest Reservation",
      "available": false
    }
  ],
  "lastFetch": "2026-02-04T15:23:56Z"
}
```

**Fields:**
- `startDate` (string): Check-in date in YYYY-MM-DD format
- `endDate` (string): Check-out date in YYYY-MM-DD format
- `category` (string): Type of booking (Golf Reservation, Guest Reservation, Owner Reservation, etc.)
- `available` (boolean): Always false for booked dates
- `lastFetch` (string): ISO 8601 timestamp of when data was last fetched

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "lastFetch": "2026-02-04T15:23:56Z"
}
```

### GET /

Serves the calendar web interface (HTML).

## Data Updates

- Calendar data is fetched from elliottowner.com every **15 minutes**
- Frontend refreshes data every **5 minutes** via API calls
- Initial data fetch happens when server starts

## Booking Categories

The API returns these booking categories:
- `Guest Reservation` - Regular guest booking
- `Golf Reservation` - Golf package reservation
- `OTA Booking` - Online Travel Agency booking
- `Owner Reservation` - Owner's personal use
- `Owner Referral` - Owner's referred guest
- `Complimentary` - Complimentary stay

## CORS

The API includes CORS headers to allow cross-origin requests from any domain.

## Error Handling

If the server cannot fetch data from elliottowner.com:
- It will log errors to the server console
- It will continue serving the last successfully fetched data
- The `/api/health` endpoint will show the timestamp of the last successful fetch
