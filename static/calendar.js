// Calendar state
let currentDate = new Date();
let bookingsData = [];
let availableYears = [];
let selectedYear = new Date().getFullYear();

// US Federal Holidays
function getHolidays(year) {
    const holidays = [];
    
    // Fixed date holidays
    holidays.push({ date: `${year}-01-01`, name: "New Year's Day", emoji: "🎊" });
    holidays.push({ date: `${year}-06-19`, name: "Juneteenth", emoji: "✊🏿" });
    holidays.push({ date: `${year}-07-04`, name: "Independence Day", emoji: "🎆" });
    holidays.push({ date: `${year}-11-11`, name: "Veterans Day", emoji: "🇺🇸" });
    holidays.push({ date: `${year}-12-25`, name: "Christmas", emoji: "🎄" });
    
    // MLK Day - 3rd Monday in January
    holidays.push({ date: getNthWeekdayOfMonth(year, 0, 1, 3), name: "MLK Day", emoji: "✊" });
    
    // Presidents Day - 3rd Monday in February
    holidays.push({ date: getNthWeekdayOfMonth(year, 1, 1, 3), name: "Presidents Day", emoji: "🎩" });
    
    // Memorial Day - Last Monday in May
    holidays.push({ date: getLastWeekdayOfMonth(year, 4, 1), name: "Memorial Day", emoji: "🎖️" });
    
    // Labor Day - 1st Monday in September
    holidays.push({ date: getNthWeekdayOfMonth(year, 8, 1, 1), name: "Labor Day", emoji: "⚒️" });
    
    // Thanksgiving - 4th Thursday in November
    holidays.push({ date: getNthWeekdayOfMonth(year, 10, 4, 4), name: "Thanksgiving", emoji: "🦃" });
    
    // Easter (approximate using formula)
    const easter = getEasterDate(year);
    holidays.push({ date: easter, name: "Easter", emoji: "🐰" });
    
    return holidays;
}

// Get Nth weekday of a month (e.g., 3rd Monday)
function getNthWeekdayOfMonth(year, month, weekday, n) {
    const firstDay = new Date(year, month, 1);
    let firstWeekday = firstDay.getDay();
    let diff = (weekday - firstWeekday + 7) % 7;
    let date = 1 + diff + (n - 1) * 7;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

// Get last weekday of a month
function getLastWeekdayOfMonth(year, month, weekday) {
    const lastDay = new Date(year, month + 1, 0);
    let lastDate = lastDay.getDate();
    let lastWeekday = lastDay.getDay();
    let diff = (lastWeekday - weekday + 7) % 7;
    let date = lastDate - diff;
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

// Calculate Easter using Computus algorithm
function getEasterDate(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Check if a date is a holiday
function getHolidayForDate(dateStr, year) {
    const holidays = getHolidays(year);
    return holidays.find(h => h.date === dateStr);
}

// Fetch available years
async function fetchYears() {
    try {
        const response = await fetch('/api/years');
        if (!response.ok) {
            throw new Error('Failed to fetch years');
        }
        const data = await response.json();
        availableYears = data.years || [];
        selectedYear = data.currentYear;
        
        // Populate year dropdown
        const yearSelect = document.getElementById('yearSelect');
        yearSelect.innerHTML = '';
        availableYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (parseInt(year) === selectedYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        });
        
        return availableYears;
    } catch (error) {
        console.error('Error fetching years:', error);
        throw error;
    }
}

// Fetch bookings from API
async function fetchBookings(year) {
    try {
        const yearParam = year || selectedYear;
        const response = await fetch(`/api/bookings?year=${yearParam}`);
        if (!response.ok) {
            throw new Error('Failed to fetch bookings');
        }
        const data = await response.json();
        bookingsData = data.bookings || [];
        
        // Update last fetch time
        const lastFetch = new Date(data.lastFetch);
        document.getElementById('lastUpdate').textContent = 
            `Last updated: ${lastFetch.toLocaleString()} | Year: ${data.year}`;
        
        return bookingsData;
    } catch (error) {
        console.error('Error fetching bookings:', error);
        throw error;
    }
}

// Check if a date is booked
function getBookingForDate(dateStr) {
    return bookingsData.find(booking => {
        const start = new Date(booking.startDate + 'T00:00:00');
        const end = new Date(booking.endDate + 'T00:00:00');
        const check = new Date(dateStr + 'T00:00:00');
        
        // Check if date is within the booking range (inclusive of start, exclusive of end)
        return check >= start && check < end;
    });
}

// Check if date is a checkout day (last day of booking - when guest leaves)
function isCheckoutDay(dateStr) {
    return bookingsData.find(booking => {
        const end = new Date(booking.endDate + 'T00:00:00');
        const check = new Date(dateStr + 'T00:00:00');
        // endDate is exclusive (first available day), so checkout is the day before
        const checkoutDate = new Date(end);
        checkoutDate.setDate(checkoutDate.getDate() - 1);
        return check.getTime() === checkoutDate.getTime();
    });
}

// Check if date is a checkin day (first day of booking)
function isCheckinDay(dateStr) {
    return bookingsData.find(booking => {
        const start = new Date(booking.startDate + 'T00:00:00');
        const check = new Date(dateStr + 'T00:00:00');
        return check.getTime() === start.getTime();
    });
}

// Get color for category
function getCategoryColor(category) {
    if (!category) return '#9C27B0'; // owner-reservation purple
    
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('guest')) return '#1976d2'; // blue
    if (categoryLower.includes('golf')) return '#8BC34A'; // green
    if (categoryLower.includes('ota')) return '#FF9800'; // orange
    if (categoryLower.includes('owner') && categoryLower.includes('referral')) return '#E91E63'; // pink
    if (categoryLower.includes('owner')) return '#9C27B0'; // purple
    if (categoryLower.includes('complimentary')) return '#FFC107'; // amber
    return '#84fab0'; // available/default
}

// Generate calendar for current month
function generateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Debug: Log current state
    console.log(`Generating calendar for ${year}-${month + 1}, bookings:`, bookingsData.length);
    
    // Update month header
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    document.getElementById('currentMonth').textContent = 
        `${monthNames[month]} ${year}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Clear calendar
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day bg-gray-50 rounded-lg';
        calendarDays.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= numDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const checkoutBooking = isCheckoutDay(dateStr);
        const checkinBooking = isCheckinDay(dateStr);
        const holiday = getHolidayForDate(dateStr, year);
        
        // Always show checkout/checkin markers when they exist
        const hasCheckoutOrCheckin = checkoutBooking || checkinBooking;
        
        // Get booking for styling purposes
        const booking = getBookingForDate(dateStr);
        
        // Debug logging for July 2025
        if (year === 2025 && month === 6 && day >= 6 && day <= 8) {
            console.log(`July ${day}: booking=${!!booking}, checkout=${!!checkoutBooking}, checkin=${!!checkinBooking}`);
            if (booking) console.log(`  booking:`, booking);
            if (checkoutBooking) console.log(`  checkout:`, checkoutBooking);
            if (checkinBooking) console.log(`  checkin:`, checkinBooking);
        }
        
        // Determine CSS class based on booking category
        let dayClass = 'available';
        let checkoutColor = '#e5e7eb'; // default gray
        let checkinColor = '#e5e7eb';
        
        if (booking && booking.category) {
            const category = booking.category.toLowerCase().replace(/ /g, '-');
            dayClass = category;
        } else if (booking && !booking.category) {
            // Booking exists but no category - treat as owner reservation
            dayClass = 'owner-reservation';
            console.warn(`Booking without category on ${dateStr}`, booking);
        }
        
        // Get colors for checkout/checkin visualization
        if (checkoutBooking) {
            checkoutColor = getCategoryColor(checkoutBooking.category);
        }
        if (checkinBooking) {
            checkinColor = getCategoryColor(checkinBooking.category);
        }
        
        const dayElement = document.createElement('div');
        let splitClass = '';
        if (checkoutBooking && checkinBooking) {
            splitClass = 'split-day-both';
            dayClass = ''; // Clear default class
        } else if (checkoutBooking) {
            splitClass = 'split-day-checkout';
            dayClass = ''; // Clear default class
        } else if (checkinBooking) {
            splitClass = 'split-day-checkin';
            dayClass = ''; // Clear default class
        }
        
        dayElement.className = `calendar-day rounded-lg shadow p-3 ${dayClass} ${splitClass}`;
        dayElement.style.setProperty('--checkout-color', checkoutColor);
        dayElement.style.setProperty('--checkin-color', checkinColor);
        
        // Add holiday marker if it's a holiday
        if (holiday) {
            const holidayMarker = document.createElement('div');
            holidayMarker.className = 'holiday-marker';
            holidayMarker.textContent = holiday.emoji;
            holidayMarker.title = holiday.name;
            dayElement.appendChild(holidayMarker);
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'text-lg font-bold mb-1';
        dayNumber.textContent = day;
        dayElement.appendChild(dayNumber);
        
        // Status and category
        if (hasCheckoutOrCheckin) {
            // Show category badges for checkout and/or checkin
            if (checkoutBooking && checkinBooking) {
                // Both checkout and checkin - show both categories
                const categoryContainer = document.createElement('div');
                categoryContainer.className = 'text-xs mt-1';
                
                const checkoutBadge = document.createElement('div');
                checkoutBadge.className = 'category-badge mb-1';
                checkoutBadge.textContent = checkoutBooking.category || 'Owner';
                checkoutBadge.title = `${checkoutBooking.category || 'Owner'} checkout (10 AM)`;
                categoryContainer.appendChild(checkoutBadge);
                
                const checkinBadge = document.createElement('div');
                checkinBadge.className = 'category-badge';
                checkinBadge.textContent = checkinBooking.category || 'Owner';
                checkinBadge.title = `${checkinBooking.category || 'Owner'} checkin (3 PM)`;
                categoryContainer.appendChild(checkinBadge);
                
                dayElement.appendChild(categoryContainer);
            } else if (checkoutBooking) {
                const categoryBadge = document.createElement('div');
                categoryBadge.className = 'category-badge';
                categoryBadge.textContent = checkoutBooking.category || 'Owner';
                categoryBadge.title = `${checkoutBooking.category || 'Owner'} checkout (10 AM)`;
                dayElement.appendChild(categoryBadge);
            } else if (checkinBooking) {
                const categoryBadge = document.createElement('div');
                categoryBadge.className = 'category-badge';
                categoryBadge.textContent = checkinBooking.category || 'Owner';
                categoryBadge.title = `${checkinBooking.category || 'Owner'} checkin (3 PM)`;
                dayElement.appendChild(categoryBadge);
            }
        } else if (booking) {
            const categoryBadge = document.createElement('div');
            categoryBadge.className = 'category-badge';
            categoryBadge.textContent = booking.category || 'Owner Reservation';
            dayElement.appendChild(categoryBadge);
        } else {
            const availableText = document.createElement('div');
            availableText.className = 'text-sm opacity-75 mt-2';
            availableText.textContent = 'Available';
            dayElement.appendChild(availableText);
        }
        
        calendarDays.appendChild(dayElement);
    }
}

// Navigation handlers
document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    const newYear = currentDate.getFullYear();
    
    // Fetch data for new year if needed
    if (newYear !== selectedYear) {
        if (availableYears.includes(String(newYear))) {
            selectedYear = newYear;
            document.getElementById('yearSelect').value = String(newYear);
            fetchBookings(newYear).then(() => generateCalendar());
        } else {
            // Year not available, revert
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    } else {
        generateCalendar();
    }
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    const newYear = currentDate.getFullYear();
    
    // Fetch data for new year if needed
    if (newYear !== selectedYear) {
        if (availableYears.includes(String(newYear))) {
            selectedYear = newYear;
            document.getElementById('yearSelect').value = String(newYear);
            fetchBookings(newYear).then(() => generateCalendar());
        } else {
            // Year not available, revert
            currentDate.setMonth(currentDate.getMonth() - 1);
        }
    } else {
        generateCalendar();
    }
});

// Year selection handler
document.getElementById('yearSelect').addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value);
    currentDate = new Date(selectedYear, currentDate.getMonth(), 1);
    fetchBookings(selectedYear).then(() => generateCalendar());
});

// Initialize calendar
async function init() {
    try {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('calendar').classList.add('hidden');
        document.getElementById('error').classList.add('hidden');
        
        await fetchYears();
        await fetchBookings(selectedYear);
        generateCalendar();
        
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('calendar').classList.remove('hidden');
        
        // Refresh data every 5 minutes
        setInterval(async () => {
            try {
                await fetchBookings(selectedYear);
                generateCalendar();
            } catch (error) {
                console.error('Failed to refresh bookings:', error);
            }
        }, 5 * 60 * 1000);
    } catch (error) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.remove('hidden');
    }
}

// Start the app
init();
