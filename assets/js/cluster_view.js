import Graph from "./graph.js";
import MessageSequence from "./message_sequence.js";
import Log from "./log.js";
import Process from "./process.js";

export default class {
  constructor(graph_container, msg_seq_container, log_container) {
    this.processes = {};
    this.grouping_processes = {};

    graph_container.empty();
    msg_seq_container.empty();
    log_container.empty();

    this.graph = new Graph(graph_container, this);
    this.msg_seq = new MessageSequence(msg_seq_container);
    this.logger = new Log(log_container);

    this.channel = window.socket.channel("trace", {});

    this.channel.join();

    // the function indirection here maintains "this" in the callback
    // there's got to be a better way...
    this.channel.on("visualize_node", msg => this.visualizeNode(msg));
    this.channel.on("cleanup_node", msg => this.cleanupNode(msg));
    this.channel.on("spawn", msg => this.spawn(msg));
    this.channel.on("exit", msg => this.exit(msg));
    this.channel.on("name", msg => this.name(msg));
    this.channel.on("links", msg => this.links(msg));
    this.channel.on("unlink", msg => this.unlink(msg));
    this.channel.on("msg", msg => this.msg(msg));
  }

  visualizeNode(msg) {
    $.each(msg.pids, (pid, info) => this.addProcess(pid, info));
    this.graph.update(true);
  };

  cleanupNode(msg) {
    // could optimize this by building a nodes -> pids map upon visualization
    $.each(this.processes, (pid, process) => {
      if (process.node == msg.node) {
        this.removeProcess(pid);
      }
    });
    delete this.grouping_processes[msg.node];
    this.graph.update(true);
  }

  spawn(msg) {
    $.each(msg, (pid, info) => {
      this.addProcess(pid, info);

      this.logger.logOnePidLine(this.processes[pid], "spawn");
    });
    this.graph.update(true);
  };

  exit(msg) {
    if (this.processes[msg.pid]) {
      this.logger.logOnePidLine(this.processes[msg.pid], "exit");
      this.removeProcess(msg.pid);
      this.graph.update(true);
    }
  };

  name(msg) {
    this.graph.updateName(msg.pid, msg.name);
  };

  links(msg) {
    msg.links.forEach(link => {
      var from = this.processes[link[0]],
          to = this.processes[link[1]];

      if (from && to) {
        this.addLink(from, to);

        this.logger.logTwoPidLine(from, to, "link");
      }
    });
    this.graph.update(true);
  };

  unlink(msg) {
    this.graph.removeLink(msg.link[0], msg.link[1]);
    this.logger.logTwoPidLine(this.processeses[msg.link[0]], this.processes[msg.link[1]], "unlink");
    this.graph.update(true);
  };

  msg(msg) {
    this.graph.addMsg(msg.from_pid, msg.to_pid);

    var from = this.processes[msg.from_pid],
        to = this.processes[msg.to_pid];

    if (from && to) {
      this.logger.logMsgLine(from, to, msg.msg);
      this.msg_seq.addMessage(from, to, msg.msg);
    }

    this.graph.update(false);
  };

  addProcess(pid, info) {
    if (!this.processes[pid]) {
      let process = this.processes[pid] = new Process(pid, info);

      if (process.isGroupingPid()) {
        this.grouping_processes[process.node] = process;

        // since this is the first time the grouping process has been seen, go through all processes
        // and create invisble links for processes that don't have links
        d3.values(this.processes).forEach(maybe_unlinked_process => {
          if (maybe_unlinked_process.links.length == 0) {
            this.addInvisibleLink(maybe_unlinked_process);
          }
        });
      }

      if (info.links.length > 0 && !process.isGroupingPid()) {
        info.links.forEach(other_pid => this.addLink(process, this.processes[other_pid]));
      } else {
        this.addInvisibleLink(process);
      }
    }
  }

  addLink(from, to) {
    if (from && to) {
      from.links[to.id] = to;
      to.links[from.id] = from;
      this.graph.addLink(from, to);
    }
  }

  addInvisibleLink(process) {
    let grouping_process = this.grouping_processes[process.node];
    if (grouping_process) {
      grouping_process.invisible_links[process.id] = process;
      this.graph.addInvisibleLink(grouping_process, process);
    }
  }

  removeInvisibleLink(process) {
    let grouping_process = this.grouping_processes[process.node];

    if (grouping_process) {
      delete grouping_process.invisible_links[process.id];
      this.graph.removeInvisibleLink(grouping_process, process);
    }
  }

  removeProcess(pid) {
    if(!this.processes[pid]) {
      console.log("tried to remove unknown process " + pid);
      return;
    }

    let process = this.processes[pid];

    $.each(process.links, (_idx, other_pid) => delete other_pid.links[pid]);
    this.removeInvisibleLink(process);

    d3.values(process.links).forEach(linked_process => {
      delete linked_process.links[pid];

      // when a process exits, its linked ports also exit
      if(linked_process.id.match(/#Port<[\d\.]+>/))
        delete this.processes[linked_process.id];
    });

    this.graph.removeNode(process);

    delete this.processes[pid];
  }

  msgTracePID(id) {
    this.channel.push("msg_trace", id);
  }

  stopMsgTraceAll(node) {
    this.channel.push("stop_msg_trace_all", node);
    this.graph.stopMsgTraceAll();
    this.graph.update(false);
  }
}
