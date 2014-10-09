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
    topoG,
    barG,
    projection = d3.geo.kavrayskiy7()
                   .scale(170)
                   .translate([my.width/2, my.height/2])
                   .precision(0.1),
    projection2 =  d3.geo.azimuthalEqualArea(),
    dotSize =    d3.scale.linear(),
    barSize =    d3.scale.linear(),
    color =      d3.scale.ordinal()
                    .domain([0,3])
                    .range(["#98abc5", "#7b6888", "#a05d56", "#d0743c", "#ff8c00"]),
                    //.range(colorbrewer.Greys[4]),
                    //.range(["#eee", "#ddd", "#ccc", "#bbb"]),
    dotBorder = 1,
    minPlaycount = 3,
    countries,
    neighbors,
    countriesPlayData,
    nodes,
    forceData,
    noGeocodeData,
    artistData,
    zoom,

    buttonForce = document.querySelector("#force-switch"),
    buttonSwitched = document.querySelector("#projection-switch"),

    nameTip = d3.tip().attr("class", "d3-tip").html(function(d) {
      return "<div class='tip'><p><b>" + d.name + "</b><br>" + d.artist_location.location + "<br>Playcount: " + d.playcount + "</p></div>";
    }),

    force = d3.layout.force();

// Set the zoom behavior defaults
zoom = d3.behavior.zoom()
  .scale(1)
  .scaleExtent([1, 30])
  .translate([0,0])
  .on("zoom", zoomed);

svg = d3.select(".data-viz")
    .append("svg")
    .attr({ width: my.width,
            height: my.height })
    .call(zoom)
    ;

// invoke tip in the context of the selection
svg.call(nameTip);

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

    //regions = topojson.feature(json, json.objects.regions).features,
    countries = topojson.feature(json, json.objects.countries).features;
    neighbors = topojson.neighbors(json.objects.countries.geometries);

    var geo_path = d3.geo.path()
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
  var maxPlaycount = d3.max(data, function(d) { return +d.playcount; }),
      totalPlaycount = 0;

  dotSize
    .domain([minPlaycount, maxPlaycount])
    .range([0.25,10])
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
          originalX: point[0],
          originalY: point[1],
          x: point[0],
          y: point[1],
          x0: point[0],
          y0: point[1],
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
    .size([my.width, my.height])
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
      .on("click", function(d) { console.log(d); })
      .on("mouseover", nameTip.show)
      .on("mouseout", nameTip.hide)
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
      return d.playcount > 0 ? 0.7 : 0.1;
    })
    ;

  //force.start();
  //for (var i = 100; i > 0; --i) force.tick();
  //force.stop();

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

  barG.selectAll("rect")
      .data(countriesPlayData)
    .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", function(d) { return barSize(d.playcount); })
      .attr("height", 15)
      .attr("fill", function(d) { return color(d.color); })
    ;
}

function projectionTween(projection0, projection1) {
  return function(d) {
    var t = 0;

    var projection = d3.geo.projection(project)
      .scale(1)
      .translate([my.width / 2, my.height / 2]);

    var path = d3.geo.path()
      .projection(projection);

    function project(λ, φ) {
      λ *= 180 / Math.PI, φ *= 180 / Math.PI;
      var p0 = projection0([λ, φ]), p1 = projection1([λ, φ]);
      return [(1 - t) * p0[0] + t * p1[0], (1 - t) * -p0[1] + t * -p1[1]];
    }

    return function(_) {
      t = _;
      return path(d);
    };
  };
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
    .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")")
    .attr("stroke-width", function() { return dotBorderScale(dotBorder / d3.event.scale); })
    ;

  /*
   *artistG.selectAll("path")
   *  .attr("d", function(d) {
   *      var x = d.x,
   *          y = d.y,
   *          rad = dotSize(d.playcount / (0.5 * d3.event.scale));
   *      return polygonPath(x, y, rad, 6);
   *  })
   *  ;
   */
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

buttonSwitched.addEventListener("click", function() {
  d3.selectAll(".country").transition()
    .duration(750)
    .attrTween("d", projectionTween(projection, projection2))
    ;
  artistG.selectAll("path").transition()
    .duration(750)
    .attrTween("d", projectionTween(projection, projection2))
    ;
});

buttonForce.addEventListener("click", function() {
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
