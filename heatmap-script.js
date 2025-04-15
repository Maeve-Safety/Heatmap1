
function resetMap() {
    // Reset the selected district and subdistrict
    if (selectedDistrict) {
        // Reset previous selection
        const oldLayer = districtLayers[selectedDistrict];
        if (oldLayer) {
            oldLayer.setStyle(getDistrictStyle(oldLayer.feature));
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
    infoControl.update();
    
    // Reset map view
    map.setView([53.3498, -6.2603], 11);
    
    // Update data panel
    updateDataPanel();
    
    // Switch to map tab
    document.querySelector('.tab-button[data-tab="map"]').click();
}


 //set up event listeners
 
function setupEventListeners() {
    // filter for districts
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
    
    // hide/show Garda stations
    showStationsCheckbox.addEventListener('change', function() {
        gardaMarkers.forEach(marker => {
            marker.setOpacity(this.checked ? 1 : 0);
        });
        
        // update the data panel if a district is selected
        if (selectedDistrict) {
            const feature = districtBoundaries.features.find(f => 
                f.properties?.matchedDistrict === selectedDistrict || 
                f.properties?.Name === selectedDistrict ||
                f.properties?.District_N === selectedDistrict
            );
            updateDataPanel(feature);
        }
    });
    
    // hoome button
    homeButton.addEventListener('click', resetMap);
    
    // tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            //active tab button update
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // show selected panel and makr others hidden
            document.querySelectorAll('.content-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.getElementById(`${tabId}-panel`).classList.add('active');
            
            // fixed to make render (may need to change later)
            if (tabId === 'map') {
                setTimeout(() => {
                    map.invalidateSize();
                }, 0);
            }
        });
    });
}

/**
 * error handling
 * @param {Error} error 
 * @param {string} fallbackMessage 
 * @param {boolean} showAlert 
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
 * Safe string includes helper
 */
function safeIncludes(str, search) {
    if (!str || !search) return false;
    return str.toString().toLowerCase().includes(search.toString().toLowerCase());
}

// Make selectSubdistrict available globally
window.selectSubdistrict = selectSubdistrict;/**
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
    let crimeLevel = feature?.properties?.crimeLevel || 'average';
    
    // Check for manual override
    for (const manualDistrict in manualDistrictOverrides) {
        if (normalizeDistrictName(manualDistrict) === normalizeDistrictName(selectedDistrict) ||
            normalizeDistrictName(selectedDistrict).includes(normalizeDistrictName(manualDistrict)) ||
            normalizeDistrictName(manualDistrict).includes(normalizeDistrictName(selectedDistrict))) {
            crimeLevel = manualDistrictOverrides[manualDistrict];
            break;
        }
    }
    
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
                        let stationLevel = heatData[matchedDistrict]?.[stationName] || 'average';
                        
                        // Check for manual override
                        for (const manualStation in manualDistrictOverrides) {
                            if (normalizeDistrictName(manualStation) === normalizeDistrictName(stationName) ||
                                normalizeDistrictName(stationName).includes(normalizeDistrictName(manualStation)) ||
                                normalizeDistrictName(manualStation).includes(normalizeDistrictName(stationName))) {
                                stationLevel = manualDistrictOverrides[manualStation];
                                break;
                            }
                        }
                        
                        return `
                            <li style="margin-bottom: 8px; display: flex; align-items: center; cursor: pointer;" onclick="selectSubdistrict('${matchedDistrict}', '${stationName}')">
                                <div style="width: 12px; height: 12px; background-color: ${crimeColorScale[stationLevel]}; margin-right: 8px; border-radius: 50%;"></div>
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
                        
                        // Check for manual override first
                        for (const manualStation in manualDistrictOverrides) {
                            if (normalizeDistrictName(manualStation) === normalizeDistrictName(stationName) ||
                                normalizeDistrictName(stationName).includes(normalizeDistrictName(manualStation)) ||
                                normalizeDistrictName(manualStation).includes(normalizeDistrictName(stationName))) {
                                stationLevel = manualDistrictOverrides[manualStation];
                                break;
                            }
                        }
                        
                        // If no override, find this station's crime level and district
                        if (stationLevel === 'average' && heatData) {
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
                                    <div style="width: 12px; height: 12px; background-color: ${crimeColorScale[stationLevel]}; margin-right: 8px; border-radius: 50%;"></div>
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
            <div style="padding: 12px; background-color: ${crimeColorScale[crimeLevel]}; color: white; text-align: center; font-weight: bold; border-radius: 4px;">
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
}/**
 * Find nearest Garda stations to a district
 * @param {string} districtName - The name of the district
 * @param {number} limit - Maximum number of stations to return
 * @returns {Array} - Array of stations with distance info
 */
function findNearestGardaStations(districtName, limit = 3) {
    if (!districtBoundaries || !gardaStations) return [];
    
    const district = districtBoundaries.features.find(f => 
        f.properties?.matchedDistrict === districtName || 
        f.properties?.Name === districtName ||
        f.properties?.District_N === districtName
    );
    
    if (!district || !district.geometry) return [];
    
    // Get the center of the district polygon
    // Handling different polygon structures
    let coords = [];
    if (district.geometry.type === 'Polygon') {
        coords = district.geometry.coordinates[0];
    } else if (district.geometry.type === 'MultiPolygon') {
        // Use the largest polygon as representative
        let maxSize = 0;
        let largestPolygon = [];
        
        district.geometry.coordinates.forEach(polygon => {
            if (polygon[0].length > maxSize) {
                maxSize = polygon[0].length;
                largestPolygon = polygon[0];
            }
        });
        
        coords = largestPolygon;
    } else {
        console.warn("Unsupported geometry type:", district.geometry.type);
        return [];
    }
    
    if (!coords || coords.length === 0) return [];
    
    // Calculate centroid
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
}// heatmap-script.js - Choropleth Map Implementation with Manual District Overrides

// Global variables
let map;
let districtBoundaries; // District polygons
let gardaStations;
let heatData;
let selectedDistrict = null;
let selectedSubdistrict = null;
let districtLayers = {};
let subdistrictLayers = {};
let gardaMarkers = [];
let infoControl;

// Define color scale for choropleth
const crimeColorScale = {
    'very low': '#4ade80',   // Green
    'low': '#a3e635',        // Light green
    'average': '#fcd34d',    // Yellow
    'high': '#fb923c',       // Orange
    'very high': '#ef4444'   // Red
};

// Numerical values for each crime level (for legend)
const crimeLevelValues = {
    'very low': '0-20',
    'low': '21-40',
    'average': '41-60',
    'high': '61-80',
    'very high': '81-100'
};

// Manual district crime level overrides
const manualDistrictOverrides = {
    "Bridewell": "very high",
    "Kevin St": "very high",
    "Pearse St": "very high",
    "Dun Laoghaire": "low",
    "Blackrock": "low",
    "Blanchardstown": "average",
    "Lucan": "high",
    "Clondalkin": "very high",
    "Fitzgibbon Street": "high",
    "Store Street": "high",
    "Raheny": "low",
    "Balbriggan": "average",
    "Coolock": "low",
    "Tallaght": "high",
    "Donnybrook": "average",
    "Terenure": "low",
    "Ballymun": "average",
    "Crumlin": "high" // Setting as high per "average/high" in the request
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
 * Initialize Leaflet map with choropleth support
 */
function initializeMap() {
    try {
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
        
        // Add info control to show hover information
        infoControl = L.control({ position: 'topright' });
        infoControl.onAdd = function() {
            this._div = L.DomUtil.create('div', 'map-info-control');
            this.update();
            return this._div;
        };
        infoControl.update = function(props) {
            this._div.innerHTML = '<h4>Dublin Crime Levels</h4>' + 
                (props ? `<b>${props.matchedDistrict || props.Name || props.District_N}</b><br/>${props.crimeLevel || 'average'} crime` : 'Hover over a district');
        };
        infoControl.addTo(map);
        
        // Add choropleth legend
        addChoroplethLegend();
    } catch (error) {
        handleError(error, "Failed to initialize map");
    }
}

/**
 * Add choropleth legend to the map
 */
function addChoroplethLegend() {
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <div class="legend-title">Crime Level Index</div>
            <div class="legend-scale">
                ${Object.entries(crimeColorScale).map(([level, color]) => `
                    <div class="legend-item">
                        <i style="background:${color}"></i>
                        <span>${level.charAt(0).toUpperCase() + level.slice(1)} (${crimeLevelValues[level]})</span>
                    </div>
                `).join('')}
            </div>
        `;
        return div;
    };
    
    legend.addTo(map);
}

/**
 * Style function for choropleth districts
 */
function getDistrictStyle(feature) {
    // Using the crimeLevel property we set in processHeatData
    const crimeLevel = feature.properties.crimeLevel || 'average';
    return {
        fillColor: crimeColorScale[crimeLevel],
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}

/**
 * Highlight feature on hover
 */
function highlightFeature(e) {
    const layer = e.target;
    
    layer.setStyle({
        weight: 4,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
    });
    
    infoControl.update(layer.feature.properties);
    
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

/**
 * Reset highlight on mouseout
 */
function resetHighlight(e) {
    const layer = e.target;
    // Get the appropriate property name based on your GeoJSON structure
    const layerName = layer.feature.properties.Name || 
                       layer.feature.properties.District_N || 
                       layer.feature.properties.matchedDistrict;
    
    // Try to find the stored layer reference first
    const districtLayer = districtLayers[layerName];
    
    if (districtLayer) {
        districtLayer.setStyle(getDistrictStyle(layer.feature));
    } else {
        // Fallback if layer reference isn't stored
        layer.setStyle(getDistrictStyle(layer.feature));
    }
    
    infoControl.update();
}

/**
 * Zoom to feature on click
 */
function zoomToFeature(e) {
    const feature = e.target.feature;
    const districtName = feature.properties.matchedDistrict || 
                         feature.properties.Name || 
                         feature.properties.District_N;
    selectDistrict(districtName);
}

/**
 * Add event listeners to district features
 */
function onEachDistrictFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

/**
 * Load all data required for the application
 */
async function loadData() {
    try {
        // Clear loading state
        districtsList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        // Load all data files
        const [neighborhoodsResponse, gardaResponse, heatResponse] = await Promise.all([
            fetch('district_shape.geojson'),
            fetch('garda_station.geojson'),
            fetch('garda_heat.json')
        ]);

        // Check all responses
        if (!neighborhoodsResponse.ok || !gardaResponse.ok || !heatResponse.ok) {
            throw new Error("Failed to load one or more data files");
        }

        // Parse all data
        [districtBoundaries, gardaStations, heatData] = await Promise.all([
            neighborhoodsResponse.json(),
            gardaResponse.json(),
            heatResponse.json()
        ]);

        // Process heat data with neighborhood data
        processHeatData();
        
        // Apply manual overrides
        applyManualOverrides();
        
        // Then render
        renderDistricts();
        renderGardaStations();
    } catch (error) {
        handleError(error, "Failed to load application data");
    }
}

/**
 * Helper function to normalize district names for comparison
 */
function normalizeDistrictName(name) {
    return name.toLowerCase()
        .replace(/street/g, 'st')
        .replace(/road/g, 'rd')
        .replace(/avenue/g, 'ave')
        .replace(/\s+/g, '');
}

/**
 * Apply manual district overrides
 */
function applyManualOverrides() {
    console.log("Applying manual district overrides...");
    
    // Apply to district boundaries
    if (districtBoundaries && districtBoundaries.features) {
        districtBoundaries.features.forEach(feature => {
            if (!feature.properties) return;
            
            // Get district/station name
            const name = feature.properties.Name || 
                        feature.properties.Station ||
                        feature.properties.District_N || "";
            
            if (!name) return;
            
            const normalizedName = normalizeDistrictName(name);
            
            // Check if this district is in our manual override list
            for (const manualDistrict in manualDistrictOverrides) {
                if (normalizeDistrictName(manualDistrict) === normalizedName ||
                    normalizedName.includes(normalizeDistrictName(manualDistrict)) ||
                    normalizeDistrictName(manualDistrict).includes(normalizedName)) {
                    
                    // Override the crime level
                    feature.properties.crimeLevel = manualDistrictOverrides[manualDistrict];
                    console.log(`Updated district ${name} to ${manualDistrictOverrides[manualDistrict]}`);
                    break;
                }
            }
        });
    }
    
    // Also update heat data
    if (heatData) {
        for (const district in heatData) {
            for (const stationName in heatData[district]) {
                const normalizedName = normalizeDistrictName(stationName);
                
                // Check if this station is in our manual override list
                for (const manualStation in manualDistrictOverrides) {
                    if (normalizeDistrictName(manualStation) === normalizedName ||
                        normalizedName.includes(normalizeDistrictName(manualStation)) ||
                        normalizeDistrictName(manualStation).includes(normalizedName)) {
                        
                        // Override the crime level
                        heatData[district][stationName] = manualDistrictOverrides[manualStation];
                        console.log(`Updated station ${stationName} to ${manualDistrictOverrides[manualStation]}`);
                        break;
                    }
                }
            }
        }
    }
}

/**
 * Process heat data with neighborhood data
 * This function assigns crime levels to each district polygon
 */
function processHeatData() {
    if (!districtBoundaries || !heatData) {
        console.error("Missing data for heat processing");
        return;
    }

    const levels = {
        'very low': 1,
        'low': 2,
        'average': 3,
        'high': 4,
        'very high': 5
    };

    // Helper to normalize strings for matching
    function normalize(str) {
        return str ? str.toLowerCase().replace(/[^a-z]/g, '') : '';
    }

    districtBoundaries.features.forEach(feature => {
        const name = feature.properties?.Name || feature.properties?.District_N || '';
        const normName = normalize(name);
        let matchedDistrict = null;

        // Try to match district names
        for (const heatDistrict in heatData) {
            if (normalize(heatDistrict) === normName ||
                normalize(heatDistrict).includes(normName) ||
                normName.includes(normalize(heatDistrict))) {
                matchedDistrict = heatDistrict;
                break;
            }
        }

        if (!matchedDistrict) {
            feature.properties.crimeLevel = 'average';
            feature.properties.matchedDistrict = null;
            return;
        }

        // Calculate average crime level for matched district
        const stations = heatData[matchedDistrict];
        let total = 0, count = 0;
        for (const station in stations) {
            const level = levels[stations[station]];
            if (level) {
                total += level;
                count++;
            }
        }

        let crimeLevel = 'average';
        if (count > 0) {
            const avg = total / count;
            if (avg <= 1.5) crimeLevel = 'very low';
            else if (avg <= 2.5) crimeLevel = 'low';
            else if (avg <= 3.5) crimeLevel = 'average';
            else if (avg <= 4.5) crimeLevel = 'high';
            else crimeLevel = 'very high';
        }

        feature.properties.crimeLevel = crimeLevel;
        feature.properties.matchedDistrict = matchedDistrict;
        
        // Store the stations for this district
        feature.properties.stations = Object.keys(stations);
        feature.properties.stationLevels = stations;
    });
}

/**
 * Calculate the average crime level for a district
 * @param {string} district - The district name
 * @returns {string} The crime level classification
 */
function calculateDistrictCrimeLevel(district) {
    // Check manual overrides first
    for (const manualDistrict in manualDistrictOverrides) {
        if (normalizeDistrictName(manualDistrict) === normalizeDistrictName(district) ||
            normalizeDistrictName(district).includes(normalizeDistrictName(manualDistrict)) ||
            normalizeDistrictName(manualDistrict).includes(normalizeDistrictName(district))) {
            return manualDistrictOverrides[manualDistrict];
        }
    }
    
    // If district doesn't exist in heatData, return 'average'
    if (!heatData[district]) {
        return 'average';
    }
    
    const stations = heatData[district];
    const levels = {
        'very low': 1,
        'low': 2,
        'average': 3,
        'high': 4,
        'very high': 5
    };
    
    let total = 0, count = 0;
    
    for (const station in stations) {
        const level = levels[stations[station]];
        if (level) {
            total += level;
            count++;
        }
    }
    
    let crimeLevel = 'average';
    if (count > 0) {
        const avg = total / count;
        if (avg <= 1.5) crimeLevel = 'very low';
        else if (avg <= 2.5) crimeLevel = 'low';
        else if (avg <= 3.5) crimeLevel = 'average';
        else if (avg <= 4.5) crimeLevel = 'high';
        else crimeLevel = 'very high';
    }
    
    return crimeLevel;
}

/**
 * Render districts as choropleth on the map and in the sidebar
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
        
        // Calculate crime level for the district
        const crimeLevel = calculateDistrictCrimeLevel(district);
        
        // Create a color indicator based on crime level
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'crime-level-indicator';
        colorIndicator.style.backgroundColor = crimeColorScale[crimeLevel];
        
        // Add elements to the div
        div.appendChild(nameSpan);
        div.appendChild(colorIndicator);
        
        div.addEventListener('click', () => selectDistrict(district));
        districtsList.appendChild(div);
    });
    
    // Add choropleth districts to the map
    if (districtBoundaries && districtBoundaries.features.length > 0) {
        // Add district polygons to the map with styling
        const districtsLayer = L.geoJSON(districtBoundaries, {
            style: getDistrictStyle,
            onEachFeature: onEachDistrictFeature
        }).addTo(map);
        
        // Store references to all district layers for selection highlighting
        districtBoundaries.features.forEach(feature => {
            // Get the appropriate name property
            const name = feature.properties.Name || 
                         feature.properties.District_N || 
                         feature.properties.matchedDistrict;
                         
            if (name) {
                // Find the corresponding layer
                const layers = districtsLayer.getLayers();
                
                for (let i = 0; i < layers.length; i++) {
                    const layer = layers[i];
                    const layerName = layer.feature.properties.Name || 
                                      layer.feature.properties.District_N;
                    
                    if (layer.feature && layerName === name) {
                        districtLayers[name] = layer;
                        break;
                    }
                }
            }
        });
    } else {
        console.error("No district boundaries available for rendering");
    }
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
        
        // Get crime level (check overrides first)
        let crimeLevel = stations[station];
        
        // Check for manual override
        for (const manualStation in manualDistrictOverrides) {
            if (normalizeDistrictName(manualStation) === normalizeDistrictName(station) ||
                normalizeDistrictName(station).includes(normalizeDistrictName(manualStation)) ||
                normalizeDistrictName(manualStation).includes(normalizeDistrictName(station))) {
                crimeLevel = manualDistrictOverrides[manualStation];
                break;
            }
        }
        
        // Create a color indicator based on crime level
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'crime-level-indicator';
        colorIndicator.style.backgroundColor = crimeColorScale[crimeLevel];
        
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
        let districtName = null;
        
        // Check for manual override first
        for (const manualStation in manualDistrictOverrides) {
            if (normalizeDistrictName(manualStation) === normalizeDistrictName(stationName) ||
                normalizeDistrictName(stationName).includes(normalizeDistrictName(manualStation)) ||
                normalizeDistrictName(manualStation).includes(normalizeDistrictName(stationName))) {
                crimeLevel = manualDistrictOverrides[manualStation];
                break;
            }
        }
        
        // If no override, find this station in the heat data
        if (crimeLevel === 'average' && heatData) {
            for (const district in heatData) {
                if (heatData[district][stationName]) {
                    crimeLevel = heatData[district][stationName];
                    districtName = district;
                    break;
                }
                // Try partial matches
                for (const heatStationName in heatData[district]) {
                    if (safeIncludes(stationName, heatStationName) || safeIncludes(heatStationName, stationName)) {
                        crimeLevel = heatData[district][heatStationName];
                        districtName = district;
                        break;
                    }
                }
            }
        }
        
        // Create a custom icon with the crime level color
        const markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: ${crimeColorScale[crimeLevel]}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
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
                        <div style="width: 12px; height: 12px; background-color: ${crimeColorScale[crimeLevel]}; margin-right: 8px; border-radius: 50%;"></div>
                        <div>Crime Level: ${crimeLevel.charAt(0).toUpperCase() + crimeLevel.slice(1)}</div>
                    </div>
                    ${districtName ? `<p style="margin-top: 8px;">District: ${districtName}</p>` : ''}
                </div>
            `);
            
            marker.addTo(map);
            gardaMarkers.push(marker);
            
            // Store station marker for future reference
            subdistrictLayers[stationName] = marker;
            
            // Add district info to station
            marker.district = districtName;
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
    // Find the feature first to get the matched district name
    const feature = districtBoundaries.features.find(f => 
        f.properties?.matchedDistrict === name || 
        f.properties?.Name === name || 
        f.properties?.District_N === name
    );
    
    // Use the matched district name if available
    const districtName = feature?.properties?.matchedDistrict || name;
    
    // Reset subdistrict selection if applicable
    if (selectedSubdistrict) {
        selectedSubdistrict = null;
    }
    
    // Update selected state
    if (selectedDistrict) {
        // Reset previous selection
        const oldLayer = districtLayers[selectedDistrict];
        if (oldLayer) {
            oldLayer.setStyle(getDistrictStyle(oldLayer.feature));
        }
        
        // Remove selected class from list item
        document.querySelectorAll('.district-item').forEach(item => {
            const itemText = item.querySelector('span')?.textContent || "";
            if (itemText === selectedDistrict) {
                item.classList.remove('selected');
            }
        });
    }
    
    selectedDistrict = districtName;
    
    // Update UI
    currentDistrictDisplay.textContent = districtName ? `Currently viewing: ${districtName}` : '';
    
    // Update map
    const layer = districtLayers[name] || // Try direct match first
                 districtLayers[districtName] || // Then try matched district name
                 (feature ? districtLayers[feature.properties.Name] : null) || // Then try feature name
                 (feature ? districtLayers[feature.properties.District_N] : null); // Then try district_n
                 
    if (layer) {
        layer.setStyle({
            fillColor: '#3B82F6',
            weight: 3,
            color: '#1E40AF',
            fillOpacity: 0.7
        });
        
        // Zoom to district
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    }
    
    // Update list item
    document.querySelectorAll('.district-item').forEach(item => {
        const itemText = item.querySelector('span')?.textContent || "";
        if (itemText === districtName) {
            item.classList.add('selected');
            // Scroll into view if needed
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    // Render subdistricts for this district
    renderSubdistricts(districtName);
    
    // Show district data panel
    document.querySelector('.tab-button[data-tab="data"]').click();
    
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
    // Get crime level (check manual overrides first)
    let crimeLevel = heatData[district][station] || 'average';
    
    // Check for manual override
    for (const manualStation in manualDistrictOverrides) {
        if (normalizeDistrictName(manualStation) === normalizeDistrictName(station) ||
            normalizeDistrictName(station).includes(normalizeDistrictName(manualStation)) ||
            normalizeDistrictName(manualStation).includes(normalizeDistrictName(station))) {
            crimeLevel = manualDistrictOverrides[manualStation];
            break;
        }
    }
    
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
                <div style="padding: 12px; background-color: ${crimeColorScale[crimeLevel]}; color: white; text-align: center; font-weight: bold; border-radius: 4px;">
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
                <div style="padding: 12px; background-color: ${crimeColorScale[crimeLevel]}; color: white; text-align: center; font-weight: bold; border-radius: 4px;">
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
        const feature = districtBoundaries.features.find(f => 
            f.properties?.matchedDistrict === district || f.properties?.Name === district
        );
        updateDataPanel(feature);
    });
}