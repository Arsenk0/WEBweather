/**
 * WeatherUA Pro v3 - Immersive Dashboard
 */

// --- Constants ---
const GEO_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AQI_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

const WMO_MAP = {
    0: { label: 'Ясно', icon: 'sun', class: 'weather-clear' },
    1: { label: 'Переважно ясно', icon: 'cloud-sun', class: 'weather-clear' },
    2: { label: 'Мінлива хмарність', icon: 'cloud-sun', class: 'weather-cloudy' },
    3: { label: 'Хмарно', icon: 'cloud', class: 'weather-cloudy' },
    45: { label: 'Туман', icon: 'cloud-fog', class: 'weather-cloudy' },
    51: { label: 'Мряка', icon: 'cloud-drizzle', class: 'weather-rain' },
    61: { label: 'Дощ', icon: 'cloud-rain', class: 'weather-rain' },
    63: { label: 'Дощ', icon: 'cloud-rain', class: 'weather-rain' },
    65: { label: 'Сильний дощ', icon: 'cloud-rain', class: 'weather-rain' },
    71: { label: 'Невеликий сніг', icon: 'cloud-snow', class: 'weather-snow' },
    73: { label: 'Сніг', icon: 'cloud-snow', class: 'weather-snow' },
    75: { label: 'Сильний сніг', icon: 'cloud-snow', class: 'weather-snow' },
    95: { label: 'Гроза', icon: 'cloud-lightning', class: 'weather-rain' },
};

// --- DOM Elements ---
const elements = {
    cityInput: document.getElementById('city-input'),
    searchResults: document.getElementById('search-results'),
    geoBtn: document.getElementById('geo-btn-top'),
    cityName: document.getElementById('city-name'),
    weatherDesc: document.getElementById('weather-description'),
    currentTemp: document.getElementById('current-temp'),
    weatherIcon: document.getElementById('weather-icon-container'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    visibility: document.getElementById('visibility'),
    feelsLike: document.getElementById('feels-like'),
    dailyForecast: document.getElementById('daily-forecast'),
    hourlyList: document.getElementById('hourly-list'),
    currentDate: document.getElementById('current-date'),
    loader: document.getElementById('loader'),
    aqiValue: document.getElementById('aqi-value'),
    aqiStatus: document.getElementById('aqi-status'),
    aqiProgress: document.getElementById('aqi-progress'),
    lifestyleTips: document.getElementById('lifestyle-tips'),
    clothingTip: document.getElementById('clothing-tip'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),
    particles: document.getElementById('particles-container'),
};

// --- State ---
let map = null;
let radarLayer = null;
let currentCoords = { lat: 50.4501, lon: 30.5234, name: 'Київ' };
let searchTimeout = null;
let recentSearches = JSON.parse(localStorage.getItem('recent_searches')) || [];

// --- Initialization ---
function init() {
    // Basic setup
    elements.currentDate.textContent = new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
    
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.dataset.view);
            if (item.dataset.view === 'maps') setTimeout(initMap, 100);
        });
    });

    // Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' || (e.metaKey && e.key === 'k')) {
            e.preventDefault();
            elements.cityInput.focus();
        }
    });

    // Event Listeners
    elements.cityInput.addEventListener('input', handleSearchInput);
    elements.cityInput.addEventListener('focus', () => {
        if (elements.cityInput.value.length === 0) renderResults([]);
    });
    elements.geoBtn.addEventListener('click', handleGeolocation);
    document.addEventListener('click', (e) => {
        if (!document.querySelector('.search-container')?.contains(e.target)) {
            elements.searchResults.classList.add('hidden');
        }
    });

    // Initial Load
    const saved = JSON.parse(localStorage.getItem('last_city_v3')) || currentCoords;
    fetchFullData(saved.lat, saved.lon, saved.name);
    
    if (window.lucide) lucide.createIcons();
}

function switchView(viewId) {
    elements.navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
    elements.views.forEach(view => view.classList.toggle('active', view.id === `view-${viewId}`));
}

// --- API Logic ---
async function fetchFullData(lat, lon, name) {
    showLoader();
    try {
        const query = `latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility,precipitation,surface_pressure,cloud_cover,dew_point_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=7`;
        
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(`${WEATHER_API_URL}?${query}`),
            fetch(`${AQI_API_URL}?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide,sulphur_dioxide&timezone=auto`)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();
        
        currentCoords = { lat, lon, name };
        updateUI(weatherData, aqiData, name);
        localStorage.setItem('last_city_v3', JSON.stringify(currentCoords));
        addToRecent(name, lat, lon);
        
        if (map) {
            map.setView([lat, lon], 10);
        }
    } catch (e) {
        console.error('Update failed:', e);
    } finally {
        setTimeout(hideLoader, 500);
    }
}

// --- UI Logic ---
function updateUI(weather, aqi, cityName) {
    const cur = weather.current;
    const daily = weather.daily;
    const hourly = weather.hourly;
    const config = WMO_MAP[cur.weather_code] || { label: 'Хмарно', icon: 'cloud', class: 'weather-cloudy' };

    // Core
    document.body.className = config.class;
    elements.cityName.textContent = cityName;
    elements.weatherDesc.textContent = config.label;
    elements.currentTemp.textContent = Math.round(cur.temperature_2m);
    elements.weatherIcon.innerHTML = `<i data-lucide="${config.icon}" class="large-icon"></i>`;
    
    // Metrics
    elements.humidity.textContent = `${cur.relative_humidity_2m}%`;
    elements.windSpeed.textContent = `${cur.wind_speed_10m} км/год`;
    elements.visibility.textContent = `${(cur.visibility / 1000).toFixed(1)} км`;
    elements.feelsLike.textContent = `${Math.round(cur.apparent_temperature)}°`;
    
    // New Metrics
    document.getElementById('pressure').textContent = `${Math.round(cur.surface_pressure)} hPa`;
    document.getElementById('clouds').textContent = `${cur.cloud_cover}%`;
    document.getElementById('uv-index').textContent = daily.uv_index_max[0].toFixed(1);
    document.getElementById('dew-point').textContent = `${Math.round(cur.dew_point_2m)}°`;

    // AQI
    const aVal = aqi.current.european_aqi;
    elements.aqiValue.textContent = aVal;
    elements.aqiStatus.textContent = getAQIStatus(aVal);
    elements.aqiProgress.style.width = `${Math.min(aVal, 100)}%`;
    elements.aqiProgress.style.background = getAQIColor(aVal);

    // AQI Detail View
    document.getElementById('aqi-detail-value').textContent = aVal;
    document.getElementById('aqi-detail-status').textContent = getAQIStatus(aVal);
    document.getElementById('pm2_5').textContent = `${aqi.current.pm2_5.toFixed(1)} мкг/м³`;
    document.getElementById('pm10').textContent = `${aqi.current.pm10.toFixed(1)} мкг/м³`;
    document.getElementById('no2').textContent = `${aqi.current.nitrogen_dioxide.toFixed(1)} мкг/м³`;
    document.getElementById('o3').textContent = `${aqi.current.ozone.toFixed(1)} мкг/м³`;
    document.getElementById('co').textContent = `${aqi.current.carbon_monoxide.toFixed(1)} мкг/м³`;
    document.getElementById('so2').textContent = `${aqi.current.sulphur_dioxide.toFixed(1)} мкг/м³`;

    // Astronomy View
    const sunrise = new Date(daily.sunrise[0]);
    const sunset = new Date(daily.sunset[0]);
    const dayLengthMs = sunset - sunrise;
    const hours = Math.floor(dayLengthMs / 3600000);
    const minutes = Math.floor((dayLengthMs % 3600000) / 60000);

    document.getElementById('astro-sunrise').textContent = sunrise.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('astro-sunset').textContent = sunset.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('astro-day-length').textContent = `${hours}г ${minutes}хв`;
    
    // Golden Hour (approx 1 hour after sunrise and 1 hour before sunset)
    const goldenRise = new Date(sunrise.getTime() + 3600000).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const goldenSet = new Date(sunset.getTime() - 3600000).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('astro-golden-hour').textContent = `${sunrise.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })} - ${goldenRise}`;
    
    updateSolarTimeline(sunrise, sunset);
    updateMoonPhase();

    // Render Components
    renderHourly(hourly);
    renderForecast(daily);
    updateLifestyle(cur, daily);
    updateParticles(cur.weather_code);
    
    if (window.lucide) lucide.createIcons();
}

function updateMoonPhase() {
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Simple moon phase calculation (approximation)
    const c = year * 365.25;
    const e = 30.6 * month;
    const jd = c + e + day - 694039.09; 
    const phase = jd / 29.5305882;
    const age = (phase - Math.floor(phase)) * 29.53;
    
    let phaseName = '';
    let icon = '';
    
    if (age < 1.84) { phaseName = 'Новий Місяць'; icon = 'moon'; }
    else if (age < 5.53) { phaseName = 'Молодий Місяць'; icon = 'moon'; }
    else if (age < 9.22) { phaseName = 'Перша чверть'; icon = 'moon'; }
    else if (age < 12.91) { phaseName = 'Зростаючий Місяць'; icon = 'moon'; }
    else if (age < 16.61) { phaseName = 'Повний Місяць'; icon = 'moon'; }
    else if (age < 20.3) { phaseName = 'Спадаючий Місяць'; icon = 'moon'; }
    else if (age < 23.99) { phaseName = 'Остання чверть'; icon = 'moon'; }
    else if (age < 27.68) { phaseName = 'Старий Місяць'; icon = 'moon'; }
    else { phaseName = 'Новий Місяць'; icon = 'moon'; }

    document.getElementById('moon-phase-name').textContent = phaseName;
    document.getElementById('moon-icon-container').innerHTML = `<i data-lucide="${icon}" class="moon-icon"></i>`;
}

function updateSolarTimeline(sunrise, sunset) {
    const now = new Date();
    const solarStart = document.getElementById('solar-start');
    const solarEnd = document.getElementById('solar-end');
    const sunPos = document.getElementById('sun-position');
    
    if (!solarStart || !solarEnd || !sunPos) return;
    
    solarStart.textContent = sunrise.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    solarEnd.textContent = sunset.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    
    const total = sunset - sunrise;
    const current = now - sunrise;
    let percent = (current / total) * 100;
    
    if (now < sunrise) percent = 0;
    if (now > sunset) percent = 100;
    
    sunPos.style.left = `${percent}%`;
    sunPos.style.opacity = (now < sunrise || now > sunset) ? '0.3' : '1';
}

function renderHourly(hourly) {
    elements.hourlyList.innerHTML = '';
    const nowIdx = new Date().getHours();
    for (let i = nowIdx; i < nowIdx + 24; i++) {
        const time = new Date(hourly.time[i]);
        const temp = Math.round(hourly.temperature_2m[i]);
        const code = hourly.weather_code[i];
        const icon = WMO_MAP[code]?.icon || 'cloud';
        
        const item = document.createElement('div');
        item.className = 'hourly-item';
        item.innerHTML = `
            <span class="time">${time.getHours()}:00</span>
            <i data-lucide="${icon}"></i>
            <span class="temp">${temp}°</span>
        `;
        elements.hourlyList.appendChild(item);
    }
}

function renderForecast(daily) {
    elements.dailyForecast.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const date = new Date(daily.time[i]);
        const day = i === 0 ? 'Сьогодні' : date.toLocaleDateString('uk-UA', { weekday: 'long' });
        const icon = WMO_MAP[daily.weather_code[i]]?.icon || 'cloud';
        
        const row = document.createElement('div');
        row.className = 'forecast-row glass-panel';
        row.style.setProperty('--delay', `${i * 0.1}s`);
        row.innerHTML = `
            <div class="forecast-day">${day}</div>
            <div class="forecast-info">
                <i data-lucide="${icon}"></i>
                <span>${WMO_MAP[daily.weather_code[i]]?.label || 'Хмарно'}</span>
                <span class="rain-prob"><i data-lucide="cloud-rain"></i> ${daily.precipitation_probability_max[i]}%</span>
            </div>
            <div class="forecast-wind">
                <i data-lucide="wind"></i> ${daily.wind_speed_10m_max[i]} км/г
            </div>
            <div class="forecast-temp">
                <span class="forecast-max">${Math.round(daily.temperature_2m_max[i])}°</span>
                <span class="forecast-min">${Math.round(daily.temperature_2m_min[i])}°</span>
            </div>
        `;
        elements.dailyForecast.appendChild(row);
    }
}

// --- Map Logic (v3) ---
async function initMap() {
    if (map) return;
    
    // Use CartoDB Dark Matter for a more premium look that fits the UI
    map = L.map('weather-map', {
        zoomControl: true,
        maxZoom: 12,
        minZoom: 4
    }).setView([48.3794, 31.1656], 6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CartoDB'
    }).addTo(map);

    try {
        const response = await fetch(RAINVIEWER_API);
        const data = await response.json();
        const latest = data.radar.past[data.radar.past.length - 1];
        
        radarLayer = L.tileLayer(`${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`, {
            opacity: 0.7,
            zIndex: 100,
            maxNativeZoom: 6 // Radar tiles often don't exist at high zoom
        }).addTo(map);
    } catch (e) {
        console.error('Radar failed:', e);
    }
}

// --- Particles Logic (v3) ---
function updateParticles(code) {
    elements.particles.innerHTML = '';
    let type = '';
    if (code >= 51 && code <= 67) type = 'rain';
    else if (code >= 71 && code <= 86) type = 'snow';
    
    if (!type) return;

    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.className = `particle ${type === 'rain' ? 'drop' : 'snowflake'}`;
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 1 + 0.5}s`;
        p.style.animationDelay = `${Math.random() * 2}s`;
        elements.particles.appendChild(p);
    }
}

// --- Lifestyle ---
function updateLifestyle(cur, daily) {
    const temp = cur.temperature_2m;
    const rain = cur.precipitation > 0;
    const uv = daily.uv_index_max[0];
    const wind = cur.wind_speed_10m;
    
    // Clothing advice
    elements.clothingTip.textContent = temp < 10 ? 'Тепла куртка та шарф.' : (temp < 20 ? 'Легкий джемпер.' : 'Легка футболка.');
    document.getElementById('car-tip').textContent = rain ? 'Не мийте авто, можливий дощ.' : 'Чудовий час для миття авто.';
    
    // Sun logic
    const sunrise = new Date(daily.sunrise[0]).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const sunset = new Date(daily.sunset[0]).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('uv-recommendation').innerHTML = `Схід: ${sunrise}<br>Захід: ${sunset}`;

    // Dynamic Tips Generator
    elements.lifestyleTips.innerHTML = '';
    const tips = [];
    
    if (rain) tips.push({ icon: 'umbrella', text: 'Візьміть парасольку' });
    else tips.push({ icon: 'sun', text: 'Парасолька не потрібна' });
    
    if (uv > 5) tips.push({ icon: 'shield-check', text: 'Використовуйте SPF' });
    if (wind > 20) tips.push({ icon: 'wind', text: 'Сьогодні вітряно' });
    
    if (temp > 25) tips.push({ icon: 'droplets', text: 'Пийте більше води' });
    else if (temp < 5) tips.push({ icon: 'thermometer-snowflake', text: 'Одягайтеся тепліше' });

    tips.forEach(tip => {
        const item = document.createElement('div');
        item.className = 'tip-item';
        item.innerHTML = `<i data-lucide="${tip.icon}"></i><span>${tip.text}</span>`;
        elements.lifestyleTips.appendChild(item);
    });
    
    if (window.lucide) lucide.createIcons();
}

// --- Helpers ---
function getAQIStatus(aqi) { return aqi <= 40 ? 'Добре' : (aqi <= 60 ? 'Помірно' : 'Погано'); }
function getAQIColor(aqi) { return aqi <= 40 ? '#22d3ee' : (aqi <= 60 ? '#facc15' : '#f87171'); }
function showLoader() { elements.loader.classList.remove('hidden'); }
function hideLoader() { elements.loader.classList.add('hidden'); }

async function handleSearchInput(e) {
    const q = e.target.value;
    if (q.length === 0) return renderResults([]); // Show recent searches
    if (q.length < 2) return elements.searchResults.classList.add('hidden');
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const r = await fetch(`${GEO_API_URL}?name=${encodeURIComponent(q)}&count=5&language=uk&format=json`);
        const d = await r.json();
        if (d.results) renderResults(d.results);
    }, 400);
}

function renderResults(results) {
    elements.searchResults.innerHTML = '';
    elements.searchResults.classList.remove('hidden');
    
    // Add Recent Searches if input is empty
    if (elements.cityInput.value.length === 0 && recentSearches.length > 0) {
        const h = document.createElement('div');
        h.style.fontSize = '0.75rem'; h.style.color = 'var(--accent)'; h.style.background = 'rgba(255,255,255,0.02)';
        h.textContent = 'ОСТАННІ ПОШУКИ';
        elements.searchResults.appendChild(h);
        
        recentSearches.forEach(s => {
            const div = document.createElement('div');
            div.textContent = s.name;
            div.onclick = () => {
                fetchFullData(s.lat, s.lon, s.name);
                elements.cityInput.value = s.name;
                elements.searchResults.classList.add('hidden');
            };
            elements.searchResults.appendChild(div);
        });
        elements.searchResults.classList.remove('hidden');
        return;
    }

    // Add "Trending" Header
    const header = document.createElement('div');
    header.style.fontSize = '0.75rem'; header.style.color = 'var(--text-muted)'; header.style.background = 'rgba(255,255,255,0.02)';
    header.textContent = 'РЕЗУЛЬТАТИ ПОШУКУ';
    elements.searchResults.appendChild(header);

    results.forEach(res => {
        const div = document.createElement('div');
        div.textContent = `${res.name}, ${res.admin1 || ''} (${res.country})`;
        div.onclick = () => {
            fetchFullData(res.latitude, res.longitude, res.name);
            elements.cityInput.value = res.name;
            elements.searchResults.classList.add('hidden');
        };
        elements.searchResults.appendChild(div);
    });
}

function handleGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => fetchFullData(p.coords.latitude, p.coords.longitude, 'Ваша локація'));
    }
}

function addToRecent(name, lat, lon) {
    if (recentSearches.find(s => s.name === name)) return;
    recentSearches.unshift({ name, lat, lon });
    recentSearches = recentSearches.slice(0, 5);
    localStorage.setItem('recent_searches', JSON.stringify(recentSearches));
}

init();
