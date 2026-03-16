from flask import Flask, render_template, request, jsonify, g, redirect, url_for
import sqlite3
import os
import math
import requests
import google.generativeai as genai

app = Flask(__name__)
DATABASE = os.path.join(os.path.dirname(__file__), 'database.db')

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def generate_recipe_from_gemini(dish_name):
    if not GEMINI_API_KEY:
        raise EnvironmentError('Missing GEMINI_API_KEY environment variable.')
    model = genai.GenerativeModel('models/gemini-flash-latest')
    prompt = (
        f"Generate a clean, structured cooking recipe for '{dish_name}'. Include:\n"
        "1) Ingredients list\n"
        "2) Step-by-step cooking instructions\n"
        "3) Preparation time\n"
        "4) Calories estimate\n"
        "5) Cooking tips\n"
        "Respond in plain text with a concise recipe."
    )
    response = model.generate_content(prompt, generation_config={'temperature':0.4, 'max_output_tokens':600})
    recipe_text = ''
    if hasattr(response, 'text') and response.text:
        recipe_text = response.text
    elif hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts') and candidate.content.parts:
            recipe_text = candidate.content.parts[0].text
        elif hasattr(candidate, 'text'):
            recipe_text = candidate.text
    elif hasattr(response, 'candidates') and response.candidates:
        recipe_text = str(response.candidates[0])
    if not recipe_text:
        recipe_text = 'Could not generate a recipe at this time.'
    return recipe_text


MEAL_TIME_FOODS = {
    'morning': ['Oats Porridge', 'Idli Sambar', 'Fruit Smoothie', 'Poha'],
    'daytime': ['Veg Quinoa Bowl', 'Grilled Sandwich', 'Dal Rice', 'Mixed Veg Curry'],
    'afternoon': ['Soup', 'Sprouts Salad', 'Paneer Wrap', 'Chickpea Salad'],
    'night': ['Vegetable Soup', 'Grilled Chicken', 'Paneer Stir Fry', 'Spinach Dal'],
    'snack': ['Nuts Mix', 'Fruit Salad', 'Green Tea', 'Roasted Chana']
}


def get_weather_foods(weather):
    weather_map = {
        'rainy': ['Pakoda', 'Soup', 'Tea', 'Maggi'],
        'sunny': ['Juice', 'Fruit Salad', 'Cold Coffee', 'Smoothie'],
        'cold': ['Hot Chocolate', 'Coffee', 'Noodles', 'Soup'],
        'cloudy': ['Biryani', 'Fried Rice', 'Sandwich', 'Rolls']
    }
    return weather_map.get(weather.lower(), ['Soup', 'Sandwich', 'Tea'])


def get_time_based_foods(category):
    return MEAL_TIME_FOODS.get(category, MEAL_TIME_FOODS['daytime'])


def filter_food_by_health(foods, diabetic, low_sugar, low_oil, vegetarian):
    filtered = []
    high_sugar_foods = {'Juice', 'Fruit Salad', 'Cold Coffee', 'Smoothie', 'Tea', 'Maggi'}
    non_veg_foods = {'Biryani', 'Noodles', 'Rolls'}
    fried_foods = {'Pakoda', 'Fried Rice'}

    for food in foods:
        if diabetic and food in high_sugar_foods:
            continue
        if low_sugar and food in high_sugar_foods:
            continue
        if low_oil and food in fried_foods:
            continue
        if vegetarian and food in non_veg_foods:
            continue
        filtered.append(food)

    return filtered or foods


def meal_category_by_hour(hour):
    if 5 <= hour < 10:
        return 'morning'
    if 10 <= hour < 14:
        return 'daytime'
    if 14 <= hour < 17:
        return 'afternoon'
    if 17 <= hour < 22:
        return 'night'
    return 'snack'


RESTAURANT_MENU = {
    'Sunrise Hotel': ['Veg Quinoa Bowl', 'Grilled Chicken Salad', 'Paneer Wrap'],
    'Lakeview Lodge': ['Veg Quinoa Bowl', 'Fruit Oat Smoothie', 'Paneer Wrap'],
    'City Comfort Inn': ['Grilled Chicken Salad', 'Salmon Teriyaki', 'Fruit Oat Smoothie'],
    'Heritage Hotel': ['Paneer Wrap', 'Veg Quinoa Bowl', 'Fruit Oat Smoothie'],
    'Local Restaurant': ['Grilled Chicken Salad', 'Fruit Oat Smoothie', 'Soup']
}

def get_menu_matches(recommended_foods, menu):
    return [f for f in menu if f in recommended_foods]

def get_nearby_restaurants(latitude, longitude, radius=3000, max_results=8):
    try:
        query = f"[out:json][timeout:25];(node[amenity=restaurant](around:{radius},{latitude},{longitude});way[amenity=restaurant](around:{radius},{latitude},{longitude});relation[amenity=restaurant](around:{radius},{latitude},{longitude}););out center;"
        r = requests.post('https://overpass-api.de/api/interpreter', data=query, timeout=30)
        r.raise_for_status()
        data = r.json()
        elements = data.get('elements', [])[:max_results]
        restaurants = []
        for e in elements:
            name = e.get('tags', {}).get('name', 'Local Restaurant')
            lat = e.get('lat') or e.get('center', {}).get('lat')
            lon = e.get('lon') or e.get('center', {}).get('lon')
            if lat is None or lon is None:
                continue
            dist = distance(float(latitude), float(longitude), float(lat), float(lon))
            menu = RESTAURANT_MENU.get(name, RESTAURANT_MENU.get('Local Restaurant', []))
            restaurants.append({
                'name': name,
                'lat': lat,
                'lon': lon,
                'distance': round(dist, 2),
                'rating': round(4.0 + (hash(name) % 20) * 0.03, 1),
                'menu': menu
            })
        if not restaurants:
            restaurants = [{'name': 'Local Dine', 'lat': latitude, 'lon': longitude, 'distance': 0.2, 'rating': 4.2, 'menu': RESTAURANT_MENU.get('Local Restaurant', [])}]
        return restaurants
    except Exception:
        return [{'name': 'Local Dine', 'lat': latitude, 'lon': longitude, 'distance': 0.5, 'rating': 4.2, 'menu': RESTAURANT_MENU.get('Local Restaurant', [])}]


def generate_food_cards(foods, restaurants, weather):
    cards = []
    weather_tag = f"{weather.capitalize()} Special"
    for i, food in enumerate(foods):
        restaurant = restaurants[i % len(restaurants)]
        health_label = 'Healthy'
        if food in {'Pakoda', 'Fried Rice', 'Maggi'}:
            health_label = 'High Oil'
        if food in {'Juice', 'Cold Coffee', 'Smoothie'}:
            health_label = 'Sugar Alert'

        # menu matches for this recommended dish
        menu_matches = get_menu_matches([food], restaurant.get('menu', []))
        cards.append({
            'food': food,
            'restaurant': restaurant['name'],
            'distance': f"{restaurant['distance']} km",
            'rating': f"{restaurant['rating']}",
            'health_label': health_label,
            'weather_tag': weather_tag,
            'restaurant_menu': restaurant.get('menu', []),
            'menu_matches': menu_matches
        })
    return cards


def parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {'1', 'true', 'yes', 'y', 'on'}
    return False


def distance(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = (lat2 - lat1) * 3.141592653589793 / 180
    dLon = (lon2 - lon1) * 3.141592653589793 / 180
    a = (math.sin(dLat / 2) ** 2) + math.cos(lat1 * 3.141592653589793 / 180) * math.cos(lat2 * 3.141592653589793 / 180) * (math.sin(dLon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


def init_db():
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            height REAL NOT NULL,
            weight REAL NOT NULL,
            blood_pressure TEXT NOT NULL,
            diabetes TEXT NOT NULL,
            cholesterol TEXT NOT NULL,
            cardiac TEXT NOT NULL DEFAULT 'No',
            pregnant TEXT NOT NULL DEFAULT 'No',
            pressure_status TEXT NOT NULL DEFAULT 'Normal',
            location TEXT NOT NULL DEFAULT '',
            calorie_goal INTEGER NOT NULL,
            preference TEXT NOT NULL
        )
    ''')
    # Add missing columns for older DB versions:
    for col_def in [
        ('cardiac','TEXT NOT NULL DEFAULT "No"'),
        ('pregnant','TEXT NOT NULL DEFAULT "No"'),
        ('pressure_status','TEXT NOT NULL DEFAULT "Normal"'),
        ('location','TEXT NOT NULL DEFAULT ""')
    ]:
        col, defn = col_def
        try:
            db.execute(f'ALTER TABLE profile ADD COLUMN {col} {defn}')
        except sqlite3.OperationalError:
            pass
    db.commit()


@app.before_request
def before_request():
    init_db()


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def get_profile_row():
    db = get_db()
    cur = db.execute('SELECT * FROM profile ORDER BY id DESC LIMIT 1')
    row = cur.fetchone()
    return row


def profile_dict(row):
    if not row:
        return None
    return {
        'id': row['id'],
        'name': row['name'],
        'age': row['age'],
        'height': row['height'],
        'weight': row['weight'],
        'blood_pressure': row['blood_pressure'],
        'diabetes': row['diabetes'],
        'cholesterol': row['cholesterol'],
        'cardiac': row['cardiac'] if 'cardiac' in row.keys() else 'No',
        'pregnant': row['pregnant'] if 'pregnant' in row.keys() else 'No',
        'pressure_status': row['pressure_status'] if 'pressure_status' in row.keys() else 'Normal',
        'location': row['location'] if 'location' in row.keys() else '',
        'calorie_goal': row['calorie_goal'],
        'preference': row['preference']
    }


@app.route('/')
def home():
    profile = get_profile_row()
    return render_template('home.html', profile=profile_dict(profile))


@app.route('/weather')
def weather():
    return render_template('weather.html')


@app.route('/dishes')
def dishes():
    return render_template('dishes.html')


@app.route('/restaurants')
def restaurants():
    return render_template('restaurants.html')


@app.route('/recipe', methods=['GET', 'POST'])
def recipe():
    if request.method == 'POST':
        try:
            data = request.get_json(silent=True) or {}
            dish = (data.get('dish') or '').strip()
            if not dish:
                return jsonify({'error': 'Dish name is required.'}), 400

            recipe_text = generate_recipe_from_gemini(dish)
            return jsonify({'dish': dish, 'recipe': recipe_text})
        except EnvironmentError as ee:
            return jsonify({'error': str(ee)}), 500
        except Exception as e:
            return jsonify({'error': 'Could not generate recipe. ' + str(e)}), 500

    return render_template('recipe.html')


@app.route('/warning')
def warning_page():
    return render_template('warning.html')


@app.route('/profile')
def profile():
    profile = get_profile_row()
    return render_template('profile.html', profile=profile_dict(profile))


@app.route('/api/profile', methods=['GET'])
def api_profile():
    profile = get_profile_row()
    if profile is None:
        return jsonify({'error': 'Profile not found'}), 404
    return jsonify(profile_dict(profile))


@app.route('/smart-food-nearby', methods=['GET'])
def smart_food_nearby():
    try:
        lat = request.args.get('latitude') or request.args.get('lat')
        lon = request.args.get('longitude') or request.args.get('lon')
        weather = (request.args.get('weather') or '').strip().lower()
        diabetic = parse_bool(request.args.get('diabetic', 'false'))
        low_sugar = parse_bool(request.args.get('low_sugar', 'false'))
        low_oil = parse_bool(request.args.get('low_oil', 'false'))
        vegetarian = parse_bool(request.args.get('vegetarian', 'false'))

        if not lat or not lon:
            return jsonify({'error': 'latitude and longitude are required'}), 400
        try:
            lat = float(lat)
            lon = float(lon)
        except ValueError:
            return jsonify({'error': 'Invalid latitude/longitude values'}), 400

        if weather not in {'sunny', 'rainy', 'cloudy', 'cold'}:
            return jsonify({'error': 'weather must be one of sunny, rainy, cloudy, cold'}), 400

        weather_foods = get_weather_foods(weather)
        from datetime import datetime
        now = datetime.now()
        meal_category = meal_category_by_hour(now.hour)
        time_foods = get_time_based_foods(meal_category)

        combined_foods = list(dict.fromkeys(weather_foods + time_foods))
        # Night should avoid high-sugar juice options as requested
        if meal_category == 'night' and 'Juice' in combined_foods:
            combined_foods.remove('Juice')
        if meal_category in {'night', 'snack'} and 'Cold Coffee' in combined_foods:
            combined_foods.remove('Cold Coffee')

        filtered_foods = filter_food_by_health(combined_foods, diabetic, low_sugar, low_oil, vegetarian)
        restaurants = get_nearby_restaurants(lat, lon, radius=3000, max_results=8)
        cards = generate_food_cards(filtered_foods, restaurants, weather)
        timestamp = now.strftime('%Y-%m-%d %H:%M:%S')

        # Pick best suggested dish from menu matches (weather foods + restaurant menus)
        suggested = None
        suggested_source = 'weather'
        for restaurant in restaurants:
            menu_match = get_menu_matches(filtered_foods, restaurant.get('menu', []))
            if menu_match:
                route = f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={restaurant['lat']},{restaurant['lon']}&travelmode=driving"
                suggested = {
                    'dish': menu_match[0],
                    'restaurant': restaurant['name'],
                    'distance': restaurant['distance'],
                    'route_url': route
                }
                suggested_source = 'menu'
                break

        if not suggested and filtered_foods:
            default_rest = restaurants[0] if restaurants else {'name': 'Local Dine', 'lat': lat, 'lon': lon, 'distance': 0.0}
            route = f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={default_rest['lat']},{default_rest['lon']}&travelmode=driving"
            suggested = {
                'dish': filtered_foods[0],
                'restaurant': default_rest['name'],
                'distance': default_rest['distance'],
                'route_url': route
            }

        # Add route info for each nearby restaurant as well
        for r in restaurants:
            r['route_url'] = f"https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={r['lat']},{r['lon']}&travelmode=driving"

        return jsonify({
            'weather': weather,
            'timestamp': timestamp,
            'meal_category': meal_category,
            'foods': cards,
            'suggested_dish': suggested,
            'suggested_source': suggested_source,
            'nearby_restaurants': restaurants
        })
    except Exception as e:
        return jsonify({'error': 'Unable to compute smart food recommendations: ' + str(e)}), 500


@app.route('/api/save-profile', methods=['POST'])
def save_profile():
    data = request.get_json() or {}
    required = ['name', 'age', 'height', 'weight', 'blood_pressure', 'diabetes', 'cholesterol', 'cardiac', 'pregnant', 'pressure_status', 'location', 'calorie_goal', 'preference']
    for k in required:
        if k not in data or str(data.get(k)).strip() == '':
            return jsonify({'error': f'Missing {k}'}), 400

    try:
        age = int(data['age'])
        height = float(data['height'])
        weight = float(data['weight'])
        calorie_goal = int(data['calorie_goal'])
    except ValueError:
        return jsonify({'error': 'Numeric values invalid'}), 400

    db = get_db()
    existing = get_profile_row()
    if existing:
        db.execute('''
            UPDATE profile SET name=?, age=?, height=?, weight=?, blood_pressure=?, diabetes=?, cholesterol=?, cardiac=?, pregnant=?, pressure_status=?, location=?, calorie_goal=?, preference=?
            WHERE id=?
        ''', (data['name'], age, height, weight, data['blood_pressure'], data['diabetes'], data['cholesterol'], data['cardiac'], data['pregnant'], data['pressure_status'], data['location'], calorie_goal, data['preference'], existing['id']))
    else:
        db.execute('''
            INSERT INTO profile (name, age, height, weight, blood_pressure, diabetes, cholesterol, cardiac, pregnant, pressure_status, location, calorie_goal, preference)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (data['name'], age, height, weight, data['blood_pressure'], data['diabetes'], data['cholesterol'], data['cardiac'], data['pregnant'], data['pressure_status'], data['location'], calorie_goal, data['preference']))
    db.commit()
    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
