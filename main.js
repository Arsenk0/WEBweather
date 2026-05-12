/**
 * WeatherUA - Main Logic
 * Using Open-Meteo API (Free, No Key)
 */

// --- Configuration & Constants ---
const GEO_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

const WMO_MAP = {
    0: { label: 'Ясно', icon: 'sun', class: 'weather-clear' },
    1: { label: 'Переважно ясно', icon: 'cloud-sun', class: 'weather-clear' },
    2: { label: 'Мінлива хмарність', icon: 'cloud-sun', class: 'weather-cloudy' },
    3: { label: 'Хмарно', icon: 'cloud', class: 'weather-cloudy' },
    45: { label: 'Туман', icon: 'cloud-fog', class: 'weather-cloudy' },
    48: { label: 'Паморозь', icon: 'cloud-fog', class: 'weather-cloudy' },
    51: { label: 'Мряка', icon: 'cloud-drizzle', class: 'weather-rain' },
    53: { label: 'Мряка', icon: 'cloud-drizzle', class: 'weather-rain' },
    55: { label: 'Сильна мряка', icon: 'cloud-drizzle', class: 'weather-rain' },
    61: { label: 'Невеликий дощ', icon: 'cloud-rain', class: 'weather-rain' },
    63: { label: 'Дощ', icon: 'cloud-rain', class: 'weather-rain' },
    65: { label: 'Сильний дощ', icon: 'cloud-rain', class: 'weather-rain' },
    71: { label: 'Невеликий сніг', icon: 'cloud-snow', class: 'weather-snow' },
    73: { label: 'Сніг', icon: 'cloud-snow', class: 'weather-snow' },
    75: { label: 'Сильний сніг', icon: 'cloud-snow', class: 'weather-snow' },
    77: { label: 'Сніжні зерна', icon: 'cloud-snow', class: 'weather-snow' },
    80: { label: 'Злива', icon: 'cloud-rain', class: 'weather-rain' },
    81: { label: 'Сильна злива', icon: 'cloud-rain', class: 'weather-rain' },
    82: { label: 'Дуже сильна злива', icon: 'cloud-rain', class: 'weather-rain' },
    85: { label: 'Снігопад', icon: 'cloud-snow', class: 'weather-snow' },
    86: { label: 'Сильний снігопад', icon: 'cloud-snow', class: 'weather-snow' },
    95: { label: 'Гроза', icon: 'cloud-lightning', class: 'weather-rain' },
};

// --- DOM Elements ---
const elements = {
    cityInput: document.getElementById('city-input'),
    searchResults: document.getElementById('search-results'),
    geoBtn: document.getElementById('geo-btn'),
    cityName: document.getElementById('city-name'),
    weatherDesc: document.getElementById('weather-description'),
    currentTemp: document.getElementById('current-temp'),
    weatherIcon: document.getElementById('weather-icon-container'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    visibility: document.getElementById('visibility'),
    feelsLike: document.getElementById('feels-like'),
    dailyForecast: document.getElementById('daily-forecast'),
    uvIndex: document.getElementById('uv-index'),
    uvText: document.getElementById('uv-text'),
    sunrise: document.getElementById('sunrise-time'),
    sunset: document.getElementById('sunset-time'),
    pressure: document.getElementById('pressure'),
    currentDate: document.getElementById('current-date'),
    loader: document.getElementById('loader'),
};

// --- State ---
let searchTimeout = null;

// --- Initialization ---
function init() {
    // Set date
    const now = new Date();
    elements.currentDate.textContent = now.toLocaleDateString('uk-UA', { 
        day: 'numeric', month: 'long', year: 'numeric' 
    });

    // Event Listeners
    elements.cityInput.addEventListener('input', handleSearchInput);
    elements.geoBtn.addEventListener('click', handleGeolocation);
    
    // Close search results on click outside
    document.addEventListener('click', (e) => {
        if (!document.querySelector('.search-container')?.contains(e.target)) {
            elements.searchResults.classList.add('hidden');
        }
    });

    // Load initial city (Kyiv or last saved)
    const savedCity = JSON.parse(localStorage.getItem('last_city'));
    if (savedCity) {
        fetchWeather(savedCity.lat, savedCity.lon, savedCity.name);
    } else {
        fetchWeather(50.4501, 30.5234, 'Київ'); // Default: Kyiv
    }
    
    // Initialize icons
    lucide.createIcons();
}

// --- API Calls ---
async function fetchWeather(lat, lon, name) {
    showLoader();
    try {
        const url = `${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=7`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        updateUI(data, name);
        localStorage.setItem('last_city', JSON.stringify({ lat, lon, name }));
    } catch (error) {
        console.error('Error fetching weather:', error);
        alert('Помилка завантаження даних. Спробуйте пізніше.');
    } finally {
        hideLoader();
    }
}

async function searchCities(query) {
    if (query.length < 2) {
        elements.searchResults.classList.add('hidden');
        return;
    }

    try {
        const response = await fetch(`${GEO_API_URL}?name=${encodeURIComponent(query)}&count=5&language=uk&format=json`);
        const data = await response.json();
        
        if (data.results) {
            renderSearchResults(data.results);
        } else {
            elements.searchResults.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error searching cities:', error);
    }
}

// --- UI Updates ---
function updateUI(data, cityName) {
    const current = data.current;
    const daily = data.daily;
    const weather = WMO_MAP[current.weather_code] || { label: 'Невідомо', icon: 'help-circle', class: 'weather-cloudy' };

    // Update Body Class
    document.body.className = weather.class;

    // Main Info
    elements.cityName.textContent = cityName;
    elements.weatherDesc.textContent = weather.label.charAt(0).toUpperCase() + weather.label.slice(1);
    elements.currentTemp.textContent = Math.round(current.temperature_2m);
    
    // Icon
    elements.weatherIcon.innerHTML = `<i data-lucide="${weather.icon}" class="large-icon"></i>`;
    
    // Stats
    elements.humidity.textContent = `${current.relative_humidity_2m}%`;
    elements.windSpeed.textContent = `${current.wind_speed_10m} км/год`;
    elements.visibility.textContent = `${(current.visibility / 1000).toFixed(1)} км`;
    elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}°`;
    
    // UV Index
    const uvValue = daily.uv_index_max[0];
    elements.uvIndex.textContent = uvValue;
    elements.uvText.textContent = getUVText(uvValue);
    
    // Sun
    elements.sunrise.textContent = formatTime(daily.sunrise[0]);
    elements.sunset.textContent = formatTime(daily.sunset[0]);
    
    // Pressure
    elements.pressure.textContent = `${Math.round(current.pressure_msl)} гПа`;

    // Forecast
    renderForecast(daily);
    
    // Re-initialize icons
    if (window.lucide) lucide.createIcons();
}

function renderForecast(daily) {
    elements.dailyForecast.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const dayName = i === 0 ? 'Сьогодні' : date.toLocaleDateString('uk-UA', { weekday: 'short' });
        const weather = WMO_MAP[daily.weather_code[i]] || { icon: 'cloud' };
        
        const item = document.createElement('div');
        item.className = 'forecast-item';
        item.innerHTML = `
            <span class="day">${dayName}</span>
            <i data-lucide="${weather.icon}"></i>
            <div class="temp-range">
                <span class="temp-max">${Math.round(daily.temperature_2m_max[i])}°</span>
                <span class="temp-min">${Math.round(daily.temperature_2m_min[i])}°</span>
            </div>
        `;
        elements.dailyForecast.appendChild(item);
    }
}

function renderSearchResults(results) {
    elements.searchResults.innerHTML = '';
    elements.searchResults.classList.remove('hidden');
    
    results.forEach(res => {
        const div = document.createElement('div');
        const country = res.country ? `, ${res.country}` : '';
        const admin = res.admin1 ? ` (${res.admin1})` : '';
        div.textContent = `${res.name}${admin}${country}`;
        div.addEventListener('click', () => {
            fetchWeather(res.latitude, res.longitude, res.name);
            elements.cityInput.value = res.name;
            elements.searchResults.classList.add('hidden');
        });
        elements.searchResults.appendChild(div);
    });
}

// --- Handlers ---
function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        searchCities(e.target.value);
    }, 500);
}

function handleGeolocation() {
    if (navigator.geolocation) {
        showLoader();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Reverse geocode to get city name (optional, but nice)
                fetchWeather(latitude, longitude, 'Ваше місцезнаходження');
            },
            (error) => {
                hideLoader();
                alert('Не вдалося отримати доступ до геолокації.');
            }
        );
    } else {
        alert('Ваш браузер не підтримує геолокацію.');
    }
}

// --- Helpers ---
function formatTime(isoStr) {
    const date = new Date(isoStr);
    return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function getUVText(uv) {
    if (uv <= 2) return 'Низький';
    if (uv <= 5) return 'Помірний';
    if (uv <= 7) return 'Високий';
    if (uv <= 10) return 'Дуже високий';
    return 'Екстремальний';
}

function showLoader() { elements.loader.classList.remove('hidden'); }
function hideLoader() { elements.loader.classList.add('hidden'); }

// Run init
init();
