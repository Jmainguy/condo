// Hard-coded US Federal Holidays (2023-2030)
// Source: date.nager.at API (fetched 2026-02-05)
// Covers all nationwide federal holidays
const holidays = {
    2023: [
        { date: "2023-01-02", name: "New Year's Day", emoji: "🎊" },
        { date: "2023-01-16", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2023-02-20", name: "Presidents Day", emoji: "🎩" },
        { date: "2023-05-29", name: "Memorial Day", emoji: "🎖️" },
        { date: "2023-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2023-07-04", name: "Independence Day", emoji: "🎆" },
        { date: "2023-09-04", name: "Labour Day", emoji: "⚒️" },
        { date: "2023-11-10", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2023-11-23", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2023-12-25", name: "Christmas Day", emoji: "🎄" }
    ],
    2024: [
        { date: "2024-01-01", name: "New Year's Day", emoji: "🎊" },
        { date: "2024-01-15", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2024-02-19", name: "Presidents Day", emoji: "🎩" },
        { date: "2024-05-27", name: "Memorial Day", emoji: "🎖️" },
        { date: "2024-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2024-07-04", name: "Independence Day", emoji: "🎆" },
        { date: "2024-09-02", name: "Labour Day", emoji: "⚒️" },
        { date: "2024-11-11", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2024-11-28", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2024-12-25", name: "Christmas Day", emoji: "🎄" }
    ],
    2025: [
        { date: "2025-01-01", name: "New Year's Day", emoji: "🎊" },
        { date: "2025-01-20", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2025-02-17", name: "Presidents Day", emoji: "🎩" },
        { date: "2025-05-26", name: "Memorial Day", emoji: "🎖️" },
        { date: "2025-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2025-07-04", name: "Independence Day", emoji: "🎆" },
        { date: "2025-09-01", name: "Labour Day", emoji: "⚒️" },
        { date: "2025-11-11", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2025-11-27", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2025-12-25", name: "Christmas Day", emoji: "🎄" }
    ],
    2026: [
        { date: "2026-01-01", name: "New Year's Day", emoji: "🎊" },
        { date: "2026-01-19", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2026-02-16", name: "Presidents Day", emoji: "🎩" },
        { date: "2026-05-25", name: "Memorial Day", emoji: "🎖️" },
        { date: "2026-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2026-07-03", name: "Independence Day", emoji: "🎆" },
        { date: "2026-09-07", name: "Labour Day", emoji: "⚒️" },
        { date: "2026-11-11", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2026-11-26", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2026-12-25", name: "Christmas Day", emoji: "🎄" }
    ],
    2027: [
        { date: "2027-01-01", name: "New Year's Day", emoji: "🎊" },
        { date: "2027-01-18", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2027-02-15", name: "Presidents Day", emoji: "🎩" },
        { date: "2027-05-31", name: "Memorial Day", emoji: "🎖️" },
        { date: "2027-06-18", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2027-07-05", name: "Independence Day", emoji: "🎆" },
        { date: "2027-09-06", name: "Labour Day", emoji: "⚒️" },
        { date: "2027-11-11", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2027-11-25", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2027-12-24", name: "Christmas Day", emoji: "🎄" }
    ],
    2028: [
        { date: "2027-12-31", name: "New Year's Day", emoji: "🎊" },
        { date: "2028-01-17", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2028-02-21", name: "Presidents Day", emoji: "🎩" },
        { date: "2028-05-29", name: "Memorial Day", emoji: "🎖️" },
        { date: "2028-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2028-07-04", name: "Independence Day", emoji: "🎆" },
        { date: "2028-09-04", name: "Labour Day", emoji: "⚒️" },
        { date: "2028-11-10", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2028-11-23", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2028-12-25", name: "Christmas Day", emoji: "🎄" }
    ],
    2029: [
        { date: "2029-01-01", name: "New Year's Day", emoji: "🎊" },
        { date: "2029-01-15", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2029-02-19", name: "Presidents Day", emoji: "🎩" },
        { date: "2029-05-28", name: "Memorial Day", emoji: "🎖️" },
        { date: "2029-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2029-07-04", name: "Independence Day", emoji: "🎆" },
        { date: "2029-09-03", name: "Labour Day", emoji: "⚒️" },
        { date: "2029-11-12", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2029-11-22", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2029-12-25", name: "Christmas Day", emoji: "🎄" }
    ],
    2030: [
        { date: "2030-01-01", name: "New Year's Day", emoji: "🎊" },
        { date: "2030-01-21", name: "Martin Luther King, Jr. Day", emoji: "✊" },
        { date: "2030-02-18", name: "Presidents Day", emoji: "🎩" },
        { date: "2030-05-27", name: "Memorial Day", emoji: "🎖️" },
        { date: "2030-06-19", name: "Juneteenth National Independence Day", emoji: "✊🏿" },
        { date: "2030-07-04", name: "Independence Day", emoji: "🎆" },
        { date: "2030-09-02", name: "Labour Day", emoji: "⚒️" },
        { date: "2030-11-11", name: "Veterans Day", emoji: "🇺🇸" },
        { date: "2030-11-28", name: "Thanksgiving Day", emoji: "🦃" },
        { date: "2030-12-25", name: "Christmas Day", emoji: "🎄" }
    ]
};

// Get holidays for a year
function getHolidays(year) {
    return holidays[year] || [];
}

// Check if a date is a holiday
function getHolidayForDate(dateStr, year) {
    const yearHolidays = getHolidays(year);
    return yearHolidays.find(h => h.date === dateStr);
}
