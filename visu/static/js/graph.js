// General params
var UPDATE_TIMEOUT = 2000 // En millisecondes
  , DEFAULT_RECT_WIDTH = 12
  , BORDER = 2 // Must be identical to #graph_values .rect (Used by Graph)
  ;

// Init variables
var start_time= Math.round((new Date().getTime()) / 1000)
  ;


/**
 * Converts energy to price.
 */
function kWh_to_euros(energy) {
	return Math.round(100*(0.2317 + (0.1367 * energy)))/100;  // TODO: Use API here
}

/**
 * Handle graph menu buttons
 */
var Menu = function() {
	var api = {};
	var now_btn = document.getElementById('scale-now')
	  , day_btn = document.getElementById('scale-day')
	  , week_btn = document.getElementById('scale-week')
	  , month_btn = document.getElementById('scale-month')
	  , toggle_unit = document.getElementById('toggle-unit')
	  , mode = ''
	  , unit = ''
	  ;

	api.onunitchange = function(unit, callback){};
	api.onmodechange = function(mode, callback){};

	/**
	 * Add menu listeners
	 */
	api.init = function() {
		now_btn.addEventListener('click', function() {
			api.setMode('now');
		});

		day_btn.addEventListener('click', function() {
			api.setMode('day');
		});

		week_btn.addEventListener('click', function() {
			api.setMode('week');
		});

		month_btn.addEventListener('click', function() {
			api.setMode('month');
		});

		toggle_unit.addEventListener('click', function(ev){api.toggleUnit()});
	}

	/**
	 * Get display mode
	 */
	api.getMode = function() {
		return mode;
	};

	/**
	 * Set display mode.
	 * @param mode: New mode
	 * @param callback: (optional)
	 * @return boolean Whether the mode is accepted.
	 */
	api.setMode = function(new_mode, callback) {
		now_btn.className = '';
		day_btn.className = '';
		week_btn.className = '';
		month_btn.className = '';
		switch(new_mode) {
			case 'now':
				now_btn.className = 'active';
				break;
			case 'day':
				day_btn.className = 'active';
				break;
			case 'week':
				week_btn.className = 'active';
				break;
			case 'month':
				month_btn.className = 'active';
				break;
			default:
				return false;
		}
		if (new_mode != mode) {
			mode = new_mode;
			api.onmodechange(mode, callback);
		}
		return true;
	};

	/**
	 * Set unit.
	 * @param unit: New mode
	 * @param callback: (optional)
	 * @return boolean Whether the unit is accepted.
	 */
	api.setUnit = function(new_unit, callback) {
		switch(new_unit) {
			case 'W':
			case '€':
				break;
			default:
				return false;
		}
		if (new_unit != unit) {
			unit = new_unit;
			api.onunitchange(unit, callback);
		}
		return true;
	};

	/**
	 * Get unit.
	 */
	api.getUnit = function() {
		return unit;
	};

	/**
	 * Get unit string, which designate unit in ascii chars.
	 * This is used for example in the API.
	 * @return unit string.
	 */
	api.getUnitString = function() {
		return {
			'W': 'watts',
			'€': 'euros'
		}[unit];
	};

	/**
	 * Toggle unit
	 * @param callback: (optional)
	 */
	api.toggleUnit = function(callback) {
		if (unit == 'W') {
			api.setUnit('€', callback);
		} else {
			api.setUnit('W', callback);
		}
	};

	return api;
}

/**
 * Gather graph-related functions
 */
var Graph = function() {
	var api = {};

	var graph = document.getElementById('graph')
	  , graph_vertical_axis = document.getElementById('graph_vertical_axis')
	  , graph_values = document.getElementById('graph_values')
	  , now = document.getElementById('now')
	  , now_label = document.getElementById('now_label')
	  , sum, n_values, mean
	  ;

	/**
	 * Function used to convert values received from server
	 */
	api.convertValue = function(v){ return v; };

	api.max_value = 1;
	api.unit = 'W';
	api.type = 'energy';
	api.rect_width = DEFAULT_RECT_WIDTH;
	api.rect_margin = BORDER;

	/**
	 * Set color class name from height (between 0.0 and 1.0)
	 */
	api.colorize = function(t) {
		return (t > 33.3 ? (t >= 66.7 ? 'red' : 'orange') : 'yellow');
	}

	/**
	 * Init graph
	 */
	api.init = function() {
		n_values = 0;

		var graduations = [0.00, 0.33, 0.66, 1.00]; // Graduation positions (relative)
		graduations.map(function (t) {
			api.addVerticalGraduation(api.max_value * t)
		});
		return api;
	}

	/**
	 * Set value disaplyed in overview
	 * @param power: value to display
	 */
	api.setOverview = function(power) {
		now.innerHTML = Math.round(power) + api.unit;
		var height = power / api.max_value * 100;
		now.className = 'blurry ' + api.colorize(height);
	};

	/**
	 * Set label under overview field.
	 * @pram label: new label
	 */
	api.setOverviewLabel = function(label) {
		now_label.innerHTML = label;
	};


	/**
	 * Add a new rect to the graph.
	 * @param power: Power represented by the rect.
	 * @param animated: (optional) Whether the addition of the value must be animated. Default to True
	 */
	api.addRect = function(power, animated) {
		if (animated === undefined) animated = true;
		power = parseInt(api.convertValue(power));

		if (power > api.max_value) {
			api.scaleVertically(power / api.max_value, 100);
		}

		var height = power / api.max_value * 100;
		var div = document.createElement('div');
		var blank = document.createElement('div');
		var color = document.createElement('div');
		graph_values.appendChild(div);
		div.appendChild(blank);
		div.appendChild(color);

		div.className = animated ? 'animated rect' : 'rect';
		div.className += ' ' + api.type;

		var color_class = api.colorize(height);
		color.className = 'color ' + color_class + '-day';
		color.style.height = height + '%';

		blank.className = 'blank';
		blank.style.width = api.rect_width + 'px';
		blank.style.height = (100 - height) + '%';

		++n_values;

		var max_values = api.getWidth();
		if (n_values >= max_values) {
			/*
			graph_values.firstChild.style.width = '0';
			graph_values.firstChild.addEventListener('transitionend', function(){
				graph_values.removeChild(this);
			}, false);
			*/
			graph_values.removeChild(graph_values.firstChild)
		}

		div.style.width = api.rect_width + 'px';
		

		return api;
	}

	/**
	 * Add an horizontal graduation line (so a graduation for the vertical axis)
	 * @param pos: Relative position at which the graduation is placed
	 */
	api.addVerticalGraduation = function(pos) {
		var height = pos * 100;
		var span = document.createElement('span');
		graph_vertical_axis.appendChild(span);

		span.style.bottom = height + '%';
		span.setAttribute('cw-graduation-position', pos);
		api.updateVerticalGraduation(span);

		return api;
	}

	/**
	 * Update displayed value of vertical graduation
	 * @param graduation: graduation to resize
	 */
	api.updateVerticalGraduation = function(graduation) {
		var power = Math.round(graduation.getAttribute('cw-graduation-position') * api.max_value);
		graduation.innerHTML = power + api.unit;
		return api;
	};

	/**
	 * Change single rect vertical scale without modifying the value it represents.
	 * @param rect: rect to resize
	 * @param ratio: Value by which multiply the rect vertical scale
	 */
	api.scaleRect = function(rect, ratio) {
		var color = rect.getElementsByClassName('color')[0]
		  , blank = rect.getElementsByClassName('blank')[0]
		  ;
		height = parseInt(color.style.height.slice(0, -1));
		new_height = height / ratio;
		color.style.height = new_height + '%';
		blank.style.height = (100 - new_height) + '%';

		var color_class = api.colorize(new_height);
		color.className = 'color ' + color_class + '-day';
		return api;
	};

	/**
	 * Change graph vertical scale
	 * @param ratio: Value by which multiply the graph vertical scale
	 * @param round: (optional) Round ratio for new max_value to be integer.
	 */
	api.scaleVertically = function(ratio, round) {
		if (round !== undefined) {
			ratio = Math.ceil(ratio * api.max_value / round) / api.max_value * round;
		}
		api.max_value = api.max_value * ratio;

		var rects = graph_values.children;
		for (var i = 0 ; i < rects.length ; i++) {
			api.scaleRect(rects[i], ratio);
		}
		var graduations = graph_vertical_axis.children;
		for (var i = 0 ; i < graduations.length ; i++) {
			api.updateVerticalGraduation(graduations[i]);
		}
		return api;
	};


	/**
	 * @return the width of the graph in number of values that can be displayed
	 */
	api.getWidth = function() {
		return Math.floor(graph.clientWidth / (api.rect_width + api.rect_margin));
	};

	/**
	 * Clean graph (remove all values)
	 */
	api.clean = function() {
		while (graph_values.firstChild)
			graph_values.removeChild(graph_values.firstChild)
		while (graph_vertical_axis.firstChild)
			graph_vertical_axis.removeChild(graph_vertical_axis.firstChild)
	}

	return api;
};


var PriceGraph = function() {
	var api = Graph();

	api.unit = '€';
	api.type = 'price';

	api.colorize = function(t) {
		return (t > 33.3 ? (t >= 66.7 ? 'dark-blue' : 'blue') : 'light-blue');
	}

	return api;
};


var StaticGraph = function() {
	var api = Graph();

	api.type = 'static';
	api.rect_width = graph.clientWidth / 24;

	return api;
};


/**
 * Provide a way to get new data.
 */
var DataProvider = function() {
	var api = {};
	var req = new XMLHttpRequest();

	/**
	 * Get new data from server.
	 * @param target: Type of data to get (@see API specification)
	 * @param callback: callback that take data as first argument
	 */
	api.get = function(target, callback) {
		req.open('GET', API_URL + target, true);
		req.send();
		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				try {
					res = JSON.parse(req.responseText);
				}
				catch (e) {
					console.log('ERROR', req.responseText);
				}
				callback(res.data);
			}
		}
	}

	return api;
};


/**
 * Core application
 */
var App = function() {
	var api = {};
	var graph = Graph()
	  , provider = DataProvider()
	  , menu = Menu()
	  ;

	menu.onunitchange = function(unit, callback) {
		graph.clean();
		if (unit == '€') {
			graph = PriceGraph();
			location.hash = '#euros';
		} else {
			graph = Graph();
			location.hash = '#watt';
		}
		graph.init();
		api.initValues(callback);
	};

	menu.onmodechange = function(mode, callback) {
		graph.clean();
		switch (mode) {
			case 'now':
				graph = Graph();
				break;
			case 'day':
			case 'week':
			case 'month':
				graph = StaticGraph();
				break;
		}
		graph.init();
		api.initValues(callback);
	};

	/**
	 * Callbacks
	 */
	api.oninit = function(){}; // called when init is done

	/**
	 * Init application.
	 * Add graduation lines
	 */
	api.init = function() {
		menu.init();

		switch (location.hash) {
			case '#euros':
				graph = PriceGraph();
				menu.setUnit('€', function(){
					menu.setMode('now', api.oninit);
				});
				break;

			default:
				menu.setUnit('W', function(){
					menu.setMode('now', api.oninit);
				});
		}
	};

	/**
	 * Init graph values.
	 * @param callback: (optional)
	 */
	api.initValues = function(callback) {
		switch (menu.getMode()) {
			case 'now':
				var target = '/1/get/';
				target += menu.getUnitString();
				target += '/by_id/';
				target += (-graph.getWidth()).toString();
				target += '/0';
				provider.get(target, function(data) {
					data.map(function(value) {
						graph.addRect(value.power, false);
						graph.setOverview(value.power);
					});
					graph.setOverviewLabel('Consommation actuelle');
					if (callback) callback();
				});
				break;

			case 'day':
				var target = '/1/mean/';
				target += menu.getUnitString();
				target += '/daily';
				provider.get(target, function(data) {
					data.hourly.map(function(value) {
						graph.addRect(value.power, false);
					});
					graph.setOverview(data.global);
					graph.setOverviewLabel('Moyenne aujourd\'hui');
					if (callback) callback();
				});
				break;

			case 'week':
			case 'month':
				var target = '/1/mean/';
				target += menu.getUnitString();
				target += '/' + menu.getMode() + 'ly';
				provider.get(target, function(data) {
					data.daily.map(function(value) {
						graph.addRect(value.power, false);
					});
					graph.setOverview(data.global);
					graph.setOverviewLabel(menu.getMode() == 'week' ? 'Moyenne cette semaine' : 'Moyenne ce mois');
					if (callback) callback();
				});
				break;

			default:
				if (callback) callback();
		}


		graph.last_call = Date.now() / 1000.0;
	};

	/**
	 * Go and get new values. This function should be called regularely by the main loop.
	 */
	api.update = function() {
		if (menu.getMode() == 'now') {
			var target = '/1/get/';
			target += menu.getUnitString();
			target += '/by_time/'
			target += graph.last_call + '/' + (graph.last_call = Date.now() / 1000.0);

			provider.get(target, function(data) {
				data.map(function(value) {
					graph.addRect(value.power);
					graph.setOverview(value.power);
				});
			});
		}
	};

	return api;
};



/**
 * Main function
 * Create app, Init it and then update it regularly
 */
function init() {
	var app = App();

	app.oninit = function() {
		app.update();
		setTimeout(arguments.callee, UPDATE_TIMEOUT);
	}

	app.init();
}

window.onload = init();
