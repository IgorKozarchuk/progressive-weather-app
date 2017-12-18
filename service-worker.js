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
				if (key !== cacheName) {
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
	event.respondWith(
		caches.match(event.request).then(function(response) {
			return response || fetch(event.request);
		})
	);
});
