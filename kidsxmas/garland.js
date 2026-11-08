(function(){
  var colors = ["#E0455A","#F0D77B","#3E8E52","#ffffff"];
  var g = document.getElementById("garland-bulbs");
  if (!g) return;
  var spacing = 90, count = Math.ceil(1400 / spacing) + 1;
  for (var i = 0; i < count; i++){
    var x = i * spacing + 40;
    var color = colors[i % colors.length];
    var wire = document.createElementNS("http://www.w3.org/2000/svg","line");
    wire.setAttribute("x1", x); wire.setAttribute("y1", 3);
    wire.setAttribute("x2", x); wire.setAttribute("y2", 20);
    wire.setAttribute("stroke", "#4a3a20"); wire.setAttribute("stroke-width", "1.2"); wire.setAttribute("opacity","0.7");
    g.appendChild(wire);
    var bulb = document.createElementNS("http://www.w3.org/2000/svg","circle");
    bulb.setAttribute("cx", x); bulb.setAttribute("cy", 25); bulb.setAttribute("r", 5.5);
    bulb.setAttribute("fill", color); bulb.setAttribute("filter", "url(#bulbGlow)");
    g.appendChild(bulb);
  }
})();
