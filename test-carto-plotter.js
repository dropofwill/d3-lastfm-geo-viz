var svg = d3.select("body").append("svg"),
    cartogram = d3.cartogram()
                  .projection(d3.geo.albersUsa())
                    .value(function(d) {
                      return Math.random() * 100;
                  });

d3.json("./geo_data/world-admin-0.json", function(topology) {
  var features = cartogram(topology, topology.objects.countries.geometries);
  svg.selectAll("path")
    .data(features)
    .enter()
    .append("path")
    .attr("d", cartogram.path);
});
