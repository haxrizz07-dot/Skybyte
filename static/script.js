let currentLat = 10.9323;
let currentLon = 78.0913;

async function geocodeLocation(query) {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
    if (!r.ok) throw new Error('Geocode failed');
    const data = await r.json();
    if (!data.results || !data.results.length) return null;
    return {lat: data.results[0].latitude, lon: data.results[0].longitude, name: data.results[0].name};
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function fetchWeather(lat = currentLat, lon = currentLon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,apparent_temperature,relativehumidity_2m,uv_index,precipitation_probability&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Weather API failed');
    return await r.json();
  } catch (err) {
    console.error(err);
    return null;
  }
}

function weatherCondition(code) {
  if (code === 0) return 'sunny';
  if ([1, 2, 3].includes(code)) return 'cloudy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rainy';
  return 'cold';
}

async function initHome() {
  const weatherInfo = document.getElementById('weatherInfo');
  const quizResult = document.getElementById('quizResult');
  const quote = document.getElementById('quote');
  const locationInput = document.getElementById('locationInput');
  const locationSearch = document.getElementById('locationSearch');
  const locationStatus = document.getElementById('locationStatus');
  if (!weatherInfo) return;

  async function renderWeather() {
    weatherInfo.innerText = 'Loading weather...';
    const data = await fetchWeather();
    if (!data || !data.current_weather) {
      weatherInfo.innerText = 'Could not load weather.';
      return;
    }
    const cur = data.current_weather;
    weatherInfo.innerHTML = `<strong>${cur.temperature}°C</strong> | Wind ${cur.windspeed} km/h | Code ${cur.weathercode}`;
    if (quote) quote.innerText = ['Warm day? Pick light meals.', 'Rainy day comfort food checks.', 'Cool weather: hydrate and move.'][Math.floor(Math.random() * 3)];
    const actual = weatherCondition(cur.weathercode);
    document.querySelectorAll('.option').forEach(btn => {
      btn.onclick = () => {
        quizResult.innerHTML = actual === btn.dataset.answer ? `✅ Correct! It is ${actual}.` : `❌ Not quite. It is ${actual}.`;
      };
    });
  }

  if (navigator.geolocation && locationStatus) {
    locationStatus.innerText = 'Getting your location for smarter weather...';
    navigator.geolocation.getCurrentPosition(async pos => {
      currentLat = pos.coords.latitude;
      currentLon = pos.coords.longitude;
      locationStatus.innerText = `Using your location (${currentLat.toFixed(2)}, ${currentLon.toFixed(2)}).`;
      await renderWeather();
    }, async () => {
      locationStatus.innerText = 'Could not get location. Showing default weather.';
      await renderWeather();
    });
  } else {
    await renderWeather();
  }

  if (locationSearch && locationInput && locationStatus) {
    locationSearch.onclick = async () => {
      const city = locationInput.value.trim();
      if (!city) {
        locationStatus.innerText = 'Enter a city name.';
        return;
      }
      locationStatus.innerText = 'Loading city...';
      const loc = await geocodeLocation(city);
      if (!loc) {
        locationStatus.innerText = 'City not found.';
        return;
      }
      currentLat = loc.lat;
      currentLon = loc.lon;
      locationStatus.innerText = `Loaded weather for ${loc.name}.`;
      await renderWeather();
    };
  }
}

async function initWeatherPage() {
  const container = document.getElementById('weatherDetail');
  if (!container) return;
  const data = await fetchWeather();
  if (!data || !data.current_weather) {
    container.innerText = 'Could not load weather details.';
    return;
  }
  const c = data.current_weather;
  const d = data.daily;
  const h = data.hourly;
  const hourlyList = h.time.slice(0, 8).map((t, i) => `<li>${new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}: ${h.temperature_2m[i]}°C</li>`).join('');
  const dailyList = d.time.slice(0, 7).map((t, i) => `<li>${t}: ${d.temperature_2m_min[i]}° / ${d.temperature_2m_max[i]}°C</li>`).join('');
  container.innerHTML = `<div class="card"><p><strong>Temp:</strong> ${c.temperature}°C</p><p><strong>Wind:</strong> ${c.windspeed} km/h</p><p><strong>UV Index:</strong> ${h.uv_index?.[0] ?? 'N/A'}</p><p><strong>Humidity:</strong> ${h.relativehumidity_2m?.[0] ?? 'N/A'}%</p><p><strong>Sunrise:</strong> ${d.sunrise[0] ?? 'N/A'}</p><p><strong>Sunset:</strong> ${d.sunset[0] ?? 'N/A'}</p></div><div class="card"><h4>Hourly</h4><ul>${hourlyList}</ul></div><div class="card"><h4>7-Day</h4><ul>${dailyList}</ul></div>`;
}

const dishes = [
  {name: 'Grilled Chicken Salad', calories: 320, sugar: 5, sodium: 420, fat: 10, type: 'Non-Veg', score: 4.8},
  {name: 'Veg Quinoa Bowl', calories: 280, sugar: 8, sodium: 360, fat: 9, type: 'Veg', score: 4.6},
  {name: 'Paneer Wrap', calories: 480, sugar: 7, sodium: 560, fat: 18, type: 'Veg', score: 3.9},
  {name: 'Salmon Teriyaki', calories: 520, sugar: 12, sodium: 720, fat: 22, type: 'Non-Veg', score: 3.4},
  {name: 'Fruit Oat Smoothie', calories: 220, sugar: 20, sodium: 120, fat: 5, type: 'Both', score: 4.2}
];

const hotelMenus = [
  {hotel: 'Sunrise Hotel', dishes: ['Grilled Chicken Salad', 'Veg Quinoa Bowl', 'Paneer Wrap']},
  {hotel: 'Lakeview Lodge', dishes: ['Veg Quinoa Bowl', 'Fruit Oat Smoothie', 'Paneer Wrap']},
  {hotel: 'City Comfort Inn', dishes: ['Grilled Chicken Salad', 'Salmon Teriyaki', 'Fruit Oat Smoothie']},
  {hotel: 'Heritage Hotel', dishes: ['Paneer Wrap', 'Veg Quinoa Bowl', 'Fruit Oat Smoothie']}
];

function getAvailableHotelsForDish(dishName) {
  const normalized = dishName.trim().toLowerCase();
  if (!normalized) return [];
  return hotelMenus.filter(h => h.dishes.some(d => d.toLowerCase() === normalized));
}

function getRecommendedDishByPreference(preference, availableHotels) {
  const typeMap = {
    Veg: ['Veg', 'Both'],
    NonVeg: ['Non-Veg', 'Both'],
    Both: ['Veg', 'Non-Veg', 'Both']
  };
  const allowed = typeMap[preference] || typeMap.Both;
  const availableDishNames = new Set(availableHotels.flatMap(h => h.dishes));
  const candidates = dishes.filter(d => availableDishNames.has(d.name) && allowed.includes(d.type));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.score - a.score)[0];
}

function dishHealthLabel(d) {
  if (d.score >= 4.5) return '<span style="color:#7ed97d;font-weight:700;">Healthy</span>';
  if (d.score >= 3.8) return '<span style="color:#f4d35e;font-weight:700;">Moderate</span>';
  return '<span style="color:#ff7676;font-weight:700;">Not healthy</span>';
}

function evaluateDish(dish, profile) {
  const warnings = [];
  if (!profile) return warnings;
  if (profile.diabetes === 'Yes' && dish.sugar > 10) warnings.push('High sugar for diabetes.');
  if (profile.blood_pressure === 'High' && dish.sodium > 600) warnings.push('High sodium for blood pressure.');
  if (profile.pressure_status === 'High' && dish.sodium > 500) warnings.push('Pressure status suggests lower sodium.');
  if (profile.cardiac === 'Yes' && dish.fat > 16) warnings.push('High fat may be risky for cardiac condition.');
  if (profile.pregnant === 'Yes' && dish.fat > 18) warnings.push('Discuss high fat choices when pregnant.');
  const calorieGoal = Number(profile.calorie_goal || 2000);
  if (dish.calories > calorieGoal) warnings.push('This dish exceeds your calorie goal.');
  return warnings;
}

async function initDishes() {
  const container = document.getElementById('dishesContainer');
  if (!container) return;
  try {
    const r = await fetch('/api/profile');
    if (!r.ok) throw new Error('profile');
    const profile = await r.json();
    const shuffled = dishes.sort(() => Math.random() - 0.5);
    container.innerHTML = shuffled.map(d => `<div class="card"><h3>${d.name}</h3><p>Calories: ${d.calories} | Sugar: ${d.sugar}g | Sodium: ${d.sodium}mg | ${dishHealthLabel(d)}</p><button class="btn dish-btn" data-name="${d.name}">Select</button></div>`).join('');
    container.querySelectorAll('.dish-btn').forEach(btn => {
      btn.onclick = () => {
        const dish = dishes.find(x => x.name === btn.dataset.name);
        const warnings = evaluateDish(dish, profile);
        const message = warnings.length ? `⚠️ ${warnings.join(' ')}` : '✅ Great choice for you.';
        localStorage.setItem('latest_warning', message);
        localStorage.setItem('last_dish', dish.name);
        const popup = document.getElementById('popup');
        const content = document.getElementById('popupContent');
        content.innerHTML = `<h3>${dish.name}</h3><p>Calories: ${dish.calories}</p><p>Sugar: ${dish.sugar}g | Sodium: ${dish.sodium}mg | Fat: ${dish.fat}g</p><p>${message}</p><p><a class="btn" href="/restaurants">Nearby Restaurants</a> <a class="btn" href="/recipe">Recipe</a> <a class="btn" href="/warning">Warning</a></p>`;
        popup.classList.remove('hidden');
      };
    });
    const close = document.getElementById('closePopup');
    if (close) close.onclick = () => document.getElementById('popup').classList.add('hidden');
  } catch (err) {
    container.innerHTML = '<p class="warning">Save your profile first to evaluate dishes. <a class="btn" href="/profile">Profile</a></p>';
  }
}

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function runSmartFoodNearby(lat, lon, weather, profile, options) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    weather,
    diabetic: options?.diabetic ? 'true' : (profile?.diabetes === 'Yes' ? 'true' : 'false'),
    low_sugar: options?.low_sugar ? 'true' : 'false',
    low_oil: options?.low_oil ? 'true' : 'false',
    vegetarian: options?.vegetarian ? 'true' : 'false'
  });
  const r = await fetch(`/smart-food-nearby?${params.toString()}`);
  if (!r.ok) throw new Error('smart-food-nearby failed');
  return await r.json();
}

function renderSmartFoodResult(result, container) {
  if (!result) {
    container.innerHTML = '<p class="warning">No smart options available.</p>';
    return;
  }
  const lines = [];
  lines.push(`<div class="card"><h4>Smart Food Insights</h4><p><strong>Weather:</strong> ${result.weather || 'N/A'}</p><p><strong>Meal time:</strong> ${result.meal_category || 'N/A'} (${result.meal_category === 'night' ? 'No juice after dark' : 'Time-aware dish list'})</p><p><strong>Time:</strong> ${result.timestamp || 'N/A'}</p><p><strong>Suggested Dish:</strong> ${result.suggested_dish?.dish || 'N/A'}</p><p><strong>Restaurant:</strong> ${result.suggested_dish?.restaurant || 'N/A'} (${result.suggested_dish?.distance || 'N/A'} km)</p><p><strong>Source:</strong> ${result.suggested_source || 'weather'}</p><p><a class="btn" href="${result.suggested_dish?.route_url || '#'}" target="_blank">Route to suggested restaurant</a></p><p><button id="applySuggestedDish" class="btn" style="background:#c0c0c0;color:#111;">Use this dish for availability</button></p></div>`);
  if (result.foods?.length) {
    lines.push('<div class="card"><h4>Food Suggestions</h4>' + result.foods.map(food => `<div style="padding:.3rem 0;border-bottom:1px solid #222;"><strong>${food.food}</strong> at ${food.restaurant}<br/>Health: ${food.health_label} | ${food.weather_tag}</div>`).join('') + '</div>');
  }
  if (result.nearby_restaurants?.length) {
    lines.push('<div class="card"><h4>Nearby Restaurants</h4>' + result.nearby_restaurants.map(r => `<div style="padding:.3rem 0;border-bottom:1px solid #222;"><strong>${r.name}</strong><br/>Distance: ${r.distance} km<br/>Menu: ${r.menu?.join(', ') || 'N/A'}<br/><a class="btn" href="${r.route_url}" target="_blank">Route</a></div>`).join('') + '</div>');
  }
  container.innerHTML = lines.join('');
  const summary = document.getElementById('smartSummary');
  if (summary) {
    summary.innerHTML = `<div><strong>Meal Category:</strong> ${result.meal_category || 'N/A'} | <strong>Time:</strong> ${result.timestamp || 'N/A'} | <strong>Suggested:</strong> ${result.suggested_dish?.dish || 'N/A'} from ${result.suggested_dish?.restaurant || 'N/A'}</div>`;
  }
}

async function initRestaurants() {
  const button = document.getElementById('loadRestaurants');
  const list = document.getElementById('restaurantList');
  const smartFoodBtn = document.getElementById('smartFoodBtn');
  const weatherSelect = document.getElementById('weatherSelect');
  const diabeticCheckbox = document.getElementById('diabetic');
  const lowSugarCheckbox = document.getElementById('low_sugar');
  const lowOilCheckbox = document.getElementById('low_oil');
  const vegetarianCheckbox = document.getElementById('vegetarian');
  const smartFoodResult = document.getElementById('smartFoodResult');
  const foodQuery = document.getElementById('foodQuery');
  const checkFoodBtn = document.getElementById('checkFoodBtn');
  const availabilityResult = document.getElementById('availabilityResult');
  const recommendedDish = document.getElementById('recommendedDish');
  if (!button || !list) return;

  async function showAvailability() {
    let requested = foodQuery?.value?.trim();
    if (!requested) {
      requested = localStorage.getItem('last_dish') || '';
      if (requested) {
        foodQuery.value = requested;
      }
    }
    if (!requested) {
      availabilityResult.innerHTML = '<p class="warning">Please enter a dish name.</p>';
      recommendedDish.innerHTML = '';
      return;
    }

    const hotels = getAvailableHotelsForDish(requested);
    if (!hotels.length) {
      availabilityResult.innerHTML = `<p>No nearby hotels in our sample menu serve <strong>${requested}</strong>. Try another dish.</p>`;
      const fallback = dishes.sort((a, b) => b.score - a.score)[0];
      recommendedDish.innerHTML = `<p>Recommended: <strong>${fallback.name}</strong> (highest health score in menu)</p>`;
      foodQuery.value = fallback.name;
      localStorage.setItem('last_dish', fallback.name);
      return;
    }

    availabilityResult.innerHTML = `<p><strong>${requested}</strong> is available at: ${hotels.map(h => h.hotel).join(', ')}.</p>`;
    let profile = null;
    try {
      const r = await fetch('/api/profile');
      if (r.ok) profile = await r.json();
    } catch (err) {
      profile = null;
    }

    const suggested = getRecommendedDishByPreference(profile?.preference || 'Both', hotels);
    if (suggested) {
      recommendedDish.innerHTML = `<p>Recommended dish from available hotels: <strong>${suggested.name}</strong> (${suggested.type}). Health score: ${suggested.score}.</p>`;
      foodQuery.value = suggested.name;
      localStorage.setItem('last_dish', suggested.name);
    } else {
      const fallback = dishes.sort((a, b) => b.score - a.score)[0];
      recommendedDish.innerHTML = `<p>No preferred-type recommendation found in available hotels. Try <strong>${fallback.name}</strong>.</p>`;
      foodQuery.value = fallback.name;
      localStorage.setItem('last_dish', fallback.name);
    }
  }

  if (checkFoodBtn) {
    checkFoodBtn.onclick = showAvailability;
  }

  // Auto-fill availability dish from last selected dish in session
  if (foodQuery) {
    const last = localStorage.getItem('last_dish');
    if (last) foodQuery.value = last;
  }

  if (smartFoodBtn) {
    smartFoodBtn.onclick = () => {
      if (!navigator.geolocation) {
        if (smartFoodResult) smartFoodResult.innerHTML = '<p class="warning">Geolocation unsupported.</p>';
        return;
      }
      smartFoodResult.innerHTML = '<p>Finding smart food nearby...</p>';
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const profileResp = await fetch('/api/profile');
          const profile = profileResp.ok ? await profileResp.json() : null;
          const weather = weatherSelect?.value || 'sunny';
          const options = {
            diabetic: diabeticCheckbox?.checked,
            low_sugar: lowSugarCheckbox?.checked,
            low_oil: lowOilCheckbox?.checked,
            vegetarian: vegetarianCheckbox?.checked
          };
          const response = await runSmartFoodNearby(pos.coords.latitude, pos.coords.longitude, weather, profile, options);
          renderSmartFoodResult(response, smartFoodResult);
          if (response?.suggested_dish?.dish && foodQuery) {
            foodQuery.value = response.suggested_dish.dish;
            localStorage.setItem('last_dish', response.suggested_dish.dish);
            showAvailability();
          }
          const applyBtn = document.getElementById('applySuggestedDish');
          if (applyBtn) {
            applyBtn.onclick = () => {
              if (response?.suggested_dish?.dish && foodQuery) {
                foodQuery.value = response.suggested_dish.dish;
                localStorage.setItem('last_dish', response.suggested_dish.dish);
                showAvailability();
              }
            };
          }
        } catch (err) {
          console.error(err);
          smartFoodResult.innerHTML = '<p class="warning">Could not fetch smart food recommendations.</p>';
        }
      }, err => {
        smartFoodResult.innerHTML = `<p class="warning">Location error: ${err.message}</p>`;
      });
    };
  }

  button.onclick = () => {
    if (!navigator.geolocation) {
      list.innerText = 'Geolocation unsupported in this browser.';
      return;
    }
    list.innerText = 'Getting your location...';
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const q = `[out:json][timeout:25];(node[amenity=restaurant](around:5000,${lat},${lon});way[amenity=restaurant](around:5000,${lat},${lon});relation[amenity=restaurant](around:5000,${lat},${lon}););out center;`;
      try {
        const r = await fetch('https://overpass-api.de/api/interpreter', {method: 'POST', body: q});
        const data = await r.json();
        if (!data.elements?.length) {
          list.innerHTML = '<p>No restaurants found nearby right now.</p>';
          return;
        }
        list.innerHTML = data.elements.slice(0, 8).map(e => {
          const name = e.tags?.name || 'Restaurant';
          const lat2 = e.lat ?? e.center?.lat;
          const lon2 = e.lon ?? e.center?.lon;
          const dist = lat2 && lon2 ? distance(lat, lon, lat2, lon2).toFixed(2) : 'N/A';
          return `<div class="card"><h4>${name}</h4><p>Distance: ${dist} km</p><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${lat2},${lon2}" target="_blank">Navigate</a></div>`;
        }).join('');
      } catch {
        list.innerText = 'Could not fetch restaurants. Try again.';
      }
    }, err => {
      list.innerText = `Location error: ${err.message}`;
    });
  };
}

async function initRecipe() {
  const btn = document.getElementById('getRecipe');
  const aiBtn = document.getElementById('getAiRecipe');
  const out = document.getElementById('recipeResult');
  const input = document.getElementById('mealQuery');
  const source = document.getElementById('recipeSource');
  if (!btn || !out || !input || !source) return;
  const lastDish = localStorage.getItem('last_dish');
  if (lastDish) {
    input.value = lastDish;
    await loadRecipe(lastDish, out, source.value);
  }
  btn.onclick = async () => {
    const q = input.value.trim();
    if (!q) {
      out.innerText = 'Enter a meal name.';
      return;
    }
    await loadRecipe(q, out, source.value);
  };

  if (aiBtn) {
    aiBtn.onclick = async () => {
      const q = input.value.trim();
      if (!q) {
        out.innerText = 'Enter a meal name to generate a Gemini recipe.';
        return;
      }
      out.innerHTML = '<div class="card"><p>Generating AI recipe from Gemini...</p></div>';
      try {
        const r = await fetch('/recipe', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({dish: q})
        });
        const j = await r.json();
        if (!r.ok) {
          out.innerHTML = `<div class="card warning"><p>AI recipe failed: ${j.error || 'Server error'}</p></div>`;
          return;
        }
        out.innerHTML = `<div class="card cute"><h3>Gemini AI Recipe: ${j.dish}</h3><pre style="white-space:pre-wrap;word-break:break-word;">${j.recipe}</pre></div>`;
      } catch (err) {
        console.error(err);
        out.innerHTML = '<div class="card warning"><p>Could not contact AI recipe service.</p></div>';
      }
    };
  }
}

const tamilTranslate = {
  Chicken: 'சிக்கன்',
  Salad: 'சாலட்',
  Pasta: 'பாஸ்தா',
  Paneer: 'பன்னீர்',
  Honey: 'தேன்',
  Garlic: 'பூண்டு',
  Tomato: 'தக்காளி',
  Oil: 'எண்ணெய்',
  Salt: 'உப்பு',
  Spinach: 'கீரை',
  Flatbread: 'தோசை/ரொட்டி',
  Vegetables: 'காய்கறிகள்',
  Serve: 'சேவை செய்',
  Cook: 'சமையல்',
  Mix: 'கலப்பு',
  Sauce: 'சாஸ்',
  Greens: 'பச்சை கீரைகள்',
  Nuts: 'கீரை',
  Rice: 'அரிசி'
};

function makeTamil(sentence) {
  if (!sentence) return '';
  return sentence.split(' ').map(w => tamilTranslate[w.replace(/[.,]/g, '')] || w).join(' ');
}

function aiRecipeExtract(query) {
  const core = query.trim();
  if (!core) return null;
  return {
    name: `AI ${core} Recipe`,
    ingredients: ['Main ingredient', 'Spices', 'Oil', 'Salt'],
    instructions: `Cook ${core} with spices and vegetables. Serve hot.`
  };
}

const localRecipeDB = {
  Chicken: {name: 'Honey Garlic Chicken', instructions: 'Pan-sear chicken, add honey garlic sauce, serve with veggies.', ingredients: ['Chicken', 'Honey', 'Garlic']},
  Salad: {name: 'Rainbow Garden Salad', instructions: 'Toss greens, cucumber, tomato, and nuts. Dress with olive oil and lemon.', ingredients: ['Lettuce', 'Tomato', 'Cucumber', 'Nuts']},
  Pasta: {name: 'Creamy Tomato Pasta', instructions: 'Cook pasta, mix with tomato cream sauce and herbs.', ingredients: ['Pasta', 'Tomato', 'Cream', 'Basil']},
  Paneer: {name: 'Paneer Spinach Wrap', instructions: 'Sauté paneer with spinach, wrap in flatbread.', ingredients: ['Paneer', 'Spinach', 'Flatbread']}
};

async function loadRecipe(query, out, source) {
  out.innerText = 'Searching recipe...';
  const sanitized = query.trim();
  if (!sanitized) {
    out.innerHTML = '<div class="card warning"><p>Please enter a meal name.</p></div>';
    return;
  }
  const canonicalKey = sanitized.split(' ')[0].charAt(0).toUpperCase() + sanitized.split(' ')[0].slice(1).toLowerCase();

  if (source === 'local') {
    const recipe = localRecipeDB[canonicalKey];
    if (!recipe) {
      out.innerHTML = `<div class="card warning"><p>No local recipe found for "${sanitized}". Try Chicken, Salad, Pasta, or Paneer.</p></div>`;
      return;
    }
    out.innerHTML = `<div class="card cute"><h3>${recipe.name}</h3><p><em>தமிழ்: ${makeTamil(recipe.name)}</em></p><h4>Ingredients</h4><ul>${recipe.ingredients.map(i => `<li>${i} (${makeTamil(i)})</li>`).join('')}</ul><h4>Instructions</h4><p>EN: ${recipe.instructions}</p><p>TA: ${makeTamil(recipe.instructions)}</p></div>`;
    return;
  }

  if (source === 'ai') {
    const recipe = aiRecipeExtract(sanitized);
    if (!recipe) {
      out.innerHTML = `<div class="card warning"><p>AI could not generate a recipe. Try a different term.</p></div>`;
      return;
    }
    out.innerHTML = `<div class="card cute"><h3>${recipe.name}</h3><p><em>தமிழ்: ${makeTamil(recipe.name)}</em></p><h4>Ingredients</h4><ul>${recipe.ingredients.map(i => `<li>${i} (${makeTamil(i)})</li>`).join('')}</ul><h4>Instructions</h4><p>EN: ${recipe.instructions}</p><p>TA: ${makeTamil(recipe.instructions)}</p></div>`;
    return;
  }

  try {
    const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(sanitized)}`);
    const data = await r.json();
    if (!data.meals) {
      const fallback = localRecipeDB[canonicalKey];
      if (fallback) {
        out.innerHTML = `<div class="card cute"><h3>${fallback.name}</h3><h4>Ingredients</h4><ul>${fallback.ingredients.map(i => `<li>${i}</li>`).join('')}</ul><h4>Instructions</h4><p>${fallback.instructions}</p></div>`;
        return;
      }
      out.innerHTML = `<div class="card warning"><p>No recipes found for "${sanitized}". Try local source.</p></div>`;
      return;
    }
    const meal = data.meals[0];
    const ing = [];
    for (let i = 1; i <= 20; i += 1) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ingredient && ingredient.trim()) ing.push(`<li>${measure || ''} ${ingredient}</li>`);
    }
    out.innerHTML = `<div class="card cute"><h3>${meal.strMeal}</h3><p><em>தமிழ்: ${makeTamil(meal.strMeal)}</em></p><img src="${meal.strMealThumb}" alt="${meal.strMeal}" style="width:100%;border-radius:10px;max-height:260px;object-fit:cover;"/><h4>Ingredients</h4><ul>${ing.join('')}</ul><h4>Instructions</h4><p>EN: ${meal.strInstructions}</p><p>TA: ${makeTamil(meal.strInstructions)}</p></div>`;
  } catch (err) {
    console.error('Recipe load error', err);
    const fallback = localRecipeDB[canonicalKey];
    if (fallback) {
      out.innerHTML = `<div class="card cute"><h3>${fallback.name}</h3><h4>Ingredients</h4><ul>${fallback.ingredients.map(i => `<li>${i}</li>`).join('')}</ul><h4>Instructions</h4><p>${fallback.instructions}</p></div>`;
      return;
    }
    out.innerHTML = '<div class="card warning"><p>Could not load recipe. Please try local source.</p></div>';
  }
}

async function initWarningPage() {
  const container = document.getElementById('warningContainer');
  if (!container) return;
  const latest = localStorage.getItem('latest_warning');
  container.innerHTML = latest ? `<p>${latest}</p><p><a class="btn" href="/dishes">Pick a healthier dish</a></p>` : '<p>No warning recorded yet. Choose a dish first from Dishes page.</p>';
}

async function initProfileUpdate() {
  const form = document.getElementById('profileUpdateForm');
  if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault();
    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      age: data.get('age'),
      height: data.get('height'),
      weight: data.get('weight'),
      blood_pressure: data.get('blood_pressure'),
      diabetes: data.get('diabetes'),
      cholesterol: data.get('cholesterol'),
      cardiac: data.get('cardiac'),
      pregnant: data.get('pregnant'),
      pressure_status: data.get('pressure_status'),
      location: data.get('location'),
      calorie_goal: data.get('calorie_goal'),
      preference: data.get('preference')
    };
    try {
      const r = await fetch('/api/save-profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const msg = document.getElementById('updateMsg');
      if (r.ok) {
        msg.innerText = 'Profile saved successfully.';
        setTimeout(() => window.location.reload(), 400);
      } else {
        const j = await r.json();
        msg.innerText = j.error || 'Save failed.';
      }
    } catch {
      document.getElementById('updateMsg').innerText = 'Network error while saving.';
    }
  };
}

window.addEventListener('DOMContentLoaded', () => {
  initHome();
  initWeatherPage();
  initDishes();
  initRestaurants();
  initRecipe();
  initWarningPage();
  initProfileUpdate();
});
