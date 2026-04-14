import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) { console.log('ERROR: GOOGLE_MAPS_API_KEY not set in .env'); process.exit(1); }

const HUBS = [
  { name: 'Marathahalli (East)', lat: 12.95594, lng: 77.72582, radiusKm: 6 },
  { name: 'Jayanagar (Central/South)', lat: 12.93257, lng: 77.58352, radiusKm: 10 },
  { name: 'Electronic City', lat: 12.84977, lng: 77.66629, radiusKm: 3 },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function test(place) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(place + ', Bangalore, India')}&key=${KEY}`;
  const res = await axios.get(url);
  if (!res.data.results?.length) { console.log(`${place} → NOT FOUND`); return; }
  const {lat, lng} = res.data.results[0].geometry.location;
  const addr = res.data.results[0].formatted_address;
  let result = '❌ NOT SERVICEABLE';
  for (const h of HUBS) {
    const d = haversineKm(lat, lng, h.lat, h.lng);
    if (d <= h.radiusKm) { result = `✅ SERVICEABLE (${h.name}, ${d.toFixed(1)}km)`; break; }
  }
  const nearest = HUBS.map(h => `${h.name}: ${haversineKm(lat, lng, h.lat, h.lng).toFixed(1)}km`).join(' | ');
  console.log(`${place} → ${result}`);
  console.log(`  Address: ${addr}`);
  console.log(`  Distances: ${nearest}\n`);
}

const places = ['kormangala'];
for (const p of places) await test(p);
