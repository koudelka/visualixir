import ClusterView from "./cluster_view.js";

const ALPHA_DECAY = 0.015,
      PID_RADIUS = 5,
      LABEL_OFFSET_X = 5,
      LABEL_OFFSET_Y = 7,
      LINK_LENGTH = 70,
      INVISIBLE_LINK_LENGTH = 200,
      REPULSION = -LINK_LENGTH,
      CENTERING_STRENGTH = 0.017,
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
  constructor(container, cluster_view) {
    this.container = container;
    this.cluster_view = cluster_view;

    let zoom =
        d3.zoom()
        .scaleExtent([0, 4])
        .on("zoom", () => {
          let translation = [d3.event.transform.x, d3.event.transform.y];
          return this.svg.attr("transform", "translate(" + translation + ") scale(" + d3.event.transform.k + ")");
        });

    this.svg = d3.select(container.get(0))
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .call(zoom)
      .append("g");

    this.forceCenter = d3.forceCenter();
    this.forceLink = d3.forceLink().distance(LINK_LENGTH);
    this.forceInvisibleLink = d3.forceLink().distance(INVISIBLE_LINK_LENGTH);
    this.forceManyBody = d3.forceManyBody().strength(REPULSION);
    this.forceCenter = d3.forceCenter(this.container.innerWidth() / 2, this.container.innerHeight() / 2);

    this.forceSimulation =
      d3.forceSimulation()
      .force("link", this.forceLink)
      .force("invisiblelink", this.forceInvisibleLink)
      .force("charge", this.forceManyBody)
      .force("center", this.forceCenter)
      .force("x", d3.forceX().strength(CENTERING_STRENGTH))
      .force("y", d3.forceY().strength(CENTERING_STRENGTH));

    this.forceSimulation
      .velocityDecay(0.2)
      .alphaDecay(ALPHA_DECAY);

    this.svg.append("g")
      .attr("id", "msggroup");

    this.svg.append("g")
      .attr("id", "linkgroup");

    this.svg.append("g")
      .attr("id", "invisiblelinkgroup");

    this.svg.append("g")
      .attr("id", "nodegroup");

    this.links = {};
    this.invisible_links = {}; // used to group unlinked (free-floating) pids near the "net_kernel" pid
    this.msgs = {};
  }

  link_id(from, to) {
    return [from.id, to.id].sort().join("-");
  }

  removeNode(process) {
    d3.values(process.links).forEach(linked_process => {
      delete this.links[this.link_id(process, linked_process)];
    });

    let grouping_process = this.cluster_view.grouping_processes[process.node];
    if (grouping_process) {
      this.removeInvisibleLink(process, grouping_process);
    }

    if (process == grouping_process) {
      d3.keys(process.invisible_links).forEach(other_process => {
        this.removeInvisibleLink(process, other_process);
      });
    }
  }

  addLink(source, target) {
    if(source && target) {
      let link = {"source": source, "target": target},
          id = this.link_id(source, target);

      this.links[id] = link;
    }
  }

  addInvisibleLink(source, target) {
    if(source && target) {
      let link = {"source": source, "target": target},
          id = this.link_id(source, target);

      this.invisible_links[id] = link;
    }
  }

  removeInvisibleLink(source, target) {
    if(source && target) {
      let id = this.link_id(source, target);

      delete this.invisible_links[id];
    }
  }

  removeLink(source, target) {
    let id = this.link_id(source, target);

    delete this.links[id];
  }

  addMsg(source, target) {
    let id = source.id + "-" + target.id + "-" + Math.random(),
        msg = {id: id, "source": source, "target": target};
    this.msgs[id] = msg;
  }

  drawMessageElements(message_els) {
    console.log("start")
    message_els.attr("d", d => {
      console.log(d.id)
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
    console.log("stop")
  }

  updateName(pid, name) {
    d3.select("[id='"+ pid +"_label']").name(name);
  }

  stopMsgTraceAll() {
    d3.values(this.cluster_view.processes).forEach(pid => {
      pid.msg_traced = false;
    });
  }

  update(restart_force) {
    let pids_list = d3.values(this.cluster_view.processes),
        links_list = d3.values(this.links),
        invisible_links_list = d3.values(this.invisible_links),
        self = this;

    let nodes = this.svg.select("#nodegroup").selectAll("g.node").data(pids_list, d => d.id),
        links = this.svg.select("#linkgroup").selectAll("line.link").data(links_list, d => this.link_id(d.source, d.target)),
        invisible_links = this.svg.select("#invisiblelinkgroup").selectAll("line.link").data(invisible_links_list, d => this.link_id(d.source, d.target)),
        msgs = this.svg.select("#msggroup").selectAll("path.msg").data(d3.values(this.msgs), d => d.id);

    this.forceSimulation.nodes(pids_list);
    this.forceSimulation.force("link").links(links_list);
    this.forceSimulation.force("invisiblelink").links(invisible_links_list);

    nodes.exit()
      .transition()
      .duration(200)
      .style("opacity", 0)
      .remove()
      .selectAll("circle")
      .attr("class", "dead");

    invisible_links.exit().remove();
    links.exit().remove();

    let drag =
        d3.drag()
        .on("start", d => {
          d3.event.sourceEvent.stopPropagation();
          this.forceSimulation.restart();
          this.forceSimulation.alpha(1.0);
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", d => {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        })
        .on("end", d => {
          d.fixed = true;
        });

    let new_nodes =
        nodes.enter().append("g")
        .attr("class", d => "node " + d.type)
        .call(drag);

    nodes = new_nodes.merge(nodes);

    nodes.classed("msg_traced", d => d.msg_traced);

    new_nodes.on("click", function(d) {
      if (d3.event.defaultPrevented)
        return;

      if (d3.event.altKey) {
        d.msg_traced = true;
        self.cluster_view.msgTracePID(d.id);
        d3.select(this).classed("msg_traced", true);
      }
    })
    .on("dblclick", d => {
      d3.event.stopPropagation();
      d.fixed = false;
      d.fx = null;
      d.fy = null;
    });

    new_nodes.append("circle")
      .attr("r", PID_RADIUS);

    new_nodes.append("text")
      .attr("id", n => n.id + "_label")
      .attr("class", "pid_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y)
      .text(n => n.name);

    new_nodes.append("text")
      .attr("id", n => n.id + "node_label")
      .attr("class", "pid_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y * 2)
      .text(n => n.node);

    new_nodes.append("text")
      .attr("id", n => n.id + "_app_label")
      .attr("class", "application_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y * 3)
      .text(n => n.application);

    var new_links =
        links.enter().append("line")
        .attr("class", "link");

    links = new_links.merge(links);

    var new_invisible_links =
        invisible_links.enter().append("line")
        .attr("class", "link");

    invisible_links = new_invisible_links.merge(invisible_links);

    let new_msgs = msgs.enter().append("path").attr("class", "msg");

    new_msgs.transition()
      .on("end", d => delete this.msgs[d.id])
      .duration(2000)
      .style("opacity", 0)
      .remove();

    msgs = msgs.merge(new_msgs);

    // if the force layout has stopped moving, so the tick function wont be called, we'll statically draw the message curves.
    if (this.forceSimulation.alpha() < ALPHA_DECAY)
      this.drawMessageElements(msgs);

    this.forceSimulation.on("tick", () => {
      links.attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      this.drawMessageElements(msgs);

      nodes.attr("transform", d => "translate(" + d.x + "," + d.y + ")");
    });

    if (restart_force)
      this.forceSimulation.alpha(1).restart();
  }
}
