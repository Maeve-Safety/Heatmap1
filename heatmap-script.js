// Global variables
let map;
let neighborhoods;
let gardaStations;
let heatData;
let selectedDistrict = null;
let selectedSubdistrict = null;
let districtLayers = {};
let subdistrictLayers = {};
let gardaMarkers = [];

// Define crime level colors
const crimeColors = {
    'very low': '#4ade80',   // Green
    'low': '#a3e635',        // Light green
    'average': '#fcd34d',    // Yellow
    'high': '#fb923c',       // Orange
    'very high': '#ef4444'   // Red
};

// DOM elements
const districtsList = document.getElementById('districts-list');
const subdistrictsList = document.getElementById('subdistricts-list');
const districtFilter = document.getElementById('district-filter');
const showStationsCheckbox = document.getElementById('show-stations');
const currentDistrictDisplay = document.getElementById('current-district');
const dataContent = document.getElementById('data-content');
const homeButton = document.getElementById('home-button');

/**
 * Initialize the application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadData();
    setupEventListeners();
});

/**
 * Initialize Leaflet map
 */
function initializeMap() {
    map = L.map('map-container', {
        center: [53.3498, -6.2603], // Dublin center
        zoom: 11,
        zoomControl: false
    });
    
    // Add zoom control to top right
    L.control.zoom({
        position: 'topright'
    }).addTo(map);
    
    // Add base layers (Map/Satellite)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    
    // Add layer control
    const layerControl = L.control.layers({
        "Map View": osmLayer,
        "Satellite View": satelliteLayer
    }, null, {
        position: 'topleft'
    }).addTo(map);
    
    // Add map legend
    const legendControl = L.control({position: 'bottomright'});
    legendControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-layer-control');
        div.innerHTML = `
            <div style="margin-bottom: 8px;">
                <span style="display: inline-block; width: 16px; height: 16px; background-color: #3B82F6; opacity: 0.6; margin-right: 8px;"></span>
                <span>Selected District</span>
            </div>
            <div>
                <span style="display: inline-block; width: 16px; height: 16px; background-color: #EF4444; border-radius: 50%; margin-right: 8px;"></span>
                <span>Garda Station</span>
            </div>
            <div style="margin-top: 12px; font-weight: bold;">Crime Levels:</div>
            <div>
                <span style="display: inline-block; width: 16px; height: 16px; background-color: ${crimeColors['very low']}; margin-right: 5px;"></span>
                <span>Very Low</span>
            </div>
            <div>
                <span style="display: inline-block; width: 16px; height: 16px; background-color: ${crimeColors['low']}; margin-right: 5px;"></span>
                <span>Low</span>
            </div>
            <div>
                <span style="display: inline-block; width: 16px; height: 16px; background-color: ${crimeColors['average']}; margin-right: 5px;"></span>
                <span>Average</span>
            </div>
            <div>
                <span style="display: inline-block; width: 16px; height: 16px; background-color: ${crimeColors['high']}; margin-right: 5px;"></span>
                <span>High</span>
            </div>
            <div>
                <span style="display: inline-block; width: 16px; height: 16px; background-color: ${crimeColors['very high']}; margin-right: 5px;"></span>
                <span>Very High</span>
            </div>
        `;
        return div;
    };
    legendControl.addTo(map);
}

/**
 * Load all data required for the application
 */
async function loadData() {
    try {
        // Load neighborhoods data (districts)
        const neighborhoodsResponse = await fetch('district_shape.geojson');
        if (!neighborhoodsResponse.ok) {
            throw new Error(`Failed to load district data: ${neighborhoodsResponse.status} ${neighborhoodsResponse.statusText}`);
        }
        neighborhoods = await neighborhoodsResponse.json();
        
        // Load Garda stations data
        const gardaResponse = await fetch('garda_station.geojson');
        if (!gardaResponse.ok) {
            throw new Error(`Failed to load Garda station data: ${gardaResponse.status} ${gardaResponse.statusText}`);
        }
        gardaStations = await gardaResponse.json();
        
        // Load heat map data
        const heatResponse = await fetch('garda_heat.json');
        if (!heatResponse.ok) {
            throw new Error(`Failed to load heat map data: ${heatResponse.status} ${heatResponse.statusText}`);
        }
        heatData = await heatResponse.json();
        
        console.log("Heat data loaded:", heatData);
        console.log("Neighborhoods loaded:", neighborhoods);
        
        // Process heat data with neighborhood data
        processHeatData();
        
        // Render data
        renderDistricts();
        renderGardaStations();
        
    } catch (error) {
        console.error("Error loading data:", error);
        alert(`Failed to load data: ${error.message}\n\nPlease make sure you have the data files in the correct location.`);
    }
}

/**
 * Safely check if string contains another string, handling undefined values
 */
function safeIncludes(str1, str2) {
    if (!str1 || !str2) return false;
    return str1.toString().toLowerCase().includes(str2.toString().toLowerCase());
}

/**
 * Process heat data and match it with neighborhoods
 */
function processHeatData() {
    if (!neighborhoods || !heatData) {
        console.error("Missing data for heat processing");
        return;
    }
    
    console.log("Processing heat data");
    
    // Map between districts in geojson and heat data
    const districtMappings = {
        "DMR North Central": ["North Central", "DMR N.C.", "North Central"],
        "DMR South Central": ["South Central", "DMR S.C.", "South Central"],
        "DMR North": ["North", "DMR N", "Dublin North"],
        "DMR West": ["West", "DMR W", "Dublin West"],
        "DMR South": ["South", "DMR S", "Dublin South"],
        "DMR East": ["East", "DMR E", "Dublin East"]
    };
    
    // For each neighborhood (district), determine crime level
    neighborhoods.features.forEach(feature => {
        if (!feature.properties) {
            feature.properties = {};
        }
        
        const name = feature.properties.Name || "";
        
        // Try to find a direct match with heat data districts
        let matchFound = false;
        
        // First try direct match
        for (const district in heatData) {
            if (district === name || safeIncludes(name, district) || safeIncludes(district, name)) {
                assignCrimeLevel(feature, district);
                matchFound = true;
                break;
            }
        }
        
        // If not found, try district mappings
        if (!matchFound) {
            for (const mappedDistrict in districtMappings) {
                const alternativeNames = districtMappings[mappedDistrict];
                if (alternativeNames.some(altName => 
                    altName === name || safeIncludes(name, altName) || safeIncludes(altName, name)
                )) {
                    if (heatData[mappedDistrict]) {
                        assignCrimeLevel(feature, mappedDistrict);
                        matchFound = true;
                        break;
                    }
                }
            }
        }
        
        // If still no match found, use a default level
        if (!matchFound) {
            feature.properties.crimeLevel = 'average';
            feature.properties.stations = [];
        }
    });
    
    function assignCrimeLevel(feature, district) {
        // Calculate average crime level
        const stations = heatData[district];
        const levels = {
            'very low': 1,
            'low': 2,
            'average': 3,
            'high': 4,
            'very high': 5
        };
        
        let totalLevel = 0;
        let count = 0;
        
        Object.entries(stations).forEach(([stationName, level]) => {
            if (levels[level]) {
                totalLevel += levels[level];
                count++;
            }
        });
        
        if (count > 0) {
            const avgLevel = totalLevel / count;
            let crimeLevel = 'average';
            
            if (avgLevel <= 1.5) crimeLevel = 'very low';
            else if (avgLevel <= 2.5) crimeLevel = 'low';
            else if (avgLevel <= 3.5) crimeLevel = 'average';
            else if (avgLevel <= 4.5) crimeLevel = 'high';
            else crimeLevel = 'very high';
            
            // Store the crime level in the feature properties
            feature.properties.crimeLevel = crimeLevel;
            feature.properties.matchedDistrict = district;
            
            // Also store the stations for this district
            feature.properties.stations = Object.keys(stations);
            feature.properties.stationLevels = stations;
        }
    }
}

/**
 * Render districts on the map and in the sidebar
 */
function renderDistricts() {
    // Clear loading state
    districtsList.innerHTML = '';
    
    if (!heatData || Object.keys(heatData).length === 0) {
        districtsList.innerHTML = '<div class="district-item">No district data available</div>';
        return;
    }
    
    // Add districts to the list from heatData
    const sortedDistricts = Object.keys(heatData).sort();
    
    sortedDistricts.forEach(district => {
        const div = document.createElement('div');
        div.className = 'district-item';
        
        // Create the name element
        const nameSpan = document.createElement('span');
        nameSpan.textContent = district;
        
        // Calculate average crime level for the district
        const stations = heatData[district];
        const levels = {
            'very low': 1,
            'low': 2,
            'average': 3,
            'high': 4,
            'very high': 5
        };
        
        let totalLevel = 0;
        let count = 0;
        
        Object.entries(stations).forEach(([stationName, level]) => {
            if (levels[level]) {
                totalLevel += levels[level];
                count++;
            }
        });
        
        let crimeLevel = 'average';
        if (count > 0) {
            const avgLevel = totalLevel / count;
            
            if (avgLevel <= 1.5) crimeLevel = 'very low';
            else if (avgLevel <= 2.5) crimeLevel = 'low';
            else if (avgLevel <= 3.5) crimeLevel = 'average';
            else if (avgLevel <= 4.5) crimeLevel = 'high';
            else crimeLevel = 'very high';
        }
        
        // Create a color indicator based on crime level
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'crime-level-indicator';
        colorIndicator.style.backgroundColor = crimeColors[crimeLevel];
        
        // Add elements to the div
        div.appendChild(nameSpan);
        div.appendChild(colorIndicator);
        
        div.addEventListener('click', () => selectDistrict(district));
        districtsList.appendChild(div);
    });
    
    // Add districts to the map
    neighborhoods.features.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0]) {
            console.warn("Invalid geometry for feature:", feature);
            return;
        }
        
        const name = feature.properties?.Name || "Unnamed District";
        const crimeLevel = feature.properties?.crimeLevel || 'average';
        const matchedDistrict = feature.properties?.matchedDistrict;
        
        try {
            // Convert GeoJSON coordinates to Leaflet format (swap lat/lng)
            const coordinates = feature.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
            
            // Create polygon with color based on crime level
            const polygon = L.polygon(coordinates, {
                fillColor: crimeColors[crimeLevel],
                weight: 2,
                opacity: 1,
                color: '#6B7280',
                fillOpacity: 0.6
            });
            
            // Add hover and click interactions
            polygon.on('mouseover', function() {
                if (name !== selectedDistrict) {
                    this.setStyle({ fillOpacity: 0.8, weight: 3 });
                }
            });
            
            polygon.on('mouseout', function() {
                if (name !== selectedDistrict) {
                    this.setStyle({ fillOpacity: 0.6, weight: 2 });
                }
            });
            
            polygon.on('click', function() {
                if (matchedDistrict) {
                    selectDistrict(matchedDistrict);
                } else {
                    selectDistrict(name);
                }
            });
            
            // Add tooltip with district and division info
            const districtName = feature.properties?.District_N || "Unknown District";
            const divisionName = feature.properties?.Division || "Unknown Division";
            polygon.bindTooltip(`${districtName} / ${divisionName} (${crimeLevel})`, { sticky: true });

            
            // Add to map
            polygon.addTo(map);
            
            // Store reference for later
            if (matchedDistrict) {
                districtLayers[matchedDistrict] = polygon;
            } else {
                districtLayers[name] = polygon;
            }
        } catch (error) {
            console.error(`Error rendering district ${name}:`, error);
        }
    });
}

/**
 * Render subdistricts for a selected district
 * @param {string} district - The district name to render subdistricts for
 */
function renderSubdistricts(district) {
    // Clear any existing subdistricts list
    subdistrictsList.innerHTML = '';
    
    if (!heatData || !heatData[district]) {
        subdistrictsList.innerHTML = '<div class="subdistrict-item">No subdistrict data available</div>';
        return;
    }
    
    const stations = heatData[district];
    const sortedStations = Object.keys(stations).sort();
    
    sortedStations.forEach(station => {
        const div = document.createElement('div');
        div.className = 'subdistrict-item';
        
        // Create the name element
        const nameSpan = document.createElement('span');
        nameSpan.textContent = station;
        
        // Get crime level
        const crimeLevel = stations[station];
        
        // Create a color indicator based on crime level
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'crime-level-indicator';
        colorIndicator.style.backgroundColor = crimeColors[crimeLevel];
        
        // Add elements to the div
        div.appendChild(nameSpan);
        div.appendChild(colorIndicator);
        
        div.addEventListener('click', () => selectSubdistrict(district, station));
        subdistrictsList.appendChild(div);
    });
}

/**
 * Render Garda stations on the map
 */
function renderGardaStations() {
    // Clear existing markers
    gardaMarkers.forEach(marker => marker.remove());
    gardaMarkers = [];
    
    if (!gardaStations || !gardaStations.features) {
        console.warn("No Garda station data available");
        return;
    }
    
    // Add Garda station markers
    gardaStations.features.forEach(station => {
        if (!station.geometry || !station.geometry.coordinates) {
            console.warn("Invalid station geometry:", station);
            return;
        }
        
        const stationName = station.properties.Station || "Unnamed Station";
        let crimeLevel = 'average'; // Default level
        
        // Find this station in the heat data
        if (heatData) {
            for (const district in heatData) {
                if (heatData[district][stationName]) {
                    crimeLevel = heatData[district][stationName];
                    break;
                }
                // Try partial matches
                for (const heatStationName in heatData[district]) {
                    if (safeIncludes(stationName, heatStationName) || safeIncludes(heatStationName, stationName)) {
                        crimeLevel = heatData[district][heatStationName];
                        break;
                    }
                }
            }
        }
        
        // Create a custom icon with the crime level color
        const markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${crimeColors[crimeLevel]}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [15, 15],
            iconAnchor: [7, 7]
        });
        
        try {
            const marker = L.marker(
                [station.geometry.coordinates[1], station.geometry.coordinates[0]],
                { 
                    icon: markerIcon,
                    opacity: showStationsCheckbox.checked ? 1 : 0 
                }
            );
            
            // Add tooltip and popup
            marker.bindTooltip(`${stationName} Garda Station (${crimeLevel})`, { direction: 'top', offset: [0, -20] });
            marker.bindPopup(`
                <div>
                    <h3 style="font-weight: bold; color: #2563eb; margin-bottom: 5px;">${stationName} Garda Station</h3>
                    <p style="margin-bottom: 3px;">${station.properties.Address1 || ""}</p>
                    <p style="margin-bottom: 3px;">${station.properties.Address2 || ""}</p>
                    <p style="margin-top: 8px;">Phone: ${station.properties.Phone || "N/A"}</p>
                    <div style="margin-top: 8px; display: flex; align-items: center;">
                        <div style="width: 12px; height: 12px; background-color: ${crimeColors[crimeLevel]}; margin-right: 8px; border-radius: 50%;"></div>
                        <div>Crime Level: ${crimeLevel.charAt(0).toUpperCase() + crimeLevel.slice(1)}</div>
                    </div>
                </div>
            `);
            
            marker.addTo(map);
            gardaMarkers.push(marker);
            
            // Store station marker for future reference
            subdistrictLayers[stationName] = marker;
        } catch (error) {
            console.error(`Error rendering station ${stationName}:`, error);
        }
    });
}

/**
 * Select a district
 * @param {string} name - The name of the district to select
 */
function selectDistrict(name) {
    // Reset subdistrict selection if applicable
    if (selectedSubdistrict) {
        selectedSubdistrict = null;
    }
    
    // Update selected state
    if (selectedDistrict) {
        // Reset previous selection
        const oldPolygon = districtLayers[selectedDistrict];
        if (oldPolygon) {
            const oldFeature = neighborhoods.features.find(f => 
                f.properties?.matchedDistrict === selectedDistrict || f.properties?.Name === selectedDistrict
            );
            const oldCrimeLevel = oldFeature?.properties?.crimeLevel || 'average';
            
            oldPolygon.setStyle({
                fillColor: crimeColors[oldCrimeLevel],
                weight: 2,
                color: '#6B7280',
                fillOpacity: 0.6
            });
        }
        
        // Remove selected class from list item
        document.querySelectorAll('.district-item').forEach(item => {
            const itemText = item.querySelector('span')?.textContent || "";
            if (itemText === selectedDistrict) {
                item.classList.remove('selected');
            }
        });
    }
    
    selectedDistrict = name;
    
    // Update UI
    currentDistrictDisplay.textContent = name ? `Currently viewing: ${name}` : '';
    
    // Update map
    const polygon = districtLayers[name];
    if (polygon) {
        polygon.setStyle({
            fillColor: '#3B82F6',
            weight: 3,
            color: '#1E40AF',
            fillOpacity: 0.7
        });
        
        // Zoom to district
        const bounds = polygon.getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Update list item
    document.querySelectorAll('.district-item').forEach(item => {
        const itemText = item.querySelector('span')?.textContent || "";
        if (itemText === name) {
            item.classList.add('selected');
            // Scroll into view if needed
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    // Render subdistricts for this district
    renderSubdistricts(name);
    
    // Show district data panel
    document.querySelector('.tab-button[data-tab="data"]').click();
    
    // Find district data
    const feature = neighborhoods.features.find(f => 
        f.properties?.matchedDistrict === name || f.properties?.Name === name
    );
    
    // Update data panel
    updateDataPanel(feature);
}

/**
 * Select a subdistrict (Garda station)
 * @param {string} district - The district name
 * @param {string} station - The station/subdistrict name
 */
function selectSubdistrict(district, station) {
    selectedSubdistrict = station;
    
    // Clear selected class from all subdistrict items
    document.querySelectorAll('.subdistrict-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selected class to the clicked item
    document.querySelectorAll('.subdistrict-item').forEach(item => {
        const itemText = item.querySelector('span')?.textContent || "";
        if (itemText === station) {
            item.classList.add('selected');
        }
    });
    
    // Find the station in the Garda stations data
    const stationData = gardaStations.features.find(s => {
        const stationName = s.properties.Station || "";
        return stationName === station || safeIncludes(stationName, station) || safeIncludes(station, stationName);
    });
    
    if (stationData && stationData.geometry && stationData.geometry.coordinates) {
        // Zoom to the station
        map.setView([stationData.geometry.coordinates[1], stationData.geometry.coordinates[0]], 15);
        
        // Open the popup for this station
        const marker = subdistrictLayers[station];
        if (marker) {
            marker.openPopup();
        }
    }
    
    // Update the data panel to show station details
    updateStationDataPanel(district, station, stationData);
}

/**
 * Update the data panel with station info
 * @param {string} district - The district name
 * @param {string} station - The station name
 * @param {Object} stationData - The station GeoJSON feature
 */
function updateStationDataPanel(district, station, stationData) {
    const crimeLevel = heatData[district][station] || 'average';
    
    if (!stationData) {
        // If we don't have detailed data, show a basic panel
        dataContent.innerHTML = `
            <h2 class="data-title">
                ${station} Garda Station
                <button id="close-subdistrict" class="close-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </h2>
            
            <div>
                <h3 class="section-subtitle">Station Information</h3>
                <p>Part of the ${district} district.</p>
            </div>
            
            <div style="margin-top: 16px;">
                <div style="padding: 12px; background-color: ${crimeColors[crimeLevel]}; color: white; text-align: center; font-weight: bold; border-radius: 4px;">
                    Crime Level: ${crimeLevel.charAt(0).toUpperCase() + crimeLevel.slice(1)}
                </div>
            </div>
        `;
    } else {
        // Show detailed station information
        dataContent.innerHTML = `
            <h2 class="data-title">
                ${station} Garda Station
                <button id="close-subdistrict" class="close-button">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </h2>
            
            <div>
                <h3 class="section-subtitle">Station Information</h3>
                <p>Part of the ${district} district.</p>
                <p style="margin-top: 8px;">${stationData.properties.Address1 || ""}</p>
                <p>${stationData.properties.Address2 || ""}</p>
                <p>${stationData.properties.Address3 || ""}</p>
                <p style="margin-top: 8px;">Phone: ${stationData.properties.Phone || "N/A"}</p>
            </div>
            
            <div style="margin-top: 16px;">
                <div style="padding: 12px; background-color: ${crimeColors[crimeLevel]}; color: white; text-align: center; font-weight: bold; border-radius: 4px;">
                    Crime Level: ${crimeLevel.charAt(0).toUpperCase() + crimeLevel.slice(1)}
                </div>
            </div>
        `;
    }
    
    // Add event listener to the close button
    document.getElementById('close-subdistrict').addEventListener('click', function() {
        // Reset subdistrict selection but keep district selected
        selectedSubdistrict = null;
        
        // Remove selected class from subdistrict items
        document.querySelectorAll('.subdistrict-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Update data panel back to district view
        const feature = neighborhoods.features.find(f => 
            f.properties?.matchedDistrict === district || f.properties?.Name === district
        );
        updateDataPanel(feature);
    });
}

/**
 * Find nearest Garda stations to a district
 * @param {string} districtName - The name of the district
 * @param {number} limit - Maximum number of stations to return
 * @returns {Array} - Array of stations with distance info
 */
function findNearestGardaStations(districtName, limit = 3) {
    if (!neighborhoods || !gardaStations) return [];
    
    const district = neighborhoods.features.find(f => 
        f.properties?.matchedDistrict === districtName || f.properties?.Name === districtName
    );
    
    if (!district || !district.geometry || !district.geometry.coordinates || !district.geometry.coordinates[0]) return [];
    
    // Get the center of the district polygon
    const coords = district.geometry.coordinates[0];
    let sumLat = 0, sumLng = 0;
    
    coords.forEach(coord => {
        sumLng += coord[0];
        sumLat += coord[1];
    });
    
    const centerLat = sumLat / coords.length;
    const centerLng = sumLng / coords.length;
    
    // Calculate distance from this point to each Garda station
    const stationsWithDistances = [];
    
    gardaStations.features.forEach(station => {
        if (!station.geometry || !station.geometry.coordinates) return;
        
        const stationLng = station.geometry.coordinates[0];
        const stationLat = station.geometry.coordinates[1];
        
        // Simple distance calculation
        const distance = Math.sqrt(
            Math.pow(stationLat - centerLat, 2) + 
            Math.pow(stationLng - centerLng, 2)
        ) * 111; // Rough conversion to kilometers
        
        stationsWithDistances.push({
            ...station,
            distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
        });
    });
    
    // Sort by distance and return the nearest ones
    return stationsWithDistances
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

/**
 * Update the data panel with district info
 * @param {Object} feature - The GeoJSON feature for the selected district
 */
function updateDataPanel(feature) {
    if (!selectedDistrict) {
        dataContent.innerHTML = `
            <h2 class="data-title">
                Select a District
                <button id="close-district" class="close-button" style="display: none;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </h2>
            <p>Please select a district from the sidebar to view detailed crime level information.</p>
            <p style="margin-top: 12px;">This map shows crime levels across Dublin Garda districts based on data from Garda stations.</p>
        `;
        return;
    }
    
    // Get crime level and other data
    const crimeLevel = feature?.properties?.crimeLevel || 'average';
    const stations = feature?.properties?.stations || [];
    const stationLevels = feature?.properties?.stationLevels || {};
    const matchedDistrict = feature?.properties?.matchedDistrict || selectedDistrict;
    
    // Find nearest Garda stations
    const nearbyStations = findNearestGardaStations(selectedDistrict);
    
    // Create the content for Garda stations in this district
    let stationsListHTML = '';
    if (stations && stations.length > 0) {
        stationsListHTML = `
            <div style="margin-top: 16px;">
                <h3 class="section-subtitle">Garda Stations in this District</h3>
                <ul style="margin-left: 20px;">
                    ${stations.map(stationName => {
                        const stationLevel = heatData[matchedDistrict]?.[stationName] || 'average';
                        return `
                            <li style="margin-bottom: 8px; display: flex; align-items: center; cursor: pointer;" onclick="selectSubdistrict('${matchedDistrict}', '${stationName}')">
                                <div style="width: 12px; height: 12px; background-color: ${crimeColors[stationLevel]}; margin-right: 8px; border-radius: 50%;"></div>
                                ${stationName} (${stationLevel})
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `;
    }
    
    // Generate crime description based on level
    let crimeDescription = '';
    switch (crimeLevel) {
        case 'very high':
            crimeDescription = `${selectedDistrict} has a very high crime rate compared to other areas in Dublin. Residents and visitors should take extra precautions, especially at night.`;
            break;
        case 'high':
            crimeDescription = `${selectedDistrict} has a higher than average crime rate. While many areas are safe, awareness of your surroundings is recommended.`;
            break;
        case 'average':
            crimeDescription = `${selectedDistrict} has an average crime rate for Dublin. Standard urban safety precautions are advised.`;
            break;
        case 'low':
            crimeDescription = `${selectedDistrict} has a relatively low crime rate and is considered one of the safer areas in Dublin.`;
            break;
        case 'very low':
            crimeDescription = `${selectedDistrict} has a very low crime rate and is among the safest neighborhoods in Dublin.`;
            break;
        default:
            crimeDescription = `Crime data is not specifically available for ${selectedDistrict}.`;
    }
    
    // Nearest stations HTML
    let nearestStationsHTML = '';
    if (nearbyStations.length > 0 && showStationsCheckbox.checked) {
        nearestStationsHTML = `
            <div style="margin-top: 24px;">
                <h3 class="section-subtitle">Nearest Garda Stations</h3>
                <div class="station-cards">
                    ${nearbyStations.map(station => {
                        const stationName = station.properties?.Station || "Unnamed Station";
                        let stationLevel = 'average';
                        let stationDistrict = '';
                        
                        // Find this station's crime level and district
                        if (heatData) {
                            for (const district in heatData) {
                                if (heatData[district][stationName]) {
                                    stationLevel = heatData[district][stationName];
                                    stationDistrict = district;
                                    break;
                                }
                                // Try partial matches
                                for (const heatStationName in heatData[district]) {
                                    if (safeIncludes(stationName, heatStationName) || safeIncludes(heatStationName, stationName)) {
                                        stationLevel = heatData[district][heatStationName];
                                        stationDistrict = district;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        const clickHandler = stationDistrict ? 
                            `onclick="selectSubdistrict('${stationDistrict}', '${stationName}')"` : '';
                        
                        return `
                            <div class="station-card" ${clickHandler} style="cursor: pointer;">
                                <h4 class="station-name">${stationName} Garda Station</h4>
                                <p class="station-address">${station.properties?.Address1 || ""}</p>
                                <p class="station-address">${station.properties?.Address2 || ""}</p>
                                <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                                    <div class="station-phone">Phone: ${station.properties?.Phone || "N/A"}</div>
                                    <div class="station-distance">~${station.distance} km away</div>
                                </div>
                                <div style="margin-top: 8px; display: flex; align-items: center;">
                                    <div style="width: 12px; height: 12px; background-color: ${crimeColors[stationLevel]}; margin-right: 8px; border-radius: 50%;"></div>
                                    <div>Crime Level: ${stationLevel.charAt(0).toUpperCase() + stationLevel.slice(1)}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    // Update the data panel content
    dataContent.innerHTML = `
        <h2 class="data-title">
            ${selectedDistrict}
            <button id="close-district" class="close-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </h2>
        
        <div style="margin-bottom: 16px;">
            <h3 class="section-subtitle">District Information</h3>
            <p>${crimeDescription}</p>
        </div>
        
        <div style="margin-top: 16px;">
            <div style="padding: 12px; background-color: ${crimeColors[crimeLevel]}; color: white; text-align: center; font-weight: bold; border-radius: 4px;">
                Crime Level: ${crimeLevel.charAt(0).toUpperCase() + crimeLevel.slice(1)}
            </div>
        </div>
        
        ${stationsListHTML}
        ${nearestStationsHTML}
    `;
    
    // Add event listener to the close button
    document.getElementById('close-district').addEventListener('click', function() {
        resetMap();
    });
}

/**
 * Function to reset the map to its initial state
 */
function resetMap() {
    // Reset the selected district and subdistrict
    if (selectedDistrict) {
        // Reset previous district selection
        const oldPolygon = districtLayers[selectedDistrict];
        if (oldPolygon) {
            const oldFeature = neighborhoods.features.find(f => 
                f.properties?.matchedDistrict === selectedDistrict || f.properties?.Name === selectedDistrict
            );
            const oldCrimeLevel = oldFeature?.properties?.crimeLevel || 'average';
            
            oldPolygon.setStyle({
                fillColor: crimeColors[oldCrimeLevel],
                weight: 2,
                color: '#6B7280',
                fillOpacity: 0.6
            });
        }
        
        // Remove selected class from district items
        document.querySelectorAll('.district-item').forEach(item => {
            const itemText = item.querySelector('span')?.textContent || "";
            if (itemText === selectedDistrict) {
                item.classList.remove('selected');
            }
        });
    }
    
    // Clear selected district and subdistrict
    selectedDistrict = null;
    selectedSubdistrict = null;
    
    // Clear subdistricts list
    subdistrictsList.innerHTML = '<div class="subdistrict-info">Select a district to view its subdistricts</div>';
    
    // Reset UI
    currentDistrictDisplay.textContent = '';
    
    // Reset map view
    map.setView([53.3498, -6.2603], 11);
    
    // Update data panel
    updateDataPanel();
    
    // Switch to map tab
    document.querySelector('.tab-button[data-tab="map"]').click();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // District filter
    if (districtFilter) {
        districtFilter.addEventListener('input', function() {
            const filterText = this.value.toLowerCase();
            document.querySelectorAll('.district-item').forEach(item => {
                const districtName = item.querySelector('span')?.textContent?.toLowerCase() || "";
                if (districtName.includes(filterText)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    // Show/hide Garda stations
    if (showStationsCheckbox) {
        showStationsCheckbox.addEventListener('change', function() {
            gardaMarkers.forEach(marker => {
                marker.setOpacity(this.checked ? 1 : 0);
            });
            
            // Update data panel if a district is selected
            if (selectedDistrict) {
                const feature = neighborhoods.features.find(f => 
                    f.properties?.matchedDistrict === selectedDistrict || f.properties?.Name === selectedDistrict
                );
                updateDataPanel(feature);
            }
        });
    }
    
    // Home button
    if (homeButton) {
        homeButton.addEventListener('click', resetMap);
    }
    
    // Tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Update active tab button
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Show selected panel, hide others
            document.querySelectorAll('.content-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`${tabId}-panel`).classList.add('active');
            
            // Special handling for map panel
            if (tabId === 'map') {
                // Invalidate map size to fix display issues
                setTimeout(() => {
                    map.invalidateSize();
                }, 0);
            }
        });
    });
}

/**
 * Helper function to handle errors gracefully
 * @param {Error} error - The error to handle
 * @param {string} fallbackMessage - A fallback message if error is undefined
 * @param {boolean} showAlert - Whether to show alert to user
 */
function handleError(error, fallbackMessage = "An unknown error occurred", showAlert = true) {
    const message = error?.message || fallbackMessage;
    console.error(message, error);
    
    if (showAlert) {
        alert(`Error: ${message}`);
    }
    
    // You could also log to a server or display in UI
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-notification';
    errorContainer.innerHTML = `<strong>Error:</strong> ${message}`;
    document.body.appendChild(errorContainer);
    
    // Automatically remove after 5 seconds
    setTimeout(() => {
        errorContainer.remove();
    }, 5000);
}

/**
 * Add utility function to help match district names with heat data
 * @param {string} name - The district name to find in heat data
 * @returns {string|null} - The matching district name or null if not found
 */
function findMatchingDistrict(name) {
    if (!name || !heatData) return null;
    
    // Directly check if the name exists in heat data
    if (heatData[name]) {
        return name;
    }
    
    // Define district name mappings
    const districtMappings = {
        "North Central": ["DMR North Central", "North Central", "Central North"],
        "South Central": ["DMR South Central", "South Central", "Central South"],
        "North": ["DMR North", "North District", "Dublin North"],
        "West": ["DMR West", "West District", "Dublin West"],
        "South": ["DMR South", "South District", "Dublin South"],
        "East": ["DMR East", "East District", "Dublin East"]
    };
    
    // Check all possible mappings
    for (const [district, alternativeNames] of Object.entries(districtMappings)) {
        if (alternativeNames.includes(name) || alternativeNames.some(alt => safeIncludes(name, alt))) {
            if (heatData[district]) {
                return district;
            }
        }
    }
    
    // If still not found, try fuzzy matching
    for (const district in heatData) {
        if (safeIncludes(name, district) || safeIncludes(district, name)) {
            return district;
        }
    }
    
    return null;
}