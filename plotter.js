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
    projection = d3.geo.kavrayskiy7()
                 .scale(170)
                 .translate([my.width/2, my.height/2])
                 .precision(0.1),
    dotSize = d3.scale.linear(),
    color = d3.scale.ordinal()
              .domain([0,3])
              .range(["#eee", "#ddd", "#ccc", "#bbb"]) ;

svg = d3.select(".data-viz")
    .append("svg")
    .attr({ width: my.width,
            height: my.height });

debugG = svg.append("g").attr("class", "geometry");
artistG = svg.append("g").attr("class", "artists");

d3.json("./geo_data/world-admin-0-1-simple.json", function(err, json) {
  if (err) return console.warn(err);

  var countries = topojson.feature(json, json.objects.regions).features,
      neighbors = topojson.neighbors(json.objects.regions.geometries);

  console.log(countries);
  console.log(neighbors);

  var geo_path = d3.geo.path()
    .projection(projection)
    ;

  debugG.selectAll(".country")
      .data(countries)
    .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", geo_path)
      //.attr("fill", "#ccc")
      .style("fill", function(d, i) { return color(d.color = d3.max(neighbors[i], function(n) { return countries[n].color; }) + 1 | 0); })
      ;
});

d3.json("./final_data.json", function(err, json) {
  if (err) return console.warn(err);
  init(json);
});

function init(data) {
  var nodes,
      forceData,
      force = d3.layout.force();

    dotSize
      //.domain([0, 1000])
      .domain([0, d3.max(data, function(d) { return +d.playcount; })])
      .range([2,15]);

  forceData = data.map(function(d) {
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
          playcount: +d.playcount
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
  forceData = forceData.filter(function(d) {
    if (d.noGeocode !== true)
      return d;
    else
      return null;
  });

  force
    .gravity(0)
    .charge(-10)
    .chargeDistance(15)
    //.friction(0.5)
    .nodes(forceData)
    .size([my.width, my.height])
    .on("tick", tick)
    .start();

  //console.log(forceData);

  nodes = artistG.selectAll("circle")
      .data(forceData)
    .enter()
      //.append("circle")
      //.attr("r", function(d) { return dotSize(d.playcount); })
      //.append("rect")
      //.attr("width", function(d) { return dotSize(d.playcount); })
      //.attr("height", function(d) { return dotSize(d.playcount); })
      .append("path")
      .attr("d", function(d) {
        var x = d.x,
            y = d.y,
            rad = dotSize(d.playcount);
        return polygonPath(x, y, rad, 6);
      })
      .attr("style", "opacity: 0.5")
      //.attr("cy", function(d) {
        //if (d.geocode)
          //return projection([d.geocode.lng, d.geocode.lat])[1];
        //else
          //return 0; })
      //.attr("cx", function(d) {
        //if (d.geocode)
          //return projection([d.geocode.lng, d.geocode.lat])[0];
        //else
          //return 0; })
      ;

  function tick(e) {
    nodes.each(gravity(0.2 * e.alpha))
      //.each(collide(0.5))
      .attr("d", function(d) {
        var x = d.x,
            y = d.y,
            //rad = 4;
            rad = dotSize(d.playcount);
        return polygonPath(x, y, rad, 6);
      })
      //.attr("x", function(d) { return d.x; })
      //.attr("y", function(d) { return d.y; })
      //.attr("cx", function(d) { return d.x; })
      //.attr("cy", function(d) { return d.y; })
      ;
    //console.log("alpha");
  }

  // Move nodes toward cluster focus.
  function gravity(alpha) {
    return function(d) {
      d.y += (d.y0 - d.y) * alpha;
      d.x += (d.x0 - d.x) * alpha;
    };
  }

  function collide(k) {
    var q = d3.geom.quadtree(forceData);
    return function(nodes) {
      var nr  = nodes.r + padding,
          nx1 = nodes.x - nr,
          nx2 = nodes.x + nr,
          ny1 = nodes.y - nr,
          ny2 = nodes.y + nr;
      q.visit(function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== nodes)) {
          var x = nodes.x - quad.point.x,
            y = nodes.y - quad.point.y,
          l = x * x + y * y,
              r = nr + quad.point.r;
          if (l < r * r) {
            l = ((l = Math.sqrt(l)) - r) / l * k;
            nodes.x -= x *= l;
            nodes.y -= y *= l;
            quad.point.x += x;
            quad.point.y += y;
          }
        }
        return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
      });
    };
  }
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
