import ClusterView from "./cluster_view.js";
import MessageSequence from "./message_sequence.js";

const ALPHA_DECAY = 0.015,
      PID_RADIUS = 5,
      LABEL_OFFSET_X = 5,
      LABEL_OFFSET_Y = 7,
      INVISIBLE_LINK_STRENGTH = 0.01,
      LINK_LENGTH = 80,
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
        .scaleExtent([0.1, 3])
        .filter(() => !d3.event.altKey)
        .on("zoom", () => {
          this.set_transform(d3.event.transform.x, d3.event.transform.y, d3.event.transform.k);
        });

    let new_conversation,
        new_conversation_group,
        new_conversation_seq,
        new_conversation_start = [0, 0];

    let drag =
        d3.drag()
        .on("start", d => {
          new_conversation_group = this.svg.select("#conversationgroup").append("g").attr("class", "conversation_group");
          new_conversation = new_conversation_group.append("rect").attr("class", "selection");
          new_conversation_seq = new_conversation_group.append("svg");

          new_conversation_start = [d3.event.x, d3.event.y];

          let start = this.transform_point(d3.event.x, d3.event.y);
          new_conversation.attr("x", start.x);
          new_conversation.attr("y", start.y);
          new_conversation.attr("width", 0);
          new_conversation.attr("height", 0);

        })
        .on("drag", d => {
          let start_x = new_conversation_start[0],
              start_y = new_conversation_start[1];
          let width = (d3.event.x - start_x),
              height = (d3.event.y - start_y);

          let transformed_width = width / this.transform[2],
              transformed_height = height / this.transform[2];

          let new_conversation_seq_start = this.transform_point(start_x + width, start_y + height);
          new_conversation_seq.attr("x", new_conversation_seq_start.x);
          new_conversation_seq.attr("y", new_conversation_seq_start.y);

          if (width >= 0) {
            new_conversation.attr("width", transformed_width);
            new_conversation_seq.attr("width", transformed_width * 3);
          }

          if (height >= 0) {
            new_conversation.attr("height", transformed_height);
            new_conversation_seq.attr("height", transformed_height * 3);
          }
        })
        .on("end", d => {
          let msg_seq = new MessageSequence(new_conversation_seq);
          new_conversation_seq.node().message_sequence = msg_seq;
        });

    this.svg_element =
      d3.select(container.get(0))
      .append("svg")
      .node();

    this.svg =
      d3.select(this.svg_element)
        .attr("width", "100%")
        .attr("height", "100%")
        .call(zoom)
        .call(drag)
        .append("g");

    // x, y, k
    this.transform = null;
    this.set_transform(0, 0, 1);


    this.forceCenter = d3.forceCenter();
    this.forceLink = d3.forceLink().distance(LINK_LENGTH);
    this.forceInvisibleLink = d3.forceLink().strength(INVISIBLE_LINK_STRENGTH);
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
      .attr("id", "nodebackgroundgroup");

    this.svg.append("g")
      .attr("id", "conversationgroup");

    this.svg.append("g")
      .attr("id", "msggroup");

    this.svg.append("g")
      .attr("id", "linkgroup");

    this.svg.append("g")
      .attr("id", "invisiblelinkgroup");

    this.svg.append("g")
      .attr("id", "processgroup");

    this.links = {};
    this.invisible_links = {}; // used to group unlinked (free-floating) pids near the "net_kernel" pid
    this.msgs = {};
    this.conversations = {}; // process -> list of conversations
    this.message_sequences = {}; // conversation -> MessageSequence
  }

  transform_point(x, y) {
    let point = this.svg_element.createSVGPoint();
    point.x = x;
    point.y = y;

    let transformed = point.matrixTransform(this.svg.node().getScreenCTM().inverse());
    return {
      x: transformed.x,
      y: transformed.y
    };
  }

  set_transform(x, y, k) {
    let translation = [Math.round(x), Math.round(y)];
    this.transform = translation.concat(k);

    this.svg.attr("transform", "translate(" + translation + ") scale(" + k + ")");
  }

  add_process_to_conversation(process_id, conversation) {
    this.conversations[process_id] = this.conversations[process_id] || [];
    this.conversations[process_id].push(conversation);
  }

  conversations_at_point(x, y) {
    let that = this;
    return this.svg.selectAll("g.conversation_group > rect.selection")
      .filter(function(d, i) {
        let bounds = this.getBoundingClientRect(),
            upper_left = that.transform_point(bounds.x, bounds.y),
            lower_right = that.transform_point(bounds.x + bounds.width, bounds.y + bounds.height);

        let within_x = upper_left.x <= x && x <= lower_right.x,
            within_y = upper_left.y <= y && y <= lower_right.y;

        return within_x && within_y;
      })
      .select(function() {
        return d3.select(this.parentNode).select("svg").node();
      });
  }


  link_id(from, to) {
    return [from.id, to.id].sort().join("-");
  }

  removeProcess(process) {
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

  addMsg(source, target, message) {
    let id = source.id + "-" + target.id + "-" + Math.random(),
        msg = {id: id, source: source, target: target, message: message};

    let all_conversations = (this.conversations[source.id] || []).concat(this.conversations[target.id] || []);
    let message_sequences = {};

    all_conversations.forEach(function (c) {
      let id = c.message_sequence.id;
      message_sequences[id] = c.message_sequence;
    });
    Object.values(message_sequences).forEach(function (m) {
      m.addMessage(msg);
    });

    this.msgs[id] = msg;
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

  msgTraceProcess(d, node) {
    d.msg_traced = true;
    this.cluster_view.msgTracePID(d.id);
    d3.select(node).classed("msg_traced", true);
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

    let pids_by_node = d3.nest().key(d => d.node).map(pids_list),
        nodes_list = pids_by_node.keys();

    let processes = this.svg.select("#processgroup").selectAll("g.process").data(pids_list, d => d.id),
        node_bgs = this.svg.select("#nodebackgroundgroup").selectAll("g.nodebackground").data(nodes_list, d => d),
        links = this.svg.select("#linkgroup").selectAll("line.link").data(links_list, d => this.link_id(d.source, d.target)),
        invisible_links = this.svg.select("#invisiblelinkgroup").selectAll("line.link").data(invisible_links_list, d => this.link_id(d.source, d.target)),
        msgs = this.svg.select("#msggroup").selectAll("path.msg").data(d3.values(this.msgs), d => d.id);

    this.forceSimulation.nodes(pids_list);
    this.forceSimulation.force("link").links(links_list);
    this.forceSimulation.force("invisiblelink").links(invisible_links_list);

    // Processes

    processes.exit()
      .transition()
      .duration(200)
      .style("opacity", 0)
      .remove()
      .selectAll("circle")
      .attr("class", "dead");

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
        .on("end", function(d) {
          let conversations = self.conversations_at_point(d3.event.x, d3.event.y);
          if (conversations.size() > 0) {
            self.msgTraceProcess(d, this);
            let id = this.id;
            conversations.nodes().forEach(function (c) {
              self.add_process_to_conversation(id, c);
            });
          }
          d.fixed = true;
        });

    let new_processes =
        processes.enter().append("g")
        .attr("class", d => "process " + d.type)
        .attr("id", d => d.id)
        .call(drag);

    processes = new_processes.merge(processes);

    processes.classed("msg_traced", d => d.msg_traced);

    new_processes.on("click", function(d) {
      if (d3.event.defaultPrevented)
        return;

      if (d3.event.altKey) {
        self.msgTraceProcess(d, this);
      }
    })
    .on("dblclick", d => {
      d3.event.stopPropagation();
      d.fixed = false;
      d.fx = null;
      d.fy = null;
    });

    new_processes.append("circle")
      .attr("r", PID_RADIUS);

    new_processes.append("text")
      .attr("id", n => n.id + "_label")
      .attr("class", "pid_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y)
      .text(n => n.name);

    new_processes.append("text")
      .attr("id", n => n.id + "_app_label")
      .attr("class", "application_label")
      .attr("dx", LABEL_OFFSET_X)
      .attr("dy", LABEL_OFFSET_Y * 2)
      .text(n => n.application);

    // Links

    links.exit().remove();
    var new_links =
        links.enter().append("line")
        .attr("class", "link");

    links = new_links.merge(links);


    invisible_links.exit().remove();
    var new_invisible_links =
        invisible_links.enter().append("line")
        .attr("class", "link");

    invisible_links = new_invisible_links.merge(invisible_links);

    // Messages

    let new_msgs = msgs.enter().append("path").attr("class", "msg");

    new_msgs.each(d => {
      let pid_box =
        d3.select("[id='"+ d.source.id +"']")
          .select("circle")
          .node()
          .getBoundingClientRect();

      let x = pid_box.x + pid_box.width/2,
          y = pid_box.y + pid_box.height/2;

    });

    new_msgs.transition()
      .on("end", d => delete this.msgs[d.id])
      .duration(2000)
      .style("opacity", 0)
      .remove();

    msgs = msgs.merge(new_msgs);

    // Node Backgrounds

    node_bgs.exit()
      // .transition()
      // .duration(2000)
      // .style("opacity", 0)
      .remove();

    let new_node_bgs =
        node_bgs.enter()
        .append("g")
        .attr("class", "nodebackground")
        .attr("node", d => d);

    new_node_bgs
        .append("polygon")
        .attr("class", "nodebackground")
        .attr("stroke-width", PID_RADIUS * 8);

    new_node_bgs
      .append("text")
      .text(d => d.replace(/@.*/, ''));

    node_bgs = node_bgs.merge(new_node_bgs);


    // if the force layout has stopped moving, so the tick function wont be called, we'll statically draw the message curves.
    if (this.forceSimulation.alpha() < ALPHA_DECAY)
      this.drawMessageElements(msgs);

    this.forceSimulation.on("tick", () => {
      links
        .attr("x1", d => Math.round(d.source.x))
        .attr("y1", d => Math.round(d.source.y))
        .attr("x2", d => Math.round(d.target.x))
        .attr("y2", d => Math.round(d.target.y));

      this.drawMessageElements(msgs);

      processes.attr("transform", d => "translate(" + Math.round(d.x) + "," + Math.round(d.y) + ")");

      pids_by_node.each((pids, node) => {
        let points = pids.map(p => [p.x, p.y]),
            hull = d3.polygonHull(points);

        if (hull) {
          hull = hull.map(p => [Math.round(p[0]), Math.round(p[1])]);

          let hull_points_str = hull.map(point => point.join(" ")).join(", ");

          let node_bg = node_bgs.filter("[node='" + node + "']");

          node_bg
            .select("polygon")
            .attr("points", hull_points_str);

          let centroid = d3.polygonCentroid(hull);

          node_bg
            .select("text")
            .attr("transform", function(d) {
              let bounding_box = this.getBBox();
              return "translate(" + (centroid[0] - bounding_box.width/2) + "," + (centroid[1] - bounding_box.height/2) + ")";
            });
        }
      });
    });

    if (restart_force)
      this.forceSimulation.alpha(1).restart();
  }
}
