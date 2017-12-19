var dataCacheName = "weatherData-v1";
var cacheName = "weatherPWA-v1";
var filesToCache = [
	"/",
	"index.html",
	"js/app.js",
	"css/main.css",
	"img/clear.png",
	"img/cloudy.png",
	"img/cloudy-scattered-showers.png",
	"img/fog.png",
	"img/ic_add_white_24px.svg",
	"img/ic_refresh_white_24px.svg",
	"img/partly-cloudy.png",
	"img/rain.png",
	"img/scattered-showers.png",
	"img/sleet.png",
	"img/snow.png",
	"img/thunderstorm.png",
	"img/wind.png"
];

self.addEventListener("install", function(event) {
	console.log("[ServiceWorker] Install");
	event.waitUntil(
		caches.open(cacheName).then(function(cache) {
			console.log("[ServiceWorker] Caching app shell");
			return cache.addAll(filesToCache);
		})
	);
});

self.addEventListener("activate", function(event) {
	console.log("[ServiceWorker] Activate");
	event.waitUntil(
		caches.keys().then(function(keyList) {
			return Promise.all(keyList.map(function(key) {
				if (key !== cacheName && key !== dataCacheName) {
					console.log("[ServiceWorker] Removing old cache", key);
					return caches.delete(key);
				}
			}));
		})
	);
	return self.clients.claim();
});

self.addEventListener("fetch", function(event) {
	console.log("[ServiceWorker] Fetch", event.request.url);
	var dataUrl = "https://query.yahooapis.com/v1/public/yql";
	if (event.request.url.indexOf(dataUrl) > -1) {
		/*
		When the request URL contains dataUrl, the app is asking for fresh weather data. In this case, the service worker always goes to the network and then caches the response. This is called the "Cache then network" strategy:
		https://jakearchibald.com/2014/offline-cookbook/#cache-then-network
		*/
		event.respondWith(
			caches.open(dataCacheName).then(function(cache) {
				return fetch(event.request).then(function(response) {
					cache.put(event.request.url, response.clone());
					return response;
				});
			})
		);
	} else {
		/*
		The app is asking for app shell files. In this scenario the app uses the "Cache, falling back to the network" offline strategy:
		https://jakearchibald.com/2014/offline-cookbook/#cache-falling-back-to-network
		*/
		event.respondWith(
			caches.match(event.request).then(function(response) {
				return response || fetch(event.request);
			})
		);
	}
});
