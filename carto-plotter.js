// set defaults
var my = {
  "className": "dot",
  "projection": d3.geo.albers(),
  "strokeWidth": 1,
  "stroke": "#ffffff",
  "fill": "#000000",
  "width": 960,
  "height": 550,
  "friction": 0.5,
  "charge": -0.5,
  "chargeDistance": 10,
  "force": null,
  // Required Settings
  "data": null,
  "parentElement": null
};

var svg,
    artistG,
    debugG,
    cartoG,
    cartogram,
    projection = d3.geo.kavrayskiy7()
                   .scale(170)
                   .translate([my.width/2, my.height/2])
                   .precision(0.1),
    dotSize =    d3.scale.linear(),
    color =      d3.scale.ordinal()
                    .domain([0,3])
                    .range(colorbrewer.Greys[4]),
                    //.range(["#eee", "#ddd", "#ccc", "#bbb"]),
    countries,
    neighbors,
    countryData,
    nodes,
    forceData,
    artistData,
    zoom,
    force = d3.layout.force();

// Set the zoom behavior defaults
zoom = d3.behavior.zoom()
  .scale(1)
  .translate([0,0])
  .on("zoom", zoomed);

cartogram = d3.cartogram()
  .projection(projection)
  .value(function(d) {
    return d.playcount;
  })
  ;

svg = d3.select(".data-viz")
    .append("svg")
    .attr({ width: my.width,
            height: my.height })
    .call(zoom)
    ;

debugG = svg.append("g").attr("class", "geometry");
artistG = svg.append("g").attr("class", "artists");
cartoG = svg.append("g").attr("class", "distored-geometry");

queue(1)
  .defer(loadMapData)
  .defer(loadArtistData)
  .defer(updateMapArea);


function loadMapData(callback) {
  d3.json("./geo_data/world-admin-0.json", function(err, json) {
    if (err) return console.warn(err);

    //regions = topojson.feature(json, json.objects.regions).features,
    countries = topojson.feature(json, json.objects.countries).features;
    neighbors = topojson.neighbors(json.objects.countries.geometries);

    console.log(countries);
    //console.log(neighbors);

    countries.forEach(function(v, i) {
      v.playcount = 0;
    });

    var geo_path = d3.geo.path()
      .projection(projection)
      ;

    debugG.selectAll(".country")
        .data(countries)
      .enter()
        .append("path")
        .attr("d", geo_path)
        .attr({ "class": "country",
                "stroke": "#ccc",
                "opacity": 0 })
        .style("fill", function(d, i) {
          return color(d.color = d3.max(neighbors[i], function(n) {
            return countries[n].color;
          }) + 1 | 0);
        })
        ;
  });

  callback(null, true);
}

function loadArtistData(callback) {
  d3.json("./final_data.json", function(err, json) {
    if (err) return console.warn(err);
    init(json);
  });

  callback(null, true);
}

function updateMapArea(callback) {
  var features = cartogram(countries);

  cartoG.selectAll("path")
    .data(features)
    .enter()
    .append("path")
      .attr("d", cartogram.path);

  callback(null, true);
}

function init(data) {
    dotSize
      //.domain([0, 1000])
      .domain([0, d3.max(data, function(d) { return +d.playcount; })])
      .range([1,10]);

  artistData = data.map(function(d) {
    if (d.geocode) {
      var point = projection([d.geocode.lng, d.geocode.lat]);

      if (point) {
        return {
          name: d.name,
          lat: d.geocode.lat,
          lng: d.geocode.lng,
          x: point[0],
          y: point[1],
          x0: point[0],
          y0: point[1],
          playcount: +d.playcount,
          radius: dotSize(+d.playcount),
          genres: d.genres,
          discovery_rank: d.discovery_rank,
          familiarity: d.familiarity,
          hotttnesss: d.hotttnesss,
          years_active: d.years_active,
          hotttnesss_rank: d.hotttnesss_rank,
          familiarity_rank: d.familiarity_rank,
          id: d.id,
          artist_location: d.artist_location
        };
      }
      else {
        //console.log("point outside of projection");
        //console.log(d);
        return { noGeocode: true };
      }
    }
    else {
      //console.log("no geocode");
      //console.log(d);
      return { noGeocode: true };
    }
  });

  // Remove items without x,y from forceData
  forceData = artistData.filter(function(d) {
    if (d.noGeocode !== true)
      return d;
    else
      return null;
  });

  console.log(forceData);

  force
    .gravity(0)
    .charge(0.00000001)
    .chargeDistance(0.00000001)
    .friction(0.7)
    .nodes(forceData)
    .size([my.width, my.height])
    .on("tick", tick)
    //.start()
    ;

  nodes = artistG.selectAll("circle")
      .data(forceData)
    .enter()
      .append("path")
      .attr("d", function(d) {
        var x = d.x,
            y = d.y,
            rad = dotSize(d.playcount);
        return polygonPath(x, y, rad, 6);
      })
      .attr({
        "stroke": "#000",
        "stroke-opacity": 0.5,
        "stroke-weight": 1,
        "opacity": 1,
        "class": "artist"})
      .attr("fill", function(d) { return getArtistColor(d); } )
      .on("click", function(d) { console.log(d); })
      ;

  force.start();
  for (var i = 100; i > 0; --i) force.tick();
  force.stop();

  console.log(countries);
}

function getArtistColor(artist) {
  var artistColor;
  countries.forEach(function(v, i) {
    var aCountry = artist.artist_location.country,
        vBrk = v.properties.BRK_NAME,
        vAdmin = v.properties.ADMIN,
        vFormal = v.properties.FORMAL_EN;

    if (vBrk == aCountry || vAdmin == aCountry || vFormal == aCountry) {
      artistColor = color(v.color);
      v.playcount += +artist.playcount;
    }
  });
  return artistColor;
}

function zoomed() {
  svg.selectAll("path")
    .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
}


function tick(e) {
  var q = d3.geom.quadtree(forceData),
      i = 0,
      n = forceData.length;

  while (++i < n) {
    q.visit(circleCollide(forceData[i]));
  }

  nodes.each(gravity(0.2 * e.alpha))
    .attr("d", function(d) {
      var x = d.x,
          y = d.y,
          rad = dotSize(d.playcount);
      return polygonPath(x, y, rad, 6);
    })
    ;
}

// Move nodes toward cluster focus.
function gravity(alpha) {
  return function(d) {
    d.y += (d.y0 - d.y) * alpha;
    d.x += (d.x0 - d.x) * alpha;
  };
}

function circleCollide(thisNode) {
  var r = thisNode.radius,
      nx1 = thisNode.x - r,
      nx2 = thisNode.x + r,
      ny1 = thisNode.y - r,
      ny2 = thisNode.y + r;

  return function(quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point !== thisNode)) {
      var x = thisNode.x - quad.point.x,
          y = thisNode.y - quad.point.y,
          l = Math.sqrt(x * x + y * y),
          r = thisNode.radius + quad.point.radius;

      if (l < r) {
        l = (l - r) / l * 0.5;
        thisNode.x -= x *= l;
        thisNode.y -= y *= l;
        quad.point.x += x;
        quad.point.y += y;
      }
    }
    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
  };
}

function polygonPath(x,y,rad,sides) {
  var path = "M ";
  for (var a = 0; a < sides; a++) {
    if (a > 0) {
      path = path + "L ";
    }
    path = path + (x + (Math.sin(2 * Math.PI * a / sides) * rad)) + " " +
                  (y - (Math.cos(2 * Math.PI * a / sides) * rad)) + " ";
  }
  path = path + "z";
  return path;
}
