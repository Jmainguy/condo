// Calendar state
let currentDate = new Date();
let bookingsData = [];
let availableYears = [];
let selectedYear = new Date().getFullYear();

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
        
        // Check if date is within the booking range (inclusive of both start and end)
        return check >= start && check <= end;
    });
}

// Check if date is a checkout day (last day of booking - when guest leaves)
function isCheckoutDay(dateStr) {
    return bookingsData.find(booking => {
        const end = new Date(booking.endDate + 'T00:00:00');
        const check = new Date(dateStr + 'T00:00:00');
        // endDate is now the actual checkout date
        return check.getTime() === end.getTime();
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

// Check if a date is in busy season (Memorial Day through Labor Day)
function isInBusySeason(dateStr, year) {
    const yearHolidays = getHolidays(year);
    const memorialDay = yearHolidays.find(h => h.name === 'Memorial Day');
    const labourDay = yearHolidays.find(h => h.name === 'Labour Day');
    
    if (!memorialDay || !labourDay) {
        return false;
    }
    
    const date = new Date(dateStr + 'T00:00:00');
    const startDate = new Date(memorialDay.date + 'T00:00:00');
    const endDate = new Date(labourDay.date + 'T00:00:00');
    
    return date >= startDate && date <= endDate;
}

// Generate calendar for current month
function generateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
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
        
        // Determine CSS class based on booking category
        let dayClass = 'available';
        let checkoutColor = '#e5e7eb'; // default gray
        let checkinColor = '#e5e7eb';
        let availableColorStart = '#84fab0';
        let availableColorEnd = '#8fd3f4';
        
        // Check if this is busy season for available dates
        const inBusySeason = isInBusySeason(dateStr, year);
        
        // Set premium colors for available portion if in busy season
        if (inBusySeason) {
            availableColorStart = '#ffd700';
            availableColorEnd = '#ffed4e';
        }
        
        if (booking && booking.category) {
            const category = booking.category.toLowerCase().replace(/ /g, '-');
            dayClass = category;
        } else if (booking && !booking.category) {
            // Booking exists but no category - treat as owner reservation
            dayClass = 'owner-reservation';
            console.warn(`Booking without category on ${dateStr}`, booking);
        } else if (!booking && !hasCheckoutOrCheckin && inBusySeason) {
            // Available during busy season - premium
            dayClass = 'premium-available';
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
        dayElement.style.setProperty('--available-color-start', availableColorStart);
        dayElement.style.setProperty('--available-color-end', availableColorEnd);
        
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
        
        // Make clickable if there's a booking or checkout/checkin
        if (booking || checkoutBooking || checkinBooking) {
            dayElement.classList.add('clickable');
            
            // For split days (both checkout and checkin), handle clicks differently
            if (checkoutBooking && checkinBooking) {
                dayElement.onclick = (event) => {
                    // Get click position relative to the element
                    const rect = dayElement.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;
                    
                    // Check if click is in top-left half (checkout) or bottom-right half (checkin)
                    // Using diagonal: if x + y < width (roughly half the diagonal)
                    const isTopLeft = (x + y) < rect.width;
                    
                    if (isTopLeft) {
                        showBookingModal(checkoutBooking, dateStr);
                    } else {
                        showBookingModal(checkinBooking, dateStr);
                    }
                };
            } else {
                dayElement.onclick = () => {
                    // Show the primary booking for this day
                    const displayBooking = booking || checkinBooking || checkoutBooking;
                    showBookingModal(displayBooking, dateStr);
                };
            }
        }
        
        calendarDays.appendChild(dayElement);
    }
}

// Navigation handlers
document.getElementById('prevMonth').addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    const newYear = currentDate.getFullYear();
    
    // Fetch data for new year if needed
    if (newYear !== selectedYear) {
        if (availableYears.includes(String(newYear))) {
            selectedYear = newYear;
            document.getElementById('yearSelect').value = String(newYear);
            await fetchBookings(newYear);
            generateCalendar();
        } else {
            // Year not available, revert
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    } else {
        generateCalendar();
    }
});

document.getElementById('nextMonth').addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    const newYear = currentDate.getFullYear();
    
    // Fetch data for new year if needed
    if (newYear !== selectedYear) {
        if (availableYears.includes(String(newYear))) {
            selectedYear = newYear;
            document.getElementById('yearSelect').value = String(newYear);
            await fetchBookings(newYear);
            generateCalendar();
        } else {
            // Year not available, revert
            currentDate.setMonth(currentDate.getMonth() - 1);
        }
    } else {
        generateCalendar();
    }
});

// Year selection handler
document.getElementById('yearSelect').addEventListener('change', async (e) => {
    selectedYear = parseInt(e.target.value);
    currentDate = new Date(selectedYear, currentDate.getMonth(), 1);
    await fetchBookings(selectedYear);
    generateCalendar();
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

// Show booking details modal
function showBookingModal(booking, dateStr) {
    const modal = document.getElementById('bookingModal');
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    
    // Calculate number of days
    const start = new Date(booking.startDate + 'T00:00:00');
    const end = new Date(booking.endDate + 'T00:00:00');
    
    // endDate is now the actual checkout date
    const checkoutDateStr = booking.endDate;
    
    // Calculate nights: from check-in to checkout date
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    
    // Format dates
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };
    
    modalTitle.textContent = `${booking.category || 'Reservation'}`;
    
    modalBody.innerHTML = `
        <div class="bg-gray-50 p-4 rounded-lg">
            <div class="flex items-center gap-2 mb-3">
                <div class="w-4 h-4 rounded" style="background: ${getCategoryColor(booking.category)}"></div>
                <span class="font-semibold text-gray-700">${booking.category || 'Booking'}</span>
            </div>
            <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-600">Check-in:</span>
                    <span class="font-medium text-gray-800">${formatDate(booking.startDate)} <span class="text-blue-600">(3:00 PM)</span></span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Check-out:</span>
                    <span class="font-medium text-gray-800">${formatDate(checkoutDateStr)} <span class="text-blue-600">(10:00 AM)</span></span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Duration:</span>
                    <span class="font-medium text-gray-800">${days} night${days !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    `;
    
    modal.classList.add('show');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('bookingModal');
    modal.classList.remove('show');
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('bookingModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});
