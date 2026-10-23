#!/usr/bin/env python3
"""Read-only checks for the installed OSRM and existing frontend proxy."""
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--region', choices=['fct', 'nigeria'], default='fct')
region = parser.parse_args().region
ORIGIN = 'https://app.freebus.cloud'

def request(url, method='GET'):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method=method), timeout=15) as response:
            body = response.read()
            try:
                data = json.loads(body)
            except ValueError:
                data = None
            return response.status, data
    except urllib.error.HTTPError as error:
        try:
            data = json.loads(error.read())
        except ValueError:
            data = None
        return error.code, data

routes = [
    ('Abuja', [{'lat': 9.0721, 'lng': 7.4246}, {'lat': 9.0647, 'lng': 7.4728}]),
    ('Gwagwalada to Abuja', [{'lat': 8.943, 'lng': 7.083}, {'lat': 9.0647, 'lng': 7.4728}]),
    ('Kuje to Abuja', [{'lat': 8.879, 'lng': 7.228}, {'lat': 9.0647, 'lng': 7.4728}]),
]
if region == 'nigeria':
    routes.append(('Lagos', [{'lat': 6.4281, 'lng': 3.4219}, {'lat': 6.6018, 'lng': 3.3515}]))
for label, points in routes:
    coords = ';'.join(f"{point['lng']},{point['lat']}" for point in points)
    path = '/route/v1/driving/' + coords + '?overview=full&geometries=geojson&steps=false'
    status, raw = request(ORIGIN + '/routing' + path)
    assert status == 200 and raw['code'] == 'Ok', (label, status, raw)
    route = raw['routes'][0]
    geometry = route['geometry']['coordinates']
    assert len(geometry) > 2 and route['distance'] > 0 and route['duration'] > 0
    query = urllib.parse.urlencode({'points': json.dumps(points)})
    status, normalized = request(ORIGIN + '/api/rides/geo/route?' + query)
    assert status == 200, (label, status, normalized)
    assert normalized['points'] == [{'lat': p[1], 'lng': p[0]} for p in geometry]
    assert abs(normalized['distanceMeters'] - route['distance']) <= 1
    assert abs(normalized['durationSeconds'] - route['duration']) <= 1
    print(json.dumps({'route': label, 'status': status, 'points': len(geometry), 'distanceMeters': normalized['distanceMeters'], 'durationSeconds': normalized['durationSeconds']}))

for label, path, method, expected in [
    ('Invalid coordinate rejected', '/api/rides/geo/route?points=%5B%7B%22lat%22%3A100%2C%22lng%22%3A7%7D%2C%7B%22lat%22%3A9%2C%22lng%22%3A7%7D%5D', 'GET', 400),
    ('Other OSRM services not exposed', '/routing/table/v1/driving/7.42,9.07;7.47,9.06', 'GET', 404),
    ('Write method denied', '/routing/route/v1/driving/7.42,9.07;7.47,9.06', 'POST', 403),
    ('Existing app available', '/login', 'GET', 200),
]:
    status, _ = request(ORIGIN + path, method)
    assert status == expected, (label, status, expected)
    print(f'{label}: {status}')

status, data = request(ORIGIN + '/routing/route/v1/driving/-0.1278,51.5074;-0.12,51.51?overview=false')
assert status == 400 and data.get('code') == 'NoSegment', (status, data)
print('Outside-country locations are not silently snapped to Nigeria: NoSegment')

if region == 'fct':
    status, data = request(ORIGIN + '/routing/route/v1/driving/3.4219,6.4281;3.3515,6.6018?overview=false')
    assert status == 400 and data.get('code') == 'NoSegment', (status, data)
    print('Lagos outside FCT dataset: NoSegment')
