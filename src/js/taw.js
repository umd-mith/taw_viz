//(function(window, d3, topojson, Promise, _) {

  var canalCentroid = [-79.724052, 9.142276]; //GeoJSON style [long, lat]
  var origins;

  var height = 570,
      width = 960;

  var svg = d3.select("main").append("svg")
    .attr("width", width)
    .attr("height", height);

  var projection = d3.geo.mercator()
    .center([-70.839, 15.368])
    .translate([width/ 2, height/ 2])
    .scale(1950);

  var path = d3.geo.path().projection(projection);

  // Load data
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
    d3.json('https://s3.amazonaws.com/mith-taw/taw-custom.json', function(err, dataMapData) {
      if(err) {
        reject(Error(err));
      } else {
        resolve(dataMapData);
      }
    });
  });

  // Do stuff with data
  csvData.then(function(data) {
    var originCountryCodes = _.without(_.unique(_.pluck(data, 'iso_a2_code')), 'null');
    origins = originCountryCodes;
  }, function(err) {
    window.console.log('Failed to load origin country codes');
  });

  topoJSONData.then(function(data) {
    var features = _.union(
      topojson.feature(data, data.objects.countries).features,
      topojson.feature(data, data.objects.territories).features
    );

    svg.append("path")
      .datum(topojson.feature(data, data.objects.countries))
      .attr('d', path);

    svg.selectAll('.country')
      .data(features)
      .enter().append('path')
        .attr('class', function(d) { return "country " + d.properties.iso_a2; })
        .attr('d', path);

    var allProperties = _.pluck(features, 'properties');
    var highlightCountries = _.intersection(origins, _.pluck(allProperties, 'iso_a2'));

    svg.selectAll('.country-label')
      .data(features)
      .enter().append('text')
        .attr('class', 'place-label')
        .attr('transform', function(d) { return 'translate(' + path.centroid(d) + ')'; })
        .text(function(d) {
          if(_.indexOf(highlightCountries, d.properties.iso_a2) !== -1) {
            return d.properties.name_sort;
          }
        });
  });

//}(window, d3, topojson, Promise, _));
