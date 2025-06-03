
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
    
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-notification';
    errorContainer.innerHTML = `<strong>Error:</strong> ${message}`;
    document.body.appendChild(errorContainer);
    s
    setTimeout(() => {
        errorContainer.remove();
    }, 5000);
}
function safeIncludes(str, search) {
    if (!str || !search) return false;
    return str.toString().toLowerCase().includes(search.toString().toLowerCase());
}

// Make selectSubdistrict available globally
window.selectSubdistrict = selectSubdistrict;/**

 * @param {Object} feature 
 */
function updateDataPanel(feature) {
    console.log('updateDataPanel called with feature:', feature);
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
    
    // crime level 
    let crimeLevel = feature?.properties?.crimeLevel || 'average';
    
    // look for for manual override
    /*for (const manualDistrict in manualDistrictOverrides) {
        if (normalizeDistrictName(manualDistrict) === normalizeDistrictName(selectedDistrict) ||
            normalizeDistrictName(selectedDistrict).includes(normalizeDistrictName(manualDistrict)) ||
            normalizeDistrictName(manualDistrict).includes(normalizeDistrictName(selectedDistrict))) {
            crimeLevel = manualDistrictOverrides[manualDistrict];
            break;
        }
    }
*/    
console.log('crime level:', crimeLevel);
    const stations = feature?.properties?.stations || [];
    const stationLevels = feature?.properties?.stationLevels || {};
    const matchedDistrict = feature?.properties?.matchedDistrict || selectedDistrict;
    const nearbyStations = findNearestGardaStations(selectedDistrict);
    let stationsListHTML = '';
    if (stations && stations.length > 0) {
        stationsListHTML = `
            <div style="margin-top: 16px;">
                <h3 class="section-subtitle">Garda Stations in this District</h3>
                <ul style="margin-left: 20px;">
                    ${stations.map(stationName => {
                        let stationLevel = heatData[matchedDistrict]?.[stationName] || null;
                        console.log(`Station: ${stationName}, Level: ${stationLevel}`);
                        // look for manual override
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
    
    // crime description based on level
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
    console.log(`Crime level for ${selectedDistrict}: ${crimeLevel}`);
    
    // close stations HTML
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
                        
                        // look for manual override first
                        for (const manualStation in manualDistrictOverrides) {
                            if (normalizeDistrictName(manualStation) === normalizeDistrictName(stationName) ||
                                normalizeDistrictName(stationName).includes(normalizeDistrictName(manualStation)) ||
                                normalizeDistrictName(manualStation).includes(normalizeDistrictName(stationName))) {
                                stationLevel = manualDistrictOverrides[manualStation];
                                break;
                            }
                        }
                        
                        //  no override? find station crime level and district
                        if (stationLevel === 'average' && heatData) {
                            for (const district in heatData) {
                                if (heatData[district][stationName]) {
                                    stationLevel = heatData[district][stationName];
                                    stationDistrict = district;
                                    break;
                                }
                                // loko for partial matches
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
    
    // update the data panel content
    console.log("update data-panel content");
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

    document.getElementById('close-district').addEventListener('click', function() {
        resetMap();
    });
}/**
 * look for the nearest Garda stations to a district
 * @param {string} districtName 
 * @param {number} limit 
 * @returns {Array} 
 */
function findNearestGardaStations(districtName, limit = 3) {
    if (!districtBoundaries || !gardaStations) return [];
    
    const district = districtBoundaries.features.find(f => 
        f.properties?.matchedDistrict === districtName || 
        f.properties?.Name === districtName ||
        f.properties?.District_N === districtName
    );
    
    if (!district || !district.geometry) return [];
   
    let coords = [];
    if (district.geometry.type === 'Polygon') {
        coords = district.geometry.coordinates[0];
    } else if (district.geometry.type === 'MultiPolygon') {

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
    let sumLat = 0, sumLng = 0;
    coords.forEach(coord => {
        sumLng += coord[0];
        sumLat += coord[1];
    });
    
    const centerLat = sumLat / coords.length;
    const centerLng = sumLng / coords.length;
    
    //  distance to Garda station
    const stationsWithDistances = [];
    
    gardaStations.features.forEach(station => {
        if (!station.geometry || !station.geometry.coordinates) return;
        
        const stationLng = station.geometry.coordinates[0];
        const stationLat = station.geometry.coordinates[1];
        
        //  distance calculation (Haversine formula)
        // Note: This is a simplified version, not accounting for Earth's curvature
        // and using a rough approximation for latitude/longitude conversion
        // 1 degree of latitude is approximately 111 km
        // 1 degree of longitude is approximately 111 km * cos(latitude) (took some of this code from programming group project assignment tbh)
        const distance = Math.sqrt(
            Math.pow(stationLat - centerLat, 2) + 
            Math.pow(stationLng - centerLng, 2)
        ) * 111; 
        
        stationsWithDistances.push({
            ...station,
            distance: Math.round(distance * 10) / 10 
        });
    });
    
    return stationsWithDistances
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}
// global variables
let map;
let districtBoundaries; 
let gardaStations;
let heatData;
let selectedDistrict = null;
let selectedSubdistrict = null;
let districtLayers = {};
let subdistrictLayers = {};
let gardaMarkers = [];
let infoControl;

// color scale for choropleth
const crimeColorScale = {
    'very low': '#4ade80',   // Green
    'low': '#a3e635',        // Light green
    'average': '#fcd34d',    // Yellow
    'high': '#fb923c',       // Orange
    'very high': '#ef4444'   // Red
};

// crime levels for legend (based on cso data set that is not currenyl added)
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
    "Crumlin": "high" 
};

// DOM elements
const districtsList = document.getElementById('districts-list');
const subdistrictsList = document.getElementById('subdistricts-list');
const districtFilter = document.getElementById('district-filter');
const showStationsCheckbox = document.getElementById('show-stations');
const currentDistrictDisplay = document.getElementById('current-district');
const dataContent = document.getElementById('data-content');
const homeButton = document.getElementById('home-button');

// wait for dom to load
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    loadData();
    setupEventListeners();
});

//initalize leaflet map
function initializeMap() {
    try {
        map = L.map('map-container', {
            center: [53.3498, -6.2603], // this shows you Dublin city center
            zoom: 11,
            zoomControl: false
        });
        
        // zoom controls
        L.control.zoom({
            position: 'topright'
        }).addTo(map);
        
        // map and satalite base laters
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });
        const layerControl = L.control.layers({
            "Map View": osmLayer,
            "Satellite View": satelliteLayer
        }, null, {
            position: 'topleft'
        }).addTo(map);
        
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
        addChoroplethLegend();
    } catch (error) {
        handleError(error, "Failed to initialize map");
    }
}

//legend for choropleth map
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


function getDistrictStyle(feature) {
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

//hover
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


function resetHighlight(e) {
    const layer = e.target;
    const layerName = layer.feature.properties.Name || 
                       layer.feature.properties.District_N || 
                       layer.feature.properties.matchedDistrict;
    const districtLayer = districtLayers[layerName];
    
    if (districtLayer) {
        districtLayer.setStyle(getDistrictStyle(layer.feature));
    } else {
        layer.setStyle(getDistrictStyle(layer.feature));
    }
    
    infoControl.update();
}

//zoom
function zoomToFeature(e) {
    const feature = e.target.feature;
    const districtName = feature.properties.matchedDistrict || 
                         feature.properties.Name || 
                         feature.properties.District_N;
    selectDistrict(districtName);
}


function onEachDistrictFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}


async function loadData() {
    try {
        // clear tje loading state
        districtsList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        // load data files
        const [neighborhoodsResponse, gardaResponse, heatResponse] = await Promise.all([
            fetch('district_shape.geojson'),
            fetch('garda_station.geojson'),
            fetch('garda_heat.json')
        ]);
        if (!neighborhoodsResponse.ok || !gardaResponse.ok || !heatResponse.ok) {
            throw new Error("Failed to load one or more data files");
        }

        // parse data
        [districtBoundaries, gardaStations, heatData] = await Promise.all([
            neighborhoodsResponse.json(),
            gardaResponse.json(),
            heatResponse.json()
        ]);

       
        processHeatData();
        applyManualOverrides();
        renderDistricts();
        renderGardaStations();
    } catch (error) {
        handleError(error, "Failed to load application data");
    }
}


 // normalize district names to help compare them

function normalizeDistrictName(name) {
    return name.toLowerCase()
        .replace(/street/g, 'st')
        .replace(/road/g, 'rd')
        .replace(/avenue/g, 'ave')
        .replace(/\s+/g, '');
}


 // Apply manual district overrides for selected stations (to get them to be the right oclor)
 
function applyManualOverrides() {
    console.log("Applying manual district overrides...");
    
    // Apply to district boundaries
    if (districtBoundaries && districtBoundaries.features) {
        districtBoundaries.features.forEach(feature => {
            if (!feature.properties) return;
            
            // Get the district name from properties
            const name = feature.properties.Name || 
                        feature.properties.Station ||
                        feature.properties.District_N || "";
            
            if (!name) return;
            
            const normalizedName = normalizeDistrictName(name);
            
            // check if its in manual override list
            for (const manualDistrict in manualDistrictOverrides) {
                if (normalizeDistrictName(manualDistrict) === normalizedName ||
                    normalizedName.includes(normalizeDistrictName(manualDistrict)) ||
                    normalizeDistrictName(manualDistrict).includes(normalizedName)) {
                    
                    // override the crime level if on list of dublin area
                    feature.properties.crimeLevel = manualDistrictOverrides[manualDistrict];
                    console.log(`Updated district ${name} to ${manualDistrictOverrides[manualDistrict]}`);
                    break;
                }
            }
        });
    }
    
    
    if (heatData) {
        for (const district in heatData) {
            for (const stationName in heatData[district]) {
                const normalizedName = normalizeDistrictName(stationName);
                
                // see if station is in manual override list
                for (const manualStation in manualDistrictOverrides) {
                    if (normalizeDistrictName(manualStation) === normalizedName ||
                        normalizedName.includes(normalizeDistrictName(manualStation)) ||
                        normalizeDistrictName(manualStation).includes(normalizedName)) {
                        
                        // override the crime level
                        heatData[district][stationName] = manualDistrictOverrides[manualStation];
                        console.log(`Updated station ${stationName} to ${manualDistrictOverrides[manualStation]}`);
                        break;
                    }
                }
            }
        }
    }
}


 // assign crime levels to each district polygon

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

    // helps with strings for matching
    function normalize(str) {
        return str ? str.toLowerCase().replace(/[^a-z]/g, '') : '';
    }

    districtBoundaries.features.forEach(feature => {
        const name = feature.properties?.Name || feature.properties?.District_N || '';
        const normName = normalize(name);
        let matchedDistrict = null;

        // match the names of districts
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

        // calculate the average crime level for matched district
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
        
        // store the stations for this district
        feature.properties.stations = Object.keys(stations);
        feature.properties.stationLevels = stations;
    });
}

/**
 * Calculate the average crime level for a district
 * @param {string} district - district name
 * @returns {string} crime level number
 */
function calculateDistrictCrimeLevel(district) {
    // check to see if there are manual overrides first
    for (const manualDistrict in manualDistrictOverrides) {
        if (normalizeDistrictName(manualDistrict) === normalizeDistrictName(district) ||
            normalizeDistrictName(district).includes(normalizeDistrictName(manualDistrict)) ||
            normalizeDistrictName(manualDistrict).includes(normalizeDistrictName(district))) {
            return manualDistrictOverrides[manualDistrict];
        }
    }
    
    // if no heat data for this district, return average
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


function renderDistricts() {
    districtsList.innerHTML = '';
    
    if (!heatData || Object.keys(heatData).length === 0) {
        districtsList.innerHTML = '<div class="district-item">No district data available</div>';
        return;
    }
    
    // add districts to the list from heat_data.json
    const sortedDistricts = Object.keys(heatData).sort();
    
    sortedDistricts.forEach(district => {
        const div = document.createElement('div');
        div.className = 'district-item';
        
     
        const nameSpan = document.createElement('span');
        nameSpan.textContent = district;
        
        // find level for the district (not actually doing anything right now cuz I didn't add enough data... but later ... maybe)
        const crimeLevel = calculateDistrictCrimeLevel(district);
        
        // colour based on crime level
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'crime-level-indicator';
        colorIndicator.style.backgroundColor = crimeColorScale[crimeLevel];
        
       
        div.appendChild(nameSpan);
        div.appendChild(colorIndicator);
        
        div.addEventListener('click', () => selectDistrict(district));
        districtsList.appendChild(div);
    });
    
    // put districts on map
    if (districtBoundaries && districtBoundaries.features.length > 0) {
        // Add district polygons to the map with styling
        const districtsLayer = L.geoJSON(districtBoundaries, {
            style: getDistrictStyle,
            onEachFeature: onEachDistrictFeature
        }).addTo(map);
        
        
        districtBoundaries.features.forEach(feature => {
            const name = feature.properties.Name || 
                         feature.properties.District_N || 
                         feature.properties.matchedDistrict;
                         
            if (name) {
                //look for right layer
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
 * render the subdistricts for a selected district
 * @param {string} district 
 */
function renderSubdistricts(district) {
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
        
       
        const nameSpan = document.createElement('span');
        nameSpan.textContent = station;
        
        // Get crime level 
        let crimeLevel = stations[station];
        
        // look for manual override
        for (const manualStation in manualDistrictOverrides) {
            if (normalizeDistrictName(manualStation) === normalizeDistrictName(station) ||
                normalizeDistrictName(station).includes(normalizeDistrictName(manualStation)) ||
                normalizeDistrictName(manualStation).includes(normalizeDistrictName(station))) {
                crimeLevel = manualDistrictOverrides[manualStation];
                break;
            }
        }
        
        // colors based on crime data
        const colorIndicator = document.createElement('span');
        colorIndicator.className = 'crime-level-indicator';
        colorIndicator.style.backgroundColor = crimeColorScale[crimeLevel];
        
        div.appendChild(nameSpan);
        div.appendChild(colorIndicator);
        
        div.addEventListener('click', () => selectSubdistrict(district, station));
        subdistrictsList.appendChild(div);
    });
}


function renderGardaStations() {
    // reset existing markers
    gardaMarkers.forEach(marker => marker.remove());
    gardaMarkers = [];
    
    if (!gardaStations || !gardaStations.features) {
        console.warn("No Garda station data available");
        return;
    }
    
    // add the Garda station markers
    gardaStations.features.forEach(station => {
        if (!station.geometry || !station.geometry.coordinates) {
            console.warn("Invalid station geometry:", station);
            return;
        }
        
        const stationName = station.properties.Station || "Unnamed Station";
        let crimeLevel = 'average'; 
        let districtName = null;
        
        // look for manual override first (added later cuz I could not get it to work last minute :( ))
        for (const manualStation in manualDistrictOverrides) {
            if (normalizeDistrictName(manualStation) === normalizeDistrictName(stationName) ||
                normalizeDistrictName(stationName).includes(normalizeDistrictName(manualStation)) ||
                normalizeDistrictName(manualStation).includes(normalizeDistrictName(stationName))) {
                crimeLevel = manualDistrictOverrides[manualStation];
                break;
            }
        }
        
        // if not manually coloured, find this station in the heat data
        if (crimeLevel === 'average' && heatData) {
            for (const district in heatData) {
                if (heatData[district][stationName]) {
                    crimeLevel = heatData[district][stationName];
                    districtName = district;
                    break;
                }
                // look for partial matches if no full
                for (const heatStationName in heatData[district]) {
                    if (safeIncludes(stationName, heatStationName) || safeIncludes(heatStationName, stationName)) {
                        crimeLevel = heatData[district][heatStationName];
                        districtName = district;
                        break;
                    }
                }
            }
        }
        
        // crime level color and icon
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
            
            // popup
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
            
            // add the station markers for futre
            subdistrictLayers[stationName] = marker;
            
            // add district info to station info
            marker.district = districtName;
        } catch (error) {
            console.error(`Error rendering station ${stationName}:`, error);
        }
    });
}

/**
 * look for district name
 * @param {string} name 
 */
function selectDistrict(name) {
   
    const feature = districtBoundaries.features.find(f => 
        f.properties?.matchedDistrict === name || 
        f.properties?.Name === name || 
        f.properties?.District_N === name
    );
    
    // Get the matched district name
    const districtName = feature?.properties?.matchedDistrict || name;
    
    // reset selectef subdistrict if needed
    if (selectedSubdistrict) {
        selectedSubdistrict = null;
    }
    
    // update status of selcetd district 
    if (selectedDistrict) {
        // reset to before
        const oldLayer = districtLayers[selectedDistrict];
        if (oldLayer) {
            oldLayer.setStyle(getDistrictStyle(oldLayer.feature));
        }
        
        // remove the selected class from the item
        document.querySelectorAll('.district-item').forEach(item => {
            const itemText = item.querySelector('span')?.textContent || "";
            if (itemText === selectedDistrict) {
                item.classList.remove('selected');
            }
        });
    }
    
    selectedDistrict = districtName;
    
  
    currentDistrictDisplay.textContent = districtName ? `Currently viewing: ${districtName}` : '';
    
    // update map
    const layer = districtLayers[name] || 
                 districtLayers[districtName] || 
                 (feature ? districtLayers[feature.properties.Name] : null) || 
                 (feature ? districtLayers[feature.properties.District_N] : null); 
                 
    if (layer) {
        layer.setStyle({
            fillColor: '#3B82F6',
            weight: 3,
            color: '#1E40AF',
            fillOpacity: 0.7
        });
        
        // zoom
        map.fitBounds(layer.getBounds(), { padding: [50, 50] });
    }
    
 
    document.querySelectorAll('.district-item').forEach(item => {
        const itemText = item.querySelector('span')?.textContent || "";
        if (itemText === districtName) {
            item.classList.add('selected');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    

    renderSubdistricts(districtName);
    document.querySelector('.tab-button[data-tab="data"]').click();
    updateDataPanel(feature);
}

/**
 * Select a subdistrict 
  @param {string} district 
  @param {string} station 
 */
function selectSubdistrict(district, station) {
    selectedSubdistrict = station;
    
    // clear selected class from the subdistrict 
    document.querySelectorAll('.subdistrict-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // add selected class to the selected item
    document.querySelectorAll('.subdistrict-item').forEach(item => {
        const itemText = item.querySelector('span')?.textContent || "";
        if (itemText === station) {
            item.classList.add('selected');
        }
    });
    
    // look for the station in the Garda stations data
    const stationData = gardaStations.features.find(s => {
        const stationName = s.properties.Station || "";
        return stationName === station || safeIncludes(stationName, station) || safeIncludes(station, stationName);
    });
    
    if (stationData && stationData.geometry && stationData.geometry.coordinates) {
        // zoom in a bit to the station
        map.setView([stationData.geometry.coordinates[1], stationData.geometry.coordinates[0]], 15);
        
        // popup for station
        const marker = subdistrictLayers[station];
        if (marker) {
            marker.openPopup();
        }
    }
    
    // have data panel show station info
    updateStationDataPanel(district, station, stationData);
}

/**
 * update data panel with station info
 * @param {string} district 
 * @param {string} station 
 * @param {Object} stationData 
 */
function updateStationDataPanel(district, station, stationData) {
    console.log(`Updating data panel for station: ${station} in district: ${district}`);
    // find crime level (but check manual overrides first cuz central dublin needs to show :) )
    let crimeLevel = heatData[district][station] || 'average';
    
    //  manual override if earlier code dosnt work
    for (const manualStation in manualDistrictOverrides) {
        if (normalizeDistrictName(manualStation) === normalizeDistrictName(station) ||
            normalizeDistrictName(station).includes(normalizeDistrictName(manualStation)) ||
            normalizeDistrictName(manualStation).includes(normalizeDistrictName(station))) {
            crimeLevel = manualDistrictOverrides[manualStation];
            break;
        }
    }
    
    if (!stationData) {
        //  basic panel if no station info
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
        // station info
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
    
   
    document.getElementById('close-subdistrict').addEventListener('click', function() {
        console.log('Closing subdistrict');
        // Reset selected subdistrict
        selectedSubdistrict = null;
        

        document.querySelectorAll('.subdistrict-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // go back back to district view
        const feature = districtBoundaries.features.find(f => 
            f.properties?.matchedDistrict === district || f.properties?.Name === district
        );
        updateDataPanel(feature);
    });
}