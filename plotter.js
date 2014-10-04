d3.json("./final_data.json", function(err, json) {
  if (err) return console.warn(err);
  init(json);
});

function init(data) {
  console.log(data);
}

function plotter() {
  "use strict";

  // set defaults
  var my = {
    "className": "dot",
    "projection": d3.geo.albers(),
    "r": 3,
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

  // main d3 calls, the constructer
  var init = function(d, el) {
    var nodes;

    my.force = d3.layout.force();
    my.data = d;
    my.parentElement = el;

    my.nodes = my.data
      .map(function(d) {
        if (d.Lon && d.Lat) {
          var point = my.projection([d.Lon, d.Lat]);

          if (point) {
            return {
              x: point[0],
              y: point[1],
              x0: point[0],
              y0: point[1],
              r: my.r,
              lat: d.Lat,
              lon: d.Lon,
            };
          }
          else {
            console.log("point outside of projection");
            console.log(d);
            return {
              noGeocode: true
            };
          }
        }
        else {
          console.log("no geocode");
          console.log(d);
          return {
            noGeocode: true
          };
        }
      });

    my.nodes.forEach(function(d, i) {
      if (d.noGeocode === true) {
        my.nodes.splice(i);
      }
    });

    my.force
      .gravity(0)
      .charge(my.charge)
      .chargeDistance(my.chargeDistance)
      .friction(my.friction)
      .nodes(my.nodes)
      .size([my.width, my.height])
      .on("tick", tick)
      .start();

    my.node = my.parentElement
      .selectAll("circle")
      .data(my.nodes)
      .enter()
      .append("circle")
      .attr("class", my.className)
      .attr("r", function(d) { return d.r; })
      .attr("stroke", my.stroke)
      .attr("stroke-width", my.strokeWidth)
      .attr("fill", my.fill)
      .on("click", function(d) { console.log(d); })
      ;
  };

  function tick(e) {
    my.node
      .each(gravity(0.2 * e.alpha))
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });
  }

  // Move nodes toward cluster focus.
  function gravity(alpha) {
    return function(d) {
      d.y += (d.y0 - d.y) * alpha;
      d.x += (d.x0 - d.x) * alpha;
    };
  }

  // attr_accessor fo JS
  // Get attr with .attr();
  // Set attr with .attr(val).attr2(val2);
  // Set is chainable as it returns the object
  function attr_accessor(attr) {
    function build_accessor(val) {
      if (!arguments.length) return my[attr];
      my[attr] = val;
      return init;
    }
    return build_accessor;
  }

  // exposed functions
  // Register what can be accessed
  init.projection      = attr_accessor("projection");
  init.r               = attr_accessor("r");
  init.charge          = attr_accessor("charge");
  init.chargeDistance  = attr_accessor("chargeDistance");
  init.force           = attr_accessor("force");
  init.friction        = attr_accessor("friction");
  init.strokeWidth     = attr_accessor("strokeWidth");
  init.stroke          = attr_accessor("stroke");
  init.fill            = attr_accessor("fill");
  init.data            = attr_accessor("data");
  init.width           = attr_accessor("width");
  init.height          = attr_accessor("height");
  init.parentElement   = attr_accessor("parentElement");

  init.toggle = function() {
    if (my.parentElement.style("visibility") == "visible") {
      my.parentElement.style("visibility", "hidden");
    }
    else {
      my.parentElement.style("visibility", "visible");
    }
  };

  // return the "constructor"
  return init;
}

