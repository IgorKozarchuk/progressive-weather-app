(function() {
	"use strict";

	var app = {
		isLoading: true,
		visibleCards: {},
		selectedCities: [],
		spinner: document.querySelector(".loader"),
		cardTemplate: document.querySelector(".cardTemplate"),
		container: document.querySelector(".main"),
		addDialog: document.querySelector(".dialog-container"),
		removedDialog: document.querySelector(".cityRemoved-dialog-container"),
		daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
	};

	// Event listeners

	document.getElementById("btn-refresh").addEventListener("click", function() {
		app.updateForecasts();
	});

	document.getElementById("btn-add").addEventListener("click", function() {
		app.toggleAddDialog(true);
	});

	document.getElementById("btn-addCity").addEventListener("click", function() {
		// add newly selected city
		var select = document.getElementById("selectCityToAdd");
		var selected = select.options[select.selectedIndex];
		var key = selected.value;
		var label = selected.textContent;
		if (!app.selectedCities) {
			app.selectedCities = [];
		}
		if (app.selectedCities.length) { // if city list is not empty, check if city hasn't been added already, and if not add city
			for(var i = 0; i < app.selectedCities.length; i++) {
				if (app.selectedCities[i].label !== label && i === app.selectedCities.length - 1) {
					app.getForecast(key, label);
					app.selectedCities.push({key: key, label: label});
					app.saveSelectedCities();
				}
			}
		} else { // if city list is empty, add city
			app.getForecast(key, label);
			app.selectedCities.push({key: key, label: label});
			app.saveSelectedCities();
		}
		app.toggleAddDialog(false);
	});

	document.getElementById("btn-addCancel").addEventListener("click", function() {
		// close the add new city dialog
		app.toggleAddDialog(false);
	});

	// delegate event listener to make it work with dynamic content
	// https://davidwalsh.name/event-delegate
	document.getElementById("body").addEventListener("click", function(event) {
		if (event.target && event.target.className === "deleteCardBtn") {
			app.removeCity(event.target.parentNode);
			app.toggleRemovedDialog();
		}
	});

	app.addDialog.addEventListener("click", function(event) {
		if (event.target === this) {
			app.toggleAddDialog(false);
		}
	});

	// Update UI

	// toggle the visibility of the add new city dialog
	app.toggleAddDialog = function(visible) {
		if (visible) {
			app.addDialog.classList.add("dialog-container-visible");
		} else {
			app.addDialog.classList.remove("dialog-container-visible");
		}
	};
	// toggle the visibility of the city removed dialog
	app.toggleRemovedDialog = function() {
		app.removedDialog.classList.add("cityRemoved-dialog-container-visible");
		setTimeout(function() {
			app.removedDialog.classList.remove("cityRemoved-dialog-container-visible");
			location.reload(); // !!! to make the card apper after removing and adding the same city again
		}, 1500);
	};
	// Update a weather card with the latest weather forecast. If the card doesn't already exist, it's cloned from the template.
	app.updateForecastCard = function(data) {
		var dataLastUpdated = new Date(data.created);
		var sunrise = data.channel.astronomy.sunrise;
		var sunset = data.channel.astronomy.sunset;
		var current = data.channel.item.condition;
		var humidity = data.channel.atmosphere.humidity;
		var wind = data.channel.wind;

		var card = app.visibleCards[data.key];
		if (!card) {
			card = app.cardTemplate.cloneNode(true);
			card.classList.remove("cardTemplate");
			card.querySelector(".location").textContent = data.label;
			card.removeAttribute("hidden");
			app.container.appendChild(card);
			app.visibleCards[data.key] = card;
		}

		// verify the data provided is newer than what's already visible on the card, if it's not bail, if it is, continue and update the time saved in the card
		var cardLastUpdatedElem = card.querySelector(".card-last-updated");
		var cardLastUpdated = cardLastUpdatedElem.textContent;
		if (cardLastUpdated) {
			cardLastUpdated = new Date(cardLastUpdated);
			// bail if the card has more recent data then the data
			if (dataLastUpdated.getTime() < cardLastUpdated.getTime()) {
				return;
			}
		}
		cardLastUpdatedElem.textContent = data.created;

		card.querySelector(".description").textContent = current.text;
		card.querySelector(".date").textContent = current.date;
		// !!! clear initial default class
		card.querySelector(".current .icon").classList.remove("clear-day", "rain", "thunderstorms", "snow", "fog", "windy", "cloudy", "partly-cloudy-day");
		card.querySelector(".current .icon").classList.add(app.getIconClass(current.code));
		card.querySelector(".current .temperature .value").textContent = Math.round(current.temp);
		card.querySelector(".current .sunrise").textContent = sunrise;
		card.querySelector(".current .sunset").textContent = sunset;
		card.querySelector(".current .humidity").textContent = Math.round(humidity) + "%";
		card.querySelector(".current .wind .value").textContent = Math.round(wind.speed);
		card.querySelector(".current .wind .direction").textContent = wind.direction;

		var nextDays = card.querySelectorAll(".future .oneday");
		var today = new Date();
		today = today.getDay();
		for (var i = 0; i < 7; i++) {
			var nextDay = nextDays[i];
			var daily = data.channel.item.forecast[i];
			if (daily && nextDay) {
				nextDay.querySelector(".date").textContent = app.daysOfWeek[(i + today) % 7];
				// !!! clear initial default class
				nextDay.querySelector(".icon").classList.remove("clear-day", "rain", "thunderstorms", "snow", "fog", "windy", "cloudy", "partly-cloudy-day");
				nextDay.querySelector(".icon").classList.add(app.getIconClass(daily.code));
				nextDay.querySelector(".temp-high .value").textContent = Math.round(daily.high);
				nextDay.querySelector(".temp-low .value").textContent = Math.round(daily.low);
			}
		}
		if (app.isLoading) {
			app.spinner.setAttribute("hidden", true);
			app.container.removeAttribute("hidden");
			app.isLoading = false;
		}
	};

	// Dealing with the model

	/*
	Get a forecast for a specific city and updates the card with the data.
	getForecast() first checks if the weather data is in the cache. If so, it gets that data and populates the card with the cached data.
	Then getForecast() goes to the network for fresh data. If the network request goes through, the card gets updated a second time with the freshest data.
	*/

	app.getForecast = function(key, label) {
		var statement = "SELECT * FROM weather.forecast WHERE woeid=" + key + " and u='c'";
		var url = "https://query.yahooapis.com/v1/public/yql?format=json&q=" + statement;
		
		// cache logic
		if ("caches" in window) {
			/*
			Check if the service worker has already cached this city's weather data. If the service worker has the data, then display the cached data while the app fetches the latest data.
			*/
			caches.match(url).then(function(response) {
				if (response) {
					response.json().then(function updateFromCache(json) {
						var results = json.query.results;
						results.key = key;
						results.label = label;
						results.created = json.query.created;
						app.updateForecastCard(results);
					});
				}
			});
		}

		// fetch the latest data
		var request = new XMLHttpRequest();
		request.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				var response = JSON.parse(request.response);
				var results = response.query.results;
				results.key = key;
				results.label = label;
				results.created = response.query.created;
				app.updateForecastCard(results);
			} else {
				// return the initial weather forecast since no data available
				app.updateForecastCard(initialWeatherForecast); // !!! if uncommented default city appers again after removing
			}
		};
		request.open("GET", url);
		request.send();
	};

	// iterate all of the cards and attempt to get the latest forecast data
	app.updateForecasts = function() {
		var keys = Object.keys(app.visibleCards);
		keys.forEach(function(key) {
			app.getForecast(key);
		});
	};

	// Save list of cities to localStorage
	app.saveSelectedCities = function() {
		var selectedCities = JSON.stringify(app.selectedCities);
		localStorage.selectedCities = selectedCities;
	};

	// Remove city card
	app.removeCity = function(city) {
		// get textContent of a div with class "location" in the city card
		var cityLabelElem = null;
		for (var i = 0; i < city.childNodes.length; i++) {
			if (city.childNodes[i].className == "location") {
				cityLabelElem = city.childNodes[i];
				break;
			}
		}
		var keyToDelete = cityLabelElem.textContent;
		// search for the city in selectedCities array and remove it if textContent == label
		for (var i = 0; i < app.selectedCities.length; i++) {
			if (app.selectedCities[i].label == keyToDelete) {
				app.selectedCities.splice(i, 1);
				break;
			}
		}
		// save changes to localStorage and remove the card from the DOM
		app.saveSelectedCities();
		city.parentNode.removeChild(city);
		return false;
	};

	app.getIconClass = function(weatherCode) {
		// weather codes: https://developer.yahoo.com/weather/documentation.html#codes
		weatherCode = parseInt(weatherCode);
		switch (weatherCode) {
			case 25: // cold
			case 32: // sunny
			case 33: // fair (night)
			case 34: // fair (day)
			case 36: // hot
			case 3200: // not available
				return "clear-day";
			case 0: // tornado
			case 1: // tropical storm
			case 2: // hurricane
			case 6: // mixed rain and sleet
			case 8: // freezing drizzle
			case 9: // drizzle
			case 10: // freezing rain
			case 11: // showers
			case 12: // showers
			case 17: // hail
			case 35: // mixed rain and hail
			case 40: // scattered showers
				return "rain";
			case 3: // severe thunderstorms
			case 4: // thunderstorms
			case 37: // isolated thunderstorms
			case 38: // scattered thunderstorms
			case 39: // scattered thunderstorms (not a typo)
			case 45: // thundershowers
			case 47: // isolated thundershowers
				return "thunderstorms";
			case 5: // mixed rain and snow
			case 7: // mixed snow and sleet
			case 13: // snow flurries
			case 14: // light snow showers
			case 16: // snow
			case 18: // sleet
			case 41: // heavy snow
			case 42: // scattered snow showers
			case 43: // heavy snow
			case 46: // snow showers
				return "snow";
			case 15: // blowing snow
			case 19: // dust
			case 20: // foggy
			case 21: // haze
			case 22: // smoky
				return "fog";
			case 24: // windy
			case 23: // blustery
				return "windy";
			case 26: // cloudy
			case 27: // mostly cloudy (night)
			case 28: // mostly cloudy (day)
			case 31: // clear (night)
				return "cloudy";
			case 29: // partly cloudy (night)
			case 30: // partly cloudy (day)
			case 44: // partly cloudy
				return "partly-cloudy-day";
		}
	};

	/*
	Fake weather data that is presented when the user first uses the app, or when the user has not saved any cities. See startup code for more discussion.
	*/
	var initialWeatherForecast = {
		key: "924938",
		label: "Kyiv, UA",
		created: "2017-12-05T01:00:00Z",
		channel: {
			astronomy: {
				sunrise: "7:41 am",
				sunset: "3:55 pm"
			},
			item: {
				condition: {
					text: "Windy",
					date: "Tue, 05 Dec 2017 09:00 PM EDT",
					temp: 5,
					code: 24
				},
				forecast: [
					{code: 44, high: 10, low: 3},
					{code: 44, high: 8, low: 2},
					{code: 4, high: 9, low: 1},
					{code: 24, high: 7, low: 0},
					{code: 24, high: 5, low: -2},
					{code: 44, high: 6, low: -1},
					{code: 44, high: 3, low: -3},
				]
			},
			atmosphere: {
				humidity: 56
			},
			wind: {
				speed: 25,
				direction: 195
			}
		}
	};

	// TODO uncomment line below to test app with fake data
	// app.updateForecastCard(initialWeatherForecast);

	/* Code required to start the app
	NOTE: To simplify this codelab, we've used localStorage.
	localStorage is a synchronous API and has serious performance implications. It should not be used in production applications!
	Instead, check out IDB (https://www.npmjs.com/package/idb) or SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c) */

	app.selectedCities = localStorage.selectedCities;
	if (app.selectedCities) {
		app.selectedCities = JSON.parse(app.selectedCities);
		app.selectedCities.forEach(function(city) {
			app.getForecast(city.key, city.label);
		});
	} else {
		/* The user is using the app for the first time, or the user has not saved any cities, so show the user some fake data.
		A real app in this scenario could guess the user's location via IP lookup and then inject that data into the page. */
		app.updateForecastCard(initialWeatherForecast);
		app.selectedCities = [
			{
				key: initialWeatherForecast.key,
				label: initialWeatherForecast.label
			}
		];
		app.saveSelectedCities();
	}

	// Service worker
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker
			.register("./service-worker.js")
			.then(function() {
				console.log("Service Worker Registered");
			});
	}

})();