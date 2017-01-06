const PID_RADIUS = 5,
      LABEL_OFFSET_X = 5,
      LABEL_OFFSET_Y = 7,
      LINE_LENGTH = 25,
      REPULSION = -100,
      ARROW_DX = 5,
      ARROW_DY = 3;

function arrow(x, y, slope, direction) {
  let d = direction ? 1 : -1,
      xn = x - d * ARROW_DX / Math.sqrt(1 + Math.pow(slope, 2)),
      yn = y - d * slope * ARROW_DX / Math.sqrt(1 + Math.pow(slope, 2));

  let pslope = -1 / slope, // perpendicular slope
      dx = ARROW_DY / Math.sqrt(1 + Math.pow(pslope, 2)),
      dy = pslope * ARROW_DY / Math.sqrt(1 + Math.pow(pslope, 2)),
      xa = xn - dx,
      ya = yn - dy,
      xa2 = xn + dx,
      ya2 = yn + dy;

  return "M " + x  + " " + y +
         "L " + xa + " " + ya +
         "M " + x  + " " + y +
         "L " + xa2 + " " + ya2;
}


export default class {
  constructor(container, node_view, pids) {
    this.container = container;
    this.node_view = node_view;

    let zoom = d3.behavior.zoom()
          .scaleExtent([0, 4])
          .on("zoom", () =>
              this.svg.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")")
             );

    this.svg = d3.select(container.get(0))
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .call(zoom)
      .append("g")
      .attr("transform", "translate(0, 0)");

    this.force = d3.layout.force()
      .gravity(.05)
      .distance(LINE_LENGTH)
      .charge(REPULSION)
      .size([this.container.innerWidth(), this.container.innerHeight()]);

    this.svg.append("g")
      .attr("id", "msggroup");

    this.svg.append("g")
      .attr("id", "linkgroup");

    this.svg.append("g")
      .attr("id", "nodegroup");

    // use ES6 Maps once they're better supported
    // and generate `links` from the node tree
    this.pids = pids;
    this.links = {};
    this.msgs = {};
  }

  link_id(from, to) {
    return from + "-" + to;
  }

  removeNode(pid) {
    d3.values(pid.links).forEach(link => {
      // when a process exits, its linked ports also exit
      if(link.target.id.match(/#Port<[\d\.]+>/))
        delete this.pids[link.target.id];

      delete link.target.links[pid.id];
      delete this.links[this.link_id(link.source.id, link.target.id)];
    });
  }

  addLink(source_id, target_id) {
    let source = this.pids[source_id],
        target = this.pids[target_id];

    if(source && target) {
      let link = {"source": source, "target": target, "strength": 1},
          id = this.link_id(source_id, target_id);

      this.links[id] = link;
      source.links[target_id] = target.links[source_id] = link;
    }
  }

  removeLink(source_id, target_id) {
    let id = this.link_id(source_id, target_id),
        source = this.pids[source_id],
        target = this.pids[target_id];

    delete this.links[id];
  }

  addMsg(source_id, target_id) {
    let source = this.pids[source_id],
        target = this.pids[target_id];

    if (source && target) {
      let id = source_id + "-" + target_id + "-" + Math.random(),
          msg = {id: id, "source": source, "target": target};
      this.msgs[id] = msg;
    }
  }

  drawMessageElements(message_els) {
    message_els.attr("d", d => {
        let dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);

        return "M" + d.source.x + "," + d.source.y +
               "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
      })
      .attr("d", function(d) {
        let midway = this.getPointAtLength(this.getTotalLength() / 2);

        let x = midway.x,
            y = midway.y,
            dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            slope = dy/dx;

        if (!isFinite(slope))
          slope = Number.MAX_SAFE_INTEGER;

        return d3.select(this).attr("d") + arrow(midway.x, midway.y, slope, dx > 0);
      });
  }

  updateName(pid, name) {
    d3.select("[id='"+ pid +"_label']").name(name);
  }

  stopMsgTraceAll() {
    d3.values(this.pids).forEach(pid => {
      pid.msg_traced = false;
    });
  }

  update(restart_force) {
    let pids_list = d3.values(this.pids),
        links_list = d3.values(this.links),
        self = this;

    let node_els = this.svg.select("#nodegroup").selectAll("g.node").data(pids_list, d => d.id),
        link_els = this.svg.select("#linkgroup").selectAll("line.link").data(links_list, d => this.link_id(d.source.id, d.target.id)),
        msg_els = this.svg.select("#msggroup").selectAll("path.msg").data(d3.values(this.msgs), d => d.id);

    this.force.nodes(pids_list)
      .links(links_list);

    let drag = this.force.drag()
          .on("dragstart", d => {
            d3.event.sourceEvent.stopPropagation();
          })
          .on("dragend", d => {
            if (!d3.event.sourceEvent.altKey) {
              d.fixed = true;
            }
          });

    let node = node_els.enter().append("g")
          .attr("class", d => "node " + d.type)
          .call(drag);

    node_els.classed("msg_traced", d => d.msg_traced);

    node.on("click", function(d) {
          if (d3.event.defaultPrevented)
            return;

          if (d3.event.altKey) {
            d.msg_traced = true;
            self.node_view.msgTracePID(d.id);
            d3.select(this).classed("msg_traced", true);
          }
        })
        .on("dblclick", d => {
          d.fixed = false;
          d3.event.stopPropagation();
        });

    node.append("circle")
      .attr("r", PID_RADIUS);

    node.append("text")
      .attr("id", n => n.id + "_label")
      .attr("class", "pid_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y)
      .text(n => n.name || n.id);

    node.append("text")
      .attr("id", n => n.id + "_app_label")
      .attr("class", "application_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y * 2)
      .text(n => n.application);

    link_els.enter().append("line")
      .attr("class", "link");

    let new_msg_els = msg_els.enter().append("path")
          .attr("class", "msg");

    new_msg_els.transition()
      .duration(2000)
      .style("opacity", 0)
      .each("end", d => delete this.msgs[d.id])
      .remove();

    // if the force layout has stopped moving, we'll statically draw the message curves.
    if (this.force.alpha() <= 0)
      this.drawMessageElements(msg_els);


    node_els.exit()
      .transition()
      .duration(200)
      .style("opacity", 0)
      .remove()
      .selectAll("circle")
      .attr("class", "dead");

    link_els.exit().remove();

    this.force.on("tick", () => {
      link_els.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      this.drawMessageElements(msg_els);

      node_els.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
    });

    if (restart_force)
      this.force.start();
  }
}
