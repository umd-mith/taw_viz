(function(window, d3, topojson, Promise, _) {

  var TAW = {};
  TAW.canalCentroid = { 'type': 'Point', 'coordinates': [-79.724052, 9.142276]}; // GeoJSON so [long, lat]
  TAW.yearIndex = 0;
  TAW.scales = {};

  var countryMap = {
    'BB' : 'Barbados',
    'BR' : 'Brazil',
    'CO' : 'Colombia',
    'CR' : 'Costa Rica',
    'ES' : 'Spain',
    'GP' : 'Guadeloupe',
    'JM' : 'Jamaica',
    'LC' : 'St. Lucia',
    'PE' : 'Peru',
    'MQ' : 'Martinique',
    'MS' : 'Montserrat',
    'NI' : 'Nicaragua',
    'VC' : 'St. Vincent and the Grenadines'
  };

  //////////////////////////////////////
  //                                  //
  // Set up the elements of the page  //
  //                                  //
  //////////////////////////////////////

  var height = 570,
      width = 960,
      padding = (16 * 1.999), // consistent w/type scale
      colors = d3.scale.ordinal().range([
        '#3b220c',
        '#4e8eaa',
        '#f7987f',
        '#d57946',
        '#f3da3c',
        '#53291b',
        '#9f9e6d',
        '#6fa29c',
        '#8e412c',
        '#f2e836',
        '#fec513',
        '#995930',
        '#4d5da9'
      ]);

  var svgMap = d3.select("#maps .viz")
    .append("svg")
      .attr('class', 'map')
      .attr("width", width)
      .attr("height", height);

  var svgLineGraph = d3.select('#maps .viz')
    .append("svg")
      .attr('class', 'component')
      .attr("width", (width / 2))
      .attr("height", (height/ 5));

  var diameter = height;
  var svgBubbleGraph = d3.select('#charts .viz')
    .append("svg")
      .attr('class', 'bubbles')
      .attr('width', (diameter + (padding * 2)))
      .attr('height', (diameter + (padding * 2)));

  /////////////////////////////////
  //                             //
  //        Set up Events        //
  //                             //
  /////////////////////////////////
  var dispatcher = d3.dispatch('csvDataReady', 'load', 'statechange', 'mapUpdate');
  dispatcher.on('csvDataReady', createLineGraph);
  dispatcher.on('load', markCurrentYear);
  dispatcher.on('statechange', updateAllMapComponents);

  d3.select('.arrow.prev')
    .on('click', function() {
      d3.event.preventDefault();
      recessYear();
    });

  d3.select('.arrow.next')
    .on('click', function() {
      d3.event.preventDefault();
      advanceYear();
    });

  /* jshint -W069 */
  var countryLabelAdjustments = {};
  countryLabelAdjustments['Barbados'] = {'dy': '1.1em'};
  countryLabelAdjustments['Brazil'] = {'dx': '1em'};
  countryLabelAdjustments['Colombia'] = {'dy': '1.707em'};
  countryLabelAdjustments['Costa Rica'] = {'dx': '-2.5em', 'dy': '-.5em'};
  countryLabelAdjustments['Grenada'] = {'dx': '.6em', 'dy': '.3em'};
  countryLabelAdjustments['Guadeloupe'] = {'dx': '.8em', 'dy': '.3em'};
  countryLabelAdjustments['Jamaica'] = {'dy': '-1.2em'};
  countryLabelAdjustments['Martinique'] = {'dx': '.6em'};
  countryLabelAdjustments['Montserrat'] = {'dx': '.4em', 'dy': '.2em'};
  countryLabelAdjustments['Nicaragua'] = {'dx': '-.3em', 'dy': '-.4em'};
  countryLabelAdjustments['Panama'] = {'text-anchor': 'end', 'dx': '-.3em', 'dy': '.3em'};
  countryLabelAdjustments['Peru'] = {'dy': '-1.5em'};
  countryLabelAdjustments['St. Lucia'] = {'dx': '.6em'};
  countryLabelAdjustments['St. Vincent and the Grenadines'] = {'dx': '.4em', 'dy': '-.2em'};
  /* jshint +W069 */

  function myLabelStyles(d, i) {
    var lookupKey = d.properties.name_sort;
    if(_.has(countryLabelAdjustments, lookupKey)) {
      var that = d3.select(this);
      _.mapObject(countryLabelAdjustments[lookupKey], function(val, key) {
        that.attr(key, val);
      });
    }
  }

  ///////////////////////
  //                   //
  //     Utilities     //
  //                   //
  ///////////////////////
  function getYear() {
    var n = TAW.yearIndex;
    return TAW.allYears[n];
  }

  function cleanUp(selectors) {
    selectors.forEach(function(s) {
      d3.selectAll(s).remove();
    });
  }

  function advanceYear() {
    if(TAW.yearIndex !== (TAW.allYears.length - 1)) {
      TAW.yearIndex = TAW.yearIndex + 1;
      dispatcher.statechange();
    } else {
      TAW.yearIndex = TAW.allYears.length - 1;
    }
  }

  function recessYear() {
    if(TAW.yearIndex !== 0) {
      TAW.yearIndex = TAW.yearIndex - 1;
      dispatcher.statechange();
    } else {
      TAW.yearIndex = 0;
    }
  }

  function updateAllMapComponents() {
    setYearDisplay();
    markCurrentYear();
    dispatcher.mapUpdate();
  }

  var projection = d3.geo.mercator()
    .center([-66.313, 6.970])
    .translate([width/ 2, height/ 2])
    .scale(900);

  var path = d3.geo.path().projection(projection);

  function setYearDisplay() {
    d3.select('.map-control h1').text(getYear());
  }


  ///////////////////////
  //                   //
  //     Load data     //
  //                   //
  ///////////////////////
  var csvData = new Promise(function(resolve, reject) {
    d3.csv('https://s3.amazonaws.com/mith-taw/taw-photo_metal_subset-for_visualization.csv', function(err, data) {
      if(err) {
        reject(Error(err));
      } else {
        resolve(data);
      }
    });
  });

  var topoJSONData = new Promise(function(resolve, reject) {
    d3.json('https://s3.amazonaws.com/mith-taw/taw-custom.json', function(err, data) {
      if(err) {
        reject(Error(err));
      } else {
        resolve(data);
      }
    });
  });

  ///////////////////////////
  //                       //
  //   Reshape CSV data    //
  //                       //
  ///////////////////////////
  csvData.then(function(data) {
    // Discard records for which we have no data about date of arrival
    var withDates = _.filter(data, function(r) { return r.year_of_arrival !== '';});

    TAW.recordsByYear = d3.nest()
      .key(function(d) { return d.year_of_arrival; })
      .key(function(d) { return d.iso_a2_code; })
      .map(withDates, d3.map);

    var _recordsByCountry = d3.nest()
      .key(function(d) { return d.iso_a2_code; })
      .map(withDates, d3.map);

    // Drop stupid 'null' string value
    if ( _recordsByCountry.remove('null') === true ) {
      TAW.recordsByCountry = _recordsByCountry;
    }

    TAW.countsByYear = d3.nest()
      .key(function(d) { return d.year_of_arrival; })
      .rollup(function(leaves) { return leaves.length; })
      // pass d3.map to so result will have keys() and values() methods
      .map(withDates, d3.map);

    TAW.countsByCountry = d3.nest()
      .key(function(d) { return d.iso_a2_code; })
      .rollup(function(leaves) { return leaves.length; })
      .map(withDates, d3.map);

    //Set the initial value for the map controls once we have the data
    TAW.allYears = TAW.countsByYear.keys();
    setYearDisplay();

    // Set up a scale based on the number of migrants in a given year
    TAW.scales.migrantCountScale = d3.scale.linear()
    .domain([0, d3.max(TAW.countsByYear.values())])
    .range([5,35]);

    dispatcher.csvDataReady();

  }, function(err) {
    window.console.log('Failed to load csv data.');
    window.console.log(err);
  });

  //////////////////////////////
  //                          //
  //       Line Graph         //
  //                          //
  //////////////////////////////
  function createLineGraph() {
    // Set up scales and axes
    var timeBegin = d3.time.format('%Y').parse(d3.min(TAW.countsByYear.keys())),
    timeEnd = d3.time.format('%Y').parse(d3.max(TAW.countsByYear.keys()));

    TAW.scales.xAxisScale = d3.time.scale()
                  .domain([timeBegin, timeEnd])
                  .range([padding, ((width/ 2) - padding)]);

    TAW.scales.yAxisScale = d3.scale.linear()
                  .domain([0, d3.max(TAW.countsByYear.values())])
                  .range([((height/ 5) - padding), padding]);

    var xAxis = d3.svg.axis()
                  .scale(TAW.scales.xAxisScale)
                  .orient('bottom')
                  .ticks(d3.time.years, 5)
                  .tickFormat(d3.time.format('%Y'));

    var yAxis = d3.svg.axis()
                  .scale(TAW.scales.yAxisScale)
                  .ticks((d3.max(TAW.countsByYear.values())/ 5))
                  .orient('left');

    // Draw the axes
    svgLineGraph.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(' + padding + ',0)')
      .call(yAxis);

    svgLineGraph.append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + ((height/ 5) - padding) + ')')
      .call(xAxis);

    var lineGraphLine = d3.svg.line()
                      .x(function(d) {
                        return TAW.scales.xAxisScale(d3.time.format('%Y').parse(d.key));
                      })
                      .y(function(d) { return TAW.scales.yAxisScale(d.value); })
                      .interpolate('cardinal');

    // Draw the line graph
    svgLineGraph.append('path')
      .attr('class', 'chart-line')
      .attr('d', lineGraphLine(TAW.countsByYear.entries().slice(3)));

    dispatcher.load();
  }

  //Draw point for current year
  function markCurrentYear() {
    cleanUp(['.graph-point', '.graph-marker']);

    var point = TAW.countsByYear.entries().filter(function(e) {
      return e.key === getYear();
    });

    svgLineGraph.append("circle")
      .data(point)
      .attr('class', 'graph-point')
      .attr('cx', function(d) { return TAW.scales.xAxisScale(d3.time.format('%Y').parse(d.key)); })
      .attr('cy', function(d) { return TAW.scales.yAxisScale(d.value); })
      .attr('r', 3);
  }

  topoJSONData.then(function(data) {
    // Combine the contents of geodata features arrays for easy access
    var features = _.union(
      topojson.feature(data, data.objects.countries).features,
      topojson.feature(data, data.objects.territories).features
    );

    // Filter down the geodata to the subset of countries for which we have worker records
    var featureSubset = _.filter(features, function(feat) {
      return _.indexOf(TAW.recordsByCountry.keys(), feat.properties.iso_a2) !== -1;
    });

    TAW.geoDataByCountry = d3.nest()
      .key(function(d) { return d.properties.iso_a2; })
      .map(featureSubset, d3.map);

    //////////////////////
    //                  //
    //     Base Map     //
    //                  //
    //////////////////////
    function drawBaseMap() {
      svgMap.append("path")
        .datum(topojson.feature(data, data.objects.countries))
        .attr('d', path);

      svgMap.append("path")
        .datum(topojson.feature(data, data.objects.territories))
        .attr('d', path);

      // Create paths for all countries + territories in the dataset
      svgMap.selectAll('.country')
        .data(features)
        .enter().append('path')
          .attr('class', function(d) { return "country " + d.properties.iso_a2.toLowerCase(); })
          .attr('d', path);
    }

    drawBaseMap();


    ///////////////////////////
    //                       //
    //     Migration Map     //
    //                       //
    ///////////////////////////
    function getMapDataForYear() {
      var year = getYear();
      var countriesYear = TAW.recordsByYear.get(year).keys();
      var subset = [];
      countriesYear.forEach(function(country) {
        var datum = TAW.geoDataByCountry.get(country);
        if(datum) {
          subset.push(datum[0]);
        }
      });
      return subset;
    }

    function drawMap(dataset) {
      drawMigrationPaths(dataset);
      drawCircles(dataset);
      labelCountries(dataset);
    }

    function drawMigrationPaths(dataset) {
      var pathLine = d3.svg.line();

      svgMap.selectAll('.arc')
        .data(getLineEndpoints(svgMap.selectAll('.country').data(dataset)))
        .enter().append('path')
          .attr('class', 'arc')
          .attr('d', pathLine);
    }

    function drawCircles(dataset) {
      svgMap.selectAll('circle')
        .data(dataset)
        .enter().append('circle')
          .attr('class', 'map-circle')
          .attr('cx', function(d) { return path.centroid(d)[0]; })
          .attr('cy', function(d) { return path.centroid(d)[1]; })
          .attr('r', function(d) {
            var year = getYear();
            var yearRecords = TAW.recordsByYear.get(year);
            if (yearRecords.has(d.properties.iso_a2)) {
              var count = yearRecords.get(d.properties.iso_a2).length;
              return TAW.scales.migrantCountScale(count);
            } else {
              window.console.log('Could not find country information for year');
            }
          })
          .style("fill", 'yellow')
          .style("opacity", 0.75);
    }

    // For clarity, only label countries of interest
    function labelCountries(dataset) {
      svgMap.selectAll('.country-label')
        .data(dataset)
        .enter().append('text')
          .attr('class', 'place-label')
          .attr('transform', function(d) { return 'translate(' + path.centroid(d) + ')'; })
          .each(myLabelStyles)
          .text(function(d) { return d.properties.name_sort; });
    }

    function getLineEndpoints(selection) {
      var pointArr = [];
      selection.each(function(d, i) {
        var countryCentroid = path.centroid(d); // projected in pixels
        pointArr.push([
          path.centroid(TAW.canalCentroid),
          countryCentroid
        ]);
      });

      return pointArr;
    }

    function showTotals() {
      cleanUp(['.place-label', '.message', '.arc', '.map-circle']);
      drawMigrationPaths(featureSubset);

      // TODO: rewrite to use drawCircles above
      svgMap.selectAll('circle')
        .data(featureSubset)
        .enter().append('circle')
          .attr('class', 'map-circle')
          .attr('cx', function(d) { return path.centroid(d)[0]; })
          .attr('cy', function(d) { return path.centroid(d)[1]; })
          .attr('r', function(d) {
            return TAW.scales.migrantCountScale(TAW.countsByCountry.get(d.properties.iso_a2));
          })
          .style("fill", function(d, i) {
            return colors(i);
          })
          .style("opacity", 0.75)
          .on('mouseover', function(){
            d3.select(this)
              .attr('stroke', '#f7f7f9')
              .attr('stroke-width', '2px');
          })
          .on('mouseout', function() {
            d3.select(this)
              .attr('stroke', 'none')
              .attr('stroke-width', '0');
          })
          .append('title')
            .text(function(d) { return d.properties.name_sort; });

        cleanUp(['.graph-point']);
    }

    function showLacuna() {
      svgMap.append('text')
          .attr('class', 'message')
          .attr('x', projection(projection.center())[0])
          .attr('y', projection(projection.center())[1])
          .attr('text-anchor', 'middle')
          .text('No country-of-origin data available');
    }

    function updateMap() {
      cleanUp(['.place-label', '.message', '.arc', '.map-circle']);
      var newData = getMapDataForYear();
      window.console.log(newData);
      if( newData.length >= 1 ) {
        drawMap(newData);
      } else {
        showLacuna();
      }
    }


    var geoDataSubset = getMapDataForYear();
    drawMap(geoDataSubset);

    dispatcher.on('mapUpdate', updateMap);

    d3.select('.total')
      .on('click', function() {
        d3.event.preventDefault();
        d3.select('.map-control h1').text('All Years');
        showTotals();
      });

  }, function(err) { 'Failed to load map data'; });

  /////////////////////////
  //                     //
  //     Bubble Chart    //
  //                     //
  /////////////////////////

  csvData.then(function(data) {

    var pack = d3.layout.pack()
      .sort(null)
      .size([(diameter - padding), (diameter - padding)])
      .value(function(d) { return d.size; });

    function createBubbleChart(dataset) {
      // Bubble chart will use worker data nested by country

      // for every worker record, we want a data structure like:
      // { name: workerName, size: 1 }

      // these should be nested inside a node for each country like so:
      // { name: countryName, country: true, size: children.length children: [
      //    { name: workerName1, size: 1 },
      //    { name: workerName2, size: 1 },
      //    { name: workerName3, size: 1 },
      //  ]
      // }

      // under a root node
      // {children: []}
      var countryNodes = dataset.map(function(d) {
        var country = {
          name: countryMap[d.key],
          size: (d.value.length * d.value.length)
        };
        country.children = d.value.map(function(c) {
            return {
              id: c.worker_id,
              address: c.isthmian_address,
              color: c.color,
              literacy: c.literacy,
              marital_status: c.marital_status,
              name: c.name,
              occupation: c.occupation_normalized,
              origin: c.iso_a2_code,
              origin_label: countryMap[c.iso_a2_code],
              year_of_arrival: c.year_of_arrival,
              size: 1
            };
          });
        country.children.push({
          name: d.key,
          country: true,
          //size: d.value.length
          size: TAW.countsByCountry.get(d.key)
        });
        return country;
      });

      cleanUp(['.circle-pack', '.bubble-label']);

      var node = svgBubbleGraph.append('g')
        .attr('class', 'circle-pack')
        .datum({name: 'root', children: countryNodes}).selectAll('.node')
        .data(pack.nodes)
        .enter().append('g')
          .attr('class', function(d){ return d.children ? 'node': 'leaf node'; })
          .attr('transform', function(d){ return 'translate(' + d.x + ',' + d.y + ')'; });

      node.filter(function(d) { return !d.country; })
        .append('circle')
        .attr('r', 0)
        .transition()
          .duration(2000)
            .attr('r', function(d) { return d.r; });

      node.filter(function(d) { return d.depth === 2 && d.country; })
        .append('text')
        .attr('y', function(d){ return + d.r*0.3; })
        //.attr('x', function(d){ return + d.r*0.2; })
        .attr('class', 'bubble-label')
        .attr('text-anchor', 'middle')
        .style('font-size', function(d){ return d.r*0.5; })
        .text(function(d) { return countryMap[d.name]; });

      node.filter(function(d) { return !d.children && !d.country; })
        .on('click.page', setWorkerInfoHtml)
        .on('click.script', setWorkerInfoJs)
        .on('focus', function() {
          d3.select(this)
            .attr('class', 'selected-worker');
          })
          .on('mouseover', function() {
            var selection = d3.select(this);
            selection.attr('class', 'selected-worker');
            })
          .on('mouseout', function() {
            d3.select(this)
              .call(resetLeafStyles);
            })
        .append('title')
          .text(function(d) {
            var job = d.occupation;
            if(job !== null) {
              return d.name + ', ' + job;
            } else {
              return d.name;
            }
          });

      if( !d3.select('.worker-info').empty() ) {
        var workerId = d3.select('.worker-info').attr('id');
        d3.selectAll('.leaf').filter(function(d) { return d.id === workerId.substring(1); })
          .attr('class', 'selected-worker');
      }
    }

    function setWorkerInfoHtml(d) {
      var source = d3.select('#worker-template').html();
      var template = Handlebars.compile(source);
      var workerKeys = [
                        'name',
                        'origin',
                        'origin_label',
                        'occupation',
                        'year_of_arrival',
                        'address',
                        'color',
                        'literacy',
                        'marital_status',
                        'id'
                      ];
      var workerData = _.pick(d, workerKeys);
      var nonNullKeys = _.mapObject(workerData, function(val, key) {
        if(val === 'null') {
          return '';
        } else {
          return val;
        }
      });
      var html = template(nonNullKeys);
      d3.select('.worker-info-container').html(html);

      // Buttons don't exist until this point so event listener has to go here:
      var buttons = d3.selectAll('.worker-info button');
      buttons.on('click', filterWorkers);
    }

    function filterWorkers() {
      var filterKey = this.dataset.key,
      filterVal = TAW.currentWorker[filterKey];

      var filteredDataset = TAW.bubbleNodes.filter(function(countryObj) {
        countryObj.value = countryObj.value.filter(function(recordObj) {
          return recordObj[filterKey] === TAW.currentWorker[filterKey];
        });
        return countryObj;
      });

      TAW.bubbleNodes = filteredDataset;
      draw();
    }

    function setWorkerInfoJs(d) {
      TAW.currentWorker = d;
    }

    function resetLeafStyles(selection) {
      selection
        .attr('class', 'leaf node')
        // Have to manually reset styles
        .attr('fill', '#e2c044')
        .attr('stroke', '#373a3c')
        .attr('stroke-width', '1px');
    }

    function draw() {
      // window.console.log(TAW.bubbleNodes);
      createBubbleChart(TAW.bubbleNodes);
    }

    TAW.bubbleNodes = TAW.recordsByCountry.entries();
    draw();

    // Reset button
    d3.select('#charts button').on('click', function() {
      d3.event.preventDefault();
      cleanUp(['.worker-info']);
      TAW.bubbleNodes = TAW.recordsByCountry.entries();
      draw();
    });

  });

}(window, d3, topojson, Promise, _));
