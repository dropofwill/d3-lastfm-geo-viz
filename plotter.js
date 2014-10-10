var svg,
    artistG,
    topoG,
    barG,
    width = 960,
    height = 500,
    projection = d3.geo.kavrayskiy7()
                   .scale(220)
                   .translate([width/2 - 20, height/2 + 50])
                   .precision(0.1),
    projection2 =  d3.geo.azimuthalEqualArea(),
    dotSize =    d3.scale.linear(),
    barSize =    d3.scale.linear(),
    color =      d3.scale.ordinal()
                    .domain([0,3])
                    //.range(["#7b6888", "#c7ceda","#98abc5",  "#d0743c", "#ff8c00"]),
                    //.range(['rgb(166,206,227)','rgb(31,120,180)','rgb(178,223,138)','rgb(51,160,44)']),
                    .range(colorbrewer.Paired[6]),
    dotBorder = 1,
    minPlaycount = 3,
    totalPlaycount = 0,
    geo_path,
    countries,
    neighbors,
    countriesPlayData,
    nodes,
    forceData,
    noGeocodeData,
    artistData,
    zoom,
    currentTranslate = 0,
    currentScale = 0,

    formatPercent = d3.format(",.1%"),
    formatDecimal = d3.format(".3n"),

    locked = false,
    buttonForce = document.querySelector("#force-switch"),
    buttonGesture = document.querySelector("#lock-switch"),
    buttonZoomIn = document.querySelector("#zoom-in-btn"),
    buttonZoomOut = document.querySelector("#zoom-out-btn"),
    buttonReset = document.querySelector("#reset-btn"),
    active = d3.select(null),

    artistDetails = d3.select(".artist-details"),
    countryDetails = d3.select(".country-details"),
    force = d3.layout.force();

// Set the zoom behavior defaults
zoom = d3.behavior.zoom()
  .scale(1)
  .scaleExtent([1, 30])
  .translate([0,0])
  .on("zoom", zoomed);

svg = d3.select(".data-viz")
    .append("svg")
    .attr({ width: width,
            height: height })
    .call(zoom)
    ;

// A rectangle to reset the view, drawn behind the map
svg.append("rect")
  .attr("class", "background")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "azure")
  //.on("click", reset)
  ;

topoG = svg.append("g").attr("class", "geometry");
artistG = svg.append("g").attr("class", "artists");
barG = svg.append("g").attr("class", "bars");

dotBorderScale = d3.scale.linear()
  .domain([dotBorder,0])
  .range([dotBorder,0.1]);

queue(1)
  .defer(loadMapData)
  .defer(loadArtistData);

function loadMapData(callback) {
  d3.json("./geo_data/world-admin-0.json", function(err, json) {
    if (err) return console.warn(err);

    countries = topojson.feature(json, json.objects.countries).features;
    neighbors = topojson.neighbors(json.objects.countries.geometries);

    geo_path = d3.geo.path()
      .projection(projection)
      ;

    countries.forEach(function(v, i) {
      v.playcount = 0;
    });

    topoG.selectAll(".country")
        .data(countries)
      .enter()
        .append("path")
        .attr("d", geo_path)
        .attr({
          "stroke": "#000",
          "stroke-opacity": 0.1,
          "stroke-weight": 1,
          "opacity": 0.1,
          "class": "country"})
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

function init(data) {
  var maxPlaycount = d3.max(data, function(d) { return +d.playcount; });

  dotSize
    .domain([minPlaycount, maxPlaycount])
    .range([0.5,15])
    ;

  artistData = data.map(function(d) {
    if (d.geocode && d.playcount > minPlaycount) {
      var point = projection([d.geocode.lng, d.geocode.lat]);

      if (point) {
        return {
          name: d.name,
          id: d.id,
          playcount: +d.playcount,
          radius: dotSize(+d.playcount),
          lat: d.geocode.lat,
          lng: d.geocode.lng,
          originalX: point[0], originalY: point[1],
          x: point[0], y: point[1],
          x0: point[0], y0: point[1],
          genres: d.genres,
          discovery_rank: d.discovery_rank,
          familiarity: d.familiarity,
          hotttnesss: d.hotttnesss,
          years_active: d.years_active,
          hotttnesss_rank: d.hotttnesss_rank,
          familiarity_rank: d.familiarity_rank,
          artist_location: d.artist_location
        };
      }
      else {
        return {
          name: d.name,
          id: d.id,
          playcount: +d.playcount,
          radius: dotSize(+d.playcount),
          noGeocode: true
        };
      }
    }
    else {
      return {
        name: d.name,
        id: d.id,
        playcount: +d.playcount,
        radius: dotSize(+d.playcount),
        noGeocode: true
      };
    }
  });

  // Remove items without x,y from forceData
  forceData = artistData.filter(function(d) {
    if (d.noGeocode !== true) return d;
    else return null;
  });

  noGeocodeData = artistData.filter(function(d) {
    if (d.noGeocode) return d;
    else return null;
  });

  force
    .gravity(0)
    .charge(0.00000001)
    .chargeDistance(0.00000001)
    .friction(0.01)
    .alpha(0.0001)
    .nodes(forceData)
    .size([width, height])
    .on("tick", tick)
    .start()
    ;

  nodes = artistG.selectAll(".artist")
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
        "stroke-opacity": 1,
        "stroke-weight": 1,
        "opacity": 0.5,
        "class": "artist"})
      .attr("fill", function(d) { return getArtistColor(d); } )
      .on("click", function(d) {
        clicked(getRelatedCountry(d));
        updateArtistBox(d);
        })
      .on("mouseover", function(d) { updateArtistBox(d); })
      ;

  // Bigger dom elements on bottom
  nodes.sort(function(a,b) {
    var aP = a.playcount,
        bP = b.playcount;
    if (aP > bP) return -1;
    else return 1;
  })
  ;

  topoG.selectAll("path")
    .data(countries)
    .attr("opacity", function(d) {
      return d.playcount > minPlaycount ? 0.7 : 0.05;
    })
    .on("click", function(d) {
      if (d.playcount > minPlaycount) clicked(d);
      updateCountryBox(d);
    })
    ;

  countries.forEach(function(v, i) {
    totalPlaycount += +v.playcount;
  });

  noGeocodeData.forEach(function(v, i) {
    totalPlaycount += +v.playcount;
  });

  barSize
    .domain([minPlaycount, totalPlaycount])
    ;

  countriesPlayData = countries.filter(function(d) {
    if (d.playcount > minPlaycount) {
      return d;
    }
  });
}

function updateArtistBox(d) {
  var d_ = d;
  d3.select(".artist-name").text(d.name + ": " + d.playcount + " plays");
  d3.select(".artist-loc").text(d.artist_location.location);
  d3.select(".artist-years").text(function() {
    if (d_.years_active[0] && d_.years_active[0].start && d_.years_active[0].end) {
      return d_.years_active[0].start + " - " + d_.years_active[0].end;
    }
    else if (d_.years_active[0] && d_.years_active.start) {
      return d_.years_active[0].start + " - Present";
    }
    else {
      return null;
    }
  });
  d3.select(".artist-genre").html("<i>Genres:</i> " + d.genres.map(function(v) { return v.name; }).join(", "));
  d3.select(".artist-fam").html("<i>Familiarity:</i> " + formatDecimal(d.familiarity));
  d3.select(".artist-hot").html("<i>Hotttnesss:</i> " + formatDecimal(d.hotttnesss));

  var myCountry = getRelatedCountry(d);
  if (myCountry) updateCountryBox(myCountry);
}

function updateCountryBox(d) {
  d3.select(".country-name").text(d.properties.ADMIN);
  d3.select(".country-total").html("<i>Total Plays:</i> " + d.playcount + " / " + totalPlaycount);
  d3.select(".country-percent").html("<i>Percent of Total Plays: </i>" + formatPercent(d.playcount / totalPlaycount));
}

// This is called on click and onchange of the select box
function clicked(d) {
  if (active.node() === d) return reset();
  active = d3.select(d);

  var bounds = geo_path.bounds(d);
  var xbounds = d3.extent(forceData, function(d) { return projection(d.lat); }),
      ybounds = d3.extent(forceData, function(d) { return projection(d.lng); });
      //bounds = [xbounds, ybounds];

  //console.log([xbounds, ybounds], currentTranslate, currentScale);

  var dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = 0.7 / Math.max(dx / width, dy / height),
      translate = [width / 2 - scale * x, height / 2 - scale * y];

  //console.log(bounds);
  svg.transition()
    .duration(1000)
    .call(zoom.translate(translate).scale(scale).event);
}

function getArtistColor(artist) {
  var artistColor,
      artistCountry = getRelatedCountry(artist);

  //console.log(artistCountry);

  if (artistCountry) {
    artistCountry.playcount += +artist.playcount;
    artistColor = color(artistCountry.color);
  }
  else {
    console.warn(artist.name, "has no country");
  }
  return artistColor;
}

function getRelatedCountry(artist) {
  var relatedCountry = false;

  for (var i = 0; i < countries.length; i++) {
    var aCountry = artist.artist_location.country,
        vBrk = countries[i].properties.BRK_NAME,
        vAdmin = countries[i].properties.ADMIN,
        vFormal = countries[i].properties.FORMAL_EN;

    if (vBrk == aCountry || vAdmin == aCountry || vFormal == aCountry) {
      relatedCountry = countries[i];
      break;
    }
  }

  return relatedCountry;
}

function zoomed() {
  currentScale = d3.event.scale;
  currentTranslate = d3.event.translate;

  svg.selectAll("path")
    .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")")
    .attr("stroke-width", function() { return dotBorderScale(dotBorder / d3.event.scale); })
    ;
}

function reset() {
  active = d3.select(null);

  svg.transition()
    .duration(750)
    .call(zoom.translate([0, 0]).scale(1).event);
}

function tick(e) {
  var q = d3.geom.quadtree(forceData),
      i = 0,
      n = forceData.length;

  if (buttonForce.getAttribute("data-force") === "true") {
    while (++i < n) {
      q.visit(circleCollide(forceData[i]));
    }
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

function polygonPath(x, y, rad, sides) {
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

function zoomDir(dir) {
  var h = parseFloat(document.querySelector(".data-viz svg").clientHeight),
      w = parseFloat(document.querySelector(".data-viz svg").clientWidth),
      newZoom,
      newX,
      newY;

  if (dir == "in") {
    newZoom = zoom.scale() * 1.5;
    newX = ((zoom.translate()[0] - (width / 2)) * 1.5) + width / 2;
    newY = ((zoom.translate()[1] - (height / 2)) * 1.5) + height / 2;
  }
  else {
    newZoom = zoom.scale() * 0.75;
    newX = ((zoom.translate()[0] - (width / 2)) * 0.75) + width / 2;
    newY = ((zoom.translate()[1] - (height / 2)) * 0.75) + height / 2;
  }

  svg.transition()
    .duration(750)
    .call(zoom.translate([newX, newY]).scale(newZoom).event);
}

buttonZoomIn.addEventListener("click", function() { zoomDir("in"); });
buttonZoomOut.addEventListener("click", function() { zoomDir("out"); });

buttonForce.addEventListener("click", function() {
  this.classList.toggle("icon-expand");
  this.classList.toggle("icon-contract");

  if (buttonForce.getAttribute("data-force") === "true") {
    force.stop();
    force.start();
    buttonForce.setAttribute("data-force", "false");
  }
  else {
    force.start();
    buttonForce.setAttribute("data-force", "true");
  }
});

buttonReset.addEventListener("click", function() {
  reset();
});

buttonGesture.addEventListener("click", function() {
  this.classList.toggle("icon-locked");
  this.classList.toggle("icon-unlocked");

  if (!locked) {
    locked = true;
    svg.on(".zoom", null);
  }
  else {
    locked = false;
    svg.call(zoom);
  }
});


