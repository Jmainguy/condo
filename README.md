# condo
A calendar for the condo

## Environment Variables

### Required
- `ELLIOTT_USERNAME` - Username for Elliott portal authentication
- `ELLIOTT_PASSWORD` - Password for Elliott portal authentication

### Optional
- `PORT` - Server port (default: `8080`)
- `ELLIOTT_PROPERTY` - Property identifier (default: `GRA1901`)
- `ELLIOTT_YEARS` - Comma-separated list of years to fetch data for (default: 2023 through next year)

## Running

```bash
export ELLIOTT_USERNAME=your_username
export ELLIOTT_PASSWORD=your_password
go run main.go
```

Server will be available at `http://0.0.0.0:8080`
